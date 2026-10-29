# 29 Oktober 2026 — T19: lupa & ganti kata sandi di Mamet Ecosystem dan Mametlite (ADR-0022 K4)

Temuan T19 (20 Okt — [roadmap](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md)): "Lupa kata sandi?" di `LampLogin.jsx` hanya
tautan kosong (`href="#"`); tak ada alur pemulihan maupun ganti kata sandi di kedua aplikasi. Fase hardening (ADR-0022):
Mametlite dipakai orang awam — K4.

## Ketahuan saat merancang

- **Tautan pemulihan Supabase langsung membuat sesi.** Tanpa penahan, pengguna yang membuka tautan dari email langsung
  masuk ke aplikasi tanpa pernah diminta kata sandi baru. Klien Supabase juga **membersihkan** `#…type=recovery` dari
  alamat sesudah memprosesnya — jenis tautan harus dibaca SEBELUM klien dibuat.
- Desktop Ecosystem dimuat lewat `mamet://` — tak bisa dibuka dari email; tautan diarahkan ke versi web.

## Yang dibuat

- **`shared/kata_sandi.js`** (modul bersama baru, murni): `jenisTautanAuth` (pemulihan / kedaluwarsa), `alamatKembaliPemulihan`
  (web → asal halaman; desktop → `https://mamet-ecosystem.vercel.app/`), `periksaSandiBaru` (minimal 8, kedua isian sama),
  `pesanGalatSandi` (galat Supabase → Indonesia), `PESAN_TAUTAN_TERKIRIM` — **sama untuk email terdaftar maupun tidak**
  (formulir tak bisa dipakai mengecek akun).
- **Ecosystem:** `supabase.js` membaca jenis tautan sebelum `createClient`; `App.jsx` menahan desktop (`!session || pemulihan`,
  juga peristiwa `PASSWORD_RECOVERY`); **`LampLogin.jsx`** mode "Lupa Kata Sandi" & "Kata Sandi Baru" di panel yang sama
  (lampu menyala sendiri bila dibuka dari tautan; tautan basi → pesan + mode lupa) — **izin Owner 29 Okt** menyentuh
  LampLogin, penjaga `uji-penjaga-lamplogin` v3 memakai sidik jari baru; **`GantiKataSandi.jsx`** di Settings › Identitas
  (kata sandi lama diperiksa dulu).
- **Mametlite:** `lib/supabase.js` sama; `lib/KataSandi.jsx` (`FormLupaSandi`, `FormSandiBaru`, `FormGantiSandi`); `App.jsx`
  menahan aplikasi saat pemulihan, "Lupa kata sandi?" di layar masuk, ganti kata sandi di panel Pengaturan;
  `vite.config.js` `fs.allow` + `'../shared'`. (Vercel proyek `mamet-ecosystem` sudah ter-build READY dengan impor
  `../shared` sejak 28 Okt — pengaturan akun mengizinkan berkas di luar folder akar.)

## Bukti

- **`uji/uji-kata-sandi.mjs`** (baru): aturan bersama; jenis tautan dibaca sebelum klien dibuat (kedua aplikasi); sesi
  pemulihan tak membuka aplikasi; pesan netral; ganti sandi memeriksa sandi lama; kelas tampilan baru dikompilasi Tailwind
  sungguhan — **sempat menangkap `pulse-focus`** yang disalin dari isian Settings: kelas itu tak pernah didefinisikan (T18),
  dibuang dari komponen baru. **Mutasi 9/9 menggigit.**
- **Peramban sungguhan** (server dev Ecosystem & `npm run preview` Mametlite): layar masuk, "Lupa Kata Sandi", "Kata Sandi
  Baru" (tanpa sesi sah → "tautan sudah tidak berlaku" + minta tautan baru), tautan basi → mode lupa dengan pesan; konsol
  bersih (tak ada pelanggaran CSP Mametlite). Bagian ganti kata sandi di Settings belum dilihat (perlu masuk akun).
- `uji-catch-diam` hijau (catch di `GantiKataSandi` mencatat ke konsol), suite **130/130**; `vite build` kedua aplikasi
  berhasil; nol karakter kendali.

## Deploy web — pelajaran pengaturan Vercel

- `mamet-ecosystem.vercel.app` (commit `c2d47d3`): **READY**.
- `mametlite.vercel.app`: build **ERROR** — `Could not resolve '../../../shared/kata_sandi.js'`. Proyek Vercel `mametlite`
  (Root Directory `mametlite`) **tidak** menyertakan berkas di luar folder akar; kesimpulan "aman" sebelumnya diambil dari
  proyek **lain** (`mamet-ecosystem`) yang pengaturannya berbeda — seharusnya proyek yang bersangkutan sendiri yang
  diperiksa. Produksi tak terganggu (Vercel tidak menukar produksi dengan build gagal; tetap `596c094`). Redeploy
  deployment yang sama juga gagal. Owner menyalakan *Settings → Build and Deployment → Root Directory → "Include files
  outside the root directory in the Build Step"* (29 Okt); deploy baru dipicu commit ini.

## Menunggu Owner

- **Supabase Dashboard:** Authentication → URL Configuration → Redirect URLs: `https://mamet-ecosystem.vercel.app/**`,
  `https://mametlite.vercel.app/**`, `http://localhost:5173/**`; Authentication → SMTP: SMTP sendiri — email bawaan
  Supabase hanya terkirim ke anggota tim proyek, jadi pengguna Mametlite tak akan menerimanya.
- **Uji sungguhan** "Lupa kata sandi?" dengan email Owner sesudah web ter-deploy (mengirim email sungguhan).
