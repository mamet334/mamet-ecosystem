# Changelog: Perbaikan `_loadStaticKnowledge()` — Path Mati Dihapus, 24-27 Ditambahkan

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai & Diverifikasi Live (build production + runtime read live dikonfirmasi via `npm run desktop` — lihat §6 Update)
**Scope:** `frontend/src/core/runtime/services/engineer.js` — `_loadStaticKnowledge()` (Brain 1)

---

## 1. Ringkasan

Lanjutan dari [`2026-09-09-fix-core-protection-layer-path-matching-bug.md`](./2026-09-09-fix-core-protection-layer-path-matching-bug.md) — dua temuan lain yang muncul dari audit jalur yang sama (`_loadStaticKnowledge()`, yang memuat "Brain 1" Engineer produksi) diperbaiki sekarang.

## 2. Temuan & Resolusi

### 2.1 6 Path Mati/Salah Dihapus

| Path Lama | Masalah |
|---|---|
| `init.md` | Salah case — file asli `INIT.md` (root repo, terkonfirmasi via `find` case-sensitive) |
| `agent.md` | File ini tidak pernah ada — yang ada `AGENTS.md` (sudah tercantum sebagai entry terpisah, jadi ini duplikat yang salah) |
| `constitution/MAEF_v3.0.md` | Tidak pernah ada di `constitution/` — sisa skema penamaan lama |
| `constitution/Mamet_AI_Constitution_v2.0.md` | Sama |
| `constitution/vision.md` | Sama (huruf kecil; file asli `01_VISION.md`) |
| `constitution/master-architecture.md` | Tidak pernah ada di `constitution/` — dokumen sejenis ada di `docs/architecture/MASTER-ARCHITECTURE-INDEX.md`, lokasi berbeda |

Keenam path ini gagal secara senyap lewat blok `try/catch` yang sudah ada ("File mungkin belum ada") — tidak menyebabkan crash, tapi setiap boot Engineer melakukan 6 percobaan baca yang pasti gagal, sia-sia. `INIT.md` diganti ke case yang benar; sisanya dihapus total (tidak ada penggantinya — 4 file itu memang sudah tidak relevan sejak `constitution/00_CONSTITUTION.md` v3 jadi satu-satunya sumber, dan `master-architecture.md` bukan bagian dari `constitution/`).

### 2.2 24-27 Ditambahkan ke Brain 1

Daftar sebelumnya berhenti di `23_HOME_DASHBOARD_SPEC.md`, langsung loncat ke `ENGINEERING_CONTRACT.md`/`README.md` — melewatkan **`24_ANTI_HALLUCINATION_PROTOCOL.md`, `25_DESIGN_PHILOSOPHY.md`, `26_MENTAL_MODEL.md`, `27_DECISION_HEURISTICS.md`**. Keempatnya ditambahkan sebelum `ENGINEERING_CONTRACT.md`.

**Kenapa ini penting:** dari semua dokumen di `constitution/`, `24_ANTI_HALLUCINATION_PROTOCOL.md` adalah yang paling operasional (aturan "jangan menebak isi file", "jangan klaim 100% selesai tanpa qualifier", dll) — tapi Engineer versi produksi yang dipakai user tidak pernah membacanya sebagai bagian dari pengetahuan statisnya sebelum perbaikan ini.

## 3. File yang Diubah

- `frontend/src/core/runtime/services/engineer.js` — `_loadStaticKnowledge()` daftar `constitutionPaths` diperbaiki
- `docs/roadmap/INDEX-ROADMAP.md` — Backlog Item 27 (sesi lalu) diperbarui menutup catatan "belum diperbaiki" yang tersisa

## 4. Verifikasi & Keterbatasan

**Sudah diverifikasi:**
- Build production (`npm run build`): sukses, 10.44s, 0 error.
- Isi array diperiksa manual baris-per-baris — tidak ada duplikat, tidak ada koma/sintaks JS yang rusak.
- Nama file dikonfirmasi terhadap `ls`/`find` filesystem nyata (bukan asumsi) untuk `INIT.md`.

**Belum diverifikasi (keterbatasan sesi ini, sesuai Anti-Hallucination Protocol — jangan klaim lebih dari yang benar-benar diobservasi):**
- Tidak ada verifikasi *runtime* langsung bahwa `storageManager.read('constitution/24_ANTI_HALLUCINATION_PROTOCOL.md')` benar-benar berhasil mengembalikan konten saat Engineer boot sungguhan di aplikasi — ini butuh sesi Electron/browser dengan login aktif dan trigger boot Engineer penuh, di luar jangkauan verifikasi statis sesi ini. Secara struktural filenya memang ada di disk (dikonfirmasi berulang kali sepanjang sesi audit ini) dan mekanisme `storageManager.read()` sudah dipakai sukses untuk path serupa (`00_CONSTITUTION.md` dst) — jadi risiko kegagalan rendah, tapi tidak 100% dikonfirmasi live.

## 5. Status Akhir Kedua Temuan dari Changelog Sebelumnya

Dengan perbaikan ini, kedua item yang sebelumnya ditandai "belum diperbaiki" di [`2026-09-09-fix-core-protection-layer-path-matching-bug.md`](./2026-09-09-fix-core-protection-layer-path-matching-bug.md) §8 sudah selesai:
1. ✅ 4 path mati di `_loadStaticKnowledge()` — dihapus (plus 2 tambahan yang ditemukan: `init.md`, `agent.md`)
2. ✅ `24_ANTI_HALLUCINATION_PROTOCOL.md` s/d `27_DECISION_HEURISTICS.md` — ditambahkan ke Brain 1

## 6. Update — Verifikasi Live (2026-09-09, sesi lanjutan)

Owner menjalankan `npm run desktop` (Electron sungguhan) dan mengonfirmasi via Console boot Engineer:
- Seluruh `constitution/24_ANTI_HALLUCINATION_PROTOCOL.md` (7029 chars), `25_DESIGN_PHILOSOPHY.md` (1902 chars), `26_MENTAL_MODEL.md` (2029 chars), `27_DECISION_HEURISTICS.md` (3070 chars) berhasil dibaca via `[StorageManager:read] ✅ Read via Electron IPC`.
- Tidak ada satu pun baris warning/gagal untuk path lama yang sudah dihapus (`init.md`, `agent.md`, `MAEF_v3.0.md`, dll).
- Total akhir: `[Engineer] Static knowledge loaded: 32 files` — sesuai jumlah entri di `constitutionPaths` setelah perbaikan.

Dengan ini, keterbatasan di §4 di atas resmi tertutup — bukan lagi risiko rendah tak terverifikasi, tapi terkonfirmasi langsung.
