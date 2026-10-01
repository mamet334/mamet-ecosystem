// UJI 2026-10-01 — skrip penyama akhir baris (scripts/samakan-crlf.mjs).
//
// Skrip ini MENULIS ULANG berkas sumber. Itu membuatnya berbeda dari skrip lain di repo ini: kalau ia
// salah, ia tidak gagal — ia MERUSAK, diam-diam, di banyak berkas sekaligus. Karena itu diuji.
//
// Kenapa skrip ini ada: repo `core.autocrlf=true` tanpa `.gitattributes`, jadi git menyimpan LF tetapi
// meng-checkout CRLF. Alat sunting AI menulis LF → tiap berkas yang disunting keluar dari bentuk
// checkout-nya, dan `PatchGenerator` yang mencocokkan teks pada salinan kerja ber-CRLF gagal mencocokkan
// satu pun baris (kegagalan live 24 September, dijaga `uji-patch-crlf.mjs`).

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const S = await import(pathToFileURL(`${AKAR}/scripts/samakan-crlf.mjs`).href + '?v=' + Date.now());

console.log('uji-samakan-crlf v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. Mengubah yang perlu diubah ────────────────────────────────────────────────────────────
console.log('\n-- LF menjadi CRLF --');

let h = S.keCRLF('satu\ndua\ntiga');
cek(h.teks === 'satu\r\ndua\r\ntiga', 'LF murni jadi CRLF', JSON.stringify(h.teks));
cek(h.diubah === 2, 'jumlah baris yang diubah dihitung benar', h.diubah);

// ── 2. TIDAK merusak yang sudah benar — ini bagian terpenting ────────────────────────────────
// Tanpa penjagaan ini, berkas yang sudah CRLF akan berakhir "\r\r\n" dan rusak di setiap baris.
console.log('\n-- tidak merusak yang sudah CRLF --');

h = S.keCRLF('satu\r\ndua\r\ntiga');
cek(h.teks === 'satu\r\ndua\r\ntiga', 'CRLF dibiarkan apa adanya — tidak jadi \\r\\r\\n', JSON.stringify(h.teks));
cek(h.diubah === 0, 'berkas yang sudah benar dilaporkan 0 perubahan — jadi tidak ikut ditulis ulang');

// Campuran: hanya yang LF yang diubah.
h = S.keCRLF('a\r\nb\nc\r\nd');
cek(h.teks === 'a\r\nb\r\nc\r\nd', 'berkas campuran jadi seragam CRLF', JSON.stringify(h.teks));
cek(h.diubah === 1, 'hanya LF yang berdiri sendiri yang dihitung', h.diubah);

// Menjalankannya dua kali tidak boleh mengubah apa pun lagi (idempoten).
const sekali = S.keCRLF('x\ny\nz').teks;
const duakali = S.keCRLF(sekali);
cek(duakali.teks === sekali && duakali.diubah === 0, 'dijalankan dua kali hasilnya sama — idempoten', duakali.diubah);

// Hal-hal tepi yang tidak boleh melempar.
for (const t of ['', 'tanpa baris baru', '\n', '\r\n']) {
  const r = S.keCRLF(t);
  cek(typeof r.teks === 'string', `masukan tepi ${JSON.stringify(t)} tidak melempar`, r);
}
cek(S.keCRLF('\n').teks === '\r\n', 'satu LF saja tetap diubah');
cek(S.keCRLF('').diubah === 0, 'teks kosong tidak dihitung berubah');

// ── 3. Berkas biner tidak boleh disentuh ─────────────────────────────────────────────────────
// Mengubah 0x0A di dalam berkas biner merusak isinya. Dikenali dari byte NUL, cara yang sama dipakai git.
console.log('\n-- biner dilewati --');

cek(S.tampakBiner(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x0a])) === true, 'byte NUL → dianggap biner');
cek(S.tampakBiner(Buffer.from('teks biasa\nbaris dua', 'utf8')) === false, 'teks biasa → bukan biner');
cek(S.tampakBiner(Buffer.from('huruf beraksen: é à ü\n', 'utf8')) === false, 'UTF-8 beraksen tetap teks, bukan biner');
cek(S.tampakBiner(Buffer.alloc(0)) === false, 'berkas kosong bukan biner');

// Byte NUL jauh di belakang tidak terdeteksi (hanya 8000 byte pertama yang dipindai) — batas yang
// disengaja dan sama dengan git. Disebut di sini supaya tidak dikira cacat.
const panjang = Buffer.concat([Buffer.alloc(9000, 0x41), Buffer.from([0x00])]);
cek(S.tampakBiner(panjang) === false, 'NUL di luar 8000 byte pertama tidak terdeteksi — batas yang disengaja, sama dengan git');

// ── 4. Berkas skripnya sendiri ───────────────────────────────────────────────────────────────
console.log('\n-- skripnya sendiri --');

const SRC = readFileSync(`${AKAR}/scripts/samakan-crlf.mjs`, 'utf8');
cek(/--periksa/.test(SRC), 'punya mode --periksa yang tidak menulis apa pun');
cek(/process\.exit\(PERIKSA_SAJA && disamakan \? 1 : 0\)/.test(SRC),
  'mode --periksa keluar 1 bila ada yang belum CRLF — bisa dipakai sebagai penjaga');
cek(/if \(tampakBiner\(buf\)\) \{ dilewati\+\+; continue; \}/.test(SRC), 'biner dilewati di jalur yang sungguhan');
cek(/if \(!diubah\) continue;/.test(SRC), 'berkas yang sudah benar tidak ditulis ulang sama sekali');
cek(/git', \['status', '--porcelain'/.test(SRC),
  'bawaannya hanya berkas berubah/baru — berkas ter-gitignore tidak ikut tersentuh');

// CACAT NYATA versi pertama, tertangkap saat uji ini pertama dijalankan: penjaganya memakai
// `endsWith('samakan-crlf.mjs')`, dan nama berkas uji ini JUGA berakhiran itu — jadi skripnya ikut
// berjalan dan menulisi berkas hanya karena diimpor. Untuk skrip yang menulis ulang berkas sumber,
// penjaga yang hampir benar sama saja dengan tidak ada penjaga.
// Yang diperiksa PEMAKAIANNYA, bukan penyebutannya — komentar penjelas di skrip itu tetap menyebut
// `endsWith`, dan versi pertama asersi ini merah karena tertipu komentarnya sendiri. Bentuk kegagalan
// yang sama persis menipu `uji-konteks-chat` pada 28 September.
cek(!/path\.resolve\(process\.argv\[1\]\)\.endsWith\(/.test(SRC),
  'penjaga TIDAK dipakai lewat endsWith — itu ikut cocok dengan nama berkas uji');
cek(/path\.resolve\(process\.argv\[1\]\) === path\.resolve\(fileURLToPath\(import\.meta\.url\)\)/.test(SRC),
  'penjaga mencocokkan alamat modulnya SENDIRI', (SRC.match(/if \(process\.argv\[1\][^\n]*/g) || []));

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
