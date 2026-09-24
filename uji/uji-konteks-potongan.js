// UJI KONTEKS POTONGAN (Item 89 Tahap 2 / Item 90 Tahap C, 2026-09-17) — skor potongan KELUARAN KODE sebelum deploy.
//
// Pemakaian — dari konsol DevTools `npm run desktop` (mode dev), sudah login:
//   await (await import('/@fs/D:/SLAMET/other/mamet os ecosystem/frontend/node_modules/.uji-rag/uji-konteks-potongan.js')).uji()
//
// Yang dilakukan (tanpa chat, tanpa menulis ke database):
//  1. Embedding 17 pertanyaan set uji + 32 potongan berkas uji Kepbup (16 dipotong kode LAMA, 16 kode BARU —
//     teks sumber sama) lewat MemoryGovernorService._requestEmbedding (jalur & model sama dengan unggahan).
//  2. match_documents ambang -1 → skor potongan HCDP yang tersimpan (potongan UJI-Kepbup yang tersimpan
//     dibuang dari daftar — digantikan varian lama/baru).
//  3. Unduh berkas berisi skor semua potongan per pertanyaan; peringkat kata kunci & penggabungan RRF
//     dihitung terpisah (SQL + Node), sama dengan match_documents_hybrid.
// Biaya: 49 embedding (< $0,002). Kunci tidak dibaca skrip ini.

const DIR = '/@fs/D:/SLAMET/other/mamet os ecosystem/frontend/node_modules/.uji-rag';
const JUDUL_UJI = 'UJI-Kepbup-Sekretaris-DPRD-hal4-9.pdf';
const bulat = (x) => Math.round(x * 1e6) / 1e6;
const cosine = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb));
};

export async function uji() {
  console.log('[UJI-KONTEKS] versi skrip 1');
  const sm = window.__mamet?.serviceManager;
  if (!sm) throw new Error('window.__mamet tidak ada — jalankan dari `npm run desktop` (mode dev).');
  const governor = sm.get('MemoryGovernorService');
  const { supabase } = await import('/src/supabase.js');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Belum login.');
  const set = await (await fetch(`${DIR}/set-uji-pengambilan.json?t=${Date.now()}`)).json();
  const varian = await (await fetch(`${DIR}/potongan-uji-kepbup-tahapC.json?t=${Date.now()}`)).json();

  const embed = async (teks) => {
    const v = await governor._requestEmbedding(teks);
    if (!Array.isArray(v)) throw new Error('Embedding gagal — lihat log [MemoryGovernorService].');
    return v;
  };
  const vektorVarian = {};
  for (const nama of ['lama', 'baru']) {
    vektorVarian[nama] = [];
    for (const p of varian[nama]) vektorVarian[nama].push(await embed(p));
    console.log(`[UJI-KONTEKS] ${nama}: ${varian[nama].length} potongan divektorkan`);
  }

  const hasil = { waktu: new Date().toISOString(), sumber_varian: varian.sumber, pertanyaan: [] };
  for (const p of set.pertanyaan) {
    const vq = await embed(p.pertanyaan);
    const { data: peringkat, error } = await supabase.rpc('match_documents', {
      query_embedding: vq, match_threshold: -1, match_count: 5000, p_user_id: session.user.id, p_space_id: null
    });
    if (error) throw new Error(`match_documents: ${error.message}`);
    const tersimpan = peringkat.filter((r) => r.title !== JUDUL_UJI).map((r) => [r.id.slice(0, 8), bulat(r.similarity)]);
    const skorVarian = {};
    for (const nama of ['lama', 'baru']) skorVarian[nama] = vektorVarian[nama].map((v, k) => [`${nama}-${k}`, bulat(cosine(vq, v))]);
    hasil.pertanyaan.push({ id: p.id, tersimpan, lama: skorVarian.lama, baru: skorVarian.baru });
  }
  console.log(`[UJI-KONTEKS] Selesai — ${set.pertanyaan.length} pertanyaan; potongan tersimpan (tanpa ${JUDUL_UJI}): ${hasil.pertanyaan[0]?.tersimpan.length}`);
  const berkas = new Blob([JSON.stringify(hasil)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(berkas), download: `uji-konteks-potongan-${hasil.waktu.replace(/[:.]/g, '-')}.json` });
  document.body.appendChild(a); a.click(); a.remove();
  return hasil;
}
