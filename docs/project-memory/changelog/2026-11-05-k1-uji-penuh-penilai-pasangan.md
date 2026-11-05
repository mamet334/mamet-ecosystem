# K1/K2 Uji Penuh Pertama + Penilai Membaca Pasangan Baris → Nilai

**Tanggal:** 5 November 2026
**Roadmap:** [`ROADMAP-HARDENING.md`](../../roadmap/ROADMAP-HARDENING.md) K1/K2 · Item 88 ([`ROADMAP-TABEL-CENTANG-PDF.md`](../../roadmap/ROADMAP-TABEL-CENTANG-PDF.md))
**Status:** ✅ penilai diperbaiki (klien uji saja, tanpa perubahan server). K1/K2 terukur **GAGAL** karena BUKU-10.

## Uji penuh pertama (saldo terisi)

`uji-mutu-rag-k1.js` versi `k1-2`, 26 soal × 2 putaran, dijalankan Owner di `npm run desktop`. Setelah dinilai ulang
dengan penilai baru (tanpa biaya model):

| Jenis | Putaran | Hasil |
|---|---|---|
| Pokok (22 soal) | 44 | BENAR 31 · PERLU_CEK 12 · SALAH 1 (BUKU-10) |
| Tidak ada (4 soal) | 8 | JUJUR 6 · PERLU_CEK 2 (NEG-01) |

PERLU_CEK HCDP-01..06 = model menyalin deret tabel yang memuat pengecoh (diperiksa manusia: isinya benar). Satu-satunya
jawaban salah: **BUKU-10** (tingkat kepentingan Pengalaman Kerja jabatan 177 — benar Mutlak, dijawab Penting).
Ulang BUKU-10 ×5 (`k1-3`): **4 dari 5 salah**.

## Dua celah penilai yang meloloskan jawaban salah (`uji/lib/penilaiMutuRag.mjs`)

1. **"tidak ada …" dibaca pengakuan.** Jawaban salah ber-VERIFIED memuat kalimat fakta dokumen "tidak ada persyaratan
   pelatihan manajerial" → dulu JUJUR. Kini pengakuan hanya sah bila **tak satu pun** fakta kunci muncul; sebagian
   muncul + "tidak ada…" → PERLU_CEK.
2. **Kata kunci lepas.** "Penting (bukan Mutlak)" memuat kedua kata kunci → BENAR; "penting" juga cocok di dalam
   "kepentingan". Kini soal boleh punya `pasangan` (`periksaPasangan`): baris yang dinilai + nilai yang benar; jendela
   120 huruf sesudah tiap kemunculan baris, frasa "bukan X" dibuang, nilai dibaca sebagai kata utuh. Nilai berbeda di
   kemunculan mana pun → SALAH (tidak bisa dimaafkan kalimat pengakuan); pasangan tak terbaca → fakta kunci hilang.
   BUKU-10 di set lokal kini berpasangan: pengalaman kerja → mutlak, diklat teknis → penting.

Penilaian ulang: uji penuh BUKU-10 JUJUR → SALAH (K1 PERIKSA → GAGAL); ulang ×5 dulu "LULUS" → 4/5 SALAH. Soal lain
tidak berubah.

Modul konsol `k1-3` juga mencatat `blok_centang` per putaran (ada / hanya-tidak-pasti / tidak) — tanda saja, isi
konteks tetap tidak disimpan.

**Uji:** `uji-penilai-mutu-rag.mjs` +9 kasus (teks jawaban nyata BUKU-10, "bukan Penting, melainkan Mutlak", nilai
tertukar, baris tanpa nilai, "kepentingan", nilai baris lain di luar jendela, baris disebut dua kali). Mutasi di salinan:
aturan pengakuan **4/4**, pasangan **7/7** (awalnya 4/7 — tiga kasus ditambah sampai mati). Suite **155/155**.

## Diagnosis BUKU-10 (diukur di seluruh korpus Kepbup, hanya hitungan)

- **Tabel OCR tak bisa dihitung selnya.** Rencana "tempel (Mutlak) di samping centang dengan menghitung sel dari kanan"
  diukur dulu: dari 323 baris tabel bertanda yang berpasangan dengan blok `[TABEL CENTANG]` (posisi tanda di PDF),
  hitung-kanan setuju **267 (83%)**, mengikuti posisi judul kolom **25**. Sel bergeser ke dua arah (sel kosong berlebih
  / kurang; uraian jabatan 177 memakan dua sel). **Tidak dipasang** — sekitar 1 dari 6 baris akan berlabel salah.
- **Tabel dan bloknya terpisah.** 216 dari 316 potongan tabel bertanda (68%) tidak memuat blok centangnya — blok ada di
  potongan lain (blok ditempel sesudah teks halaman, pemotong memisahkannya). Pemeriksa label server
  (`periksaTabelCentang`) dengan blok 177 apa adanya menurunkan kelima jawaban; live hanya 1 dari 5 yang turun → dugaan
  kuat blok 177 tidak ikut terambil di 4 putaran (konteks tidak disimpan, jadi belum terbukti langsung).
- **177: catatan TIDAK PASTI keliru.** `hitungCentangTeks` tidak menghitung "Ö" → "di teks OCR 0". Satu-satunya dokumen.

## Keputusan Owner (5 Nov)

- Data dirapikan **saat unggah**, bukan ditambal saat menjawab — satu sumber kebenaran, ukuran tidak berubah-ubah.
- **Tanpa LLM:** posisi tanda di PDF sudah pasti; aturan memberi hasil yang sama setiap kali, bisa berkata "tidak pasti",
  dan gratis. Bentuk yang tak dikenal → ditandai tidak pasti, bukan ditebak.
- 221 Kepbup dulu **dipecah AI coding** dari buku 1.008 halaman (changelog 17 Sep; isi tidak diubah, skrip pemecah di
  luar git kini hilang) karena `rag-process` beranggaran 110 detik. Dunia nyata = dokumen mentah → **unggah dokumen
  besar otomatis masuk sekarang**, sebelum 5.0.0. Uji pamungkas: buku asli diunggah utuh, lalu K1/K2.
