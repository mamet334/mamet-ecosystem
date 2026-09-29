# Unduh aplikasi desktop langsung dari web

**29 September 2026** · permintaan Owner

## Masalahnya

> "sekalian buat fitur download aplikasi ketika membuka di web, sehingga tidak susah-susah mengirim
> aplikasinya manual"

Sampai hari ini satu-satunya cara rekan kantor mendapatkan Mamet AI adalah **Owner mengirimkan berkas
190 MB itu sendiri** — diulang setiap ada versi baru. Sekarang cukup membuka alamat webnya.

## Yang ditambahkan

Tautan unduh di **dua tempat**, keduanya hanya muncul saat Mamet dibuka lewat web:

| Tempat | Kenapa di sana |
|---|---|
| **Layar masuk** (`LampLogin`) | rekan kantor mendarat di sana, dan bisa mengunduh **tanpa login dulu** |
| **Pengaturan** | untuk yang sudah masuk lewat web lalu baru ingin versi desktopnya |

Di aplikasi desktop keduanya **tidak dirender sama sekali** — di sana pembaruan datang sendiri, dan
tombol "unduh aplikasi" hanya membingungkan orang yang sudah memakainya. Bagian Pengaturan ini pasangan
dari panel **Pembaruan Aplikasi**: hanya satu dari keduanya yang pernah muncul.

## Kenapa boleh diunduh tanpa login

Repo rilis `mamet334/mamet-ai-releases` bersifat **publik** — diperiksa langsung hari ini, bukan
diasumsikan. Yang publik hanya installer-nya; kode sumber, kunci, dan data tidak ikut.

Dibuktikan sampai ke ujungnya: `HEAD` ke alamat unduhnya menjawab **200 OK tanpa autentikasi**, dengan
`Content-Disposition: attachment; filename=Mamet-AI-Setup-4.2.0.exe`.

## Dua cacat yang dijaga — keduanya DIAM

**1. Memberikan berkas yang salah.** Rilis kita memuat tiga berkas: `.exe`, `latest.yml`, dan
`.blockmap`. Dua yang terakhir milik auto-updater, **bukan untuk diunduh manusia** — memberikannya
kepada orang yang mengklik "Unduh" adalah kegagalan tanpa suara: berkasnya turun, tetapi tidak bisa
dipasang. `pilihPemasang()` hanya menerima `.exe`.

**2. Tombol yang tidak menuju ke mana-mana.** API GitHub punya batas 60 permintaan/jam per IP tanpa
token. Bila gagal, tombolnya **tetap ada** dan menuju
`.../releases/latest` — halaman yang selalu menunjuk versi terbaru. Yang hilang cuma keterangan versi
dan ukurannya, bukan kemampuan mengunduh.

Draf dan pra-rilis ditolak: draf tidak terlihat publik, dan pra-rilis bukan untuk rekan kantor.

## Satu keputusan kecil yang penting

**Versi dan ukuran ditampilkan sebelum diklik** — "Unduh Mamet AI v4.2.0 · 181 MB". Angka 190 MB tidak
pantas mengejutkan orang **sesudah** unduhannya berjalan, apalagi di jaringan kantor.

## Berkas

| Berkas | |
|---|---|
| `frontend/src/core/runtime/services/unduhAplikasi.js` | **baru** — pemilihan berkas & alamat, murni |
| `frontend/src/components/TombolUnduhDesktop.jsx` | **baru** — satu komponen, dipakai dua tempat |
| `frontend/src/components/LampLogin.jsx` | tautan di bawah formulir masuk |
| `frontend/src/components/Settings.jsx` | bagian "Aplikasi Desktop" (hanya di web) |
| `uji/uji-unduh-desktop.mjs` | **baru** |

## Bukti

57 berkas uji hijau · `vite build` lolos · alamat unduh diperiksa langsung ke GitHub (200, tanpa login).

Bahan ujinya memakai **bentuk rilis nyata** yang diambil dari GitHub hari ini — ketiga berkas beserta
ukuran sebenarnya — bukan karangan. Uji juga menjaga pengambilan dibatalkan saat komponen ditutup, dan
tautan keluar memakai `noopener noreferrer`.

**Belum diuji live.** Perlu penerapan web (Vercel) untuk layar masuk, dan build baru untuk memastikan
tombolnya memang TIDAK muncul di aplikasi desktop.
