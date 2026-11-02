# 2 November 2026 — Item 130 Tahap A: tampilan Home rapi + celah K5 tooltip graf ditutup

[Roadmap Item 130](../../roadmap/ROADMAP-GRAF-HOME-PETA-SISTEM.md). Hanya kode klien (`frontend/`) — tak perlu deploy.
Dicek Owner di `npm run desktop`: sesuai.

## Yang berubah

| Bagian | Sebelum | Sesudah |
|---|---|---|
| Knowledge Directory | terbuka saat Home dibuka | tertutup; "Tampilkan" membukanya |
| Kotak Menu | terbuka di Home ("lobi", Item 127 K2) | tertutup di semua halaman — keputusan lama dibalik (`ROADMAP-TAMPILAN-MENU-GAME.md` §5.2 diberi catatan) |
| Isi Directory | 481 = 458 data + 12 sub-cluster statis (tanpa `isCategory`) + 11 layanan, berlencana bawaan MEMORI | 458: memori, dokumen, chat saja (`simpulDirektori`) |
| Label kategori, layar Owner | 7 pasang bertumpuk, skala pas 0,155 | 0 bertumpuk, skala 0,478 |
| Nama simpul data di kanvas | tampil bila skala ≥ 0,75 | tampil bila skala ≥ 2 (`AMBANG_LABEL_DATA`) — tetap terbaca lewat sorot & Directory |
| Tooltip sorot simpul | nama ditulis sebagai HTML | nama di-escape (`labelTooltipAman`) |

## Akar label bertumpuk (diukur, bukan ditebak)

Simulasi dengan mesin yang sama dengan Home (`d3-force-3d`, setelan `force-graph`: link 30, charge −30, alphaDecay
0,02, velocityDecay 0,3, ±900 detak lalu `zoomToFit` padding 50), penyusun simpul yang sama (`susunGrafHome`), sebaran
data Owner (hanya hitungan: chat 131 Assistant / 84 Engineer / 4 Lite, 229 dokumen ber-potongan, 10 memori tanpa
relasi), layar 1366×768:
- 10 memori tanpa relasi tak tertambat, didorong tolakan ±470 simpul sangat jauh; `zoomToFit` mengecilkan seluruh graf
  ke 0,155 demi memuatnya → label kategori di tengah berdesakan.
- Perbaikan (`pasangGayaGraf`): gravitasi lembut ke pusat (0,02; tanpa relasi 0,12 — fungsi sendiri, rumus
  `forceX/forceY` d3, karena `d3-force-3d` bukan dependensi langsung), jarak kategori–pusat 150, tolakan kategori −700.
- Dicoba & ditolak: jarak kategori 190 memperburuk (1→2 tumpang di beberapa keadaan) — yang menumpuk selalu label
  terpanjang "Activity / Telemetry Cluster", tuasnya tolakan.
- Ambang 0,75 ikut diganti: begitu graf dirapatkan, layar 1920×1080 dibuka pada skala 0,78 → 490 nama tampil bertumpuk.

| Keadaan | Lama (tumpang / skala) | Baru |
|---|---|---|
| layar Owner 1366×768 | 7 / 0,155 | 0 / 0,478 |
| 1920×1080 | 5 / 0,232 | 0 / 0,712 |
| 2560×1440 | — | 0 / 1,004 (di antara ambang lama & baru) |
| data dua kali lipat | 8 / 0,110 | 0 / 0,402 |
| 120 memori tanpa relasi | 8 / 0,140 | 0 / 0,430 |

## Celah K5: tooltip graf menjalankan HTML

`force-graph` menampilkan `nodeLabel` lewat `float-tooltip`, yang menulis string dengan `.html()` (innerHTML). Nama
simpul = judul chat (awal pesan, bisa tempelan web), nama berkas, ringkasan memori buatan model. CSP desktop **dibuang
saat build** (`desktop:postbuild`), CSP web mengizinkan `'unsafe-inline'` → `<img onerror=…>` di nama berjalan di
renderer yang memegang `window.electronAPI`. Kini nama di-escape; komponen dashboard lain tak memakai
`dangerouslySetInnerHTML`/`innerHTML` (diperiksa uji).

## Penyusun graf dipindah ke modul murni

`susunGrafHome` (+ `safeLink`) dari `useDashboardData.js` ke `frontend/src/core/runtime/hooks/grafHome.js` supaya
bisa diuji tanpa peramban & Supabase. Dipindah dengan skrip; **292 baris identik** dengan kode lama (dibandingkan
dengan `git show HEAD`).

## Bukti

- `uji/uji-graf-home-tahap-a.mjs` 19/19 (simulasi `uji/lib/simulasiGrafHome.mjs`); **mutasi 10/10 menggigit**:
  Directory terbuka, tooltip mentah, saringan Directory lama, escape tanpa `<`, tanpa gravitasi, gravitasi terbalik,
  tolakan kategori bawaan, ambang 0,75, HomeDashboard tak memasang, Menu lobi.
- Satu mutasi sempat lolos (ambang 0,75) karena belum ada keadaan berskala di antara 0,75 dan 2 → keadaan 2560×1440
  ditambahkan, lalu menggigit.
- Suite 142/142; bundel esbuild `HomeDashboard`, `MenuTeks`, `useDashboardData` OK.
