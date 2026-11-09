
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');

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

console.log('\n-- 1. migrasi: kolom ada, tanpa CHECK, NULL dibiarkan --');

cek(/alter table public\.cost_ledger/i.test(migrasi) && /add column if not exists pemilih_model text/i.test(migrasi),
  'kolom `pemilih_model` ditambahkan ke cost_ledger');
cek(!/\bcheck\s*\(/i.test(migrasi),
  'TIDAK ada CHECK constraint — insert ditolak akan hilang tanpa suara lewat tasks.fire()');
cek(!/update public\.cost_ledger\s+set/i.test(migrasi),
  'baris lama TIDAK diisi tebakan — NULL dibiarkan supaya cakupan penanda jujur');
cek(/comment on column public\.cost_ledger\.pemilih_model/i.test(migrasi),
  'kolomnya punya komentar di basis data, bukan hanya di repo');

console.log('\n-- 2. semua titik pencatatan membawa penanda --');

const titik = (adapter.match(/recordUsage\(\{/g) || []).length;
const bertanda = (adapter.match(/pemilihModel:\s*this\.rctx\.model\?\.pemilih/g) || []).length;
cek(titik > 0 && titik === bertanda,
  `SEMUA ${titik} titik recordUsage membawa pemilihModel (${bertanda})`, { titik, bertanda });

cek(/pemilihModel\??:/.test(tracker), 'costTracker menerima pemilihModel');
cek(/pemilih_model:\s*pemilihModel\s*\|\|\s*null/.test(tracker),
  'dan menuliskannya sebagai kolom, dengan `|| null` — bukan nilai bawaan');
cek(/const \{[^}]*\bpemilihModel\b[^}]*\} = usage as any/.test(tracker),
  'pemilihModel benar-benar didestrukturisasi dari argumen recordUsage (bukan hanya ada di antarmuka)');

console.log('\n-- 3. tidak ada nilai bawaan yang menebak --');

cek(/pemilih\?:\s*string/.test(rctxDef), 'ModelConfig punya medan `pemilih`');
cek(/pemilih:\s*parsed\.pemilihModel\b/.test(pipeline),
  'request_pipeline meneruskan apa adanya dari klien');
cek(!/pemilih:\s*parsed\.pemilihModel\s*\|\|/.test(pipeline),
  'TANPA fallback — klien yang diam tercatat NULL, bukan ditebak "owner-settings"');
cek(/pemilihModel/.test(parser), 'request_parser membaca & meneruskan medannya');
cek(!/pemilihModel\s*=\s*['"]/.test(parser),
  'parser tidak memberi nilai bawaan pada medan itu');

console.log('\n-- 4. hakim bayangan & pemadat konteks menandai diri sebagai sistem --');

cek(/pemilih:\s*'sistem'/.test(hakim), 'judge_endpoint menandai `sistem`');
cek(/pemilih:\s*'sistem'/.test(padatkan), 'padatkan_endpoint menandai `sistem`');

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

const payloadBerpenanda = (klien.match(/pemilihModel[,:]/g) || []).length;
cek(payloadBerpenanda === 3,
  `tepat 3 payload LLM membawa penanda (${payloadBerpenanda})`, payloadBerpenanda);
cek(/pemilihModel:\s*'tier-auto'/.test(klien),
  'jalur LOOKUP (tier KECIL dipaku kode) ditandai tier-auto — keputusan sistem');
cek(/pemilihModel:\s*'owner-settings'/.test(klien),
  'jalur skill (model utama Settings) ditandai owner-settings — keputusan Owner');

console.log('\n-- 6. kosakata klien + server == kosakata migrasi --');

const KOSAKATA = ['owner-settings', 'owner-override', 'tier-auto', 'sistem'];
for (const nilai of KOSAKATA) {
  cek(migrasi.includes(nilai), `migrasi mendokumentasikan "${nilai}"`);
}

const dipakaiKlien = [...klien.matchAll(/pemilihModel\s*:\s*'([a-z-]+)'/g)].map((m) => m[1]);
const dipakaiServer = [...(hakim + padatkan).matchAll(/pemilih\s*:\s*'([a-z-]+)'/g)].map((m) => m[1]);
const cabangKlien = [...klien.matchAll(/\?\s*'(owner-settings|owner-override|tier-auto|sistem)'/g)].map((m) => m[1]);
const semua = [...new Set([...dipakaiKlien, ...dipakaiServer, ...cabangKlien])];
const liar = semua.filter((v) => !KOSAKATA.includes(v));
cek(liar.length === 0, `tak ada nilai di luar kosakata resmi (dipakai: ${semua.join(', ')})`, liar);

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
