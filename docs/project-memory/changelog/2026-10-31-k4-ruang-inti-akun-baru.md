# 31 Oktober 2026 — K4: setiap akun punya ruang pengetahuan inti (CORE) sejak dibuat (ADR-0022)

Ditemukan saat menganalisis dampak fitur "kelola akun" yang diminta Owner; Owner memutuskan cacat ini dibereskan lebih
dulu ("ini yang bahaya"), fitur kelola akun didiskusikan sesudahnya.

## Temuan

- `rag-process` mewajibkan ruang **CORE** bila klien tidak mengirim `spaceId` — Mametlite tak pernah mengirimnya — dan
  menolak dengan "Core space belum di-setup untuk akun ini" (`NO_CORE_SPACE`).
- **Tidak ada yang membuat ruang itu:** tak ada pemicu di `auth.users`, tak ada kode klien/server/migrasi di repo. Dua akun
  lama punya "My Core Knowledge" dari masa lalu; **1 dari 3 akun tidak punya** → setiap pengguna Mametlite baru langsung
  gagal di fitur utamanya (unggah dokumen RAG), entah akunnya dibuat lewat dashboard maupun pendaftaran.
- Chat tak terdampak (`routing_decider` menerima `workspace_id` null).
- Catatan untuk diskusi kelola akun: pemicu `prevent_core_deletion` menolak penghapusan ruang CORE — "hapus akun
  permanen" (bila dibuat) harus menanganinya.

## Yang dibuat

- **`supabase/migrations/20261031000000_ruang_inti_akun_baru.sql`** (di platform `20261030175737`): fungsi
  `buat_ruang_inti_akun_baru()` (SECURITY DEFINER, `search_path` kosong, EXECUTE dicabut dari public/anon/authenticated)
  + pemicu **AFTER INSERT di `auth.users`** — menangkap SEMUA jalur pembuatan akun; `on conflict (user_id, name) do
  nothing`; kegagalan **tidak ditelan** (akun tanpa CORE lebih baik gagal dibuat dengan bersuara). Isi ulang satu kali
  untuk akun lama tanpa CORE.
- **`uji/uji-ruang-inti-akun-baru.mjs`** (baru): pemicu tetap di sumbernya, nilai yang ditulis = yang dicari
  `rag-process`, kegagalan tak ditelan, EXECUTE tak bisa dipanggil klien. **Mutasi 6/6 menggigit.**
- Sekalian: `uji-pesan-gagal-stream` & `uji-rag-turun-catatan` keluar lewat `process.exitCode`, bukan `process.exit()` —
  suite penuh pertama sesudah perubahan ini memerahkan `uji-pesan-gagal-stream` SESUDAH semua asersinya lulus: Node di
  Windows jatuh (`libuv UV_HANDLE_CLOSING`, async.c:76) karena keluar paksa saat stream Response masih menutup handle.
  Sesudahnya 15/15 & 10/10 bersih; kode keluar 1 tetap diteruskan.

## Bukti

- **Uji kering (transaksi dibatalkan) sebelum diterapkan:** tanpa pemicu akun baru CORE = **0** (cacatnya terbukti);
  sesudah isi ulang akun tanpa CORE = 0; dengan pemicu akun baru CORE = **1**; isi ulang dua kali tanpa ganda; anon tak
  bisa memanggil fungsi. Database diperiksa tak berubah sesudahnya.
- **Sesudah diterapkan:** akun tanpa CORE **0** (CORE 3/3), pemicu aktif, `authenticated` tak bisa memanggil fungsi;
  akun tiruan di transaksi yang dibatalkan → CORE = **1** (pemicu yang berlaku terbukti bekerja).
- Suite **138/138**.

## Tautan undangan Supabase (type=invite) → layar buat kata sandi

Owner memutuskan TIDAK membuat fitur kelola akun: akun baru didaftarkan lewat dashboard Supabase → "Send invitation".
Diperiksa sebelum dipakai: kedua aplikasi hanya mengenali `type=recovery` — orang yang diundang masuk lewat tautan
**tanpa pernah membuat kata sandi**, lalu tak bisa masuk lagi begitu sesinya habis (jalan keluarnya hanya "Lupa sandi").

- `shared/kata_sandi.js` `jenisTautanAuth`: `type=invite` diperlakukan sama dengan `recovery` → layar "Buat kata sandi
  baru untuk akun Anda" (Ecosystem & Mametlite memakai fungsi bersama ini). `magiclink`/`signup` tetap bukan.
- `uji-kata-sandi`: + undangan → layar kata sandi, + magiclink → bukan; mutasi (cabang invite dibuang) **menggigit**.
- Peramban (build lokal Mametlite, `npm run preview`): tautan undangan tiruan → aplikasi masuk jalur kata sandi baru dan,
  karena tokennya palsu (Supabase 403), menampilkan "Tautan … sudah tidak berlaku" — jalur yang benar untuk token tak sah.
  Undangan sungguhan diuji Owner sesudah Mametlite terbit.
- Akun undangan otomatis mendapat ruang CORE (pemicu di atas). Suite **138/138**.
