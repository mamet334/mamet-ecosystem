
const AKAR_REPO = require('node:path').resolve(__dirname, '..').replace(/\\/g, '/');
const path = require('path');
const fs = require('fs');
const os = require('os');

const AKAR = AKAR_REPO;
const R = require(path.join(AKAR, 'frontend/electron/akarRepo.cjs'));

console.log('uji-akar-repo v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const sesi = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-akar-repo-'));
const buat = (nama, { git }) => {
  const p = path.join(sesi, nama);
  fs.mkdirSync(p, { recursive: true });
  if (git) fs.mkdirSync(path.join(p, '.git'), { recursive: true });
  return p;
};
const repoSah = buat('repo-sah', { git: true });
const bukanRepo = buat('bukan-repo', { git: false });
const instalasi = buat('Program Files/Mamet AI', { git: false });
const repoDiInstalasi = buat('Program Files/Mamet AI/resources/repo', { git: true });

console.log('\n-- penjaga 1: wajib repo git --');
const sah = R.akarRepoSah(repoSah, {});
cek(sah.ok === true, 'folder dengan .git diterima', sah);
cek(sah.ok && sah.nama === 'repo-sah', 'nama folder ikut dikembalikan', sah.nama);

const tanpaGit = R.akarRepoSah(bukanRepo, {});
cek(tanpaGit.ok === false, 'folder TANPA .git ditolak', tanpaGit);
cek(!tanpaGit.ok && /git/i.test(tanpaGit.alasan) && /checkpoint|rollback/i.test(tanpaGit.alasan),
  'alasannya menyebut git DAN kenapa itu penting — bukan galat mentah', tanpaGit.alasan);

console.log('\n-- penjaga 2: tolak folder instalasi --');
const diInstalasi = R.akarRepoSah(repoDiInstalasi, { folderInstalasi: instalasi });
cek(diInstalasi.ok === false, 'repo DI DALAM folder instalasi ditolak walaupun punya .git', diInstalasi);
cek(!diInstalasi.ok && /uninstall|update/i.test(diInstalasi.alasan),
  'alasannya menyebut uninstall/update — akibat yang datang tanpa suara', diInstalasi.alasan);

cek(R.akarRepoSah(instalasi, { folderInstalasi: instalasi }).ok === false,
  'folder instalasi itu sendiri ditolak');
cek(R.akarRepoSah(repoSah, { folderInstalasi: instalasi }).ok === true,
  'repo DI LUAR folder instalasi tetap diterima');
cek(R.akarRepoSah(repoSah, {}).ok === true,
  'tanpa folderInstalasi (mode pengembangan) pemeriksaan itu dilewati, bukan menolak semua');

console.log('\n-- pagar dasar dipakai ulang (Item 85) --');
cek(R.akarRepoSah('', {}).ok === false, 'folder kosong ditolak');
cek(R.akarRepoSah(path.join(sesi, 'tidak-ada'), {}).ok === false, 'folder tidak ada ditolak');
const berkasBiasa = path.join(sesi, 'berkas.txt');
fs.writeFileSync(berkasBiasa, 'x');
cek(R.akarRepoSah(berkasBiasa, {}).ok === false, 'berkas (bukan folder) ditolak');
cek(R.akarRepoSah(path.parse(sesi).root, {}).ok === false, 'akar drive ditolak — terlalu luas');

console.log('\n-- diDalam --');
cek(R.diDalam('C:\\a', 'C:\\a\\b') === true, 'anak di dalam induk');
cek(R.diDalam('C:\\a', 'C:\\a') === true, 'folder yang sama dianggap di dalam');
cek(R.diDalam('C:\\a', 'C:\\b') === false, 'folder lain bukan di dalam');
cek(R.diDalam('C:\\a', 'C:\\ab') === false, 'awalan nama yang mirip TIDAK dianggap di dalam');

console.log('\n-- akar aktif --');
const dev = R.akarRepoAktif({ dev: true, akarDev: 'C:\\repo', tersimpan: null });
cek(dev.akar === 'C:\\repo' && dev.sumber === 'pengembangan',
  'npm run desktop: pakai folder induk apa adanya — Owner tak perlu memilih yang sudah pasti', dev);

const terpasang = R.akarRepoAktif({ dev: false, akarDev: 'C:\\resources\\app.asar', tersimpan: 'D:\\repo' });
cek(terpasang.akar === 'D:\\repo' && terpasang.sumber === 'pilihan-owner',
  'aplikasi terpasang: pilihan Owner menang, BUKAN folder induk main.cjs', terpasang);

const belum = R.akarRepoAktif({ dev: false, akarDev: 'C:\\resources\\app.asar', tersimpan: null });
cek(belum.akar === null && belum.sumber === 'belum-dipilih',
  'belum dipilih → TIDAK jatuh ke folder instalasi (inilah bug 23 September)', belum);
cek(belum.alasan.length > 40 && /Pengaturan|pilih/i.test(belum.alasan),
  'alasannya memberi tahu apa yang harus dilakukan, bukan galat git mentah', belum.alasan);

for (const akarDev of ['C:\\resources\\app.asar', 'C:\\Program Files\\Mamet AI', '', null]) {
  const h = R.akarRepoAktif({ dev: false, akarDev, tersimpan: null });
  cek(h.akar === null, `terpasang & belum dipilih → akar null (akarDev=${JSON.stringify(akarDev)})`, h);
}

fs.rmSync(sesi, { recursive: true, force: true });
console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
