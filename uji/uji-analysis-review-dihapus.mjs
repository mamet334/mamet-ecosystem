// UJI 2026-09-29 — jalur ANALYSIS & REVIEW Engineer dihapus, tetapi yang HIDUP tidak ikut terbawa.
//
// Keputusan Owner 28 September mengoreksi usul asisten: "cari lagi agar bermanfaat; jika sudah
// dikerjakan oleh kode lain yang lebih baik, tidak masalah dihapus." Jadi penghapusan ini harus
// menjadi KESIMPULAN dari pemeriksaan, bukan titik mulai — sama seperti READ_REPO, yang dihapus
// SESUDAH penggantinya terbukti.
//
// Yang paling berbahaya di sini bukan menghapus terlalu sedikit, melainkan menghapus terlalu banyak:
// `_analyze`, `_buildDynamicContext`, `_calculateConfidence`, dan `_checkCompliance` sama-sama
// bertetangga dengan kode mati itu, tetapi ketiganya dipakai jalur MODIFY_CODE yang hidup. Bagian
// "MASIH HIDUP" di bawah menjaga justru itu.

import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const baca = (p) => readFileSync(`${AKAR}/${p}`, 'utf8');

console.log('uji-analysis-review-dihapus v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const ENG = baca('frontend/src/core/runtime/services/engineer.js');
const TH = baca('frontend/src/core/runtime/services/engineer/TaskHandlers.js');
const IC = baca('frontend/src/core/runtime/services/engineer/IntentClassifier.js');

// ── 1. Yang mati sudah hilang ────────────────────────────────────────────────────────────────
console.log('\n-- yang mati hilang --');

// Diperiksa LANGGANANNYA, bukan penyebutannya: komentar penjelas tetap menyebut nama peristiwanya,
// dan uji semacam ini pernah tertipu oleh komentarnya sendiri (uji-konteks-chat, 28 Sep).
cek(!/eventBus\.on\('Engineer:AnalyzeTask'/.test(ENG), 'langganan Engineer:AnalyzeTask sudah tidak ada');
cek(!/eventBus\.on\('Engineer:ReviewChanges'/.test(ENG), 'langganan Engineer:ReviewChanges sudah tidak ada');
cek(!/async _handleAnalysisTask\(/.test(ENG), '_handleAnalysisTask dihapus');
cek(!/async _handleReviewTask\(/.test(ENG), '_handleReviewTask dihapus');
cek(!/async _review\(task\)/.test(ENG), '_review dihapus — ia tak menambah apa pun di atas _analyze');
cek(!/export async function handleAnalysisTask/.test(TH), 'handleAnalysisTask dihapus dari TaskHandlers');
cek(!/export async function handleReviewTask/.test(TH), 'handleReviewTask dihapus dari TaskHandlers');
// Yang diperiksa PEMAKAIANNYA, bukan penyebutannya — komentar sejarah tetap menyebut namanya, dan
// versi pertama asersi ini merah justru karena tidak bisa membedakan komentar dari panggilan.
cek(!/import \{[^}]*handle(Analysis|Review)Task[^}]*\}/.test(ENG), 'tidak ada lagi impor kedua penangan itu');
cek(!/\bhandle(Analysis|Review)Task\(task,/.test(ENG), 'tidak ada lagi panggilan ke kedua penangan itu');
cek(!/this\._handle(Analysis|Review)Task\(/.test(ENG), 'tidak ada lagi panggilan lewat pembungkusnya');
cek(!/from '\.\/engineer\/IntentClassifier\.js'/.test(ENG), 'impor detectIntent dibuang dari engineer.js');

// Cabang yang tak pernah tercapai.
cek(!/if \(intent === 'ANALYSIS'\)/.test(ENG), 'cabang ANALYSIS dihapus');
cek(!/if \(intent === 'CLARIFICATION'\)/.test(ENG), 'cabang CLARIFICATION dihapus');

// ── 2. Menebak diam-diam diganti penolakan yang BERSUARA ─────────────────────────────────────
console.log('\n-- penjaga yang bersuara --');

cek(/if \(!task\?\.dariTombolApply\) \{/.test(ENG),
  'tugas tanpa dariTombolApply DITOLAK, bukan diam-diam dianggap MODIFY_CODE', (ENG.match(/dariTombolApply[^\n]*/g) || []));
const iTolak = ENG.indexOf('if (!task?.dariTombolApply) {');
const blokTolak = ENG.slice(iTolak, iTolak + 700);
cek(/Apply Patch/.test(blokTolak), 'pesannya menyebut sebabnya: tugas tidak datang dari tombol Apply Patch', blokTolak);
cek(/_emitRecommendation/.test(blokTolak), 'penolakannya sampai ke layar Owner, bukan hanya ke console');
cek(/console\.warn/.test(blokTolak), 'ikut tercatat di log');
// Penjaga harus berjalan SEBELUM patch dibuat.
cek(iTolak > 0 && iTolak < ENG.indexOf('await this._analyze(task)'), 'penolakan terjadi sebelum analisis/patch dimulai');

// ── 3. YANG MASIH HIDUP tidak ikut terbawa ───────────────────────────────────────────────────
// Ini bagian terpenting: keempatnya bertetangga dengan kode mati tadi dan gampang ikut terhapus.
console.log('\n-- yang hidup tetap ada --');

cek(/async _analyze\(task\) \{/.test(ENG), '_analyze TETAP ADA');
cek(/const analysis = await this\._analyze\(task\);/.test(ENG), '_analyze masih dipanggil jalur MODIFY_CODE');
cek(/async _buildDynamicContext\(task\) \{/.test(ENG), '_buildDynamicContext TETAP ADA');
cek(/this\.brain\.dynamic = await this\._buildDynamicContext\(task\);/.test(ENG), '_buildDynamicContext masih dipanggil');
cek(/export async function buildDynamicContext/.test(TH), 'buildDynamicContext TETAP diekspor TaskHandlers');
cek(/import \{ buildDynamicContext \} from '\.\/engineer\/TaskHandlers\.js'/.test(ENG), 'impornya dipersempit, bukan dihapus');
cek(/_calculateConfidence\(result\) \{/.test(ENG), '_calculateConfidence TETAP ADA');
cek((ENG.match(/this\._calculateConfidence\(/g) || []).length >= 3, '_calculateConfidence masih dipakai beberapa tempat');
cek(/_checkCompliance\(/.test(ENG), '_checkCompliance TETAP ADA (dipakai _analyze)');
cek(/emitReasoningReport\(/.test(ENG),
  'Reasoning Lock tetap ada — hasil _analyze tetap sampai ke Owner, jadi kemampuannya tidak hilang');

// ── 4. IntentClassifier disimpan dengan alasan tertulis ──────────────────────────────────────
console.log('\n-- IntentClassifier ditandai, bukan dihapus --');

cek(/TIDAK LAGI TERSAMBUNG KE JALUR HIDUP/.test(IC), 'kepala berkasnya menyatakan ia tidak lagi tersambung');
cek(/uji-klaim-engineer/.test(IC) && /BAHAN uji/.test(IC),
  'alasan menyimpannya tertulis: dipakai berkas uji sebagai bahan uji nyata', IC.slice(0, 200));
cek(/export function detectIntent/.test(IC), 'fungsinya masih ada — berkas uji menunjuk kode sungguhan');

// Alasan penghapusan tercatat di kode, bukan hanya di changelog.
cek(/JALUR ANALYSIS & REVIEW DIHAPUS \(2026-09-29\)/.test(ENG), 'catatan penghapusan ada di berkasnya sendiri');
cek(/Tahap 6/.test(ENG.slice(ENG.indexOf('JALUR ANALYSIS & REVIEW DIHAPUS'))),
  'catatan menyebut penggantinya yang lebih baik (Tahap 6), bukan sekadar "dihapus"');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
