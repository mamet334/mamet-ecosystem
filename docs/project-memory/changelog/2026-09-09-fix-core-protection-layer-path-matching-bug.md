# Changelog: Perbaikan Bug Core Protection Layer — 5 dari 12 Pattern Immutable Tidak Pernah Cocok

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai & Diverifikasi (11/11 test logic pass + build production sukses)
**Scope:** `frontend/src/core/runtime/services/engineer/CapabilityGuard.js`
**Trigger:** Pertanyaan Owner soal titik masuk dokumen aturan ("apakah AGENTS.md?") — menelusuri jalur *runtime* Engineer (`engineer.js` `_loadStaticKnowledge()`) menemukan bug ini secara tidak sengaja saat memverifikasi konsistensi konvensi path.

---

## 1. Ringkasan

`CapabilityGuard.js` mengimplementasikan **Core Protection Layer** (ADR-015 §2.3) — lapisan yang seharusnya memblokir mutlak modifikasi terhadap file inti sistem (Kernel, EventBus, Constitution, dll) sebelum patch Engineer diterapkan (`PatchApplier.js`). Audit menemukan **5 dari 12 pattern di `isImmutableFile()`, dan 3 dari 4 pattern di `isProtectedFile()`, tidak pernah bisa cocok** dengan path nyata yang dipakai runtime — sehingga proteksi untuk file-file tersebut secara diam-diam tidak berfungsi sejak pattern-pattern ini pertama ditulis.

## 2. Root Cause

Ditelusuri end-to-end alur path di seluruh pipeline Engineer:
`extractFileNamesFromTask()` (regex `frontend/...`/`src/...`/nama file) → `tryReadFile()` → `FileIndexService.resolvePath()` (dibangun dari `storageManager.listRecursive('.')`).

**Di seluruh rantai ini, path yang dihasilkan selalu path relatif repo tanpa leading slash** (contoh: `"constitution/00_CONSTITUTION.md"`, `"frontend/src/core/runtime/Kernel.js"`). Tidak ada satu titik pun yang menambahkan `/` di depan.

Sementara itu, pattern-pattern di `IMMUTABLE_PATTERNS`/`PROTECTED_PATTERNS` semuanya diawali `/` (mis. `/constitution/00_CONSTITUTION.md`), dan dicek dengan `filePath.includes(pattern)`. Untuk file yang bersarang dalam beberapa folder (`frontend/src/core/runtime/Kernel.js`), pattern kebetulan tetap cocok karena ada `/` dari segmen path sebelumnya (`.../src/core/...`). Tapi untuk file yang berada langsung di **root repo** (`constitution/`, `electron/` di bawah `frontend/` tanpa nested lain, `supabase/`) — tidak ada segmen sebelumnya yang menyediakan `/` itu, sehingga `.includes('/constitution/...')` **selalu false**.

## 3. Bug yang Ditemukan (Detail)

### `isImmutableFile()` — 5 dari 12 pattern rusak:

| Pattern Lama | Masalah | File Asli Nyata |
|---|---|---|
| `/constitution/00_CONSTITUTION.md` | Leading slash, `constitution/` di root repo | `constitution/00_CONSTITUTION.md` |
| `/constitution/01_VISION.md` | Sama | `constitution/01_VISION.md` |
| `/constitution/09_DNA.md` | Sama | `constitution/09_DNA.md` |
| `/electron/main.js` | **Ekstensi salah** — file asli `.cjs` bukan `.js` | `frontend/electron/main.cjs` |
| `/core/runtime/ModuleLoader.js` | **Nama salah** — file asli kebab-case | `frontend/src/core/runtime/module-loader.js` |

**Dampak:** tiga file konstitusi paling kritis (`00_CONSTITUTION.md`, `01_VISION.md`, `09_DNA.md` — persis yang baru saja ditetapkan `ADR-0018` sebagai otoritas tertinggi Mamet Ecosystem) **tidak benar-benar terlindungi** dari modifikasi oleh Engineer, walau sistem meyakini (dan mendokumentasikan di ADR-015) bahwa mereka immutable. File entry-point Electron (`main.cjs`) dan `module-loader.js` juga demikian.

### `isProtectedFile()` — 3 dari 4 pattern rusak (root cause sama):

| Pattern Lama | Masalah |
|---|---|
| `/supabase/functions/agent-process/index.ts` | Leading slash, `supabase/` di root repo |
| `/supabase/functions/agent-process/lib/` | Sama |
| `/frontend/src/core/runtime/services/engineer.js` | Leading slash, `frontend/` di root repo |

Hanya `/core/runtime/services/` yang kebetulan berfungsi (bersarang di bawah `frontend/src/`).

## 4. Perbaikan

Root cause diperbaiki (bukan menambal satu-per-satu): seluruh leading slash dihapus dari kedua daftar pattern, plus dua kesalahan nama file (`main.js`→`main.cjs`, `ModuleLoader.js`→`module-loader.js`). Komentar ditambahkan menjelaskan alasan (kenapa nested file "kebetulan" bekerja sebelumnya, kenapa root-level file tidak).

## 5. Verifikasi

1. **Tes logika langsung** (Node ESM import, tanpa mock): 11/11 kasus PASS, termasuk sanity-check negatif (file biasa yang bukan bagian dari pattern manapun tidak salah terdeteksi sebagai immutable).
2. **Build production:** `npm run build` sukses, 11.54s, 0 error.
3. Tidak ada perubahan behavior untuk 7 pattern yang sebelumnya sudah benar (Kernel.js, EventBus.js, ServiceManager.js, ProcessManager.js, StorageManager.js, DiscoveryManager.js, preload.cjs) — hanya menghapus leading slash yang tidak mengubah hasil match untuk kasus-kasus ini.

## 6. File yang Diubah

- `frontend/src/core/runtime/services/engineer/CapabilityGuard.js` — `isImmutableFile()` dan `isProtectedFile()` diperbaiki
- `docs/roadmap/INDEX-ROADMAP.md` — Backlog Item 27 didaftarkan

## 7. Konteks Temuan

Bug ini ditemukan **secara tidak sengaja** saat menjawab pertanyaan Owner soal titik masuk dokumen aturan ("apakah AGENTS.md jadi entry point umum?"). Jawabannya: ya untuk AI eksternal, tapi Engineer versi produksi (di dalam aplikasi) punya jalur *runtime* sendiri yang sama sekali terpisah (`engineer.js` `_loadStaticKnowledge()`), dengan daftar file hardcode sendiri. Menelusuri jalur itu untuk menjelaskan perbedaannya-lah yang mengarah ke penemuan bug Core Protection Layer ini.

## 8. Tidak Dikerjakan / Di Luar Scope

Ditemukan bersamaan (belum diperbaiki, item terpisah):
- `_loadStaticKnowledge()` di `engineer.js` mencoba membaca 4 path yang tidak pernah ada (`constitution/MAEF_v3.0.md`, dll) — gagal senyap via try/catch, tidak crash, tapi sia-sia.
- Daftar yang sama **tidak memuat** `24_ANTI_HALLUCINATION_PROTOCOL.md` s/d `27_DECISION_HEURISTICS.md` ke `brain.static` Engineer — berarti Engineer produksi tidak pernah membaca Anti-Hallucination Protocol.

Kedua hal di atas murni soal *isi daftar file yang dimuat* (dampaknya: Engineer kurang informasi), berbeda kategori dari bug *pattern-matching* yang baru diperbaiki di changelog ini (dampaknya: proteksi keamanan tidak berfungsi). Menunggu keputusan Owner untuk diperbaiki di sesi terpisah.
