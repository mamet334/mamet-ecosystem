const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const results: any = {};

  // Check Gemini Keys
  const geminiKeys = (Deno.env.get('GEMINI_API_KEY') || '').split(',').map(k => k.trim()).filter(k => k);
  results.gemini_keys_count = geminiKeys.length;
  results.gemini_keys_status = [];
  
  for (let i = 0; i < geminiKeys.length; i++) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKeys[i]}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'say hi' }] }] })
      });
      results.gemini_keys_status.push({
        key_index: i,
        key_preview: geminiKeys[i].substring(0, 8) + '...',
        status: res.status,
        ok: res.ok
      });
    } catch (e: any) {
      results.gemini_keys_status.push({ key_index: i, status: 'error', error: e.message });
    }
  }

  // Check Groq
  //
  // CATATAN (2026-09-10): probe ini sebelumnya hanya memanggil chat dengan
  // `llama-3.1-8b-instant` dan melaporkan status mentahnya. Hasilnya 404, dan
  // 404 itu ambigu kalau berdiri sendiri — ia bisa berarti model tak dikenal,
  // bisa juga salah endpoint. Yang menghilangkan keraguan adalah bertanya ke
  // Groq model APA yang sebenarnya tersedia untuk key ini, lalu mencocokkan
  // model yang dipakai kode kita terhadap daftar itu. Daftar dari server
  // mengalahkan dokumentasi maupun ingatan (pelajaran Item 41 & 51).
  const groqKey = Deno.env.get('GROQ_API_KEY') || '';
  results.groq_key_exists = !!groqKey;

  // Model Groq yang benar-benar dirujuk kode kita hari ini. Kalau salah satu
  // tidak ada di daftar server, itulah penyebab 404-nya.
  const MODEL_GROQ_DIPAKAI = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];

  if (groqKey) {
    // 1. Daftar model yang tersedia untuk key ini.
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${groqKey}` }
      });
      const body: any = await res.json().catch(() => ({}));
      results.groq_models_status = res.status;
      if (res.ok && Array.isArray(body?.data)) {
        const tersedia = body.data.map((m: any) => m.id).sort();
        results.groq_models_available = tersedia;
        results.groq_models_count = tersedia.length;
        // Inilah jawabannya: mana dari model kita yang masih ada, mana yang hilang.
        results.groq_models_dipakai_kode = MODEL_GROQ_DIPAKAI.map((m) => ({
          model: m,
          masih_ada: tersedia.includes(m)
        }));
      } else {
        results.groq_models_error = body?.error?.message ?? String(res.status);
      }
    } catch (e: any) {
      results.groq_models_status = 'error';
      results.groq_models_error = e.message;
    }

    // 2. Panggilan chat nyata, tetap dipertahankan — daftar model membuktikan
    //    KEBERADAAN, panggilan ini membuktikan model itu benar-benar BISA
    //    dipakai oleh key ini. Dua hal yang berbeda.
    //
    // `max_tokens` sengaja LONGGAR (200), bukan 5.
    //
    // Dengan max_tokens=5 probe ini menjawab 200 tapi `content` KOSONG —
    // gpt-oss adalah model reasoning, jatah token pertamanya habis untuk
    // penalaran sebelum sempat mengeluarkan teks. Terukur: 46 dari 56 token
    // keluaran adalah `reasoning_tokens`. Status 200 dengan keluaran kosong
    // adalah persis pola yang berulang kali menipu di proyek ini, jadi
    // probe-nya diberi ruang cukup untuk benar-benar menghasilkan kalimat —
    // dan `groq_benar_menjawab` yang menjadi kesimpulannya, bukan statusnya.
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai/gpt-oss-20b', messages: [{ role: 'user', content: 'Balas persis satu kata: OK' }], max_tokens: 200 })
      });
      const body: any = await res.json().catch(() => ({}));
      const choice = body?.choices?.[0];
      results.groq_status = res.status;
      results.groq_ok = res.ok;
      results.groq_model_diuji = 'openai/gpt-oss-20b';
      results.groq_jawaban = choice?.message?.content ?? null;
      results.groq_finish_reason = choice?.finish_reason ?? null;
      results.groq_usage = body?.usage ?? null;
      // Sukses yang sebenarnya: bukan status 200, melainkan ADA teks yang keluar.
      results.groq_benar_menjawab = !!(choice?.message?.content || '').trim();
      if (!res.ok) results.groq_error = body?.error?.message ?? null;
    } catch (e: any) {
      results.groq_status = 'error';
      results.groq_error = e.message;
    }
  }

  // Check OpenRouter
  //
  // CATATAN (2026-09-10): sampai hari ini pemeriksaan OpenRouter dan OpenAI di
  // berkas ini hanya `!!key` — memeriksa KEBERADAAN, bukan KEABSAHAN. Key Gemini
  // dan Groq diuji dengan panggilan nyata, dua ini tidak. Akibatnya alat yang
  // dibuat khusus untuk mendeteksi key bermasalah melaporkan `true` untuk key
  // OpenRouter yang ternyata mati (401 "User not found"), dan itu key yang
  // dipakai SETIAP pengguna tanpa BYOK. Keabsahannya kini disimpulkan dari probe
  // embedding di bawah, yang memang memakai key ini lewat panggilan sungguhan.
  const orKey = Deno.env.get('OPENROUTER_API_KEY') || '';
  results.openrouter_key_exists = !!orKey;

  // Probe kemampuan EMBEDDING lewat OpenRouter.
  //
  // Ditambahkan 2026-09-10 untuk menjawab satu pertanyaan yang menentukan:
  // kalau embedding dipindahkan dari Gemini langsung ke OpenRouter, berapa
  // dimensi vektor yang keluar? Skema kita mematok vector(3072) dan angka itu
  // ditentukan oleh keluaran Gemini langsung. Kalau OpenRouter mengembalikan
  // dimensi lain, insert-nya akan ditolak Postgres — persis kegagalan Item 46.
  // Jadi ini diuji dengan panggilan nyata, bukan diasumsikan dari dokumentasi
  // (dokumentasi OpenRouter tidak menyebut parameter `dimensions` sama sekali).
  //
  // Modelnya sengaja sama persis dengan yang dipanggil langsung hari ini,
  // supaya yang dibandingkan hanya JALURNYA, bukan modelnya.
  results.openrouter_embedding = {};
  if (orKey) {
    for (const model of ['google/gemini-embedding-2', 'openai/text-embedding-3-small']) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${orKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: 'uji dimensi embedding' })
        });
        const body: any = await res.json().catch(() => ({}));
        const vec = body?.data?.[0]?.embedding;
        results.openrouter_embedding[model] = {
          status: res.status,
          ok: res.ok,
          dimensions: Array.isArray(vec) ? vec.length : null,
          usage: body?.usage ?? null,
          error: res.ok ? null : (body?.error?.message ?? String(res.status))
        };
      } catch (e: any) {
        results.openrouter_embedding[model] = { status: 'error', error: e.message };
      }
    }
  }

  // Keabsahan key OpenRouter disimpulkan dari probe di atas: kalau SEMUA model
  // menjawab 401, masalahnya key — bukan model. Ini penting karena key inilah
  // yang dipakai setiap pengguna tanpa BYOK (request_pipeline.ts:124).
  const probes = Object.values(results.openrouter_embedding || {}) as any[];
  results.openrouter_key_valid = probes.length === 0
    ? null
    : !probes.every((p) => p.status === 401);
  if (results.openrouter_key_valid === false) {
    results.openrouter_warning =
      'Key OpenRouter sistem DITOLAK (401). Setiap pengguna tanpa API key sendiri memakai key ini dan tidak akan bisa memakai sistem sama sekali.';
  }

  // Check OpenAI
  const oaiKey = Deno.env.get('OPENAI_API_KEY') || '';
  results.openai_key_exists = !!oaiKey;

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
