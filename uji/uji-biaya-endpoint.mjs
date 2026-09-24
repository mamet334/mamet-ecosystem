// UJI 2026-09-24 — biaya panggilan model di endpoint samping tercatat LENGKAP dan BENAR.
//
// Menggantikan uji-padatkan-biaya.mjs v1, yang hanya memeriksa "logApiUsage dipanggil". Itu tidak cukup:
// pada putaran live 24 September 01:11 logApiUsage MEMANG dipanggil, dan `api_usage` tetap salah —
// mencatat $0,006647 untuk panggilan yang ditagih penyedia $0,017196 (2,6x terlalu murah), karena
// argumen kelima (`usageCostUsd`) tidak diteruskan sehingga logger jatuh ke tabel tarif.
//
// Dugaan saya waktu itu — "api_usage sistemik meremehkan biaya" — TERBANTAH: baris chat biasa
// 23 September mencatat $0,0047669376 di `api_usage` dan $0,004767 di `cost_ledger`, cocok. Jalur chat
// (`llm_orchestrator.ts`) selalu meneruskan biayanya; hanya endpoint samping yang tertinggal.
//
// Yang diperiksa untuk KEDUA endpoint samping (padatkan & judge):
//   1. logApiUsage dipanggil,
//   2. dengan biaya asli dari penyedia (argumen kelima),
//   3. dengan model yang BENAR-BENAR dipakai (`modelUsed`), bukan yang diminta — nama salah = tarif salah,
//   4. SEBELUM pemeriksaan mutu yang bisa menolak hasilnya (uangnya sudah keluar),
//   5. dan tugas latarnya ditunggu di jalur berhasil MAUPUN gagal.
import { readFileSync } from 'node:fs';
const AKAR = 'D:/SLAMET/other/mamet os ecosystem/supabase/functions/agent-process/';
console.log('uji-biaya-endpoint v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const ENDPOINT = [
  ['padatkan', 'lib/request/padatkan_endpoint.ts'],
  ['judge', 'lib/request/judge_endpoint.ts'],
];

for (const [nama, jalur] of ENDPOINT) {
  const T = readFileSync(AKAR + jalur, 'utf8');
  const iLog = T.indexOf('rctx.logger.logApiUsage(');
  cek(iLog > 0, `[${nama}] logApiUsage dipanggil — tanpa ini api_usage tidak menerima apa pun`);
  const arg = T.slice(iLog, T.indexOf(');', iLog));

  cek(/biayaAsliUsd/.test(arg),
    `[${nama}] biaya asli penyedia diteruskan (argumen kelima) — tanpa ini logger jatuh ke tabel tarif dan mencatat terlalu murah`, arg);
  cek(/usageCostUsd/.test(T),
    `[${nama}] biaya asli diambil dari jawaban adapter, bukan dihitung ulang di endpoint`);
  cek(/modelTercatat/.test(arg) && /modelUsed/.test(T),
    `[${nama}] model yang dicatat adalah model yang BENAR-BENAR dipakai adapter (nama salah = tarif salah, Item 41)`, arg);

  // Dicatat sesudah model menjawab, tapi SEBELUM pemeriksaan yang bisa menolak hasilnya.
  const iMentahSiap = T.indexOf("if (!mentah) throw");
  cek(iMentahSiap > 0 && iLog > iMentahSiap,
    `[${nama}] dicatat sesudah ada jawaban model, bukan sebelum`, { iMentahSiap, iLog });

  // awaitAll di KEDUA jalur: berhasil dan gagal.
  const jumlahAwait = (T.match(/await tasks\.awaitAll\(\)/g) || []).length;
  cek(jumlahAwait >= 2, `[${nama}] tugas latar ditunggu di jalur berhasil DAN jalur gagal (ditemukan ${jumlahAwait})`);
  const iCatch = T.lastIndexOf('} catch (err');
  cek(iCatch > 0 && /await tasks\.awaitAll\(\)/.test(T.slice(iCatch)),
    `[${nama}] jalur gagal menunggu tugas latar — tanpa EdgeRuntime.waitUntil, barisnya bisa hilang bersama prosesnya`);

  cek(/isStream: false/.test(T) || /createRuntimeLogger\(user\.id, tasks, false,/.test(T),
    `[${nama}] logger dibuat dengan isStream=false — kalau true, logApiUsage berhenti tanpa suara`);
}

// ---------- KENDALI: jalur chat biasa memang sudah benar (dugaan "sistemik" terbantah) ----------
const ORK = readFileSync(AKAR + 'lib/llm_orchestrator.ts', 'utf8');
cek(/logApiUsage\([^)]*result\.usageCostUsd\)/.test(ORK),
  'KENDALI: llm_orchestrator SUDAH meneruskan biaya asli — jadi masalahnya endpoint samping, bukan api_usage itu sendiri');
cek(/result\.modelUsed \|\| rctx\.model\.model/.test(ORK),
  'KENDALI: llm_orchestrator juga sudah memakai modelUsed — pola yang ditiru kedua endpoint');

// ---------- logger memang mendahulukan biaya asli di atas tabel tarif ----------
const RC = readFileSync(AKAR + 'lib/runtime_context.ts', 'utf8');
const iLogApi = RC.indexOf('logApiUsage(provider: string');
const badan = RC.slice(iLogApi, iLogApi + 1400);
cek(/actualCostUsd === 'number'/.test(badan) && /totalCost = actualCostUsd/.test(badan),
  'biaya asli mengalahkan tabel tarif di dalam logger — inilah sebabnya argumen kelima menentukan');
cek(/if \(isStream\) return;/.test(badan), 'logger memang diam saat isStream — penjelasan kenapa isStream=false wajib');

// ---------- pembaca anggaran ----------
const AS = readFileSync('D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/AssistantService.js', 'utf8');
const blokBahan = AS.slice(AS.indexOf('async bahanAnggaranKonteks('), AS.indexOf('async bahanAnggaranKonteks(') + 1800);
cek(/from\('api_usage'\)/.test(blokBahan) && !/cost_ledger/.test(blokBahan),
  'anggaran jendela konteks dihitung dari api_usage saja — cost_ledger tidak dibaca, jadi api_usage wajib benar');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
