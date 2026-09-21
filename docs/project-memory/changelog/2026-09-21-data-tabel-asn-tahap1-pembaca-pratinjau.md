# Data Tabel Rekonsiliasi ASN — Tahap 1: Pembaca Excel & Pratinjau (Item 92)

**Tanggal:** 21 September 2026
**Roadmap:** Item 92 ([`ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md`](../../roadmap/ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md))
**Status:** ✅ Tahap 1 selesai — uji 53 berkas lulus semua; terbukti Owner di `npm run desktop` (RSUD, DPRD).

## Yang dibangun

| Berkas | Isi |
|---|---|
| `frontend/src/core/runtime/services/dataTabelAsn.js` (baru) | Pengenal struktur **murni** (tanpa impor pustaka): sheet → bentuk baku per orang (nama, NIP, L/P, status, pendidikan CPNS/akhir, tahun lulus, jabatan, pangkat, PIM, pelatihan, nilai IPA, **baris asal**), pemetaan kolom + huruf kolom Excel, baris dilewati + alasan, **kejanggalan**. Adaptor `dariSheetJS` (pustaka diberikan pemanggil). |
| `frontend/src/core/runtime/services/bacaExcelAsn.js` (baru) | Satu-satunya tempat SheetJS dimuat, lewat `import()` (±500 KB hanya saat Excel dibuka). Dikecualikan dari obfuscator. |
| `frontend/src/components/research/PratinjauDataTabel.jsx` (baru) | Kartu per sheet: kelompok, jumlah orang, status, "⚠ N catatan" di kepala kartu, JUMLAH Excel vs terbaca, kejanggalan, pemetaan kolom (tak dikenali dicoret), tabel semua orang (NIP/jabatan kosong kuning). |
| `ResearchApp.jsx` | "Upload Dokumen" menerima `.xlsx`/`.xls` → **pratinjau, bukan RAG**: dibaca di perangkat, tanpa kunci, $0, **tidak disimpan & tidak dikirim**. Satu Excel setiap kali. |
| `package.json` / lock | `xlsx` 0.18.5 (npm) → **0.20.3 dari cdn.sheetjs.com** (lihat di bawah). |

## Pustaka: SheetJS 0.20.3, bukan 0.18.5

0.18.5 (npm, sebelumnya terpasang tetapi tidak dipakai aplikasi) punya CVE-2023-30533 (prototype pollution) dan
CVE-2024-22363 (ReDoS) — keduanya terpicu saat **membaca berkas buatan**, dan berkas ini datang dari luar (OPD).
Versi yang diperbaiki hanya ada di CDN resmi. Keputusan Owner: pilihan 1. Hanya **kode** yang diunduh (sekali,
saat `npm install`, `sha512` tercatat di lock); berkas dibaca di perangkat, tidak ada data ke SheetJS. `npm ls xlsx`
= satu versi; lock lebih ramping 84 baris (8 paket pendamping tidak lagi dibutuhkan). Build Vercel ikut mengunduh
dari CDN itu.

## Uji (`frontend/node_modules/.uji-rag/uji-data-tabel-asn.mjs`, di luar git) — SEMUA LULUS

- 53/53 berkas, 166 sheet (136 bersih, 11 perlu cek, 19 kosong), **0 gagal**, 2.312 orang.
- Baris JUMLAH L/P terbaca di 49 sheet; beda total hanya **Air Gading** & **Tanjung Agung** (salah hitung di Excel
  pengirim); tidak ada beda palsu.
- Total kunci & ringkasan Owner: RSUD 559, Satpol PP 272, Disdik 103, Bapenda 100, Muara Jaya 22.
- DPRD JFT **47** (nomor sel gabungan dua baris tidak dihitung ganda), NIP dari baris bawah nama 46/47, pendidikan
  47/47, tahun lulus 46/47.
- Kunci RSUD: struktural 14; belum PIM 14; belum pelatihan teknis struktural 1, **pelaksana 131, JFT 155**; blok
  tanda tangan tidak masuk pelatihan; 154 JFT jabatan kosong dilaporkan; NIP 18 digit terpisah dari nama.
- Uji diulang sesudah ganti pustaka ke 0.20.3: hasil identik.

## Koreksi kunci: 130/154 → 131/155

Kunci yang diberikan ke Owner sebelum Tahap 1 menghitung **blok tanda tangan** ("Baturaja, 29 April 2026",
"an. DIREKTUR", nama & NIP Kabag TU) sebagai pelatihan orang terakhir di sheet PELAKSANA (no. 134) dan JFT
(no. 415). Modul yang benar; roadmap dibetulkan.

## Aturan yang ditambah selama Tahap 1 (masing-masing karena satu berkas nyata)

- Baris kaki (tanda tangan) dinilai **hanya di sel asli di luar kolom pelatihan** — nama pelatihan DPRD memuat
  tempat & tanggal ("…Jakarta, 28 Agustus 2023") dan dulu menghentikan pembacaan di orang ke-14.
- Baris bawah milik orang yang sama bila nomornya kosong **atau salinan sel gabungan** → NIP, pendidikan, tahun
  diambil dari sana (DPRD).
- Sel JUMLAH digabung melintasi kolom L & P = satu total (Sosoh Buay Rayap, INSPEKTORAT, SETDA…) — dulu terbaca
  L12+P12=24 untuk 12 orang.
- Total cocok tetapi pembagian L/P tidak → catatan ringan `jumlah_lp_beda` (tidak mengubah status BERSIH, tetapi
  tampil di kepala kartu — tanpa itu Owner melihat BERSIH dan tidak membuka kartunya).
- "KUALIFIKASI PENDIDIKAN / PENDIDIKAN / TAHUN" → pendidikan akhir + bidang baru **tahun lulus** (kolom E & F DPRD
  tampil dicoret di tangkapan layar Owner — pratinjau yang membuat ini ketahuan).

## Kejanggalan baru yang tampil di pratinjau (bahan rekonsiliasi)

- L dan P sama-sama terisi: RSUD JFT baris 7, DPRD JFT baris 110 (menjelaskan tanda per orang P24 vs JUMLAH P25).
- Pembagian L/P tak sejalan dengan JUMLAH: RSUD Pelaksana (L62 P72 vs L61 P73), DPRD JFT, Bappeda.
- NIP ganda: RSUD JFT 2, RSUD Pelaksana 1, dan 4 NIP muncul di lebih dari satu sheet RSUD.

## Catatan kerja

Perbaikan pertama untuk kolom F tidak bekerja: `\b` pada aturannya tertulis sebagai **karakter backspace** saat
disunting lewat heredoc Bash — build & uji tetap lulus, hanya angka 0/47 yang membuka kedoknya. Diperbaiki; lima
berkas yang berubah dipindai, tidak ada karakter kendali lain.

## Keputusan terkait (belum dikerjakan)

NIP untuk Tahap 3: **tidak disamarkan sebagian** (merusak ketepatan). Usulan: model tidak pernah melihat NIP — alat
mengirim penanda `[P-0231]`, kode menukarnya dengan NIP asli dari database sesudah model menjawab. Privasi terjaga
(NIP memuat tanggal lahir, TMT, jenis kelamin) dan ketepatan lebih baik (NIP ditulis kode, bukan diketik ulang model).
