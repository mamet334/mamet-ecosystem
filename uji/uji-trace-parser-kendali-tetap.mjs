import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const SRC = AKAR_REPO + '/supabase/functions/agent-process/lib/coordinator/trace_parser.ts';

const DIR_SEMENTARA = join(tmpdir(), 'uji-mamet');
mkdirSync(DIR_SEMENTARA, { recursive: true });

const TMP = join(DIR_SEMENTARA, '_trace_parser.mjs');
const { build } = await import(new URL('frontend/node_modules/esbuild/lib/main.js', new URL('../', import.meta.url)).href);
const hasilBuild = await build({ entryPoints: [SRC], bundle: false, write: false, format: 'esm', loader: { '.ts': 'ts' } });
writeFileSync(TMP, hasilBuild.outputFiles[0].text);
const { extractSourceTrace } = await import(pathToFileURL(TMP).href + '?v=' + Date.now());
console.log('uji-trace-parser-kendali-tetap v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`); if (!ok) gagal++; };

const jawabanLive = [
  'TUGAS YANG DIKERJAKAN: TASK-0014 — "Berkas: IntentClassifier.js (77 baris, fungsi detectIntent)."',
  '',
  'TUGAS-02 meminta untuk membaca fungsi detectIntent dalam berkas itu.',
  '',
  '[MAMET_CMD: git show HEAD:frontend/src/core/runtime/services/engineer/IntentClassifier.js]',
].join('\n');
let r = extractSourceTrace(jawabanLive);
cek(r.replyWithoutTrace.length > 0, 'jawaban live TIDAK lagi jadi kosong (dulu diblokir HARD GATE)', r);
cek(/MAMET_CMD/.test(r.replyWithoutTrace), 'isi jawaban utuh, termasuk penanda perintah');
cek(r.sourceTrace === undefined, 'baris pertama ber-ID tidak diperlakukan sebagai SOURCE TRACE');

const jawabanNormal = ['Berikut analisisnya.', 'Rinciannya begini.', '', 'SOURCE TRACE:', '- [ADR-0007] Engineering Metrics'].join('\n');
r = extractSourceTrace(jawabanNormal);
cek(/Berikut analisisnya/.test(r.replyWithoutTrace) && !/SOURCE TRACE/.test(r.replyWithoutTrace), 'SOURCE TRACE di ekor tetap dipisah seperti biasa', r.replyWithoutTrace);
cek(/ADR-0007/.test(r.sourceTrace || ''), 'isi trace tetap terambil');

r = extractSourceTrace(['Jawaban biasa.', '- [DOC-0003] dokumen tugas'].join('\n'));
cek(/Jawaban biasa/.test(r.replyWithoutTrace) && /DOC-0003/.test(r.sourceTrace || ''), 'trace tanpa header tetap dipisah bila ada isi jawaban di atasnya');

cek(extractSourceTrace('Halo, apa kabar?').sourceTrace === undefined, 'jawaban tanpa trace tidak berubah');

const REVISI_SEBELUM_PERBAIKAN = 'abcdced';
const { readFileSync: bacaKendali } = await import('node:fs');
const lamaTs = bacaKendali(new URL(`./kendali-revisi/trace_parser-${REVISI_SEBELUM_PERBAIKAN}.ts.txt`, import.meta.url), 'utf8');
const TMP_LAMA = TMP.replace('_trace_parser', '_trace_parser_lama');
writeFileSync(TMP_LAMA + '.ts', lamaTs);
const buildLama = await build({ entryPoints: [TMP_LAMA + '.ts'], bundle: false, write: false, format: 'esm', loader: { '.ts': 'ts' } });
writeFileSync(TMP_LAMA, buildLama.outputFiles[0].text);
const lama = await import(pathToFileURL(TMP_LAMA).href + '?v=' + Date.now());
const rLama = lama.extractSourceTrace(jawabanLive);
cek(rLama.replyWithoutTrace === '', 'KENDALI: versi lama memang mengosongkan jawaban (gejalanya nyata)', rLama.replyWithoutTrace);
cek(/Berikut analisisnya/.test(lama.extractSourceTrace(jawabanNormal).replyWithoutTrace),
  'KENDALI: versi lama sudah benar untuk trace di ekor — perilaku itu tidak berubah');
console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
