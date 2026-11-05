# K1/K2 Uji Ulang sesudah Centang Ditulis saat Unggah — Lulus di Korpus Pecahan

**Tanggal:** 5 November 2026
**Roadmap:** [`ROADMAP-HARDENING.md`](../../roadmap/ROADMAP-HARDENING.md) K1/K2
**Status:** ✅ terukur live (klien uji `k1-3`, tanpa perubahan kode). K1 belum ditutup: uji pamungkas buku utuh (langkah 2–3).

## Yang dilakukan Owner

1. 221 Kepbup pecahan dihapus lalu **diunggah ulang** di `npm run desktop` dengan ekstraktor baru
   ([langkah 1](./2026-11-05-k1-centang-ditulis-saat-unggah.md)). Database: 221 dokumen, semuanya 5 Nov, tak ada yang
   dobel atau tanpa potongan; 190 dokumen (312 potongan) memuat kolom tertulis ("√ Mutlak"); 177 menyimpan
   `Pengalaman Kerja … Ö Mutlak` dan `Diklat Teknis … Ö Penting` dalam satu potongan, tanpa TIDAK PASTI. Log
   `rag-process`: semua kiriman 200. Satu "gagal" di pemberitahuan = `000 - Pembuka Keputusan` (PDF pindaian, ditolak
   sejak 17 Sep; tanpa tabel persyaratan).
2. BUKU-10 ×5, uji penuh 26 soal × 2, lalu HCDP ×2 sesudah dokumen HCDP diunggah ulang.

## Hasil

| Uji | Hasil |
|---|---|
| BUKU-10 ×5 | **5/5 benar** (dulu 4/5 salah): Pengalaman Kerja → Mutlak, Diklat Teknis → Penting, VERIFIED, sumber 177. Penilai: 4 BENAR + 1 PERLU_CEK (kalimat terbalik "yang tercantum sebagai Penting … adalah Diklat Teknis" — nilai sebelum baris tak terbaca `periksaPasangan`; isi benar) |
| BUKU-01..14 (uji penuh) | **28/28 BENAR**, bukti di konteks |
| NEG ×4 | **8/8 JUJUR** → K2 LULUS |
| HCDP-01..08 (uji penuh) | 0 benar — **dokumen HCDP tidak ada lagi di RAG** (3 Nov: `DOKUMEN HCDP 2025-2026.docx`, 87 potongan; kemungkinan ikut terhapus saat Kepbup lama dibersihkan). Model jujur "tidak ditemukan" |
| HCDP ×2 sesudah `.docx` diunggah ulang | 4 BENAR + 12 PERLU_CEK → **16/16 benar** diperiksa mata: nilai yang ditanya tepat; "pengecoh" hanya di deret tahun lain yang disalin dengan label tahunnya (Tahun 3 = 20,0%; Tahun 4 = 35,0%) |

**Gabungan:** pokok **22/22 benar** (44 putaran), tidak_ada 8/8 jujur, label bohong 0, SALAH 0, RAG turun 0.

## Arti

- Akar BUKU-10 tertutup di data, bukan ditambal saat menjawab: tabel sendiri kini memuat kolom yang benar.
- K1/K2 lulus pada korpus Kepbup pecahan. Penutupan K1 tetap menunggu uji pamungkas keputusan Owner: unggah dokumen
  besar otomatis (langkah 2) → buku 1.008 halaman utuh menggantikan 221 pecahan → uji penuh (langkah 3).
- Pelajaran: menghapus dokumen massal sebelum uji bisa ikut membuang dokumen lain — cek daftar dokumen sumber set uji
  (HCDP + Kepbup) sebelum uji penuh.
