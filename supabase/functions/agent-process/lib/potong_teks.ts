import { tambahJudulTabel } from './judul_tabel.ts';
import { akhirTanpaDaftarTerpenggal, KELIPATAN_BATAS_DAFTAR } from './daftar_bernomor.ts';
import { petaKonteks, tambahKonteks, akhirSebelumBagian, awalBagianSesudah, JANGKAU_MAJU_BAGIAN } from './konteks_potongan.ts';

export const UKURAN_POTONGAN = 800;
export const TUMPANG_POTONGAN = 100;

export function chunkText(text: string, maxLength: number = UKURAN_POTONGAN, tumpang: number = TUMPANG_POTONGAN): string[] {
  const chunks: string[] = [];
  const peta = petaKonteks(text);
  let i = 0;
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
      const sebelumBagian = akhirSebelumBagian(text, i, end, maxLength);
      const bagianSesudah = awalBagianSesudah(text, end, Math.round(maxLength * JANGKAU_MAJU_BAGIAN));
      if (sebelumBagian < end && sebelumBagian > i) {
        end = sebelumBagian;
        potongDiBagian = true;
      } else if (bagianSesudah > i) {
        end = bagianSesudah;
        potongDiBagian = true;
      } else {
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
