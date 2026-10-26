# 26 Oktober 2026 — Konektor MCP Tahap E2: tombol pasang komponen stealth (Item 129)

Item 129 ([`ROADMAP-KONEKTOR-MCP.md`](../../roadmap/ROADMAP-KONEKTOR-MCP.md)), Tahap E2. Keputusan Owner K14: komponen
tingkat stealth tidak dibundel; dipasang atas izin Owner saat pertama dibutuhkan. Susunan layar ⑥ disetujui Owner dari
pratinjau.

## Yang dibuat

- **`frontend/electron/stealthKonektor.cjs`** (baru, murni tanpa `electron`) — pemasangan tiga langkah dengan Python
  terbundel, semuanya ke folder sementara `%APPDATA%\Mamet AI\crawler\stealth\paket-<waktu>`:
  1. `pip install --target … --no-deps patchright==1.64.1` — **hanya Patchright**: Scrapling 0.5 (`StealthyFetcher`)
     memakai Patchright saja, Playwright tidak diimpor (diperiksa). Versi dikunci dari `.venv` pengembangan;
  2. `python -m patchright install chromium` — browser ke `%LOCALAPPDATA%\ms-playwright` (tidak diunduh ulang bila
     sudah ada);
  3. uji impor `from scrapling.fetchers import StealthyFetcher`.
  Ketiganya lulus → folder sementara menjadi `stealth\paket` dan penanda `terpasang.json` ditulis. Gagal di langkah
  mana pun (kode keluar, batas waktu 10/30/2 menit — pohon proses dimatikan) → folder sementara dihapus, penanda tidak
  ditulis, langkah & alasan dikembalikan apa adanya.
- **`konektorMcp.cjs`**: `status()` membawa keadaan stealth (`pengembangan` / `belum` / `terpasang`, `sedangDipasang`);
  crawler terpasang mendapat `PYTHONPATH` ke paket stealth **hanya bila terpasang**; `pasangStealth()` menolak
  pemasangan ganda & mode pengembangan, meneruskan variabel proxy, lalu menyalakan ulang sesi yang sedang menyala
  supaya paket baru terbaca.
- **`main.cjs` / `preload.cjs`**: IPC `konektor:pasang-stealth` — dialog persetujuan proses utama **sebelum**
  pemasangan (Patchright ±40 MB dari PyPI, Chromium ±300 MB; bawaan & Esc = Batal).
- **`scripts/siapkan-crawler.mjs`**: runtime kini membawa `pip` (untuk langkah 1) dan `stealth.json`
  (`{paket, browser}`); runtime 153 MB.
- **Settings › Konektor ⑥** (`BagianKonektor.jsx`, `BarisStealth`): belum terpasang → keterangan + tombol "Pasang
  komponen stealth"; sedang → "Memasang… (bisa beberapa menit)"; gagal → langkah & alasan + "Coba lagi"; terpasang →
  ✓ versi paket. Tidak tampil di `npm run desktop` (stealth sudah ada di `.venv`).

## Bukti

- **Pemasangan nyata tanpa unduhan** (`uji-konektor-stealth.mjs` bagian 5): langkah pip diganti salinan Patchright
  dari `.venv`; langkah browser & uji ASLI (Chromium 1248 sudah ada di laptop); crawler dari runtime terbundel lalu
  membuka halaman lewat `StealthyFetcher` (tingkat 3) — berhasil.
- **Layar** diperiksa di pane dengan komponen asli & API tiruan: kelima keadaan tampil sesuai rancangan, tombol
  memanggil `pasangStealth`, tanpa galat konsol.
- Suite 118/118.

## Uji

`uji-konektor-stealth.mjs` v1 (26 pengecekan, baru): urutan & argumen langkah, penanda hanya sesudah tiga langkah
lulus, gagal tanpa sisa, batas waktu, `PYTHONPATH` hanya bila terpasang, dialog sebelum pemasangan, pemasangan nyata.
Empat mutasi menggigit. `uji-konektor-mcp.mjs` disesuaikan (runtime membawa pip).

## Belum dibuktikan

- Tombol **Batal** di dialog (baris kembali ke "belum terpasang" tanpa pesan gagal) — dibaca dari kode, belum dilihat.
- Pemasangan sungguhan di aplikasi terpasang (dialog asli + unduhan ±340 MB) — menunggu build pemasang berikutnya
  dan izin unduhan Owner.
