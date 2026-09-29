// UJI 2026-09-29 — T14: nama penyedia hulu disimpan per pesan.
//
// Terukur 28 September: satu nama model (`deepseek-v4-flash`) dilayani DELAPAN penyedia berbeda dalam
// 4 jam. Gaya jawaban, biaya, dan latensi berayun tanpa satu baris kode pun berubah — panggilan hakim
// pertama $0,002213/108 detik, sesudahnya $0,000033–0,000121/1,8–7,2 detik di penyedia lain.
//
// Selama ini namanya hanya masuk log. Log berumur pendek; pesan tersimpan selamanya. Akibatnya
// pertanyaan "apakah penyedia X terasa lebih buruk" TIDAK PERNAH bisa dijawab data — dan perubahan mutu
// yang dirasakan gampang ditimpakan ke perubahan kode yang sebenarnya tidak berpengaruh.
//
// Keputusan Owner 28 September: SIMPAN nama penyedia per pesan; penyedianya JANGAN dikunci.
//
// Bahaya utama di sini bukan salah hitung, melainkan **dua sisi memakai nama field berbeda** — server
// mengirim satu nama, layar membaca nama lain, dan yang tersimpan kosong selamanya tanpa gejala.
// Itulah yang dijaga paling ketat di bawah.

import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
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

// ── 1. Penyedianya ditangkap di KEDUA jalur ──────────────────────────────────────────────────
console.log('\n-- ditangkap di adapter --');

cek(/if \(typeof data\.provider === 'string' && data\.provider\) this\.rctx\.penyediaHulu = data\.provider;/.test(ADAPTER),
  'jalur non-stream mencatat penyedia ke rctx', (ADAPTER.match(/penyediaHulu = [^\n]*/g) || []));
cek(/if \(infoStream\.provider\) this\.rctx\.penyediaHulu = infoStream\.provider;/.test(ADAPTER),
  'jalur stream mencatat penyedia ke rctx');

// Jalur stream hanya tahu penyedianya SESUDAH aliran selesai — pencatatannya harus sesudah loop.
const iLoopSelesai = ADAPTER.indexOf('const promptTokens = Math.ceil(JSON.stringify(messages || []).length / 4);');
const iCatatStream = ADAPTER.indexOf('if (infoStream.provider) this.rctx.penyediaHulu');
cek(iLoopSelesai > 0 && iCatatStream > iLoopSelesai,
  'pencatatan jalur stream terjadi SESUDAH aliran selesai (sebelum itu penyedianya belum diketahui)');

// Keputusan Owner: JANGAN kunci penyedianya.
cek(!/provider\s*:\s*\{[^}]*\b(order|only)\b/.test(ADAPTER),
  'penyedia TIDAK dikunci (tak ada provider.order/provider.only) — keputusan Owner 28 Sep', (ADAPTER.match(/provider\s*:\s*\{[^}]*\}/g) || []));

// ── 2. KONTRAK ANTAR-SISI: nama field harus sama ─────────────────────────────────────────────
// Kegagalan paling mungkin: server mengirim `penyedia`, layar membaca `provider` (atau sebaliknya),
// dan yang tersimpan kosong selamanya tanpa gejala apa pun.
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

// ── 3. Bingkainya tidak boleh muncul sebagai teks jawaban ────────────────────────────────────
console.log('\n-- tidak mengotori jawaban --');

cek(/const enqueueData = \(obj: Record<string, unknown>\) => \{/.test(STREAM),
  'ada pengirim bingkai data yang terpisah dari pengirim teks');
const blokData = STREAM.slice(STREAM.indexOf('const enqueueData'), STREAM.indexOf('const enqueueData') + 220);
cek(!/choices/.test(blokData),
  'bingkai data TIDAK memakai bentuk `choices[].delta.content` — jadi layar tidak membacanya sebagai teks', blokData);

// Layar hanya menambah teks bila ada `text` atau `choices[].delta.content`; bingkai penyedia tak punya
// keduanya, jadi `chunkText` tetap kosong. Dijaga supaya tidak ada yang menambahkan cabang baru.
cek(/if \(chunkText\) aiResponseText \+= chunkText;/.test(AS),
  'layar hanya menambah teks bila bingkainya memang berisi teks');

// Dikirim SESUDAH jawaban & koreksi label, sebelum [DONE].
const iLabel = STREAM.indexOf('[LABEL] gagal memeriksa label');
const iPenyedia = STREAM.indexOf('if (rctx.penyediaHulu) enqueueData(');
// `[DONE]` dikirim dari dalam closeSafely(), yang DIDEFINISIKAN di atas tetapi DIPANGGIL di `finally`
// paling bawah. Jadi yang harus dibandingkan adalah letak PEMANGGILANNYA, bukan definisinya — versi
// pertama uji ini merah justru karena mengira urutan teks sama dengan urutan jalannya.
const iTutupDipanggil = STREAM.indexOf('await closeSafely();');
cek(iLabel > 0 && iPenyedia > iLabel, 'penyedia dikirim SESUDAH teks jawaban & koreksi label');
cek(iPenyedia > 0 && iTutupDipanggil > iPenyedia,
  'dikirim sebelum closeSafely() (yang mengirim [DONE]) — kalau sesudahnya, layar sudah berhenti membaca',
  { iPenyedia, iTutupDipanggil });
cek(/\} finally \{\s*await closeSafely\(\);/.test(STREAM),
  'closeSafely dipanggil di finally — [DONE] tetap terkirim walau ada galat di tengah');

// Kegagalan mengirim penyedia tidak boleh menggagalkan jawaban.
const blokKirim = STREAM.slice(iPenyedia - 260, iPenyedia + 260);
cek(/try \{[\s\S]*enqueueData\(\{ penyedia[\s\S]*\} catch/.test(blokKirim),
  'kegagalannya ditangkap — jawaban yang sudah benar tidak boleh batal karena keterangan tambahan', blokKirim);

// ── 4. Sampai ke metadata pesan ──────────────────────────────────────────────────────────────
console.log('\n-- tersimpan di pesan --');

cek(/onDone\?\.\(finalText, processingSteps, penyedia \? \{ penyedia \} : null,/.test(AS),
  'metadata jalur stream kini membawa penyedia (dulu SELALU null)', (AS.match(/onDone\?\.\(finalText[^\n]*/g) || []));
cek(/metadata: jsonMetadata/.test(CE), 'layar menyimpan metadata itu di pesan');
cek(/simpanTerlantar\(\{ content: finalText, steps, metadata: jsonMetadata/.test(CE),
  'jawaban yang masuk saat Owner membaca percakapan lain pun membawa metadatanya');

// Bila penyedianya tidak dilaporkan, jangan mengarang field kosong.
cek(/penyedia \? \{ penyedia \} : null/.test(AS),
  'tanpa penyedia → metadata tetap null, bukan objek berisi nilai kosong');
cek(/\.\.\.\(rctx\.penyediaHulu \? \{ penyedia: rctx\.penyediaHulu \} : \{\}\)/.test(SYNTH),
  'jalur non-stream juga menyertakannya hanya bila ada');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
