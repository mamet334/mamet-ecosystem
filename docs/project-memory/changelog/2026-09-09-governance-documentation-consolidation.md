# Changelog: Konsolidasi Hierarki Otoritas Dokumen (ADR-0018)

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai Penuh — termasuk resolusi GAP-NEW-021 (Svelte→Electron, dikonfirmasi Owner)
**Scope:** [`ADR-0018-constitution-v3-supreme-authority.md`](../../adr/ADR-0018-constitution-v3-supreme-authority.md)
**Trigger:** Brainstorming atas permintaan Owner ("baca dokumen constitution dan dokumen terkait... apakah perlu di update dan di rapikan dokumen constitutionnya mengingat itu dokumen tertinggi")

---

## 1. Ringkasan

Audit dokumentasi menyeluruh (27 dokumen `constitution/`, dokumen governance lama, seluruh `docs/architecture/`, ADR terkait) menemukan beberapa gap governance yang tidak pernah ditutup sebelumnya. Sesi ini murni housekeeping dokumentasi — **tidak ada kode yang diubah**.

## 2. Temuan Utama & Resolusi

### 2.1 Konflik Otoritas Tertinggi (Kritis)

`docs/adr/ADR-0001` (2026-06-27, status Accepted, tidak pernah di-supersede) menetapkan MAEF sebagai otoritas tertinggi. `constitution/00_CONSTITUTION.md` v3.0 (2026-06-30, sehari lebih baru) menetapkan Constitution sebagai otoritas tertinggi, mereduksi MAEF jadi sub-dokumen Level 1 (`02_MAEF_KERNEL.md`). Kedua dokumen berstatus aktif dan saling bertentangan — persis pola GAP-NEW-001/002 (MAEF v1 vs v2, sudah pernah ditutup 2026-06-29) yang **terulang satu lapis lebih tinggi**, kali ini melibatkan seluruh ekosistem dokumen pendukung masing-masing hierarki.

**Resolusi:** [`ADR-0018-constitution-v3-supreme-authority.md`](../../adr/ADR-0018-constitution-v3-supreme-authority.md) dibuat, secara formal men-supersede ADR-0001. Tidak ada konten yang dihapus — `MAEF V2.md` dan `MAMET AI VISION CONSTITUTION V2.md` tetap disimpan (memuat Two-Brain Model, Self Engineering Lifecycle, Engineering Confidence yang belum sepenuhnya diserap `constitution/` v3), tapi diberi header status **SUPERSEDED** dengan pointer eksplisit.

### 2.2 Dokumen Turunan yang Belum Tahu Constitution v3 Eksis

`docs/architecture/MASTER-ARCHITECTURE-INDEX.md` (Last Updated 2026-06-29) masih menyatakan MAEF v2 + Vision Constitution v2 sebagai "Source of Truth tertinggi di atas semua dokumen lain", tanpa menyebut `constitution/` v3 sama sekali. `docs/adr/ADR-0011-project-memory-canonical-source.md` masih memakai diagram hierarki `MAEF v2 → Vision Constitution v2` di §2.2/§9.

**Resolusi:** `MASTER-ARCHITECTURE-INDEX.md` diperbarui ke v2.1, tabel konstitusi tertinggi dan hierarki otoritas diarahkan ke `constitution/` v3. `ADR-0011` diberi catatan referensi ke ADR-0018 (keputusan intinya — `project_memory_entries` sebagai canonical source Project Memory — **tidak berubah**, tidak terpengaruh oleh perubahan hierarki dokumen).

### 2.3 `ENGINEERING_CONTRACT.md` Reading Order Tidak Lengkap

Reading order wajib di `constitution/ENGINEERING_CONTRACT.md` berhenti di dokumen 19, tidak mencakup dokumen 20-27 (termasuk Anti-Hallucination Protocol yang seharusnya jadi bacaan paling penting untuk agent AI).

**Resolusi:** Reading order dilengkapi sampai dokumen 27, ditambah catatan yang mengarahkan ke `INIT.md` untuk navigasi cepat berdasarkan jenis tugas.

### 2.4 `INIT.md` Tidak Mencantumkan Status MAEF V2/Vision V2

`INIT.md` §1 (index dokumen aktif) tidak menyebut `MAEF V2.md`/`MAMET AI VISION CONSTITUTION V2.md` sama sekali, padahal keduanya berstatus ACTIVE dan mengklaim otoritas tertinggi.

**Resolusi:** Ditambahkan baris eksplisit yang mencantumkan status SUPERSEDED kedua dokumen dan apa yang masih berharga di dalamnya.

### 2.5 Tiga Model "Engineer Lifecycle" Tanpa Saling Rujuk

Ditemukan tiga model siklus hidup Engineer dengan cakupan berbeda tapi tidak saling referensi: Self Engineering Lifecycle (9 tahap kematangan sistem, `MAMET AI VISION CONSTITUTION V2.md`), Engineer Lifecycle (siklus per-tugas 8 langkah, `constitution/07_ENGINEERING_SYSTEM.md`), Engineering Workflow (11 langkah, `constitution/21 Engineer Capability.md`).

**Resolusi:** Ketiga dokumen diberi catatan silang-rujuk singkat yang menjelaskan cakupan masing-masing (per-tugas vs kematangan sistem jangka panjang), tanpa mengubah isi substansial.

### 2.6 Referensi File Salah

`constitution/24_ANTI_HALLUCINATION_PROTOCOL.md` merujuk `MANTRA.md` yang tidak ada — isinya sudah terpecah jadi `docs/project-memory/history-archive/mantra.txt` dan `mantra-realita-ringkas.md`.

**Resolusi:** Referensi diperbaiki ke nama file yang benar.

### 2.7 "Svelte Desktop" di RFC-014/015/016 — Resolved (Dikonfirmasi Owner: Istilah Keliru)

`RFC-015-SINGLE-TOOL-DISPATCHER.md`, `RFC-016-BACKEND-AUTHORITATIVE-EXECUTION.md`, dan `EXECUTION-SURFACE-INVENTORY.md` (2026-07-11) menyebut berulang kali "Svelte Desktop" sebagai frontend. Verifikasi terhadap codebase (`find . -iname "*.svelte"`, cek `package.json` semua workspace) **tidak menemukan jejak Svelte sama sekali**. Desktop client aktual yang masih aktif dipelihara adalah Electron (`frontend/electron/main.cjs`), dikonfirmasi via `ADR-0016-terminal-command-isolation-roadmap.md` (2026-08-23, lebih baru dari RFC-014/015/016).

**Tindakan awal (2026-09-09, sesi pertama):** Warning note ditambahkan ke ketiga dokumen, dicatat sebagai **GAP-NEW-021** status Open, menunggu klarifikasi Owner.

**Resolusi (2026-09-09, sesi lanjutan):** Owner mengonfirmasi "Svelte Desktop" adalah istilah keliru, bukan rencana migrasi yang belum dieksekusi. Seluruh rujukan "Svelte"/"Svelte Desktop"/"Svelte UI"/"Desktop Svelte Client" di ketiga dokumen diganti "Electron"/"Electron Desktop"/"Desktop Electron Client" (10 titik perubahan total). Warning note diganti catatan koreksi terminologi. GAP-NEW-021 ditutup **Resolved**. Klaim `GAP-NEW-019` ("RFC-015 Phase 1-3 Active in Shadow Mode") tetap terpisah dan masih perlu diverifikasi terhadap kode nyata — itu bukan bagian dari gap terminologi ini, tidak ditutup oleh perbaikan ini.

## 3. File yang Diubah

- **Baru:** `docs/adr/ADR-0018-constitution-v3-supreme-authority.md`
- `docs/adr/ADR-0001-maef-as-highest-authority.md` — header status Superseded
- `docs/adr/ADR-0011-project-memory-canonical-source.md` — catatan referensi ADR-0018
- `docs/project-memory/MAEF V2.md` — header status Superseded
- `docs/project-memory/MAMET AI VISION CONSTITUTION V2.md` — header status Superseded + catatan di §SELF ENGINEERING LIFECYCLE
- `docs/architecture/MASTER-ARCHITECTURE-INDEX.md` — v2.0 → v2.1, tabel konstitusi & hierarki diperbarui
- `docs/architecture/ARCHITECTURE-GAPS.md` — tambah GAP-NEW-020 (Resolved) dan GAP-NEW-021 (Open)
- `docs/architecture/RFC-015-SINGLE-TOOL-DISPATCHER.md` — warning note Svelte/Electron
- `docs/architecture/RFC-016-BACKEND-AUTHORITATIVE-EXECUTION.md` — warning note Svelte/Electron
- `docs/architecture/EXECUTION-SURFACE-INVENTORY.md` — warning note Svelte/Electron
- `constitution/ENGINEERING_CONTRACT.md` — reading order dilengkapi sampai dokumen 27
- `constitution/07_ENGINEERING_SYSTEM.md` — catatan silang-rujuk Engineer Lifecycle
- `constitution/21 Engineer Capability.md` — catatan silang-rujuk Engineer Lifecycle
- `constitution/24_ANTI_HALLUCINATION_PROTOCOL.md` — perbaikan referensi MANTRA.md
- `INIT.md` — status MAEF V2/Vision V2 ditambahkan, catatan revisi diperbarui
- `docs/roadmap/INDEX-ROADMAP.md` — Backlog Item 19 didaftarkan

## 4. Verifikasi

Ini murni perubahan dokumentasi Markdown — tidak ada kode yang tersentuh, tidak ada build/deploy yang diperlukan. Verifikasi dilakukan dengan:
1. Membaca ulang setiap file yang mengklaim status "Superseded"/"Deprecated" versi lama untuk memastikan tidak ada isi yang hilang, hanya ditambah header.
2. Konfirmasi via `git log --follow` dan pencarian filesystem (`find`, `grep package.json`) untuk klaim "Svelte tidak ada di codebase" — bukan asumsi.
3. Cross-check tanggal setiap dokumen untuk membangun kronologi yang akurat (ADR-0001 27 Juni → Constitution v3 30 Juni → ADR-0011 29 Juni → RFC-014/015/016 11 Juli → ADR-0016 23 Agustus).

## 5. Tidak Dikerjakan / Di Luar Scope

- Penyerapan formal Two-Brain Model, Self Engineering Lifecycle, dan Engineering Confidence dua dimensi ke dalam dokumen `constitution/` baru — dicatat sebagai backlog terpisah di ADR-0018 §4 (Konsekuensi), belum dieksekusi.
- Audit menyeluruh sisa ~15 file di `docs/architecture/` yang belum dibaca (ARCHITECTURE-AUDIT-*, ARCHITECTURE-GAP-*-PLAN, RFC-013, dll) — kemungkinan pola serupa, tapi tidak dibaca semua dalam sesi ini.
- GAP-NEW-009 (Self Engineering Lifecycle belum ada state machine runtime) dan GAP-NEW-019 (Tool Dispatcher belum tersentralisasi) tetap Open — backlog teknis nyata, bukan bagian dari housekeeping dokumentasi ini.
