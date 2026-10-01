/**
 * cari_judul.ts — menggabungkan hasil pencarian lewat JUDUL dokumen ke hasil pencarian isi.
 *
 * ── Masalah, diukur sendiri 1 Oktober 2026 ──────────────────────────────────────────────────
 *
 *   221 dokumen Kepbup · 3.629 potongan · kata "kepbup" muncul di 0 potongan
 *   221 dari 221 dokumen TIDAK memuat nomornya sendiri di teks terindeks
 *
 * Judul memuat nomor dan kata "Kepbup", tetapi `document_chunks.fts` hanya dihitung dari `content`,
 * jadi judul tidak pernah ikut dicari. Akibatnya **tidak ada satu pun cara menemukan dokumen lewat
 * nomornya** — bukan "sulit", melainkan tidak mungkin.
 *
 * RRF tidak bisa menolong berapa pun bobotnya: `match_documents_hybrid` menyaring dengan
 * `similarity > match_threshold`, dan itu kemiripan VEKTOR. Untuk "Kepbup 204", potongan tabel
 * kompetensi berkemiripan rendah → dibuang SEBELUM RRF sempat bekerja.
 *
 * ── Kenapa modul terpisah ───────────────────────────────────────────────────────────────────
 *
 * `match_documents_hybrid` memegang patokan terukur recall@8 14/14 (Item 90 Tahap B). Ia TIDAK
 * disentuh. Jalur judul berdiri sendiri, dan hasilnya digabung di sini — sehingga patokan lama tetap
 * sebanding, dan jalur baru bisa dimatikan tanpa menyentuh yang lama.
 */

/** Bentuk minimum satu potongan yang dipakai modul ini. */
export interface PotonganRag {
  id: string;
  document_id: string;
  title?: string;
  content?: string;
  space_name?: string;
  [k: string]: unknown;
}

/** Berapa banyak potongan judul yang boleh disisipkan. Sengaja kecil — lihat gabungkan(). */
export const MAKS_POTONGAN_JUDUL = 3;

/**
 * Gabungkan potongan hasil pencarian judul ke hasil pencarian isi.
 *
 * Tiga aturan, masing-masing ada alasannya:
 *
 * 1. **Dokumen yang SUDAH ada di hasil isi tidak disisipkan lagi.** Kalau pencarian biasa sudah
 *    menemukan dokumen itu, jalur judul tidak menambah apa pun selain menggeser potongan lain keluar.
 *
 * 2. **Disisipkan di DEPAN.** Pertanyaan yang menyebut nomor dokumen adalah pertanyaan tentang
 *    dokumen itu; menaruhnya di belakang berarti ia terpotong lebih dulu saat konteks dipangkas.
 *
 * 3. **Dibatasi 3 potongan.** Satu dokumen Kepbup punya ±14 potongan. Memasukkan semuanya akan
 *    mengusir seluruh hasil pencarian isi dan membuat jawaban untuk pertanyaan campuran jadi lebih
 *    buruk — menukar satu kegagalan dengan kegagalan lain.
 *
 * Panjang hasil TIDAK ditambah: total tetap dipotong ke `batas` yang sama dengan sebelumnya, supaya
 * anggaran konteks dan biaya tidak berubah diam-diam.
 */
export function gabungkan(
  dariIsi: PotonganRag[],
  dariJudul: PotonganRag[],
  batas: number,
): { hasil: PotonganRag[]; disisipkan: number } {
  const isi = Array.isArray(dariIsi) ? dariIsi : [];
  const judul = Array.isArray(dariJudul) ? dariJudul : [];
  if (!judul.length) return { hasil: isi, disisipkan: 0 };

  const dokumenAda = new Set(isi.map((p) => p?.document_id).filter(Boolean));
  const idAda = new Set(isi.map((p) => p?.id).filter(Boolean));

  const sisipan: PotonganRag[] = [];
  for (const p of judul) {
    if (sisipan.length >= MAKS_POTONGAN_JUDUL) break;
    if (!p?.id || idAda.has(p.id)) continue;
    if (p.document_id && dokumenAda.has(p.document_id)) continue;
    sisipan.push(p);
    idAda.add(p.id);
  }
  if (!sisipan.length) return { hasil: isi, disisipkan: 0 };

  const batasSah = Number.isFinite(batas) && batas > 0 ? batas : isi.length + sisipan.length;
  return { hasil: [...sisipan, ...isi].slice(0, batasSah), disisipkan: sisipan.length };
}
