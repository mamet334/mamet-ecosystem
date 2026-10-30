// uji-hak-tabel-k5 v1 — hak tabel anon/authenticated dicocokkan dengan kode klien (K5, ADR-0022, 30 Okt 2026)
//
// Migrasi `20261030000000_k5_hak_tabel_minimum.sql` mencabut SEMUA hak anon & authenticated di skema public, lalu
// memberi kembali authenticated hanya metode yang dipakai klien. Bahayanya dua arah:
//   (1) kode klien memakai metode yang tak diberi → fitur mati diam-diam di Mametlite/Ecosystem ("permission denied");
//   (2) hak diberi padahal tak dipakai → kembali ke keadaan "semua boleh, hanya RLS yang menjaga".
// Uji ini membaca kode klien (frontend/src, frontend/electron, mametlite/src, tools/) dan migrasinya, lalu menuntut
// keduanya cocok persis. Menambah `.from('x').insert(...)` di klien tanpa migrasi hak baru → uji ini merah.
//
// Perilaku sungguhannya (baca 25 tabel, tulis 9 jalur, RPC, penolakan TRUNCATE/anon) dibuktikan di database dengan
// peniruan peran authenticated/anon di dalam transaksi yang dibatalkan — lihat changelog 2026-10-30-k5-hak-tabel.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const MIGRASI = join(AKAR, 'supabase/migrations/20261030000000_k5_hak_tabel_minimum.sql');
const FOLDER_KLIEN = ['frontend/src', 'frontend/electron', 'mametlite/src', 'tools'];

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  if (ok) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (rinci === undefined ? '' : ' — ' + JSON.stringify(rinci))); }
};

// ── Pemakaian klien ────────────────────────────────────────────────────────────────────────────────
const buangKomentar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const METODE_KE_HAK = { select: ['SELECT'], insert: ['INSERT'], update: ['UPDATE'], upsert: ['INSERT', 'UPDATE'], delete: ['DELETE'] };

// RPC SECURITY INVOKER berjalan dengan hak pemanggil — tabel yang disentuhnya ikut butuh hak (isi fungsi di database).
const RPC_INVOKER = {
  asn_simpan_berkas: { asn_berkas: ['INSERT', 'UPDATE'], asn_pegawai: ['INSERT'] },
  conversion_worker_heartbeat: { conversion_workers: ['INSERT', 'UPDATE', 'SELECT'] },
  conversion_worker_status: { conversion_workers: ['SELECT'] },
};

function bacaKlien() {
  const berkas = [];
  const jelajah = (d) => {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n === 'dist' || n === 'release') continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) jelajah(p);
      else if (/\.(js|jsx|ts|tsx|cjs|mjs)$/.test(n)) berkas.push({ p: p.slice(AKAR.length + 1).replace(/\\/g, '/'), s: buangKomentar(readFileSync(p, 'utf8')) });
    }
  };
  FOLDER_KLIEN.forEach((f) => jelajah(join(AKAR, f)));
  return berkas;
}

/** Peta tabel → Set hak yang dibutuhkan klien, plus rantai yang metodenya tak terbaca dan nama RPC yang dipanggil. */
export function pemakaianKlien(berkas) {
  const butuh = {}; const takTerbaca = []; const rpc = new Set();
  const tambah = (t, haks) => { (butuh[t] ??= new Set()); haks.forEach((h) => butuh[t].add(h)); };
  for (const { p, s } of berkas) {
    for (const m of s.matchAll(/(storage\s*)?\.from\(\s*(['"`])([a-z_]+)\2\s*\)/g)) {
      if (m[1]) continue; // supabase.storage.from('bucket') — bukan tabel
      const rantai = s.slice(m.index + m[0].length).split(/;|\.from\(/)[0];
      const metode = [...rantai.matchAll(/\.(select|insert|update|upsert|delete)\(/g)].map((x) => x[1]);
      if (!metode.length) { takTerbaca.push(`${p}: from('${m[3]}')`); continue; }
      metode.forEach((x) => tambah(m[3], METODE_KE_HAK[x])); // `.insert(..).select()` (returning) ikut terhitung SELECT
    }
    for (const m of s.matchAll(/\.rpc\(\s*['"`]([a-z_]+)/g)) rpc.add(m[1]);
    // Realtime postgres_changes butuh SELECT pada tabelnya.
    for (const m of s.matchAll(/postgres_changes['"`]\s*,\s*\{[^}]*table:\s*['"`]([a-z_]+)/g)) tambah(m[1], ['SELECT']);
    // Rujukan dinamis yang diketahui.
    if (/_tableName\s*=\s*'assistant_audit_log'/.test(s)) {
      if (/from\(this\._tableName\)\.insert\(/.test(s)) tambah('assistant_audit_log', ['INSERT']);
      if (/from\(this\._tableName\)\s*\.select\(/.test(s)) tambah('assistant_audit_log', ['SELECT']);
    }
    const cadangan = s.match(/export const TABEL_CADANGAN = \[([\s\S]*?)\]/);
    if (cadangan) for (const t of cadangan[1].matchAll(/'([a-z_]+)'/g)) tambah(t[1], ['SELECT']);
  }
  for (const nama of rpc) for (const [t, haks] of Object.entries(RPC_INVOKER[nama] ?? {})) tambah(t, haks);
  return { butuh, takTerbaca, rpc };
}

// ── Migrasi ────────────────────────────────────────────────────────────────────────────────────────
export function bacaMigrasi(teks) {
  const sql = teks.replace(/--[^\n]*/g, '');
  const diberi = {}; const keAnon = []; const aneh = [];
  for (const m of sql.matchAll(/grant\s+([a-z,\s]+?)\s+on\s+public\.([a-z_]+)\s+to\s+([a-z_,\s]+?)\s*;/gi)) {
    const haks = m[1].split(',').map((x) => x.trim().toUpperCase());
    const peran = m[3].split(',').map((x) => x.trim());
    if (peran.includes('anon')) keAnon.push(m[2]);
    if (haks.some((h) => !['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(h))) aneh.push(`${m[2]}: ${haks}`);
    if (peran.includes('authenticated')) { (diberi[m[2]] ??= new Set()); haks.forEach((h) => diberi[m[2]].add(h)); }
  }
  const cabutSemua = /revoke\s+all\s+on\s+all\s+tables\s+in\s+schema\s+public\s+from\s+anon\s*,\s*authenticated\s*;/i.test(sql);
  const fnCabutAuth = [...sql.matchAll(/revoke\s+execute\s+on\s+function\s+public\.([a-z_]+)\([^;]*?from\s+([a-z_,\s]+);/gi)]
    .filter((m) => /authenticated/.test(m[2])).map((m) => m[1]);
  const fnAnon = [...sql.matchAll(/grant\s+execute\s+on\s+function\s+public\.([a-z_]+)\([^;]*?to\s+([a-z_,\s]+);/gi)]
    .filter((m) => /\banon\b|\bpublic\b/.test(m[2])).map((m) => m[1]);
  return { diberi, keAnon, aneh, cabutSemua, fnCabutAuth, fnAnon };
}

/** Daftar pelanggaran; kosong = cocok. */
export function periksa(mig, pakai) {
  const salah = [];
  if (!mig.cabutSemua) salah.push('tak ada `revoke all on all tables in schema public from anon, authenticated`');
  if (mig.keAnon.length) salah.push(`hak tabel ke anon: ${mig.keAnon}`);
  if (mig.aneh.length) salah.push(`hak di luar SELECT/INSERT/UPDATE/DELETE: ${mig.aneh}`);
  if (mig.fnAnon.length) salah.push(`EXECUTE ke anon/public: ${mig.fnAnon}`);
  for (const [t, haks] of Object.entries(pakai.butuh))
    for (const h of haks) if (!mig.diberi[t]?.has(h)) salah.push(`KURANG: klien butuh ${h} pada ${t}`);
  for (const [t, haks] of Object.entries(mig.diberi))
    for (const h of haks) if (!pakai.butuh[t]?.has(h)) salah.push(`LEBIH: ${h} pada ${t} diberi tapi tak dipakai klien`);
  for (const f of mig.fnCabutAuth) if (pakai.rpc.has(f)) salah.push(`RPC ${f} dipanggil klien tapi EXECUTE authenticated dicabut`);
  return salah;
}

// ── Jalankan ───────────────────────────────────────────────────────────────────────────────────────
const teksMigrasi = readFileSync(MIGRASI, 'utf8');
const mig = bacaMigrasi(teksMigrasi);
const pakai = pemakaianKlien(bacaKlien());

console.log('Hak tabel K5 vs kode klien');
cek(pakai.takTerbaca.length === 0, 'setiap from(\'tabel\') di klien punya metode yang terbaca', pakai.takTerbaca);
cek(Object.keys(pakai.butuh).length >= 20, `pemakaian klien terbaca (${Object.keys(pakai.butuh).length} tabel)`);
cek(['check_daily_quota', 'asn_simpan_berkas', 'conversion_worker_heartbeat', 'conversion_worker_status'].every((f) => pakai.rpc.has(f)),
  'empat RPC klien terdeteksi', [...pakai.rpc]);
const salah = periksa(mig, pakai);
cek(salah.length === 0, 'migrasi memberi authenticated PERSIS hak yang dipakai klien; anon tak diberi apa pun', salah);
cek(/grant\s+execute\s+on\s+function\s+public\.check_daily_quota\(uuid\)\s+to\s+authenticated/i.test(teksMigrasi),
  'check_daily_quota tetap bisa dipanggil pengguna masuk (BillingDashboard)');

// ── Pagar mutasi: pemeriksa ini sendiri harus menggigit ──────────────────────────────────────────
console.log('\nPagar mutasi');
const gigit = (nama, teks, pk = pakai) => cek(periksa(bacaMigrasi(teks), pk).length > 0, `menggigit: ${nama}`);
gigit('INSERT user_memories dibuang', teksMigrasi.replace('select, insert, update, delete on public.user_memories', 'select, update, delete on public.user_memories'));
gigit('hak berlebih (SELECT mamet_memory)', teksMigrasi + '\ngrant select on public.mamet_memory to authenticated;\n');
gigit('hak tabel ke anon', teksMigrasi.replace('grant select on public.model_pricing           to authenticated;', 'grant select on public.model_pricing to authenticated, anon;'));
gigit('revoke all dibuang', teksMigrasi.replace(/revoke all on all tables in schema public from anon, authenticated;/, ''));
gigit('TRUNCATE diberi lagi', teksMigrasi.replace('select, delete                 on public.documents', 'select, delete, truncate on public.documents'));
gigit('EXECUTE RPC klien dicabut', teksMigrasi + '\nrevoke execute on function public.asn_simpan_berkas(jsonb, jsonb, uuid[]) from authenticated;\n');
gigit('klien baru memakai tabel tanpa hak', teksMigrasi, { ...pakai, butuh: { ...pakai.butuh, mamet_memory: new Set(['INSERT']) } });
const tiruan = pemakaianKlien([{ p: 'x.js', s: "await supabase.from('chats').select('id');\nawait supabase.storage.from('dokumen').upload(a);" }]);
cek(tiruan.butuh.chats?.has('SELECT') && !tiruan.butuh.dokumen && tiruan.takTerbaca.length === 0,
  'storage.from(bucket) tidak dihitung sebagai tabel', tiruan);
const rt = pemakaianKlien([{ p: 'x.js', s: ".on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tabel_rt' }, f)" }]);
cek(rt.butuh.tabel_rt?.has('SELECT'), 'langganan realtime (postgres_changes) menuntut SELECT pada tabelnya');
const up = pemakaianKlien([{ p: 'x.js', s: "await sb.from('t_up').upsert(baris).select('id');" }]);
cek(['INSERT', 'UPDATE', 'SELECT'].every((h) => up.butuh.t_up?.has(h)), 'upsert menuntut INSERT + UPDATE (+ SELECT bila returning)');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
