# 5 November 2026 — Konektor MCP GH3: GitHub lewat login perangkat (tanpa .exe, tanpa rahasia) + jaringan konektor lewat net.fetch

[Rancangan §10 · GitHub lewat OAuth](../../roadmap/ROADMAP-KONEKTOR-MCP.md) · Item 129. Desktop saja, server tidak
berubah. Lanjutan [GH2](2026-11-03-konektor-mcp-gh2-klien-terdaftar.md), dengan keputusan K25: rahasia klien tidak
disimpan di aplikasi, dan bila diwajibkan, dipakai device flow.

## Yang dibangun — `frontend/electron/konektor/`

| Berkas | Tugas |
|---|---|
| `alurPerangkat.cjs` (baru) | **Login perangkat** (RFC 8628), dijelaskan di bawah tabel |
| `fetchOAuthJujur.cjs` (baru) | Galat OAuth yang dikirim dengan **status 200** (GitHub) diubah menjadi 400, supaya SDK membaca alasannya. Sebelumnya Owner melihat `access_token … received undefined`. Galat JSON-RPC MCP (berbentuk objek) tidak disentuh |
| `jaringanKonektor.cjs` (baru) | **Satu jalan keluar HTTP konektor**: `net.fetch` Chromium, hanya http/https, selalu `credentials: 'omit'`. Lihat bagian temuan di bawah |
| `alurOAuth.cjs` | Memilih login browser atau login perangkat (`oauthAlur`). **Batal** untuk kedua jenis login. `loginTertunda(id)` memberi layar jenis login dan kode, tanpa `device_code` |
| `resep.cjs` | `"oauthAlur": "perangkat"` (wajib bersama `oauthKlienId`) |
| `transport.cjs`, `sesiUmum.cjs`, `ipcUmum.cjs`, `main.cjs` | `net.fetch` disuntikkan dari `main.cjs` ke transport HTTP MCP, alur OAuth, dan login perangkat. IPC baru `konektor-umum:batal-login`; status membawa `login` |
| `preload.cjs`, `KartuServerUmum.jsx` | Kotak **kode perangkat**, berisi kode, alamat, **Salin kode**, dan **Batal**. Login browser juga mendapat tombol Batal |

**Cara kerja login perangkat** (`alurPerangkat.cjs`):
- Mamet meminta kode dengan `client_id` saja, tanpa rahasia.
- Kode pengguna ditampilkan di Mamet.
- Halaman perangkat dibuka di browser **hanya bila** asalnya sama dengan server otorisasi. Kalau beda, alamatnya hanya
  ditampilkan.
- Mamet bertanya berkala. Jawaban `authorization_pending`, `slow_down`, `access_denied`, `expired_token`, dan batas
  waktu ditangani.
- **Batal menghentikan penantian saat itu juga.**

## Temuan keamanan: konektor HTTP memakai fetch() Node

Penjaga `uji-ambil-web` ("Black October", CVE-2026-111497) mewajibkan lalu lintas web pihak ketiga di proses utama
lewat jaringan Chromium (`net.fetch`), bukan `fetch()` Node. Penjaga itu menolak `fetchOAuthJujur.cjs` versi
pertama karena memanggil `fetch()`.

Penelusuran lebih jauh menunjukkan masalah yang lebih besar: **transport HTTP MCP sejak G1 dan alur OAuth sejak F1
memakai `fetch()` Node lewat SDK MCP.** SDK berada di `node_modules`, yang tidak dipindai penjaga, sehingga Notion
selama ini tersambung lewat jalur yang dihindari aturan itu.

Sekarang `main.cjs` menyuntikkan `net.fetch` ke `jaringanKonektor`, dan jaringan itulah yang dipakai transport, OAuth,
dan login perangkat. `credentials: 'omit'` wajib, karena tanpa itu `net.fetch` mengirim cookie sesi aplikasi
(terbukti di `uji-ambil-web`).

## Bukti uji

- **`uji-konektor-oauth-gh3.mjs`** memakai server tiruan bergaya GitHub: tanpa DCR, klien terdaftar, galat token
  dengan status 200, web flow yang butuh rahasia, device flow, dan pembaruan yang butuh rahasia. Yang diuji:
  - resep `oauthAlur`;
  - normalisasi galat 200;
  - jaringan (`credentials: 'omit'`; `file:`, `mamet:`, dan `javascript:` ditolak; `main.cjs` menyuntikkan
    `net.fetch` dan jaringan itu sampai ke transport dan alur);
  - login perangkat: kode tampil, `device_code` tidak sampai ke layar, `slow_down`, ditolak, Batal kurang dari
    400 ms, halaman perangkat dari situs lain tidak dibuka, tanpa `client_id` ditolak;
  - web flow GitHub: pesan menyebut `incorrect_client_credentials`;
  - Batal login browser;
  - server menyala dengan token login perangkat;
  - **K23:** pembaruan token yang butuh rahasia berakhir di "perlu hubungkan ulang" tanpa membuka browser.
- **Mutasi pada salinan: 23/23 mati.** Tiga mutan sempat lolos dan menunjukkan celah uji: halaman perangkat dari situs
  lain tetap dibuka, Batal tidak langsung menghentikan penantian, dan pengaman `client_id` lapis kedua belum pernah
  diuji. Ketiganya sudah ditutup.
- `uji-ambil-web` kembali hijau. Penjaga `catch` tetap 91. `vite build` berhasil. Suite penuh **155/155**.

## Di aplikasi Owner (5 Nov, `npm run desktop` dijalankan ulang)

- **GitHub (jarak jauh) terhubung lewat login perangkat:** kode tampil di kartu, dimasukkan Owner di
  `github.com/login/device` (masuk sebagai mamet334), lalu Mamet Ecosystem disetujui. Kartu menjadi "Akun —
  terhubung".
- **Tinjau alat berhasil, 28 alat disetujui, dan server menyala di Assistant.** Semuanya alat baca: `get_*`, `list_*`,
  `search_*`, `issue_read`, `pull_request_read`, `run_secret_scanning`, `ui_get`.
- Di perangkat (diperiksa tanpa membuka token): resep memakai `oauthAlur: perangkat` dan klien
  `Iv23li3SbHZO7UlcxipI`. Brankas `github-jauh` hanya berisi `oauth-token` yang terenkripsi; tidak ada teks token
  GitHub maupun `access_token`.
- **Notion tetap terhubung** dengan 37 alat menyala sesudah dijalankan ulang, kini lewat `net.fetch`.

**Jawaban untuk pertanyaan GH2:**
- **Copilot:** daftar alat terbaca dengan token GitHub App, jadi server jarak jauh bekerja **untuk akun Owner**.
  Apakah akun **tanpa** Copilot sama sekali juga bisa, belum dibuktikan, karena butuh akun lain.
- **Rahasia:** login perangkat berjalan tanpa rahasia ✅.
- **Pembaruan token** (token GitHub App habis ±8 jam): belum teramati. Bila butuh rahasia, statusnya menjadi "perlu
  hubungkan ulang" (K23, sudah diuji dengan server tiruan).

**Catatan pemakaian:** di Assistant kini menyala GitHub `.exe` (27 alat) **dan** GitHub jarak jauh (28 alat), yang
alatnya hampir sama. Sebaiknya satu dimatikan lewat menu +, supaya prompt tidak berisi dua set alat GitHub.
