
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FOLDER_UJI = path.dirname(fileURLToPath(import.meta.url));
const AKAR_REPO = path.resolve(FOLDER_UJI, '..');
export const BATAS_MS = 120000;
const BATAS_TERTINGGI_MS = 600000;
const PENANDA_CERMIN = /UJI-CERMIN:/;
const PENANDA_BATAS = /^\/\/ BATAS-UJI-DETIK: (\d+)/m;

export function daftarBerkasUji(folder = FOLDER_UJI) {
  return readdirSync(folder)
    .filter((n) => /^uji-.+\.(mjs|cjs)$/i.test(n))
    .sort();
}

export function daftarTakDijalankan(folder = FOLDER_UJI) {
  return readdirSync(folder)
    .filter((n) => /^uji-.+\.js$/i.test(n))
    .sort()
    .map((nama) => ({ nama, alasan: 'modul konsol DevTools, bukan uji baris perintah (tidak mencetak kesimpulan)' }));
}

export function golongkan({ kodeKeluar, barisTerakhir, habisWaktu }) {
  if (habisWaktu) return 'GAGAL';
  const b = String(barisTerakhir || '').trim();
  if (/^DILEWATI/i.test(b)) return 'DILEWATI';
  if (kodeKeluar === 0 && /SEMUA LULUS/.test(b)) return 'LULUS';
  return 'GAGAL';
}

export function ujiCermin(nama, folder = FOLDER_UJI) {
  try { return PENANDA_CERMIN.test(readFileSync(path.join(folder, nama), 'utf8')); }
  catch { return false; }
}

export function batasBerkas(nama, folder = FOLDER_UJI) {
  try {
    const m = readFileSync(path.join(folder, nama), 'utf8').match(PENANDA_BATAS);
    if (m && Number(m[1]) > 0) return Math.min(Number(m[1]) * 1000, BATAS_TERTINGGI_MS);
  } catch {  }
  return BATAS_MS;
}

export function jalankanSatu(nama, { folder = FOLDER_UJI, batasMs = batasBerkas(nama, folder) } = {}) {
  return new Promise((selesai) => {
    const mulai = Date.now();
    let anak;
    try {
      anak = spawn(process.execPath, [path.join(folder, nama)], { cwd: AKAR_REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      return selesai({ nama, golongan: 'GAGAL', ms: 0, barisTerakhir: `gagal memulai: ${e.message}`, keluaran: String(e.message) });
    }
    let keluaran = '';
    let galatKeluaran = '';
    const batasi = (s) => (s.length > 200000 ? s.slice(-200000) : s);
    anak.stdout.on('data', (d) => { keluaran = batasi(keluaran + d); });
    anak.stderr.on('data', (d) => { galatKeluaran = batasi(galatKeluaran + d); });

    let habisWaktu = false;
    const jam = setTimeout(() => { habisWaktu = true; anak.kill(); }, batasMs);

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
        barisTerakhir: habisWaktu ? `habis waktu ${batasMs / 1000} detik` : (barisTerakhir || '(tanpa keluaran)'),
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
    cermin: hasil.filter((h) => h.cermin).map((h) => h.nama),
    batasKhusus: daftar.filter((n) => batasBerkas(n) !== BATAS_MS).map((nama) => ({ nama, detik: batasBerkas(nama) / 1000 })),
  };
  const teks = JSON.stringify(ringkas);
  if (keluar) writeFileSync(keluar, teks, 'utf8');
  else process.stdout.write(`HASIL_UJI ${teks}\n`);
  process.exit(ringkas.gagal.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await utama();
}
