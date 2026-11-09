
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
const S = readFileSync(`${AKAR}/supabase/functions/agent-process/lib/verification/universal_contract.ts`, 'utf8').replace(/\r\n/g, '\n');
const KODE = S.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-kacamata-kuda-engineer v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const iEng = KODE.indexOf("if (mode === 'ENGINEER')");
const iLite = KODE.indexOf("} else if (mode === 'LITE')");
cek(iEng > 0 && iLite > iEng, 'blok ENGINEER terbaca');
const ENG = KODE.slice(iEng, iLite);

console.log('\n-- kacamata kuda --');

cek(!/Tidak boleh menjalankan perintah OS/.test(ENG),
  'larangan "menjalankan perintah OS" tidak lagi dikirim ke Engineer', (ENG.match(/.*perintah OS.*/g) || []));
cek(!/Menggunakan pengetahuan di luar evidence yang terdaftar/.test(KODE),
  'larangan "pengetahuan di luar evidence yang terdaftar" dibuang — kalimat itu menutup repo',
  (KODE.match(/.*di luar evidence.*/g) || []));

console.log('\n-- mata yang diberikan --');

cek(/MEMBACA KODE SUMBER REPO/.test(ENG), 'membaca kode sumber jadi KAPABILITAS yang disebut');
cek(/MAMET_CMD/.test(ENG), 'disebutkan jalurnya — [MAMET_CMD: …]');
for (const p of ['git grep', 'git show', 'git log', 'git blame', 'git ls-files']) {
  cek(ENG.includes(p), `perintah \`${p}\` disebut namanya`);
}
cek(/tanpa menunggu persetujuan/.test(ENG),
  'disebut bahwa perintah baca jalan sendiri — kalau tidak, model tetap menunggu klik yang tak akan datang', ENG.slice(0, 200));

console.log('\n-- kewajiban berbukti tetap --');

cek(/WAJIB memiliki evidence sebelum menjawab/.test(ENG), 'kewajiban berbukti TIDAK dihapus');
cek(/MENENGOK repo lebih dulu/.test(ENG),
  'dan dijelaskan cara memenuhinya untuk pertanyaan kode', (ENG.match(/.*WAJIB memiliki evidence[^']*/g) || []));
cek(/Mengaku tahu isi kode tanpa menengoknya/.test(KODE),
  'mengaku tahu tanpa menengok tetap DILARANG KERAS');
cek(/tanpa pernah menjalankan satu pun pencarian di repo/.test(KODE),
  'menjawab "tidak ada evidence" tanpa mencari juga dilarang — itu persis kegagalan 1 Okt',
  (KODE.match(/.*tidak ada evidence.*/g) || []));
cek(/kode sumber repo TERMASUK evidence yang sah, asalkan alamat berkas dan nomor barisnya disebut/.test(KODE),
  'kode sumber diakui sebagai evidence, DENGAN syarat ketertelusuran');

console.log('\n-- garis yang sama dengan pelaksana --');

cek(/node -e, python -c, npm\) perlu persetujuan Owner/.test(ENG),
  'perintah yang menjalankan kode disebut butuh izin', (ENG.match(/.*perlu persetujuan.*/g) || []));
cek(/jangan mengaku sudah menjalankannya/.test(ENG),
  'dan dilarang mengaku sudah menjalankannya — pola yang pernah terjadi (Item 85 T3)');

console.log('\n-- mode lain utuh --');
{
  const LAIN = KODE.slice(iLite);
  cek(/Tidak boleh membaca\/menulis User Memory/.test(LAIN), 'batasan LITE tidak tersentuh');
  cek(/Prioritaskan dokumen evidence yang tersedia sebagai rujukan utama/.test(LAIN), 'jalur Assistant tidak tersentuh');
  cek(/canUseWebSearch: mode !== 'ENGINEER'/.test(KODE), 'web search tetap mati untuk Engineer');
}

console.log('\n-- dirender ke prompt --');

cek(/text \+= `Kapabilitas: \$\{identity\.capabilities\.join\(', '\)\}/.test(KODE), 'kapabilitas dirender ke BLOK 1');
cek(/text \+= `Batasan: \$\{identity\.restrictions\.join\(' \| '\)\}/.test(KODE), 'batasan dirender ke BLOK 1');
cek(/for \(const f of constraint\.forbidden\)/.test(KODE), 'daftar larangan dirender ke BLOK 5');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
