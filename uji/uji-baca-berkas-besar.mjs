// uji-baca-berkas-besar v1 — Engineer membaca berkas > 20 KB (2026-09-28)
//
// Masalah live: TMN-0001 menunjuk komentar di `engineer.js` sekitar baris 1035. Engineer menjalankan
// `git show HEAD:…`, menerima 20 KB pertama dari 47.767 bita, TAHU keluarannya terpotong — ia
// menuliskannya sendiri — lalu mengarang perintah `python` untuk menelusuri filesystem mencari berkas
// yang alamatnya sudah ia ketahui. Yang kurang bukan kesadaran, melainkan JALAN KELUARNYA.
//
// Uji ini tiga lapis:
//   1. UJI KENDALI di repo SUNGGUHAN — buktikan pembacaan utuh memang melewati batas, dan kedua
//      perintah alternatif memang jauh lebih kecil serta MENJANGKAU baris yang tadinya mustahil.
//   2. Fungsi murni `petunjukKeluaranTerpotong` — kapan menyala, kapan diam.
//   3. TERPASANG — petunjuknya benar-benar dipanggil di jalur perintah AssistantService,
//      dan kedua perintah itu benar-benar diizinkan profil Engineer.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const P = await import(pathToFileURL(AKAR + '/frontend/src/core/runtime/services/engineer/ProsedurEngineer.js').href + '?v=' + Date.now());

console.log('uji-baca-berkas-besar v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const BATAS_KELUARAN = 20 * 1024;           // alatFolderJalan.cjs: keluaranByte
const BERKAS = 'frontend/src/core/runtime/services/engineer.js';
const git = (...a) => execFileSync('git', a, { cwd: AKAR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ── 1. UJI KENDALI di repo sungguhan ─────────────────────────────────────────────────────────
console.log('\n-- kendali: ukuran nyata di repo ini --');
const utuh = git('show', `HEAD:${BERKAS}`);
cek(utuh.length > BATAS_KELUARAN,
  `KENDALI: pembacaan utuh MELEWATI batas 20 KB (${utuh.length.toLocaleString('id-ID')} bita) — inilah sebab kegagalannya`,
  utuh.length);

// Baris yang dicari TMN-0001 ada di luar 20 KB pertama → mustahil dijangkau pembacaan utuh.
const posisi = utuh.indexOf('dihapus total');
cek(posisi > BATAS_KELUARAN,
  `KENDALI: baris yang dicari ada di bita ke-${posisi.toLocaleString('id-ID')} — di LUAR 20 KB pertama, jadi tak pernah sampai`,
  posisi);

const hasilGrep = git('grep', '-n', '-B2', '-A4', 'dihapus total', '--', BERKAS);
cek(hasilGrep.length < BATAS_KELUARAN, `git grep muat dalam batas (${hasilGrep.length} bita)`, hasilGrep.length);
cek(/engineer\.js:\d+:/.test(hasilGrep), 'git grep mengembalikan NOMOR BARIS');
cek(hasilGrep.includes('dihapus total'), 'git grep MENJANGKAU baris yang pembacaan utuh tidak bisa capai');
cek(utuh.length / hasilGrep.length > 20,
  `git grep puluhan kali lebih kecil (${Math.round(utuh.length / hasilGrep.length)}×)`,
  Math.round(utuh.length / hasilGrep.length));

const nomor = Number(/engineer\.js:(\d+):/.exec(hasilGrep)[1]);
const hasilBlame = git('blame', '-L', `${nomor - 1},${nomor + 4}`, '--', BERKAS);
cek(hasilBlame.length < BATAS_KELUARAN, `git blame -L muat dalam batas (${hasilBlame.length} bita)`, hasilBlame.length);
cek(hasilBlame.includes('dihapus total'), 'git blame -L membaca rentang baris yang diminta');

// ── 2. Petunjuk: kapan menyala, kapan diam ───────────────────────────────────────────────────
console.log('\n-- petunjuk keluaran terpotong --');
const terpotong = { terpotong: true, byteKeluaran: 47767 };
const p = P.petunjukKeluaranTerpotong(`git show HEAD:${BERKAS}`, terpotong);
cek(!!p, 'pembacaan utuh yang terpotong → petunjuk muncul');
cek(p.includes('git grep -n -B2 -A4') && p.includes('git blame -L'), 'petunjuknya menyebut KEDUA perintah', p);
cek(p.includes(BERKAS), 'petunjuknya menyebut alamat berkasnya, bukan contoh umum');
cek(/47\.767/.test(p), 'menyebut ukuran berkasnya supaya model tahu seberapa jauh yang hilang', p);
cek(/JANGAN mengulang/.test(p), 'melarang mengulang pembacaan utuh (prosedur langkah 0.4)');

cek(P.petunjukKeluaranTerpotong(`git show HEAD:${BERKAS}`, { terpotong: false }) === null,
  'keluaran TIDAK terpotong → diam');
cek(P.petunjukKeluaranTerpotong('git status', terpotong) === null,
  'perintah lain yang terpotong → diam (bukan pembacaan berkas)');
cek(P.petunjukKeluaranTerpotong('git log --oneline', terpotong) === null, 'git log terpotong → diam');
cek(P.petunjukKeluaranTerpotong(`git grep -n "x" -- ${BERKAS}`, terpotong) === null,
  'git grep yang terpotong → diam; menyarankan git grep kepada git grep itu tak berguna');
cek(P.petunjukKeluaranTerpotong('git show 4b264c7', terpotong) === null, 'git show <sha> (commit) bukan pembacaan berkas');
cek(P.petunjukKeluaranTerpotong(null, null) === null && P.petunjukKeluaranTerpotong('', {}) === null, 'masukan kosong aman');

// ── 3. TERPASANG ─────────────────────────────────────────────────────────────────────────────
// Fungsi benar tapi tidak dipanggil = masalah masih hidup.
console.log('\n-- terpasang --');
const svc = readFileSync(AKAR + '/frontend/src/core/runtime/services/AssistantService.js', 'utf8');
cek(/import \{[^}]*petunjukKeluaranTerpotong[^}]*\} from '\.\/engineer\/ProsedurEngineer\.js'/.test(svc),
  'AssistantService mengimpor petunjukKeluaranTerpotong');
cek(/petunjukKeluaranTerpotong\(perintah, h\)/.test(svc), 'dipanggil dengan hasil penjalan perintah (h), bukan teks keluaran');
cek(svc.indexOf('petunjukKeluaranTerpotong(perintah, h)') > svc.indexOf('petunjukHasilKosong(perintah, output)'),
  'dipasang berdampingan dengan petunjuk hasil kosong di jalur yang sama');

// Kedua perintah HARUS diizinkan profil Engineer — petunjuk yang menyarankan perintah terlarang lebih buruk
// daripada tidak ada petunjuk sama sekali.
const jalan = readFileSync(AKAR + '/frontend/electron/alatFolderJalan.cjs', 'utf8');
const gitBaca = /const GIT_BACA = \[([^\]]+)\]/.exec(jalan)[1];
for (const sub of ['grep', 'blame']) {
  cek(gitBaca.includes(`'${sub}'`), `git ${sub} diizinkan untuk profil Engineer (GIT_BACA)`, gitBaca);
}

// Prosedur harus menyebutkannya — di situlah model membacanya.
const konst = readFileSync(AKAR + '/constitution/28_PROSEDUR_KERJA_ENGINEER.md', 'utf8');
cek(konst.includes('git grep -n -B2 -A4') && konst.includes('git blame -L'), 'constitution/28 mengajarkan kedua perintah');
cek(/20 KB/.test(konst) && /47\.767/.test(konst), 'constitution/28 menyebut batas 20 KB dan ukuran nyata berkasnya');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
