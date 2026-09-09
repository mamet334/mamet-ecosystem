# ADR-0018: Constitution v3 Menggantikan MAEF sebagai Otoritas Tertinggi

**ID:** ADR-0018
**Judul:** `constitution/00_CONSTITUTION.md` v3.0 ditetapkan sebagai Source of Truth tertinggi, menggantikan hierarki lama yang dipimpin MAEF
**Status:** APPROVED
**Tanggal:** 2026-09-09
**Penulis:** Mamet Engineering (Governance Consolidation Pass)
**Menutup Gap:** Konflik otoritas MAEF v2 vs Constitution v3 (ditemukan saat audit dokumentasi menyeluruh, September 2026)
**Men-supersede:** ADR-0001 (Adopt MAEF As Highest Engineering Authority)
**Berlaku untuk:** Seluruh dokumen governance, ADR, dan implementasi di repository ini

---

## 1. Konteks dan Latar Belakang

### 1.1 Masalah yang Ditemukan

Audit dokumentasi menyeluruh (September 2026) menemukan bahwa repository ini memiliki **dua hierarki otoritas yang saling bertentangan, hidup berdampingan tanpa rekonsiliasi**:

**Hierarki Lama (ditetapkan ADR-0001, 2026-06-27):**
```
MAEF → Vision → Master Architecture Index → System Architecture
     → ADR → Technical Specification → ... → Repository → Runtime
```
Didukung oleh: `docs/project-memory/MAEF V2.md`, `docs/project-memory/MAMET AI VISION CONSTITUTION V2.md`, `docs/architecture/MASTER-ARCHITECTURE-INDEX.md`, `docs/adr/ADR-0011-project-memory-canonical-source.md`.

**Hierarki Baru (ditetapkan `constitution/00_CONSTITUTION.md` v3.0, 2026-06-30 — satu hari setelah audit ADR-0001/ADR-0011 terakhir dirujuk):**
```
Constitution → Vision → Architecture → Engineering Specifications
             → Repository → Runtime
```
MAEF direduksi menjadi dokumen Level 1 (`constitution/02_MAEF_KERNEL.md`) — deskripsi Kernel, bukan lagi otoritas dokumen tersendiri. Didukung oleh: seluruh `constitution/` (27 dokumen), `AGENTS.md`, `constitution/ENGINEERING_CONTRACT.md`, `INIT.md`.

### 1.2 Bukti Bahwa Ini Bukan Sekadar Dokumen Usang

Ini bukan kasus "satu dokumen lupa dihapus" — kedua hierarki punya **ekosistem dokumen pendukung yang lengkap dan aktif**, dan tidak ada satu pun yang secara eksplisit menandai dirinya digantikan oleh yang lain:

- `constitution/00_CONSTITUTION.md` §10 menyatakan dirinya "Source of Truth tertinggi", tidak menyebut MAEF sebagai setara atau superior.
- `docs/architecture/MASTER-ARCHITECTURE-INDEX.md` (Last Updated 2026-06-29) masih menyatakan MAEF v2 + Vision Constitution v2 sebagai "Source of Truth tertinggi di atas semua dokumen lain" — dan **tidak menyebut** keberadaan `constitution/` v3 sama sekali.
- `docs/adr/ADR-0011-project-memory-canonical-source.md` §2.2 dan §9 masih memakai kerangka `MAEF v2 → Vision Constitution v2` di diagram hierarkinya.
- Dokumen-dokumen yang lebih baru (`AGENTS.md`, `constitution/ENGINEERING_CONTRACT.md`, `INIT.md`) sudah **beroperasi** dengan asumsi Constitution v3 adalah tertinggi, tanpa pernah secara formal mencabut ADR-0001.

### 1.3 Kenapa Ini Berbahaya

Karena ADR-0001 belum pernah di-supersede secara formal, seorang Engineer/AI yang membaca `docs/adr/` lebih dulu (urutan yang justru direkomendasikan `10_ADR_SYSTEM.md`) akan secara sah menyimpulkan MAEF adalah otoritas tertinggi — bertentangan dengan `constitution/00_CONSTITUTION.md` yang juga sah dan lebih baru. Sistem yang menurut filosofinya sendiri "berbasis dokumen aturan" (`00_CONSTITUTION.md`, `MAEF V2.md`, `AGENTS.md` — semua bilang Repository mengikuti dokumen, bukan sebaliknya) kehilangan determinismenya sendiri jika dua dokumen tertinggi saling bertentangan.

---

## 2. Keputusan

### 2.1 Penetapan Otoritas Tertinggi

**`constitution/00_CONSTITUTION.md` v3.0 (beserta seluruh folder `constitution/`, 27 dokumen) adalah Source of Truth tertinggi Mamet Ecosystem, menggantikan hierarki yang dipimpin MAEF v2 / Vision Constitution v2.**

Hierarki otoritas resmi mulai ADR ini:

```
1. constitution/00_CONSTITUTION.md (dan seluruh folder constitution/)
2. constitution/01_VISION.md
3. Core Architecture (constitution/02-09)
4. System Specification (constitution/10-19)
5. Operational Policy (constitution/20-27, ENGINEERING_CONTRACT.md)
6. ADR (docs/adr/)
7. Technical Specification / RFC (docs/architecture/)
8. Roadmap (docs/roadmap/)
9. Repository (implementasi)
10. Runtime System
```

### 2.2 Status MAEF v2 dan Vision Constitution v2

`docs/project-memory/MAEF V2.md` dan `docs/project-memory/MAMET AI VISION CONSTITUTION V2.md` **tidak dihapus** — keduanya tetap berharga sebagai referensi historis dan memuat beberapa konsep yang belum punya padanan persis di `constitution/` v3 (Two-Brain Model detail, Engineering Confidence dua dimensi, Self Engineering Lifecycle 9 tahap). Status kedua dokumen ini diubah menjadi **SUPERSEDED** oleh `constitution/` v3, dengan pointer eksplisit ditambahkan ke masing-masing file.

Konsep unik yang belum tercakup di `constitution/` v3 (Two-Brain Model, Self Engineering Lifecycle, Engineering Confidence) **tetap berlaku sebagai referensi operasional** sampai ada dokumen `constitution/` yang secara eksplisit menyerapnya — bukan otomatis batal.

### 2.3 Status MAEF Sebagai Konsep

MAEF (Mamet Artificial Executive Framework / Kernel) **tetap ada dan tetap penting** — statusnya berubah dari "dokumen otoritas tertinggi" menjadi "konsep Kernel yang dideskripsikan di `constitution/02_MAEF_KERNEL.md`", persis seperti yang sudah dipraktikkan `constitution/` v3 selama ini. Ini bukan penurunan derajat kepentingan MAEF sebagai sistem — hanya klarifikasi bahwa MAEF adalah *bagian dari* Constitution, bukan *di atas* Constitution.

---

## 3. Dampak pada Dokumen Lain

| Dokumen | Aksi |
|---|---|
| `docs/adr/ADR-0001-maef-as-highest-authority.md` | Ditandai **Superseded by ADR-0018**, isi asli dipertahankan sebagai sejarah |
| `docs/project-memory/MAEF V2.md` | Ditambah header status SUPERSEDED, pointer ke `constitution/00_CONSTITUTION.md` |
| `docs/project-memory/MAMET AI VISION CONSTITUTION V2.md` | Ditambah header status SUPERSEDED, pointer ke `constitution/01_VISION.md` |
| `docs/project-memory/MAEF V3.md` | **(Ditemukan 2026-09-09, setelah revisi awal ADR ini)** Ditambah header status SUPERSEDED, pointer ke ADR ini. Draft paralel yang ditulis di tanggal sama dengan Constitution v3 (2026-06-30), mengklaim MAEF sebagai otoritas tertinggi — isinya tumpang tindih penuh dengan `constitution/00_CONSTITUTION.md`, tidak ada konsep unik yang perlu diselamatkan |
| `docs/architecture/MASTER-ARCHITECTURE-INDEX.md` | Diperbarui: entri konstitusi tertinggi mengarah ke `constitution/`, bukan lagi MAEF v2/Vision v2; baris MAEF V3 ditambahkan |
| `docs/adr/ADR-0011-project-memory-canonical-source.md` | Ditambah catatan referensi ke ADR-0018 di §9 (isi ADR tidak diubah — keputusan `project_memory_entries` sebagai canonical source Project Memory tetap berlaku, tidak terpengaruh oleh perubahan hierarki dokumen ini) |
| `constitution/ENGINEERING_CONTRACT.md` | Reading order diperluas mencakup dokumen 20-27, dengan pointer ke `INIT.md` sebagai index navigasi tugas |

> [!NOTE]
> **Update 2026-09-09 (audit lanjutan):** `MAEF V3.md` ditemukan setelah ADR ini pertama kali dibuat — dokumen keempat (setelah MAEF v1, v2, dan Constitution v3) yang mengklaim jadi otoritas tertinggi, ditulis tanggal sama persis dengan Constitution v3. Ini konfirmasi bahwa pola drift "banyak draft otoritas paralel tanpa suksesi formal" lebih parah dari yang awalnya terdeteksi — kemungkinan besar terjadi karena beberapa AI/sesi coding berbeda menulis ulang konstitusi secara independen pada periode transisi 2026-06-30 tanpa saling tahu draft mana yang final.

---

## 4. Konsekuensi

### Positif
- Satu rantai otoritas yang jelas dan konsisten dengan apa yang sudah dipraktikkan mayoritas dokumen aktif (`AGENTS.md`, `ENGINEERING_CONTRACT.md`, `INIT.md`).
- Menutup celah di mana dua dokumen "tertinggi" bisa memberi jawaban berbeda untuk pertanyaan governance yang sama.
- Tidak ada isi filosofi yang hilang — MAEF v2/Vision v2 tetap tersimpan dan bisa dirujuk untuk detail yang belum diserap `constitution/` v3.

### Risiko / Negatif
- Konsep unik di MAEF v2/Vision v2 (Two-Brain Model, Self Engineering Lifecycle, Engineering Confidence) untuk sementara "menggantung" — berstatus SUPERSEDED tapi belum sepenuhnya diserap sebagai dokumen `constitution/` baru. Ini backlog terpisah, bukan bagian dari ADR ini.
- `docs/architecture/` (Master Architecture Index, ARCHITECTURE-GAPS.md, ADR lama) butuh audit lanjutan untuk memastikan tidak ada rujukan lain ke hierarki lama yang terlewat.

### Mitigasi
- ADR ini eksplisit tidak menghapus konten apa pun — hanya mengubah status dan menambah pointer.
- Backlog terpisah direkomendasikan untuk menyerap Two-Brain Model, Self Engineering Lifecycle, dan Engineering Confidence ke dalam dokumen `constitution/` yang relevan (`07_ENGINEERING_SYSTEM.md`, `16_ENGINEERING_METRICS_SYSTEM.md`).

---

## 5. Referensi

- `constitution/00_CONSTITUTION.md` v3.0 (2026-06-30)
- `docs/adr/ADR-0001-maef-as-highest-authority.md` (2026-06-27, digantikan)
- `docs/architecture/CONSTITUTION-REVIEW-REPORT-2026-06-29.md` (audit sehari sebelum Constitution v3 terbit — menjadi bukti bahwa hierarki MAEF v2 masih dianggap berlaku pada saat itu)
- `AGENTS.md`, `constitution/ENGINEERING_CONTRACT.md`, `INIT.md` (dokumen yang sudah beroperasi dengan asumsi Constitution v3 supreme, tanpa pernah menyebut ADR-0001)
