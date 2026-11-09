
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
const baca = (p) => readFileSync(`${AKAR}/${p}`, 'utf8').replace(/\r\n/g, '\n');

console.log('uji-spanduk-patch-tunggal v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const CE = baca('frontend/src/components/workbench/ConversationEngine.jsx');
const ENG = baca('frontend/src/core/runtime/services/engineer.js');
const APPLIER = baca('frontend/src/core/runtime/services/engineer/PatchApplier.js');

console.log('\n-- spanduk kedua --');

const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');
const CE_KODE = tanpaKomentar(CE);

cek(!/Patch Berhasil Diterapkan/.test(CE_KODE),
  'layar tidak lagi menggambar "Patch Berhasil Diterapkan"', (CE_KODE.match(/.*Patch Berhasil Diterapkan.*/g) || []));

cek(!/sesuai instruksi Anda/.test(CE_KODE),
  'klaim "sesuai instruksi Anda" hilang — tak ada kode yang pernah memeriksanya',
  (CE_KODE.match(/.*sesuai instruksi Anda.*/g) || []));

cek(!/rec\.type === 'PATCH_APPLIED'/.test(CE_KODE),
  'tidak ada cabang PATCH_APPLIED di komponen layar', (CE_KODE.match(/.*PATCH_APPLIED.*/g) || []));

console.log('\n-- tetangganya utuh --');

cek(/(?<!else )if \(rec\.type === 'PATCH_REJECTED'\) \{/.test(CE),
  'PATCH_REJECTED kini memimpin rantai, bukan `else if` yatim', (CE.match(/.*PATCH_REJECTED.*/g) || []));
cek(/Patch Ditolak/.test(CE), 'patch yang ditolak masih diumumkan');
cek(/Patch Gagal/.test(CE), 'patch yang gagal masih diumumkan');
for (const t of ['CAPABILITY_BLOCKED', 'REASONING_REJECTED', 'ASK_CLARIFICATION']) {
  cek(CE.includes(`rec.type === '${t}'`), `cabang ${t} tidak ikut terbawa`);
}

console.log('\n-- jalur yang dipertahankan --');

cek(/Patch Berhasil!/.test(CE), 'spanduk "Patch Berhasil!" tetap ada');
cek(/Patch dibatalkan sendiri/.test(CE), 'spanduk pemulihan Tahap 6 tetap ada');
cek(/data\?\.verifikasi\?\.laporan/.test(CE), 'laporan verifikasi tetap ditempel apa adanya');
cek(/eventBus\.on\('Engineer:PatchApplied', patchAppliedHandler\)/.test(CE),
  'pendengarnya masih terpasang');

cek(/\n    eventBus\.emit\('Engineer:PatchApplied', result\);/.test(APPLIER),
  'Engineer:PatchApplied dipancarkan tanpa syarat (bukan di dalam if)',
  (APPLIER.match(/.*Engineer:PatchApplied.*/g) || []));

console.log('\n-- catatan tetap dipancarkan --');

cek(/if \(!dipulihkan\) \{\s*this\._emitRecommendation\(\{\s*type: 'PATCH_APPLIED'/.test(ENG),
  'engineer.js masih memancarkan PATCH_APPLIED sebagai catatan, tetap dijaga !dipulihkan',
  (ENG.match(/.*PATCH_APPLIED.*/g) || []));

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
