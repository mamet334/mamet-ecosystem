
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

console.log('\n-- mustLog dijalankan dari sumbernya --');
{
  const m = ALS.match(/const mustLog =([\s\S]*?);\n/);
  cek(!!m, 'ekspresi mustLog ditemukan (kalau gagal, polanya berubah — perbarui uji ini)');
  if (!m) { console.log('\n1 GAGAL'); process.exit(1); }

  const putuskan = new Function('entry', 'logEntry', `return (${m[1].trim()});`);

  const perintahEngineer = { is_destructive: false, in_workspace: true, tanpa_persetujuan: true };
  cek(putuskan({ wajibSimpan: true }, perintahEngineer) === true,
    'perintah Engineer (read-only, dalam workspace) DISIMPAN — ini yang dulu hilang');

  const aturanLama = (l) => l.is_destructive || !l.in_workspace;
  cek(aturanLama(perintahEngineer) === false,
    'dan aturan LAMA memang akan menolaknya — jadi celahnya nyata, bukan dugaan');

  cek(putuskan({}, { is_destructive: false, in_workspace: true, tanpa_persetujuan: false }) === false,
    'pemanggil tanpa wajibSimpan tetap memakai aturan lama (SKILL_EXECUTED tak berubah)');
  cek(putuskan({}, { is_destructive: true, in_workspace: true }) === true,
    'aksi destruktif tetap wajib simpan seperti sebelumnya');
  cek(putuskan({}, { is_destructive: false, in_workspace: false }) === true,
    'aksi di luar workspace tetap wajib simpan seperti sebelumnya');
  cek(putuskan({ wajibSimpan: false }, { is_destructive: true, in_workspace: true }) === false,
    'wajibSimpan: false menang atas aturan lama — benderanya dua arah');
}

console.log('\n-- keluaran tidak disimpan --');
{
  cek(/const panjang = String\(output \?\? ''\)\.length/.test(ALS), 'hanya PANJANG keluaran yang diambil');
  cek(/output: '',/.test(ALS), 'medan output dikirim KOSONG ke penyimpanan', (ALS.match(/.*output: .*/g) || []));
  cek(/keluaran \$\{panjang\} huruf \(tidak disimpan/.test(ALS),
    'panjangnya dicatat di alasan, dan dikatakan bahwa isinya tidak disimpan');
  cek(!/result_output:\s*\(entry\.result\?\.output \|\| ''\)\.substring\(0, 1000\)[\s\S]{0,40}logCommand/.test(ALS),
    'logCommand tidak melewati jalur yang menyimpan 1000 huruf keluaran');
}

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

  cek(/Jejak audit perintah gagal disimpan/.test(baca('frontend/src/core/runtime/services/AssistantService.js')),
    'kegagalan audit dilaporkan ke konsol, bukan ditelan diam-diam');
}

console.log('\n-- medan baris log vs kolom tabel --');
{
  const KOLOM_NYATA = [
    'id', 'requested_by', 'ai_decision', 'command', 'target_path', 'executed_at',
    'result_success', 'result_output', 'result_reason', 'in_workspace', 'is_destructive',
    'user_id', 'logged_at', 'tanpa_persetujuan',
  ];
  const m = ALS.match(/const logEntry = \{([\s\S]*?)\n    \};/);
  cek(!!m, 'objek logEntry ditemukan');
  const medan = [...(m ? m[1] : '').matchAll(/^\s{6}([a-z_]+):/gm)].map((x) => x[1]);
  cek(medan.length >= 13, `medan logEntry terbaca (${medan.length})`, medan);
  const asing = medan.filter((k) => !KOLOM_NYATA.includes(k));
  cek(asing.length === 0, 'tiap medan logEntry punya kolomnya di tabel — insert tidak akan ditolak', asing);
  cek(medan.includes('tanpa_persetujuan'), 'kolom baru benar-benar diisi, bukan hanya ditambahkan ke tabel');
}

console.log('\n-- pemetaan gerbang -> medan audit --');
{
  const { tanpaPersetujuan, PROFIL } = await import('../frontend/electron/alatFolderJalan.cjs');
  const g = (program, argumen) => tanpaPersetujuan({ program, argumen, profil: PROFIL.engineer });

  cek(g('git', ['status']) === true, 'git status → tanpa_persetujuan = true (muncul di tabel sebagai jalan-sendiri)');
  cek(g('git', ['grep', '-n', 'foo']) === true, 'git grep → tanpa_persetujuan = true');
  cek(g('npm', ['test']) === false, 'npm test → tanpa_persetujuan = false (lewat dialog Owner)');
  cek(g('node', ['-e', 'x']) === false, 'node -e → tanpa_persetujuan = false — garis yang tidak boleh bocor');
}

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
