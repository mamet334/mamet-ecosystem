// UJI 2026-10-01 — Engineer berhenti menulis memori pengguna secara otomatis.
//
// ── Bagaimana ketahuan ──────────────────────────────────────────────────────────────────────
// Owner melihat panel Memory Context dan bertanya: "ada yang masuk ke memory context, wajarkah?"
// Isinya:
//   "Engineering session ENG-SESSION-1790841170222-7n6h90"   memory_type: engineer_session
//   "Patch PATCH-1790841319400 applied"                      memory_type: engineer_patch
//
// ── Diukur, bukan ditebak ───────────────────────────────────────────────────────────────────
//   sesi Engineer            3 baris   lahir HARI ITU
//   patch Engineer           3 baris   lahir HARI ITU
//   memori Owner sungguhan  12 baris   terkumpul sejak 23 Juni
//
// Sepertiga daftar memori pribadi Owner lahir dari mesin dalam beberapa jam, dan bertambah satu
// tiap sesi serta tiap patch — tanpa batas.
//
// ── Kenapa DIBUANG, bukan dipindah ke tabel lain ────────────────────────────────────────────
//   1. Tak ada yang membacanya. `engineer_session`/`engineer_patch` hanya muncul di tempat
//      penulisannya dan dua baris komentar JSDoc — tak satu pun kode mencarinya kembali.
//   2. Isinya nomor mesin. Jenis memori yang dikenali server: IDENTITY, LOCATION, JOB, PREFERENCE,
//      PROJECT — fakta pribadi Owner. Nomor sesi rekayasa benda asing di sana.
//   3. Kontrak Engineer sendiri berbunyi "Tidak boleh menulis memory otomatis".
//
// Owner: *"jika berguna, lebih baik tempatnya yang dipisahkan"* — dan jawabannya: rumahnya sudah
// ada (TEMUAN-ENGINEER.md, Brain 1, git log). Memindahkan nomor sesi ke rak yang lebih rapi tetap
// memindahkan sampah.

import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const baca = (p) => readFileSync(`${AKAR}/${p}`, 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-memori-engineer-bersih v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const ENG = tanpaKomentar(baca('frontend/src/core/runtime/services/engineer.js'));
const PA = tanpaKomentar(baca('frontend/src/core/runtime/services/engineer/PatchApplier.js'));

// ── 1. Penulisan otomatisnya hilang ─────────────────────────────────────────────────────────
console.log('\n-- tulisan otomatis hilang --');

cek(!/storeMemory\(/.test(ENG), 'engineer.js tidak lagi memanggil storeMemory', (ENG.match(/.*storeMemory.*/g) || []));
cek(!/storeMemory\(/.test(PA), 'PatchApplier.js tidak lagi memanggil storeMemory', (PA.match(/.*storeMemory.*/g) || []));
cek(!/source_type: 'engineer_session'/.test(ENG), "metadata 'engineer_session' tidak lagi dibuat");
cek(!/source_type: 'engineer_patch'/.test(PA), "metadata 'engineer_patch' tidak lagi dibuat");
cek(!/Engineering session \$\{/.test(ENG), 'kalimat "Engineering session …" tidak lagi disusun');
cek(!/Patch \$\{patch\.id\} applied/.test(PA), 'kalimat "Patch … applied" tidak lagi disusun');

// ── 2. Yang BUKAN sasaran tetap hidup ───────────────────────────────────────────────────────
// Membuang penulisan memori tidak boleh ikut mematikan finalisasi sesi & verifikasi memori —
// keduanya berdiri sendiri dan punya gunanya masing-masing.
console.log('\n-- yang bukan sasaran tetap hidup --');

cek(/verifyEngineeringSession\(this\.sessionArtifact\)/.test(ENG), 'finalisasi & verifikasi sesi tetap berjalan');
cek(/MemoryGovernorService/.test(ENG), 'MemoryGovernorService tetap dipakai');
cek(/sessionArtifact/.test(ENG), 'SessionArtifact tetap ada — catatan sesi di dalam sesi tidak dihapus');

// PatchApplier: Tahap 6 & checkpoint TIDAK boleh ikut terbawa.
cek(/TAHAP 6/.test(baca('frontend/src/core/runtime/services/engineer/PatchApplier.js')), 'blok Tahap 6 tetap ada');
cek(/Engineer:PatchApplied/.test(PA), 'peristiwa PatchApplied tetap dipancarkan');
cek(/checkpointRef/.test(PA), 'checkpoint tetap dibuat');

// ── 3. Rumah yang BENAR masih tersambung ────────────────────────────────────────────────────
// Inti keinginan Owner: "mamet engineer semakin pintar dan tahu di mana dia berada". Yang melayani
// itu adalah ingatan temuan — berkas di dalam repo yang bisa Owner baca dan KOREKSI, ikut
// ter-commit bersama kode yang dibicarakan. Ia salah satu dari tiga sisipan tiap kiriman.
console.log('\n-- rumah yang benar tetap tersambung --');
{
  const IT = baca('frontend/src/core/runtime/services/engineer/IngatanTemuan.js');
  cek(/ALAMAT_BERKAS = 'docs\/project-memory\/temuan-engineer\/TEMUAN-ENGINEER\.md'/.test(IT),
    'ingatan temuan tetap disimpan sebagai berkas DI DALAM repo', (IT.match(/.*ALAMAT_BERKAS.*/g) || []));

  const CE = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));
  cek(/ringkasanTemuan\]/.test(CE) || /ringkasanTemuan,/.test(CE),
    'ringkasan temuan tetap ikut sebagai sisipan tiap kiriman', (CE.match(/const sisipan = [^\n]*/g) || []));
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
