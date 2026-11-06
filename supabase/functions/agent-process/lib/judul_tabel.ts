import { judulBagian } from './konteks_potongan.ts';

const BARIS_TABEL = /^\s*\|.*\|\s*$/;
const BARIS_PEMISAH = /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/;

function batasBaris(teks: string, i: number): [number, number] {
  const awal = teks.lastIndexOf('\n', i - 1) + 1;
  const n = teks.indexOf('\n', i);
  return [awal, n < 0 ? teks.length : n];
}

export function judulTabelUntuk(teks: string, posisi: number): string | null {
  if (posisi < 0 || posisi >= teks.length) return null;
  const [awalBaris, akhirBaris] = batasBaris(teks, posisi);
  if (!BARIS_TABEL.test(teks.slice(awalBaris, akhirBaris))) return null;

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

  if (posisi <= akhirJudul) return null;
  if (posisi <= akhirPemisah) return judul;
  return `${judul}\n${pemisah}`;
}

export function tambahJudulTabel(teks: string, awal: number, isi: string): string {
  if (!isi) return isi;
  let posisi = awal;
  while (posisi < teks.length && /\s/.test(teks[posisi])) posisi++;
  const judul = judulTabelUntuk(teks, posisi);
  return judul ? `${judul}\n${isi}` : isi;
}
