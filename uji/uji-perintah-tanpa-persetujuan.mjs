// UJI 2026-10-01 — perintah BACA dijalankan tanpa persetujuan; yang krusial tetap ditanyakan.
//
// ── Keputusan Owner ─────────────────────────────────────────────────────────────────────────
// *"perintah yang krusial saja yang perlu persetujuan saya… seperti anda menjalankan perintah dari
// saya ini, anda tidak meminta approval. Baru hal yang akan kritis baru bertanya. Ini seperti
// membuat ribet dengan hal yang sebenarnya aman."*
//
// Sebelum ini satu `git grep` menuntut DUA persetujuan — tombol Jalankan di chat, lalu dialog asli
// dari proses utama — jadi lima perintah baca = sepuluh kali menyetujui, dan Owner jadi tangan model.
//
// ── Yang membuatnya aman bukan aturan baru ──────────────────────────────────────────────────
// Melainkan yang SUDAH ada di PROFIL.engineer: git baca saja, `git branch` yang mengubah ditolak,
// opsi yang menulis berkas / memanggil alat luar ditolak. Untuk git, dialog itu tidak menambah
// perlindungan apa pun. Yang TETAP ditanyakan: `node -e`, `python -c`, program lain — itu kode
// bebas yang tidak dibatasi pagar folder.
//
// Uji ini sebagian besar berisi percobaan MENEMBUS garis itu. Pelonggaran izin yang hanya diuji
// dengan contoh yang seharusnya lolos bukan uji keamanan, itu hanya uji keberuntungan.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const require = createRequire(`${AKAR}/frontend/`);
const { tanpaPersetujuan, PROFIL, pecahPerintah } = require(`${AKAR}/frontend/electron/alatFolderJalan.cjs`);

console.log('uji-perintah-tanpa-persetujuan v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

/** Menilai satu kalimat perintah lewat pemecah YANG SAMA dengan pelaksana. */
const nilai = (teks, profil = PROFIL.engineer) => {
  const p = pecahPerintah(teks);
  if (p.galat) return { galatPecah: p.galat };
  return { aman: tanpaPersetujuan({ program: p.program, argumen: p.argumen, profil }) };
};

// ── 1. Yang memang aman: dijalankan tanpa bertanya ──────────────────────────────────────────
console.log('\n-- baca: tanpa persetujuan --');
for (const t of [
  `git grep -c "" -- frontend/src`,
  'git status',
  'git log --oneline -5',
  'git diff HEAD~1',
  'git show HEAD:frontend/package.json',
  'git blame -L 10,20 -- frontend/electron/main.cjs',
  'git ls-files',
  'git rev-parse HEAD',
  'git branch',
  'git branch --list',
  'git shortlog -s',
  'git describe --tags',
]) {
  cek(nilai(t).aman === true, `aman: ${t}`, nilai(t));
}

// ── 2. Yang TETAP ditanyakan ────────────────────────────────────────────────────────────────
console.log('\n-- krusial: tetap minta izin --');
for (const [t, sebab] of [
  [`node -e "console.log(1)"`, 'kode bebas — tidak dibatasi pagar folder'],
  [`python -c "print(1)"`, 'kode bebas'],
  ['npm run build', 'program lain'],
  ['git add .', 'mengubah indeks git'],
  ['git commit -m "x"', 'membuat commit'],
  ['git init', 'membuat repo'],
  ['git branch -D lama', 'MENGHAPUS cabang — `branch` tidak otomatis aman'],
  ['git branch -m baru', 'memindah cabang'],
  ['git branch -f main HEAD~3', 'memaksa pindah cabang'],
  ['git branch -u origin/main', 'mengubah hulu'],
]) {
  const h = nilai(t);
  cek(h.aman === false || !!h.galatPecah, `minta izin: ${t} — ${sebab}`, h);
}

// ── 3. Percobaan menembus lewat opsi ────────────────────────────────────────────────────────
// Inilah yang membuat "git itu cuma baca" bisa salah: beberapa opsi git MENJALANKAN program luar
// atau MENULIS berkas, walau sub-perintahnya membaca.
console.log('\n-- tembusan lewat opsi --');
for (const [t, sebab] of [
  ['git diff --ext-diff', 'memanggil alat diff luar'],
  ['git grep --output=/tmp/x pola', 'menulis ke berkas'],
  ['git log --exec=sesuatu', 'menjalankan program'],
  ['git --git-dir=/lain log', 'menunjuk repo lain'],
  ['git --work-tree=/lain status', 'menunjuk pohon kerja lain'],
  ['git log --upload-pack=jahat', 'menjalankan program lewat transport'],
]) {
  const h = nilai(t);
  cek(h.aman === false || !!h.galatPecah, `ditolak: ${t} — ${sebab}`, h);
}

// `git -c core.pager=…` menyisipkan konfigurasi SEBELUM sub-perintah: kalau penentu hanya mencari
// sub-perintah di mana pun, perintah ini akan dikira "log" yang aman.
console.log('\n-- sisipan konfigurasi sebelum sub-perintah --');
{
  const h = tanpaPersetujuan({ program: 'git', argumen: ['-c', 'core.pager=kalkulator', 'log'], profil: PROFIL.engineer });
  cek(h === false, 'git -c <konfigurasi> log TIDAK dianggap aman', h);
}

// ── 4. Peran lain tidak ikut dilonggarkan ───────────────────────────────────────────────────
// Profil assistant boleh `git add`/`commit` dan bekerja di folder pilihan Owner — pelonggaran ini
// hanya untuk peran yang memang sudah dikunci ke git-baca.
console.log('\n-- hanya peran engineer --');
{
  cek(tanpaPersetujuan({ program: 'git', argumen: ['status'], profil: PROFIL.assistant }) === false,
    'profil assistant TIDAK ikut dilonggarkan');
  cek(tanpaPersetujuan({ program: 'git', argumen: ['status'], profil: null }) === false,
    'tanpa profil → tetap minta izin (gagal ke sisi aman)');
  cek(tanpaPersetujuan({ program: 'git', argumen: [], profil: PROFIL.engineer }) === false,
    'git tanpa sub-perintah tidak dianggap aman');
}

// ── 5. Terpasang di proses utama & layar ────────────────────────────────────────────────────
console.log('\n-- terpasang --');
{
  const MAIN = readFileSync(`${AKAR}/frontend/electron/main.cjs`, 'utf8').replace(/\r\n/g, '\n');
  const PRELOAD = readFileSync(`${AKAR}/frontend/electron/preload.cjs`, 'utf8').replace(/\r\n/g, '\n');
  const CE = readFileSync(`${AKAR}/frontend/src/components/workbench/ConversationEngine.jsx`, 'utf8').replace(/\r\n/g, '\n');
  const CE_KODE = CE.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

  cek(/ipcMain\.handle\('engineer:perintah-aman'/.test(MAIN), 'penentu dibuka lewat IPC');
  cek(/perintahAman: \(teks\) => ipcRenderer\.invoke\('engineer:perintah-aman', teks\)/.test(PRELOAD), 'dijembatani preload');
  cek(/tanpaPersetujuan \}\s*=\s*require\('\.\/alatFolderJalan\.cjs'\)/.test(MAIN), 'proses utama memakai penentu yang sama');

  // Penegakannya ada di pelaksana, bukan di layar: layar hanya tahu perlu menunggu atau tidak.
  const JALAN = readFileSync(`${AKAR}/frontend/electron/alatFolderJalan.cjs`, 'utf8').replace(/\r\n/g, '\n');
  cek(/if \(tanpaPersetujuan\(\{ program, argumen, profil \}\)\) \{/.test(JALAN),
    'dialog dilewati di PELAKSANA, bukan hanya di layar');

  cek(/engineer\?\.perintahAman\?\.\(cmd\)/.test(CE_KODE), 'layar bertanya ke proses utama, tidak menilai sendiri');
  cek(/if \(!aman\) continue;/.test(CE_KODE), 'perintah krusial tetap menunggu tombol Owner');
  cek(/handleSend\(null, hasil\.join\('\\n\\n'\)\)/.test(CE_KODE),
    'SATU kiriman untuk semua hasil — bukan satu panggilan model berbayar per perintah',
    (CE_KODE.match(/.*hasil\.join.*/g) || []));
  cek(/const cmdOtomatisRef = useRef\(new Set\(\)\)/.test(CE_KODE), 'perintah yang sudah jalan tidak diulang');
  cek(/if \(chatOtomatisRef\.current !== currentChatId\)/.test(CE_KODE),
    'pindah percakapan & pemuatan awal dilewati — membuka riwayat lama tak boleh menjalankan ulang perintah');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
