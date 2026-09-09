# Changelog: Konsolidasi Sisa Dokumen `docs/architecture/` (31 File)

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai
**Scope:** Lanjutan dari [`2026-09-09-governance-documentation-consolidation.md`](./2026-09-09-governance-documentation-consolidation.md)
**Trigger:** Permintaan Owner untuk melanjutkan audit seluruh `docs/architecture/` agar dokumen bisa dipadatkan/disatukan dengan persetujuan Owner.

---

## 1. Ringkasan

Membaca seluruh 31 file yang tersisa di `docs/architecture/` (sebelumnya baru ~15 yang dibaca saat sesi governance). Ditemukan 5 kategori masalah, disusun jadi rencana konsolidasi 4 grup, disetujui Owner, dieksekusi. Murni perubahan dokumentasi — tidak ada kode yang diubah.

## 2. Temuan & Resolusi

### 2.1 Dua Sistem Penomoran Gap Tidak Pernah Disatukan (Grup 1)

`docs/architecture/ARCHITECTURE-GAPS.md` (register resmi) hanya melacak `GAP-0001..0004` dan `GAP-NEW-001..021`. Ditemukan sistem penomoran kedua yang sepenuhnya terpisah: `GAP-004..010` (tanpa prefix "NEW"), didokumentasikan masing-masing sebagai file audit/plan sendiri (`ARCHITECTURE-AUDIT-RAG-PIPELINE.md`, `ARCHITECTURE-AUDIT-MEMORY-BYPASS.md`, `ARCHITECTURE-GAP-006/007/008/009/010-PLAN.md`). Semuanya sudah diimplementasikan lewat Wave 5-3 (dikonfirmasi `ARCHITECTURE-RESTRUCTURE-WAVE-5-3.md` dan `mantra.txt` §15), tapi tidak pernah tercatat di register pusat, dan ke-7 file itu sendiri masih berbunyi "Saya akan MENUNGGU persetujuan Anda" — kalau dibaca berdiri sendiri, keliru disangka masih pending.

**Resolusi:** Tabel baru "LEGACY GAP SERIES (GAP-004 s/d GAP-010)" ditambahkan ke `ARCHITECTURE-GAPS.md`, memetakan tiap ID ke file sumber dan bukti resolusinya. Ketujuh file sumber diberi header `[!NOTE]` Resolved dengan pointer ke tabel ini, isi analisis asli dipertahankan sebagai jejak keputusan.

### 2.2 `GAP-NEW-016` Berstatus Open Padahal Sudah Terjawab (Grup 2)

MametLite `ragTopK=10` vs AI mode `ragTopK=5` ditandai "counterintuitive, perlu verifikasi Owner". `mantra.txt` §11 ("RAG Identity Separation", v2.1.0, 26 Juni 2026) sudah menjelaskan ini keputusan desain sengaja: LITE 10 dokumen untuk bacaan holistik/riset luas (dengan proteksi *Strict Read-Only Identity*), AI 5 dokumen untuk efisiensi memori chat.

**Resolusi:** Status diubah ke Resolved, dengan kutipan alasan dari `mantra.txt`. Dikonfirmasi Owner masih berlaku.

### 2.3 `RFC-013` Header Tidak Konsisten dengan Register Gap (Grup 3)

`RFC-013-UNIFIED-CONFIDENCE-MODEL.md` berstatus header "DRAFT (Menunggu Persetujuan Owner)", padahal `ARCHITECTURE-GAPS.md` GAP-NEW-008 sudah mencatat "Resolved (Wave 2 - RFC-013)" — RFC ini sendiri sudah punya "Implementation Note" yang mengonfirmasi kolom `confidence_score` aktif di `verification_audit_logs`.

**Resolusi:** Header diperbaiki ke "APPROVED & IMPLEMENTED".

### 2.4 Tiga Dokumen Redesain UI/OS Tumpang Tindih (Grup 4)

`20_WORKSPACE_ARCHITECTURE.md`, `ARCHITECTURE-OS-NAVIGATION-V2.md`, `ARCHITECTURE-UI-OS.md` — tiga proposal berbeda untuk visi serupa (chat-centric OS, widget/dock/workbench), istilah tidak konsisten, tidak jelas mana yang jadi acuan final.

**Cross-check kode dilakukan sebelum eksekusi** (atas permintaan Owner, karena beberapa dokumen akan disatukan):
- `frontend/src/core/workspaces/WorkspaceManager.js` docblock-nya secara eksplisit menulis *"Handles the lifecycle defined in 20_WORKSPACE_ARCHITECTURE.md"* — bukti langsung dari kode, bukan inferensi.
- Field `left_workbench`/`right_workbench`/`bottom_workbench` di `state.layout` cocok persis dengan contoh manifest JSON di `20_WORKSPACE_ARCHITECTURE.md` §3.
- Status siklus hidup di `AppShell.jsx` (`IDLE`/`INITIALIZE`/`LOADING_MANIFEST`/`RESTORING_LAYOUT`/dst) cocok persis dengan §7 dokumen yang sama.
- `WorkbenchZone.jsx`/`WidgetHost.jsx` — istilah "Workbench" (bukan "Dock") sesuai `20_WORKSPACE_ARCHITECTURE.md` §6, bukan istilah "Dock Zone" dari `ARCHITECTURE-UI-OS.md`.
- `ApplicationManager.js`/`WindowManager.js` — nama class dan state (`REGISTERED`/`BACKGROUND`/`RUNNING`) cocok persis dengan yang diusulkan `ARCHITECTURE-OS-NAVIGATION-V2.md`, divalidasi `ARCHITECTURE-VALIDATION-V2.md`/`ARCHITECTURE-ACCEPTANCE-TEST-V2.md` (keduanya CERTIFIED/PASS).

**Resolusi (tahap 1, header saja):**
- `20_WORKSPACE_ARCHITECTURE.md` → ditandai **dokumen master/otoritatif**.
- `ARCHITECTURE-OS-NAVIGATION-V2.md` → ditandai **"sebagian terserap ke implementasi"** (konsep ApplicationManager/WindowManager valid dan terpakai, tapi untuk desain Workspace/Workbench/Manifest yang lebih detail rujuk dokumen master).
- `ARCHITECTURE-UI-OS.md` → ditandai **superseded** (istilah "Dock Zone" tidak pernah dipakai kode; dipertahankan sebagai jejak evolusi desain, bukan acuan implementasi).

**Resolusi (tahap 2, penggabungan fisik — Owner meminta "gabung total jadi satu file"):**
`20_WORKSPACE_ARCHITECTURE.md` ditulis ulang (v1.0.0 → v1.1.0) menyerap konten dari kedua dokumen lain:
- **§2 baru "Hierarki Sistem Penuh: dari Kernel sampai Widget"** — diserap dari `ARCHITECTURE-OS-NAVIGATION-V2.md` (hierarki Kernel→Runtime Layer→Service Manager→Application Manager→Window Manager→Application→Workspace→Session→Conversation, Matrix Aplikasi & Workspace, Navigation Flow, diagram mermaid), karena bagian ini terbukti terimplementasi (`ApplicationManager.js`, `WindowManager.js`).
- **§1 (Architecture Gap)** ditambah 2 poin dari `ARCHITECTURE-UI-OS.md` (Sidebar Overload, Context Mixing) yang belum tercakup di 4 poin asli.
- **§7 (Workbench System)** ditambah subsection "Responsive Strategy" (Desktop/Tablet/Mobile fallback) dari `ARCHITECTURE-UI-OS.md`, dengan catatan bahwa istilah asli dokumen itu ("Dock Zone") tidak dipakai kode.
- **§11 (Implementation Roadmap)** ditambah catatan status implementasi terverifikasi (Anti-Hallucination Protocol: tidak mengklaim selesai tanpa observasi runtime untuk Phase 4-5).
- **§13 baru "Sejarah & Evolusi Desain"** — tabel ringkas menjelaskan kontribusi & nasib masing-masing dokumen sumber, alasan konsolidasi, dan metode cross-check kode yang dipakai.

`ARCHITECTURE-OS-NAVIGATION-V2.md` dan `ARCHITECTURE-UI-OS.md` dipindahkan (`git mv`) ke `docs/project-memory/history-archive/` — isi lengkap tetap bisa dibaca di sana, mengikuti pola yang sama seperti arsip `NORTH_STAR.md`. Tidak ada isi yang dihapus permanen.

### 2.5 Seri Audit Wave 5.2E.2 → 5.2F → 5.2G.1 (+FINAL) — Tidak Diubah

Dikonfirmasi konsisten dan berurutan secara valid (skor arsitektur naik bertahap 7.5 → 80 → 84-85/100, tidak ada kontradiksi). Direkomendasikan tetap dipertahankan sebagai jejak audit, tidak perlu konsolidasi.

## 3. File yang Diubah

- `docs/architecture/ARCHITECTURE-GAPS.md` — tabel Legacy Gap Series, GAP-NEW-016 → Resolved
- `docs/architecture/ARCHITECTURE-AUDIT-RAG-PIPELINE.md` — header Resolved
- `docs/architecture/ARCHITECTURE-AUDIT-MEMORY-BYPASS.md` — header Resolved
- `docs/architecture/ARCHITECTURE-GAP-006-PLAN.md` — header Resolved
- `docs/architecture/ARCHITECTURE-GAP-007-PLAN.md` — header Resolved
- `docs/architecture/ARCHITECTURE-GAP-008-PLAN.md` — header Resolved
- `docs/architecture/ARCHITECTURE-GAP-009-PLAN.md` — header Resolved
- `docs/architecture/ARCHITECTURE-GAP-010-PLAN.md` — header Resolved
- `docs/architecture/RFC-013-UNIFIED-CONFIDENCE-MODEL.md` — header APPROVED & IMPLEMENTED
- `docs/architecture/20_WORKSPACE_ARCHITECTURE.md` — header Master/Otoritatif + catatan cross-check
- `docs/architecture/ARCHITECTURE-OS-NAVIGATION-V2.md` — header Sebagian Terserap + catatan cross-check
- `docs/architecture/ARCHITECTURE-UI-OS.md` — header Superseded + catatan cross-check
- `docs/roadmap/INDEX-ROADMAP.md` — Backlog Item 20 didaftarkan

## 4. Verifikasi

Murni perubahan Markdown. Klaim cross-check kode diverifikasi dengan membaca langsung file sumber (`WorkspaceManager.js`, `AppShell.jsx`, `WorkbenchZone.jsx`, `ApplicationManager.js`, `Kernel.js`, `AppRegistry.js`) — bukan diasumsikan dari nama file.

## 5. Tidak Dikerjakan / Di Luar Scope

- Tabrakan penomoran `docs/architecture/20_WORKSPACE_ARCHITECTURE.md` vs `constitution/20_ENGINEERING POLICY.md` (folder beda, nomor sama) — dicatat sebagai observasi, belum ada tindakan.
- GAP-NEW-017 (MAEF tidak sebut DeepSeek/Qwen) dan GAP-NEW-018 (`docs/blueprints/`/`docs/monetisasi/` tidak direferensi) — masih Open, di luar scope sesi ini.
