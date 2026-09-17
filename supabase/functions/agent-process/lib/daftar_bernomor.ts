/**
 * POTONGAN TIDAK BOLEH BERHENTI DI TENGAH DAFTAR BERNOMOR (Item 87, 2026-09-16)
 *
 * Terbukti di produksi 16 September 2026, dokumen Kepbup Standar Kompetensi Jabatan (OKU).
 * Tabel kualifikasi memuat daftar pelatihan teknis:
 *   | | | 2. Teknis | | 1. Tata Naska Dinas | | ✓ |
 *   | | | | | 2. Sertifikasi Barang Dan Jasa | | ✓ |
 *   | | | | | 3. Perencanaan dan Keuangan | | ✓ |
 * Titik potong 800 huruf jatuh tepat sesudah butir 2. Butir 3 masuk potongan berikutnya bersama
 * Pengalaman Kerja/Pangkat/Indikator Kinerja, dan potongan itu TIDAK ikut terambil (8 potongan,
 * 12.979 huruf konteks — tanpa "Perencanaan dan"). Jawaban menyebut 2 dari 3 pelatihan, berlabel
 * [STATUS: VERIFIED]: benar menurut potongan yang dilihat, tetapi kurang satu syarat. Untuk dokumen
 * peraturan, kekurangan seperti ini menyesatkan keputusan.
 *
 * Aturannya: bila baris terakhir sebuah potongan memuat butir bernomor "N.", potongan diperpanjang
 * selama baris-baris berikutnya meneruskan urutan itu (N+1, N+2, …), sampai batas keras. Butir yang
 * dilewati satu baris kosong / baris non-daftar di antaranya tetap diterima hanya bila nomornya
 * berurutan — jadi "1. 2. 3." di tabel yang sama ikut, sedangkan daftar baru (mulai dari 1.) tidak.
 *
 * Murni, tanpa impor, agar bisa diuji langsung di Node (sama seperti judul_tabel.ts).
 */

/** Batas keras: potongan tidak boleh melar lebih dari ini kali ukuran potongan. */
export const KELIPATAN_BATAS_DAFTAR = 2;

/** Nomor butir TERAKHIR pada satu baris, mis. "| | 2. Sertifikasi … |" → 2; null bila tak ada. */
export function nomorButirTerakhir(baris: string): number | null {
  const cocok = [...baris.matchAll(/(?:^|\||\s)(\d{1,2})\.\s+\S/g)];
  if (!cocok.length) return null;
  return Number(cocok[cocok.length - 1][1]);
}

/** Baris utuh yang memuat indeks `i` → [awal, akhir) tanpa "\n". */
function batasBaris(teks: string, i: number): [number, number] {
  const awal = teks.lastIndexOf('\n', Math.max(0, i - 1)) + 1;
  const n = teks.indexOf('\n', i);
  return [awal, n < 0 ? teks.length : n];
}

/**
 * Akhir potongan yang sudah diperpanjang agar daftar bernomor tidak terpenggal.
 *
 * @param teks  teks penuh dokumen
 * @param awal  indeks awal potongan
 * @param akhir indeks akhir potongan menurut perhitungan biasa
 * @param batas panjang maksimum potongan sesudah diperpanjang (huruf)
 * @returns indeks akhir baru (>= akhir); sama dengan `akhir` bila tak ada daftar yang terpenggal
 */
export function akhirTanpaDaftarTerpenggal(teks: string, awal: number, akhir: number, batas: number): number {
  if (akhir >= teks.length || akhir <= awal) return akhir;

  // Baris terakhir yang benar-benar termuat di potongan ini.
  const [awalBarisAkhir] = batasBaris(teks, Math.max(awal, akhir - 1));
  if (awalBarisAkhir < awal) return akhir;
  let nomor = nomorButirTerakhir(teks.slice(awalBarisAkhir, akhir));
  if (nomor === null) return akhir;

  let posisi = akhir;
  let hasil = akhir;
  while (posisi < teks.length && hasil - awal < batas) {
    const [awalBaris, akhirBaris] = batasBaris(teks, posisi);
    if (awalBaris >= teks.length) break;
    const baris = teks.slice(awalBaris, akhirBaris);
    const berikut = nomorButirTerakhir(baris);

    if (berikut === nomor + 1) {
      const akhirBaru = Math.min(akhirBaris + 1, teks.length);
      if (akhirBaru - awal > batas) break;   // melewati batas keras → berhenti tanpa memakainya
      hasil = akhirBaru;
      nomor = berikut;
      posisi = akhirBaru;
      continue;
    }

    // Baris kosong di tengah daftar tidak memutus urutan; baris lain memutus.
    if (baris.trim() === '' && akhirBaris + 1 < teks.length) {
      posisi = akhirBaris + 1;
      continue;
    }
    break;
  }
  return hasil;
}
