import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { createRequire } from 'node:module';
const require = createRequire(AKAR_REPO + '/frontend/');
const AKAR = AKAR_REPO;
const { jalankanAlatJalan, pecahPerintah, PROFIL } = require(AKAR + '/frontend/electron/alatFolderJalan.cjs');
console.log('uji-peringatan-skrip v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

function dialogPalsu() {
  const catatan = {};
  return {
    catatan,
    deps: {
      profil: PROFIL.engineer,
      mintaIzin: async (x) => { Object.assign(catatan, x); return false; },
    },
  };
}
async function lewatDialog(teks) {
  const p = pecahPerintah(teks);
  if (p.galat) return { galat: p.galat };
  const d = dialogPalsu();
  await jalankanAlatJalan(AKAR, { alat: 'folder_run', program: p.program, argumen: p.argumen }, d.deps);
  return d.catatan;
}

let c = await lewatDialog(`node -e "const fs=require('fs');console.log(fs.readFileSync('package.json','utf8').length)"`);
cek(!/SKRIP SEBARIS INI TAMPAK/.test(c.rincian || ''), 'skrip baca-saja → tanpa peringatan menulis', c.rincian);
cek(/Isi skrip yang akan dijalankan/.test(c.pratinjau || ''), 'isi skrip tetap ditampilkan utuh di dialog', c.pratinjau);
cek(/readFileSync/.test(c.pratinjau || ''), 'isinya benar-benar skripnya, bukan ringkasan');

c = await lewatDialog(`node -e "require('fs').writeFileSync('x.txt','halo')"`);
cek(/SKRIP SEBARIS INI TAMPAK: .*menulis berkas/.test(c.rincian || ''), 'writeFileSync → ditandai "menulis berkas"', c.rincian);
cek(/hak penuh Anda/.test(c.rincian || ''), 'peringatan menyebut skrip berjalan dengan hak penuh Owner');

c = await lewatDialog(`python -c "import os; os.remove('x.txt')"`);
cek(/menghapus berkas/.test(c.rincian || ''), 'os.remove → ditandai "menghapus berkas"', c.rincian);

c = await lewatDialog(`node -e "fetch('https://contoh.test/kirim',{method:'POST'})"`);
cek(/menghubungi jaringan/.test(c.rincian || ''), 'fetch ke internet → ditandai "menghubungi jaringan"', c.rincian);

c = await lewatDialog(`node -e "require('child_process').execSync('whoami')"`);
cek(/menjalankan program lain/.test(c.rincian || ''), 'child_process → ditandai "menjalankan program lain"', c.rincian);

c = await lewatDialog('git status');
cek(Object.keys(c).length === 0, 'git yang MEMBACA tidak membuka dialog sama sekali', c);

c = await lewatDialog('node skrip-contoh.js');
cek(!/SKRIP SEBARIS/.test(c.rincian || ''), 'perintah biasa tidak diberi peringatan skrip', c.rincian);
cek(/Folder asal/.test(c.rincian || ''), 'rincian dialog yang lama tetap ada', c.rincian);

const p = pecahPerintah(`node -e "require('fs').writeFileSync('jangan-sampai-ada.txt','x')"`);
const d = dialogPalsu();
const h = await jalankanAlatJalan(AKAR, { alat: 'folder_run', program: p.program, argumen: p.argumen }, d.deps);
cek(h.ok === false && h.ditolakOwner === true, 'dialog ditolak → perintah tidak dijalankan', h);
const { existsSync } = require('fs');
cek(!existsSync(AKAR + '/jangan-sampai-ada.txt'), 'tidak ada berkas yang lahir dari uji ini');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
