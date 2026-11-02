// UJI 2026-10-31 — K6 (ADR-0022, pilihan A Owner): menghapus akun = menghapus SELURUH datanya, tanpa data yatim.
//
// Cacat: 4 tabel ber-FK NO ACTION menolak penghapusan akun yang pernah dipakai ("Database error deleting user" di
// dashboard Supabase), dan tabel tanpa FK / log ber-SET NULL menyisakan data pribadi tanpa pemilik. Perbaikannya
// pemicu BEFORE DELETE di auth.users (migrasi 20261031020000).
//
// PERILAKUNYA dibuktikan di database (transaksi dibatalkan, sebelum & sesudah berlaku): akun ber-data tanpa pemicu →
// gagal FK; dengan pemicu → terhapus, sisa baris di SEMUA tabel public ber-user_id = 0 (changelog 2026-10-31).
// Uji repo ini menjaga daftar tabel dan bentuk pemicunya agar tak membusuk diam-diam.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MIG = readFileSync(join(AKAR, 'supabase/migrations/20261031020000_hapus_akun_beserta_data.sql'), 'utf8')
  .replace(/\r\n/g, '\n').replace(/--[^\n]*/g, '');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
console.log('uji-hapus-akun-beserta-data v1');

const daftar = (pola) => {
  const m = MIG.match(pola);
  return m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : [];
};
// [^\]]* — bukan [\s\S]*?: pola malas tetap bisa melompati daftar pertama sampai ke `using old.id::text` milik
// daftar kedua (versi awal uji ini salah begitu). Daftar nama tabel tak pernah memuat ']'.
const uuid = daftar(/foreach t in array array\[([^\]]*)\] loop\s+execute format\('delete from public\.%I where user_id = \$1', t\) using old\.id;/);
const teks = daftar(/foreach t in array array\[([^\]]*)\] loop\s+execute format\('delete from public\.%I where user_id = \$1', t\) using old\.id::text;/);

// Diukur 31 Okt (FK ke auth.users + tipe kolom user_id) — ditulis ulang di sini sebagai pembanding independen.
const NO_ACTION = ['chats', 'documents', 'agent_logs', 'scheduled_tasks'];
const SET_NULL_MILIK_AKUN = ['ai_system_logs', 'assistant_audit_log', 'evidence_audit_logs', 'memory_audit_logs', 'verification_audit_logs'];
const TANPA_FK_UUID = ['api_usage', 'chats_backup', 'entity_locks', 'hakim_bayangan', 'user_memories'];
const TANPA_FK_TEKS = ['cost_ledger', 'mamet_memory', 'memory_audit_log', 'raw_memory_content'];

const kurang = (harus, ada) => harus.filter((t) => !ada.includes(t));
cek(kurang(NO_ACTION, uuid).length === 0, '4 tabel NO ACTION dihapus lebih dulu (dulu menolak penghapusan akun)', kurang(NO_ACTION, uuid));
cek(kurang(SET_NULL_MILIK_AKUN, uuid).length === 0, '5 log ber-SET NULL pada user_id ikut dihapus (bukan tersisa tanpa pemilik)', kurang(SET_NULL_MILIK_AKUN, uuid));
cek(kurang(TANPA_FK_UUID, uuid).length === 0, 'tabel tanpa FK ber-user_id uuid ikut dihapus', kurang(TANPA_FK_UUID, uuid));
cek(kurang(TANPA_FK_TEKS, teks).length === 0 && teks.every((t) => !uuid.includes(t)),
  'tabel ber-user_id TEKS dibandingkan dengan old.id::text (uuid ≠ text di Postgres)', { teks });
cek(!uuid.includes('knowledge_spaces') && !teks.includes('knowledge_spaces'),
  'knowledge_spaces TIDAK dihapus di pemicu BEFORE (CORE masih dijaga selama akun ada; ikut lewat CASCADE)');

cek(/create trigger hapus_data_akun_terhapus\s+before delete on auth\.users\s+for each row execute function public\.hapus_data_akun_terhapus\(\)/i.test(MIG),
  'pemicu BEFORE DELETE di auth.users — satu transaksi dengan penghapusan akun');
cek(/security definer/i.test(MIG) && /set search_path = ''/i.test(MIG), 'SECURITY DEFINER + search_path kosong');
cek(!/exception\s+when/i.test(MIG), 'kegagalan tidak ditelan — gagal di mana pun, akun & data tetap utuh');
cek(/revoke execute on function public\.hapus_data_akun_terhapus\(\) from public, anon, authenticated/i.test(MIG),
  'EXECUTE dicabut dari public/anon/authenticated');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
