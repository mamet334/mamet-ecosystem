import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
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

console.log('\n-- yang mati hilang --');

cek(!/eventBus\.on\('Engineer:AnalyzeTask'/.test(ENG), 'langganan Engineer:AnalyzeTask sudah tidak ada');
cek(!/eventBus\.on\('Engineer:ReviewChanges'/.test(ENG), 'langganan Engineer:ReviewChanges sudah tidak ada');
cek(!/async _handleAnalysisTask\(/.test(ENG), '_handleAnalysisTask dihapus');
cek(!/async _handleReviewTask\(/.test(ENG), '_handleReviewTask dihapus');
cek(!/async _review\(task\)/.test(ENG), '_review dihapus — ia tak menambah apa pun di atas _analyze');
cek(!/export async function handleAnalysisTask/.test(TH), 'handleAnalysisTask dihapus dari TaskHandlers');
cek(!/export async function handleReviewTask/.test(TH), 'handleReviewTask dihapus dari TaskHandlers');
cek(!/import \{[^}]*handle(Analysis|Review)Task[^}]*\}/.test(ENG), 'tidak ada lagi impor kedua penangan itu');
cek(!/\bhandle(Analysis|Review)Task\(task,/.test(ENG), 'tidak ada lagi panggilan ke kedua penangan itu');
cek(!/this\._handle(Analysis|Review)Task\(/.test(ENG), 'tidak ada lagi panggilan lewat pembungkusnya');
cek(!/from '\.\/engineer\/IntentClassifier\.js'/.test(ENG), 'impor detectIntent dibuang dari engineer.js');

cek(!/if \(intent === 'ANALYSIS'\)/.test(ENG), 'cabang ANALYSIS dihapus');
cek(!/if \(intent === 'CLARIFICATION'\)/.test(ENG), 'cabang CLARIFICATION dihapus');

console.log('\n-- penjaga yang bersuara --');

cek(/if \(!task\?\.dariTombolApply\) \{/.test(ENG),
  'tugas tanpa dariTombolApply DITOLAK, bukan diam-diam dianggap MODIFY_CODE', (ENG.match(/dariTombolApply[^\n]*/g) || []));
const iTolak = ENG.indexOf('if (!task?.dariTombolApply) {');
const blokTolak = ENG.slice(iTolak, iTolak + 700);
cek(/Apply Patch/.test(blokTolak), 'pesannya menyebut sebabnya: tugas tidak datang dari tombol Apply Patch', blokTolak);
cek(/_emitRecommendation/.test(blokTolak), 'penolakannya sampai ke layar Owner, bukan hanya ke console');
cek(/console\.warn/.test(blokTolak), 'ikut tercatat di log');
cek(iTolak > 0 && iTolak < ENG.indexOf('await this._analyze(task)'), 'penolakan terjadi sebelum analisis/patch dimulai');

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

console.log('\n-- IntentClassifier diuji kode nyata, bukan lagi di jalur hidup --');

cek(!/detectIntent/.test(ENG), 'detectIntent tidak lagi tersambung/dipanggil di engineer.js');
cek(/export function detectIntent/.test(IC), 'fungsinya masih ada — berkas uji menunjuk kode sungguhan');
const { detectIntent } = await import(new URL('../frontend/src/core/runtime/services/engineer/IntentClassifier.js', import.meta.url).href);
cek(typeof detectIntent === 'function', 'detectIntent adalah fungsi yang bisa dipanggil');
cek(detectIntent({ title: 'patch kode' }) === 'MODIFY_CODE', 'detectIntent berfungsi sebagai bahan uji nyata');

cek(/verifyPatchEngineering/.test(ENG), 'jalur pengganti verifikasi patch ada di kode nyata engineer.js');
cek(/MODIFY_CODE/.test(ENG), 'jalur MODIFY_CODE aktif menggantikan ANALYSIS/CLARIFICATION');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
