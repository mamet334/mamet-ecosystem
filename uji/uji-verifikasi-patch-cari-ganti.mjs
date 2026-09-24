// UJI T10 (2026-09-22) — pemeriksa server PATCH_ENGINEERING menerima patch cari-ganti (bentuk PatchGenerator.js).
// Teks jawaban model PERSIS dari log live yang dulu diblokir "must be a string, got object".
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';
const akar = 'D:/SLAMET/other/mamet os ecosystem';
const keluar = path.join(os.tmpdir(), `uji-ve-${Date.now()}.mjs`);
execFileSync(process.execPath, [path.join(akar, 'frontend/node_modules/esbuild/bin/esbuild'),
  path.join(akar, 'supabase/functions/agent-process/lib/verification/verification_engine.ts'),
  '--bundle', '--format=esm', '--platform=neutral', '--external:https://*', '--external:npm:*', `--outfile=${keluar}`, '--log-level=error']);
const { VerificationEngine: V } = await import(pathToFileURL(keluar).href);
console.log('uji-verifikasi-patch-cari-ganti v1');
let gagal = 0; const cek = (ok, pesan, rinci) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      → ${JSON.stringify(rinci).slice(0, 300)}` : ''}`); if (!ok) gagal++; };
const log = console.log; const periksa = (teks) => { console.log = () => {}; try { return V.verifyPatchEngineering({ responseText: teks, runtimeContext: { mode: 'ENGINEER' } }); } finally { console.log = log; } };
const p02 = (r) => r.checks.find((c) => c.id === 'CHECK_P02_VALID_JSON_PATCH_FORMAT');

const live = JSON.stringify({
  'frontend/src/core/runtime/services/SkillGuardService.js': {
    __mode: 'search_replace',
    changes: [{ search: "* - Action yang butuh aksi berdampak ('write') → REQUIRE_CONFIRMATION via CommandRegistry (PR#1).", replace: "* - Action yang butuh aksi berdampak ('write') tidak lagi didukung." }],
  },
}, null, 2);
let r = periksa(live);
cek(r.decision === 'PASS' && p02(r).status === 'PASS', 'live: patch cari-ganti satu baris → PASS (dulu FAIL "got object")', { d: r.decision, p02: p02(r).message });

r = periksa(JSON.stringify({ 'frontend/a.js': 'export const a = 1;\n' }));
cek(r.decision === 'PASS', 'patch teks biasa tetap PASS');
r = periksa(JSON.stringify({ 'frontend/a.js': 'export const a = 1;\n', 'frontend/b.js': { __mode: 'search_replace', changes: [{ search: 'x', replace: 'y' }] } }));
cek(r.decision === 'PASS' && /2 file/.test(p02(r).message), 'patch campuran teks + cari-ganti → keduanya dihitung', p02(r).message);

for (const [nama, isi] of [
  ['objek tanpa __mode', { 'frontend/a.js': { foo: 1 } }],
  ['changes kosong', { 'frontend/a.js': { __mode: 'search_replace', changes: [] } }],
  ['search kosong', { 'frontend/a.js': { __mode: 'search_replace', changes: [{ search: '', replace: 'y' }] } }],
  ['replace bukan teks', { 'frontend/a.js': { __mode: 'search_replace', changes: [{ search: 'x', replace: 3 }] } }],
]) {
  r = periksa(JSON.stringify(isi));
  cek(r.decision === 'FAIL', `ditolak: ${nama}`, p02(r)?.message);
}

// Pindai kode berbahaya kini membaca isi "replace" (dulu "[object Object]")
r = periksa(JSON.stringify({ 'frontend/a.js': { __mode: 'search_replace', changes: [{ search: 'x', replace: 'const f = eval(input);' }] } }));
cek(r.decision === 'FAIL' && r.checks.some((c) => c.id === 'CHECK_P03_NO_DANGEROUS_PATTERNS' && c.status === 'FAIL'), 'eval() di dalam "replace" tertangkap pindai P03', r.checks.map((c) => `${c.id}:${c.status}`));

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
