// UJI 2026-09-23 — trace_parser.ts: ID di BARIS PERTAMA tidak boleh menghabiskan seluruh jawaban.
// Bahan uji = teks live yang diblokir HARD GATE 2026-09-23 01:53 (CHECK_001 "Response text is empty").
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const SRC = 'D:/SLAMET/other/mamet os ecosystem/supabase/functions/agent-process/lib/coordinator/trace_parser.ts';
const TMP = 'D:/SLAMET/other/mamet os ecosystem/frontend/node_modules/.uji-rag/_trace_parser.mjs';
// TypeScript → JS lewat esbuild (bukan potong-potong teks): yang diuji tetap berkas server yang asli.
const { build } = await import(new URL('frontend/node_modules/esbuild/lib/main.js', new URL('../', import.meta.url)).href); // esbuild ada di frontend/node_modules; dirujuk lewat ALAMAT, bukan nama paket, karena berkas uji ini kini di akar repo (di luar frontend/) — lihat uji/README.md
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

// UJI KENDALI (prosedur langkah 0.7): versi LAMA dari git harus MENUNJUKKAN gejalanya, kalau tidak, uji di atas
// tidak membuktikan apa-apa.
//
// REVISI DIPAKU, BUKAN `HEAD` (diperbaiki 24 September 2026). Versi v3 mengambil `git show HEAD:...`, yang benar
// hanya selama perbaikannya masih di working tree. Begitu perbaikan itu ikut di-commit (47beed1), `HEAD` sudah
// memuat perbaikannya, gejalanya tidak muncul, dan uji kendali ini GAGAL tanpa ada yang rusak. `abcdced` adalah
// commit TEPAT SEBELUM perbaikan trace_parser — jangan diganti ke HEAD lagi.
const REVISI_SEBELUM_PERBAIKAN = 'abcdced';
const { execSync } = await import('node:child_process');
const lamaTs = execSync(`git show ${REVISI_SEBELUM_PERBAIKAN}:supabase/functions/agent-process/lib/coordinator/trace_parser.ts`, {
  cwd: 'D:/SLAMET/other/mamet os ecosystem', encoding: 'utf8', maxBuffer: 1 << 20,
});
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
