// UKUR RUTE EMBEDDING — apakah google-vertex dan google-ai-studio memberi vektor yang sebanding (K1 langkah 2, 5 Nov 2026).
//
// Kenapa: sejak langkah 2 `vector_utils.ts` mengutamakan rute google-vertex (penolakan lokasi 5 Nov datang dari rute
// lain). Vektor yang SUDAH tersimpan dibuat lewat rute campuran OpenRouter. Bila dua rute memberi vektor berbeda,
// pencarian makna diam-diam memburuk — jadi diukur, bukan dianggap sama.
//
// Cara: ambil N potongan tersimpan milik akun ini (acak), vektorkan ulang ISI-nya lewat masing-masing rute saja
// (`allow_fallbacks: false`), bandingkan kemiripan kosinus dengan vektor tersimpan. Sama persis ≈ 1,0000.
// Isi potongan & kunci TIDAK dicetak; hanya angka kemiripan. Biaya: 2 × N embedding (N = 8 → ±16 potongan, < $0,001).
//
// Pemakaian — konsol DevTools `npm run desktop` (mode dev), sudah login, kunci OpenRouter di Settings:
//   await (await import(`/@fs/D:/SLAMET/other/mamet os ecosystem/uji/ukur-rute-embedding.js?t=${Date.now()}`)).ukur()

const VERSI = 're-1';
const MODEL = 'google/gemini-embedding-2';
const DIMENSI = 768;
const RUTE = ['google-vertex', 'google-ai-studio'];

const kosinus = (a, b) => {
  let ab = 0; let aa = 0; let bb = 0;
  for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return ab / Math.sqrt(aa * bb);
};

export async function ukur({ n = 8 } = {}) {
  console.log(`[ukur-rute-embedding] versi ${VERSI}`);
  const sm = window.__mamet?.serviceManager;
  if (!sm) throw new Error('window.__mamet tidak ada — jalankan dari `npm run desktop` (mode dev).');
  const { supabase } = await import('/src/supabase.js');
  let kunci = null;
  try { kunci = sm.get('VaultService')?.getKey('openrouter') || null; } catch { /* vault belum siap */ }
  if (!kunci) throw new Error('Kunci OpenRouter belum ada di Settings.');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Belum login.');
  const { data: baris, error } = await supabase.from('document_chunks')
    .select('content, embedding, documents!inner(user_id)').eq('documents.user_id', session.user.id).limit(400);
  if (error) throw new Error(`Gagal membaca potongan: ${error.message}`);
  const sampel = [...(baris || [])].sort(() => Math.random() - 0.5).slice(0, n)
    .map((b) => ({ teks: b.content, simpan: typeof b.embedding === 'string' ? JSON.parse(b.embedding) : b.embedding }))
    .filter((s) => Array.isArray(s.simpan) && s.simpan.length === DIMENSI);
  if (!sampel.length) throw new Error('Tidak ada potongan bervektor untuk diukur.');

  const hasil = {};
  for (const rute of RUTE) {
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${kunci}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input: sampel.map((s) => s.teks), dimensions: DIMENSI, provider: { order: [rute], allow_fallbacks: false } }),
    });
    if (!res.ok) {
      hasil[rute] = { galat: `${res.status}: ${(await res.text()).slice(0, 200)}` };
      continue;
    }
    const data = [...((await res.json())?.data || [])].sort((a, b) => a.index - b.index);
    hasil[rute] = { kemiripan: data.map((d, i) => +kosinus(d.embedding, sampel[i].simpan).toFixed(4)) };
  }
  kunci = null;
  for (const r of RUTE) {
    const h = hasil[r];
    console.log(`[ukur-rute-embedding] ${r}: ${h.galat ? `GALAT ${h.galat}` : `kemiripan dengan tersimpan min ${Math.min(...h.kemiripan)} · maks ${Math.max(...h.kemiripan)} · ${h.kemiripan.join(', ')}`}`);
  }
  console.log(`[ukur-rute-embedding] ${sampel.length} potongan. ≥ 0,999 = sebanding (vektor tersimpan dari rute yang sama). Jauh di bawah = rute berbeda memberi vektor berbeda.`);
  return { potongan: sampel.length, ...hasil };
}
