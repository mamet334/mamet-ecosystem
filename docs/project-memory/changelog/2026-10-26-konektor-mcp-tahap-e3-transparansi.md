# 26 Oktober 2026 — Konektor MCP Tahap E3: "Yang terpasang di perangkat ini" (Item 129)

Item 129 ([`ROADMAP-KONEKTOR-MCP.md`](../../roadmap/ROADMAP-KONEKTOR-MCP.md)), Tahap E3. Keputusan Owner 26 Okt:

1. Crawler tetap **satu bundel** di pemasang — **bukan** diunduh dari repo `ecosystem-crawler` (repo itu hanya kode;
   yang tak dimiliki laptop bersih adalah Python + paket; dan menurut K12 pengembangan sudah pindah ke Mamet).
2. Komponen stealth tetap dipasang saat dibutuhkan (K14, sesuai usul).
3. Semua yang terpasang harus **transparan** — susunan ⑦ disetujui dari pratinjau, ditambah tombol "Buka folder";
   tombol "Hapus komponen stealth" ditunda.

## Yang dibuat

- **`scripts/siapkan-crawler.mjs`** menulis `komponen.json` di runtime terbundel **sesudah** bundel lulus uji jabat
  tangan: versi Python (dari `pyvenv.cfg`) & crawler (dari `pyproject.toml`), dan setiap paket di site-packages bundel
  + versi + lisensi. Lisensi dibaca dari METADATA (`License-Expression` → `License` bila satu baris pendek →
  Classifier `License ::` → `null`, tampil "tidak tercantum") — tidak ditebak.
- **`frontend/electron/komponenKonektor.cjs`** (baru, murni): `bacaKomponen` — bawaan (isi dari `komponen.json`,
  ukuran diukur), data crawler (tanpa subfolder stealth, tidak dihitung dua kali), stealth (versi dari
  `terpasang.json`; browser yang dipasang `patchright install chromium` dengan revisi dari `browsers.json` milik
  Patchright, ukuran folder yang benar-benar ada; belum terpasang → perkiraan ±830 MB). `lokasiFolder` — hanya kunci
  `bawaan/data/stealth/browser`, hanya folder yang ada.
- **`konektorMcp.cjs`**: `pengelola.komponen(id)` & `pengelola.lokasiFolder(id, kunci)` — terpisah dari `status()`
  (yang dibaca tiap 3 detik) karena menghitung ukuran folder.
- **`main.cjs` / `preload.cjs`**: IPC `konektor:komponen` dan `konektor:buka-folder` — layar mengirim **kunci**, alamat
  disusun proses utama, dibuka `shell.openPath`. Dialog stealth kini menyebut ruang disk terukur (Patchright ±110 MB,
  browser ±720 MB, total ±830 MB) — sebelumnya "Chromium ±300 MB" (ukuran unduhan kira-kira, bukan ruang disk).
- **Settings › Konektor ⑦** (`DaftarTerpasang`): Bawaan pemasang (+ "Lihat 83 paket": nama · versi · lisensi), Data
  crawler, Komponen stealth; setiap lokasi dengan "Buka folder"; gagal dibaca/dibuka → alasan ditampilkan. Di
  `npm run desktop`: "Mode pengembangan — memakai .venv repo".

## Bukti

- Runtime dibangun ulang tanpa unduhan: **153 MB · 83 paket**, `komponen.json` cocok dengan isi site-packages
  (83 = 83); ke-83 paket punya lisensi tercatat.
- Layar diperiksa di pane dengan komponen asli & data dari runtime sungguhan (stealth terpasang memakai browser
  Chromium 1248 yang ada di laptop): kedua keadaan, 83 baris paket, tombol "Buka folder" mengirim kunci yang benar,
  galat tampil, konsol bersih. 74 kelas Tailwind ada di CSS hasil build.
- Suite **119/119**.

## Uji

`uji-konektor-komponen.mjs` v1 (baru): pembaca lisensi (urutan sumber, teks lisensi utuh, UNKNOWN, kosong), daftar
paket, mode pengembangan, mode terpasang (ukuran, data tanpa stealth, nama folder browser, browser yang hilang),
runtime lama tanpa `komponen.json`, folder yang belum ada, penolakan kunci asing, sambungan IPC, teks dialog, urutan
penulisan `komponen.json`, dan runtime sungguhan. Tiga dari empat mutasi menggigit; yang lolos (hapus pemeriksaan
kunci di `lokasiFolder`) adalah penjaga ganda — peta alamat hanya berisi empat kunci, hasil yang diuji tetap benar.

## Belum dibuktikan

- "Buka folder" di Electron sungguhan (`shell.openPath` membuka Explorer) — butuh `npm run desktop` dijalankan ulang.
- Aplikasi terpasang di PC bersih (Windows Sandbox) — menunggu Owner mengaktifkan fitur itu.
