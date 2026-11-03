# 3 November 2026 — Menuju 5.0.0: penguji mutu jawaban K1/K2 dibangun ulang, `raw_memory_content` ikut dicadangkan (K6)

[Roadmap hardening](../../roadmap/ROADMAP-HARDENING.md) · ADR-0022. Klien & alat uji saja (tanpa server, tanpa migrasi).

Owner meminta rilis 5.0.0. Pilihannya (3 Nov): **K1–K7 dituntaskan dulu**, baru 5.0.0 sebagai garis dasar yang sah.
Saldo OpenRouter belum diisi, jadi yang dikerjakan adalah semua yang tak butuh model.

## K1/K2 — penguji mutu jawaban

**Yang ketahuan:** dasar set uji lama sebagian hilang. `UJI-Kepbup-Sekretaris-DPRD-hal4-9.pdf` (KEP-01..06) dan
KATALOG-PENDAS tidak ada lagi di database. Yang tersisa adalah `DOKUMEN HCDP 2025-2026.docx` (87 potongan) dan
221 buku Kepbup. Penguji jawaban Item 78 (`jalankan-uji-rag.js`) juga hilang bersama
`frontend/node_modules/.uji-rag/` sejak 24 Sep.

**Set** `uji/data-lokal/set-uji-mutu-k1.json` (diabaikan git). Susunannya disetujui Owner:
- **22 pertanyaan pokok:** HCDP-01..08 (kunci Item 78) dan BUKU-01..14 (kunci Item 88, dicocokkan ke PDF asli).
- **4 pertanyaan tidak_ada:** NEG-01, NEG-03, NEG-B1, NEG-B2.

Token kunci dicocokkan lagi ke teks potongan di database. Contohnya BUKU-07: syarat "3 (tiga) tahun" ada di potongan
halaman 6, terpisah dari "sertifikasi". Jawaban yang hanya menyebut separuhnya dinilai SALAH.

**Penilai** `uji/lib/penilaiMutuRag.mjs` bersifat murni. Ia memberi tiap jawaban nilai BENAR, JUJUR, PERLU_CEK, atau
SALAH, dengan aturan berikut:
- Angka dibandingkan sebagai angka: 20,0% = 20%, tetapi 1980 bukan 80 dan 14.828 bukan 4.828.
- Isi nalar `<think>` dan tanda tebal diabaikan.
- Dokumen yang disebut harus dokumen yang benar; yang menyebut dokumen kembar (138 untuk 139) masuk PERLU_CEK.
- Ia mencatat label bohong (SALAH berlabel VERIFIED), label yang diturunkan, dan catatan "RAG turun" (U8b).
- Putusan K1 = tidak ada SALAH pada soal pokok; PERLU_CEK diperiksa manusia.
- Putusan K2 = semua soal tidak_ada JUJUR dan tidak ada label bohong.

**Modul konsol** `uji/uji-mutu-rag-k1.js` dijalankan di `npm run desktop`:
- Memakai `AssistantService.processMessage`, jalur chat yang sama dengan percakapan biasa.
- Selama uji hanya RAG yang menyala. Web, Deep Research, Data Tabel, Memory, folder kerja, dan konektor dimatikan
  sementara di memori, lalu dipulihkan di `finally`.
- `userId` dikosongkan, tidak ada yang disimpan ke `chats`, dan token diambil ulang per pertanyaan.
- Konteks hanya diperiksa untuk bukti; isinya tidak ikut ke berkas hasil.

## K6 — sumber asli memori ikut dicadangkan

`raw_memory_content` (22 baris) adalah "Golden Source" memori yang bisa dibaca klien, tetapi tidak pernah ikut
dicadangkan. Yang ikut hanya ringkasannya di `user_memories`. Owner memutuskan tabel itu ikut. Perubahannya:
- `cadanganData.js` mengambilnya sebelum `user_memories`.
- `skema-pulih.sql` mendapat definisi tabelnya; kolom disalin dari database live, termasuk `user_id` yang bertipe
  `text`.
- README kedaulatan kini menyebut 16 tabel.

Pemicu hapus akun sudah mencakup tabel ini. Uji pulih 16 tabel dijalankan sekali, tepat sebelum rilis (keputusan
Owner): uji pulih terakhir 27 Okt, dan cadangan 2 Nov belum memuat tabel ini.

## K5

- **Kunci OpenRouter:** sudah diganti Owner sesudah 17 Sep, jadi butir ini selesai.
- **Token Apify:** dicabut, bukan diganti. Satu-satunya pemakainya `youtube_analyst`, yang sejak T1 terkunci untuk
  `MAMET_PEMILIK_IDS` dan isinya sengaja kosong.

## Bukti

- `uji-penilai-mutu-rag.mjs` (baru) **lulus**. Mutasi pada salinan repo **18/18 mati**. Satu sempat lolos ("tanda
  tebal tak dibuang") karena ujinya tak pernah memuat tanda tebal di tengah token; celah uji itu sudah ditutup.
- `uji-cadangan-data.mjs` lulus, mutasi **4/4 mati**.
- Server dev Vite melayani modul, penilai, dan set (200, JSON sah, 26 soal).
- Suite penuh **148/148**.

Sisa: menjalankan uji K1/K2 dan K3 (💳), mencabut token Apify (👤), lalu tepat sebelum rilis "Cadangkan data" dan
uji pulih (👤).
