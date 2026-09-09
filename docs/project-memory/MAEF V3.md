# MAMET ARCHITECTURE & ENGINEERING FRAMEWORK (MAEF)

Version      : 3.0
Status       : **SUPERSEDED** — lihat catatan di bawah
Document Type: Engineering Constitution (Historical)
Authority    : Highest (saat dokumen ini ditulis; sudah digantikan — lihat catatan)
Owner        : Mamet Ecosystem
Last Updated : 2026-06-30

> [!IMPORTANT]
> **Digantikan oleh `constitution/00_CONSTITUTION.md` v3.0** (tanggal sama, 2026-06-30) per [ADR-0018](../adr/ADR-0018-constitution-v3-supreme-authority.md) (ditemukan dan ditandai 2026-09-09, setelah ADR-0018 pertama kali dibuat).
> Dokumen ini adalah draft paralel/kompetitor yang ditulis di hari yang sama dengan Constitution v3, mengklaim "MAEF" (bukan "Constitution") sebagai otoritas tertinggi — namun tidak pernah masuk ke reading order resmi manapun (`INIT.md`, `ENGINEERING_CONTRACT.md`, `MASTER-ARCHITECTURE-INDEX.md` tidak menyebutnya). Isinya secara substansi hampir sepenuhnya tumpang tindih dengan `constitution/00_CONSTITUTION.md` — tidak ditemukan konsep unik yang perlu diselamatkan (berbeda dari `MAEF V2.md`/`MAMET AI VISION CONSTITUTION V2.md` yang punya Two-Brain Model/Self Engineering Lifecycle unik).
> Jangan gunakan dokumen ini sebagai rujukan hierarki otoritas — gunakan `constitution/00_CONSTITUTION.md`.

---

# 1. PURPOSE

MAEF adalah konstitusi tertinggi Mamet Ecosystem.

MAEF mendefinisikan prinsip, tata kelola, dan aturan dasar yang mengikat seluruh sistem.

Seluruh capability, implementasi, dan pengembangan wajib mengikuti MAEF.

Tidak ada dokumen maupun implementasi yang memiliki otoritas lebih tinggi daripada MAEF.

---

# 2. CORE VISION

Mamet Ecosystem adalah platform AI pribadi yang dibangun di atas MAEF Kernel.

MAEF adalah identitas inti sistem.

Capability dapat bertambah.

Vendor dapat berganti.

Model AI dapat berganti.

Teknologi dapat berubah.

MAEF tetap menjadi inti yang mengendalikan seluruh ekosistem.

---

# 3. SCOPE

MAEF berlaku untuk seluruh komponen Mamet Ecosystem, termasuk namun tidak terbatas pada:

* Kernel
* Architecture
* Capability
* Event System
* Verification Engine
* Orchestrator
* Adapter Layer
* Knowledge
* Memory
* Repository
* Runtime
* Deployment
* Security
* Database
* API
* Engineering Process
* Shared Services

---

# 4. CORE PRINCIPLES

## 4.1 Owner Sovereignty

Pemilik merupakan otoritas tertinggi.

AI tidak memiliki kewenangan mengambil keputusan akhir.

---

## 4.2 Kernel First

Seluruh capability harus berjalan melalui MAEF Kernel.

Tidak boleh ada jalur eksekusi yang melewati Kernel.

---

## 4.3 Knowledge First

Knowledge merupakan aset utama.

Source Code adalah implementasi dari knowledge.

---

## 4.4 Architecture First

Arsitektur menjadi acuan seluruh implementasi.

Repository harus mengikuti Architecture.

---

## 4.5 Verification Before Trust

Tidak ada informasi dianggap benar tanpa proses verifikasi yang sesuai.

---

## 4.6 Event Driven

Komunikasi antar komponen dilakukan melalui Event System.

Tidak boleh ada komunikasi langsung yang melanggar arsitektur.

---

## 4.7 Adapter Isolation

Seluruh layanan eksternal harus diakses melalui Adapter Layer.

Core tidak boleh bergantung langsung pada vendor.

---

## 4.8 Documentation First

Tidak ada implementasi tanpa dokumentasi.

---

## 4.9 Deterministic Engineering

Seluruh keputusan engineering harus dapat dijelaskan, diverifikasi, dan ditelusuri.

---

## 4.10 Evolution Without Chaos

Sistem harus dapat berkembang tanpa mengorbankan stabilitas dan identitas.

---

## 4.11 Continuous Evolution

Feature tidak harus sempurna pada implementasi pertama.

Yang wajib sempurna adalah proses evolusinya.

Setiap implementasi harus:

* dapat diaudit
* dapat diverifikasi
* dapat diperbaiki
* dapat dipelajari
* dapat didokumentasikan

Bug bukan kegagalan.

Bug adalah sumber knowledge untuk meningkatkan kualitas Engineer dan Mamet Ecosystem.

# 5. SINGLE SOURCE OF TRUTH

Urutan otoritas:

1. MAEF Constitution
2. Vision
3. Master Architecture
4. System Architecture
5. ADR
6. Technical Specification
7. Engineering Blueprint
8. Repository
9. Runtime

Dokumen dengan otoritas lebih tinggi selalu menjadi acuan.

---

# 6. REPOSITORY PRINCIPLE

Repository adalah implementasi.

Repository bukan sumber kebenaran.

Source of Truth berada pada Constitution dan Architecture.

---

# 7. ENGINEERING GOVERNANCE

Seluruh perubahan wajib memiliki:

* tujuan
* ruang lingkup
* dokumentasi
* analisis
* verifikasi
* persetujuan Owner

Tidak ada perubahan langsung ke sistem produksi.

---

# 8. AI GOVERNANCE

AI berperan sebagai Engineering Partner.

AI dapat:

* menganalisis
* memberi rekomendasi
* membuat dokumentasi
* membuat patch
* melakukan verifikasi

AI tidak boleh:

* mengubah MAEF
* mengubah tujuan sistem
* mengubah Architecture tanpa ADR
* mengambil keputusan akhir atas nama Owner

---

# 9. KNOWLEDGE GOVERNANCE

Knowledge harus:

* terdokumentasi
* memiliki sumber
* memiliki status
* dapat diverifikasi
* dapat ditelusuri
* memiliki versioning

Knowledge adalah aset jangka panjang.

---

# 10. MEMORY GOVERNANCE

Memory merupakan identitas operasional sistem.

Memory harus:

* terstruktur
* dapat ditelusuri
* dapat berkembang
* dapat dipelihara
* tetap berada di bawah kendali Owner

---

# 11. VENDOR INDEPENDENCE

Vendor hanyalah penyedia layanan.

Capability eksternal diakses melalui Adapter Layer.

Vendor dapat diganti tanpa mengubah identitas MAEF.

---

# 12. LONG-TERM EVOLUTION

Seluruh evolusi Mamet Ecosystem diarahkan untuk meningkatkan:

* Knowledge
* Engineering
* Reliability
* Maintainability
* Portability
* Modularity
* Verifiability
* Interoperability

Perubahan dilakukan secara evolusioner dan terukur.

---

# 13. ENGINEERING EVOLUTION

Engineering Mamet Ecosystem bersifat evolusioner.

Feature dibangun secara bertahap berdasarkan kebutuhan nyata.

Setiap implementasi harus melalui siklus berikut:

Implement

↓

Observe

↓

Audit

↓

Root Cause Analysis

↓

Patch

↓

Verification

↓

Project Memory Update

↓

Knowledge Growth

↓

Engineer Improvement

Tujuan utama bukan menghasilkan sistem yang sempurna pada implementasi pertama.

Tujuan utama adalah membangun sistem yang terus berkembang melalui pengalaman nyata.

Setiap bug yang telah diverifikasi menjadi bagian dari Project Memory agar tidak kehilangan pengalaman engineering.

Engineer harus menjadi lebih baik dari waktu ke waktu berdasarkan knowledge yang telah dikumpulkan.

# 14. END GOAL

Membangun platform AI pribadi yang:

* dikendalikan penuh oleh Owner
* memiliki identitas sendiri
* memiliki knowledge sendiri
* memiliki memory sendiri
* modular
* portable
* vendor-independent
* dapat berkembang tanpa kehilangan identitas
* mampu berevolusi melalui pengalaman nyata
* memiliki Engineer yang terus berkembang dari setiap implementasi

---

# MAEF PRINCIPLE

Bangun Knowledge.

Bangun Architecture.

Bangun Kernel.

Bangun Capability.

Bangun Experience.

Bangun System.

Biarkan Engineer belajar.

Biarkan Knowledge berkembang.

Biarkan teknologi berubah.

Biarkan model AI berganti.

Biarkan vendor datang dan pergi.

MAEF tetap menjadi inti.

Owner tetap menjadi pengendali.

END OF MAEF v3.0
