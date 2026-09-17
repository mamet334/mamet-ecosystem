/**
 * UKURAN POTONGAN (Item 70, 2026-09-11): 800 huruf, tumpang 100 — sebelumnya 4.500 / 250.
 *
 * Potongan besar mencampur banyak topik, dan vektornya menjadi rata-rata yang kabur. Terukur pada
 * ebook "Operator Handbook": potongan 4.500 huruf berisi 19 perintah adb; kalimat
 * `adb shell dumpsys battery reset` — yang tertulis PERSIS di dalamnya — hanya mendapat skor 0,510
 * terhadapnya (peringkat 5), dan untuk enam pertanyaan uji potongan itu KALAH dari potongan
 * bertopik lain. Dipotong ulang, potongan berisi jawaban naik ke peringkat #1–#2 di keenamnya:
 *   800 huruf → #1/#1/#2/#1/#2/#1;  1.000 → cadangan (ID) #3–4;  1.200 → #5.
 *
 * Item 76: potongan yang dimulai di tengah tabel Markdown diawali baris judul kolom tabel itu
 * (judul_tabel.ts), sehingga bisa melebihi 800 huruf sepanjang judulnya. Titik potong tidak berubah.
 *
 * Item 87 (2026-09-16): potongan tidak lagi berhenti di tengah daftar bernomor (daftar_bernomor.ts) —
 * butir "3. Perencanaan dan Keuangan" di Kepbup OKU dulu jatuh ke potongan lain yang tak ikut terambil,
 * sehingga jawaban menyebut 2 dari 3 pelatihan wajib. Titik potong MELAR ke depan, maksimum 2× ukuran
 * potongan. Tumpang tindih sengaja tetap 100: yang gagal adalah butir SESUDAH titik potong, dan
 * memperbesar tumpang tindih hanya menambah jumlah potongan (biaya embedding) tanpa menutup kasus ini.
 *
 * Item 89 (2026-09-17, konteks_potongan.ts): judul bagian Romawi di 60% akhir potongan menjadi titik
 * potong, atau — bila judul jatuh sampai 240 huruf SESUDAH titik potong — potongan diperpanjang sampai
 * tepat sebelum judul. Potongan berikutnya DIMULAI di judul itu tanpa tumpang tindih, jadi bagian lama
 * tidak ikut tercampur. Dokumen yang identitasnya terdeteksi ("Nama Jabatan") mendapat baris konteks di awal
 * setiap potongan.
 *
 * Dipisah dari vector_utils.ts (yang tetap mengekspor ulang) agar kode yang sama bisa diuji di Node.
 */
import { tambahJudulTabel } from './judul_tabel.ts';
import { akhirTanpaDaftarTerpenggal, KELIPATAN_BATAS_DAFTAR } from './daftar_bernomor.ts';
import { petaKonteks, tambahKonteks, akhirSebelumBagian, awalBagianSesudah, JANGKAU_MAJU_BAGIAN } from './konteks_potongan.ts';

export const UKURAN_POTONGAN = 800;
export const TUMPANG_POTONGAN = 100;

export function chunkText(text: string, maxLength: number = UKURAN_POTONGAN, tumpang: number = TUMPANG_POTONGAN): string[] {
  const chunks: string[] = [];
  const peta = petaKonteks(text);
  let i = 0;
  // Batas mundur untuk mencari akhir baris/kalimat — dulu 150 dari tumpang 250.
  const jangkauBatas = Math.round(tumpang * 0.6);
  while (i < text.length) {
    let end = i + maxLength;
    let potongDiBagian = false;
    if (end < text.length) {
      let breakPoint = text.lastIndexOf('\n', end);
      if (breakPoint <= i) breakPoint = text.lastIndexOf('. ', end);
      if (breakPoint > i) {
        end = breakPoint + 1;
      }
      // Bagian baru di akhir potongan → potong tepat sebelum judulnya (Item 89).
      const sebelumBagian = akhirSebelumBagian(text, i, end, maxLength);
      const bagianSesudah = awalBagianSesudah(text, end, Math.round(maxLength * JANGKAU_MAJU_BAGIAN));
      if (sebelumBagian < end && sebelumBagian > i) {
        end = sebelumBagian;
        potongDiBagian = true;
      } else if (bagianSesudah > i) {
        // Judul bagian sedikit sesudah titik potong → potongan diperpanjang sampai tepat sebelum judul.
        end = bagianSesudah;
        potongDiBagian = true;
      } else {
        // Daftar bernomor yang terpenggal di titik potong ini ditarik masuk (Item 87).
        end = akhirTanpaDaftarTerpenggal(text, i, end, maxLength * KELIPATAN_BATAS_DAFTAR);
      }
    }
    const isi = tambahJudulTabel(text, i, text.substring(i, end).trim());
    chunks.push(tambahKonteks(peta, text, i, isi));
    if (end >= text.length) break;
    if (potongDiBagian) { i = end; continue; }

    let nextI = end - tumpang;
    let bLine = text.lastIndexOf('\n', end);
    let bDot = text.lastIndexOf('. ', end);
    let boundary = bLine >= end - jangkauBatas ? bLine : (bDot >= end - jangkauBatas ? bDot : -1);

    if (boundary > nextI && boundary < end) {
      nextI = boundary + 1;
    }
    if (nextI <= i) nextI = end;
    i = nextI;
  }
  return chunks.filter(c => c.length > 0);
}
