# 26 Oktober 2026 — Konektor MCP Tahap E: pemasang membawa Python + crawler (Item 129)

Item 129 ([`ROADMAP-KONEKTOR-MCP.md`](../../roadmap/ROADMAP-KONEKTOR-MCP.md)), Tahap E. Keputusan Owner: K10 (Python ikut
dibundel), K14 sesuai usul (browser stealth tidak dibundel; diunduh dengan izin saat pertama dibutuhkan).

## Yang dibuat

- **`frontend/scripts/siapkan-crawler.mjs`** (`npm run crawler:siapkan`) → `frontend/build/crawler-runtime/`
  (ter-ignore), semuanya **disalin** dari laptop, tanpa unduhan:
  - `python/` — Python dasar `.venv` crawler (`pyvenv.cfg` → home), **pustaka standar saja**: folder dasar di laptop
    Owner 1,37 GB karena `Lib\site-packages` global — tidak ikut; juga tanpa test, tkinter, idlelib, Doc, cache;
  - `python/Lib/site-packages/` — paket crawler **tanpa `playwright`/`patchright`** (215 MB penggerak browser stealth,
    tak berguna tanpa browsernya — K14), tanpa pip/pytest/editable/cache. Crawler memuat komponen stealth secara
    malas (`kanal/web.py _stealth`): bila tak ada, halaman yang memblokir dilewati & dicatat;
  - `crawler/` — kode saja.
  Skrip menguji hasilnya sendiri: jabat tangan MCP + `katalog` dengan Python salinan dari folder data sementara, dan
  memastikan ketiadaan komponen stealth berupa `ImportError` (yang ditangani crawler).
- **`package.json`**: `extraResources` `build/crawler-runtime` → `resources/crawler-runtime`; `dist`,
  `dist:portable`, `dist:publish` menjalankan `crawler:siapkan` lebih dulu — tanpa `.venv` crawler, build **gagal
  dengan jelas**, bukan terbit tanpa crawler.
- **`konektorMcp.cjs` / `main.cjs`**: aplikasi terpasang (`app.isPackaged`) menjalankan
  `resources\crawler-runtime\python\python.exe -m crawler.wajah.mcp_server` dengan `CRAWLER_ROOT` =
  `%APPDATA%\Mamet AI\crawler` (folder program tidak bisa ditulis); folder yang crawler anggap wajib (`inbox`) dibuat
  di folder data — tanpanya sumber `inbox` "belum siap" (13 vs 14). `npm run desktop` tetap memakai `.venv` repo.

## Bukti

- Runtime: **147 MB** (162 MB di folder build) · 6 alat · 16 sumber · stealth tidak terbundel.
- **Aplikasi dibangun sungguhan** (`electron-builder --win --dir --publish never`, tanpa unduhan — Electron 42.3.3
  sudah di cache): konektor dijalankan dari `release\win-unpacked\resources\crawler-runtime` (alamat
  `process.resourcesPath` aplikasi terpasang) dengan folder data sementara → menyala, **14 sumber siap**, misi
  sungguhan lewat gerbang berhasil; `.env`, `data`, `inbox` tertulis di folder data, tidak satu pun di folder program.
- Suite 117/117.

## Uji

`uji-konektor-mcp.mjs` v4 (60 pengecekan): + mode terpasang (Python & kode dari runtime, `CRAWLER_ROOT` = folder data,
tanpa folder data ditolak, runtime tak lengkap ditolak), runtime sungguhan menyala dengan 14 sumber siap & `.env` di
folder data, pemilah berkas penyiap (yang wajib ikut & yang wajib dibuang). Empat mutasi menggigit.

## Sisa (E2)

Tombol "pasang komponen stealth" — unduhan ±900 MB (penggerak + browser) dengan izin Owner saat pertama dibutuhkan,
disimpan di folder yang bisa ditulis. Sampai itu ada, crawler di aplikasi terpasang tetap jalan tanpa tingkat
stealth.

> **Koreksi 26 Okt (sesudah 4.3.0 terpasang):** folder data yang sebenarnya `%APPDATA%\ai-agent-frontend\crawler`, bukan
> `%APPDATA%\Mamet AI\crawler` seperti tertulis di atas — `userData` Electron dinamai `name` package.json. Rincian:
> [rilis 4.3.0](./2026-10-26-rilis-4.3.0-crawler-terbundel.md#koreksi-alamat-folder-data).
