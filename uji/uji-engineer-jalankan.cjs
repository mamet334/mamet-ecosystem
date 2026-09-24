// UJI T8 (2026-09-22) — tombol [MAMET_CMD] Engineer: pecahPerintah (tanpa shell) + pelaksana folder_run dengan akar
// "repo" sementara + jalur lama (run-terminal-command, edit-file-surgical, CommandRegistry) benar-benar hilang.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pecahPerintah, jalankanAlatJalan, PROFIL } = require('../frontend/electron/alatFolderJalan.cjs');
console.log('uji-engineer-jalankan v4'); // v2: profil + klaim · v3: blok bash → penanda · v4: % $ ^ sah (tanpa shell)
let gagal = 0;
const cek = (ok, pesan, rinci) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      → ${JSON.stringify(rinci).slice(0, 300)}` : ''}`); if (!ok) gagal++; };
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1. Pemecah perintah — contoh dari prompt Engineer & bentuk yang biasa ditulis model
cek(sama(pecahPerintah('npm install'), { program: 'npm', argumen: ['install'] }), 'npm install');
cek(sama(pecahPerintah('  git   status  '), { program: 'git', argumen: ['status'] }), 'spasi berlebih');
cek(sama(pecahPerintah('npm run build'), { program: 'npm', argumen: ['run', 'build'] }), 'npm run build');
cek(sama(pecahPerintah('git commit -m "perbaiki bug label"'), { program: 'git', argumen: ['commit', '-m', 'perbaiki bug label'] }), 'kutip ganda mengelompokkan');
cek(sama(pecahPerintah("git commit -m 'perbaiki bug'"), { program: 'git', argumen: ['commit', '-m', 'perbaiki bug'] }), 'kutip tunggal mengelompokkan');
cek(sama(pecahPerintah('node -e "console.log(1+1)"'), { program: 'node', argumen: ['-e', 'console.log(1+1)'] }), 'kode node dalam kutip');
cek(sama(pecahPerintah('git log -n 5 --pretty=format:"%h - %an, %ar : %s"'), { program: 'git', argumen: ['log', '-n', '5', '--pretty=format:%h - %an, %ar : %s'] }), 'live v4: git log --pretty=format:"%h …" diterima (tanpa shell % hanya teks)');
cek(sama(pecahPerintah('git show HEAD^'), { program: 'git', argumen: ['show', 'HEAD^'] }) && sama(pecahPerintah('node -e "console.log($HOME)"').argumen, ['-e', 'console.log($HOME)']), 'HEAD^ dan $ diterima sebagai teks');
cek(sama(pecahPerintah('python ""'), { program: 'python', argumen: [''] }), 'argumen kosong "" tetap satu argumen');
for (const [t, nama] of [
  ['npm install && npm test', '&&'], ['git status | findstr x', '|'], ['npm test; rm -rf /', ';'], ['node a.js > keluar.txt', '>'],
  ['node a.js < masuk.txt', '<'], ['echo `id`', 'backtick'], ['git status\nnpm publish', 'baris baru'], ['git status\r\nnpm publish', 'CRLF'],
  ['python "tak ditutup', 'kutip tak ditutup'], ['', 'kosong'],
]) cek(pecahPerintah(t).galat, `ditolak: ${nama} — ${pecahPerintah(t).galat}`);

// 2. Jalankan lewat pelaksana dengan akar "repo" sementara (jalur yang sama dengan IPC engineer:jalankan)
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-eng-'));
fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'r', version: '1.0.0', scripts: { test: 'node -e "console.log(\'uji-lulus\')"' } }));
const dialog = [];
// v2: jalur Engineer memakai PROFIL.engineer (seperti main.cjs depsEngineer) — tanpa "waktu" di permintaan.
const izinkan = { profil: PROFIL.engineer, mintaIzin: async (p) => { dialog.push(p); return true; } };
const tolak = { profil: PROFIL.engineer, mintaIzin: async (p) => { dialog.push(p); return false; } };
const asisten = { mintaIzin: async (p) => { dialog.push(p); return true; } };
const jalan = async (teks, deps = izinkan) => {
  const p = pecahPerintah(teks);
  if (p.galat) return { ok: false, alasan: p.galat };
  return jalankanAlatJalan(repo, { alat: 'folder_run', program: p.program, argumen: p.argumen }, deps);
};
(async () => {
  let h = await jalan('npm test');
  cek(h.ok && h.kodeKeluar === 0 && h.keluaran.includes('uji-lulus') && dialog.at(-1)?.pratinjau.includes('test: node -e'), 'npm test → "uji-lulus", dialog memuat script', h);
  cek(h.waktuBatasS === 180 && /di repo Mamet\?/.test(dialog.at(-1)?.judul) && /Folder asal: repo Mamet · batas waktu 180 detik/.test(dialog.at(-1)?.rincian), 'profil Engineer: batas 180 s, dialog menyebut "repo Mamet"', dialog.at(-1));
  // Repo git disiapkan lewat profil Assistant (Engineer tak boleh init/add/commit).
  h = await jalan('git init', asisten);
  cek(h.ok && fs.existsSync(path.join(repo, '.git')), 'git init (profil Assistant: boleh)', h);
  h = await jalan('git status --short');
  cek(h.ok && h.keluaran.includes('package.json'), 'Engineer: git status --short', h);
  h = await jalan('git log --oneline -5');
  cek(h.ok, `Engineer: git log --oneline -5 (kode ${h.kodeKeluar})`, h);
  h = await jalan('git -c user.name=uji -c user.email=u@u commit -m "awal"');
  cek(!h.ok && /git -c tidak diizinkan/.test(h.alasan), 'opsi global -c ditolak (git harus diawali sub-perintah)', h);
  h = await jalan('git add package.json', asisten);
  cek(h.ok && h.kodeKeluar === 0, 'profil Assistant tetap boleh git add', h);
  const sebelum = dialog.length;
  for (const t of ['git add package.json', 'git commit -m "komit"', 'git init', 'npm install', 'npm ci', 'npm install left-pad', 'npx cowsay hai', 'pip install requests', 'cargo build', 'go get x']) {
    h = await jalan(t);
    cek(!h.ok && !h.ditolakOwner, `Engineer ditolak sebelum dialog: ${t} — ${h.alasan}`);
  }
  for (const t of ['git push', 'git reset --hard', 'npm publish', 'cmd /c dir', 'powershell -c ls', 'python C:\\Windows\\win.ini', 'python ..\\luar.py']) {
    h = await jalan(t);
    cek(!h.ok && !h.ditolakOwner, `ditolak sebelum dialog: ${t} — ${h.alasan}`);
  }
  cek(dialog.length === sebelum, 'tak ada dialog untuk perintah terlarang');
  h = await jalan('npm test', tolak);
  cek(!h.ok && h.ditolakOwner, 'Tolak → DITOLAK OWNER, tidak dijalankan', h);
  // Profil Assistant tak berubah: install tetap boleh (dengan peringatan 🌐), commit boleh.
  dialog.length = 0;
  h = await jalan('npm install left-pad', { profil: PROFIL.assistant, mintaIzin: async (p) => { dialog.push(p); return false; } });
  cek(h.ditolakOwner && /MENGUNDUH/.test(dialog[0]?.rincian || ''), 'profil Assistant: npm install sampai dialog (🌐), bukan ditolak aturan');

  // 2b. Peringatan klaim Engineer (pemeriksa layar, murni)
  const F = await import(require('url').pathToFileURL(path.join(__dirname, '../frontend/src/core/runtime/services/folderKerjaAlat.js')).href);
  const keluaranAsli = '[TERMINAL OUTPUT for: npm test]\nuji-lulus\n\nKode keluar 0 (0,4 s).';
  cek(F.peringatanKlaimEngineer('Test sudah saya jalankan, hasilnya lulus semua.', 'jalankan test dong') !== null, 'klaim "sudah saya jalankan" tanpa keluaran terminal → peringatan');
  cek(F.peringatanKlaimEngineer('Test sudah saya jalankan, hasilnya lulus semua.', keluaranAsli) === null, 'klaim yang menjawab keluaran terminal asli → tanpa peringatan');
  cek(F.peringatanKlaimEngineer('Hasil eksekusi: lulus.', '[TERMINAL OUTPUT for: npm test]\nDITOLAK OWNER di dialog izin — perintah TIDAK dijalankan.') !== null, 'klaim hasil padahal keluarannya "DITOLAK OWNER" → peringatan');
  cek(F.peringatanKlaimEngineer('Saya akan cek dulu:\n[MAMET_CMD: npm test]\nOutput yang diharapkan: semua test berhasil dijalankan.', 'cek test') === null, 'jawaban yang masih mengusulkan [MAMET_CMD] (harapan) → tidak dinilai');
  cek(F.peringatanKlaimEngineer('Saya ubah fungsi hitung agar aman, patch siap diterapkan.', 'perbaiki bug') === null, 'klaim ubah (jalur patch) → tidak dinilai');

  // v3: blok ```bash satu baris → [MAMET_CMD] (teks persis live: aturan sampai, model menulis blok kode)
  const B = (t) => F.blokKodeKeMametCmd(t);
  cek(B('Saya akan cek status git terlebih dahulu:\n\n```bash\ngit status\n```\n\nSilakan tunggu sebentar untuk hasilnya.').includes('[MAMET_CMD: git status]'), 'live: ```bash git status``` → [MAMET_CMD: git status]');
  cek(B('Saya akan menampilkan 5 commit terakhir dari repositori git:\n\n```bash\ngit log -n 5\n```').includes('[MAMET_CMD: git log -n 5]'), 'live: ```bash git log -n 5``` → penanda');
  cek(B('```\n$ npm test\n```') === '[MAMET_CMD: npm test]' && B('```powershell\nPS> node -v\n```') === '[MAMET_CMD: node -v]', 'tanpa bahasa / prompt $ / PS> dikenali');
  for (const t of ['```bash\nrm -rf node_modules\n```', '```bash\nnpm install\nnpm test\n```', '```js\nconsole.log(1)\n```', '```json\n{"a":1}\n```']) {
    cek(B(t) === t, `dibiarkan sebagai contoh kode: ${JSON.stringify(t).slice(0, 40)}`);
  }
  cek(F.peringatanKlaimEngineer(B('Saya akan cek:\n```bash\ngit status\n```\nberhasil dijalankan nanti.'), 'cek git') === null, 'setelah diubah jadi penanda → dianggap usulan, bukan klaim');

  // 3. Jalur lama benar-benar hilang
  const main = fs.readFileSync(path.join(__dirname, '../frontend/electron/main.cjs'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '../frontend/electron/preload.cjs'), 'utf8');
  cek(!/ipcMain\.handle\('run-terminal-command'/.test(main) && !/ipcMain\.handle\('edit-file-surgical'/.test(main) && !/checkBlockedCommand/.test(main), 'main.cjs: run-terminal-command, edit-file-surgical, blocklist hilang');
  cek(/ipcMain\.handle\('engineer:jalankan'/.test(main) && /pecahPerintah\(teks\)/.test(main) && /profil: PROFIL\.engineer/.test(main) && !/replace\('di folder kerja'/.test(main), 'main.cjs: engineer:jalankan memakai pecahPerintah + pelaksana + PROFIL.engineer (tanpa ganti-teks)');
  cek(!/runTerminalCommand|editFileSurgical/.test(preload.replace(/\/\/.*$/gm, '')) && /engineer:\s*\{\s*jalankan/.test(preload), 'preload: hanya engineer.jalankan (runTerminalCommand & editFileSurgical hilang)');
  cek(!fs.existsSync(path.join(__dirname, '../frontend/src/core/runtime/services/CommandRegistry.js')), 'CommandRegistry.js dihapus');
  const kernel = fs.readFileSync(path.join(__dirname, '../frontend/src/core/runtime/Kernel.js'), 'utf8');
  cek(!/new CommandRegistry|import \{ CommandRegistry/.test(kernel), 'Kernel tidak lagi mendaftarkan CommandRegistry');

  fs.rmSync(repo, { recursive: true, force: true });
  console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
  process.exit(gagal ? 1 : 0);
})();
