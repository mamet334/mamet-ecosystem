# Changelog: Verifikasi Silang Menyeluruh — Tabrakan Hierarki di Dokumen Sendiri

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai
**Scope:** Verifikasi silang atas seluruh perubahan governance sesi ini, atas permintaan Owner ("cek kembali dokumen yang mungkin masih bertentangan atau belum linier")

---

## 1. Ringkasan

Setelah rangkaian perbaikan governance (ADR-0018, penghapusan MAEF v2/v3/Vision v2, dll), dilakukan verifikasi silang konkret (grep, perbandingan isi) untuk memastikan perbaikan yang dibuat tidak diam-diam menciptakan inkonsistensi baru. Ditemukan satu masalah nyata — ironisnya persis pola yang sedang diperbaiki.

## 2. Temuan & Resolusi

### 2.1 Tiga Salinan Hierarki Otoritas yang Saling Beda (Ditemukan Sendiri)

Setelah ADR-0018 dibuat, ternyata ada **tiga tempat berbeda** yang masing-masing menyimpan salinan hierarki otoritas dengan detail yang tidak sama:

| Dokumen | Jumlah Level | Isi |
|---|---|---|
| `constitution/00_CONSTITUTION.md` §10 (sebelum diperbaiki) | 7 level | Constitution → Vision → Core Architecture → System Specification → ADR → Repository → Runtime (tidak menyebut Operational Policy, RFC, Roadmap sama sekali) |
| `docs/adr/ADR-0018` §2.1 (versi awal) | 10 level | Constitution → Vision → Core Architecture → System Spec → **Operational Policy** → ADR → **RFC** → **Roadmap** → Repository → Runtime |
| `docs/architecture/MASTER-ARCHITECTURE-INDEX.md` (versi awal) | 9 level, urutan beda | Menempatkan dirinya sendiri sebagai level 4, tidak menyebut Operational Policy maupun Roadmap sama sekali |

Tiga dokumen, tiga versi berbeda dari "hierarki resmi" — persis pola yang menyebabkan ADR-0018 perlu dibuat di tempat pertama (banyak salinan otoritas yang bisa drift), hanya kali ini terjadi di dalam pekerjaan perbaikan itu sendiri.

**Resolusi struktural (bukan cuma menyamakan angka):**
- `constitution/00_CONSTITUTION.md` §10 dijadikan **satu-satunya salinan resmi** — diperbarui ke versi 10-level yang lengkap.
- `docs/adr/ADR-0018` §2.1 diubah dari menyalin ulang daftar menjadi **merujuk** ke `00_CONSTITUTION.md` §10, dengan ringkasan singkat saja.
- `docs/architecture/MASTER-ARCHITECTURE-INDEX.md` diubah dengan cara yang sama — merujuk, bukan menyalin.

Dengan ini, hierarki hanya punya **satu tempat tinggal** — kalau berubah lagi di masa depan, cukup satu file yang diedit, dua lainnya otomatis konsisten karena tidak menyimpan salinan sendiri.

### 2.2 `MASTER-ARCHITECTURE-INDEX.md` §Architecture Rule Masih Menunjuk File yang Sudah Dihapus

Baris "Architecture Rule" masih berbunyi *"Any implementation that conflicts with **MAEF v2, Vision Constitution v2**, or this index..."* — merujuk dua file yang baru saja dihapus di commit sebelumnya. Terlewat saat pembersihan pointer sebelumnya karena baris ini ada di bagian bawah file (bagian "Purpose/Capability Layers" yang berbahasa Inggris, bukan bagian tabel yang sudah dicek).

**Resolusi:** Diganti jadi merujuk `constitution/` secara umum.

### 2.3 Ketidakcocokan Kecil "27 dokumen" vs "28 dokumen"

`docs/adr/ADR-0018` (2 tempat) dan `constitution/ENGINEERING_CONTRACT.md` (1 tempat) menyebut folder `constitution/` berisi "27 dokumen", sementara `INIT.md` (yang menghitung dengan benar: 00 sampai 27 inklusif = 28 file) menyebut "28 dokumen". Selisih satu angka, murni salah hitung.

**Resolusi:** Disamakan ke "28 dokumen" di ketiga tempat, mengikuti hitungan `INIT.md` yang benar (diverifikasi ulang dengan `ls constitution/*.md | wc -l` = 30 total file, dikurangi `ENGINEERING_CONTRACT.md` dan `README.md` = 28 dokumen bernomor).

### 2.4 GAP-NEW-018 Sebagian Sudah Terjawab

`docs/blueprints/` sekarang sudah masuk hierarki resmi (level 7, Technical Specification) sebagai efek samping perbaikan §2.1 — status gap diperbarui jadi Partially Resolved. `docs/monetisasi/` tetap tidak diintegrasikan (dikonfirmasi sengaja, riset bisnis era lama, bukan dokumen governance).

## 3. Verifikasi Tambahan yang Dilakukan (Tidak Ditemukan Masalah)

- Cek taksonomi "Evidence Strength" (STRONG/MEDIUM/WEAK/UNVERIFIED) antara `13_VERIFICATION_ENGINE_SPEC.md` dan `16_ENGINEERING_METRICS_SYSTEM.md` (baru diserap dari Vision Constitution V2) — sudah konsisten, sudah dinormalisasi dan saling merujuk saat penyerapan sebelumnya.
- Cek sisa rujukan aktif ke file yang sudah dihapus (`MAEF V2.md`/`V3.md`/`MAMET AI VISION CONSTITUTION V2.md`) — hanya tersisa di dokumen yang memang seharusnya menyebutnya secara historis (ADR-0018, `ARCHITECTURE-GAPS.md`, `CONSTITUTION-REVIEW-REPORT-2026-06-29.md`, `INIT.md` — semua konteks "pernah ada, sudah dihapus", bukan pointer aktif).
- Cek klaim "otoritas tertinggi" lain di seluruh repo — hanya ditemukan yang tentang Owner (`AGENTS.md`, `05_KNOWLEDGE_SYSTEM.md`: "Owner memiliki otoritas tertinggi") dan yang sudah diketahui/ditangani (Constitution, ADR-0001 historis). Tidak ada draf otoritas kelima yang terlewat.

## 4. File yang Diubah

- `constitution/00_CONSTITUTION.md` — §10 diperbarui jadi 10-level, dijadikan satu-satunya salinan resmi
- `docs/adr/ADR-0018-constitution-v3-supreme-authority.md` — §2.1 diubah jadi rujukan, bukan salinan; angka dokumen diperbaiki
- `docs/architecture/MASTER-ARCHITECTURE-INDEX.md` — hierarki diubah jadi rujukan; "Architecture Rule" diperbaiki
- `constitution/ENGINEERING_CONTRACT.md` — angka dokumen diperbaiki
- `docs/architecture/ARCHITECTURE-GAPS.md` — GAP-NEW-018 diperbarui Partially Resolved

## 5. Pelajaran

Housekeeping governance itu sendiri bisa menciptakan drift baru kalau daftar/angka disalin manual ke banyak tempat saat memperbaiki satu dokumen. Perbaikan yang tahan lama bukan "samakan semua salinan sekarang" (itu akan drift lagi di perbaikan berikutnya) — tapi **hilangkan salinannya**, sisakan satu sumber dan yang lain merujuk. Prinsip ini sudah diterapkan untuk hierarki otoritas; layak jadi pola baku untuk daftar serupa di masa depan (misal: daftar ADR, daftar dokumen constitution).
