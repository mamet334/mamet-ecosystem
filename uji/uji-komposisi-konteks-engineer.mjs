
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');

console.log('uji-komposisi-konteks-engineer v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const dir = mkdtempSync(join(tmpdir(), 'uji-komposisi-'));
try {
  writeFileSync(join(dir, 'stub.mjs'), 'export const eventBus={emit(){},subscribe(){}};export const CapabilityRegistry={};export const RuntimeContext={};export const pesanSemuaPenyediaGagal=()=>"";');
  let src = baca('supabase/functions/agent-process/lib/llm_orchestrator.ts')
    .replace("'./runtime_context.ts'", "'./stub.mjs'")
    .replace("'./event/event_bus.ts'", "'./stub.mjs'")
    .replace("'./adapters/adapter_registry.ts'", "'./stub.mjs'")
    .replace("'./streaming/pesan_gagal_stream.ts'", "'./stub.mjs'");
  const { code } = await esbuild.transform(src, { loader: 'ts', format: 'esm' });
  writeFileSync(join(dir, 'o.mjs'), code);
  const { catatKomposisiPrompt } = await import(pathToFileURL(join(dir, 'o.mjs')).href);

  const MEMORI = 300;
  const ENGINEER = 14000;
  const sistem =
    'IDENTITAS'.padEnd(600, '.') +
    '\n[MEMORI & PREFERENSI PERSONAL]:\n' + 'm'.repeat(MEMORI) +
    '\n[MAMET ENGINEER CONTEXT — Two-Brain Model]\n' + 'E'.repeat(ENGINEER) +
    '\n[UNIVERSAL EVIDENCE CONTRACT v1]\n' + 'k'.repeat(500) +
    '\n[BLOK 5: X]\n' + 'c'.repeat(200);

  const asli = console.log;
  let baris = '';
  console.log = (t) => { baris += String(t); };
  try { catatKomposisiPrompt('apa itu rls?', sistem, [{ content: 'x'.repeat(50) }]); }
  finally { console.log = asli; }

  cek(/^\[PROMPT_KOMPOSISI\]/.test(baris), 'baris komposisi tercatat', baris.slice(0, 80));
  const ukuran = JSON.parse(baris.match(/\{.*?\}/)[0]);

  console.log('\n-- konteks Engineer punya namanya sendiri --');
  cek('konteks_engineer' in ukuran, 'segmen konteks_engineer MUNCUL', Object.keys(ukuran));
  cek(ukuran.konteks_engineer > ENGINEER * 0.9,
    `ukurannya mendekati blok Engineer yang sebenarnya (${ukuran.konteks_engineer} vs ${ENGINEER})`, ukuran);

  console.log('\n-- memori personal kembali ke ukuran sebenarnya --');
  cek(ukuran.memori_personal_klien < MEMORI + 200,
    `tidak lagi menelan konteks Engineer (${ukuran.memori_personal_klien}, bukan belasan ribu)`, ukuran);
  cek(ukuran.memori_personal_klien < ukuran.konteks_engineer / 10,
    'selisihnya tegas — kebisuan yang membuat 18.195 tampak sebagai "memori personal" tertutup', ukuran);

  console.log('\n-- segmen lain tidak terganggu --');
  for (const nama of ['dasar_identitas_panduan', 'kontrak_blok1_2', 'blok5_constraint']) {
    cek(nama in ukuran && ukuran[nama] > 0, `${nama} tetap terukur`, ukuran);
  }
  cek(Object.values(ukuran).reduce((a, b) => a + b, 0) === sistem.length,
    'jumlah seluruh segmen = panjang prompt sistem — tak ada huruf yang hilang atau dihitung dua kali',
    { jumlah: Object.values(ukuran).reduce((a, b) => a + b, 0), sistem: sistem.length });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('\n-- dicari dari awal --');
{
  const O = baca('supabase/functions/agent-process/lib/llm_orchestrator.ts');
  cek(/\['konteks_engineer', s\.indexOf\('\[MAMET ENGINEER CONTEXT'\)\]/.test(O),
    'memakai s.indexOf dari awal, bukan cari() yang mulai dari kontrak',
    (O.match(/.*konteks_engineer.*/g) || []));
  cek(!/\['konteks_engineer', cari\(/.test(O), 'tidak memakai cari() untuk penanda yang ada sebelum kontrak');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
