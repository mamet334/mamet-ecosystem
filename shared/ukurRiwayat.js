export const POLA_HASIL_ALAT = /^\s*\[HASIL ALAT (FOLDER|KONEKTOR)/;
export const POLA_CATATAN_KERJA = /📂 _Dibaca dari folder |\(dicatat dari proses utama, bukan dari kata model\)/;

const hurufIsi = (m) => (typeof m?.content === 'string' ? m.content.length : 0);

export function ukurRiwayat(riwayat) {
  const daftar = Array.isArray(riwayat) ? riwayat : [];
  let huruf = 0, hasilAlatPesan = 0, hasilAlatHuruf = 0, patok = 0, catatanKerjaPesan = 0;
  for (const m of daftar) {
    const n = hurufIsi(m);
    huruf += n;
    if (m?._patok === true) patok++;
    if (typeof m?.content === 'string' && POLA_HASIL_ALAT.test(m.content)) { hasilAlatPesan++; hasilAlatHuruf += n; }
    if (m?.role !== 'user' && typeof m?.content === 'string' && POLA_CATATAN_KERJA.test(m.content)) catatanKerjaPesan++;
  }
  return { pesan: daftar.length, huruf, hasilAlatPesan, hasilAlatHuruf, patok, catatanKerjaPesan };
}

export function pesanDipendekkan(sebelum, sesudah) {
  const a = Array.isArray(sebelum) ? sebelum : [];
  const b = Array.isArray(sesudah) ? sesudah : [];
  let n = 0;
  if (a.length === b.length || a.length - b.length === 1) {
    for (let i = 0; i < b.length; i++) if (hurufIsi(b[i]) < hurufIsi(a[i])) n++;
    return n;
  }
  const asal = new Map();
  for (const m of a) if (m && typeof m === 'object') asal.set(m, hurufIsi(m));
  for (const m of b) if (asal.has(m) && hurufIsi(m) < asal.get(m)) n++;
  return n;
}
