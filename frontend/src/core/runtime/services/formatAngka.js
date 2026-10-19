/**
 * formatAngka — SATU tempat untuk format angka yang tampil di layar (Item 127, K4: "huruf dan angkanya nyaman
 * dibaca secara lama", Owner 19 Okt 2026).
 *
 * Sebelum ini angka tampil dengan `toFixed()` di 14 tempat, dan `toFixed` selalu memakai TITIK desimal gaya
 * Inggris ("$0.0123", "12.5 MB") — sementara tempat lain memakai koma Indonesia ("189,7k"), dan "k" sendiri
 * singkatan Inggris di samping "jt" Indonesia. Pembaca berbahasa Indonesia harus menerjemahkan dua konvensi
 * sekaligus. Konvensi yang dipakai di sini (PUEBI / locale `id-ID`): titik untuk ribuan, koma untuk desimal.
 *
 * TIDAK untuk nilai yang diketik pengguna: `<input type="number">` hanya menerima titik — placeholder kolom
 * semacam itu sengaja tetap memakai `toFixed` (Settings, batas biaya).
 *
 * Modul ini tanpa React supaya bisa diuji dengan node (`uji/uji-format-angka.mjs`).
 */

const pemformat = new Map();
const fmt = (desimal) => {
  if (!pemformat.has(desimal)) {
    pemformat.set(desimal, new Intl.NumberFormat('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal }));
  }
  return pemformat.get(desimal);
};

/** Angka dengan jumlah desimal tetap, gaya Indonesia: angka(1234.5, 1) → "1.234,5". */
export function angka(n, desimal = 0) {
  const x = Number(n);
  return fmt(desimal).format(Number.isFinite(x) ? x : 0);
}

/** Ukuran berkas: MB dengan satu desimal — ukuranMB(5_452_595) → "5,2". */
export function ukuranMB(bita) {
  return angka((Number(bita) || 0) / 1048576, 1);
}

/** Tanggal & jam lokal Indonesia — waktuLokal(iso) → "19/10/2026, 13.11.00". */
export function waktuLokal(nilai) {
  const d = new Date(nilai);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('id-ID');
}
