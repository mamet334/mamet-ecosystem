/**
 * jalankan-semua.mjs — penjalan seluruh berkas uji, dengan keluaran yang bisa dibaca MESIN.
 * Dibuat 28 September 2026 untuk Tahap 6 (ROADMAP-ENGINEER-MANDIRI): verifikasi patch yang DIJALANKAN.
 *
 * Sebelum ini satu-satunya cara menjalankan seluruh suite adalah lingkaran shell di uji/README.md —
 * cukup untuk mata manusia, tidak cukup untuk proses utama yang harus MEMUTUSKAN apakah sebuah patch
 * dipulihkan. Karena itu berkas ini menuliskan satu objek JSON, dan hanya itu yang dibaca mesin.
 *
 *   node uji/jalankan-semua.mjs                      seluruh berkas uji
 *   node uji/jalankan-semua.mjs uji-a.mjs            hanya yang disebut (dipakai untuk menjalankan ULANG
 *                                                    berkas yang gagal, sesudah pemulihan)
 *   node uji/jalankan-semua.mjs --keluar=hasil.json  JSON ditulis ke berkas, bukan ke layar
 *
 * Kenapa --keluar ada: proses utama Electron memotong keluaran perintah pada 20 KB (alatFolderJalan
 * BATAS_JALAN.keluaranByte). JSON yang memuat keluaran uji yang gagal mudah melewatinya, dan JSON
 * terpotong tidak bisa diurai — hasilnya "verifikasi gagal" untuk patch yang sebenarnya selamat.
 *
 * Tiga golongan hasil, mengikuti kebiasaan yang sudah ada di folder ini:
 *   LULUS     baris terakhir "SEMUA LULUS" dan kode keluar 0
 *   DILEWATI  baris terakhir diawali "DILEWATI" (mis. data-lokal/ atau folder luar tak ada di mesin ini)
 *   GAGAL     selain keduanya — termasuk mati mendadak dan habis waktu
 *
 * DUA CACAT YANG KETAHUAN PADA JALAN PERTAMA (28 September 2026), keduanya memberi MERAH PALSU — yaitu
 * cacat yang paling berbahaya di sini, karena merah palsu memulihkan patch yang sebenarnya benar:
 *
 *   (a) stdout dan stderr digabung. Lima berkas dinyatakan gagal hanya karena node menulis peringatan
 *       MODULE_TYPELESS_PACKAGE_JSON ke stderr SESUDAH baris kesimpulan. Putusan kini dibaca dari
 *       stdout saja; stderr tetap disimpan untuk laporan, tidak pernah untuk memutuskan.
 *   (b) berkas ".js" ikut dijalankan. `uji-pengambilan*.js` dan `uji-konteks-potongan.js` bukan berkas
 *       uji baris perintah — ia modul yang diimpor dari konsol DevTools aplikasi yang sedang berjalan,
 *       jadi dijalankan node ia diam saja dan tampak gagal. Hanya .mjs/.cjs yang dijalankan, sama dengan
 *       lingkaran shell di README. Tetapi berkas .js TIDAK disembunyikan: ia masuk daftar `takDijalankan`
 *       beserta alasannya — pengecualian yang diam adalah cara `uji-folder-label` merah tanpa ketahuan
 *       selama empat hari.
 *
 * PENANDA UJI CERMIN (prasyarat Tahap 6). Berkas uji yang MENYALIN logika lalu menguji salinannya tetap
 * hijau walau kode aslinya berubah. Ia tidak dihapus — untuk logika di dalam komponen React ia kadang
 * satu-satunya cara — tetapi tidak boleh dihitung sebagai bukti keselamatan patch. Penandanya satu baris
 * di dalam berkas: "UJI-CERMIN:" diikuti alasannya.
 */

import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FOLDER_UJI = path.dirname(fileURLToPath(import.meta.url));
const AKAR_REPO = path.resolve(FOLDER_UJI, '..');
const BATAS_MS = 120000;          // satu berkas uji; rata-rata 619 ms, yang terlama sekitar 10 detik
const PENANDA_CERMIN = /UJI-CERMIN:/;

/** Berkas uji baris perintah di folder ini. Berkas ini sendiri tidak ikut — namanya tidak diawali "uji-". */
export function daftarBerkasUji(folder = FOLDER_UJI) {
  return readdirSync(folder)
    .filter((n) => /^uji-.+\.(mjs|cjs)$/i.test(n))
    .sort();
}

/** Berkas uji-*.js: modul untuk konsol DevTools, bukan untuk node. Dilaporkan, tidak dijalankan. */
export function daftarTakDijalankan(folder = FOLDER_UJI) {
  return readdirSync(folder)
    .filter((n) => /^uji-.+\.js$/i.test(n))
    .sort()
    .map((nama) => ({ nama, alasan: 'modul konsol DevTools, bukan uji baris perintah (tidak mencetak kesimpulan)' }));
}

/** Golongan hasil satu berkas uji. Dipisah supaya bisa diuji tanpa menjalankan node. */
export function golongkan({ kodeKeluar, barisTerakhir, habisWaktu }) {
  if (habisWaktu) return 'GAGAL';
  const b = String(barisTerakhir || '').trim();
  if (/^DILEWATI/i.test(b)) return 'DILEWATI';
  if (kodeKeluar === 0 && /SEMUA LULUS/.test(b)) return 'LULUS';
  return 'GAGAL';
}

/** Apakah berkas uji ini menguji CERMIN (salinan logika), bukan kode sungguhan. */
export function ujiCermin(nama, folder = FOLDER_UJI) {
  try { return PENANDA_CERMIN.test(readFileSync(path.join(folder, nama), 'utf8')); }
  catch { return false; }
}

function jalankanSatu(nama) {
  return new Promise((selesai) => {
    const mulai = Date.now();
    let anak;
    try {
      anak = spawn(process.execPath, [path.join(FOLDER_UJI, nama)], { cwd: AKAR_REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      return selesai({ nama, golongan: 'GAGAL', ms: 0, barisTerakhir: `gagal memulai: ${e.message}`, keluaran: String(e.message) });
    }
    // Dipisah dengan sengaja: putusan HANYA dari stdout (lihat cacat (a) di kepala berkas),
    // stderr ikut dilaporkan supaya sebabnya terlihat bila ada yang gagal sungguhan.
    let keluaran = '';
    let galatKeluaran = '';
    const batasi = (s) => (s.length > 200000 ? s.slice(-200000) : s);
    anak.stdout.on('data', (d) => { keluaran = batasi(keluaran + d); });
    anak.stderr.on('data', (d) => { galatKeluaran = batasi(galatKeluaran + d); });

    let habisWaktu = false;
    const jam = setTimeout(() => { habisWaktu = true; anak.kill(); }, BATAS_MS);

    anak.on('error', (e) => {
      clearTimeout(jam);
      selesai({ nama, golongan: 'GAGAL', ms: Date.now() - mulai, barisTerakhir: `tidak bisa dijalankan: ${e.message}`, keluaran: String(e.message) });
    });
    anak.on('close', (kodeKeluar) => {
      clearTimeout(jam);
      const baris = keluaran.split('\n').map((s) => s.trimEnd()).filter(Boolean);
      const barisTerakhir = baris[baris.length - 1] || '';
      selesai({
        nama,
        golongan: golongkan({ kodeKeluar, barisTerakhir, habisWaktu }),
        ms: Date.now() - mulai,
        barisTerakhir: habisWaktu ? `habis waktu ${BATAS_MS / 1000} detik` : (barisTerakhir || '(tanpa keluaran)'),
        // Keluaran disimpan untuk yang gagal — inilah yang dilaporkan APA ADANYA, bukan
        // diringkas jadi "2 masalah kritis" (constitution/28 PRINSIP DASAR a).
        keluaran: `${keluaran.slice(-3000)}${galatKeluaran ? `\n[stderr]\n${galatKeluaran.slice(-1000)}` : ''}`,
      });
    });
  });
}

async function utama() {
  const argumen = process.argv.slice(2);
  const keluar = (argumen.find((a) => a.startsWith('--keluar=')) || '').slice('--keluar='.length);
  const diminta = argumen.filter((a) => /^uji-.+\.(mjs|cjs)$/i.test(a));
  const semua = daftarBerkasUji();
  const daftar = diminta.length ? diminta.filter((n) => semua.includes(n)) : semua;

  const mulai = Date.now();
  const hasil = [];
  for (const nama of daftar) {
    const h = await jalankanSatu(nama);
    h.cermin = ujiCermin(nama);
    hasil.push(h);
    process.stderr.write(`${h.golongan.padEnd(8)} ${nama.padEnd(42)} ${h.ms} ms\n`);
  }

  const ambil = (g) => hasil.filter((h) => h.golongan === g);
  const ringkas = {
    versi: 'jalankan-semua v1',
    detik: Math.round((Date.now() - mulai) / 100) / 10,
    total: hasil.length,
    lulus: ambil('LULUS').length,
    dilewati: ambil('DILEWATI').map((h) => ({ nama: h.nama, alasan: h.barisTerakhir })),
    gagal: ambil('GAGAL').map((h) => ({ nama: h.nama, barisTerakhir: h.barisTerakhir, keluaran: h.keluaran })),
    takDijalankan: daftarTakDijalankan(),
    // Berapa dari berkas uji ini hanya menguji cermin — angka ini masuk laporan supaya "semua hijau"
    // tidak pernah berarti lebih daripada yang sungguh dibuktikan.
    cermin: hasil.filter((h) => h.cermin).map((h) => h.nama),
  };
  const teks = JSON.stringify(ringkas);
  if (keluar) writeFileSync(keluar, teks, 'utf8');
  else process.stdout.write(`HASIL_UJI ${teks}\n`);
  process.exit(ringkas.gagal.length ? 1 : 0);
}

// Diimpor berkas uji (untuk menguji golongkan/daftarBerkasUji) → jangan jalankan apa pun.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await utama();
}
