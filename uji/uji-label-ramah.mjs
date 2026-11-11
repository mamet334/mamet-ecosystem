
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
const L = await import(pathToFileURL(`${AKAR}/mametlite/src/lib/labelRamah.js`).href + '?v=' + Date.now());

console.log('uji-label-ramah v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

console.log('\n-- penerjemahan --');

const jawabVerified = 'Kuota Kabupaten 2025 adalah 120 orang.\n\nSumber: "KEPBUP-2025.pdf"\n\n[STATUS: VERIFIED]';
let h = L.pisahLabel(jawabVerified);
cek(h.label?.kunci === 'VERIFIED', 'VERIFIED dikenali', h.label);
cek(h.label.judul === 'Dari dokumen', 'judulnya bahasa Indonesia, bukan VERIFIED', h.label.judul);
cek(!/STATUS|VERIFIED/.test(h.jawaban), 'teks label mentah DIBUANG dari badan jawaban — tidak tampil dua kali', h.jawaban);
cek(h.jawaban.includes('120 orang') && h.jawaban.includes('KEPBUP-2025.pdf'), 'isi jawaban & baris Sumber tetap utuh', h.jawaban);

h = L.pisahLabel('Perkiraan saya begini.\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]');
cek(h.label?.kunci === 'HYPOTHESIS', 'HYPOTHESIS dikenali beserta akhirannya');
cek(/periksa/i.test(h.label.penjelasan), 'penjelasannya menyuruh memeriksa dulu', h.label.penjelasan);

h = L.pisahLabel('Sebagian ada di dokumen.\n\n[STATUS: PARTIAL - Sebagian Bersandar Dokumen]');
cek(h.label?.kunci === 'PARTIAL', 'PARTIAL dikenali beserta akhirannya');

h = L.pisahLabel('Maaf, datanya tidak ada.\n\n[STATUS: INSUFFICIENT]');
cek(h.label?.kunci === 'INSUFFICIENT', 'INSUFFICIENT dikenali');
cek(/belum tentu tidak ada/i.test(h.label.penjelasan),
  'INSUFFICIENT tidak dibaca sebagai "datanya memang tidak ada" — mungkin dokumennya belum diunggah', h.label.penjelasan);
cek(h.label.nada === 'netral', '"tidak ketemu" bukan peringatan bahaya — nadanya netral');

h = L.pisahLabel('Secara umum begini.\n\n[Pengetahuan umum AI — tidak diverifikasi dari dokumen Anda]');
cek(h.label?.kunci === 'UMUM', 'label "pengetahuan umum AI" dikenali');

h = L.pisahLabel('isi.\n\n[Status: Verified]');
cek(h.label?.kunci === 'VERIFIED', 'varian huruf [Status: Verified] tetap dikenali', h.label);

for (const t of ['Halo, ada yang bisa saya bantu?', '', '   ', 'Jawaban tanpa label apa pun.']) {
  cek(L.pisahLabel(t).label === null, `tanpa label → TIDAK menampilkan label (${JSON.stringify(t).slice(0, 30)})`);
}
cek(L.pisahLabel('Kuota 2025 adalah 120.\n\n[STATUS: VERI').label === null,
  'label yang belum selesai ditulis TIDAK dianggap label');

h = L.pisahLabel('[STATUS: VERIFIED]\n\nisi\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]');
cek(h.label?.kunci === 'HYPOTHESIS',
  'bila dua label muncul, yang menang yang LEBIH HATI-HATI — pembacanya tak bisa memeriksa sendiri', h.label);

h = L.pisahLabel('isi jawaban\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]\n\n_Catatan sistem: label VERIFIED diturunkan — jawaban ini tidak mengutip dokumen yang tersedia._');
cek(h.catatan.length === 1 && h.catatan[0].startsWith('Catatan sistem:'), 'catatan sistem diambil terpisah', h.catatan);
cek(!h.catatan[0].includes('_'), 'garis bawah _miring_ dibuang — parseMarkdown Mametlite hanya kenal *miring*', h.catatan[0]);
cek(!h.jawaban.includes('Catatan sistem'), 'catatan tidak ikut di badan jawaban', h.jawaban);

console.log('\n-- tombol salin --');

let s = L.teksSalinan('<think>nalar panjang</think>Pangkatnya Pembina TK. I (IV/b).\n\nSumber: "KEPBUP.pdf"\n\n[STATUS: VERIFIED]');
cek(!s.includes('[STATUS'), 'salinan TIDAK memuat [STATUS: …] mentah', s);
cek(!s.includes('nalar panjang'), 'nalar <think> tetap dibuang dari salinan', s);
cek(s.startsWith('[Dari dokumen]'), 'salinan diawali label dalam bahasa manusia', s);
cek(s.includes('Pembina TK. I (IV/b)') && s.includes('KEPBUP.pdf'), 'isi jawaban & sumbernya ikut tersalin', s);

s = L.teksSalinan('Kira-kira tiga bulan.\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]');
cek(/Perkiraan AI/.test(s) && /[Pp]eriksa dulu/.test(s),
  'PERINGATANNYA ikut pindah ke dokumen — inilah alasan utama perbaikan ini', s);

s = L.teksSalinan('isi\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]\n\n_Catatan sistem: label VERIFIED diturunkan — jawaban ini tidak mengutip dokumen yang tersedia._');
cek(s.includes('Catatan sistem:') && !s.includes('_Catatan'), 'catatan sistem ikut tersalin, tanpa garis bawah', s);

cek(L.teksSalinan('Halo, ada yang bisa dibantu?') === 'Halo, ada yang bisa dibantu?',
  'jawaban tanpa label disalin apa adanya — tidak ditambahi label karangan');
cek(L.teksSalinan('') === '' && L.teksSalinan(null) === '', 'teks kosong → salinan kosong, bukan galat');

cek(L.warnaLabel('aman').teks.includes('emerald'), 'nada aman → hijau');
cek(L.warnaLabel('hati').teks.includes('amber'), 'nada hati-hati → kuning');
cek(L.warnaLabel('apa pun').teks.includes('slate'), 'nada tak dikenal → netral, bukan galat');

console.log('\n-- selaras dengan label_sumber.ts --');

const SRC = readFileSync(`${AKAR}/supabase/functions/agent-process/lib/verification/label_sumber.ts`, 'utf8');
const ambil = (nama) => (SRC.match(new RegExp(`export const ${nama} = '([^']+)'`)) || [])[1];

for (const [nama, kunciHarapan] of [['LABEL_VERIFIED', 'VERIFIED'], ['LABEL_HIPOTESIS', 'HYPOTHESIS'], ['LABEL_PARSIAL', 'PARTIAL']]) {
  const teksServer = ambil(nama);
  cek(!!teksServer, `${nama} terbaca dari label_sumber.ts`, teksServer);
  if (teksServer) {
    const dikenali = L.pisahLabel(`jawaban apa pun\n\n${teksServer}`);
    cek(dikenali.label?.kunci === kunciHarapan, `${nama} (${teksServer}) diterjemahkan jadi ${kunciHarapan}`, dikenali.label);
    cek(!dikenali.jawaban.includes(teksServer), `${nama} dibuang dari badan jawaban`, dikenali.jawaban);
  }
}

for (const nama of ['CATATAN_KOREKSI', 'CATATAN_TANPA_LABEL']) {
  const teksServer = ambil(nama);
  cek(!!teksServer, `${nama} terbaca dari label_sumber.ts`);
  if (teksServer) {
    const d = L.pisahLabel(`isi\n\n${teksServer}`);
    cek(d.catatan.length === 1, `${nama} dikenali sebagai catatan sistem`, d);
  }
}

const KONTRAK = readFileSync(`${AKAR}/supabase/functions/agent-process/lib/verification/universal_contract.ts`, 'utf8');
cek(KONTRAK.includes('[STATUS: INSUFFICIENT]'), 'prompt server (BLOK 6) memang masih menyuruh [STATUS: INSUFFICIENT]');
cek(KONTRAK.includes('[Pengetahuan umum AI'), 'prompt server (BLOK 6) memang masih memakai [Pengetahuan umum AI …]');
const DASAR = readFileSync(`${AKAR}/supabase/functions/agent-process/lib/request/prompt_dasar.ts`, 'utf8');
cek(DASAR.includes('[BLOK 6: OUTPUT FORMAT & STATUS LABEL]') && !DASAR.includes('[STATUS: VERIFIED]'), 'prompt dasar merujuk BLOK 6 sebagai satu-satunya sumber aturan label (tidak mengulangnya)');

console.log('\n-- terpasang di App.jsx --');

const APP = readFileSync(`${AKAR}/mametlite/src/App.jsx`, 'utf8');
cek(['pisahLabel', 'warnaLabel', 'teksSalinan'].every((n) => new RegExp(`import \\{[^}]*\\b${n}\\b[^}]*\\} from '\\./lib/labelRamah'`).test(APP)),
  'ketiga fungsi labelRamah diimpor App.jsx', (APP.match(/import \{[^}]*\} from '\.\/lib\/labelRamah'/) || []));
cek(/navigator\.clipboard\.writeText\(teksSalinan\(text\)\)/.test(APP),
  'tombol Salin memakai teksSalinan — bukan teks mentah server', (APP.match(/clipboard\.writeText[^\n]*/g) || []));
cek(!/const cleanText = text\.replace/.test(APP), 'jalur salin lama yang menyisakan [STATUS: …] sudah tidak ada');
cek(/const JawabanBerlabel = /.test(APP), 'komponen JawabanBerlabel ada');
cek(/<JawabanBerlabel teks=\{msg\.content\} \/>/.test(APP), 'komponen dipakai merender pesan asisten', APP.match(/JawabanBerlabel[^\n]*/g));

const cabangPesan = APP.match(
  /msg\.role === 'assistant'\s*\?\s*(<JawabanBerlabel[^>]*\/>)\s*:\s*(<[A-Za-z][^>]*\/>)/,
);
cek(!!cabangPesan && !/JawabanBerlabel/.test(cabangPesan[2]),
  'hanya pesan asisten yang lewat JawabanBerlabel; pesan pengguna tetap apa adanya',
  (APP.match(/msg\.role === 'assistant'[\s\S]{0,260}/) || [])[0]);

const iKomponen = APP.indexOf('const JawabanBerlabel');
const blok = APP.slice(iKomponen, iKomponen + 1400);
cek(/\{label\.penjelasan\}/.test(blok), 'penjelasan label ikut dirender');
cek(!/group-hover|title=/.test(blok),
  'penjelasan TIDAK disembunyikan di balik hover/tooltip — di layar sentuh itu tak pernah muncul', blok);
const iBadanJawaban = blok.search(/teks=\{jawaban\}/);
cek(iBadanJawaban > 0 && blok.indexOf('{label.judul}') < iBadanJawaban,
  'label diletakkan DI ATAS jawaban — pembaca tahu cara membacanya sebelum terlanjur percaya',
  { iJudul: blok.indexOf('{label.judul}'), iBadanJawaban });

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
