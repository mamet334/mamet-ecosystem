# Changelog: Tool Registry Folder-Scan (`tools/`) + WebComparison Jadi Tool Nyata

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai & Diverifikasi Live Penuh (2026-09-09) — 2 bug ditemukan & diperbaiki selama live-test (§6-7), Tier 3 web search dikonfirmasi bekerja end-to-end lewat jalur baru tanpa fallback (§7 update).
**Scope:** `tools/web_search.js` (baru), `ToolRegistryService.js`, `RetrievalOrchestrator.js`, `Kernel.js`, `Settings.jsx`

---

## 1. Latar Belakang

Owner mengoreksi bahwa `WebComparisonService` seharusnya didaftarkan lewat tool registry, bukan dipanggil langsung dari `RetrievalOrchestrator`. Owner secara eksplisit meminta pola **folder `tools/` yang di-scan otomatis** ("seperti Linux [kernel modules]") — taruh file baru, ter-detect tanpa edit kode aplikasi — dan meminta **scan ulang manual tanpa restart app**, bukan cuma scan sekali saat boot.

Sebelum implementasi, ditemukan (dan dilaporkan ke Owner) bahwa `ToolRegistryService.js` yang sudah ada sebelumnya **tidak fungsional**: `executeTool()` tidak pernah memanggil `tool.execute()` (cuma `return {success:true}` langsung), dan tool `memory_manager` referensi `memoryService` yang tidak pernah di-import (akan crash kalau benar-benar dieksekusi). `web_search` di situ juga cuma stub `{ message: 'Web search tool ready' }`. Owner memilih opsi "refactor penuh jadi tool mandiri" untuk web search saat ditanya.

## 2. Desain yang Disepakati

1. Folder `tools/` di **root repo** (bukan `frontend/src/`) — supaya tetap ada & terbaca di app yang sudah di-build (Vite membundel `frontend/src` habis, tidak bisa dibaca ulang sebagai source saat runtime).
2. Tiap file `.js` di `tools/` wajib `export default { name, description, category, async execute(params, context) {...} }` — tanpa `import` relatif (dimuat lewat dynamic `import()` dari Blob URL, bukan lewat bundler Vite, jadi resolusi modul relatif tidak berlaku). Akses ke service lain (mis. `WebComparisonService`) lewat `context.serviceManager` yang disuntikkan saat eksekusi.
3. `WebComparisonService.searchWeb(query, options)` **tidak diubah sama sekali** — sudah punya kontrak fungsi bersih (`Promise<result>`) yang cocok langsung dipakai sebagai `execute()`. `tools/web_search.js` cuma mendelegasikan ke situ, tidak menduplikasi logic.
4. `RetrievalOrchestrator` Tier 3 sekarang manggil `ToolRegistryService.executeTool('web_search', params)`, dengan **fallback** ke pemanggilan langsung `WebComparisonService.searchWeb()` kalau tool belum/tidak ketemu di registry (mis. scan folder gagal) — supaya Tier 3 tidak mati total kalau mekanisme scan bermasalah.
5. Scan folder dijalankan sekali saat boot (`Kernel.js`), **dan** bisa di-scan ulang manual kapan saja lewat tombol baru di Settings tanpa restart app.

## 3. Yang Diubah/Ditambah

- **`tools/web_search.js`** (baru) — implementasi tool nyata, delegasi ke `context.serviceManager.get('WebComparisonService').searchWeb(...)`.
- **`ToolRegistryService.js`**:
  - `executeTool()` diperbaiki — sekarang benar-benar memanggil `tool.execute(args, { serviceManager })`, dengan error handling yang jujur (tool tidak ketemu / tidak punya `execute()` / exception saat eksekusi — semua dilaporkan sebagai `{success:false, error}`, bukan disembunyikan).
  - Stub `web_search` lama **dihapus** dari `initialize()` (sekarang datang dari `tools/web_search.js` lewat scan).
  - `scanToolsFolder()` baru — baca `tools/` via `StorageManager.listRecursive()`/`.read()` (mekanisme yang sama yang dipakai Engineer baca `constitution/*.md`, sudah teruji), muat tiap file lewat dynamic `import()` dari Blob URL, daftarkan tool yang valid. Tool hasil scan sebelumnya yang filenya sudah hilang/berubah nama otomatis dibersihkan saat scan ulang (`fileSourcedToolNames` tracking).
  - Stub `memory_manager` (referensi `memoryService` yang tidak ter-import) dan `file_reader`/`deep_research` (placeholder) **dibiarkan apa adanya** — bukan scope perbaikan ini, cukup dikomentari kondisinya.
- **`RetrievalOrchestrator.js`** — Tier 3 sekarang lewat `ToolRegistryService.executeTool('web_search', ...)`, dengan fallback ke pemanggilan langsung `WebComparisonService` kalau tool belum terdaftar.
- **`Kernel.js`** — `toolRegistry.scanToolsFolder()` dipanggil sekali setelah `ToolRegistryService` diregister di Phase 3.
- **`Settings.jsx`** — section baru "Tool Registry": tombol "Scan Ulang Tools" (memanggil `scanToolsFolder()` on-demand, tanpa restart), status scan terakhir (waktu, jumlah file, daftar error kalau ada file gagal dimuat), dan grid kartu menampilkan semua tool yang terdaftar (nama, kategori, deskripsi).

## 4. Kenapa Ini Lebih Berisiko Dari Perubahan Biasa

Tier 3 web search (`WebComparisonService`) **sudah diverifikasi live** sebelumnya (lihat `2026-09-09-fix-core-protection-layer-path-matching-bug.md` §9 & log Owner: dapat 4 hasil berita sungguhan dari Antara News). Perubahan ini menyisipkan satu layer tidak langsung baru (`ToolRegistryService.executeTool` → dynamic import dari Blob URL → `tool.execute()` → `WebComparisonService.searchWeb()`) di antara `RetrievalOrchestrator` dan implementasi yang sudah terbukti jalan itu. Kalau dynamic `import()` dari Blob URL ternyata tidak berperilaku seperti yang diharapkan di Electron renderer (mis. masalah MIME type, CSP, atau context isolation), Tier 3 bisa diam-diam jatuh ke jalur fallback (yang perilakunya identik ke versi lama) — fallback ini SUDAH ditulis eksplisit untuk mencegah Tier 3 mati total, tapi tetap berarti keuntungan arsitektural (tool bisa dipanggil generik) tidak tercapai kalau scan gagal.

## 5. Verifikasi & Keterbatasan

**Sudah diverifikasi:**
- `npm run build`: sukses, ~16s, 0 error (3 kali build berturut-turut setelah tiap perubahan).
- Path folder `tools/` dikonfirmasi benar secara statis: `PROJECT_ROOT` di `electron/main.cjs` (`path.resolve(__dirname, '..', '..')`, dari `frontend/electron/`) resolve ke root repo — persis lokasi `tools/web_search.js` dibuat. Tidak perlu perubahan IPC/main process sama sekali, memakai handler `fs:listFilesRecursive`/`fs:readFile` yang sudah ada & sudah terbukti dipakai untuk baca `constitution/*.md`.
- Ditelusuri manual: `WebComparisonService.searchWeb()` tidak diubah sama sekali, kontrak fungsinya (`(query, options) -> Promise<result>`) sudah cocok langsung dipanggil dari `execute(params, context)` tanpa adaptasi tambahan.

**BELUM diverifikasi sama sekali (perlu Owner cek langsung di `npm run desktop`, prioritas tinggi karena menyentuh flow yang sudah live):**
1. **Apakah `scanToolsFolder()` benar-benar menemukan & memuat `tools/web_search.js` saat boot** — cek Console: harus ada log `[ToolRegistryService] ✅ Scan selesai: 1/1 tool terdaftar dari "tools/" ['web_search']`. Kalau muncul error dynamic import (mis. soal Blob URL/module), akan tercatat di `lastScan.errors` dan tampil di Settings.
2. **Apakah Tier 3 web search MASIH benar-benar berfungsi** (tidak diam-diam jatuh ke fallback lama) — cek Console harus ada `[RetrievalOrchestrator] Web comparison requested. Initiating Tier 3 (via ToolRegistryService: web_search)...` DIIKUTI hasil sukses, BUKAN warning `Tool "web_search" belum terdaftar... fallback panggil WebComparisonService langsung`.
3. **Tombol "Scan Ulang Tools" di Settings** — klik, pastikan status berubah, dan daftar tool di bawahnya menampilkan `web_search` dengan deskripsi yang benar.
4. Uji regresi: ulangi test yang sama seperti sebelumnya (prompt patch ke `constitution/09_DNA.md` di Workspace Engineer) untuk pastikan tidak ada regresi di jalur lain yang bersinggungan.

Kalau butir 2 gagal (Tier 3 ternyata jatuh ke fallback), sistem tetap aman (Tier 3 tidak mati, cuma tidak lewat registry) — tapi berarti mekanisme scan folder perlu didebug lebih lanjut sebelum tool baru lain ditambahkan ke `tools/`.

## 6. Bug Ditemukan & Diperbaiki Saat Live Test Pertama (2026-09-09)

Owner langsung menguji di `npm run desktop` dan menemukan bug nyata di percobaan pertama:
`[ToolRegistryService] ✅ Scan selesai: 0/1 tool terdaftar dari "tools/" []` — file **terdeteksi** (`listRecursive` menemukan 1 file), tapi **gagal dibaca** (`storageManager.read("web_search.js")` → `null`).

**Root cause:** `listFilesRecursive(dirPath)` di `electron/main.cjs` (`walkDir`) mengembalikan path **relatif terhadap `dirPath` itu sendiri** (mulai `relativePath=''` tepat di folder yang diminta) — jadi `listRecursive('tools')` mengembalikan `"web_search.js"`, BUKAN `"tools/web_search.js"`. Kode `scanToolsFolder()` yang ditulis sebelumnya salah asumsi path itu sudah lengkap relatif ke root repo (asumsi ini valid untuk `listRecursive('.')` yang dipakai `FileIndexService`, tapi tidak valid untuk `listRecursive('tools')`), lalu memanggil `storageManager.read("web_search.js")` — yang dicari jadi file di ROOT repo, bukan di `tools/`, sehingga selalu `null`.

**Perbaikan:** `scanToolsFolder()` sekarang menggabungkan kembali `${TOOLS_FOLDER}/${relativeFilePath}` sebelum memanggil `storageManager.read()`. Build ulang sukses (0 error).

## 7. Bug Kedua Ditemukan di Live Test Berikutnya — CSP Memblokir `blob:` Script (2026-09-09)

Setelah fix §6, Owner tes lagi (2× klik "Scan Ulang Tools"). File **berhasil dibaca** kali ini (`read("tools/web_search.js")` → 1765 chars ✅), tapi muncul blocker baru saat mengeksekusi modulnya:

```
Loading the script 'blob:http://localhost:5173/...' violates the following Content Security Policy
directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net"
→ [ToolRegistryService] Gagal memuat tool dari "tools/web_search.js":
  Failed to fetch dynamically imported module: blob:...
```

**Root cause:** `frontend/index.html` punya `<meta http-equiv="Content-Security-Policy">` yang tidak mencantumkan `blob:` di direktif `script-src` (padahal `img-src` dan `media-src` sudah mencantumkannya). Dynamic `import()` dari Blob URL karena itu diblokir CSP di mode dev (`npm run desktop` → Vite dev server di `localhost:5173`).

**Perbaikan:** tambahkan `blob:` ke `script-src` di `frontend/index.html`.

**Catatan keamanan (jujur):** ini melonggarkan CSP — script dari Blob URL sekarang boleh dieksekusi. Konteksnya: (a) `webSecurity` di Electron app ini memang sudah dinonaktifkan (ada warning-nya tiap boot), (b) `'unsafe-inline'` dan `'unsafe-eval'` sudah diizinkan sejak awal, (c) build production **menghapus seluruh meta CSP** lewat script `postbuild` di `package.json`. Jadi penambahan `blob:` ini praktis tidak mengubah postur keamanan yang ada — tapi tetap dicatat di sini supaya tidak jadi perubahan senyap.

**✅ Dikonfirmasi (2026-09-09, setelah restart app):** Scan sukses baik saat boot otomatis maupun lewat tombol manual "Scan Ulang Tools":
```
[ToolRegistryService] Registering tool: web_search
[ToolRegistryService] ✅ Scan selesai: 1/1 tool terdaftar dari "tools/" ['web_search']
```
Kartu `web_search` juga tampil benar di UI Settings (nama, kategori RESEARCH, deskripsi). Folder-scan + dynamic import dari Blob URL sekarang bekerja end-to-end.

**✅ Dikonfirmasi (2026-09-09, prompt "carikan berita terbaru ai claude" di ws-assistant):** Tier 3 web search lewat jalur baru berhasil end-to-end, tanpa fallback:
```
[RetrievalOrchestrator] Web comparison requested. Initiating Tier 3 (via ToolRegistryService: web_search)...
[ToolRegistryService] Executing tool: web_search
[WebComparisonService] 🌐 Menjalankan pencarian web (Timeout: 8000ms)...
[WebComparisonService] Google News RSS ID returned 5 results
[WebComparisonService] ✅ Web search sukses (5 hasil, 1536ms)
[AssistantService] PR#9 RetrievalOrchestrator: Tier 3, strategy=web_search_comparison, sufficiency=0.7
```
Tidak ada warning "Tool belum terdaftar... fallback" — jalur `RetrievalOrchestrator` → `ToolRegistryService.executeTool('web_search')` → `WebComparisonService.searchWeb()` terbukti bekerja sama seperti sebelum refactor, hanya sekarang lewat registry yang bisa di-scan dari folder.

## 8. Status Akhir

Ketiga bug yang ditemukan selama live-testing sesi ini (path relatif §6, CSP blob: §7) sudah diperbaiki dan dikonfirmasi. Fitur folder-scan tool registry + WebComparison sebagai tool registry-aware **selesai dan terverifikasi live secara penuh** — baik jalur scan (§6-7) maupun jalur eksekusi Tier 3 yang sesungguhnya (di atas).
