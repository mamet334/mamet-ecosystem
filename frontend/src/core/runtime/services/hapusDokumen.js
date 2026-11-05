/**
 * HAPUS BANYAK DOKUMEN SEKALIGUS (Research App, 5 Nov 2026 — permintaan Owner).
 *
 * Satu baris daftar = satu dokumen utuh; menghapusnya membuang semua potongannya. Owner butuh memilih banyak dokumen
 * lalu menghapusnya sekali jalan (221 Kepbup pecahan dulu dihapus lewat SQL Editor karena tombol hapus satu per satu).
 *
 * Urutan sama dengan hapus satu dokumen di ResearchApp: potongan dulu, lalu dokumennya — DELETE dokumen meminta baris
 * yang terhapus dikembalikan, karena DELETE yang tak mengenai baris apa pun tetap sukses tanpa galat (daftar basi).
 * Berkelompok (`.in()` dengan ≤ 20 id) supaya alamat permintaan tidak kepanjangan dan satu perintah tidak menghapus
 * terlalu banyak potongan sekaligus (statement timeout — 5 Nov). Berhenti di galat pertama dan melaporkan yang sudah
 * terhapus: penghapusan tak bisa dibatalkan, jadi laporan harus jujur, bukan "semua gagal" atau "semua berhasil".
 *
 * Murni — `supabase` disuntikkan; diuji di Node: `uji/uji-hapus-dokumen-banyak.mjs`.
 */

export const UKURAN_KELOMPOK_HAPUS = 20;

/**
 * @param supabase   klien supabase-js
 * @param ids        id dokumen yang dipilih (ganda dibuang)
 * @param onKemajuan ({ selesai, total }) => void
 * @returns {{ dihapus: string[], tidakDitemukan: string[], gagal: null | { pesan: string, belumDiproses: string[] } }}
 */
export async function hapusDokumenBanyak(supabase, ids, { onKemajuan } = {}) {
  const unik = [...new Set((ids || []).filter(Boolean))];
  const dihapus = [];
  const tidakDitemukan = [];
  for (let i = 0; i < unik.length; i += UKURAN_KELOMPOK_HAPUS) {
    const grup = unik.slice(i, i + UKURAN_KELOMPOK_HAPUS);
    const { error: errPotongan } = await supabase.from('document_chunks').delete().in('document_id', grup);
    if (errPotongan) return { dihapus, tidakDitemukan, gagal: { pesan: errPotongan.message || String(errPotongan), belumDiproses: unik.slice(i) } };
    const { data, error: errDokumen } = await supabase.from('documents').delete().in('id', grup).select('id');
    if (errDokumen) return { dihapus, tidakDitemukan, gagal: { pesan: errDokumen.message || String(errDokumen), belumDiproses: unik.slice(i) } };
    const kena = new Set((data || []).map((d) => d.id));
    for (const id of grup) (kena.has(id) ? dihapus : tidakDitemukan).push(id);
    onKemajuan?.({ selesai: Math.min(i + UKURAN_KELOMPOK_HAPUS, unik.length), total: unik.length });
  }
  return { dihapus, tidakDitemukan, gagal: null };
}

/**
 * Penjaga "jawaban terbaru saja": dua pemuatan daftar yang berlomba (sesudah muat ulang, pilihan workspace belum pulih
 * → daftar tanpa saringan) tidak boleh saling menimpa — yang datang belakangan tapi dimulai lebih dulu dibuang.
 * 5 Nov: daftar "random test" sempat memuat dokumen semua workspace; dengan hapus banyak, itu bisa menghapus dokumen
 * workspace lain.
 */
export function buatPenjagaTerbaru() {
  let terakhir = 0;
  return {
    mulai: () => ++terakhir,
    masihTerbaru: (nomor) => nomor === terakhir,
  };
}

/** Ringkasan asal workspace untuk dialog konfirmasi: "kepbup oku (3), random test (1)". */
export function ringkasRuang(dokumen, ruang) {
  const nama = new Map((ruang || []).map((r) => [r.id, r.name]));
  const hitung = new Map();
  for (const d of dokumen || []) {
    const n = nama.get(d.space_id) || '(tanpa workspace)';
    hitung.set(n, (hitung.get(n) || 0) + 1);
  }
  return [...hitung].map(([n, c]) => `${n} (${c})`).join(', ');
}
