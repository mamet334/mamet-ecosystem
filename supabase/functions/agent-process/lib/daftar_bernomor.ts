
export const KELIPATAN_BATAS_DAFTAR = 2;

export function nomorButirTerakhir(baris: string): number | null {
  const cocok = [...baris.matchAll(/(?:^|\||\s)(\d{1,2})\.\s+\S/g)];
  if (!cocok.length) return null;
  return Number(cocok[cocok.length - 1][1]);
}

function batasBaris(teks: string, i: number): [number, number] {
  const awal = teks.lastIndexOf('\n', Math.max(0, i - 1)) + 1;
  const n = teks.indexOf('\n', i);
  return [awal, n < 0 ? teks.length : n];
}

export function akhirTanpaDaftarTerpenggal(teks: string, awal: number, akhir: number, batas: number): number {
  if (akhir >= teks.length || akhir <= awal) return akhir;

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
      if (akhirBaru - awal > batas) break;
      hasil = akhirBaru;
      nomor = berikut;
      posisi = akhirBaru;
      continue;
    }

    if (baris.trim() === '' && akhirBaris + 1 < teks.length) {
      posisi = akhirBaris + 1;
      continue;
    }
    break;
  }
  return hasil;
}
