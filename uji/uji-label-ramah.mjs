// UJI 2026-09-29 — label verifikasi Mametlite dalam bahasa pengguna awam.
//
// Mametlite dibuat untuk orang awam (chat + pencarian lengkap + RAG, tanpa Engineer/memori), jadi
// TIDAK ADA yang memeriksa jawaban di sana — berbeda dari Mamet Ecosystem yang pemeriksanya Owner
// sendiri. Sampai 29 September `mametlite/src` tidak punya satu pun kode label: `[STATUS: VERIFIED]`
// sampai ke pegawai ASN sebagai teks mentah berhuruf besar berbahasa Inggris.
//
// Yang dijaga di sini, dan lapisan ketiga yang paling mahal bila lepas:
//   1. PENERJEMAHAN — label mana jadi kalimat apa, dan kapan TIDAK menampilkan apa pun
//   2. SELARAS SERVER — tulisan label di `label_sumber.ts` berubah → uji ini MERAH, bukan diam
//   3. TERPASANG     — komponennya benar-benar dipakai merender jawaban, bukan sekadar ada

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const L = await import(pathToFileURL(`${AKAR}/mametlite/src/lib/labelRamah.js`).href + '?v=' + Date.now());

console.log('uji-label-ramah v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. Penerjemahan ──────────────────────────────────────────────────────────────────────────
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

// Varian penulisan model (huruf kecil/campur) — server menyeragamkannya, tetapi hanya SESUDAH
// jawaban selesai. Yang mengalir ke layar lebih dulu adalah tulisan model apa adanya.
h = L.pisahLabel('isi.\n\n[Status: Verified]');
cek(h.label?.kunci === 'VERIFIED', 'varian huruf [Status: Verified] tetap dikenali', h.label);

// Jangan mengarang label.
for (const t of ['Halo, ada yang bisa saya bantu?', '', '   ', 'Jawaban tanpa label apa pun.']) {
  cek(L.pisahLabel(t).label === null, `tanpa label → TIDAK menampilkan label (${JSON.stringify(t).slice(0, 30)})`);
}
// Saat jawaban masih mengalir, labelnya belum utuh — jangan menebak dari potongan.
cek(L.pisahLabel('Kuota 2025 adalah 120.\n\n[STATUS: VERI').label === null,
  'label yang belum selesai ditulis TIDAK dianggap label');

// Dua label dalam satu jawaban → yang lebih hati-hati menang.
h = L.pisahLabel('[STATUS: VERIFIED]\n\nisi\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]');
cek(h.label?.kunci === 'HYPOTHESIS',
  'bila dua label muncul, yang menang yang LEBIH HATI-HATI — pembacanya tak bisa memeriksa sendiri', h.label);

// Catatan sistem: dipisah, dan garis bawahnya hilang.
h = L.pisahLabel('isi jawaban\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]\n\n_Catatan sistem: label VERIFIED diturunkan — jawaban ini tidak mengutip dokumen yang tersedia._');
cek(h.catatan.length === 1 && h.catatan[0].startsWith('Catatan sistem:'), 'catatan sistem diambil terpisah', h.catatan);
cek(!h.catatan[0].includes('_'), 'garis bawah _miring_ dibuang — parseMarkdown Mametlite hanya kenal *miring*', h.catatan[0]);
cek(!h.jawaban.includes('Catatan sistem'), 'catatan tidak ikut di badan jawaban', h.jawaban);

// ── 1b. Tombol Salin ─────────────────────────────────────────────────────────────────────────
// Cacat live 29 September: kotak label benar di layar, tetapi tombol Salin masih menyalin teks
// MENTAH — `[STATUS: VERIFIED]` ikut menempel di dokumen kerja. Untuk "Perkiraan AI" itu berbahaya:
// peringatannya hilang justru saat jawaban dipindahkan ke tempat orang lain membacanya.
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

// Warna
cek(L.warnaLabel('aman').teks.includes('emerald'), 'nada aman → hijau');
cek(L.warnaLabel('hati').teks.includes('amber'), 'nada hati-hati → kuning');
cek(L.warnaLabel('apa pun').teks.includes('slate'), 'nada tak dikenal → netral, bukan galat');

// ── 2. Selaras dengan server ─────────────────────────────────────────────────────────────────
// Tulisan label ditentukan `label_sumber.ts`. Kalau di sana berubah dan di sini tidak, pengguna
// kembali melihat teks mentah — diam-diam. Itulah bentuk kegagalan yang dijaga di sini.
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

// INSUFFICIENT tidak punya konstanta di label_sumber.ts — ia ditulis model lewat prompt.
const PIPE = readFileSync(`${AKAR}/supabase/functions/agent-process/lib/request/request_pipeline.ts`, 'utf8');
cek(PIPE.includes('[STATUS: INSUFFICIENT]'), 'prompt server memang masih menyuruh [STATUS: INSUFFICIENT]');
cek(PIPE.includes('[Pengetahuan umum AI'), 'prompt server memang masih memakai [Pengetahuan umum AI …]');

// ── 3. TERPASANG di layar ────────────────────────────────────────────────────────────────────
// Modul yang benar tapi tidak dipanggil = pengguna tetap melihat teks mentah. Dua uji minggu lalu
// lulus justru karena hanya memeriksa "fungsinya benar", bukan "fungsinya dipakai".
console.log('\n-- terpasang di App.jsx --');

const APP = readFileSync(`${AKAR}/mametlite/src/App.jsx`, 'utf8');
// Diperiksa PER NAMA, bukan sebagai daftar utuh beserta urutannya: menambah satu ekspor yang sah
// ke daftar impor tidak merusak apa pun, dan asersi yang memaku ejaannya akan menuduhnya.
cek(['pisahLabel', 'warnaLabel', 'teksSalinan'].every((n) => new RegExp(`import \\{[^}]*\\b${n}\\b[^}]*\\} from '\\./lib/labelRamah'`).test(APP)),
  'ketiga fungsi labelRamah diimpor App.jsx', (APP.match(/import \{[^}]*\} from '\.\/lib\/labelRamah'/) || []));
cek(/navigator\.clipboard\.writeText\(teksSalinan\(text\)\)/.test(APP),
  'tombol Salin memakai teksSalinan — bukan teks mentah server', (APP.match(/clipboard\.writeText[^\n]*/g) || []));
cek(!/const cleanText = text\.replace/.test(APP), 'jalur salin lama yang menyisakan [STATUS: …] sudah tidak ada');
cek(/const JawabanBerlabel = /.test(APP), 'komponen JawabanBerlabel ada');
cek(/<JawabanBerlabel teks=\{msg\.content\} \/>/.test(APP), 'komponen dipakai merender pesan asisten', APP.match(/JawabanBerlabel[^\n]*/g));

// Jawaban asisten TIDAK boleh lagi dirender langsung tanpa lewat pemisah label, sementara pesan
// PENGGUNA tetap apa adanya — tidak ada label yang perlu dipisahkan dari kalimat yang ia ketik sendiri.
// Sengaja tidak bergantung pada spasi indentasi: versi pertama uji ini merah hanya karena itu.
// DIPERBAIKI 2026-10-07: bentuk lama memaku MEKANISME perenderannya —
// `dangerouslySetInnerHTML={parseMarkdown(msg.content)}`. Saat penyuntikan HTML dihapus (lubang
// XSS daftar putih, M1 `ROADMAP-SIAP-PENGGUNA.md`), asersi ini merah padahal sifat yang dijaganya
// utuh. Itu menguji EJAAN, bukan sifatnya — pelajaran yang sama dengan `44d4f9d`.
//
// Yang diuji sekarang adalah sifatnya: cabang asisten lewat `JawabanBerlabel`, cabang pengguna
// TIDAK — apa pun komponen yang dipakai merender teksnya.
const cabangPesan = APP.match(
  /msg\.role === 'assistant'\s*\?\s*(<JawabanBerlabel[^>]*\/>)\s*:\s*(<[A-Za-z][^>]*\/>)/,
);
cek(!!cabangPesan && !/JawabanBerlabel/.test(cabangPesan[2]),
  'hanya pesan asisten yang lewat JawabanBerlabel; pesan pengguna tetap apa adanya',
  (APP.match(/msg\.role === 'assistant'[\s\S]{0,260}/) || [])[0]);

// Penjelasan tidak boleh bergantung hover — pengguna Mametlite membuka dari HP.
const iKomponen = APP.indexOf('const JawabanBerlabel');
const blok = APP.slice(iKomponen, iKomponen + 1400);
cek(/\{label\.penjelasan\}/.test(blok), 'penjelasan label ikut dirender');
cek(!/group-hover|title=/.test(blok),
  'penjelasan TIDAK disembunyikan di balik hover/tooltip — di layar sentuh itu tak pernah muncul', blok);
// Urutannya diukur terhadap tempat BADAN JAWABAN dirender, bukan terhadap nama mekanismenya.
// `teks={jawaban}` adalah pemakaiannya di JSX — bukan `const { label, jawaban } = pisahLabel(...)`
// di baris pertama komponen, yang akan selalu mendahului apa pun dan membuat asersinya hampa.
const iBadanJawaban = blok.search(/teks=\{jawaban\}/);
cek(iBadanJawaban > 0 && blok.indexOf('{label.judul}') < iBadanJawaban,
  'label diletakkan DI ATAS jawaban — pembaca tahu cara membacanya sebelum terlanjur percaya',
  { iJudul: blok.indexOf('{label.judul}'), iBadanJawaban });

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
