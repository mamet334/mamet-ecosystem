# T9 — Sub-agent `knowledge_manager` Dihapus

**Tanggal:** 21 September 2026
**Roadmap:** T9 ([`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md))
**Status:** ✅ ditutup — keputusan Owner "hapus, bukan perbaiki"; terbukti live sesudah deploy.

## Kenapa dihapus, bukan diperbaiki (bukti database)

| Aksi plugin | Kenyataan |
|---|---|
| Buat / hapus / daftar workspace | Kini ada di UI Research App (dengan pagar jumlah dokumen & CORE). Versi plugin menghapus workspace **beserta dokumennya tanpa konfirmasi** dan membuat workspace bernama kalimat chat |
| Simpan hasil chat ke RAG | **0 dokumen "Saved from Chat"** — tak pernah berhasil (filter mutunya butuh kunci Groq yang sudah dihapus) |
| Statistik workspace | Tak pernah jalan — `get_workspace_stats` tidak ada di database |
| Ringkasan workspace | **0 baris** `workspace_summaries` |

Manfaat tercatat: nol. Kerugian tercatat: jawaban RAG Kepbup rusak, workspace liar ("Berapa pejabat struktural…?",
"Observasi Pasar…").

## Perubahan

- Dihapus: `plugins/knowledge_manager.ts`, `lib/knowledge_quality_filter.ts` (pemanggil Groq, hanya dipakai plugin itu).
  Keduanya ada di riwayat git.
- `lib/workspace_guardian.ts`: tidak lagi **menyuntikkan `knowledge_manager` ke daftar tools setiap permintaan** dan tidak
  lagi mengirim arahan "CRUD workspace → knowledge_manager" ke Coordinator; tinggal penentuan target penyimpanan.
- `lib/request/policy_middleware.ts`: aturan khusus `knowledge_manager` dihapus.
- `plugins/registry.ts`, `lib/rag/embedding.ts`: komentar diperbarui.
- Tabel `workspace_summaries` (kosong) dibiarkan — masih dirujuk backup-export/restore; menghapusnya perlu migrasi.

## Efek samping yang dipahami

Karena penjaga selalu menambahkan `knowledge_manager`, daftar tools tidak pernah kosong dan Coordinator dipanggil —
padahal daftar izin (`getPluginPromptList`) hanya mengizinkan sub-agent yang ada di daftar itu, jadi satu-satunya
pilihannya `knowledge_manager`. Kini permintaan tanpa tools melewati Coordinator; sub-agent lain tetap terpanggil bila
klien mengirim tools-nya (mis. Deep Research). Tidak ada kemampuan yang hilang.

## Bukti

- Seluruh `agent-process` dibundel ulang (esbuild) — tidak ada impor putus; tidak ada rujukan tersisa di kode.
- Live sesudah deploy ("buat workspace uji T9", chip RAG + Web): tidak ada `knowledge_manager` di log maupun langkah
  proses, tidak ada "sub-agent tidak ditemukan", **tidak ada workspace baru** (workspace Owner: Kepbup OKU 2025 + inti).

## Temuan sampingan (bukan akibat T9)

Owner melihat nalar tidak tampil. Log: **semua** permintaan hari ini (termasuk sebelum T9) `thinking: false`,
`reasoning=0t` — tingkat model Auto memakai `deepseek-v4-flash` dengan "Nyalakan reasoning mendalam" tidak dicentang
(Settings.jsx); sejak 13 Sep `thinking: false` mematikan reasoning di OpenRouter. Nalar hanya muncul bila model menulis
`<think>` sendiri (gpt-4o-mini cenderung patuh). Solusi = pengaturan Owner, tidak ada perubahan kode.
