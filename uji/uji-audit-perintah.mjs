// UJI 2026-10-04 — jejak audit perintah Engineer yang BERTAHAN.
//
// ── Celahnya ────────────────────────────────────────────────────────────────────────────────
// `runCommand` (AssistantService) adalah satu-satunya pintu semua perintah Engineer, dan ia
// tidak mencatat apa pun yang bertahan. Yang ada hanya event dalam memori + state React, dua-duanya
// hilang saat jendela dimuat ulang.
//
// Celah itu BARU membesar: sejak 4.2.5 `tanpaPersetujuan()` membuat subperintah `git`-baca jalan
// tanpa dialog izin. Sebelumnya tiap eksekusi punya gerbang manusia, dan DIALOGNYA SENDIRI adalah
// catatannya. Kini sebagian jalan tanpa saksi dan tanpa jejak.
//
// Seluruh rantainya sudah ada sejak PR#1 — `AuditLogService` terdaftar di Kernel, tabel
// `assistant_audit_log` ada di Supabase — dan belum pernah mencatat satu baris pun: 0 baris,
// karena satu-satunya pemanggil `log()` adalah SKILL_EXECUTED, bukan perintah.
//
// ── Dua jebakan yang diuji di sini ──────────────────────────────────────────────────────────
// 1. `mustLog`: perintah Engineer justru read-only DI DALAM workspace, jadi aturan lama
//    (`is_destructive || !in_workspace`) membuat `log()` pulang SEBELUM insert. Menyambungkan
//    `logCommand` begitu saja = fitur yang TERLIHAT TERSAMBUNG TETAPI BUTA, pola yang sama
//    dengan cacat `mimeType` pada lampiran gambar.
// 2. Keluaran perintah TIDAK boleh ikut tersimpan: ia isi berkas repo mentah, jalur ini di sisi
//    klien yang tak punya penyaring rahasia, dan `agent_logs` pernah benar-benar menyimpan kunci
//    API karena kelalaian yang sama.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*|--)/.test(b)).join('\n');

console.log('uji-audit-perintah v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const ALS = tanpaKomentar(baca('frontend/src/core/runtime/services/AuditLogService.js'));
const AS = tanpaKomentar(baca('frontend/src/core/runtime/services/AssistantService.js'));
const FJ = tanpaKomentar(baca('frontend/electron/alatFolderJalan.cjs'));
const MIG = baca('supabase/migrations/20261004000000_audit_perintah_tanpa_persetujuan.sql');

// ── 1. Jebakan mustLog: DIJALANKAN, bukan dibaca ────────────────────────────────────────────
// Ekspresi `mustLog` diambil dari berkas sumber lalu dijalankan — kalau ia dikembalikan ke
// aturan lama, perintah Engineer berhenti tersimpan dan uji ini jatuh.
console.log('\n-- mustLog dijalankan dari sumbernya --');
{
  const m = ALS.match(/const mustLog =([\s\S]*?);\n/);
  cek(!!m, 'ekspresi mustLog ditemukan (kalau gagal, polanya berubah — perbarui uji ini)');
  if (!m) { console.log('\n1 GAGAL'); process.exit(1); }

  const putuskan = new Function('entry', 'logEntry', `return (${m[1].trim()});`);

  // Perintah Engineer yang khas: read-only, di dalam workspace, jalan tanpa dialog.
  const perintahEngineer = { is_destructive: false, in_workspace: true, tanpa_persetujuan: true };
  cek(putuskan({ wajibSimpan: true }, perintahEngineer) === true,
    'perintah Engineer (read-only, dalam workspace) DISIMPAN — ini yang dulu hilang');

  // Aturan lama akan menolaknya. Dibuktikan dengan menjalankan aturan lama itu sendiri.
  const aturanLama = (l) => l.is_destructive || !l.in_workspace;
  cek(aturanLama(perintahEngineer) === false,
    'dan aturan LAMA memang akan menolaknya — jadi celahnya nyata, bukan dugaan');

  // Pemanggil lain (SKILL_EXECUTED) tidak mengirim wajibSimpan: perilakunya tidak boleh berubah.
  cek(putuskan({}, { is_destructive: false, in_workspace: true, tanpa_persetujuan: false }) === false,
    'pemanggil tanpa wajibSimpan tetap memakai aturan lama (SKILL_EXECUTED tak berubah)');
  cek(putuskan({}, { is_destructive: true, in_workspace: true }) === true,
    'aksi destruktif tetap wajib simpan seperti sebelumnya');
  cek(putuskan({}, { is_destructive: false, in_workspace: false }) === true,
    'aksi di luar workspace tetap wajib simpan seperti sebelumnya');
  // `wajibSimpan: false` harus bisa MEMATIKAN, bukan hanya menyalakan.
  cek(putuskan({ wajibSimpan: false }, { is_destructive: true, in_workspace: true }) === false,
    'wajibSimpan: false menang atas aturan lama — benderanya dua arah');
}

// ── 2. Keluaran perintah tidak ikut tersimpan ───────────────────────────────────────────────
console.log('\n-- keluaran tidak disimpan --');
{
  cek(/const panjang = String\(output \?\? ''\)\.length/.test(ALS), 'hanya PANJANG keluaran yang diambil');
  cek(/output: '',/.test(ALS), 'medan output dikirim KOSONG ke penyimpanan', (ALS.match(/.*output: .*/g) || []));
  cek(/keluaran \$\{panjang\} huruf \(tidak disimpan/.test(ALS),
    'panjangnya dicatat di alasan, dan dikatakan bahwa isinya tidak disimpan');
  // Penjaga nyata: tak boleh ada jalan lain yang menaruh `output` apa adanya ke baris log.
  cek(!/result_output:\s*\(entry\.result\?\.output \|\| ''\)\.substring\(0, 1000\)[\s\S]{0,40}logCommand/.test(ALS),
    'logCommand tidak melewati jalur yang menyimpan 1000 huruf keluaran');
}

// ── 3. `tanpaIzin` datang dari PROSES UTAMA, tidak disimpulkan ulang di renderer ─────────────
// Menyimpulkannya dari teks perintah berarti menebak ulang aturan yang justru ingin diaudit —
// dan tebakan itu akan menyimpang begitu daftar izinnya berubah.
console.log('\n-- sumber kebenaran tanpaIzin --');
{
  cek(/return jalankanSesudahIzin\(akar, \{ program, argumen, teks, s, r, env, waktuS, profil, tanpaIzin: true \}\)/.test(FJ),
    'jalur tanpa dialog menandai dirinya tanpaIzin: true');
  cek(/profil, tanpaIzin: false \}\)/.test(FJ), 'jalur yang DITANYAKAN menandai dirinya tanpaIzin: false');
  cek(/\.\.\.h, tanpaIzin \}/.test(FJ),
    'tanpaIzin ditaruh SESUDAH ...h sehingga tak bisa tertimpa hasil proses', (FJ.match(/.*waktuBatasS: waktuS.*/g) || []));
  cek(/tanpaPersetujuan: h\?\.tanpaIzin === true/.test(AS),
    'renderer MEMBACA bendera itu, tidak menebak dari teks perintah', (AS.match(/.*tanpaPersetujuan: .*/g) || []));
  cek(!/tanpaPersetujuan\(\{/.test(AS), 'renderer tidak memanggil ulang aturan tanpaPersetujuan()');
}

// ── 4. Dicatat di PINTUNYA, bukan di pemanggil ──────────────────────────────────────────────
// Dua pemanggil di UI (tombol manual & jalan-sendiri) harus tercakup tanpa masing-masing ingat.
console.log('\n-- dicatat di satu pintu --');
{
  const m = AS.match(/async runCommand\([\s\S]*?\n  \}\n/);
  cek(!!m, 'badan runCommand ditemukan');
  const badan = m ? m[0] : '';
  cek(/logCommand\(\{/.test(badan), 'logCommand dipanggil DI DALAM runCommand');
  cek(/supabase\.auth\.getSession\(\)/.test(badan), 'userId diambil dari sesi, bukan dititipkan pemanggil');

  const CE = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));
  const pemanggil = (CE.match(/\brunCommand\(/g) || []).length;
  cek(pemanggil >= 2, `kedua pemanggil UI tercakup lewat satu pintu (${pemanggil} pemanggilan)`);
  cek(!/logCommand/.test(CE), 'UI tidak perlu ingat mencatat — tak ada logCommand di sana');

  // Audit yang gagal tidak boleh menggagalkan perintahnya, tetapi juga tidak boleh senyap.
  cek(/Jejak audit perintah gagal disimpan/.test(baca('frontend/src/core/runtime/services/AssistantService.js')),
    'kegagalan audit dilaporkan ke konsol, bukan ditelan diam-diam');
}

// ── 5. Lubang RLS ditutup di migrasi ────────────────────────────────────────────────────────
// Kebijakan lama bernama "Service role can insert" tetapi TANPA `TO`, jadi berlaku PUBLIC, dengan
// WITH CHECK (TRUE). Komentar migrasi lama menyangka AuditLogService memakai service role —
// padahal ia memakai kunci anon. Komentar yang salah itu yang membuat lubangnya.
console.log('\n-- RLS --');
{
  cek(/DROP POLICY IF EXISTS "Service role can insert audit logs"/.test(MIG),
    'kebijakan lama yang berlaku PUBLIC dibuang');
  cek(/TO authenticated/.test(MIG), 'kebijakan baru dibatasi ke peran authenticated');
  cek(/WITH CHECK \(auth\.uid\(\) = user_id\)/.test(MIG),
    'dan hanya boleh menulis baris miliknya sendiri — baris palsu beralamat Owner tertutup');
  cek(/ADD COLUMN IF NOT EXISTS tanpa_persetujuan boolean NOT NULL DEFAULT false/.test(MIG),
    'kolom tanpa_persetujuan ditambahkan secara aditif');
  cek(/Catatan pemulihan/.test(MIG), 'cara membalikkannya ikut dicatat');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
