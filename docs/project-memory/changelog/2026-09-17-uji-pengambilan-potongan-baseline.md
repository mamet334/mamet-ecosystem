# Set Uji Pengambilan Potongan & Angka Acuan (Item 90 Tahap A)

**Tanggal:** 17 September 2026
**Roadmap:** Item 90 ([`ROADMAP-PENGAMBILAN-POTONGAN-RAG.md`](../../roadmap/ROADMAP-PENGAMBILAN-POTONGAN-RAG.md)) Tahap A
**Status:** selesai — angka acuan tercatat. Kode aplikasi & server tidak berubah.

## Yang dibuat (di luar git, `frontend/node_modules/.uji-rag/`)

- `set-uji-pengambilan.json` — 17 pertanyaan: HCDP-01..08, KEP-01..06 (Kepbup Sekretaris DPRD), NEG-01..03.
  Potongan yang seharusnya terambil ditandai **teks bukti** (bukan ID); tiap teks bukti dicocokkan ke
  `document_chunks` dan menunjuk tepat potongan yang benar.
- `uji-pengambilan.js` — dari konsol `npm run desktop`: embedding pertanyaan lewat jalur aplikasi (BYOK),
  `match_documents` ambang -1, lalu peringkat bukti, recall@8 (peringkat ≤ 8 & skor > 0,55), skor ke-1/ke-8,
  jumlah potongan masuk konteks; kontrol skor RPC vs cosine lokal; opsi `ulang`.

## Kunci jawaban diperiksa ke dokumen asli (bukan ke database)

Diminta Owner. HCDP: XML `DOKUMEN HCDP 2025-2026.docx` dibaca langsung (tanpa pengekstrak aplikasi). Kepbup:
halaman PDF asli dirender jadi gambar dan dilihat (posisi centang hal. 6, kompetensi teknis 11 hal. 4, nama
jabatan hal. 1 "Sekretaris Dewan Perwakilan Rakyat Daerah"). **17/17 sesuai.** KAT-01..03 & set lama
dikeluarkan (KATALOG terhapus, U1).

## Angka acuan (2026-09-17 07:00 UTC)

**Korpus:** akun Owner 2 dokumen / 105 potongan (HCDP DOCX 87, UJI-Kepbup 18). 16 dokumen `.txt` lain di
tabel milik pengguna lain — tidak ikut pencarian (`p_user_id`) dan tidak dibaca.
**Kontrol:** 2 putaran **identik**; skor RPC 0,724609 = cosine lokal 0,724609.

| ID | Bukti ke- | Skor bukti | recall@8 | Skor ke-1 | Skor ke-8 |
|---|---|---|---|---|---|
| HCDP-01 | 1 | 0,7246 | ✅ | 0,7246 | 0,6725 |
| HCDP-02 | 1 | 0,7327 | ✅ | 0,7327 | 0,6772 |
| HCDP-03 | 2 | 0,7526 | ✅ | 0,7661 | 0,7193 |
| HCDP-04 | 3 | 0,7056 | ✅ | 0,7140 | 0,6697 |
| HCDP-05 | 1 | 0,7704 | ✅ | 0,7704 | 0,7003 |
| HCDP-06 | 2 | 0,7129 | ✅ | 0,7233 | 0,6778 |
| HCDP-07 | 3 | 0,7448 | ✅ | 0,7923 | 0,7392 |
| HCDP-08 | 1 | 0,7571 | ✅ | 0,7571 | 0,6782 |
| KEP-01 pelatihan teknis | **15** | 0,6501 | ❌ | 0,7023 | 0,6592 |
| KEP-02 pengalaman mutlak | 1 | 0,6359 | ✅ | 0,6359 | 0,5452 |
| KEP-03 pendidikan | 3 | 0,6434 | ✅ | 0,7019 | 0,6200 |
| KEP-04 pangkat | 2 | 0,6624 | ✅ | 0,7060 | 0,6325 |
| KEP-05 indikator kinerja | **8** | 0,6492 | ✅ (batas) | 0,7062 | 0,6492 |
| KEP-06 Manajemen SDM | 4 | 0,6898 | ✅ | 0,7576 | 0,6706 |
| NEG-01 (2030) | — | — | — | **0,7756** | 0,6644 |
| NEG-02 (tunjangan) | — | — | — | 0,6631 | 0,6052 |
| NEG-03 (SPP UT) | — | — | — | 0,5576 | 0,5486 |

**recall@8 = 13/14.**

## Temuan

1. **Kegagalan hanya di Kepbup, polanya sama:** potongan halaman 1 (satu-satunya yang memuat nama jabatan) di
   #1 untuk KEP-03/04/06 dan NEG-02 tanpa menjawab; KEP-01 kalah oleh 7 paragraf umum HCDP "pengembangan
   kompetensi". Nama jabatan tidak melekat ke potongan tabel — sasaran Item 89.
2. **U4 terbukti: skor tidak memisahkan relevan/tidak.** Skor bukti benar 0,636–0,770; skor ke-1 NEG
   0,558–0,776 (NEG-01 lebih tinggi dari semua bukti). Ambang 0,55 hampir tak menyaring (konteks 8 potongan
   di 15/17 pertanyaan). Menaikkan ambang bukan jalan keluar; kejujuran tetap dijaga label.
3. **HCDP sehat** (bukti #1–#3) — Tahap B/C wajib mempertahankannya.
