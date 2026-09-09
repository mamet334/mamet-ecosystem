# Changelog: MAEF V2/V3 & Vision Constitution V2 Dihapus, Diserap ke `constitution/`

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai
**Scope:** Lanjutan ADR-0018 — perubahan pendekatan dari "tandai SUPERSEDED" menjadi "gabung lalu hapus"
**Trigger:** Diskusi dengan Owner soal cara mengurangi jumlah dokumen tanpa membuat dokumen baru

---

## 1. Latar Belakang

Sesi-sesi sebelumnya menyelesaikan konflik otoritas MAEF v2/v3 vs Constitution v3 dengan menandai dokumen lama sebagai SUPERSEDED (header + pointer), tapi tetap menyimpan filenya utuh. Owner menunjukkan ini kontradiktif dengan tujuan mengurangi kebingungan dan pemakaian token — menyimpan dokumen usang dengan label tetap menambah jumlah file yang harus dibaca/disinkronkan, padahal Git sudah otomatis menjadi arsip permanen begitu di-commit.

**Prinsip baru yang disepakati:** untuk dokumen yang benar-benar digantikan (bukan sekadar draft historis bernilai naratif seperti `mantra.txt`/`NORTH_STAR.md`), pendekatannya adalah **serap konten unik ke dokumen aktif yang sudah ada, lalu hapus file sumber** — bukan simpan-dengan-label. Isi lengkap tetap tertelusuri lewat `git log`/`git show` kapan saja diperlukan.

## 2. Konten yang Diserap

| Konsep | Sumber Asli | Tujuan Baru |
|---|---|---|
| Two-Brain Model (Static/Dynamic Knowledge) | `MAEF V2.md` / `MAMET AI VISION CONSTITUTION V2.md` | `constitution/07_ENGINEERING_SYSTEM.md` §TWO-BRAIN KNOWLEDGE MODEL (baru) |
| Self Engineering Lifecycle (9 tahap kematangan) | `MAMET AI VISION CONSTITUTION V2.md` | `constitution/07_ENGINEERING_SYSTEM.md` §SELF ENGINEERING LIFECYCLE (baru) |
| Engineering Confidence (Coverage + Evidence) | `MAMET AI VISION CONSTITUTION V2.md` | `constitution/16_ENGINEERING_METRICS_SYSTEM.md` §ENGINEERING CONFIDENCE MODEL (baru) |
| — (tidak ada konsep unik) | `MAEF V3.md` | Tidak ada — isinya tumpang tindih penuh dengan `constitution/00_CONSTITUTION.md` |

Tambahan: `constitution/00_CONSTITUTION.md` §11 (Constitution Change Policy) diberi 2 kalimat baru — melarang dokumen baru mengklaim otoritas tertinggi, mewajibkan suksesi lewat ADR yang men-supersede dokumen yang sudah ada. Ini mencegah pola drift 4-draf-otoritas-paralel yang jadi akar masalah ADR-0018 terulang di masa depan, tanpa perlu dokumen kebijakan terpisah.

## 3. File yang Dihapus

- `docs/project-memory/MAEF V2.md`
- `docs/project-memory/MAEF V3.md`
- `docs/project-memory/MAMET AI VISION CONSTITUTION V2.md`

(Semua tetap dapat ditelusuri lewat `git log --follow -- "docs/project-memory/MAEF V2.md"` dst.)

## 4. File yang Diubah (Pointer Diperbarui)

- `docs/adr/ADR-0018-constitution-v3-supreme-authority.md` — §2.2, §3, §4 diperbarui mencerminkan penghapusan (bukan lagi "ditandai, disimpan")
- `docs/architecture/MASTER-ARCHITECTURE-INDEX.md` — 3 baris tabel diperbarui, nama file dicoret + catatan lokasi baru konten
- `INIT.md` — baris status diringkas jadi satu entri "Dihapus"
- `constitution/21 Engineer Capability.md` — rujukan ke `MAMET AI VISION CONSTITUTION V2.md` diarahkan ke `07_ENGINEERING_SYSTEM.md` (dokumen yang sama, sekarang sudah berisi kontennya)
- `docs/governance/MAEF.md`, `docs/governance/VISION.md` — pointer "Source of Truth" diarahkan langsung ke `constitution/`, bukan lagi ke file v2 yang sudah dihapus

## 5. Tidak Diubah (Sengaja)

- `docs/adr/ADR-0001-maef-as-highest-authority.md` tetap ada (ADR tidak boleh dihapus per `10_ADR_SYSTEM.md`, hanya ditandai Superseded).
- Changelog historis dan laporan audit point-in-time (`docs/cleanup_plan.md`, `docs/ponytail_audit_report.md`, `docs/verification_report.md`, `docs/architecture/CONSTITUTION-REVIEW-REPORT-2026-06-29.md`, `docs/architecture/ARCHITECTURE-GAPS.md`, snapshot `graphify-out/`) masih menyebut nama file lama — tidak diedit, konsisten dengan kebijakan proyek tidak mengubah log historis.

## 6. Verifikasi

Murni perubahan dokumentasi Markdown, tidak ada kode yang disentuh — tidak perlu build verification. Diverifikasi dengan `grep` bahwa seluruh rujukan aktif (non-changelog, non-archive) ke tiga file yang dihapus sudah diperbarui, hanya menyisakan rujukan di dokumen historis yang memang sengaja tidak diedit.
