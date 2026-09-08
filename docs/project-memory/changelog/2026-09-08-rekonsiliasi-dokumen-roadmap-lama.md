# Changelog: Rekonsiliasi 6 Dokumen Roadmap Lama terhadap Kode Aktual

**Tanggal:** 2026-09-08
**Status:** ✅ Selesai — 6 dokumen direkonsiliasi, 3 gap kode baru teridentifikasi & didaftarkan
**Scope:** Dokumen `docs/roadmap/` yang bertanda "📋 Belum direview ulang" di `INDEX-ROADMAP.md` Bagian 1
**Komponen Terdampak:** Dokumentasi saja — **tidak ada perubahan kode sumber**
**Referensi Terkait:** [`INDEX-ROADMAP.md`](../../roadmap/INDEX-ROADMAP.md)

---

## 1. Latar Belakang

`INDEX-ROADMAP.md` Bagian 1 menandai enam dokumen sebagai *"Belum direview ulang dalam sesi ini"*, dengan catatan bahwa `MAMET-AI-ROADMAP.md` memakai skema penomoran berbeda (`TASK-000x`/`ADR-000x` vs `PR#`) dan *"perlu direkonsiliasi sebelum dipakai sebagai rujukan aktif"*. Sesi ini menuntaskan rekonsiliasi tersebut: setiap klaim di keenam dokumen diverifikasi baris-per-baris terhadap kode aktual.

## 2. Hasil Verifikasi per Dokumen

| Dokumen | Verdict | Bukti Kode |
|---|---|---|
| `MAMET-AI-ROADMAP.md` | ✅ Akurat (Phase 0–8 + Post-Baseline) | `ADR-0003`–`ADR-0007` ada di `docs/adr/`; tabel `project_memory_entries`/`engineering_tasks`/`architecture_gaps` dipakai di `engineer_context.ts` & `EngineerDashboard.jsx`; enum `MametCapabilityMode` + policy matrix di `types.ts:1,31` |
| `engineer-autonomous-mode.md` | ✅ Akurat | `engineerCmdStates` `ConversationEngine.jsx:74`, `handleRunCommand()` `:735`, parser marker `:1037–1076`, instruksi LLM `engineer_context.ts:184–228` |
| `engineer-chat-upgrade.md` | ✅ Perilaku akurat, ⚠️ atribusi file usang | Early-return sudah hilang (`Engineer:GeneratePatch` hanya di `:1240`, dalam handler tombol Apply). Deteksi `[MAMET_PATCH_READY]` **pindah** ke `AssistantService.js:846,919` |
| `fix-log.md` | ✅ Akurat (2/2 fix masih aktif) | BYOK header `Settings.jsx:71–73`; adaptive profile `synthesis_handler.ts:94–111` (variabel di-rename jadi `looksLikeJsonPatch`) |
| `rencana.md` | ⚠️ Kontradiksi internal — kode lebih maju | Seluruh Fase 1–5 ada: `SessionArtifact` `engineer.js:43`, `_detectIntent()` `:1000`, `_checkCapabilityAndDeclare()` `:655`, `_emitReasoningReport()` `:893`, `_waitForUserConfirmation()` `:933`, `_updateArtifact()` `:256`, `_injectArtifactIntoPrompt()` `:355`; UI listener `ConversationEngine.jsx:449`/`:467`/`:1194`/`:1206` |
| `roadmap-lanjutan.md` | ⚠️ Tanpa status marker — 3 dari 4 fase ternyata sudah jalan | Kernel graceful degradation `Kernel.js:611–617`; Circuit Breaker `engineer.js:1389–1398`; `SystemNotificationCenter.jsx` ada & terpasang di `OSDesktopShell.jsx:26` |

## 3. Dua Temuan Utama

### A. `rencana.md` bertentangan dengan dirinya sendiri
Baris status menyatakan *"✅ SELESAI & TESTED (Fase 1–5)"*, namun judul Fase 3/4/5 masih bertanda `📌` (Fase 3 bahkan disebut *"CRITICAL — Gap Terbesar"*) dan tabel gap analysis menyatakan Reasoning Lock serta Session Artifact *"❌ Tidak ada"*. Verifikasi kode membuktikan **baris status yang benar** — seluruh Fase 1–5 terimplementasi. Penanda usang telah dikoreksi dengan rujukan baris kode.

### B. `roadmap-lanjutan.md` ditulis tanpa status sama sekali
Dokumen ini berformat proposal murni, sehingga pembaca (termasuk AI) akan menyimpulkan tidak ada yang dikerjakan — padahal Fase 2.1, 2.2, dan 4.1 sudah aktif di kode. Status per fase kini ditambahkan, termasuk pembaruan pada paragraf penutup yang semula masih menginstruksikan *"implementasikan Fase 2 terlebih dahulu"*.

## 4. Klaim yang Tidak Dapat Diverifikasi

`rencana.md` mengklaim **"54/54 test passed"**, namun repositori ini **tidak memiliki satu pun berkas test** — pencarian `*.test.*` dan `*.spec.*` menghasilkan 0 berkas, dan tidak ada direktori `test/`/`tests/`/`__tests__/`. Klaim tersebut kini diberi disclaimer eksplisit di dokumennya. Kemungkinan pengujian dijalankan ad-hoc tanpa di-commit.

## 5. Gap Kode Tersisa (Didaftarkan sebagai Backlog Item 11–13)

| Item | Gap | Sumber |
|---|---|---|
| 11 | `SystemLogsApp` (Event Viewer ala `dmesg`) belum ada di AppRegistry; `kernel.getHealth()` hanya dirender di `Settings.jsx` | `roadmap-lanjutan.md` §4.2 |
| 12 | `_knowledge_archive/00_EXPERIMENT_HISTORY.md` belum dibuat — yang ada `00_INDEX.md` berisi inventaris folder, bukan ringkasan per eksperimen gagal | `roadmap-lanjutan.md` §1.2 |
| 13 | Dua aturan prompt pengaman belum ada di blok `ATURAN KODE` (`engineer.js:2483–2491`): larangan emit `Engineer:GeneratePatch` & larangan baca kode raw dari `_knowledge_archive/` | `roadmap-lanjutan.md` §3.1 |

## 6. Catatan Skema Penomoran

Perbedaan skema `TASK-000x`/`ADR-000x` dan istilah "MametLite"/"BRAIN 1-2" di `MAMET-AI-ROADMAP.md` dikonfirmasi **hanya perbedaan historis (dokumen baseline), bukan konflik implementasi**. Pemetaannya dicatat di dokumen tersebut: capability "Assistant" setara nilai enum `"AI"` di `MametCapabilityMode`. `INDEX-ROADMAP.md` tetap menjadi rujukan status aktif.

## 7. Daftar Berkas yang Dimodifikasi

| No | Berkas | Deskripsi Perubahan |
|---|---|---|
| 1 | `docs/roadmap/rencana.md` | Kontradiksi internal dihapus — Fase 3/4/5 `📌` → `✅` dengan rujukan kode; tabel gap analysis diberi kolom status kode; disclaimer klaim test |
| 2 | `docs/roadmap/roadmap-lanjutan.md` | Status per fase ditambahkan (✅/⚠️/❌) + tabel ringkasan header; paragraf penutup diperbarui + daftar 3 gap tersisa |
| 3 | `docs/roadmap/engineer-chat-upgrade.md` | Koreksi atribusi lokasi kode deteksi `[MAMET_PATCH_READY]` |
| 4 | `docs/roadmap/MAMET-AI-ROADMAP.md` | Banner verifikasi per fase + klarifikasi skema penomoran bersifat historis |
| 5 | `docs/roadmap/engineer-autonomous-mode.md` | Catatan verifikasi dengan 4 rujukan lokasi kode |
| 6 | `docs/roadmap/fix-log.md` | Catatan verifikasi kedua fix masih aktif + catatan rename variabel |
| 7 | `docs/roadmap/INDEX-ROADMAP.md` | Baris status Bagian 1 diperbarui; Backlog Item 11–13 didaftarkan di Bagian 6 |
