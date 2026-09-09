# Changelog: Perbaikan Tabrakan Nomor ADR-008 & Index PROJECT-MEMORY.md

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai
**Scope:** Lanjutan audit `docs/project-memory/`, `docs/adr/`, `docs/tasks/`

---

## 1. Ringkasan

Audit `docs/project-memory/` (level atas, non-changelog) dan sisa `docs/adr/` menemukan tiga masalah drift dokumentasi. Ketiganya diperbaiki. Murni perubahan dokumentasi, tidak ada kode yang diubah.

## 2. Temuan & Resolusi

### 2.1 Tabrakan Nomor ADR-008

`docs/project-memory/ADR-008-Application-Bootstrap-Architecture.md` (2026-07-05, soal urutan boot `ApplicationManager`/`MetadataService`/`WorkspaceManager`) memakai nomor "ADR-008" — bertabrakan dengan `docs/adr/ADR-0008-single-context-pipeline.md` (soal `buildContextFusion` vs `buildUniversalContract`), ADR berbeda topik dengan nomor sama, tersimpan di folder berbeda. `10_ADR_SYSTEM.md` mensyaratkan setiap ADR punya nomor unik.

**Resolusi:** Dipindahkan (`git mv`) ke lokasi kanonis `docs/adr/ADR-0019-application-bootstrap-architecture.md`, diberi nomor unik berikutnya (setelah ADR-0018). Isi keputusan tidak diubah, hanya judul header dan nomor. Header diberi catatan renumerasi. Rujukan lama ke "ADR-008" di dua changelog historis (`2026-07-05-phase3-changelog.md`, `changelog/2026-07-05.md`) tidak diedit — dipertahankan sebagai jejak sejarah sesuai kebijakan tidak mengedit changelog lama.

### 2.2 Index ADR di `PROJECT-MEMORY.md` Stale

Tabel "Architecture Decision Records (Index)" di `PROJECT-MEMORY.md` punya judul yang tidak cocok dengan isi file asli untuk ADR-0003, ADR-0004, ADR-0005 (lihat tabel perbandingan di laporan audit). Index juga berhenti di ADR-0011 — tidak mencantumkan ADR-0012 s/d ADR-0019 yang sudah ada.

**Resolusi:** Tabel diperbaiki — judul dikoreksi sesuai isi file asli, status Superseded ditambahkan untuk ADR-0001 (oleh ADR-0018) dan ADR-0005 (oleh ADR-015), entri ADR-0012 s/d ADR-0019 ditambahkan. Catatan ditambahkan menjelaskan alasan perbaikan.

### 2.3 Status `TASK-0002`/`TASK-0003` Tidak Sinkron

Kedua file task masih berstatus "In Progress" (sejak dibuat 2026-06-27), padahal `PROJECT-MEMORY.md` (PM-0002 untuk TASK-0002, tabel Open Engineering Tasks untuk TASK-0003) sudah lama mencatat keduanya selesai dengan bukti verifikasi (deploy production, build sukses).

**Resolusi:** Status kedua file task diubah ke "Done ✅" dengan catatan sinkronisasi, merujuk bukti yang sudah ada di `PROJECT-MEMORY.md`.

## 3. File yang Diubah

- `docs/project-memory/ADR-008-Application-Bootstrap-Architecture.md` → dipindah & di-rename jadi `docs/adr/ADR-0019-application-bootstrap-architecture.md`
- `docs/project-memory/PROJECT-MEMORY.md` — tabel index ADR diperbaiki
- `docs/tasks/TASK-0002-repair-agent-process-context.md` — status disinkronkan
- `docs/tasks/TASK-0003-mametlite-source-boundary.md` — status disinkronkan
- `docs/roadmap/INDEX-ROADMAP.md` — Backlog Item 23 didaftarkan

## 4. Tidak Dikerjakan / Di Luar Scope

- Changelog historis yang menyebut "ADR-008" (`2026-07-05-phase3-changelog.md`, `changelog/2026-07-05.md`) tidak diedit — kebijakan proyek ini tidak mengubah entri changelog lama.
- `graphify-out/2026-07-29/GRAPH_REPORT.md` (laporan auto-generate tersimpan) juga menyebut "ADR-008" — dibiarkan, karena itu snapshot historis, bukan dokumen aktif yang diedit manual.
- Nomor task yang hilang (`TASK-0009` tidak ada, lompat dari 0008 ke 0010) — dicatat sebagai observasi kecil, bukan masalah yang butuh tindakan (kemungkinan task yang dibatalkan/tidak pernah dibuat).
