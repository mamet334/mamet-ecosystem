# 31 Oktober 2026 — K5/K6: pendaftaran publik ditutup; menghapus akun = menghapus seluruh datanya (ADR-0022)

Lanjutan keputusan Owner: akun didaftarkan lewat undangan dashboard Supabase (fitur kelola akun di aplikasi TIDAK dibuat —
[log undangan](./2026-10-31-k4-ruang-inti-akun-baru.md)).

## 1. K5 — pendaftaran publik ditutup (Owner)

- Owner mematikan "Allow new users to sign up" (Authentication → Sign In / Providers) setelah undangan terbukti.
- **Diukur:** percobaan pertama `disable_signup: false` — belum disimpan (Owner lupa Save); sesudah Save:
  `/auth/v1/settings` → **`disable_signup: true`**, dan `POST /auth/v1/signup` → **422 `signup_disabled`** "Signups not
  allowed for this instance" (permintaan uji memakai email tak sah — tak mungkin membuat akun).
- Undangan tetap jalan sesudah sakelar mati: undangan ke-2 → akun membuat sandi & masuk (Owner). Akar ancaman
  TM-001..004 model ancaman (siapa pun bisa membuat akun lewat API) **tertutup**.

## 2. Regresi pemicu CORE: semua akun tak bisa dihapus

- Owner menghapus akun undangan uji di dashboard → **"Database error deleting user"**. Diukur (transaksi dibatalkan):
  "Akses Ditolak: Core Knowledge bersifat Read-Only untuk penghapusan." — pemicu lama `prevent_core_deletion` menolak
  CASCADE dari auth.users. Sebelum pemicu CORE (pagi ini) sebagian akun tak punya CORE sehingga tak terasa; sesudahnya
  SEMUA akun tak bisa dihapus. Regresi dari pekerjaan saya sendiri.
- **`20261031010000_core_ikut_terhapus_bersama_akun.sql`** (platform berlaku): CORE ditolak dihapus HANYA selama akun
  pemiliknya masih ada; SECURITY DEFINER (authenticated tak boleh membaca auth.users), `search_path` kosong.
- Bukti (fungsi berlaku, transaksi dibatalkan): pengguna menghapus CORE miliknya lewat aplikasi → tetap ditolak; ruang
  biasa → terhapus; hapus akun uji → berhasil, ruang tersisa 0.

## 3. K6 — hapus akun = hapus seluruh datanya (pilihan A Owner)

- **Temuan:** 4 tabel ber-FK NO ACTION (chats, documents, agent_logs, scheduled_tasks) menolak penghapusan akun yang
  pernah dipakai — diukur: akun Owner (219 chat, 229 dokumen, 455 log), akun `52e37376` (16 dokumen), akun undangan uji
  pertama (2 log dari percobaan unggah). 9 tabel tanpa FK + 5 log ber-SET NULL pada user_id akan menyisakan data pribadi
  tanpa pemilik. Dialog dashboard sendiri menjanjikan "remove … and all associated data".
- **`20261031020000_hapus_akun_beserta_data.sql`** (platform berlaku): pemicu **BEFORE DELETE di auth.users** menghapus
  data akun di 18 tabel (14 ber-user_id uuid, 4 teks) dalam transaksi yang SAMA; tabel CASCADE ditangani database;
  kolom "siapa melakukan" (created_by/approved_by/…) tetap SET NULL. Kegagalan tidak ditelan. EXECUTE dicabut.
- **Bukti (transaksi dibatalkan):** akun undangan uji ber-data tanpa pemicu → gagal FK; dengan pemicu → terhapus, sisa
  baris di **SEMUA tabel public ber-user_id = NOL**, ruang 0, 4 akun lain utuh. Diulang pada pemicu yang **berlaku** →
  sama. Akun uji tetap ada (dibatalkan) untuk dihapus Owner sendiri.
- **Tidak bisa dibatalkan.** Untuk berhenti sementara: "Ban user". Batas yang diketahui: berkas Storage `conversions`
  milik akun tak ikut terhapus (Supabase melarang hapus langsung lewat SQL; saat ini 2 berkas).

## Uji

- `uji/uji-ruang-inti-akun-baru.mjs` diperluas (syarat "akun masih ada", definer, enum berskema) — mutasi 4/4.
- `uji/uji-hapus-akun-beserta-data.mjs` (baru) — daftar 18 tabel dibandingkan dengan daftar terukur independen, BEFORE,
  tipe teks, tak ditelan, EXECUTE — mutasi **6/6**. (Versi awal uji salah: pola malas menelan daftar pertama — diperbaiki.)
- Suite **139/139**.

## Terbukti live (Owner menghapus dua akun undangan uji dari dashboard)

- Keduanya — termasuk akun uji yang punya 2 log (dulu menolak dihapus) — **terhapus tanpa galat**.
- Database (hitungan saja): 3 akun, 0 akun undangan; sisa baris milik kedua akun uji di SEMUA tabel public ber-user_id:
  **NOL**.
- Pemeriksaan data yatim seluruh database: hanya `api_usage` 12 baris milik ID uji palsu Juni (`99999999-…` 10 baris
  18 Jun, `11111111-2222-…` 2 baris 20 Jun — ID fungsi lama `test-suite`). Bukan data pribadi, bukan sisa penghapusan
  akun → Parkir.
