// UJI Item 85 Tahap 1 — label VERIFIED untuk jawaban dari berkas folder kerja: pemeriksa label SERVER asli
// (label_sumber.ts, dibundel esbuild) + sumberDariHasilAlat, dengan hasil alat NYATA dari folder engine.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const akar = 'D:/SLAMET/other/mamet os ecosystem';
const keluar = path.join(os.tmpdir(), 'uji-label-sumber.mjs');
execFileSync(process.execPath, [path.join(akar, 'frontend/node_modules/esbuild/bin/esbuild'), path.join(akar, 'supabase/functions/agent-process/lib/verification/label_sumber.ts'), '--bundle', '--format=esm', '--platform=neutral', `--outfile=${keluar}`, '--log-level=error']);
const L = await import(pathToFileURL(keluar).href + '?v=' + Date.now());
const F = await import(pathToFileURL(path.join(akar, 'frontend/src/core/runtime/services/folderKerjaAlat.js')).href + '?v=' + Date.now());
const A = require(path.join(akar, 'frontend/electron/alatFolder.cjs'));
console.log('uji-folder-label v1');
let gagal = 0; const cek = (ok, pesan) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}`); if (!ok) gagal++; };

const ENGINE = 'D:/SLAMET/other/gabut/engine';
const hasil1 = [A.jalankanAlat(ENGINE, { alat: 'folder_list', alamat: '.' })];
const pesan1 = F.susunPesanHasil(hasil1, { putaran: 1, pertanyaanAsli: 'cari CosineSimilarity' });
const hasil2 = [A.jalankanAlat(ENGINE, { alat: 'folder_read', alamat: 'core/math.go' }), A.jalankanAlat(ENGINE, { alat: 'folder_search', kueri: 'CosineSimilarity', alamat: '.' })];
const pesan2 = F.susunPesanHasil(hasil2, { putaran: 2, pertanyaanAsli: 'cari CosineSimilarity' });

const s = F.sumberDariHasilAlat([pesan2, 'pertanyaan biasa bukan hasil alat', pesan1]);
cek(s.judul.length === 1 && s.judul[0] === 'core/math.go', `judul sumber = berkas yang dibaca saja (${s.judul.join(', ')})`);
cek(s.isi.some((t) => t.includes('func CosineSimilarity(a, b []float32)')), 'isi berkas terpotong tepat di pembatas');
cek(s.isi.some((t) => t.includes('core/engine.go:177')), 'hasil pencarian ikut sebagai isi (baris 177)');
cek(s.isi.some((t) => t.includes('vektor_wal.log')), 'daftar folder ikut sebagai isi');
cek(F.sumberDariHasilAlat(['Tolong baca core/math.go']).judul.length === 0, 'pesan pengguna biasa tidak dianggap bukti');

const benar = `Fungsi \`CosineSimilarity\` ada di core/math.go dan dipanggil di core/engine.go baris 177.\n\nSumber: \`core/math.go\`\n\n[STATUS: VERIFIED]`;
cek(!L.periksaLabelSumber(benar, s.judul, s.isi).dikoreksi, 'jawaban mengutip berkas yang dibaca → VERIFIED bertahan');
const tanpaFolder = L.periksaLabelSumber(benar, [], []);
cek(tanpaFolder.dikoreksi, 'kasus live sebelum perbaikan: tanpa sumber folder → diturunkan (seperti chat 1–3)');
const salahBerkas = `Fungsinya ada di api/server.go.\n\nSumber: \`api/server.go\`\n\n[STATUS: VERIFIED]`;
cek(L.periksaLabelSumber(salahBerkas, s.judul, s.isi).dikoreksi, 'mengutip berkas yang TIDAK dibaca → diturunkan');
const angkaKarangan = `Skor kemiripan rata-rata 0,93 menurut core/math.go.\n\nSumber: \`core/math.go\`\n\n[STATUS: VERIFIED]`;
cek(L.periksaLabelSumber(angkaKarangan, s.judul, s.isi).dikoreksi, 'angka yang tidak ada di berkas → diturunkan');

fs.rmSync(keluar, { force: true });
console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
