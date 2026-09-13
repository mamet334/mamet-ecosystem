/**
 * Perbarui berkas font ikon (Material Symbols) yang disimpan sendiri.
 *
 * Ikon di aplikasi ini ditulis sebagai LIGATUR: <span class="material-symbols-outlined">home</span>.
 * Kata "home" itu teks biasa; fontnyalah yang mengubahnya menjadi gambar. Kalau fontnya tidak
 * termuat, yang tampil adalah kata "home" — persis yang terjadi 12 September 2026 ketika
 * fonts.googleapis.com timeout dan seluruh sidebar berubah menjadi daftar kata.
 *
 * Font penuh Material Symbols Outlined berukuran 970 KB untuk ~3.600 ikon. Aplikasi ini hanya
 * memakai puluhan, jadi yang disimpan adalah SUBSET: Google menyediakan parameter icon_names yang
 * mengembalikan font berisi ikon yang diminta saja (belasan KB).
 *
 * Jalankan setiap kali ada ikon baru dipakai:  npm run ikon
 * Perlu internet — hanya saat menjalankan skrip ini, tidak saat membangun atau menjalankan aplikasi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUMBER = path.join(AKAR, 'src');
const TUJUAN_FONT = path.join(AKAR, 'src/assets/fonts/material-symbols-subset.woff2');
const TUJUAN_DAFTAR = path.join(AKAR, 'src/assets/fonts/daftar-ikon.txt');

// User-Agent Chrome diperlukan: tanpa itu Google mengirim TrueType (jauh lebih besar), bukan woff2.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Nama yang tertangkap pemindai tapi bukan ikon — berasal dari perbandingan status
// (mis. saveStatus === 'success'). Google mengabaikan nama tak dikenal, ini hanya agar daftarnya bersih.
const BUKAN_IKON = new Set(['open', 'running', 'scanning', 'success', 'testing', 'idle', 'error_state', 'icon', 'ikon', 'loading', 'processing', 'skipped', 'pending']);

// Ikon yang namanya dirakit saat berjalan sehingga tak bisa dipindai. Tambahkan manual di sini.
const TAMBAHAN_MANUAL = ['home', 'menu_book', 'database', 'apps'];  // Sidebar.jsx getIcon()

function berkasSumber(dir, hasil = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') berkasSumber(p, hasil); continue; }
    if (/\.(jsx?|tsx?)$/.test(e.name)) hasil.push(p);
  }
  return hasil;
}

function kumpulkanNama() {
  const nama = new Map();   // nama ikon → berkas pertama yang memakainya
  const catat = (n, berkas) => { if (!nama.has(n)) nama.set(n, berkas); };
  const sahih = (n) => /^[a-z][a-z0-9_]{1,39}$/.test(n) && !BUKAN_IKON.has(n);

  for (const berkas of berkasSumber(SUMBER)) {
    const isi = fs.readFileSync(berkas, 'utf8');
    const rel = path.relative(AKAR, berkas).split(path.sep).join('/');

    // 1. Ligatur literal: <span className="material-symbols-outlined …">nama</span>
    for (const m of isi.matchAll(/material-symbols-outlined[^>]*>\s*\{?\s*([a-z0-9_]+)\s*\}?\s*<\//g)) {
      if (sahih(m[1])) catat(m[1], rel);
    }

    // 2. Nama di dalam ternary pada baris yang memuat elemen ikon (mis. enabled ? 'toggle_on' : 'toggle_off')
    //    Jendela 2 baris ke atas dan ke bawah, karena ternary sering dipecah beberapa baris.
    const baris = isi.split('\n');
    baris.forEach((b, i) => {
      if (!b.includes('material-symbols-outlined')) return;
      for (let j = Math.max(0, i - 2); j <= Math.min(baris.length - 1, i + 2); j++) {
        for (const m of baris[j].matchAll(/'([a-z][a-z0-9_]{1,39})'/g)) if (sahih(m[1])) catat(m[1], rel);
      }
    });

    // 3. Peta status: { ikon: 'schedule', … }. Nama gaya Lucide di metadata ("Home", "Zap")
    //    tidak ikut karena polanya hanya menerima huruf kecil.
    for (const m of isi.matchAll(/\b(icon|ikon)\s*:\s*'([a-z][a-z0-9_]{1,39})'/g)) {
      if (sahih(m[2])) catat(m[2], rel);
    }

    // 4. Nama yang dioper sebagai prop: <Sesuatu icon="check" /> — di dalam komponennya
    //    ligaturnya ditulis {icon} sehingga tidak terbaca pola 1.
    for (const m of isi.matchAll(/\b(icon|ikon)=["']([a-z][a-z0-9_]{1,39})["']/g)) {
      if (sahih(m[2])) catat(m[2], rel);
    }
  }
  for (const n of TAMBAHAN_MANUAL) catat(n, '(tambahan manual)');
  return nama;
}

async function unduhSubset(daftar) {
  const alamat = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&icon_names=${daftar.join(',')}&display=block`;
  const css = await fetch(alamat, { headers: { 'user-agent': UA } });
  if (!css.ok) throw new Error(`Google Fonts menolak permintaan CSS: HTTP ${css.status}`);
  const teks = await css.text();
  const m = teks.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)\s*format\('([a-z2]+)'\)/);
  if (!m) throw new Error('Tidak menemukan URL font di CSS balasan Google.');
  if (m[2] !== 'woff2') throw new Error(`Google mengirim format ${m[2]}, bukan woff2.`);
  const font = await fetch(m[1], { headers: { 'user-agent': UA } });
  if (!font.ok) throw new Error(`Gagal mengunduh berkas font: HTTP ${font.status}`);
  return Buffer.from(await font.arrayBuffer());
}

const nama = kumpulkanNama();
const daftar = [...nama.keys()].sort();
const sebelumnya = fs.existsSync(TUJUAN_DAFTAR)
  ? fs.readFileSync(TUJUAN_DAFTAR, 'utf8').split('\n').map((b) => b.trim()).filter((b) => b && !b.startsWith('#'))
  : [];
const baru = daftar.filter((n) => !sebelumnya.includes(n));
const hilang = sebelumnya.filter((n) => !daftar.includes(n));

console.log(`Ikon terpakai: ${daftar.length}`);
if (sebelumnya.length) console.log(`  baru: ${baru.length ? baru.join(', ') : '—'}\n  tidak dipakai lagi: ${hilang.length ? hilang.join(', ') : '—'}`);

const font = await unduhSubset(daftar);
const lamaUkuran = fs.existsSync(TUJUAN_FONT) ? fs.statSync(TUJUAN_FONT).size : 0;
fs.mkdirSync(path.dirname(TUJUAN_FONT), { recursive: true });
fs.writeFileSync(TUJUAN_FONT, font);
fs.writeFileSync(TUJUAN_DAFTAR, `# Dihasilkan oleh scripts/perbarui-ikon.mjs — jangan diubah tangan.\n# Sumber nama: pemindaian src/ + TAMBAHAN_MANUAL di skrip itu.\n${daftar.join('\n')}\n`);

console.log(`Font ditulis: ${path.relative(AKAR, TUJUAN_FONT)} — ${(font.length / 1024).toFixed(1)} KB${lamaUkuran ? ` (sebelumnya ${(lamaUkuran / 1024).toFixed(1)} KB)` : ''}`);
console.log(`Daftar ditulis: ${path.relative(AKAR, TUJUAN_DAFTAR)}`);
