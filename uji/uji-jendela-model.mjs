// UJI 2026-09-24 — batas jendela model ikut dihitung dalam anggaran konteks (sisa Tahap 3a).
//
// Sebelum ini `batasModel` tidak pernah diisi: anggaran murni digerakkan biaya, dan dengan model
// murah berjendela sempit anggarannya melampaui jendela model — permintaan ditolak OpenRouter.
// Angka jendela di bawah diambil dari katalog resmi OpenRouter /api/v1/models pada 24 September 2026
// dan sudah ditulis ke kolom `model_pricing.context_length`.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const AKAR = 'D:/SLAMET/other/mamet os ecosystem/frontend/src/';
const K = await import(pathToFileURL(AKAR + 'core/runtime/services/KonteksChat.js').href + '?v=' + Date.now());
console.log('uji-jendela-model v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// Isi nyata tabel model_pricing sesudah migrasi (model, harga masukan per 1 jt, jendela).
const TABEL = [
  ['openai/gpt-4o',                    2.5,    128000],
  ['openai/gpt-4o-mini',               0.15,   128000],
  ['meta-llama/llama-3.1-8b-instruct', 0.05,   131072],
  ['deepseek/deepseek-v4-pro-0813',    0.5795, 1048576],
  ['deepseek/deepseek-v4-flash-0731',  0.065,  1310720],
];

// ---------- tidak ada model yang anggarannya melampaui jendelanya ----------
for (const [nama, harga, jendela] of TABEL) {
  for (const batasHarianUsd of [0.5, 1, 3, 10, 100]) {
    const a = K.anggaranKonteks({ batasHarianUsd, terpakaiHariIniUsd: 0, hargaInput1M: harga, batasModel: jendela });
    cek(a.token <= Math.floor(jendela * K.PORSI_JENDELA_MODEL),
      `${nama} @ $${batasHarianUsd}/hari: anggaran ${a.token} tidak melewati 60% jendela (${Math.floor(jendela * 0.6)})`,
      { token: a.token, jendela, alasan: a.alasan });
  }
}

// ---------- cacat yang diukur 24 September, harus hilang ----------
// gpt-4o-mini batas $3 dulu menghasilkan 1.000.000 token melawan jendela 128.000.
let a = K.anggaranKonteks({ batasHarianUsd: 3, terpakaiHariIniUsd: 0, hargaInput1M: 0.15, batasModel: 128000 });
cek(a.token === 76800, 'gpt-4o-mini batas $3: 1.000.000 → 76.800 token (60% dari 128.000)', a);
cek(a.dibatasiJendelaModel === true && /dibatasi jendela model/.test(a.alasan), 'alasannya menyebut jendela model, bukan biaya', a.alasan);
cek(a.batasModel === 128000, 'jendela model dilaporkan apa adanya untuk ditampilkan', a);
// llama-3.1-8b batas $3 dulu menghasilkan 3.000.000 token melawan jendela 131.072.
a = K.anggaranKonteks({ batasHarianUsd: 3, terpakaiHariIniUsd: 0, hargaInput1M: 0.05, batasModel: 131072 });
cek(a.token === 78643, 'llama-3.1-8b batas $3: 3.000.000 → 78.643 token', a);

// ---------- KENDALI: model berjendela lebar tidak ikut dipotong ----------
a = K.anggaranKonteks({ batasHarianUsd: 3, terpakaiHariIniUsd: 0, hargaInput1M: 0.5795, batasModel: 1048576 });
cek(a.token === 258843 && a.dibatasiJendelaModel === false && /batas biaya harian/.test(a.alasan),
  'KENDALI deepseek-v4-pro: biaya tetap yang membatasi, bukan jendela', a);

// ---------- KENDALI: jendela belum diketahui → perilaku lama, bukan angka tebakan ----------
a = K.anggaranKonteks({ batasHarianUsd: 3, terpakaiHariIniUsd: 0, hargaInput1M: 0.15 });
cek(a.token === 1000000 && a.batasModel === null && a.dibatasiJendelaModel === false,
  'KENDALI tanpa data jendela: anggaran apa adanya, tidak dipotong diam-diam', a);
a = K.anggaranKonteks({ batasHarianUsd: 3, hargaInput1M: 0.15, batasModel: null });
cek(a.token === 1000000, 'KENDALI context_length NULL di tabel diperlakukan sama dengan tak ada', a);
a = K.anggaranKonteks({ batasHarianUsd: 3, hargaInput1M: 0.15, batasModel: 0 });
cek(a.token === 1000000, 'KENDALI jendela 0 (data rusak) tidak mengunci konteks jadi nol', a);

// ---------- jendela sangat sempit: minimum TIDAK boleh menembusnya ----------
// Katalog OpenRouter memuat entri sekecil 4.095 token.
a = K.anggaranKonteks({ batasHarianUsd: 0.01, terpakaiHariIniUsd: 0.009, hargaInput1M: 3, batasModel: 4095 });
cek(a.token === Math.floor(4095 * 0.6), 'jendela 4.095: anggaran minimum 8.000 ikut dipotong, tidak menembus jendela', a);
cek(a.token < K.ANGGARAN_MIN, 'anggaran boleh di bawah ANGGARAN_MIN bila jendelanya memang sesempit itu', a.token);
cek(/dibatasi jendela model/.test(a.alasan), 'jendela model menang atas alasan "sisa harian tipis"', a.alasan);

// tanpa harga/batas: anggaran bawaan 60k pun dipotong jendela
a = K.anggaranKonteks({ batasModel: 32000 });
cek(a.token === 19200 && /dibatasi jendela model/.test(a.alasan), 'anggaran bawaan 60k juga tunduk pada jendela model', a);
a = K.anggaranKonteks({ batasModel: 1048576 });
cek(a.token === K.ANGGARAN_BAWAAN && /belum diketahui/.test(a.alasan), 'KENDALI jendela lebar: anggaran bawaan tetap 60k', a);

// ---------- meteran memberi tahu Owner angkanya ----------
let m = K.meteranKonteks({ tokenTerpakai: 1000, anggaranToken: 76800, batasModel: 128000, dibatasiJendelaModel: true, alasan: 'dibatasi jendela model' });
cek(/Dipotong jendela model 128\.000 token/.test(m.rincian), 'rincian menyebut angka jendela saat dipotong', m.rincian);
cek(/sisanya untuk jawaban/.test(m.rincian), 'rincian menjelaskan kenapa hanya 60% yang dipakai', m.rincian);
m = K.meteranKonteks({ tokenTerpakai: 1000, anggaranToken: 258843, batasModel: 1048576, dibatasiJendelaModel: false, alasan: 'dari batas biaya harian' });
cek(/Jendela model 1\.048\.576 token\./.test(m.rincian) && !/Dipotong/.test(m.rincian), 'jendela tetap disebut walau bukan dia yang memotong', m.rincian);
m = K.meteranKonteks({ tokenTerpakai: 1000, anggaranToken: 60000 });
cek(/Jendela model belum diketahui/.test(m.rincian), 'jendela tak diketahui dikatakan terus terang, tidak disembunyikan', m.rincian);

// ---------- terpasang di jalur nyata ----------
const AS = readFileSync(AKAR + 'core/runtime/services/AssistantService.js', 'utf8');
cek(/select\('input_price_per_1m, context_length'\)/.test(AS), 'bahanAnggaranKonteks ikut mengambil context_length dari model_pricing');
const iBahan = AS.indexOf('async bahanAnggaranKonteks(');
cek(iBahan > 0 && /nilai\.batasModel = j/.test(AS.slice(iBahan, iBahan + 1800)), 'context_length dipetakan ke batasModel');
const CE = readFileSync(AKAR + 'components/workbench/ConversationEngine.jsx', 'utf8');
cek(/batasModel: ang\.batasModel/.test(CE), 'layar meneruskan jendela model ke meteran');
cek(/dibatasiJendelaModel: ang\.dibatasiJendelaModel/.test(CE), 'layar meneruskan penanda "dipotong jendela" ke meteran');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
