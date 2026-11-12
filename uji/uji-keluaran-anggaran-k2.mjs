import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(import.meta.url);
const baca = (p) => readFileSync(path.join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');

console.log('uji-keluaran-anggaran-k2 v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

const J = require(path.join(AKAR, 'frontend/electron/alatFolderJalan.cjs'));

console.log('\n-- batas keluaran dari anggaran, dipagari --');
cek(J.batasKeluaranAman(undefined) === 20 * 1024 && J.batasKeluaranAman('x') === 20 * 1024, 'tanpa anggaran (klien lama) → 20 KB seperti dulu');
cek(J.batasKeluaranAman(300000) === 300000, 'anggaran dipakai apa adanya');
cek(J.batasKeluaranAman(10) === 20 * 1024, 'anggaran sangat kecil → paling sedikit 20 KB (satu perintah tetap berguna)');
cek(J.batasKeluaranAman(50 * 1024 * 1024) === J.PAGAR_KELUARAN_BYTE && J.PAGAR_KELUARAN_BYTE === 4 * 1024 * 1024, 'pagar 4 MB melindungi memori proses utama');

console.log('\n-- proses sungguhan: 100 KB keluaran --');
const kerja = mkdtempSync(path.join(os.tmpdir(), 'uji-k2-'));
try {
  writeFileSync(path.join(kerja, 'cetak.js'), "process.stdout.write('a'.repeat(100 * 1024));");
  const jalan = (opsi) => J.jalankanProses(process.execPath, [path.join(kerja, 'cetak.js')], { cwd: kerja, env: process.env, waktuS: 30, ...opsi });
  const lama = await jalan({});
  cek(lama.keluaran.length === 20 * 1024 && lama.terpotong === true && lama.byteKeluaran === 100 * 1024, 'tanpa anggaran: terpotong 20 KB, ukuran asli dilaporkan', { n: lama.keluaran.length, total: lama.byteKeluaran });
  const baru = await jalan({ keluaranMaksByte: 200 * 1024 });
  cek(baru.keluaran.length === 100 * 1024 && baru.terpotong === false && baru.keluaranMaksByte === 200 * 1024, 'anggaran 200 KB: keluaran 100 KB sampai utuh', { n: baru.keluaran.length, terpotong: baru.terpotong });
  const sempit = await jalan({ keluaranMaksByte: 64 * 1024 });
  cek(sempit.keluaran.length === 64 * 1024 && sempit.terpotong && sempit.keluaranMaksByte === 64 * 1024, 'anggaran 64 KB: dipotong tepat di anggaran, batasnya ikut dilaporkan');

  const izin = [];
  const deps = { profil: J.PROFIL.engineer, mintaIzin: async (x) => { izin.push(x); return true; }, env: process.env };
  const h = await J.jalankanAlatJalan(kerja, { alat: 'folder_run', program: 'node', argumen: ['cetak.js'], keluaranMaksByte: 200 * 1024 }, deps);
  cek(h.ok && h.keluaran.length === 100 * 1024, 'jalankanAlatJalan meneruskan anggaran sampai ke proses', { ok: h.ok, alasan: h.alasan, n: h.keluaran?.length });
  cek(izin.length === 1 && /keluaran maks 200 KB \(anggaran konteks Settings\)/.test(izin[0].rincian), 'dialog izin menyebut batas yang sebenarnya, bukan 20 KB', izin[0]?.rincian);
} finally {
  rmSync(kerja, { recursive: true, force: true });
}

console.log('\n-- klien mengirim anggaran konteks --');
{
  const esb = await import(pathToFileURL(path.join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
  const keluar = path.join(os.tmpdir(), `uji-k2-as-${Date.now()}.mjs`);
  await esb.build({
    entryPoints: [path.join(AKAR, 'frontend/src/core/runtime/services/AssistantService.js')],
    bundle: true, format: 'esm', platform: 'neutral', outfile: keluar, logLevel: 'error',
    plugins: [{ name: 'tiruan-supabase', setup(b) {
      b.onResolve({ filter: /(^|\/)supabase(\.js)?$/ }, () => ({ path: 'supabase', namespace: 'tiruan' }));
      b.onLoad({ filter: /.*/, namespace: 'tiruan' }, () => ({ contents: 'export const supabase = {};', loader: 'js' }));
    } }],
  });
  const dikirim = [];
  globalThis.window = { electronAPI: { engineer: { jalankan: async (perintah, opsi) => { dikirim.push({ perintah, opsi }); return { ok: true, kodeKeluar: 0, waktuMs: 5, keluaran: 'x', terpotong: true, byteKeluaran: 900000, keluaranMaksByte: 240000 }; } } } };
  const { AssistantService } = await import(pathToFileURL(keluar).href);
  const as = new AssistantService({ has: () => false, get: () => null });
  as._batasBacaFolderHuruf = async () => 240000;
  const r = await as.runCommand('git show HEAD:a.js', []);
  cek(dikirim[0]?.opsi?.keluaranMaksByte === 240000, 'runCommand Engineer mengirim anggaran konteks (huruf) sebagai batas keluaran', dikirim[0]);
  cek(/keluaran dipotong dari 900000 byte menjadi 240000 byte \(anggaran konteks Settings\)/.test(r.output), 'model diberi tahu ukuran asli DAN batas yang memotongnya', r.output);
  const AS = baca('frontend/src/core/runtime/services/AssistantService.js');
  cek(AS.includes("window.electronAPI.folderKerja.alat(p.alat === 'folder_run' ? { ...p, keluaranMaksByte: Math.max(1, batasBacaHuruf - byte) } : p)"), 'alat folder Assistant: folder_run memakai sisa anggaran konteks pertanyaan ini');
  const M = baca('frontend/electron/main.cjs');
  const P = baca('frontend/electron/preload.cjs');
  cek(/ipcMain\.handle\('engineer:jalankan', async \(_event, perintah, opsi = \{\}\)/.test(M) && /keluaranMaksByte: opsi\?\.keluaranMaksByte/.test(M) && /jalankan: \(perintah, opsi\) => ipcRenderer\.invoke\('engineer:jalankan', perintah, opsi\)/.test(P), 'IPC Engineer meneruskan anggaran dari renderer ke proses utama');
}

console.log('\n-- tak ada lagi "20 KB" yang menyesatkan --');
{
  const KONS = baca('constitution/28_PROSEDUR_KERJA_ENGINEER.md');
  cek(/dibatasi anggaran konteks dari Settings/.test(KONS) && !/Keluaran tiap perintah dipotong di 20 KB/.test(KONS) && !/Tidak ada peringatan bahwa itu terjadi/.test(KONS), 'konstitusi 28 menyebut batas yang berlaku sekarang');
  const PE = baca('frontend/src/core/runtime/services/engineer/ProsedurEngineer.js');
  cek(!/20 KB\)/.test(PE) && !/pasti terpotong \(20 KB\)/.test(PE), 'petunjuk peta repo tak lagi memaku 20 KB');
}

console.log(`\n${gagal ? `GAGAL ${gagal}` : 'SEMUA LULUS'}`);
process.exit(gagal ? 1 : 0);
