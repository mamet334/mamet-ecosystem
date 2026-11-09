
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
const P = await import(pathToFileURL(`${AKAR}/frontend/src/core/runtime/services/engineer/ProsedurEngineer.js`).href + '?v=' + Date.now());
const { petunjukGrepSebagian } = P;

console.log('uji-grep-sebagian-dan-gembok v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const hasil = (keluaran) => ({ ok: true, keluaran });
const TIGA = 'a.js:1:satu\na.js:9:dua\nb.js:4:tiga';

console.log('\n-- menyala pada grep polos --');
{
  const t = petunjukGrepSebagian('git grep -n "capability" -- frontend/src', hasil(TIGA));
  cek(!!t, 'grep tanpa konteks → ada petunjuk');
  cek(/3 BARIS YANG COCOK/.test(t), 'menyebut JUMLAH baris yang benar-benar dilihat model', t);
  cek(/bukan isi berkasnya/.test(t), 'menyatakan tegas itu bukan isi berkas');
  cek(/git grep -n -B2 -A4/.test(t) && /git blame -L/.test(t),
    'memberi CARA keluarnya, bukan sekadar melarang menyimpulkan (pola dua penjaga sebelumnya)', t);
  cek(/ADA\/TIDAKNYA pola itu, hasil ini sudah cukup/.test(t),
    'TIDAK melarang kesimpulan yang memang sah dari grep — kalau tidak, penjaganya jadi gangguan', t);
}

console.log('\n-- diam ketika tak perlu --');
for (const p of [
  'git grep -n -A4 "pola" -- frontend/src',
  'git grep -n -B2 -A4 "pola" -- frontend/src',
  'git grep -n -C3 "pola" -- frontend/src',
  'git grep -n --context=3 "pola" -- frontend/src',
]) cek(petunjukGrepSebagian(p, hasil(TIGA)) === null, `sudah minta konteks → diam: ${p}`);

for (const p of [
  `git grep -c "" -- frontend/src`,
  'git grep -l "pola" -- frontend/src',
  'git grep --count "pola" -- frontend/src',
  'git grep --files-with-matches "pola" -- frontend/src',
]) cek(petunjukGrepSebagian(p, hasil('a.js:3')) === null, `hanya menghitung/mendaftar → diam: ${p}`);

cek(petunjukGrepSebagian('git show HEAD:frontend/src/a.js', hasil('isi')) === null, 'bukan grep → diam');
cek(petunjukGrepSebagian('git grep -n "x" -- src', hasil('')) === null, 'keluaran kosong → diam (sudah ada penjaganya sendiri)');
cek(petunjukGrepSebagian('git grep -n "x" -- src', { ok: false, keluaran: TIGA }) === null, 'perintah gagal → diam');
cek(petunjukGrepSebagian(null, null) === null, 'argumen kosong aman');

console.log('\n-- terpasang --');
{
  const AS = readFileSync(`${AKAR}/frontend/src/core/runtime/services/AssistantService.js`, 'utf8').replace(/\r\n/g, '\n');
  const KODE = AS.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');
  cek(/petunjukGrepSebagian,/.test(KODE) || /petunjukGrepSebagian \}/.test(KODE), 'diimpor AssistantService');
  cek(/const petunjukGrep = petunjukGrepSebagian\(perintah, h\);/.test(KODE), 'dipanggil pada hasil perintah');
  cek(/if \(petunjukGrep\) output \+= /.test(KODE), 'ditempel ke keluaran yang dikirim ke model');

  const iPotong = KODE.indexOf('petunjukKeluaranTerpotong(perintah, h)');
  const iGrep = KODE.indexOf('petunjukGrepSebagian(perintah, h)');
  cek(iPotong > 0 && iGrep > iPotong, 'ditambahkan SESUDAH penjaga pemotongan, bukan menggantikannya');
}

console.log('\n-- dua arti gembok dipisah --');
{
  const CE = readFileSync(`${AKAR}/frontend/src/components/workbench/ConversationEngine.jsx`, 'utf8').replace(/\r\n/g, '\n');
  const KODE = CE.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

  cek(!/\(ditolakAturan \|\| ditolakProsedur\) \? 'blocked'/.test(KODE),
    'kedua penolakan tidak lagi disatukan jadi satu keadaan', (KODE.match(/.*ditolakProsedur.*/g) || []));
  cek(/ditolakProsedur \? 'diulang' : ditolakAturan \? 'blocked'/.test(KODE),
    "pengulangan punya keadaan sendiri ('diulang'), larangan tetap 'blocked'");

  const iUlang = KODE.indexOf("state.status === 'diulang'");
  cek(iUlang > 0, 'keadaan diulang digambar di layar');
  const blok = KODE.slice(iUlang, iUlang + 700);
  cek(/Sudah dijalankan di percakapan ini/.test(blok), 'kalimatnya netral: sudah dijalankan, bukan dilarang', blok.slice(0, 200));
  cek(/Perintahnya boleh/.test(blok), 'menegaskan perintahnya BOLEH — ini inti kekeliruan yang diperbaiki');
  cek(!/Jalankan sendiri di terminal/.test(blok),
    'tidak lagi menyuruh Owner ke terminal untuk sesuatu yang hasilnya sudah ada di layar');

  const iBlok = KODE.indexOf("state.status === 'blocked'");
  const blokLarangan = KODE.slice(iBlok, iBlok + 500);
  cek(/Tidak diizinkan untuk Engineer/.test(blokLarangan), 'larangan sungguhan tetap tegas');
  cek(/material-symbols-outlined[^>]*>lock</.test(blokLarangan.replace(/\s+/g, ' ')) || /lock/.test(blokLarangan),
    'larangan sungguhan tetap memakai gembok');

  const subset = new Set(readFileSync(`${AKAR}/frontend/src/assets/fonts/daftar-ikon.txt`, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
  const ikon = (blok.match(/material-symbols-outlined[^>]*>\s*([a-z0-9_]+)\s*</) || [])[1];
  cek(!!ikon && subset.has(ikon), `ikon keadaan diulang ("${ikon}") ada di subset font`);
  cek(ikon !== 'lock', 'ikonnya BERBEDA dari gembok — kalau sama, pemisahannya tak terlihat Owner');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
