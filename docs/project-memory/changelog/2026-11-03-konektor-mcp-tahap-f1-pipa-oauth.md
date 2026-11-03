# 3 November 2026 — Konektor MCP Tahap F1: pipa OAuth di proses utama (Hubungkan akun / Putuskan)

[Rancangan §10](../../roadmap/ROADMAP-KONEKTOR-MCP.md) · Item 129. Desktop, proses utama saja. Layar, `main.cjs`, dan
server tidak berubah.

## Konteks

Owner ingin konektor lebih fleksibel, dengan akun yang **dipilih dan disetujui pengguna sendiri**, seperti aplikasi
Claude terhubung ke Google Workspace. Google ditunda karena Google Cloud meminta kartu kredit. OAuth dibangun umum,
dengan pendaftaran klien otomatis (DCR), dan Notion dipakai sebagai bukti (K20–K23 disetujui Owner).

## Yang dibangun — `frontend/electron/konektor/`

| Berkas | Tugas |
|---|---|
| `penerimaBalikan.cjs` (baru) | Penerima kode login sekali pakai. Mendengar **hanya di 127.0.0.1** dengan port acak atau port yang dulu didaftarkan, pada satu jalur `/balikan`. Ditutup sesudah balikan pertama, batas waktu 5 menit. Halaman balasan tidak memantulkan parameter URL |
| `oauthPenyedia.cjs` (baru) | Implementasi `OAuthClientProvider` SDK. Pendaftaran klien dan token disimpan di brankas (`oauth-klien`, `oauth-token`); verifier PKCE dan `state` hanya di memori. Klien publik (`token_endpoint_auth_method: none`). Ada **dua mode**, dijelaskan di bawah tabel |
| `alurOAuth.cjs` (baru) | **Hubungkan** dan **Putuskan**, dijelaskan di bawah tabel |
| `resep.cjs` | Bidang `oauth: true` (hanya untuk jenis http). Id kredensial `oauth-*` dicadangkan, supaya token tak bisa ditimpa dari kolom ketik |
| `transport.cjs` | Transport HTTP memasang `authProvider` untuk server OAuth; tanpa penyedia, pembuatan transport ditolak |
| `sesiUmum.cjs` | Server OAuth memakai penyedia **mode diam**. Status baru: `belum_terhubung` dan `perlu_hubungkan_ulang` |
| `brankas.cjs` | Opsi `maks` untuk token OAuth (16.384 huruf). Kredensial yang diketik tetap dibatasi 4.096 |

**Mode penyedia** (`oauthPenyedia.cjs`):
- **interaktif:** membuka browser sistem hanya untuk URL https (http hanya ke mesin ini) yang asalnya sama dengan
  `authorization_endpoint` server itu;
- **diam (K23):** tidak pernah membuka browser. Kalau login dibutuhkan, penyedia menandai "perlu hubungkan ulang".
  Penyedia tetap menyebut alamat balikan yang dulu didaftarkan.

**Alur** (`alurOAuth.cjs`):
- **Hubungkan:**
  1. Temukan metadata server. Server tanpa PKCE S256 ditolak **sebelum** browser dibuka.
  2. Pakai ulang port balikan yang dulu didaftarkan. Kalau port itu dipakai program lain, daftar ulang dengan port
     baru.
  3. Hapus token lama, supaya setiap login adalah login segar.
  4. DCR → login di browser → `state` wajib cocok → kode ditukar dengan token (PKCE).
  5. Tombol yang ditekan dua kali tetap menghasilkan satu login.
- **Putuskan (K22):** cabut token pembaru di server (RFC 7009), lalu hapus token dan pendaftaran dari brankas.

## Bukti

- **`uji-konektor-oauth-f1.mjs`**, 41 cek. Uji memakai **server OAuth + MCP tiruan** (`uji/lib/serverOAuthTiruan.cjs`)
  yang meniru bentuk Notion MCP: 401 + `WWW-Authenticate`, RFC 9728/8414, DCR, PKCE S256, token pembaru berotasi,
  dan pencabutan. "Browser"-nya adalah `fetch` yang mengikuti pengalihan login sampai ke penerima balikan. Yang diuji:
  - resep;
  - penerima: hanya 127.0.0.1 (tidak terjangkau dari alamat jaringan laptop), jalur lain 404, tidak memantulkan HTML,
    ditutup sesudah dipakai, batas waktu;
  - aturan membuka browser;
  - Hubungkan: DCR klien publik, PKCE S256, `state` acak dan **berbeda di tiap login**, login ulang yang segar, port
    yang dipakai ulang, port yang terhalang;
  - penolakan: `state` palsu, Owner menolak di halaman penyedia, server tanpa S256;
  - tinjau dan panggil lewat token OAuth;
  - **token kedaluwarsa diperbarui otomatis**;
  - **K23:** pembaruan gagal → "perlu hubungkan ulang" dan browser **tidak** dibuka;
  - **K22:** token dicabut di server dan brankas dikosongkan;
  - log tidak memuat token atau kode.
- **Cacat nyata yang ditemukan uji:** di mode diam, penyedia tidak menyebut alamat balikan. SDK lalu menganggap alurnya
  non-interaktif (*client_credentials*), sehingga token pembaru **tidak pernah dipakai**: setiap kali token akses
  habis, sambungan putus. Sudah diperbaiki: penyedia memakai alamat balikan yang dulu didaftarkan.
- **Mutasi pada salinan: 23/23 mati.** Cek yang lemah diperkuat lebih dulu: pengikatan ke 127.0.0.1 dibuktikan lewat
  sambungan dari alamat jaringan, `state` harus berbeda, dan login ulang harus benar-benar membuka browser.
- Penjaga `catch` tetap 91. Berkas baru bersih dari karakter kendali. Suite penuh **153/153**.

**Catatan:** Owner menghubungkan Notion ke **aplikasi Claude**, ke ruang kerja "Ruang Andre Anastasya" (diperiksa
dengan `notion-get-self`). Itu sambungan Claude, bukan Mamet. Mamet akan meminta izinnya sendiri di F3.
