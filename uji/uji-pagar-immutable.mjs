// UJI 2026-09-23 (TUGAS-03) — pagar CORE IMMUTABLE benar-benar menggigit di PatchApplier,
// bukan hanya "model sopan menolak". Memanggil modul yang dipakai aplikasi, dengan deps tiruan.
import { pathToFileURL } from 'node:url';
const AKAR = 'D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/engineer/';
const CG = await import(pathToFileURL(AKAR + 'CapabilityGuard.js').href + '?v=' + Date.now());
const PA = await import(pathToFileURL(AKAR + 'PatchApplier.js').href + '?v=' + Date.now());
console.log('uji-pagar-immutable v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      → ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ---------- daftar CORE IMMUTABLE ----------
for (const p of [
  'frontend/src/core/runtime/module-loader.js',
  'frontend/src/core/runtime/Kernel.js',
  'frontend/src/core/runtime/EventBus.js',
  'frontend/electron/main.cjs',
  'frontend/electron/preload.cjs',
  'constitution/00_CONSTITUTION.md',
]) cek(CG.isImmutableFile(p) === true, `IMMUTABLE dikenali: ${p}`);
cek(CG.isImmutableFile('frontend/src/core/runtime/services/SkillGuardService.js') === false,
  'berkas biasa TIDAK ikut diblokir (pagar tidak kebablasan)');

// ---------- pagar di jalur penerapan patch ----------
function jalankan(patch) {
  const jejak = { tulis: [], checkpoint: 0, rekom: [], blokirDipanggil: 0 };
  const deps = {
    metrics: { coreModificationsBlocked: 0, patchesApplied: 0 },
    eventBus: { emit: () => {} },
    storageManager: {
      read: async () => 'isi lama',
      write: async (p, isi) => { jejak.tulis.push({ p, n: isi.length }); return { success: true }; },
    },
    serviceManager: { has: () => false, get: () => null },
    emitRecommendation: (r) => jejak.rekom.push(r),
    finalizeSession: async () => {},
    onImmutableFileBlocked: () => { jejak.blokirDipanggil++; },
  };
  globalThis.window = { electronAPI: { gitCheckpoint: async () => { jejak.checkpoint++; return { success: true, ref: 'CP-uji' }; } } };
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  return PA.executePatchApplication(patch, [], deps).then((hasil) => ({ hasil, jejak }));
}

const berkasInti = { path: 'frontend/src/core/runtime/module-loader.js', newContent: 'apa pun' };
const berkasBiasa = { path: 'frontend/src/core/runtime/services/SkillGuardService.js', newContent: 'isi baru yang panjang sekali'.repeat(5) };

let r = await jalankan({ id: 'P-inti', taskId: 'T-inti', files: [berkasInti] });
cek(r.hasil?.success === false, 'patch ke module-loader.js DITOLAK', r.hasil);
cek(r.jejak.tulis.length === 0, 'tidak ada berkas yang ditulis');
cek(r.jejak.checkpoint === 0, 'blokir terjadi SEBELUM checkpoint dibuat (tak ada sisa berkas checkpoint)');
cek(r.jejak.rekom.some((x) => x.type === 'CORE_MODIFICATION_BLOCKED' && /IMMUTABLE/i.test(x.message || '')),
  'pesan CORE_MODIFICATION_BLOCKED dipancarkan ke layar');
cek(r.jejak.blokirDipanggil === 1, 'percobaan dicatat (capability Engineer diturunkan oleh engineer.js)');

// Patch campuran: satu berkas terlarang membatalkan SELURUH patch, bukan cuma berkasnya.
r = await jalankan({ id: 'P-campur', taskId: 'T-campur', files: [berkasBiasa, berkasInti] });
cek(r.hasil?.success === false, 'patch campuran (berkas biasa + berkas inti) DITOLAK seluruhnya', r.hasil);
cek(r.jejak.tulis.length === 0, 'berkas biasa dalam patch campuran pun tidak ikut tertulis');
cek(r.jejak.checkpoint === 0, 'patch campuran juga diblokir sebelum checkpoint');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
