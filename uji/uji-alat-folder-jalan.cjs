// UJI Item 85 Tahap 3 — folder_run (alatFolderJalan.cjs) dengan program NYATA di folder sementara + larangan .git di
// alat tulis. Jalankan: node node_modules/.uji-rag/uji-alat-folder-jalan.cjs (dari folder frontend).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { jalankanAlatJalan, cariExe, envBersih } = require('../frontend/electron/alatFolderJalan.cjs');
const { jalankanAlatTulis } = require('../frontend/electron/alatFolderTulis.cjs');
console.log('uji-alat-folder-jalan v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      → ${JSON.stringify(rinci).slice(0, 400)}` : ''}`); if (!ok) gagal++; };

const induk = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-jalan-'));
const akar = path.join(induk, 'kerja');
fs.mkdirSync(akar);
fs.writeFileSync(path.join(akar, 'app.py'), 'total = sum([1, 2, 3])\nprint("TOTAL", total)\n');
fs.writeFileSync(path.join(akar, 'jejak.py'), 'open("jejak.txt", "w").write("x")\n');
fs.writeFileSync(path.join(akar, 'package.json'), JSON.stringify({ name: 'uji', version: '1.0.0', scripts: { hello: 'node -e "console.log(\'halo-npm\')"' } }));
fs.writeFileSync(path.join(induk, 'rahasia.txt'), 'RAHASIA');

const dialog = [];
const izinkan = { mintaIzin: async (p) => { dialog.push(p); return true; } };
const tolak = { mintaIzin: async (p) => { dialog.push(p); return false; } };
const jalan = (p, deps = izinkan) => jalankanAlatJalan(akar, { alat: 'folder_run', ...p }, deps);

(async () => {
  // 1. Jalan normal + dialog menampilkan perintah & isi skrip
  dialog.length = 0;
  let h = await jalan({ program: 'python', argumen: ['app.py'] });
  cek(h.ok && h.kodeKeluar === 0 && h.keluaran.includes('TOTAL 6'), 'python app.py → keluaran "TOTAL 6", kode 0', h);
  cek(dialog.length === 1 && dialog[0].judul.includes('python app.py') && dialog[0].pratinjau.includes('sum([1, 2, 3])') && /TIDAK dibatasi pagar/.test(dialog[0].rincian), 'dialog: perintah persis + isi skrip + peringatan tak terpagar', dialog[0]);
  h = await jalan({ program: 'python.exe', argumen: ['-c', 'import sys; sys.exit(3)'] });
  cek(h.ok && h.kodeKeluar === 3, 'kode keluar bukan 0 dilaporkan apa adanya (python.exe → python)', h);

  // 2. Tolak = tidak dijalankan
  h = await jalan({ program: 'python', argumen: ['jejak.py'] }, tolak);
  cek(!h.ok && h.ditolakOwner && !fs.existsSync(path.join(akar, 'jejak.txt')), 'Tolak → skrip TIDAK jalan (jejak.txt tak tercipta)', h);

  // 3. Program di luar daftar / shell → ditolak SEBELUM dialog
  const sebelum = dialog.length;
  const serangan = [
    [{ program: 'cmd', argumen: ['/c', 'dir'] }, 'cmd'],
    [{ program: 'powershell', argumen: ['-c', 'ls'] }, 'powershell'],
    [{ program: 'C:\\Windows\\System32\\cmd.exe', argumen: [] }, 'alamat program absolut'],
    [{ program: 'git', argumen: ['push'] }, 'git push'],
    [{ program: 'git', argumen: ['-c', 'core.pager=calc', 'status'] }, 'git opsi global -c'],
    [{ program: 'git', argumen: ['branch', '-D', 'main'] }, 'git branch -D'],
    [{ program: 'git', argumen: ['reset', '--hard'] }, 'git reset --hard'],
    [{ program: 'npm', argumen: ['publish'] }, 'npm publish'],
    [{ program: 'cargo', argumen: ['publish'] }, 'cargo publish'],
    [{ program: 'python', argumen: ['..\\rahasia.txt'] }, 'argumen ..\\ keluar folder'],
    [{ program: 'python', argumen: ['../rahasia.txt'] }, 'argumen ../ keluar folder'],
    [{ program: 'python', argumen: ['C:\\Windows\\win.ini'] }, 'argumen alamat absolut C:\\'],
    [{ program: 'python', argumen: ['\\\\server\\share\\x.py'] }, 'argumen UNC'],
    [{ program: 'git', argumen: ['diff', '--output=C:\\x.txt'] }, 'opsi --output'],
    [{ program: 'node', argumen: ['--require=D:\\x.js'] }, 'nilai --opsi=alamat absolut'],
    [{ program: 'python', argumen: ['-c', 'print(1)\nprint(2)'] }, 'argumen berbaris baru'],
    [{ program: 'python', argumen: 'app.py' }, 'argumen bukan daftar'],
    [{ program: '', argumen: [] }, 'program kosong'],
  ];
  for (const [p, nama] of serangan) {
    const r = await jalan(p);
    cek(!r.ok && !r.ditolakOwner, `ditolak: ${nama} — ${r.alasan}`, r);
  }
  cek(dialog.length === sebelum, `${serangan.length} permintaan ditolak tanpa dialog muncul`);

  // 4. Argumen relatif di dalam folder & "HEAD..main" tetap boleh
  h = await jalan({ program: 'python', argumen: ['sub/../app.py'] });
  cek(h.ok && h.keluaran.includes('TOTAL 6'), 'argumen sub/../app.py (tetap di dalam) → jalan', h);

  // 5. Tanpa shell: & | > diteruskan sebagai teks, bukan perintah kedua
  h = await jalan({ program: 'python', argumen: ['-c', 'import sys; print(sys.argv[1])', 'a & echo BOCOR > bocor.txt | calc'] });
  cek(h.ok && h.keluaran.trim() === 'a & echo BOCOR > bocor.txt | calc' && !fs.existsSync(path.join(akar, 'bocor.txt')), 'metakarakter shell = teks biasa (tak ada bocor.txt)', h);

  // 6. Program palsu di folder kerja tidak terpilih, walau folder itu di depan PATH
  fs.writeFileSync(path.join(akar, 'python.exe'), 'bukan program');
  const exe = cariExe('python', akar, { PATH: `${akar};.;${process.env.PATH}` });
  cek(exe && !exe.toLowerCase().startsWith(akar.toLowerCase()) && !/WindowsApps/i.test(exe), `python.exe palsu di folder kerja dilewati → ${exe}`);
  h = await jalankanAlatJalan(akar, { alat: 'folder_run', program: 'python', argumen: ['app.py'] }, { ...izinkan, env: { ...process.env, PATH: `${akar};${process.env.PATH}` } });
  cek(h.ok && h.keluaran.includes('TOTAL 6'), 'jalan dengan python asli walau PATH diawali folder kerja', h);
  fs.unlinkSync(path.join(akar, 'python.exe'));

  // 7. Rahasia dibuang dari lingkungan
  h = await jalankanAlatJalan(akar, { alat: 'folder_run', program: 'python', argumen: ['-c', "import os; print(os.environ.get('OPENROUTER_API_KEY'), os.environ.get('MY_TOKEN'), os.environ.get('SUPABASE_URL'), os.environ.get('SystemRoot') is not None)"] },
    { ...izinkan, env: { ...process.env, OPENROUTER_API_KEY: 'sk-or-uji', MY_TOKEN: 'tok-uji', SUPABASE_URL: 'https://x' } });
  cek(h.ok && h.keluaran.trim() === 'None None None True', 'OPENROUTER_API_KEY/MY_TOKEN/SUPABASE_URL tak terbaca skrip; SystemRoot tetap ada', h);
  cek(!('NODE_OPTIONS' in envBersih({ NODE_OPTIONS: '--require x', PATH: 'y' })), 'NODE_OPTIONS dibuang');

  // 8. UTF-8
  h = await jalan({ program: 'python', argumen: ['-c', "print('Rp é ✓ 😀')"] });
  cek(h.ok && h.keluaran.trim() === 'Rp é ✓ 😀', 'keluaran UTF-8 utuh', h);

  // 9. Batas keluaran
  h = await jalan({ program: 'python', argumen: ['-c', "print('x' * 50000)"] });
  cek(h.ok && h.terpotong && h.keluaran.length === 20 * 1024 && h.byteKeluaran > 50000, 'keluaran dipotong 20 KB, ukuran asli dilaporkan', { terpotong: h.terpotong, pj: h.keluaran?.length, byte: h.byteKeluaran });

  // 10. Batas waktu mematikan SELURUH pohon (cucu memegang pipa: tanpa taskkill /T "close" tak pernah datang)
  let t0 = Date.now();
  h = await jalan({ program: 'python', argumen: ['-c', "import subprocess, sys, time; subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)']); print('mulai', flush=True); time.sleep(60)"], waktu: 3 });
  cek(h.ok && h.habisWaktu && h.keluaran.includes('mulai') && Date.now() - t0 < 15000, `habis waktu 3 s → pohon proses dimatikan (${Date.now() - t0} ms)`, h);

  // 11. Satu perintah pada satu waktu (kunci dipasang sebelum dialog)
  t0 = Date.now();
  const [a, b] = await Promise.all([
    jalan({ program: 'python', argumen: ['-c', 'import time; time.sleep(2); print(1)'] }),
    jalan({ program: 'python', argumen: ['-c', 'print(2)'] }),
  ]);
  cek(a.ok && !b.ok && /masih berjalan/.test(b.alasan), 'permintaan kedua saat pertama berjalan → ditolak', [a.ok, b.alasan]);

  // 12. npm lewat node + npm-cli.js; dialog memuat script package.json; publish/install
  dialog.length = 0;
  h = await jalan({ program: 'npm', argumen: ['run', 'hello'], waktu: 120 });
  cek(h.ok && h.kodeKeluar === 0 && h.keluaran.includes('halo-npm'), 'npm run hello → "halo-npm"', h);
  cek(dialog[0]?.pratinjau.includes('hello: node -e'), 'dialog npm run memuat isi script dari package.json', dialog[0]?.pratinjau);
  dialog.length = 0;
  await jalan({ program: 'npm', argumen: ['install', 'left-pad'] }, tolak);
  cek(/MENGUNDUH/.test(dialog[0]?.rincian || ''), 'npm install → peringatan internet di dialog (ditolak, tak ada unduhan)');
  cek(!fs.existsSync(path.join(akar, 'node_modules')), 'npm install ditolak → node_modules tidak tercipta');

  // 13. git lokal: init, status
  h = await jalan({ program: 'git', argumen: ['init'] });
  cek(h.ok && h.kodeKeluar === 0 && fs.existsSync(path.join(akar, '.git')), 'git init → .git tercipta', h);
  h = await jalan({ program: 'git', argumen: ['status', '--short'] });
  cek(h.ok && h.kodeKeluar === 0 && h.keluaran.includes('app.py'), 'git status --short → app.py belum dilacak', h);
  h = await jalan({ program: 'git', argumen: ['commit', '-a'] });
  cek(h.ok && h.kodeKeluar !== 0 && !h.habisWaktu && Date.now() - t0 < 60000, 'git commit tanpa -m → gagal cepat (editor ":"), tidak menggantung', h);

  // 14. Program tak terpasang
  h = await jalan({ program: 'ruby', argumen: ['-v'] });
  cek(h.ok || /tidak terpasang/.test(h.alasan), `program tak terpasang → alasan jelas (${h.ok ? 'terpasang' : h.alasan})`);

  // 15. Alat tulis tak boleh menyentuh .git
  const tulisDeps = { mintaIzin: async () => true, keTempatSampah: async () => {} };
  const t1 = await jalankanAlatTulis(akar, { alat: 'folder_write', alamat: '.git/hooks/pre-commit', isi: 'calc' }, tulisDeps);
  const t2 = await jalankanAlatTulis(akar, { alat: 'folder_edit', alamat: '.GIT/config', cari: '[core]', ganti: '[core]\n\tfsmonitor = calc' }, tulisDeps);
  const t3 = await jalankanAlatTulis(akar, { alat: 'folder_rename', alamat: 'app.py', ke: '.git/hooks/post-commit' }, tulisDeps);
  const t4 = await jalankanAlatTulis(akar, { alat: 'folder_delete', alamat: '.git' }, tulisDeps);
  cek([t1, t2, t3, t4].every((x) => !x.ok && /\.git/.test(x.alasan)), 'tulis/edit/rename-ke/hapus di .git ditolak', [t1, t2, t3, t4].map((x) => x.alasan));
  cek(!fs.existsSync(path.join(akar, '.git', 'hooks', 'pre-commit')) && fs.existsSync(path.join(akar, 'app.py')), '.git utuh, app.py tetap di tempat');

  fs.rmSync(induk, { recursive: true, force: true });
  console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
  process.exit(gagal ? 1 : 0);
})();
