# Changelog: Backlog Item 11–13 — System Logs App, Distilasi Arsip, & Aturan Prompt Pengaman

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai — 3 item tuntas + 1 bug prasyarat ditemukan & diperbaiki (diverifikasi live di dev server)
**Scope:** Bagian 6 Item 11–13 `INDEX-ROADMAP.md` — seluruh gap tersisa dari `roadmap-lanjutan.md`
**Komponen Terdampak:** `SystemLogsApp.jsx` (baru), `Kernel.js`, `AppRegistry.js`, `system.json`, `engineer.js`, `_knowledge_archive/`
**Referensi Terkait:** [`roadmap-lanjutan.md`](../../roadmap/roadmap-lanjutan.md), [`2026-09-08-rekonsiliasi-dokumen-roadmap-lama.md`](./2026-09-08-rekonsiliasi-dokumen-roadmap-lama.md)

---

## 1. Latar Belakang

Rekonsiliasi dokumen roadmap lama (2026-09-08) menyisakan tiga gap kode kecil yang didaftarkan sebagai Backlog Item 11–13. Ketiganya berasal dari `roadmap-lanjutan.md` dan saling bergantung: Item 13 poin 2 (larangan baca kode arsip) baru bermakna setelah Item 12 (berkas ringkasan arsip) ada. Urutan pengerjaan: **11 → 12 → 13**.

---

## 2. Item 11 — System Diagnostic App (`roadmap-lanjutan.md` §4.2)

### 2.1 Bug Prasyarat yang Ditemukan

Saat menelusuri sumber data untuk Event Viewer, ditemukan bug di `Kernel.log()`:

```javascript
// SEBELUM (bug):
if (this.health[level + 's']) {
  this.health[level + 's'].push(logEntry);
}
```

Level dipanggil dalam huruf besar (`this.log('ERROR', ...)`, `this.log('WARN', ...)`), sedangkan bucket di `this.health` bernama huruf kecil (`errors`, `warnings`). Maka `'ERROR' + 's'` → `health['ERRORs']` → `undefined` → **tidak pernah ada entri yang tersimpan**.

**Dampak:** `health.errors` dan `health.warnings` kosong permanen sejak awal. Akibatnya `getLogs()` (`Kernel.js:430`) selalu mengembalikan array kosong, dan tampilan health di `Settings.jsx:19,37` tidak pernah menampilkan apa pun. Event Viewer yang dibangun di atasnya akan kosong by construction — karena itu bug ini wajib diperbaiki lebih dulu.

**Perbaikan:** pemetaan level→bucket eksplisit.
```javascript
const bucket = level === 'ERROR' ? 'errors' : level === 'WARN' ? 'warnings' : null;
if (bucket) { this.health[bucket].push(logEntry); }
```

### 2.2 Aplikasi `SystemLogsApp`

`frontend/src/components/system/SystemLogsApp.jsx` — Event Viewer bergaya `dmesg`:
- Kartu statistik: Status, Fase, Uptime, Total Event, jumlah Error, jumlah Peringatan.
- Banner peringatan bila kernel `DEGRADED` / `SAFE_MODE` (terhubung dengan Fase 2.1).
- Filter Semua / Error / Peringatan, entri terurut terbaru dulu.
- Detail `data` tiap entri dapat dibuka (render JSON).
- Auto-refresh 2 detik yang bisa dimatikan, plus tombol muat ulang manual.

**Registrasi** sepenuhnya metadata-driven, tanpa mengubah logika Kernel:
- `frontend/public/metadata/system.json` — entri `{ "id": "app:kernel", "name": "System Logs", "icon": "ScrollText", "component": "SystemLogsApp" }`.
- `frontend/src/core/application/AppRegistry.js` — pemetaan `'SystemLogsApp'` ke lazy import.

Slot navigasinya **sudah tersedia sejak lama**: `navigation.json` memuat grup **System Observability** berisi `app:verification`, `app:event-stream`, dan `app:kernel` — ketiganya sebelumnya menunjuk app yang tidak pernah didefinisikan. Item ini mengisi `app:kernel`; dua entri lain masih menjadi placeholder tanpa app.

---

## 3. Item 12 — Distilasi Pengetahuan Arsip (`roadmap-lanjutan.md` §1.2)

`_knowledge_archive/00_EXPERIMENT_HISTORY.md` dibuat, memuat untuk klaster **Legacy Cognition Layer** (18 berkas + 3 route API): tujuan, alasan ditinggalkan, kesimpulan (pengganti aktifnya), gagasan yang tetap hidup di arsitektur sekarang, serta tabel peran per berkas agar Engineer tidak perlu membuka kode usang sama sekali.

**Catatan akurasi:** lapisan ini **tidak gagal secara teknis** — ditinggalkan karena duplikasi tanggung jawab setelah digantikan `CognitiveMemoryGovernorService.js` dan `MemoryGovernorService.js`. Jejak penonaktifannya terlihat pada `memoryStabilityCore.ts` yang mengekspor `LEGACY_COGNITION_ENABLED = false`. Ringkasan ditulis sesuai fakta ini, bukan mengarang narasi kegagalan.

**Temuan:** berkas yang disebut `roadmap-lanjutan.md` §1.1 (`chaos_memory_v3.ts`, `memory_hardening_v2.ts`, `semantic_memory_v4.ts`) serta folder `scratch/` dan `mametlite/` **tidak ada di arsip**. Isi arsip yang terlacak git hanya 25 berkas (seluruhnya `lib_deprecated_cognition/` + `00_INDEX.md` + `rencana better stack.txt`); folder `changelog/`, `handoff/`, `scripts/` ada di disk tetapi kosong.

`00_INDEX.md` ikut dikoreksi karena mendaftarkan folder yang tidak eksis (`api/`, `graphify-out/`, `lib/`, `mametlite/`, `scratch/`, dll) — indeks yang menyesatkan justru merusak tujuan Item 12 & 13. Kini menunjuk `00_EXPERIMENT_HISTORY.md` sebagai titik baca utama.

---

## 4. Item 13 — Aturan Prompt Pengaman (`roadmap-lanjutan.md` §3.1)

Dua aturan ditambahkan ke blok `### ATURAN KODE (WAJIB DIPATUHI) ###` pada `engineer.js` → `_buildPatchPrompt()`:

1. `- DILARANG KERAS menulis eventBus.emit("Engineer:GeneratePatch", ...) di file yang Anda ubah (memicu infinite loop patch)` — proteksi lapis kedua yang melengkapi Circuit Breaker runtime di `engineer.js:1389–1398`.
2. `- Untuk belajar dari eksperimen lama, HANYA baca _knowledge_archive/00_EXPERIMENT_HISTORY.md. DILARANG membaca atau menyalin kode raw dari _knowledge_archive/` — menutup rantai dengan Item 12.

---

## 5. Verifikasi

### 5.1 Build Production
```
✓ built in 11.09s   (exit code 0)
dist/assets/SystemLogsApp-k5T9lMTX.js   — chunk lazy ter-emit
dist/metadata/system.json               — memuat app:kernel
```

### 5.2 Verifikasi Live (dev server `localhost:5173`)
- **Registrasi app:** console boot mencatat `[ApplicationManager] Registered app: app:kernel`, pada urutan yang benar antara `app:agent-forge` dan `app:settings`.
- **Modul komponen:** `import('/src/components/system/SystemLogsApp.jsx')` berhasil, default export berupa fungsi bernama `SystemLogsApp`.
- **Perbaikan bug Kernel:** memanggil `kernel.log('WARN', ...)` dan `kernel.log('ERROR', ...)` mengubah hitungan dari `errors: 0 → 1` dan `warnings: 0 → 1` (sebelum perbaikan selamanya `0`), sedangkan `kernel.log('INFO', ...)` benar **tidak** masuk bucket mana pun. Bentuk entri `{ timestamp, level, message, data }` sesuai yang dirender UI.

### 5.3 Batasan Verifikasi
Tampilan akhir `SystemLogsApp` **belum dilihat langsung di browser** karena berada di balik halaman login aplikasi, dan kredensial tidak dimasukkan. Yang terverifikasi: registrasi app di runtime, modul komponen termuat tanpa error, build chunk ter-emit, dan sumber datanya kini benar-benar terisi. Render akhir perlu dikonfirmasi Owner setelah login.

---

## 6. Daftar Berkas

| No | Berkas | Perubahan |
|---|---|---|
| 1 | `frontend/src/components/system/SystemLogsApp.jsx` | **Baru** — Event Viewer kernel |
| 2 | `frontend/src/core/runtime/Kernel.js` | Perbaikan pemetaan level→bucket di `log()` |
| 3 | `frontend/src/core/application/AppRegistry.js` | Registrasi lazy component `SystemLogsApp` |
| 4 | `frontend/public/metadata/system.json` | Definisi app `app:kernel` |
| 5 | `frontend/src/core/runtime/services/engineer.js` | 2 aturan prompt pengaman |
| 6 | `_knowledge_archive/00_EXPERIMENT_HISTORY.md` | **Baru** — distilasi eksperimen arsip |
| 7 | `_knowledge_archive/00_INDEX.md` | Koreksi daftar isi arsip yang tidak akurat |
| 8 | `docs/roadmap/roadmap-lanjutan.md` | Fase 1–4 seluruhnya ditandai selesai |
| 9 | `docs/roadmap/INDEX-ROADMAP.md` | Item 11–13 ditandai selesai |
| 10 | `.claude/launch.json` | **Baru** — konfigurasi dev server untuk verifikasi UI |
