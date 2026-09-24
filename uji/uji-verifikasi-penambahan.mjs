// UJI 2026-09-24 — pemeriksa pola berbahaya menilai PENAMBAHAN, bukan keberadaan.
//
// KEGAGALAN LIVE (putaran kelima tugas "perbaiki komentar engineer.js:1035"):
//   "⚠️ Patch Gagal — Patch tidak lolos verifikasi: 2 masalah kritis."
// Dua-duanya PALSU. `verifyPatchEngineering` memindai SELURUH isi berkas hasil patch dengan
// `responseText.includes('eval(')`. Berkas `engineer.js` memuat `eval(` dan `new Function(` di baris 928
// — DI DALAM pemeriksa aturan MAEF-nya sendiri, kode yang tugasnya mendeteksi keduanya.
// Jadi pemeriksa itu memblokir berkas yang memuat dirinya sendiri, selamanya, untuk perubahan apa pun.
//
// Patch yang sedang ditolak hanya mengubah satu komentar.
import { readFileSync } from 'node:fs';
const AKAR = 'D:/SLAMET/other/mamet os ecosystem/';
console.log('uji-verifikasi-penambahan v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 320)}` : ''}`);
  if (!ok) gagal++;
};

// ---------- BUKTI: berkas sasaran memang memuat kedua pola ----------
const engineerJs = readFileSync(AKAR + 'frontend/src/core/runtime/services/engineer.js', 'utf8');
const hitung = (t, p) => t.split(p).length - 1;
cek(hitung(engineerJs, 'eval(') >= 1 && hitung(engineerJs, 'new Function(') >= 1,
  `BUKTI: engineer.js memuat "eval(" (${hitung(engineerJs, 'eval(')}x) dan "new Function(" (${hitung(engineerJs, 'new Function(')}x) — dasar cacatnya`);
cek(/content\.includes\('eval\('\) \|\| content\.includes\('new Function\('\)/.test(engineerJs),
  'BUKTI: kemunculannya ada di dalam pemeriksa aturan MAEF-nya sendiri — pemeriksa yang memblokir dirinya');

// ---------- ambil implementasi NYATA dari Kernel.js, bukan tiruan ----------
const KER = readFileSync(AKAR + 'frontend/src/core/runtime/Kernel.js', 'utf8');
const iAwal = KER.indexOf('verifyPatchEngineering: (context) => {');
const iAkhir = KER.indexOf('\n      }', iAwal);
const badan = KER.slice(KER.indexOf('{', iAwal), iAkhir + 8);
// eslint-disable-next-line no-new-func
const verify = new Function('context', `const f = ${badan}; return f(context);`.replace('const f = {', 'const f = (context) => {'));

const jalankan = (baru, asli) => verify({
  responseText: JSON.stringify({ 'a.js': baru }),
  originalText: asli === undefined ? undefined : JSON.stringify({ 'a.js': asli }),
});

// ---------- CACAT LIVE TERTUTUP ----------
const isiAsli = 'function cek(content) {\n  if (content.includes("eval(") || content.includes("new Function(")) return false;\n}\n// [ADR-0017] fungsi diekstrak.';
const isiBaru = isiAsli.replace('// [ADR-0017] fungsi diekstrak.', '// [ADR-0017] fungsi DIHAPUS (T10).');
let r = jalankan(isiBaru, isiAsli);
cek(r.decision === 'PASS' && r.failures.length === 0,
  'CACAT LIVE TERTUTUP: patch komentar pada berkas yang MENYEBUT eval()/new Function() kini lolos', r);

// ---------- KENDALI: pagar keamanannya TIDAK melemah ----------
r = jalankan(isiAsli + '\neval("jahat");', isiAsli);
cek(r.decision === 'FAIL' && r.failures.some((f) => /MENAMBAH pemanggilan eval/.test(f.message)),
  'KENDALI: patch yang benar-benar MENAMBAH eval() tetap diblokir', r.failures);
r = jalankan(isiAsli + '\nconst f = new Function("x");', isiAsli);
cek(r.decision === 'FAIL' && r.failures.some((f) => /new Function/.test(f.message)),
  'KENDALI: penambahan new Function() tetap diblokir', r.failures);
r = jalankan(isiAsli + '\neval("a");\neval("b");', isiAsli);
cek(r.decision === 'FAIL', 'KENDALI: menambah dua sekaligus tetap diblokir');

// menghapus yang berbahaya tidak boleh dianggap pelanggaran
r = jalankan(isiAsli, isiAsli + '\neval("jahat");');
cek(r.decision === 'PASS', 'patch yang MENGHAPUS eval() jelas bukan pelanggaran', r.failures);

// ---------- KENDALI: tanpa isi asli, perilakunya kembali seperti semula ----------
r = jalankan('eval("x");', undefined);
cek(r.decision === 'FAIL', 'KENDALI: tanpa originalText, keberadaan eval( tetap dianggap penambahan (tidak melonggar diam-diam)', r.failures);
r = jalankan('const a = 1;', undefined);
cek(r.decision === 'PASS', 'KENDALI: tanpa originalText, berkas bersih tetap lolos');

// ---------- vendor API ----------
const vendorAsli = 'const x = 1;';
r = jalankan(vendorAsli + '\nfetch("https://api.openai.com/v1/chat");', vendorAsli);
cek(r.failures.some((f) => f.severity === 'HIGH' && /vendor/.test(f.message)), 'penambahan panggilan vendor langsung ditandai HIGH', r.failures);
cek(r.decision === 'PASS', 'HIGH tidak memblokir — hanya CRITICAL yang memblokir (perilaku lama dipertahankan)', r);
const vendorSudahAda = 'fetch("https://api.openai.com/v1/chat");';
r = jalankan(vendorSudahAda + '\n// komentar baru', vendorSudahAda);
cek(r.failures.length === 0, 'panggilan vendor yang SUDAH ADA tidak ditandai saat patch tak menambah apa-apa', r.failures);

// ---------- isi asli benar-benar dikirim dari engineer.js ----------
cek(/originalText: JSON\.stringify\(patch\.files\.reduce/.test(engineerJs), 'engineer.js mengirim isi asli ke pemeriksa');
cek(/acc\[f\.path\] = f\.originalContent \|\| '';/.test(engineerJs), 'isi asli diambil dari originalContent tiap berkas patch');

// ---------- pesan gagal menyebut masalahnya, bukan cuma menghitung ----------
cek(/\[\$\{i\.severity/.test(engineerJs) && /i\.id \|\| i\.name/.test(engineerJs),
  'pesan gagal verifikasi menyebut tiap masalah beserta tingkat & id-nya, bukan cuma jumlahnya');
cek(/Tidak ada berkas yang diubah\./.test(engineerJs), 'pesan gagal menegaskan tidak ada berkas yang berubah');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
