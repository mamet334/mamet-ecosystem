# 28 Oktober 2026 — Kenapa uji & build hari ini lambat: uji stealth yang goyah, dan Vite yang mengawasi hasil build

Dua sebab, satu cerita. `uji-konektor-stealth.mjs` dua kali dibunuh batas 120 detik `jalankan-semua.mjs` (26–27 & 28 Okt,
sebabnya baru terekam yang kedua). Diperbaiki di sesi terpisah (worktree `focused-joliot-4a44b2`), lalu digabung ke `main`
di sesi ini atas izin Owner. Saat memeriksa laporannya, klaim "proses node lain memakan ±3,9 jam CPU" ternyata menunjuk
**server Vite dari `npm run desktop`**.

## 1. Uji stealth (sesi terpisah)

Diukur per langkah — dari ±35 s sendirian (sekali 207 s):

| Langkah | Waktu | Sebab |
|---|---|---|
| salin paket Patchright 109 MB ke TEMP | 3–7 s | 93 MB-nya `driver/node.exe` |
| `patchright install` | 5–7 s | Defender memindai `node.exe` salinan baru (jalan kedua 40 ms) |
| buka `https://example.com` | 14–26 s | internet sungguhan |

Ekor panjangnya **bukan internet**: dengan halaman lokal pun peluncuran Chromium 0,14–39 s dan `StealthyFetcher.fetch`
14–96 s (Scrapling membuat profil Chromium baru tiap pengambilan — itulah yang memang diuji). Dan uji ini **tak pernah
menghapus folder sementaranya**: 85 folder `data-nyata-*` di `%TEMP%`.

**Perbaikan**
- `uji-konektor-stealth.mjs`: paket **ditaut-keras** ke `.tmp/` repo (gitignored; `node.exe` jalan 60 ms, tanpa
  pindai ulang; beda volume → jatuh ke salinan); halaman dari **server HTTP lokal** yang mencatat permintaan masuk
  (bukti Chromium sungguh membukanya); semua folder sementara dihapus; tiap langkah bertenggat & mencetak durasinya.
- `jalankan-semua.mjs`: berkas uji boleh menyatakan batasnya sendiri — `// BATAS-UJI-DETIK: N` (maks 600). Uji stealth
  menyatakan 300. Berkas lain tetap 120; setiap batas khusus tampil di `batasKhusus` laporan JSON — tak ada pelonggaran
  diam-diam. Komentar `BATAS_MS` yang basi ("yang terlama sekitar 10 detik") diganti angka terukur.
- **Kode produksi — `frontend/electron/stealthKonektor.cjs`**: memindah folder paket sementara → `paket` dengan
  `renameSync` ditolak `EPERM` saat antivirus masih memegang berkas baru (2 dari 6 jalan). `pasangStealth` dulu
  **melempar pengecualian mentah dan meninggalkan folder sementara** — melanggar kontraknya sendiri. Kini
  `pindahkanFolder()` mengulang kunci sesaat (`EPERM`/`EACCES`/`EBUSY`) sampai 10 s (pip melakukan hal serupa); tetap
  gagal → `{ok:false, langkah:'pindah', alasan}`, folder sementara dihapus, penanda tidak ditulis. **Sampai ke pengguna
  lewat rilis berikutnya.**
- `uji-verifikasi-tahap6.mjs`: `AKAR` dulu dipaku ke checkout utama (di worktree ia menguji penjalan yang salah) → relatif;
  plus uji batas per berkas & habis waktu.

Mutasi sesi itu: 6 dari 7 menggigit. Yang lolos membantah dugaannya sendiri — `anak.kill()` sudah mematikan Python &
Chromium di Windows (Node memasukkan anak ke *job object*), jadi pembunuh pohon proses tambahan dicabut; uji yang menjaga
sifat itu tetap ada.

## 2. Vite (sesi ini)

pid 9132 = `vite` dari `npm run desktop`, mulai 09.01: **497 menit CPU dalam ±5,5 jam**; diukur 10 s saat diam: **160%
satu inti**. `vite.config.js` tidak mengecualikan apa pun, jadi Vite mengawasi seluruh `frontend/` — termasuk
`release/` (±12.800 berkas, aplikasi hasil kemas yang dibuat build lokal Electron 45 pukul 09.20) dan `build/` (±12.700
berkas, runtime crawler yang ditulis ulang tiap `npm run crawler:siapkan`).

**Perbaikan:** `server.watch.ignored: ['**/release/**', '**/build/**', '**/dist/**']` — keluaran build yang diabaikan git
dan tak pernah diimpor renderer; bawaan Vite (`.git`, `node_modules`) tetap. Diperiksa dulu: tak ada folder kode sumber
bernama `build`/`dist`/`release`.

**Bukti** (proses Vite yang sama — Vite memuat ulang konfigurasinya sendiri; log renderer: "server connection lost.
Polling for restart…" 14.42; server tetap melayani HTTP 200 di 5173): **160% → 0,0% (15 s) → 0,1% (30 s)**.

## 3. Pembersihan (atas izin Owner)

85 folder `data-nyata-*` di `%TEMP%` (**3,6 GB terukur** — laporan sesi itu memperkirakan ±9 GB dari 85 × 109 MB) dan
`frontend/release/win-unpacked` (hasil build lokal 28 Okt, 0,95 GB) dihapus: **+3,59 GB di C:, +0,95 GB di D:**. Isi
lain `release/` tidak disentuh.

## Bukti penggabungan

- Diff empat berkas dari worktree diterapkan ke `main` (`git apply --check` bersih; keempat berkas tak berubah di `main`
  sejak worktree bercabang); hasilnya **identik** dengan worktree; 0 karakter kendali.
- **Suite penuh di `main` 123/123 dua kali** (258,6 s; 104,9 s) — `batasKhusus`: uji stealth 300 s; `.tmp/` bersih.
- Mutasi silang di `main`: kunci sesaat tidak diulang → `uji-konektor-stealth` merah ("rename ditolak EPERM dua kali…").

## Sisa

- Worktree `focused-joliot-4a44b2` sudah tergabung — boleh dibuang Owner.
- Usulan sesi itu (kartu terpisah): batas 300 s verifikasi patch Engineer (`main.cjs`, `BATAS_UJI_S`) bisa lebih pendek
  daripada suite itu sendiri.
- ±68 berkas uji masih memaku jalur checkout utama — di worktree mereka menguji kode checkout utama.
