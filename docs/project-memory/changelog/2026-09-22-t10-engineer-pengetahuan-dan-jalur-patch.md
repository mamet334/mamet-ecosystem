# T10 — Sumber Pengetahuan Engineer + Perbaikan Jalur Patch Engineer (uji TUGAS-01)

**Tanggal:** 22 September 2026
**Roadmap:** T10 di [`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md) — Tahap 1 ✅; uji Engineer berjalan
**Status:** ⏳ kode selesai & teruji otomatis; **uji ulang live TUGAS-01 belum** (perlu deploy + `npm run desktop` ulang).

## T10 Tahap 1 — RAG Engineer hanya dari space "Pengetahuan Engineer" (live ✅)
- `routing_decider.ts` `cariSpaceEngineer` (space bertanda `engineer` atau bernama "Pengetahuan Engineer");
  `context_builder.ts`: mode ENGINEER → hanya space itu; tanpa space → RAG Engineer dilewati dengan catatan.
- Live: "📚 [RAG Engineer] hanya mencari di space Pengetahuan Engineer" → 8 potongan, sufficiency 0,75 (dulu buku
  Kepbup ikut masuk). Space dibuat Owner di Research App; 3 dokumen diunggah dari `D:\SLAMET\other\pengetahuan-engineer\`
  (peta sistem, aturan kerja, 4 tugas uji) — di luar repo.

## Temuan uji TUGAS-01 & perbaikannya
| Temuan live | Perbaikan |
|---|---|
| Tombol Apply Patch hanya meneruskan pesan asli; `llmProposedContent` dikirim tapi tak dibaca; "kerjakan…" → CLARIFICATION | `engineer/UsulanPatch.js`: berkas target dari kunci JSON usulan + usulan sebagai panduan maksud; klik Apply = niat MODIFY_CODE |
| Usulan chat menulis 3 baris sebagai "seluruh isi" berkas 96 baris | `request_pipeline.ts`: nilai JSON = "SEBELUM: … SESUDAH: …", bukan isi lengkap |
| **Checkpoint = `git stash` SELURUH working tree** — 5 berkas kerja yang belum di-commit lenyap ke stash (dipulihkan utuh), Undo = stash teratas, repo bersih = tanpa checkpoint | `main.cjs` `eng:git-checkpoint/rollback`: salinan byte isi asli HANYA berkas target di `userData/eng-checkpoint/<label>.json`, Undo menulis kembali berkas itu (berkas baru → Recycle Bin), tanpa shell; `PatchApplier`: checkpoint gagal → tidak menulis |
| Patch cari-ganti yang BENAR diblokir server "must be a string, got object" (format yang diminta `PatchGenerator` layar) | `verification_engine.ts`: terima objek `search_replace`; pindai kode berbahaya membaca "replace"; patch campuran tak kehilangan entri |
| Model gagal → `generateFallbackPatch` menambahkan `// TODO: Implement changes…` lalu diterapkan (berkas dikembalikan) | patch palsu dihapus; `PATCH_FAILED`/`SAFETY_REJECTION`/`CORE_MODIFICATION_BLOCKED` kini tampil dengan alasan |
| Menulis berkas aplikasi → Vite memuat ulang → hasil & Undo hilang | `engineer/CatatanPatch.js`: catatan sebelum menulis; setelah muat ulang chat Engineer membaca ulang DISK & memulihkan Undo |
| Model menambah titik penutup pada teks dicari ("(PR#1).") | toleransi sempit tanda baca penutup (hanya bila cocok tepat sekali); dokumen tugas: baris dalam blok kode |

## Uji otomatis (di luar git) — semua lulus
`uji-checkpoint-engineer.cjs` 17/17 (blok IPC nyata, repo git sementara), `uji-verifikasi-patch-cari-ganti.mjs` 8/8
(jawaban model persis dari log), `uji-catatan-patch.mjs` 7/7, `uji-engineer-jalankan.cjs` v4; bundel `agent-process` ✅.

## Berikutnya
Deploy → `npm run desktop` ulang → unggah ulang `03-tugas-uji-engineer.md` → ulangi TUGAS-01 (harapan: tepat 1 baris
berubah di `SkillGuardService.js`) → TUGAS-02..04. Tahap 2 T10 (web teknis) belum.
