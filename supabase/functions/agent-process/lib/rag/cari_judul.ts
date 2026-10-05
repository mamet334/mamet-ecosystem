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
 * Lebar padding nol yang ikut dicoba untuk token angka.
 *
 * Korpus ini memakai TIGA ("001".."221", diukur 5 Okt 2026: 221 nomor unik, min 001, maks 221).
 * Dua ikut disertakan karena konvensi dua digit sama lazimnya, dan biayanya diukur bukan dikira —
 * lihat catatan ketepatan di `kataKunciJudul`.
 */
export const LEBAR_PADDING = [2, 3];

/**
 * Kata kunci khusus jalur JUDUL — menambal dua lubang yang membuat 45% korpus tak bisa dicari.
 *
 * ── Cacatnya, diukur 5 Oktober 2026 ─────────────────────────────────────────────────────────
 *
 * Rantainya putus DUA KALI untuk pertanyaan sewajarnya seperti "kepbup 17":
 *
 *   1. `kataKunciPencarian` membuang token sepanjang ≤2 huruf (`w.length > 2`). Saringan itu
 *      ditulis untuk kata sambung dalam prosa, dan tak pernah ditinjau ulang untuk PENANDA.
 *      Nomor satu-dua digit justru penanda yang paling sering dipakai orang.
 *        "kepbup 17"  → ["kepbup"]        ← "17" hilang di sini
 *   2. Seandainya lolos pun ia tetap tak cocok: judulnya menyimpan "017", dan "17" ≠ "017"
 *      sebagai leksem `to_tsquery('simple', …)`.
 *
 * Akibatnya `match_documents_judul` menerima satu kata saja, lalu penjaga `array_length >= 2`
 * memulangkan kosong. Terukur: nomor 001–221, jadi **99 dari 221 dokumen (45%) tak bisa ditemukan
 * lewat nomor alaminya**. "204" selama ini berhasil semata karena ia kebetulan sudah tiga digit.
 *
 * ── Kenapa daftar kata TERPISAH, bukan `kataKunciPencarian` yang diperbaiki ──────────────────
 *
 * `kataKunciPencarian` juga memasok `match_documents_hybrid`, yang memegang patokan terukur
 * recall@8 14/14 (Item 90 Tahap B). Menambah token di sana menggeser patokan itu dan membuatnya
 * tak lagi sebanding. Jalur judul sudah sengaja berdiri sendiri (lihat kepala berkas); perbaikan
 * ini mengikuti pemisahan yang sama.
 *
 * ── Ketepatan tidak dikorbankan ─────────────────────────────────────────────────────────────
 *
 * Varian hanya ditambahkan untuk token ANGKA, dan `match_documents_judul` tetap menuntut DUA kata
 * cocok (`cocok >= 2`). Jadi "kepbup" + satu varian angka yang benar = 2 — lulus; sedangkan angka
 * yang tak ada di judul mana pun tidak menambah kecocokan apa pun.
 *
 * Arahnya dibuat DUA arah: "17" juga mencoba "017", dan "017" juga mencoba "17". Korpus lain boleh
 * jadi menyimpan tanpa padding, dan menebak satu arah saja akan mengulang cacat yang sama dari sisi
 * sebaliknya.
 *
 * @param teks pertanyaan apa adanya
 * @param dasar hasil `kataKunciPencarian(teks)` — dipakai ulang supaya aturan stopword tetap satu sumber
 */
export function kataKunciJudul(teks: string, dasar: string[] = []): string[] {
  const keluar = new Set((dasar || []).filter((w) => typeof w === 'string' && w));
  for (const m of String(teks || '').toLowerCase().matchAll(/\d+/g)) {
    // Bentuk APA ADANYA sengaja TIDAK ditambahkan di sini — uji mutasi membuktikannya mati.
    // Ia selalu sudah tercakup: bila tanpa nol di depan ia sama dengan `telanjang`; bila
    // ber-nol dan ≥3 huruf ia sudah lolos saringan `kataKunciPencarian` ke `dasar`; bila
    // ber-nol dan pendek ("07") ia justru hasil padding di bawah. Stopword tidak memuat angka,
    // jadi tak ada jalan ketiga. Menambahkannya hanya membuat baris yang tak pernah bisa salah.
    const telanjang = m[0].replace(/^0+/, '') || '0';
    keluar.add(telanjang);
    for (const lebar of LEBAR_PADDING) {
      if (telanjang.length < lebar) keluar.add(telanjang.padStart(lebar, '0'));
    }
  }
  return [...keluar];
}

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
