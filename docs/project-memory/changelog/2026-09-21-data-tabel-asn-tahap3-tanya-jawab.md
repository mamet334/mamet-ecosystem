# Data Tabel Rekonsiliasi ASN — Tahap 3: Tanya-Jawab di Chat (Item 92)

**Tanggal:** 21 September 2026
**Roadmap:** Item 92 ([`ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md`](../../roadmap/ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md)), T9 ([`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md))
**Status:** ✅ Tahap 3 selesai — uji live putaran 3: 5/5 pertanyaan data VERIFIED & benar, 0 NIP karangan, 0 NIP di prompt.

## Alur

Chip **Data Tabel** (panel Tools chat Assistant, mati bawaan) → bendera `dataTabel: true` (BUKAN lewat `tools`: daftar
itu juga menyaring sub-agent Coordinator) di payload percakapan **dan** LOOKUP →
1. **Perencana** (`deepseek-v4-flash`, kunci OpenRouter pengguna, ±$0,00002–0,0001) mengubah pertanyaan menjadi rencana
   saringan JSON; hanya melihat daftar nama OPD & nama kolom.
2. **Kode** menyaring & menghitung baris `asn_pegawai` berkas aktif (`dataTabelAsnSaring.js`, murni, dipakai server).
3. Hasil masuk sebagai dokumen bukti pertama "Data Tabel Rekonsiliasi ASN": jumlah + ≤30 nama, **tanpa NIP**.
4. **Kode menutup jawaban** (`tutupJawabanDataTabel`): kalimat hasil di baris teratas ("📊 Hasil hitung sistem: 155
   orang — OPD: RSUD · kelompok: JFT · pelatihan teknis/fungsional: BELUM ADA"), NIP karangan disamarkan, VERIFIED
   diturunkan bila data tidak dihitung, tabel ber-NIP dari database ditempel di bawah.

NIP: bukan penanda `[P-0231]` yang harus disalin model — model tidak pernah menerima NIP; NIP yang tampil ditulis kode
dari database (keputusan Owner).

## Uji live putaran 1 — gagal, dan kenapa (dilaporkan apa adanya)

| Pertanyaan | Kejadian | Penyebab |
|---|---|---|
| JFT RSUD belum pelatihan | Model menulis **"tidak ada satupun"** (benar: 155) **dan tabel dengan 30 NIP KARANGAN** — 0 dari 30 ada di database, di bawah judul tiruan "bukan ditulis AI" | Tabel ber-NIP dari jawaban sebelumnya ikut **riwayat chat** → NIP asli sampai ke model & formatnya ditiru; uraian "pelatihan … — daftar kosong" dibaca "daftarnya kosong" |
| Inspektorat per tingkat PIM | Tabel PIM karangan, VERIFIED | Perencana terpotong (max_tokens 400, "Unexpected end of JSON input"); model mengarang walau diberi tahu gagal |
| Keduanya | Tetap VERIFIED | Pemeriksa label hanya mencocokkan angka ("155" ada; 1/3/5 ada di mana-mana) |

Chat uji berisi NIP palsu dihapus Owner.

## Perbaikan (di KODE — putaran 1 membuktikan perintah ke model tidak cukup)

1. **Riwayat dibersihkan di server** (`request_pipeline.ts`, semua permintaan): tabel data & tiruan model dibuang, angka
   NIP (rapat/berspasi) disamarkan.
2. **NIP karangan disamarkan** di teks model saat data tabel aktif.
3. **Kalimat hasil dari kode** di baris teratas (sesudah `<think>`); uraian tanpa "daftar kosong" ("PIM: BELUM ADA");
   teks model menyatakan "ADA 155 orang yang MEMENUHI SEMUA saringan".
4. **Data tidak dihitung → HYPOTHESIS + peringatan** kode; perencana 1.000 token + satu kali ulang.
5. Data tabel **tidak dilayani di jalur streaming** (teks terkirim sebelum bisa disamarkan; desktop selalu non-stream).

Putaran 2: 0 NIP karangan, 0 NIP di prompt, kalimat hasil benar — tetapi pertanyaan 2–4 INSUFFICIENT + "tidak bisa
menjawab": Coordinator menugaskan `knowledge_manager` yang rusak (T9) dan 5–6 potongan Kepbup tentang **persyaratan**
PIM ikut konteks. Perbaikan:

6. **Data tabel berhasil → Coordinator & sub-agent dilewati** (`core_engine.ts`) **dan potongan RAG/web tidak dikirim**
   (`context_builder.ts`). Gagal/tidak relevan → jalur biasa utuh.
7. **Isi sama persis tidak ditawarkan sebagai versi** (`bandingkanIsi`, per orang & per kolom): INSPEKTORAT senin
   sempat tersimpan dua kali. Kotak versi kini menunjukkan perbedaan — selasa vs senin: **50 orang berubah** (nilai IPA,
   pelatihan, PIM), bukan "satu pejabat".

## Bukti putaran 3 (chat baru, chip RAG + Data Tabel menyala)

| # | Kalimat hasil dari kode | Label |
|---|---|---|
| 1 | 14 orang — RSUD · struktural | VERIFIED |
| 2 | 14 orang — RSUD · struktural · PIM: BELUM ADA (+ tabel 14 NIP asli) | VERIFIED |
| 3 | 155 orang — RSUD · JFT · pelatihan teknis/fungsional: BELUM ADA (+ tabel) | VERIFIED |
| 4 | 8 orang — INSPEKTORAT · struktural · II+III+IV 1, III+IV 1, IV 5, belum PIM 1 | VERIFIED |
| 5 | 619 orang — semua OPD (berkas aktif) | VERIFIED |
| 6 | (Kepbup) data tabel dilewati → jalur biasa | lihat T9 di bawah |

Semua: 0 kalimat "tidak bisa menjawab", 0 NIP karangan (setiap NIP ada di database), 0 NIP di prompt; perencana 6/6
berhasil percobaan pertama; Coordinator & 5–8 potongan RAG dilewati pada 1–5.

**Data INSPEKTORAT dibetulkan:** kedua catatan lama ternyata sama-sama berkas **senin** (sidik JUMLAH Pelaksana baris
26); selasa belum pernah tersimpan (sempat tampil "Tersimpan" palsu akibat bug nama berkas sama). Owner mengunggah
selasa → aktif (belum PIM 1); unggah ulang senin → kotak hijau "sama persis".

## T9 — `knowledge_manager` dicabut dari Coordinator (keputusan Owner)

Pertanyaan 6 (Kepbup, bukan data tabel): RAG menemukan 2 potongan tepat, tetapi Coordinator menugaskan
`knowledge_manager`; ia menampilkan daftar workspace dan model menyimpulkan "tidak ada dokumen Kepbup" → HYPOTHESIS.
Lebih serius: pada 08:59 sub-agent itu **membuat knowledge_space bernama pertanyaan pengguna** ("Berapa pejabat
struktural Inspektorat per tingkat PIM?", kosong) — Research App memilih space terbaru sebagai bawaan, jadi unggahan RAG
berikutnya bisa mendarat di sana.
- `plugins/registry.ts`: `knowledge_manager` dikeluarkan dari daftar sub-agent (berkas plugin dibiarkan);
  `intent_router.ts`: aturan "MACRO QUERY → knowledge_manager" diganti "isi dokumen/workspace → []".
- Space kosong itu dihapus (izin Owner; dicek: 0 dokumen, chat, memori, ringkasan). Space terbaru kembali = space buku
  Kepbup (222 dokumen).

## Uji otomatis (di luar git, `frontend/node_modules/.uji-rag/`) — SEMUA LULUS

`uji-data-tabel-asn.mjs` (Tahap 1), `uji-data-tabel-asn-tahap2.mjs` (versi + bandingkan isi senin/selasa),
`uji-data-tabel-asn-tahap3.mjs` (saring: kunci RSUD 14/14/1/131/155/154, rincian PIM per tingkat, koma desimal, teks tanpa
NIP, lampiran 155 baris, uraian tanpa "daftar kosong", pembersihan riwayat & tabel tiruan, penyamaran NIP),
`uji-tutup-jawaban.mjs` (fungsi server via esbuild: kasus live Q3 & Q4 direplikasi).
