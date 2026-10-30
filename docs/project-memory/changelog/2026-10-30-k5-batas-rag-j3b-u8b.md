# 30 Oktober 2026 — Fase hardening tanpa saldo: batas volume RAG (K5), uji goyah J3b (K7), RAG turun bersuara di Mametlite (K2/U8b)

Dikerjakan atas permintaan Owner "kerjakan yang tidak memerlukan saldo" (ADR-0022).

## 1. K5 — batas volume `rag-process` (model ancaman TM-004)

**Temuan:** pendaftaran akun Supabase terbuka (keputusan Owner) → akun asing bisa mengunggah teks tanpa batas. Embedding
dibayar kuncinya sendiri, tetapi penyimpanannya memakai kuota database Owner (500 MB); lewat kuota = database hanya-baca =
chat, riwayat, dan Mametlite ikut berhenti. Ukuran 30 Okt: 1 potongan ±6,5 KB, DB 60 MB, akun terbesar 3.480 potongan.

**Dibuat:** `supabase/functions/rag-process/batas_volume.ts` (baru) — per akun **10.000** potongan (±65 MB), total
**45.000** (±280 MB, < 70% kuota). `index.ts` langkah 5b: dua hitungan (`documents!inner(user_id)` & total) **sebelum**
dokumen dibuat dan sebelum embedding → 413 `KUOTA_AKUN_PENUH` / `KUOTA_SISTEM_PENUH` tanpa biaya & tanpa sisa;
hitungan gagal → 503 `KUOTA_TAK_TERBACA` (tidak diloloskan diam-diam). Kedua klien sudah menampilkan `error` server.

**Bukti:** `uji/uji-batas-rag-process.mjs` (baru, `index.ts` asli dibundel) **9/9**; mutasi **6/6**. Deploy Owner:
`rag-process` **76 → 77**, `verify_jwt` tetap `false`, isi paket dibaca utuh. **Live:** unggahan Owner 14:18 UTC (sesudah
v77) **berhasil** — 2 potongan, akun 3.480 → 3.482 → kueri hitungan berjalan di platform dan unggahan sah tidak tertahan.

## 2. K7 — J3b: uji goyah `uji-alat-folder-jalan.cjs` dipatok

**Temuan (7 Okt):** asersi majemuk `h.ok && h.habisWaktu && keluaran 'mulai' && < 15 s` gagal sekali di suite penuh
(3.661 ms). Penalaran dari kode (tak tereproduksi dalam percobaan terkendali): Node menyerahkan semua stdout sebelum
`close` dan skrip tak mungkin selesai sendiri, jadi yang runtuh hampir pasti `'mulai'` — Python + `Popen` cucunya belum
menyala dalam 3 s saat mesin sibuk.

**Dibuat:** asersi dipecah tiga (habisWaktu · cucu sempat berjalan · close ≤ batas + 12 s); tanpa `'mulai'` prasyaratnya
belum terpenuhi → dicoba ulang SEKALI dengan batas 8 s. Toleransi 15 s untuk kasus 3 s tidak dilebarkan.

**Bukti:** simulasi "Python lambat 4 s" kini **lulus** (2 percobaan); `habisWaktu` tak ditandai → **gagal**; pohon tak
dimatikan → **gagal** (close 60 s). Tak ada proses Python tersisa.

## 3. K2 — U8b: RAG yang turun ke pencocokan kata kini terlihat di jawaban (juga Mametlite)

**Temuan:** riwayat chat 30 Okt (hitungan saja): **0 dari 278** pesan RAG pernah turun ke pencocokan kata — jalurnya belum
pernah teruji live. Penurunannya (sejak 2 Okt) hanya masuk langkah proses, yang **tidak ditampilkan Mametlite** → pengguna
awam membaca jawaban hasil pencocokan kata seolah hasil pencarian makna.

**Dibuat:** `label_sumber.ts` `catatanRagTurun(sebab)` → satu baris `_Catatan sistem: pencarian makna dokumen tidak jalan
(sebab) — …_` (pola yang sudah dibaca kotak label Mametlite). `context_builder.ts` menandai `ctx.state.ragTurunKeKata`;
`synthesis_handler.ts` menambahkannya sesudah koreksi label (non-stream) dan meneruskannya ke ketiga jalur stream;
`stream_handler.ts` menulisnya di akhir isi, tidak ke header `X-Agent-Metadata`.

**Bukti:** `uji/uji-rag-turun-catatan.mjs` (baru — `pisahLabel` Mametlite & `stream_handler` asli) **10/10**; mutasi
**7/7**. Deploy Owner: `agent-process` **541 → 542**, 102 berkas, 97 sama persis + 5 berkas tipe murni yang dikosongkan
platform; catatan ada di paket. **Belum terbukti live:** butuh chat yang menjawab sementara embedding gagal.

## Keseluruhan

Suite **136/136**; bundel esbuild `agent-process` & `rag-process` berhasil; tanpa karakter kendali.

**Catatan proses:** satu skrip mutasi ditulis lewat heredoc dan tiga mutasinya tak terpasang (backslash rusak) — ditulis
ulang dengan alat tulis berkas (aturan CLAUDE.md). Satu kueri pola langkah proses terlalu longgar dan ikut menarik
potongan teks konteks sistem dari metadata chat; tidak diteruskan, kueri berikutnya kembali hanya hitungan.
