// UJI 2026-10-31 — K4 (ADR-0022): setiap akun punya ruang pengetahuan inti (CORE) sejak dibuat.
//
// Cacat: `rag-process` mewajibkan ruang CORE bila klien tak mengirim spaceId (Mametlite tak pernah mengirimnya), tetapi
// tidak ada yang membuatnya — 1 dari 3 akun tanpa CORE, pengguna baru gagal mengunggah dokumen ("Core space belum
// di-setup"). Perbaikannya pemicu di auth.users (migrasi 20261031000000).
//
// PERILAKUNYA dibuktikan di database (transaksi dibatalkan, sebelum & sesudah migrasi berlaku — changelog
// 2026-10-31-k4-ruang-inti-akun-baru). Uji repo ini menjaga yang bisa membusuk diam-diam di repo: pemicu tetap di
// sumbernya (AFTER INSERT auth.users), nilai yang ditulisnya sama dengan yang DICARI rag-process, kegagalan tidak
// ditelan, dan fungsinya tak bisa dipanggil klien.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\/[^\n]*/g, '');
const MIG = tanpaKomentar(baca('supabase/migrations/20261031000000_ruang_inti_akun_baru.sql'));
const RAG = tanpaKomentar(baca('supabase/functions/rag-process/index.ts'));

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
console.log('uji-ruang-inti-akun-baru v1');

cek(/create trigger ruang_inti_akun_baru\s+after insert on auth\.users\s+for each row execute function public\.buat_ruang_inti_akun_baru\(\)/i.test(MIG),
  'pemicu AFTER INSERT di auth.users — menangkap dashboard, pendaftaran, dan admin sekaligus');

const sisip = MIG.match(/insert into public\.knowledge_spaces \(user_id, name, space_type\)\s+values \(new\.id, '([^']+)', '([^']+)'\)/i);
cek(Boolean(sisip), 'fungsi pemicu menyisipkan ruang (user_id, name, space_type) untuk new.id', MIG.slice(0, 200));
const jenis = sisip?.[2];
cek(new RegExp(`\\.eq\\('space_type', '${jenis}'\\)`).test(RAG), `rag-process mencari space_type '${jenis}' — persis yang ditulis pemicu`);
cek(sisip?.[1] === 'My Core Knowledge', 'nama ruang = "My Core Knowledge" (sama dengan dua akun lama)', sisip?.[1]);

cek(/security definer/i.test(MIG) && /set search_path = ''/i.test(MIG), 'fungsi SECURITY DEFINER dengan search_path kosong (tak bisa dibajak skema lain)');
cek(/on conflict \(user_id, name\) do nothing/i.test(MIG), 'bentrok nama → dilewati, bukan menggagalkan (isi ulang aman diulang)');
cek(!/exception\s+when/i.test(MIG), 'kegagalan TIDAK ditelan — akun tanpa CORE lebih baik gagal dibuat dengan bersuara');
cek(/revoke execute on function public\.buat_ruang_inti_akun_baru\(\) from public, anon, authenticated/i.test(MIG),
  'EXECUTE dicabut dari public/anon/authenticated');
cek(/where not exists \(select 1 from public\.knowledge_spaces k where k\.user_id = u\.id and k\.space_type = 'CORE'\)/i.test(MIG),
  'isi ulang hanya untuk akun yang belum punya CORE');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
