/**
 * Unduh huruf teks yang disimpan sendiri (tidak lagi dari fonts.googleapis.com).
 *
 * Alasannya sama dengan font ikon (lihat scripts/perbarui-ikon.mjs): 12 September 2026
 * fonts.googleapis.com timeout dari jaringan Owner, dan stylesheet yang timeout MENAHAN
 * tampilnya halaman sampai browser menyerah. Huruf teks memang jatuh ke huruf sistem bila gagal —
 * masih terbaca — tapi penantiannya yang merugikan.
 *
 * Sumbernya jsDelivr/Fontsource, bukan Google, karena fonts.googleapis.com sedang tidak terjangkau
 * dari jaringan ini. Versinya DIPATOK supaya hasil unduhan selalu sama.
 *
 * Jalankan bila ingin memperbarui versinya:  npm run huruf
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TUJUAN = path.join(AKAR, 'src/assets/fonts');

// Hanya potongan latin yang diunduh: aplikasi ini berbahasa Indonesia dan Inggris.
// Huruf di luar rentang itu akan memakai huruf sistem — itu sebabnya unicode-range perlu ditulis
// di @font-face (lihat index.css), supaya browser tidak memaksakan berkas ini untuk aksara lain.
//
// Geist (kelas font-display-lg / font-headline-md, 12 tempat) dan JetBrains Mono
// (font-label-mono, 6 tempat) BELUM diunduh — keduanya kini jatuh ke huruf sistem.
// Untuk menambahkannya, buka komentar di bawah lalu tambahkan @font-face di index.css.
const HURUF = [
  {
    nama: 'Inter',
    berkas: 'inter-latin-wght-normal.woff2',
    alamat: 'https://cdn.jsdelivr.net/npm/@fontsource-variable/inter@5.2.5/files/inter-latin-wght-normal.woff2',
  },
  // { nama: 'Geist', berkas: 'geist-latin-wght-normal.woff2',
  //   alamat: 'https://cdn.jsdelivr.net/npm/@fontsource-variable/geist@5.2.5/files/geist-latin-wght-normal.woff2' },
  // { nama: 'JetBrains Mono', berkas: 'jetbrains-mono-latin-wght-normal.woff2',
  //   alamat: 'https://cdn.jsdelivr.net/npm/@fontsource-variable/jetbrains-mono@5.2.5/files/jetbrains-mono-latin-wght-normal.woff2' },
];

fs.mkdirSync(TUJUAN, { recursive: true });
for (const h of HURUF) {
  const r = await fetch(h.alamat);
  if (!r.ok) throw new Error(`Gagal mengunduh ${h.nama}: HTTP ${r.status} — ${h.alamat}`);
  const isi = Buffer.from(await r.arrayBuffer());
  if (isi.length < 5000) throw new Error(`Berkas ${h.nama} mencurigakan: hanya ${isi.length} byte`);
  const tujuan = path.join(TUJUAN, h.berkas);
  const lama = fs.existsSync(tujuan) ? fs.statSync(tujuan).size : 0;
  fs.writeFileSync(tujuan, isi);
  console.log(`${h.nama}: ${h.berkas} — ${(isi.length / 1024).toFixed(1)} KB${lama ? ` (sebelumnya ${(lama / 1024).toFixed(1)} KB)` : ''}`);
}
console.log('Selesai. Pastikan @font-face di src/index.css menunjuk berkas yang sama.');
