const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
console.log('uji-checkpoint-engineer v2');
let gagal = 0;
const cek = (ok, pesan, rinci) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      → ${JSON.stringify(rinci).slice(0, 300)}` : ''}`); if (!ok) gagal++; };

const main = fs.readFileSync(path.join(__dirname, '../frontend/electron/main.cjs'), 'utf8');
const awal = main.indexOf("const { alamatDalamPagar: pagarRepo }");
const akhir = main.indexOf("ipcMain.handle('select-folder'");
const blok = main.slice(awal, akhir);
cek(awal > 0 && !/git stash|exec\(/.test(blok.replace(/^\s*\/\/.*$/gm, '')), 'blok checkpoint tanpa git stash / exec (di luar komentar)');

const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-cp-'));
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-cp-data-'));
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' });
git('init', '-q');
fs.mkdirSync(path.join(repo, 'src'));
const asliTarget = 'baris 1\r\nbaris 2 — é ✓\r\n';
fs.writeFileSync(path.join(repo, 'src', 'target.js'), asliTarget);
fs.writeFileSync(path.join(repo, 'src', 'lain.js'), 'awal\n');
git('add', '.'); git('-c', 'user.name=u', '-c', 'user.email=u@u', 'commit', '-qm', 'awal');
fs.writeFileSync(path.join(repo, 'src', 'lain.js'), 'PEKERJAAN OWNER BELUM DI-COMMIT\n');

const handler = {};
let jawabDialog = 1;
const dialogDicatat = [];
const tiruan = {
  ipcMain: { handle: (nama, fn) => { handler[nama] = fn; } },
  dialog: { showMessageBox: async (_w, o) => { dialogDicatat.push(o); return { response: jawabDialog }; } },
  shell: { trashItem: async (a) => fs.rmSync(a) },
  app: { getPath: () => userData },
};
let akarDipilih = repo;
const akarRepo = () => akarDipilih;
const butuhAkarRepo = () => (akarDipilih ? null : { success: false, error: 'Akar repo belum dipilih. Buka Pengaturan → Engineer → Pilih folder repo', akarBelumDipilih: true });
const jalankan = new Function('require', 'path', 'fs', 'akarRepo', 'butuhAkarRepo', 'ipcMain', 'dialog', 'shell', 'app', 'mainWindow', blok);
jalankan((m) => (m === './pagarFolder.cjs' ? require('../frontend/electron/pagarFolder.cjs') : require(m)), path, fs, akarRepo, butuhAkarRepo,
  tiruan.ipcMain, tiruan.dialog, tiruan.shell, tiruan.app, null);

(async () => {
  let cp = await handler['eng:git-checkpoint'](null, { taskId: 'TASK-1', files: ['src/target.js', 'src/baru.js'] });
  cek(cp.success && cp.ref === 'ENG-CHECKPOINT-TASK-1', 'checkpoint dibuat', cp);
  cek(fs.readFileSync(path.join(repo, 'src', 'lain.js'), 'utf8') === 'PEKERJAAN OWNER BELUM DI-COMMIT\n' && git('stash', 'list') === '', 'pekerjaan lain TETAP di disk, git stash tak disentuh');

  fs.writeFileSync(path.join(repo, 'src', 'target.js'), 'DIUBAH PATCH\n');
  fs.writeFileSync(path.join(repo, 'src', 'baru.js'), 'berkas baru dari patch\n');
  fs.writeFileSync(path.join(repo, 'src', 'lain.js'), 'OWNER LANJUT BEKERJA\n');

  jawabDialog = 0;
  let rb = await handler['eng:git-rollback'](null, { checkpointLabel: cp.ref });
  cek(rb.cancelled && fs.readFileSync(path.join(repo, 'src', 'target.js'), 'utf8') === 'DIUBAH PATCH\n', 'Batal di dialog → tidak ada yang dikembalikan');
  cek(/src.target\.js/.test(dialogDicatat[0].detail) && /Recycle Bin/.test(dialogDicatat[0].detail), 'dialog menyebut berkas & berkas baru → Recycle Bin', dialogDicatat[0].detail);

  jawabDialog = 1;
  rb = await handler['eng:git-rollback'](null, { checkpointLabel: cp.ref });
  cek(rb.success, 'rollback berhasil', rb);
  cek(fs.readFileSync(path.join(repo, 'src', 'target.js'), 'utf8') === asliTarget, 'target kembali byte persis (CRLF + UTF-8)');
  cek(!fs.existsSync(path.join(repo, 'src', 'baru.js')), 'berkas baru dari patch disingkirkan');
  cek(fs.readFileSync(path.join(repo, 'src', 'lain.js'), 'utf8') === 'OWNER LANJUT BEKERJA\n', 'pekerjaan Owner di berkas lain TIDAK disentuh rollback');
  cek(!fs.existsSync(path.join(userData, 'eng-checkpoint', 'ENG-CHECKPOINT-TASK-1.json')), 'checkpoint terpakai dihapus (tak bisa dikembalikan dua kali)');
  rb = await handler['eng:git-rollback'](null, { checkpointLabel: cp.ref });
  cek(!rb.success && /tidak ditemukan/.test(rb.error), 'rollback kedua → "tidak ditemukan"', rb);

  for (const [files, nama] of [[['../luar.js'], '..'], [['C:\\Windows\\win.ini'], 'absolut'], [[], 'kosong'], [Array.from({ length: 11 }, (_, i) => `src/f${i}.js`), '>10 berkas']]) {
    const r = await handler['eng:git-checkpoint'](null, { taskId: 'X', files });
    cek(!r.success, `checkpoint ditolak: ${nama} — ${r.error}`);
  }
  const r = await handler['eng:git-checkpoint'](null, { taskId: 'a"; rm -rf /', files: ['src/target.js'] });
  cek(r.success && r.ref === 'ENG-CHECKPOINT-arm-rf', 'label dibersihkan (tak ada karakter shell)', r);
  const tanpaLabel = await handler['eng:git-rollback'](null, {});
  cek(tanpaLabel.success, 'rollback tanpa label → checkpoint terbaru', tanpaLabel);

  akarDipilih = null;
  const cpMati = await handler['eng:git-checkpoint'](null, { taskId: 'TASK-X', files: ['src/target.js'] });
  cek(cpMati.success === false && cpMati.akarBelumDipilih === true,
    'akar belum dipilih → checkpoint menolak, tidak menyentuh disk', cpMati);
  cek(/Pengaturan|pilih/i.test(String(cpMati.error)), 'alasannya memberi tahu apa yang harus dilakukan', cpMati.error);
  const rbMati = await handler['eng:git-rollback'](null, { checkpointLabel: 'ENG-CHECKPOINT-TASK-1' });
  cek(rbMati.success === false && rbMati.akarBelumDipilih === true, 'rollback ikut menolak', rbMati);
  akarDipilih = repo;

  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(userData, { recursive: true, force: true });
  console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
  process.exit(gagal ? 1 : 0);
})();
