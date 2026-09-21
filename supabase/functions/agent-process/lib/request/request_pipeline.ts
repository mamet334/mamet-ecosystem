import { handleCorsAndOptions } from './cors_middleware.ts';
import { handleAuth } from './auth_middleware.ts';
import { checkQuota } from './quota_middleware.ts';
import { enforcePolicy } from './policy_middleware.ts';
import { parseRequestParams } from './request_parser.ts';
import { buildUnifiedExecutionContext } from './execution_context.ts';
import { UnifiedExecutionContext, RequestPipelineParams, RequestPipelineResult } from './types.ts';
import { RuntimeContext, createBackgroundTaskTracker, createRuntimeLogger } from '../runtime_context.ts';
import { getPluginPromptList } from '../../plugins/registry.ts';
import { CapabilityRegistry } from '../adapters/adapter_registry.ts';
import { generateEmbedding, EMBEDDING_DIMENSIONS } from '../rag/embedding.ts';
import { rapikanRiwayat } from './history_compressor.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { konteksWaktuPengguna, zonaWaktuSah } from './waktu_pengguna.ts';
import { bersihkanRiwayatDataTabel } from '../../../../../frontend/src/core/runtime/services/dataTabelAsnSaring.js';


/**
 * Embedding untuk pencarian memori — lewat generateEmbedding (rag/embedding.ts), pintu
 * embedding satu-satunya beserta penjaga dimensinya.
 *
 * Sampai 2026-09-10 (Item 62) di sini ada salinan kaskade adapter sendiri yang menerima
 * vektor sepanjang APA PUN. Bila Gemini gagal dan pengguna chat dengan BYOK openai, ia
 * memakai kunci pengguna itu untuk vektor OpenAI 768 dimensi, yang lalu ditolak
 * match_memories (kolom 3072).
 */
async function generateEmbeddingThroughAdapter(text: string, rctx: RuntimeContext): Promise<number[]> {
  const embedding = await generateEmbedding(text, rctx);
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding gagal (didapat ${embedding.length} dimensi, perlu ${EMBEDDING_DIMENSIONS}) — pencarian memori dilewati.`);
  }
  return embedding;
}

export async function executeRequestPipeline(
  params: RequestPipelineParams,
  _rctx?: any 
): Promise<RequestPipelineResult> {
  const { request, corsHeaders } = params;
  
  const corsResponse = handleCorsAndOptions(request, corsHeaders);
  if (corsResponse) return { ctx: {} as any, rctx: {} as any, response: corsResponse };

  const runtimeEnv = {
    supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
    supabaseServiceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY') || '',
    apifyApiToken: Deno.env.get('APIFY_API_TOKEN') || '',
    enableAsyncMemoryWrite: Deno.env.get('ENABLE_ASYNC_MEMORY_WRITE') !== 'false'
  };

  // Kunci SERVER Gemini & Groq tidak lagi dibaca (keputusan Owner 2026-09-15, fokus OpenRouter): ketiga kunci
  // Gemini gratis mati (403/429) sehingga Intent Router & Coordinator gagal di setiap pesan, dan kunci gratis pihak
  // lain berisiko berubah kebijakan/biaya. Secret-nya sudah dihapus dari Supabase. Gemini/Groq hanya dengan BYOK.
  const openAIKey = Deno.env.get('OPENAI_API_KEY') || '';

  const bypassCooldown = request.headers.get('x-bypass-cooldown') === 'true';
  if (bypassCooldown) {
    CapabilityRegistry.clearAllCooldowns();
    console.log("🔓 Cooldowns cleared via x-bypass-cooldown header!");
  }

  const { user, authErrorResponse } = await handleAuth(request, runtimeEnv.supabaseUrl, runtimeEnv.supabaseAnonKey, corsHeaders);
  if (authErrorResponse) return { ctx: {} as any, rctx: {} as any, response: authErrorResponse };

  // UUID Validation - Fix for "SUPABASE" string error
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
  if (!isValidUUID) {
    console.error('[RequestPipeline] Invalid user.id:', user.id);
    return { ctx: {} as any, rctx: {} as any, response: new Response(JSON.stringify({ error: 'Invalid user ID' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }) };
  }

  const parsed = await parseRequestParams(request, user);

  if (!parsed.finalMessage || !Array.isArray(parsed.tools)) {
      return { ctx: {} as any, rctx: {} as any, response: new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }) };
  }

  // Dynamic provider handling
  const provider = parsed.provider || 'openrouter';
  const providerHeaderKey = `x-byok-${provider}`;
  const byokProviderKey = request.headers.get(providerHeaderKey);
  // [BYOK WAJIB — keputusan Owner 2026-09-10]
  //
  // Key sistem dari environment SENGAJA tidak lagi dipakai sebagai cadangan untuk
  // provider chat. Sebelumnya, pengguna tanpa key sendiri diam-diam dialihkan ke
  // `OPENROUTER_API_KEY` milik Owner. Dua akibatnya buruk sekaligus:
  //
  //   1. Belanja pengguna eksternal ditanggung Owner tanpa jejak kepemilikan, dan
  //      ikut memakan plafon harian Owner sendiri.
  //   2. Ketika key sistem itu mati — terbukti 2026-09-10, OpenRouter menjawab
  //      401 "User not found" — SETIAP pengguna tanpa BYOK langsung tertutup
  //      total, dengan galat mentah alih-alih penjelasan. Tidak ada yang tahu,
  //      karena Owner selalu punya key sendiri sehingga tak pernah menyentuh
  //      jalur itu.
  //
  // Aturannya kini sama untuk semua mode, menggeneralisasi penjagaan yang sudah
  // lebih dulu ada untuk mode ENGINEER (2026-07-30): pemakaian harus punya
  // pemiliknya. (Key sistem Gemini untuk fungsi internal sudah dihapus 2026-09-15 —
  // Intent Router/Coordinator kini memakai kunci OpenRouter pengguna.)
  const providerApiKey = (byokProviderKey || '').trim();

  const finalProvider = providerApiKey ? provider : 'openrouter';
  const finalApiKey = providerApiKey || (request.headers.get('x-byok-openrouter') || '').trim();

  // [SECURITY FIX 2026-07-30] GUARD: Mode ENGINEER wajib menggunakan BYOK key dari user.
  // Jika tidak ada BYOK key, TOLAK request. Engineer TIDAK BOLEH menggunakan API key sistem.
  // Ini mencegah Engineer menghabiskan saldo owner tanpa izin eksplisit.
  if (parsed.mode === 'ENGINEER' || parsed.appSource === 'engineer') {
    const byokOpenrouter = request.headers.get('x-byok-openrouter') || '';
    const byokGemini    = request.headers.get('x-byok-gemini')     || '';
    const byokGroq      = request.headers.get('x-byok-groq')       || '';
    const byokOpenai    = request.headers.get('x-byok-openai')     || '';
    const byokAnthropic = request.headers.get('x-byok-anthropic')  || '';
    const hasAnyByok = byokOpenrouter || byokGemini || byokGroq || byokOpenai || byokAnthropic;

    if (!hasAnyByok) {
      console.warn('[RequestPipeline] ⛔ ENGINEER mode request ditolak: tidak ada BYOK API key dari user.');
      return { ctx: {} as any, rctx: {} as any, response: new Response(JSON.stringify({
        error: 'ENGINEER_NO_API_KEY',
        message: 'Engineer mode memerlukan API Key eksplisit dari user (BYOK). ' +
                 'Buka Settings → AI Provider dan masukkan API Key Anda terlebih dahulu.'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }) };
    }
  }

  // Gerbang BYOK umum. Ditaruh SESUDAH penjagaan ENGINEER supaya mode itu tetap
  // memberi pesannya sendiri yang lebih spesifik.
  if (!finalApiKey) {
    console.warn(`[RequestPipeline] ⛔ Permintaan ditolak: tidak ada BYOK API key dari user (mode: ${parsed.mode || 'default'}, appSource: ${parsed.appSource || 'unknown'}).`);
    return { ctx: {} as any, rctx: {} as any, response: new Response(JSON.stringify({
      error: 'NO_API_KEY',
      message: 'Aplikasi ini memerlukan API Key Anda sendiri. ' +
               'Buka Settings → AI Provider dan masukkan API Key Anda terlebih dahulu. ' +
               'Key disimpan di perangkat Anda dan dipakai langsung untuk permintaan Anda, ' +
               'sehingga setiap pemakaian jelas pemiliknya.'
    }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }) };
  }

  console.log(`[RequestPipeline] Provider: ${finalProvider}, Key source: BYOK header`);

  // Hapus duplikasi ctx yang error!
  const ctx = buildUnifiedExecutionContext({
      message: parsed.message,
      desktopOSMode: parsed.desktopOSMode,
      tools: parsed.tools,
      ragEnabled: parsed.ragEnabled,
      memoryEnabled: parsed.memoryEnabled,
      userId: user.id,
      userName: parsed.userName,
      appSource: parsed.appSource,
      mode: parsed.mode
  });

  console.log("[L1] auth binding", { actualAuthId: ctx.auth.userId, appSource: ctx.auth.appSource, message: parsed.message ? parsed.message.substring(0, 50) + '...' : null });

  ctx.request = { ...ctx.request, tools: parsed.tools, model: parsed.model, stream: parsed.stream, history: parsed.history, globalMemory: parsed.globalMemory, semanticContext: parsed.semanticContext || '', extractedImage: parsed.extractedImage, guardianPromptDirective: parsed.guardianPromptDirective, desktopOSMode: parsed.desktopOSMode, auditMode: parsed.auditMode, ragEnabled: parsed.ragEnabled, memoryEnabled: parsed.memoryEnabled, dataTabel: parsed.dataTabel === true, workspaceTarget: parsed.workspaceTarget, storageTarget: parsed.storageTarget, finalMessage: parsed.finalMessage };

  const policyResponse = enforcePolicy(ctx, !!parsed.stream, corsHeaders);
  if (policyResponse) return { ctx: {} as any, rctx: {} as any, response: policyResponse };

  const quotaResponse = await checkQuota(ctx.auth.userId, runtimeEnv.supabaseUrl, runtimeEnv.supabaseServiceKey, !!parsed.stream, corsHeaders);
  if (quotaResponse) return { ctx: {} as any, rctx: {} as any, response: quotaResponse };

  const traceId = parsed.traceId || crypto.randomUUID();
  const backgroundTasks = createBackgroundTaskTracker(traceId);
  
  const rctx: RuntimeContext = {
    traceId,
    keys: {
      // Semua kunci LLM kini milik PENGGUNA (2026-09-15). Dulu `gemini`/`allGemini`/`groq` diisi kunci server dan
      // DITULIS SESUDAH `[finalProvider]`, sehingga BYOK Gemini pengguna tertimpa kunci server; dan `openRouter`
      // jatuh ke `OPENROUTER_API_KEY` sistem bila pengguna memilih penyedia lain — Intent Router/Coordinator yang
      // kini lewat OpenRouter akan diam-diam memakai saldo Owner. Tanpa kunci OpenRouter pengguna, adapter tidak
      // tersedia dan Coordinator dilewati.
      openRouter: finalProvider === 'openrouter'
        ? finalApiKey
        : (request.headers.get('x-byok-openrouter') || '').replace(/[^\x00-\x7F]/g, '').trim(),
      // Embedding memakai kunci OpenRouter PENGGUNA saja (Item 63–65).
      openRouterByok: (request.headers.get('x-byok-openrouter') || '').replace(/[^\x00-\x7F]/g, '').trim(),
      gemini: finalProvider === 'gemini' ? finalApiKey : '',
      allGemini: finalProvider === 'gemini' && finalApiKey ? [finalApiKey] : [],
      groq: finalProvider === 'groq' ? finalApiKey : '',
      openAI: finalProvider === 'openai' ? finalApiKey : openAIKey,
    },

    // thinking TIGA keadaan (2026-09-13): true/false dari tier Owner diteruskan apa adanya — false kini
    // benar-benar mematikan nalar di OpenRouter (reasoning_openrouter.ts). undefined = klien tidak
    // mengirim (mis. mametlite) → bawaan model, perilaku lama.
    model: { model: parsed.model, provider: finalProvider, thinking: parsed.thinking === true ? true : parsed.thinking === false ? false : undefined },
    policy: {},
    // streamNalar (hybrid, 2026-09-14): jawaban tetap JSON utuh, tetapi nalar dialirkan lebih dulu lewat SSE —
    // hanya bila Thinking dinyalakan (tanpa nalar tak ada yang dialirkan). Lihat index.ts.
    stream: { isStream: !!parsed.stream, extractedImage: parsed.extractedImage, desktopOSMode: !!parsed.desktopOSMode, auditMode: parsed.auditMode || 'OFF', streamNalar: !parsed.stream && parsed.streamNalar === true && parsed.thinking === true },
    env: runtimeEnv,
    logger: createRuntimeLogger(ctx.auth.userId, backgroundTasks, !!parsed.stream, runtimeEnv),
    userId: ctx.auth?.userId || 'anonymous',
    state: { explicitModelErrors: '' },
    tasks: backgroundTasks
  };

  // =============================================
  // [BACKEND RAG: Generate Embedding + Vector Search]
  // =============================================
  //
  // `parsed.globalMemory` TIDAK ditimpa lagi (Item 65). Nilainya — konteks kiriman frontend —
  // sudah tersalin ke ctx.request.globalMemory di atas dan dipakai context_builder; di sini ia
  // hanya menentukan penanda "SISTEM RETRIEVAL AKTIF". Dulu penanda itu dihitung dari teks
  // "Tidak ada memori yang relevan." sehingga model diberi tahu pengetahuannya berhenti di 2024
  // walau dokumen/web sudah disuntikkan. Memori hasil pencarian vektor disimpan terpisah.
  let memoriVektor = '';
  try {
    // Only run RAG if the message is non-empty and RAG is enabled
    if (parsed.finalMessage && parsed.finalMessage.trim().length > 0 && parsed.ragEnabled !== false) {
      console.log('🔍 [RAG] Generating embedding for vector search...');

      // 1. Vektor kueri lewat pintu embedding tunggal (OpenRouter, kunci pengguna, 768 dimensi — Item 70).
      //    Disimpan di ctx.request supaya pencarian DOKUMEN di context_builder memakai vektor yang
      //    sama — satu embedding per pesan, bukan dua.
      const userEmbedding = await generateEmbeddingThroughAdapter(parsed.finalMessage, rctx);
      (ctx.request as any).queryEmbedding = userEmbedding;

      // 2. Query vector database via Supabase RPC
      //
      // WAJIB memakai overload 4-argumen `match_memories(..., target_user_id)`.
      // Overload 3-argumen tidak memfilter user sama sekali; dipanggil dengan
      // klien service-role seperti di bawah, ia memindai `user_memories` milik
      // SELURUH akun lalu menyuntikkan hasilnya ke prompt user ini (Item 45).
      const ragUserId = ctx.auth?.userId;

      if (parsed.memoryEnabled === false) {
        // Tombol Memory mati (2026-09-15): vektor pertanyaan tetap dibuat di atas karena pencarian DOKUMEN memakainya,
        // tetapi tabel memori tidak disentuh.
        console.log('[RAG] Tombol Memory mati — pencarian memori dilewati.');
      } else if (!ragUserId) {
        // Gagal ke arah TERTUTUP. Tanpa identitas pemilik, satu-satunya
        // pencarian yang mungkin adalah pencarian lintas pengguna — jadi lebih
        // baik tidak mencari sama sekali daripada membocorkan memori orang lain.
        console.warn('[RAG] ⚠️ Pencarian memori dilewati — userId tidak tersedia. Menolak mencari lintas pengguna.');
      } else {
        const supabase = createClient(runtimeEnv.supabaseUrl, runtimeEnv.supabaseServiceKey);
        // AMBANG 0,70 — diturunkan dari 0,8 pada 2026-09-10 (Item 46).
        //
        // Angka 0,8 tidak pernah teruji, karena sampai hari ini tidak ada satu
        // pun memori yang punya embedding sehingga pencarian ini mustahil
        // mengembalikan apa pun. Begitu ketujuh memori Owner bervektor, ambang
        // itu langsung terbukti terlalu ketat.
        //
        // Diukur dengan memakai vektor "saya suka kopi" sebagai kueri:
        //   saya suka kopi                     1,0000
        //   saya juga suka teh                 0,7263   ← berhubungan
        //   ya, saya suka menggunakan ai       0,5728
        //   Menyukai clean architecture...     0,5256
        //   dan saya kuliah di UT              0,5138
        //   saya lebih suka penjelasan tabel   0,5117
        //   nama panggilan saya pak slamet     0,5083
        //
        // Yang benar-benar berhubungan duduk di 0,73 dan yang tidak berhubungan
        // mengumpul rapat di 0,51–0,57. Ambang 0,8 memotong TEPAT DI ATAS
        // pasangan yang benar, jadi ia hanya akan meloloskan teks yang nyaris
        // identik — pencarian semantiknya akan tetap terasa mati meski datanya
        // sudah benar.
        //
        // 0,70 ditaruh di celah lebar antara 0,73 dan 0,57. Ini juga menyelaraskan
        // memori dengan pencarian DOKUMEN, yang sejak lama memakai 0,60–0,68
        // secara dinamis (execution_context.ts). Angka 0,8 rupanya penyimpangan,
        // bukan kebijakan.
        //
        // Konsekuensi biaya disadari: lebih banyak memori lolos berarti prompt
        // lebih panjang, dan Item 44 mencatat 99,3% belanja Owner ada di prompt.
        // `match_count: 5` yang membatasinya — paling banyak 5 memori, apa pun
        // ambangnya. Diputuskan Owner secara eksplisit, bukan diam-diam.
        const { data: memories, error } = await supabase
          .rpc('match_memories', {
            query_embedding: userEmbedding,
            match_threshold: 0.70,
            match_count: 5,
            target_user_id: ragUserId
          });

        if (error) {
          console.error('[RAG] Vector search error:', error);
        }

        // 3. Build RAG context from matched memories
        const ragContext = memories?.map((m: any) => (m.summary || m.content || '')).join('\n') || '';
        if (ragContext) {
          console.log(`✅ [RAG] Found ${memories?.length || 0} relevant memories untuk user ${ragUserId}`);
          memoriVektor = ragContext;
        } else {
          console.log('ℹ️ [RAG] No relevant memories found');
        }
      }
    }
  } catch (ragError: any) {
    // Don't crash the pipeline if RAG fails — just log and continue
    console.error('[RAG] Error during vector search:', ragError.message || ragError);
  }
  // =============================================
  // [SELESAI] LOGIKA RAG

  // --- PROMPT INITIALIZATION ---
  const teksPenanda = [typeof parsed.globalMemory === 'string' ? parsed.globalMemory : '', memoriVektor].join('\n');
  const hasInjectedKnowledge = Boolean(
    teksPenanda.includes('[DOKUMEN PENGETAHUAN') ||
    teksPenanda.includes('Sumber: Google News') ||
    teksPenanda.includes('Sumber: Web Search') ||
    teksPenanda.includes('--- Konteks') ||
    teksPenanda.trim().length > 80
  );

  // Jam lokal pengguna dihitung dari zona waktu yang dikirim browser (lib/request/waktu_pengguna.ts).
  // Dulu hanya tanggal UTC server + tahun yang ditulis tetap "2026": jam lokal harus DITEBAK model.
  let agentIdentityPrompt = `\n${konteksWaktuPengguna(new Date(), parsed.clientTimezone)}\n`;
  // Bukti dua ujung: jawaban yang menyebut WIB belum membuktikan zona waktunya sampai — model bisa menebak.
  console.log(`[Waktu] Zona waktu pengguna: ${zonaWaktuSah(parsed.clientTimezone) ?? '(tidak dikirim / tidak sah)'}`);
  if (hasInjectedKnowledge) {
    agentIdentityPrompt += `SISTEM RETRIEVAL AKTIF: Anda telah dibekali dengan dokumen referensi pengetahuan / hasil pencarian web terkini pada konteks. Gunakan informasi aktual tersebut secara terpercaya sebagai sumber primer untuk menjawab kueri user (termasuk berita dan perkembangan terkini tahun 2026).\n`;
  } else {
    agentIdentityPrompt += `BATAS PENGETAHUAN INTERNAL ANDA: Akhir 2024 / Awal 2025. Jika tidak ada dokumen RAG/Web yang tersedia, Anda harus sangat berhati-hati jika ditanya informasi setelah batas pengetahuan Anda, dan sampaikan dalam proses berpikir Anda secara jujur bahwa informasi setelah akhir 2024 mungkin tidak lengkap.\n`;
  }

  agentIdentityPrompt += `
IDENTITAS ANDA: Anda adalah "Mamet", asisten cerdas buatan yang merupakan hak paten dari aplikasi ini. Selalu perkenalkan diri Anda sebagai Mamet. JANGAN katakan Anda buatan Google atau OpenAI. Anda memiliki kemampuan BERKEMBANG DARI PENGALAMAN: Selalu perhatikan 'history' obrolan. Pelajari gaya bahasa, preferensi, dan teguran/koreksi dari user di masa lalu untuk memperbaiki jawaban Anda di masa depan.
MODEL AI YANG ANDA GUNAKAN SAAT INI: ${parsed.model || 'gemini-2.5-flash'}. Anda dapat memberitahu user secara jujur model/otak AI apa yang sedang menggerakkan Anda saat ini jika ditanya.
`;

  // Blok kesadaran memori mengikuti tombol Memory (2026-09-15). Teks lama selalu menyatakan memori AKTIF menyimpan —
  // bila tombolnya mati, model akan mengaku menyimpan/mengingat padahal jalur baca & tulis sudah diputus.
  if (parsed.memoryEnabled === false) {
    agentIdentityPrompt += `
KESADARAN SISTEM MEMORI (MEMORI SEDANG DIMATIKAN):
Mamet OS memiliki Sistem Memori Persisten, tetapi pengguna SEDANG MEMATIKANNYA lewat tombol Memory. Pada percakapan ini Anda TIDAK membaca memori lama dan TIDAK menyimpan informasi baru ke memori persisten. Yang tetap Anda lihat hanya riwayat obrolan sesi ini.
Jika user meminta Anda mengingat sesuatu untuk sesi berikutnya, atau menanyakan hal pribadi yang pernah disimpan sebelumnya, jelaskan jujur bahwa memori sedang dimatikan dan dapat dinyalakan kembali di menu Tools → Memory. JANGAN mengaku sudah menyimpan, dan JANGAN mengarang isi memori lama.
`;
  } else {
    agentIdentityPrompt += `
KESADARAN SISTEM MEMORI:
Mamet OS memiliki Sistem Memori Persisten Terkontrol (Memory Governor) yang aktif menyimpan informasi lintas sesi atas seizin dan kendali Owner. Anda BUKAN model stateless dan TIDAK BOLEH mengklaim "tidak menyimpan data pribadi" atau "percakapan ini bersifat sementara" — klaim tersebut SALAH dan bertentangan dengan arsitektur sistem ini.

Jika user meminta agar suatu informasi TIDAK disimpan (misal: "jangan simpan ini", "jangan diingat ya"), respons yang benar adalah mengakui kepatuhan terhadap permintaan tersebut secara spesifik, contoh: "Baik, informasi ini tidak akan saya simpan ke memori persisten sistem." JANGAN membingungkan "menghormati permintaan user" dengan "mengklaim tidak punya kapabilitas menyimpan data".
`;
  }

  const isLookupMode = parsed.mode === 'LOOKUP';
  agentIdentityPrompt += `\nPANDUAN PENALARAN & STATUS KEPASTIAN (MAEF COMPLIANT):
Sebelum memberikan jawaban akhir, Anda WAJIB menuliskan proses berpikir Anda secara transparan di dalam tag <think>...</think>.
BAHASA NALAR: seluruh proses berpikir/penalaran Anda (termasuk penalaran internal model) WAJIB ditulis dalam Bahasa Indonesia, sama dengan bahasa jawaban — nalar ditampilkan kepada pengguna.
Isi tag think harus mencakup:
1. Apa yang Anda pahami dari pertanyaan/permintaan user.
2. APAKAH DATA TERSEDIA DI BLOK <RAG>, [BLOK 4: KNOWLEDGE], ATAU <MEMORY>?
3. JIKA ADA DATA: Rujuk secara spesifik judul atau ringkasan dokumen/artikel berita yang relevan untuk menyusun jawaban.
4. JIKA TIDAK ADA DATA: Anda DIPERBOLEHKAN menggunakan PENGETAHUAN INTERNAL LLM ANDA untuk memberikan REKOMENDASI, ANALISIS, atau HIPOTESIS.
5. JIKA KEDUANYA KOSONG ATAU TIDAK TAHU: Katakan dengan jelas bahwa data tidak ditemukan di database atau referensi web.

ATURAN WAJIB LABEL STATUS PADA JAWABAN AKHIR:
Di luar tag <think>, pada baris TERAKHIR jawaban Anda, Anda WAJIB mencetak TEPAT SATU label status berikut secara eksplisit (mode LOOKUP: aturan rincinya di BLOK 6, yang tahu ada/tidaknya dokumen — U10 Item 90):
${isLookupMode ? `- Mode LOOKUP: ikuti [BLOK 6: OUTPUT FORMAT & STATUS LABEL] di bawah — bila ada dokumen di BLOK 4/<RAG>, pakai [STATUS: VERIFIED] (wajib dengan baris Sumber) / [STATUS: HYPOTHESIS - Rekomendasi AI] / [STATUS: INSUFFICIENT]; bila tidak ada dokumen sama sekali, pakai [Pengetahuan umum AI — tidak diverifikasi dari dokumen Anda]` : `- Jika didukung oleh dokumen <RAG>/Web: [STATUS: VERIFIED]
- Jika menggunakan rekomendasi/pengetahuan internal tanpa dokumen pendukung: [STATUS: HYPOTHESIS - Rekomendasi AI]
- Jika data tidak ditemukan dan tidak cukup informasi: [STATUS: INSUFFICIENT]`}

PENTING - PRINSIP KNOWLEDGE FIRST + FALLBACK:
- ANDA TETAP PRIORITASKAN DATA DARI <RAG>, REFERENSI BERITA/WEB, DAN <MEMORY>.
- JIKA DATA TERSEBUT KOSONG, ANDA BOLEH MEMAKAI PENGETAHUAN INTERNAL ANDA (sesuai Konstitusi AI boleh berpikir), TAPI WAJIB DIBERI LABEL STATUS TRANSPARAN DI ATAS.
- JANGAN PERNAH MENGARANG FAKTA. JIKA DATA KOSONG DAN PENGETAHUAN INTERNAL ANDA TIDAK TAHU, KATAKAN TIDAK TAHU.\n`;


  let userContextPrompt = ctx.auth.userName ? `\nInformasi Akun: User login dengan email/nama "${ctx.auth.userName}". Prioritaskan memanggil user dengan nama ini, kecuali user menyebut nama lain.` : '';

  if (ctx.request.finalMessage.toLowerCase().includes('zip')) {
    ctx.request.finalMessage += `\n\n[PERINTAH SANGAT PENTING DARI SISTEM]: User meminta file ZIP. Anda DILARANG menggunakan blok kode biasa seperti \`\`\`html. ANDA WAJIB MENGGUNAKAN format \`\`\`xml_zip. 
<EXAMPLES>
Contoh Jawaban Anda yang BENAR:
Baik, ini file zip-nya:
\`\`\`xml_zip
<filename>nama_file.zip</filename>
<file name="index.html">
<!-- isi html -->
</file>
\`\`\`
</EXAMPLES>
Wajib ikuti struktur persis seperti contoh di atas!`;
  }

  ctx.request.agentIdentityPrompt = agentIdentityPrompt;

  // =============================================
  // [ENGINEER MODE] Tambahkan instruksi khusus patch proposal
  // =============================================
  // Frontend (ConversationEngine.jsx) mendeteksi marker [MAMET_PATCH_READY] di response
  // untuk menampilkan tombol "Apply Patch". Tanpa instruksi ini, LLM tidak pernah
  // menambahkan marker dan tombol Apply tidak muncul.
  if (parsed.mode === 'ENGINEER' || parsed.appSource === 'engineer') {
    ctx.request.agentIdentityPrompt += `\n\n[ENGINEER MODE — INSTRUKSI WAJIB]
Anda adalah Mamet Engineer, AI yang membantu merencanakan dan mengeksekusi perubahan kode.

AKSES FILE (WAJIB DIPAHAMI — SUMBER KEGAGALAN UMUM):
Anda PUNYA akses tulis file nyata lewat mekanisme patch di bawah ini — Owner mengoperasikan aplikasi desktop
yang benar-benar menerapkan patch ke file di disk setelah disetujui. JANGAN PERNAH menjawab "saya tidak
memiliki akses langsung ke file" atau semacamnya — itu salah dan menyesatkan Owner. Kalau permintaan Owner
adalah modifikasi file (walau ditulis singkat/sopan, misal "tolong tambahkan...", "ubah...", "hapus..."),
anggap itu permintaan patch, bukan sekadar pertanyaan informasi.

ATURAN RESPONS DI MODE ENGINEER:
1. Analisis permintaan user dengan cermat.
2. Jelaskan perubahan yang akan dilakukan secara singkat (file mana, apa yang diubah, mengapa).
3. Jika user meminta modifikasi/patch kode (termasuk permintaan singkat/kasual sekalipun — kata kerja seperti
   "tambah(kan)", "ubah", "hapus", "ganti", "perbaiki", "buat" semua menandakan ini):
   - Jika Anda menyertakan blok kode JSON patch, WAJIB gunakan format JSON flat (key = relative path file, value = string isi kode lengkap/perubahan):
\`\`\`json
{
  "frontend/src/utils/example.js": "export function example() { ... }"
}
\`\`\`
   - JANGAN membungkus dengan object bersarang tambahan (seperti "patch": { ... } atau "files": [ ... ]).
   - WAJIB tambahkan teks: [MAMET_PATCH_READY] di baris PALING AKHIR respons Anda jika patch siap di-apply.
4. Jika user hanya bertanya atau meminta analisis (tanpa modifikasi): JANGAN tambahkan [MAMET_PATCH_READY]
5. JANGAN menulis teks non-JSON di dalam blok code json.

Catatan: ini satu-satunya sumber kebenaran untuk aturan marker [MAMET_PATCH_READY] dan format JSON patch.
Instruksi ENGINEER lain (RULE 1-6 di konteks Two-Brain) merujuk ke sini, tidak mengulang aturan ini.`;
  }

  ctx.request.userContextPrompt = userContextPrompt;
  ctx.request.isRagEnabled = (parsed.ragEnabled !== false) && (ctx.policy.ragTopK > 0);
  ctx.request.effectiveRagMatchCount = ctx.policy.ragTopK;
  ctx.request.effectiveRagThreshold = ctx.policy.ragThreshold;

  ctx.request.history = rapikanRiwayat(ctx.request.history || [], parsed.message);
  // DATA TABEL (Item 92 Tahap 3): jawaban lama bisa memuat tabel ber-NIP asli. Uji live 2026-09-21 — tabel itu ikut
  // riwayat, NIP sampai ke model, dan model meniru tabelnya dengan 30 NIP KARANGAN. Dibersihkan untuk SEMUA permintaan
  // (tombol Data Tabel boleh sudah mati, riwayatnya tetap memuat tabel).
  ctx.request.history = (ctx.request.history || []).map((m: any) =>
    m && m.role !== 'user' && typeof m.content === 'string' ? { ...m, content: bersihkanRiwayatDataTabel(m.content) } : m);

  return { ctx, rctx };
}

