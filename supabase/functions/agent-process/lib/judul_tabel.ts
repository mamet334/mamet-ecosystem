/**
 * JUDUL KOLOM TABEL DIULANG DI SETIAP POTONGAN (Item 76, 2026-09-14)
 *
 * Sejak Item 76 tabel DOCX disimpan sebagai baris Markdown. Tabel panjang terbelah ke beberapa
 * potongan 800 huruf, dan hanya potongan PERTAMA yang memuat baris judul kolom. Terbukti di produksi
 * 14 September 2026: pertanyaan "target rasio jabatan fungsional bersertifikat kompetensi pada tahun 3"
 * mengambil potongan berisi
 *   | 5 | Rasio Jabatan Fungsional … | % | 5,93% | 12,0% | 20,0% | 35,0% | 47,6% | 47,60% |
 * tanpa baris `| No | … | Satuan | Tahun 1 | … | Tahun 5 | Target Akhir |` — potongan judulnya tidak
 * termasuk 8 potongan yang terambil. Model menebak 5,93% sebagai nilai awal, semua kolom bergeser,
 * dan menjawab 35,0% (seharusnya 20,0%) berlabel VERIFIED.
 *
 * Kini potongan yang DIMULAI di tengah tabel diawali baris judul + garis pemisah tabel itu. Ini isi
 * asli dokumen, bukan awalan buatan. Potongan jadi lebih panjang dari 800 huruf sebanyak judulnya.
 *
 * Murni — diuji di Node (vector_utils.ts memakai parameter properties yang tak bisa dijalankan Node
 * tanpa kompilasi). Satu impor murni: pengenal judul bagian (Item 89).
 */
import { judulBagian } from './konteks_potongan.ts';

const BARIS_TABEL = /^\s*\|.*\|\s*$/;
const BARIS_PEMISAH = /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/;

/** Baris utuh yang memuat indeks `i` → [awal, akhir) tanpa "\n". */
function batasBaris(teks: string, i: number): [number, number] {
  const awal = teks.lastIndexOf('\n', i - 1) + 1;
  const n = teks.indexOf('\n', i);
  return [awal, n < 0 ? teks.length : n];
}

/**
 * Judul tabel yang perlu ditempel bila potongan dimulai di `posisi` (huruf pertama isinya), atau
 * null bila posisi itu bukan di dalam tabel Markdown, tabelnya tak punya garis pemisah, atau potongan
 * sudah memuat baris judulnya sendiri.
 */
export function judulTabelUntuk(teks: string, posisi: number): string | null {
  if (posisi < 0 || posisi >= teks.length) return null;
  const [awalBaris, akhirBaris] = batasBaris(teks, posisi);
  if (!BARIS_TABEL.test(teks.slice(awalBaris, akhirBaris))) return null;

  // Naik ke baris paling atas dari deretan baris tabel yang bersambung. Judul bagian di tengah tabel
  // ("| III. PERSYARATAN JABATAN | | |", tabel gabungan OCR — Item 89) memutus tabel: judul tabel di
  // atasnya bukan milik baris sesudahnya.
  if (judulBagian(teks.slice(awalBaris, akhirBaris))) return null;
  let atas = awalBaris;
  while (atas > 0) {
    const [awalSebelum, akhirSebelum] = batasBaris(teks, atas - 1);
    const sebelum = teks.slice(awalSebelum, akhirSebelum);
    if (!BARIS_TABEL.test(sebelum) || judulBagian(sebelum)) break;
    atas = awalSebelum;
  }

  const [, akhirJudul] = batasBaris(teks, atas);
  if (akhirJudul >= teks.length) return null;
  const [awalPemisah, akhirPemisah] = batasBaris(teks, akhirJudul + 1);
  const judul = teks.slice(atas, akhirJudul).trim();
  const pemisah = teks.slice(awalPemisah, akhirPemisah).trim();
  if (!BARIS_PEMISAH.test(pemisah)) return null;

  if (posisi <= akhirJudul) return null;           // dimulai di baris judul → sudah memuatnya
  if (posisi <= akhirPemisah) return judul;        // dimulai di garis pemisah → cukup judulnya
  return `${judul}\n${pemisah}`;
}

/** Isi potongan yang dimulai di indeks `awal` teks penuh → diawali judul tabel bila perlu. */
export function tambahJudulTabel(teks: string, awal: number, isi: string): string {
  if (!isi) return isi;
  let posisi = awal;
  while (posisi < teks.length && /\s/.test(teks[posisi])) posisi++;
  const judul = judulTabelUntuk(teks, posisi);
  return judul ? `${judul}\n${isi}` : isi;
}
