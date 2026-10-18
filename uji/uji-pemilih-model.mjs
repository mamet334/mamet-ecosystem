// UJI 2026-10-18 — penanda SIAPA yang memilih model sampai ke `cost_ledger`, dan kosakatanya tidak
// menyimpang antara klien, server, dan migrasi.
//
// Kenapa penanda ini ada (Item 126, Data Flywheel Fase 0): North Star roda gila adalah "biaya per
// jawaban berhasil". Diukur 18 Okt 2026 pada data nyata, angka itu TERCEMAR — **74,3%** seluruh
// biaya berasal dari `deepseek-v4-pro` yang **Owner pilih sendiri** di Settings, dan harganya **7x
// per token** dibanding `flash`. Tanpa membedakan pemilihnya, metrik itu mengukur selera Owner,
// bukan kepintaran sistem: bulan dengan Owner yang sedang memakai model mahal terlihat seperti
// sistem yang memburuk, padahal sistem tidak melakukan apa pun yang salah.
//
// Yang dijaga berkas ini, dan masing-masing punya cara gagal sendiri:
//
//   1. SAMPAI KE UJUNG   — 8 titik `recordUsage` di ai_adapter semuanya membawa penanda. Satu yang
//                          terlewat = sebagian biaya tak bertuan, dan rata-rata jadi bohong.
//   2. TIDAK DITEBAK     — tak ada nilai bawaan di jalur mana pun. Menebak "owner-settings" untuk
//                          klien yang diam membuat cakupan penanda terlihat 100% padahal separuhnya
//                          karangan — persis jenis kebohongan yang paling sulit ketahuan.
//   3. TIDAK MENYIMPANG  — kosakata di klien, server, dan komentar migrasi harus SAMA PERSIS.
//                          Ini yang paling mudah rusak: seseorang menambah 'auto' di klien, dan
//                          kueri bulanan diam-diam melewatkan barisnya.
//   4. TIDAK BISA GAGAL DIAM-DIAM — migrasi sengaja TANPA CHECK constraint. `recordUsage` dipanggil
//                          lewat `rctx.tasks.fire()` yang tidak menunggu hasilnya; insert yang
//                          ditolak constraint akan hilang tanpa suara dan mematikan pencatatan biaya.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');

/**
 * Buang komentar sebelum memeriksa KODE. `\r` sudah dinormalkan di `baca()` — tanpa itu
 * `/^[ \t]*\/\/.*$/m` gagal pada berkas CRLF karena `.` tidak cocok dengan `\r`
 * (pelajaran `uji-salinan-mametlite.mjs` dan `uji-pesan-galat-ecosystem.mjs`).
 *
 * Batasnya: hanya komentar blok dan baris yang SELURUHNYA komentar. Komentar yang menempel di
 * belakang kode tidak dibuang — membuangnya menuntut tahu mana `//` di dalam string atau regex,
 * dan salah potong di situ menghapus kode sungguhan lalu memberi hijau palsu.
 */
const tanpaKomentar = (kode) =>
  kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

console.log('uji-pemilih-model v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(
    `${ok ? 'LULUS' : 'GAGAL'}  ${pesan}` +
      (!ok && rinci !== undefined ? `\n       -> ${String(rinci).slice(0, 300)}` : ''),
  );
  if (!ok) gagal++;
};

const MIGRASI = 'supabase/migrations/20261018000000_pemilih_model.sql';
const migrasi = baca(MIGRASI);
const adapter = tanpaKomentar(baca('supabase/functions/agent-process/lib/adapters/ai_adapter.ts'));
const tracker = tanpaKomentar(baca('supabase/functions/agent-process/lib/cost/costTracker.ts'));
const parser = tanpaKomentar(baca('supabase/functions/agent-process/lib/request/request_parser.ts'));
const pipeline = tanpaKomentar(baca('supabase/functions/agent-process/lib/request/request_pipeline.ts'));
const rctxDef = tanpaKomentar(baca('supabase/functions/agent-process/lib/runtime_context.ts'));
const hakim = tanpaKomentar(baca('supabase/functions/agent-process/lib/request/judge_endpoint.ts'));
const padatkan = tanpaKomentar(baca('supabase/functions/agent-process/lib/request/padatkan_endpoint.ts'));
const klien = tanpaKomentar(baca('frontend/src/core/runtime/services/AssistantService.js'));

// ── 1. Kolomnya ada, dan sengaja TANPA CHECK ────────────────────────────────────────────────────
console.log('\n-- 1. migrasi: kolom ada, tanpa CHECK, NULL dibiarkan --');

cek(/alter table public\.cost_ledger/i.test(migrasi) && /add column if not exists pemilih_model text/i.test(migrasi),
  'kolom `pemilih_model` ditambahkan ke cost_ledger');
cek(!/\bcheck\s*\(/i.test(migrasi),
  'TIDAK ada CHECK constraint — insert ditolak akan hilang tanpa suara lewat tasks.fire()');
cek(!/update public\.cost_ledger\s+set/i.test(migrasi),
  'baris lama TIDAK diisi tebakan — NULL dibiarkan supaya cakupan penanda jujur');
cek(/comment on column public\.cost_ledger\.pemilih_model/i.test(migrasi),
  'kolomnya punya komentar di basis data, bukan hanya di repo');

// ── 2. Sampai ke ujung: 8 dari 8 titik recordUsage ─────────────────────────────────────────────
console.log('\n-- 2. semua titik pencatatan membawa penanda --');

const titik = (adapter.match(/recordUsage\(\{/g) || []).length;
const bertanda = (adapter.match(/pemilihModel:\s*this\.rctx\.model\?\.pemilih/g) || []).length;
cek(titik > 0 && titik === bertanda,
  `SEMUA ${titik} titik recordUsage membawa pemilihModel (${bertanda})`, { titik, bertanda });

cek(/pemilihModel\??:/.test(tracker), 'costTracker menerima pemilihModel');
cek(/pemilih_model:\s*pemilihModel\s*\|\|\s*null/.test(tracker),
  'dan menuliskannya sebagai kolom, dengan `|| null` — bukan nilai bawaan');
// Dijangkar ke pernyataan destrukturisasi `recordUsage` yang sesungguhnya. Bentuk pertama asersi
// ini memotong 400 huruf dari `const {` PERTAMA di berkas — yang ternyata milik `checkGuardrails`
// (`const { data: config }`), jadi ia memerah pada kode yang benar. Jendela seukuran-huruf mengukur
// jarak, bukan kebenaran; jangkar yang benar adalah pernyataannya sendiri.
cek(/const \{[^}]*\bpemilihModel\b[^}]*\} = usage as any/.test(tracker),
  'pemilihModel benar-benar didestrukturisasi dari argumen recordUsage (bukan hanya ada di antarmuka)');

// ── 3. Tidak ditebak di jalur mana pun ──────────────────────────────────────────────────────────
console.log('\n-- 3. tidak ada nilai bawaan yang menebak --');

cek(/pemilih\?:\s*string/.test(rctxDef), 'ModelConfig punya medan `pemilih`');
cek(/pemilih:\s*parsed\.pemilihModel\b/.test(pipeline),
  'request_pipeline meneruskan apa adanya dari klien');
cek(!/pemilih:\s*parsed\.pemilihModel\s*\|\|/.test(pipeline),
  'TANPA fallback — klien yang diam tercatat NULL, bukan ditebak "owner-settings"');
cek(/pemilihModel/.test(parser), 'request_parser membaca & meneruskan medannya');
cek(!/pemilihModel\s*=\s*['"]/.test(parser),
  'parser tidak memberi nilai bawaan pada medan itu');

// ── 4. Panggilan internal jujur menyebut dirinya sistem ─────────────────────────────────────────
console.log('\n-- 4. hakim bayangan & pemadat konteks menandai diri sebagai sistem --');

cek(/pemilih:\s*'sistem'/.test(hakim), 'judge_endpoint menandai `sistem`');
cek(/pemilih:\s*'sistem'/.test(padatkan), 'padatkan_endpoint menandai `sistem`');

// ── 5. Klien: tiga cabang keputusan, tiga payload ───────────────────────────────────────────────
console.log('\n-- 5. klien menandai di tempat keputusan terjadi --');

cek(/const pemilihModel = isEngineerMode/.test(klien),
  'penanda dihitung di blok tier, tempat keputusannya benar-benar diambil');
for (const nilai of ['owner-settings', 'owner-override', 'tier-auto']) {
  cek(klien.includes(`'${nilai}'`), `cabang "${nilai}" ada di klien`);
}
cek(/modelTierOverride\s*$|modelTierOverride\s*\n\s*\?\s*'owner-override'/.test(klien) || /modelTierOverride[\s\S]{0,40}'owner-override'/.test(klien),
  'pil tier Owner dipetakan ke owner-override, bukan tier-auto');
cek(/selectedTier[\s\S]{0,40}'tier-auto'/.test(klien),
  'classifier dipetakan ke tier-auto');

// TIGA payload yang benar-benar memanggil LLM: LOOKUP, skill, dan chat utama. Payload keempat di
// berkas ini milik `saveChatToDB` — ia menyimpan percakapan, bukan memanggil model, jadi ia memang
// TIDAK boleh ikut ditandai. Angkanya dipatok tepat 3, bukan "minimal": bila suatu hari ada jalur
// LLM baru, uji ini memerah dan menagih penandanya — itu gunanya.
const payloadBerpenanda = (klien.match(/pemilihModel[,:]/g) || []).length;
cek(payloadBerpenanda === 3,
  `tepat 3 payload LLM membawa penanda (${payloadBerpenanda})`, payloadBerpenanda);
cek(/pemilihModel:\s*'tier-auto'/.test(klien),
  'jalur LOOKUP (tier KECIL dipaku kode) ditandai tier-auto — keputusan sistem');
cek(/pemilihModel:\s*'owner-settings'/.test(klien),
  'jalur skill (model utama Settings) ditandai owner-settings — keputusan Owner');

// ── 6. Kosakata tidak boleh menyimpang ──────────────────────────────────────────────────────────
console.log('\n-- 6. kosakata klien + server == kosakata migrasi --');

const KOSAKATA = ['owner-settings', 'owner-override', 'tier-auto', 'sistem'];
for (const nilai of KOSAKATA) {
  cek(migrasi.includes(nilai), `migrasi mendokumentasikan "${nilai}"`);
}

// Nilai apa pun yang dipakai kode TAPI tidak ada di migrasi = penyimpangan diam-diam.
const dipakaiKlien = [...klien.matchAll(/pemilihModel\s*:\s*'([a-z-]+)'/g)].map((m) => m[1]);
const dipakaiServer = [...(hakim + padatkan).matchAll(/pemilih\s*:\s*'([a-z-]+)'/g)].map((m) => m[1]);
const cabangKlien = [...klien.matchAll(/\?\s*'(owner-settings|owner-override|tier-auto|sistem)'/g)].map((m) => m[1]);
const semua = [...new Set([...dipakaiKlien, ...dipakaiServer, ...cabangKlien])];
const liar = semua.filter((v) => !KOSAKATA.includes(v));
cek(liar.length === 0, `tak ada nilai di luar kosakata resmi (dipakai: ${semua.join(', ')})`, liar);

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
