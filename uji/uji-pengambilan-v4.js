// UJI PENGAMBILAN POTONGAN v4 (Item 88 set buku penuh, 2026-09-21) — opsi { set: 'set-uji-buku-penuh.json' } memilih berkas set.
// v3 (Item 90 Tahap B, 2026-09-17) — opsi { rpc: 'hybrid' } memanggil match_documents_hybrid
// (kata kunci dari kataKunciPencarian di KnowledgeService.js = aturan server). Default tetap match_documents.
// Asal: Tahap A — alat ukur pencarian dokumen, bukan mutu jawaban.
//
// Pemakaian — dari konsol DevTools `npm run desktop` (mode dev), sudah login:
//   await (await import('/@fs/D:/SLAMET/other/mamet os ecosystem/frontend/node_modules/.uji-rag/uji-pengambilan-v4.js')).uji({ rpc: 'hybrid', set: 'set-uji-buku-penuh.json' })
// Opsi: .uji({ ulang: 2 })   → putaran kedua membandingkan peringkat & skor (bukti hasil bisa diulang)
//       .uji({ hanya: ['KEP-01'] })
//
// Yang dilakukan (tanpa chat, tanpa menulis ke database):
//  1. Embedding tiap pertanyaan lewat MemoryGovernorService._requestEmbedding → agent-process {action:'embed'}
//     (model, dimensi, kunci OpenRouter pengguna SAMA dengan pencarian dokumen server). Kunci tak dibaca skrip.
//  2. match_documents dengan ambang -1 → peringkat SEMUA potongan milik pengguna.
//  3. Peringkat potongan bukti (teks, bukan ID), skor, skor ke-8, recall@8 (peringkat ≤ 8 & skor > 0,55).
//     NEG: skor ke-1 dan jumlah potongan > 0,55 yang akan masuk konteks.
//  4. Kontrol: cosine lokal (vektor pertanyaan × embedding tersimpan potongan ke-1) harus = skor RPC.
// Biaya: 16 embedding pendek per putaran (< $0,001). Hasil: tabel konsol + berkas `uji-pengambilan-<waktu>.json`.

const DIR = '/@fs/D:/SLAMET/other/mamet os ecosystem/frontend/node_modules/.uji-rag';
const AMBIL_SERVER = 8;
const AMBANG_SERVER = 0.55;

const rapat = (s) => String(s || '').replace(/\s+/g, ' ').toLowerCase();
const bulat = (x) => (typeof x === 'number' ? Math.round(x * 10000) / 10000 : x);
const cosine = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb));
};

/** Peringkat (1-based) potongan pertama yang memuat SEMUA teks salah satu alternatif bukti. */
function cariBukti(peringkat, bukti) {
  for (let i = 0; i < peringkat.length; i++) {
    const isi = rapat(peringkat[i].content);
    const alt = bukti.find((b) => b.semua.every((t) => isi.includes(rapat(t))));
    if (alt) return { ke: i + 1, skor: peringkat[i].similarity, alternatif: alt.nama, dokumen: peringkat[i].title };
  }
  return null;
}

async function satuPutaran({ set, governor, supabase, userId, hanya, rpc, kataKunci }) {
  const baris = [];
  let kontrol = null;
  for (const p of set.pertanyaan) {
    if (hanya && !hanya.includes(p.id)) continue;
    const vq = await governor._requestEmbedding(p.pertanyaan);
    if (!Array.isArray(vq)) throw new Error(`Embedding gagal (${p.id}) — lihat log [MemoryGovernorService].`);
    const { data: peringkat, error } = rpc === 'hybrid'
      ? await supabase.rpc('match_documents_hybrid', {
          query_embedding: vq, query_words: kataKunci(p.pertanyaan), match_threshold: -1, match_count: 5000, p_user_id: userId, p_space_id: null
        })
      : await supabase.rpc('match_documents', {
          query_embedding: vq, match_threshold: -1, match_count: 5000, p_user_id: userId, p_space_id: null
        });
    if (error) throw new Error(`match_documents (${p.id}): ${error.message}`);

    if (!kontrol && peringkat.length) {
      const { data: e } = await supabase.from('document_chunks').select('embedding').eq('id', peringkat[0].id).single();
      const v = typeof e?.embedding === 'string' ? JSON.parse(e.embedding) : e?.embedding;
      if (Array.isArray(v)) kontrol = { id: p.id, skor_rpc: peringkat[0].similarity, skor_lokal: cosine(vq, v) };
    }

    const ke8 = peringkat[AMBIL_SERVER - 1]?.similarity;
    const diAtasAmbang = peringkat.filter((r) => r.similarity > AMBANG_SERVER).length;
    const b = p.bukti.length ? cariBukti(peringkat, p.bukti) : null;
    baris.push({
      id: p.id,
      jenis: p.jenis,
      bukti_ke: p.bukti.length ? (b?.ke ?? 'TIDAK ADA') : '—',
      skor_bukti: bulat(b?.skor),
      alternatif: b?.alternatif,
      recall_8: p.bukti.length ? !!(b && b.ke <= AMBIL_SERVER && b.skor > AMBANG_SERVER) : '—',
      skor_1: bulat(peringkat[0]?.similarity),
      skor_8: bulat(ke8),
      masuk_konteks: Math.min(AMBIL_SERVER, diAtasAmbang),
      teratas: peringkat.slice(0, AMBIL_SERVER).map((r, i) => ({ ke: i + 1, skor: bulat(r.similarity), dokumen: r.title, awal: r.content.replace(/\s+/g, ' ').slice(0, 90) })),
      _peringkat_penuh: peringkat.map((r) => [r.id, bulat(r.similarity)]),   // untuk penggabungan Tahap B (RRF)
      _jumlah_potongan: peringkat.length,
      _dokumen: [...new Set(peringkat.map((r) => r.title))]
    });
  }
  return { baris, kontrol };
}

export async function uji({ ulang = 1, hanya = null, rpc = 'vektor', set: namaSet = 'set-uji-pengambilan.json' } = {}) {
  const sm = window.__mamet?.serviceManager;
  if (!sm) throw new Error('window.__mamet tidak ada — jalankan dari `npm run desktop` (mode dev).');
  const governor = sm.get('MemoryGovernorService');
  if (typeof governor?._requestEmbedding !== 'function') throw new Error('MemoryGovernorService._requestEmbedding tidak tersedia.');
  const { supabase } = await import('/src/supabase.js');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Belum login.');
  const set = await (await fetch(`${DIR}/${namaSet}?t=${Date.now()}`)).json();

  console.log(`[UJI-AMBIL] versi skrip 4 — set: ${namaSet} — RPC: ${rpc === 'hybrid' ? 'match_documents_hybrid' : 'match_documents'}`);
  const { kataKunciPencarian } = await import('/src/core/runtime/services/KnowledgeService.js');
  const putaran = [];
  for (let u = 0; u < ulang; u++) {
    const hasil = await satuPutaran({ set, governor, supabase, userId: session.user.id, hanya, rpc, kataKunci: kataKunciPencarian });
    putaran.push(hasil);
    const pos = hasil.baris.filter((b) => b.recall_8 !== '—');
    const kena = pos.filter((b) => b.recall_8 === true).length;
    console.log(`[UJI-AMBIL] Putaran ${u + 1}: recall@8 = ${kena}/${pos.length}; korpus ${hasil.baris[0]?._jumlah_potongan} potongan, dokumen: ${hasil.baris[0]?._dokumen.join(', ')}`);
    console.log(`[UJI-AMBIL] Kontrol skor: RPC ${bulat(hasil.kontrol?.skor_rpc)} vs lokal ${bulat(hasil.kontrol?.skor_lokal)} (${hasil.kontrol?.id})`);
    console.table(hasil.baris.map(({ teratas, _peringkat_penuh, _jumlah_potongan, _dokumen, ...r }) => r));
  }

  let sama = null;
  if (putaran.length > 1) {
    const kunci = (h) => h.baris.map((b) => `${b.id}:${b.bukti_ke}:${b.skor_1}:${b.skor_8}`).join('|');
    sama = putaran.every((h) => kunci(h) === kunci(putaran[0]));
    console.log(`[UJI-AMBIL] Hasil antar putaran ${sama ? 'IDENTIK' : 'BERBEDA — periksa berkas'}`);
  }

  const keluaran = { waktu: new Date().toISOString(), rpc, versi_set: set.versi, ambang: AMBANG_SERVER, ambil: AMBIL_SERVER, identik_antar_putaran: sama, putaran };
  const berkas = new Blob([JSON.stringify(keluaran, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(berkas), download: `uji-pengambilan-${rpc}-${keluaran.waktu.replace(/[:.]/g, '-')}.json` });
  document.body.appendChild(a); a.click(); a.remove();
  return keluaran;
}
