// UJI 2026-10-07 — penjaga `catch` yang DIAM. Patokan yang hanya boleh TURUN.
//
// ── Kenapa penjaga ini ada ──────────────────────────────────────────────────────────────────
//
// Hampir seluruh cacat yang ditemukan 5–6 Okt satu kelas: SESUATU YANG GAGAL TANPA BERSUARA.
//
//   logCommand            ada, tak pernah dipanggil
//   brain.static.raw      diisi 33 berkas tiap boot, nol pembaca
//   IngatanTemuan         gagal baca -> diam -> model menyimpulkan "tidak ada temuan"
//   policy RLS            namanya "Service Role", sasarannya PUBLIC
//   verification_pipeline 270 baris tampak hidup, tak pernah diimpor sekali pun
//
// Diukur 7 Okt: dari 295 blok `catch` di kode sumber, **95 menelan galat tanpa jejak apa pun**.
// (38 lagi juga diam TAPI berkomentar — itu keputusan yang tercatat, dan dihitung terpisah.)
//
// ── Kenapa PATOKAN, bukan "perbaiki 95" ─────────────────────────────────────────────────────
//
// Uji yang MERAH SEJAK LAHIR akan dimatikan orang dalam seminggu, dan sesudah itu ia tak menjaga
// apa pun. Lagi pula sebagian dari 95 itu memang sengaja; memaksa semuanya bersuara akan
// menghasilkan kebisingan, dan peringatan yang selalu menyala sama tak bergunanya dengan yang
// tak pernah menyala.
//
// Jadi yang dijaga bukan masa lalu melainkan ARAH: boleh turun, tidak boleh naik.
//
// ── Kenapa TURUN juga digagalkan ────────────────────────────────────────────────────────────
//
// Patokan yang lebih tinggi daripada kenyataan adalah dokumen yang berbohong tentang kodenya —
// persis kelas cacat yang diperbaiki sepanjang 5–6 Okt. Maka bila sebuah berkas membaik,
// patokannya WAJIB ikut turun. Perbaikannya satu perintah:
//
//     node uji/uji-catch-diam.mjs --perbarui
//
// ── Batas yang diketahui, dan ditulis supaya tidak disangka lebih dari ini ──────────────────
//
// Pemindai ini hanya melihat blok `catch` yang isinya TANPA kurung kurawal bersarang. `catch`
// yang memuat `if {}` di dalamnya tidak terhitung. Jadi angkanya BUKAN jumlah seluruh kebisuan —
// ia indikator yang konsisten, dan untuk patokan yang hanya membandingkan dirinya sendiri dari
// waktu ke waktu, itu cukup.
//
// Dan satu hal yang TIDAK diklaim: 95 itu bukan "95 bug". Belum diperiksa satu per satu apakah
// tiap kebisuan merugikan. Menyebutnya daftar cacat akan melebih-lebihkan.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PATOKAN = join(AKAR, 'uji', 'patokan-catch-diam.json');
const perbarui = process.argv.includes('--perbarui');

console.log('uji-catch-diam v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

// ── Pemindaian ──────────────────────────────────────────────────────────────────────────────
const DIR = ['frontend/src', 'supabase/functions', 'frontend/electron'];

/** Blok catch dianggap BERSUARA bila ia mencatat, melempar, atau menaikkan galat ke pemanggil. */
const BERSUARA = /console\.(log|warn|error|info)|logger|catatGalat|setError|setFileError|setDirError|throw|reject|captureException/;

function pindai() {
  const berkas = [];
  const jalan = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (!/node_modules|dist|release|\.git/.test(p)) jalan(p); }
      else if (/\.(js|jsx|ts|cjs|mjs)$/.test(e.name)) berkas.push(p);
    }
  };
  for (const d of DIR) { const p = join(AKAR, d); if (existsSync(p)) jalan(p); }

  const hasil = {};
  let total = 0, bersuara = 0, sengaja = 0;
  for (const f of berkas) {
    const s = readFileSync(f, 'utf8');
    let n = 0;
    for (const m of s.matchAll(/catch\s*(?:\([^)]*\))?\s*\{([^{}]*)\}/g)) {
      total++;
      const isi = m[1];
      if (BERSUARA.test(isi)) { bersuara++; continue; }
      if (/\/\/|\/\*/.test(isi)) { sengaja++; continue; }   // diam, tapi alasannya tertulis
      n++;
    }
    if (n > 0) hasil[f.replace(AKAR + sep, '').split(sep).join('/')] = n;
  }
  return { hasil, total, bersuara, sengaja, jumlahBerkas: berkas.length };
}

const { hasil, total, bersuara, sengaja, jumlahBerkas } = pindai();
const diam = Object.values(hasil).reduce((a, b) => a + b, 0);

console.log(`\nberkas sumber ${jumlahBerkas} · blok catch ${total} · bersuara ${bersuara} · diam-berkomentar ${sengaja} · DIAM ${diam}`);

// ── Mode perbarui ───────────────────────────────────────────────────────────────────────────
if (perbarui) {
  writeFileSync(PATOKAN, JSON.stringify({
    catatan: 'Patokan catch DIAM per berkas. HANYA BOLEH TURUN. Perbarui dengan: node uji/uji-catch-diam.mjs --perbarui',
    diperbarui: new Date().toISOString().slice(0, 10),
    total: diam,
    berkas: hasil,
  }, null, 2) + '\n');
  console.log(`\nPatokan ditulis ulang: ${diam} catch diam di ${Object.keys(hasil).length} berkas.`);
  process.exit(0);
}

if (!existsSync(PATOKAN)) {
  console.log('\nPatokan belum ada. Jalankan: node uji/uji-catch-diam.mjs --perbarui');
  process.exit(1);
}

const patokan = JSON.parse(readFileSync(PATOKAN, 'utf8'));
const lama = patokan.berkas || {};

// ── 1. TIDAK BOLEH NAIK ─────────────────────────────────────────────────────────────────────
console.log('\n-- tidak boleh bertambah --');
{
  const naik = [];
  for (const [f, n] of Object.entries(hasil)) {
    const p = lama[f] ?? 0;
    if (n > p) naik.push(`${f}: ${p} -> ${n}`);
  }
  cek(naik.length === 0,
    'tak ada berkas yang menambah `catch` diam tanpa keterangan', naik);
  if (naik.length) {
    console.log('       Beri KOMENTAR di dalam catch-nya yang menjelaskan kenapa galat itu boleh ditelan,');
    console.log('       atau catat galatnya (console.warn/error). Keduanya menghapusnya dari hitungan ini.');
  }
}

// ── 2. PATOKAN TIDAK BOLEH BERBOHONG ────────────────────────────────────────────────────────
// Patokan yang lebih tinggi daripada kenyataan adalah dokumen yang berbohong tentang kodenya.
console.log('\n-- patokan tidak boleh berbohong --');
{
  const turun = [];
  for (const [f, p] of Object.entries(lama)) {
    const n = hasil[f] ?? 0;
    if (n < p) turun.push(`${f}: ${p} -> ${n}`);
  }
  cek(turun.length === 0,
    'patokan cocok dengan keadaan kode (tak ada yang sudah membaik tapi belum dicatat)', turun);
  if (turun.length) {
    console.log('       Ada yang MEMBAIK — bagus. Turunkan patokannya supaya ia tidak berbohong:');
    console.log('           node uji/uji-catch-diam.mjs --perbarui');
  }
}

// ── 3. ARAHNYA TURUN, bukan sekadar tidak naik ─────────────────────────────────────────────
console.log('\n-- arah --');
cek(diam <= (patokan.total ?? diam),
  `total tidak melampaui patokan (${diam} vs ${patokan.total})`, { sekarang: diam, patokan: patokan.total });

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
