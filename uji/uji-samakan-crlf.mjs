
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
const S = await import(pathToFileURL(`${AKAR}/scripts/samakan-crlf.mjs`).href + '?v=' + Date.now());

console.log('uji-samakan-crlf v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

console.log('\n-- LF menjadi CRLF --');

let h = S.keCRLF('satu\ndua\ntiga');
cek(h.teks === 'satu\r\ndua\r\ntiga', 'LF murni jadi CRLF', JSON.stringify(h.teks));
cek(h.diubah === 2, 'jumlah baris yang diubah dihitung benar', h.diubah);

console.log('\n-- tidak merusak yang sudah CRLF --');

h = S.keCRLF('satu\r\ndua\r\ntiga');
cek(h.teks === 'satu\r\ndua\r\ntiga', 'CRLF dibiarkan apa adanya — tidak jadi \\r\\r\\n', JSON.stringify(h.teks));
cek(h.diubah === 0, 'berkas yang sudah benar dilaporkan 0 perubahan — jadi tidak ikut ditulis ulang');

h = S.keCRLF('a\r\nb\nc\r\nd');
cek(h.teks === 'a\r\nb\r\nc\r\nd', 'berkas campuran jadi seragam CRLF', JSON.stringify(h.teks));
cek(h.diubah === 1, 'hanya LF yang berdiri sendiri yang dihitung', h.diubah);

const sekali = S.keCRLF('x\ny\nz').teks;
const duakali = S.keCRLF(sekali);
cek(duakali.teks === sekali && duakali.diubah === 0, 'dijalankan dua kali hasilnya sama — idempoten', duakali.diubah);

for (const t of ['', 'tanpa baris baru', '\n', '\r\n']) {
  const r = S.keCRLF(t);
  cek(typeof r.teks === 'string', `masukan tepi ${JSON.stringify(t)} tidak melempar`, r);
}
cek(S.keCRLF('\n').teks === '\r\n', 'satu LF saja tetap diubah');
cek(S.keCRLF('').diubah === 0, 'teks kosong tidak dihitung berubah');

console.log('\n-- biner dilewati --');

cek(S.tampakBiner(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x0a])) === true, 'byte NUL → dianggap biner');
cek(S.tampakBiner(Buffer.from('teks biasa\nbaris dua', 'utf8')) === false, 'teks biasa → bukan biner');
cek(S.tampakBiner(Buffer.from('huruf beraksen: é à ü\n', 'utf8')) === false, 'UTF-8 beraksen tetap teks, bukan biner');
cek(S.tampakBiner(Buffer.alloc(0)) === false, 'berkas kosong bukan biner');

const panjang = Buffer.concat([Buffer.alloc(9000, 0x41), Buffer.from([0x00])]);
cek(S.tampakBiner(panjang) === false, 'NUL di luar 8000 byte pertama tidak terdeteksi — batas yang disengaja, sama dengan git');

console.log('\n-- skripnya sendiri --');

const SRC = readFileSync(`${AKAR}/scripts/samakan-crlf.mjs`, 'utf8');
cek(/--periksa/.test(SRC), 'punya mode --periksa yang tidak menulis apa pun');
cek(/process\.exit\(PERIKSA_SAJA && disamakan \? 1 : 0\)/.test(SRC),
  'mode --periksa keluar 1 bila ada yang belum CRLF — bisa dipakai sebagai penjaga');
cek(/if \(tampakBiner\(buf\)\) \{ dilewati\+\+; continue; \}/.test(SRC), 'biner dilewati di jalur yang sungguhan');
cek(/if \(!diubah\) continue;/.test(SRC), 'berkas yang sudah benar tidak ditulis ulang sama sekali');
cek(/git', \['status', '--porcelain'/.test(SRC),
  'bawaannya hanya berkas berubah/baru — berkas ter-gitignore tidak ikut tersentuh');

cek(!/path\.resolve\(process\.argv\[1\]\)\.endsWith\(/.test(SRC),
  'penjaga TIDAK dipakai lewat endsWith — itu ikut cocok dengan nama berkas uji');
cek(/path\.resolve\(process\.argv\[1\]\) === path\.resolve\(fileURLToPath\(import\.meta\.url\)\)/.test(SRC),
  'penjaga mencocokkan alamat modulnya SENDIRI', (SRC.match(/if \(process\.argv\[1\][^\n]*/g) || []));

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
