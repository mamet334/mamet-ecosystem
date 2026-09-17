# Buku Kepbup Dipecah per Jabatan + Unggah Banyak Berkas Sekaligus (Item 88 Keputusan 3, sedang berjalan)

**Tanggal:** 17 September 2026
**Roadmap:** Item 88 §7 keputusan 3 ([`ROADMAP-TABEL-CENTANG-PDF.md`](../../roadmap/ROADMAP-TABEL-CENTANG-PDF.md)), Item 89 ([`ROADMAP-KONTEKS-POTONGAN-RAG.md`](../../roadmap/ROADMAP-KONTEKS-POTONGAN-RAG.md))
**Status:** unggah bertahap berjalan — 42/221 jabatan masuk (001–040, 196, 197), semua pemeriksaan bersih. `rag-process` + `agent-process` sudah di-deploy Owner; frontend menunggu push.

## Keputusan Owner

1. Unggah buku Kepbup penuh (keputusan 3 Item 88).
2. **Dipecah per jabatan** (bukan 2–4 bagian), dengan **fitur unggah banyak berkas** di Research App — bukan 221× unggah manual.
3. Unggah **bertahap** (5 → 36 → …), diperiksa di database tiap tahap.

## Kenapa tidak satu berkas

`rag-process` punya anggaran 110 detik (di bawah batas 150 detik Supabase). Unggahan terbesar yang pernah berhasil:
827 potongan / 53,3 detik (±15,5 potongan/detik). Buku penuh ±2.557 potongan ≈ ±165 detik → pasti "Pecah dokumen",
sesudah biaya OCR terpakai.

## 1. Pecah PDF per jabatan (lokal, $0)

Skrip `frontend/node_modules/.uji-rag/pecah-kepbup-per-jabatan.mjs` (di luar git; `pdf-lib` + pengekstrak aplikasi):
- Awal jabatan = baris "Nama Jabatan" (koordinat pdf.js; "N" + "ama Jabatan" terpecah ditangani) → 221 jabatan + berkas
  `000 - Pembuka Keputusan` (hal. 1–3).
- **Dua identitas di bawah halaman** (hal. 893 Camat, 897 Sekretaris Camat — sesudah akhir jabatan sebelumnya; pdf.js
  membaca identitas 897 *paling atas*, jadi hanya terdeteksi lewat koordinat). Halaman dibelah dengan
  MediaBox/CropBox: atas → jabatan sebelumnya, bawah → jabatan baru. **Terbukti** pdf.js hanya membaca area terpotong;
  sesudah unggah terbukti juga untuk OCR (196 tanpa isi BPBD, pangkat Camat "Penata Tingkat I (III/d)" dari atas hal.
  897 masuk berkas Camat, 197 berpangkat sendiri "Penata (III/c)").
- Nama & urusan dibaca dari **teks berkas hasil pecahan sendiri** (nama terlipat 111/654, urusan tiga baris 086,
  hal. 768–791 tanpa "Kode Jabatan").
- **Kontrol:** setiap halaman asli terpakai tepat sekali (belahan sepasang), 0 nama ganda, semua jabatan bernama &
  berurusan, total halaman berkas 1.010 (= 1.008 + 2 belahan). Hasil: 222 berkas, 18 MB, `Downloads\Kepbup-per-jabatan\`.

## 2. Unggah banyak berkas (`frontend/src/components/research/ResearchApp.jsx`)

- `<input multiple>`; semua berkas dibaca dulu (pdf.js, gratis), lalu **satu** konfirmasi OCR (total halaman, biaya,
  menit; konfirmasi massal bila >100 halaman) dan **satu** konfirmasi biaya embedding.
- **Judul yang sudah ada di server dilewati** (bukan daftar di layar yang bisa basi).
- Berurutan: OCR → `rag-process`; satu gagal tidak menghentikan yang lain; berhenti bila kunci ditolak / saldo habis.
- **Tanpa kunci OpenRouter → dibatalkan sebelum membaca berkas** (uji: dua berkas gagal dengan pesan sama dan tawaran OCR
  terlewat diam-diam).
- Ringkasan akhir berhasil/dilewati/gagal/halaman OCR dilewati (juga di konsol), ditunda 300 ms agar layar diperbarui.
- Satu berkas = alur yang sama seperti sebelumnya.

## 3. Identitas dari baris tabel OCR (`agent-process/lib/konteks_potongan.ts`)

Unggah uji 196/197: baris konteks hanya `Nama Jabatan: Camat` — identitas hasil OCR berbentuk
`| Urusan Pemerintah | | : | Kecamatan Baturaja Timur | |` (tiga sel), tidak terbaca sebagai teks tunggal. Tanpa urusan
13 Camat tak terbedakan; halaman identitas yang di-OCR bisa kehilangan nama jabatan juga.
- `barisKunciNilai`: baris tabel yang sel pertamanya Nama Jabatan / Urusan Pemerintah / Kelompok Jabatan / Kode Jabatan →
  "Kunci : nilai"; jarak urusan 6 → 8 baris (pemisah tabel & penanda halaman ikut terhitung).
- Uji Node 4/4 (bentuk OCR, nama dalam tabel, bentuk pdf.js tetap, tabel biasa berkolom "Nama" bukan identitas);
  regresi pemotong tetap (0 kalimat hilang; HCDP & Operator Handbook identik); bundel kedua fungsi lolos.

## Bukti live

| Tahap | Berkas | Hasil |
|---|---|---|
| Uji | 001, 196, 197 | 3 berhasil; 196 tanpa isi BPBD; sesudah perbaikan identitas tabel: konteks `Nama Jabatan: Camat · Urusan Pemerintah: Kecamatan Baturaja Timur › III. PERSYARATAN JABATAN` |
| 1 | 000–004 | 3 berhasil, 001 dilewati, **000 gagal** (hal. 1–3 PDF hasil pindaian, tanpa lapisan teks) |
| 2 | 005–040 | 36 berhasil |

Database sesudah tahap 2: **42 dokumen** (001–040 tanpa nomor hilang, 196, 197), 785 potongan; tanpa potongan 0,
tanpa konteks 0, **identitas bercampur 0**, tanpa urusan 0, tanpa tabel OCR 0, tanpa blok `[TABEL CENTANG]` 0.

`Warning: TT: undefined function: 32` di konsol = pdf.js memperbaiki program hinting font TrueType di PDF; teks tidak
terpengaruh.

## Batas yang disadari

- `000 - Pembuka Keputusan` (badan Keputusan Bupati, hasil pindaian) tidak terunggah — OCR aplikasi hanya untuk halaman
  bertabel yang punya teks.
- Satu penggalan kata ("…Jabatan Pemerintahan.") dari baris di atas batas belah hal. 897 ikut ke identitas 197.
- Research App membaca kunci lewat `kernel` modul; sesudah HMR berulang kunci terbaca kosong — pulih dengan Ctrl+R.
- Berkas uji lama `UJI-Kepbup-Sekretaris-DPRD-hal4-9.pdf` masih ada (isi ganda dengan 001) — dihapus sesudah buku penuh.
