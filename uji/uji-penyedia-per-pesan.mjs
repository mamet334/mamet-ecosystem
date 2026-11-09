
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
const baca = (p) => readFileSync(`${AKAR}/${p}`, 'utf8');

console.log('uji-penyedia-per-pesan v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const ADAPTER = baca('supabase/functions/agent-process/lib/adapters/ai_adapter.ts');
const STREAM = baca('supabase/functions/agent-process/lib/stream_handler.ts');
const SYNTH = baca('supabase/functions/agent-process/lib/orchestration/handlers/synthesis_handler.ts');
const AS = baca('frontend/src/core/runtime/services/AssistantService.js');
const CE = baca('frontend/src/components/workbench/ConversationEngine.jsx');

console.log('\n-- ditangkap di adapter --');

cek(/if \(typeof data\.provider === 'string' && data\.provider\) this\.rctx\.penyediaHulu = data\.provider;/.test(ADAPTER),
  'jalur non-stream mencatat penyedia ke rctx', (ADAPTER.match(/penyediaHulu = [^\n]*/g) || []));
cek(/if \(infoStream\.provider\) this\.rctx\.penyediaHulu = infoStream\.provider;/.test(ADAPTER),
  'jalur stream mencatat penyedia ke rctx');

const iLoopSelesai = ADAPTER.indexOf('const promptTokens = Math.ceil(JSON.stringify(messages || []).length / 4);');
const iCatatStream = ADAPTER.indexOf('if (infoStream.provider) this.rctx.penyediaHulu');
cek(iLoopSelesai > 0 && iCatatStream > iLoopSelesai,
  'pencatatan jalur stream terjadi SESUDAH aliran selesai (sebelum itu penyedianya belum diketahui)');

cek(!/provider\s*:\s*\{[^}]*\b(order|only)\b/.test(ADAPTER),
  'penyedia TIDAK dikunci (tak ada provider.order/provider.only) — keputusan Owner 28 Sep', (ADAPTER.match(/provider\s*:\s*\{[^}]*\}/g) || []));

console.log('\n-- kontrak server <-> layar --');

const namaServer = (STREAM.match(/enqueueData\(\{\s*(\w+)\s*:/) || [])[1];
const namaLayar = (AS.match(/typeof parsed\.(\w+) === 'string' && parsed\.\w+\)\s*penyedia =/) || [])[1];
cek(!!namaServer, 'server mengirim bingkai data berisi satu field', namaServer);
cek(!!namaLayar, 'layar membaca satu field dari bingkai data', namaLayar);
cek(namaServer === namaLayar,
  `nama field SAMA di kedua sisi (server: "${namaServer}", layar: "${namaLayar}")`, { namaServer, namaLayar });

const namaJson = (SYNTH.match(/\{ (\w+): rctx\.penyediaHulu \}/) || [])[1];
cek(namaJson === namaLayar,
  `jalur non-stream memakai nama field yang sama juga ("${namaJson}")`, { namaJson, namaLayar });

console.log('\n-- tidak mengotori jawaban --');

cek(/const enqueueData = \(obj: Record<string, unknown>\) => \{/.test(STREAM),
  'ada pengirim bingkai data yang terpisah dari pengirim teks');
const blokData = STREAM.slice(STREAM.indexOf('const enqueueData'), STREAM.indexOf('const enqueueData') + 220);
cek(!/choices/.test(blokData),
  'bingkai data TIDAK memakai bentuk `choices[].delta.content` — jadi layar tidak membacanya sebagai teks', blokData);

cek(/if \(chunkText\) aiResponseText \+= chunkText;/.test(AS),
  'layar hanya menambah teks bila bingkainya memang berisi teks');

const iLabel = STREAM.indexOf('[LABEL] gagal memeriksa label');
const iPenyedia = STREAM.indexOf('if (rctx.penyediaHulu) enqueueData(');
const iTutupDipanggil = STREAM.indexOf('await closeSafely();');
cek(iLabel > 0 && iPenyedia > iLabel, 'penyedia dikirim SESUDAH teks jawaban & koreksi label');
cek(iPenyedia > 0 && iTutupDipanggil > iPenyedia,
  'dikirim sebelum closeSafely() (yang mengirim [DONE]) — kalau sesudahnya, layar sudah berhenti membaca',
  { iPenyedia, iTutupDipanggil });
cek(/\} finally \{\s*await closeSafely\(\);/.test(STREAM),
  'closeSafely dipanggil di finally — [DONE] tetap terkirim walau ada galat di tengah');

const blokKirim = STREAM.slice(iPenyedia - 260, iPenyedia + 260);
cek(/try \{[\s\S]*enqueueData\(\{ penyedia[\s\S]*\} catch/.test(blokKirim),
  'kegagalannya ditangkap — jawaban yang sudah benar tidak boleh batal karena keterangan tambahan', blokKirim);

console.log('\n-- tersimpan di pesan --');

cek(/onDone\?\.\(finalText, processingSteps, penyedia \? \{ penyedia \} : null,/.test(AS),
  'metadata jalur stream kini membawa penyedia (dulu SELALU null)', (AS.match(/onDone\?\.\(finalText[^\n]*/g) || []));
cek(/metadata: jsonMetadata/.test(CE), 'layar menyimpan metadata itu di pesan');
cek(/simpanTerlantar\(\{ content: finalText, steps, metadata: jsonMetadata/.test(CE),
  'jawaban yang masuk saat Owner membaca percakapan lain pun membawa metadatanya');

cek(/penyedia \? \{ penyedia \} : null/.test(AS),
  'tanpa penyedia → metadata tetap null, bukan objek berisi nilai kosong');
cek(/\.\.\.\(rctx\.penyediaHulu \? \{ penyedia: rctx\.penyediaHulu \} : \{\}\)/.test(SYNTH),
  'jalur non-stream juga menyertakannya hanya bila ada');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
