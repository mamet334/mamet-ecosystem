// UJI 2026-10-28 — kata kunci aksi Intent Router dicocokkan sebagai KATA, bukan potongan (Item 126 Fase 1).
//
// Mode bayangan atas 482 pesan Owner (agregat di database) menemukan salah picu: `cto` ("vector", "october"),
// `send` ("sendiri"), `api` ("tapi", "rapi"), `kapan` ("kelengkapan"), `yt` ("python"/"byte"); dan 41 pesan
// tersangkut hanya karena kata tanya. Yang dijaga di sini: salah picu itu hilang, bentuk perintah yang sah
// ("mencari", "bacakan", "mengirim") tetap tertangkap, pasif/kata benda ("ditemukan", "catatan", "pencarian")
// tidak, kata tanya tidak lagi memicu, dan intent_router.ts benar-benar memakai pencocok ini.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const dirUji = mkdtempSync(join(tmpdir(), 'uji-kata-kunci-router-'));
const BERKAS = 'supabase/functions/agent-process/lib/orchestration/kata_kunci_router.ts';
const { code } = await esbuild.transform(readFileSync(join(AKAR, BERKAS), 'utf8'), { loader: 'ts', format: 'esm' });
writeFileSync(join(dirUji, 'kkr.mjs'), code);
const K = await import(pathToFileURL(join(dirUji, 'kkr.mjs')).href);
process.on('exit', () => { try { rmSync(dirUji, { recursive: true, force: true }); } catch { /* sudah bersih */ } });

console.log('uji-kata-kunci-router v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
const kk = (s) => K.kataKunciAksi(s.toLowerCase());

// ── 1. Salah picu terukur → tidak lagi memicu ──────────────────────────────────────────────────
console.log('\n-- salah picu dari mode bayangan --');
for (const [pesan, alasan] of [
  ['tapi saya sendiri masih bingung', '"api" di dalam "tapi", "send" di dalam "sendiri"'],
  ['tolong rapikan susunan kalimatnya', '"api" di dalam "rapikan"'],
  ['vector embedding bulan october', '"cto" di dalam "vector"/"october"'],
  ['kelengkapan berkas pegawai', '"kapan" di dalam "kelengkapan"'],
  ['byte order tidak sama', '"yt" di dalam "byte"'],
  ['informasinya sudah lengkap', '"info" di dalam "informasinya"'],
  ['nilainya bagus sekali', '"nilai" di dalam "nilainya" — bukan kata utuh'],
]) cek(kk(pesan) === null, `tidak memicu: "${pesan}" (${alasan})`, kk(pesan));

// ── 2. Kata tanya tidak lagi memicu (41 pesan) ─────────────────────────────────────────────────
console.log('\n-- kata tanya --');
for (const pesan of ['siapa presiden pertama indonesia', 'apakah kamu sehat hari ini', 'bagaimana kabarmu', 'mengapa langit biru', 'kapan kita mulai', 'dimana letaknya'])
  cek(kk(pesan) === null, `kata tanya saja tidak memicu: "${pesan}"`, kk(pesan));
for (const t of ['siapa', 'mengapa', 'bagaimana', 'kapan', 'dimana', 'apakah'])
  cek(!K.KATA_KUNCI_AKSI.includes(t), `"${t}" tidak ada di daftar kata kunci`);

// ── 3. Bentuk perintah yang sah tetap tertangkap ───────────────────────────────────────────────
console.log('\n-- kata kerja perintah --');
for (const [pesan, harap] of [
  ['tolong mencari data penduduk', 'cari (mencari)'],
  ['carikan alamat kantor camat', 'cari (carikan)'],
  ['bacakan isinya untuk saya', 'baca (bacakan)'],
  ['coba membaca lampiran ini', 'baca (membaca)'],
  ['mengirim pesan ke grup', 'kirim (mengirim)'],
  ['ringkaskan bab dua', 'ringkas (ringkaskan)'],
  ['tolong hitung totalnya', 'hitung'],
  ['catat bahwa rapat diundur', 'rapat'],
  ['tolong catat nomor ini', 'catat'],
]) cek(kk(pesan) === harap, `"${pesan}" → ${harap}`, kk(pesan));

// ── 4. Pasif & kata benda tidak memicu ─────────────────────────────────────────────────────────
console.log('\n-- pasif & kata benda --');
for (const pesan of ['hasilnya sudah ditemukan kemarin', 'ini catatan pribadi saya', 'pencarian tadi sudah selesai', 'bacaan ringan sore ini', 'semua sudah dihitung'])
  cek(kk(pesan) === null, `tidak memicu: "${pesan}"`, kk(pesan));

// ── 5. Kata kunci biasa, frasa, dan batas kata ─────────────────────────────────────────────────
console.log('\n-- kata utuh & frasa --');
cek(kk('berita terbaru hari ini') === 'berita', 'kata kunci biasa sebagai kata utuh tetap memicu');
cek(kk('ini api key saya') === 'api', '"api" sebagai kata sendiri tetap memicu');
cek(kk('nama saya budi') === 'nama saya', 'frasa dua kata memicu');
cek(kk('tolong sign   in dulu') === 'sign in', 'frasa dengan spasi ganda tetap cocok');
cek(kk('buka https://contoh.id/a') === 'https', 'URL https memicu walau "http" bukan kata utuh di sana');
cek(kk('kode, dokumen.') === 'kode', 'tanda baca menjadi batas kata');
cek(kk('') === null && kk('halo, apa kabar?') === null, 'pesan kosong & sapaan → null');

// ── 6. Kabel di intent_router.ts ───────────────────────────────────────────────────────────────
console.log('\n-- kabel --');
const IR = readFileSync(join(AKAR, 'supabase/functions/agent-process/lib/orchestration/handlers/intent_router.ts'), 'utf8')
  .split(/\r?\n/).filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');
cek(/import \{ kataKunciAksi \} from '\.\.\/kata_kunci_router\.ts'/.test(IR), 'intent_router.ts mengimpor kataKunciAksi');
cek(/const pemicu = kataKunciAksi\(ctx\.request\.lowerMsg\)/.test(IR) && /if \(pemicu\)/.test(IR), 'keputusan jalur memakai hasil kataKunciAksi');
cek(!/\.includes\(kw\)/.test(IR) && !/actionKeywords/.test(IR), 'pencocokan potongan lama sudah tidak ada');
cek(/kata kunci aksi "\$\{pemicu\}"/.test(IR), 'kata kunci pemicu ditampilkan di langkah proses (ADR-0021: terlihat)');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
