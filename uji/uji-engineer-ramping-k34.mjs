import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(import.meta.url);
const baca = (p) => readFileSync(path.join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const imp = (p) => import(pathToFileURL(path.join(AKAR, p)).href);

console.log('uji-engineer-ramping-k34 v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

console.log('\n-- K.3: aturan identitas Engineer dirampingkan, kontrak format tetap --');
const EC = baca('supabase/functions/agent-process/lib/rag/engineer_context.ts');
const awal = EC.indexOf('[ENGINEER IDENTITY & CONVERSATION MODE]');
const blok = EC.slice(awal, EC.indexOf('`;', awal));
cek(awal > 0 && blok.length < 6500, `blok aturan identitas ${blok.length} huruf (dulu 14.696)`, blok.length);
for (const kontrak of ['TUGAS YANG DIKERJAKAN: <task id>', '<uji_klaim berkas=', '<temuan berkas=', 'RINGKASAN:', 'BUKTI:', '<pengetahuan jenis="Lesson|RootCause|Solution|ADRLink" judul=', '[MAMET_CMD:', '[MAMET_PATCH_READY]', '[MAMET_CRITICAL:', 'ISINYA TIDAK DIBACA', 'CORE IMMUTABLE', '[PERINTAH YANG BISA DIJALANKAN]']) {
  cek(blok.includes(kontrak), `kontrak yang dibaca kode/pengguna tetap diajarkan: ${kontrak}`);
}
for (const buang of ['Real failure', 'Real need', 'RULE 1 - SCOPED CODE REVIEW', 'Engineering Confidence', 'Self Verification', 'PROJECT HEALTH REPORT', 'AUTONOMOUS PLANNING FORMAT', 'breach of Mamet AI Engineering Framework', 'user MUST provide git diff', 'Comments explain WHY', 'Until 2 Oct 2026']) {
  cek(!blok.includes(buang), `dibuang (ritual/anekdot/aturan basi): ${buang}`);
}
cek(/WITHOUT explanatory comments \(Owner rule\)/.test(blok), 'aturan komentar mengikuti keputusan Owner 6 Nov (dulu: "Comments explain WHY")');
cek(!/python, py, pip, node, npm, npx, git, go/.test(blok) && !/git is READ-ONLY: status, log/.test(blok), 'daftar program & git TIDAK lagi disalin tangan di prompt server');
cek(!/permission dialog for every command/.test(blok), 'klaim basi "dialog untuk setiap perintah" dicabut (git baca jalan tanpa dialog)');
cek(!/`/.test(blok) && !/\$\{/.test(blok), 'tanpa backtick/interpolasi di teks instruksi');

const RP = baca('supabase/functions/agent-process/lib/request/request_pipeline.ts');
const em = RP.slice(RP.indexOf('[ENGINEER MODE — INSTRUKSI WAJIB]'), RP.indexOf('`;', RP.indexOf('[ENGINEER MODE — INSTRUKSI WAJIB]')));
cek(em.length < 1500, `blok ENGINEER MODE ${em.length} huruf (dulu 2.173)`, em.length);
cek(/"frontend\/src\/utils\/example\.js": "SEBELUM: return a \+ b; SESUDAH: return Number\(a\) \+ Number\(b\);"/.test(em) && /\[MAMET_PATCH_READY\] di baris PALING AKHIR/.test(em) && /Hanya bertanya\/analisis → JANGAN tulis/.test(em), 'format patch JSON flat & aturan penanda tetap utuh');
cek(!/RULE 1-6/.test(em), 'rujukan ke RULE 1-6 yang sudah dihapus ikut dicabut');

console.log('\n-- K.4: daftar perintah dari aturan sungguhan --');
const J = require(path.join(AKAR, 'frontend/electron/alatFolderJalan.cjs'));
const P = await imp('frontend/src/core/runtime/services/engineer/ProsedurEngineer.js');
const kb = J.kebijakanPerintah(J.PROFIL.engineer);
const teks = P.catatanKebijakanPerintah(kb, { keluaranMaksByte: 240 * 1024 });
cek(teks.startsWith('[PERINTAH YANG BISA DIJALANKAN'), 'catatan berkepala penanda yang dirujuk prompt server', teks.slice(0, 80));
cek(J.DAFTAR_PROGRAM.every((p) => teks.includes(p)), 'semua program di daftar izin disebut');
cek(teks.includes(`git HANYA: ${J.GIT_BACA.join(', ')}`), 'subperintah git = GIT_BACA persis');
cek(teks.includes(`Jalan langsung tanpa dialog izin: ${J.GIT_BACA.map((s) => `git ${s}`).join(', ')}`), 'yang jalan tanpa dialog disebut (dulu prompt bilang semua lewat dialog)');
cek(/keluaran maks 240 KB \(anggaran konteks Settings\)/.test(teks) && /Batas waktu bawaan 180 detik \(maks 300\)/.test(teks), 'batas waktu & keluaran = angka yang berlaku');

const kerja = mkdtempSync(path.join(os.tmpdir(), 'uji-k4-'));
try {
  const deps = { profil: J.PROFIL.engineer, mintaIzin: async () => false, env: process.env };
  const coba = async (program, argumen) => J.jalankanAlatJalan(kerja, { alat: 'folder_run', program, argumen }, deps);
  const ditolakAturan = (h) => !h.ok && !h.ditolakOwner;
  const gitBoleh = (teks.match(/git HANYA: ([^(]+) \(branch/) || [])[1]?.split(', ') || [];
  cek(gitBoleh.length === J.GIT_BACA.length, 'daftar git yang boleh terbaca dari catatan', gitBoleh);
  for (const sub of ['add', 'commit', 'push', 'pull', 'reset', 'checkout']) {
    cek(ditolakAturan(await coba('git', [sub])) && !gitBoleh.includes(sub) && new RegExp(`\\b${sub}\\b[^\\n]*ditolak`).test(teks), `git ${sub}: ditolak pagar, tidak disebut boleh, disebut ditolak`);
  }
  for (const s of J.GIT_BACA) {
    cek(J.tanpaPersetujuan({ program: 'git', argumen: [s], profil: J.PROFIL.engineer }), `git ${s}: disebut tanpa dialog DAN memang lolos tanpa dialog`);
  }
  const programInternet = kb.program.filter((x) => x.internet.length);
  cek(programInternet.length >= 5 && programInternet.every((x) => x.internetDitolak) && /Ditolak karena mengunduh dari internet: [^\n]*npm install/.test(teks) && /npx \(semua\)/.test(teks), 'Engineer: semua program yang bisa mengunduh ditandai & disebut ditolak', programInternet.map((x) => `${x.nama}:${x.internetDitolak}`));
  for (const p of kb.program.filter((x) => x.internetDitolak)) {
    for (const sub of p.internet.filter((x) => x !== '(semua)').slice(0, 2)) {
      const h = await coba(p.nama, [sub]);
      cek(ditolakAturan(h) && /internet/.test(h.alasan), `${p.nama} ${sub}: disebut ditolak (internet) DAN memang ditolak`, h.alasan);
    }
  }
  const npmTolak = kb.program.find((x) => x.nama === 'npm').tolak[0];
  cek(ditolakAturan(await coba('npm', [npmTolak])) && teks.includes(`npm ${kb.program.find((x) => x.nama === 'npm').tolak.join('|')}`), `npm ${npmTolak}: disebut ditolak DAN memang ditolak`);
  const h = await coba('node', ['-e', '1']);
  cek(h.ditolakOwner === true, 'node: disebut "dengan dialog izin" DAN memang meminta izin (di sini ditolak di dialog)');
} finally {
  rmSync(kerja, { recursive: true, force: true });
}
cek(P.catatanKebijakanPerintah(null) === '' && P.catatanKebijakanPerintah({ program: [] }) === '', 'tanpa kebijakan → tanpa catatan (tidak mengarang daftar)');

console.log('\n-- K.4: tersambung ke Engineer --');
const CE = baca('frontend/src/components/workbench/ConversationEngine.jsx');
cek(/catatanPerintah = catatanKebijakanPerintah\(await window\.electronAPI\.engineer\.kebijakanPerintah\(\), \{ keluaranMaksByte \}\)/.test(CE) && /const sisipan = \[catatanAkar, catatanKons, catatanPeta, catatanPerintah, ringkasanTemuan\]/.test(CE), 'catatan perintah ikut sisipan Engineer setiap pesan');
cek(/catch \(e\) \{ console\.warn\('\[Engineer\] daftar perintah yang boleh tak terbaca:'/.test(CE), 'gagal membaca kebijakan → tercatat, tidak diam');
cek(/ipcMain\.handle\('engineer:kebijakan-perintah', \(\) => kebijakanPerintah\(PROFIL\.engineer\)\)/.test(baca('frontend/electron/main.cjs')) && /kebijakanPerintah: \(\) => ipcRenderer\.invoke\('engineer:kebijakan-perintah'\)/.test(baca('frontend/electron/preload.cjs')), 'IPC kebijakan dari proses utama (satu sumber)');
const { jejakSisipan } = await imp('frontend/src/core/runtime/services/jejakSisipan.js');
cek(/perintah=1234/.test(jejakSisipan({ engineer: true, catatanPerintah: 'x'.repeat(1234) })), 'ukuran catatan perintah ikut diukur (K.1)');

console.log(`\n${gagal ? `GAGAL ${gagal}` : 'SEMUA LULUS'}`);
process.exit(gagal ? 1 : 0);
