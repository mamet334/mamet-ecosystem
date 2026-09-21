# ROADMAP: DATA TABEL REKONSILIASI ASN — HITUNG & SARING OLEH KODE, BUKAN OLEH RAG

**Tipe Dokumen:** Engineering Roadmap
**Area:** Jalur unggah baru (browser) + penyimpanan baris data (Supabase) + alat saring/hitung untuk AI (`agent-process`)
**Status:** 📝 **Tahap 1 selesai 2026-09-21** (pembaca + pratinjau Excel, uji 53 berkas lulus, terbukti Owner) — [log](../project-memory/changelog/2026-09-21-data-tabel-asn-tahap1-pembaca-pratinjau.md); Tahap 2 menunggu aba-aba Owner
**Tanggal:** 2026-09-21
**Roadmap Index:** Item 92

---

## 1. Masalah

Owner mengelola berkas **rekonsiliasi / rencana pengembangan kompetensi ASN** kiriman ±40 OPD
(`D:\REKONSIALISASI 2026\`: 54 xlsx, 10 pdf, 1 doc, 17 txt ringkasan buatan Owner). Pertanyaan yang dibutuhkan:

- "Berapa pejabat yang menduduki jabatan struktural?" (satu OPD — RSUD: **14**)
- "Siapa saja yang belum mengikuti pelatihan …?" (RSUD: PIM → **14 dari 14** struktural; teknis → 1 struktural,
  131 pelaksana, 155 JFT — koreksi 2026-09-21: kunci awal 130/154 salah, blok tanda tangan terhitung pelatihan)
- dan wajar menyusul: "berapa pejabat struktural **se-kabupaten** yang belum PIM?" (lintas ~40 OPD)

**RAG tidak bisa menjawab ini dengan benar — di ws-lite maupun ws-assistant** (keduanya memakai mesin pencarian
yang sama):

1. `.xlsx` belum diterima pengunggah (`documentTextExtractor.js`: txt, md, csv, json, html, xml, pdf, docx).
2. RAG mengambil 8–10 potongan (±6.000–8.000 huruf); berkas RSUD saja ±2.000 baris / 559 orang. "Berapa" butuh
   **semua** baris; "siapa yang belum" butuh **sel kosong** — tak punya kata untuk dicari vektor maupun kata kunci;
   daftar 154 nama tak muat di 8 potongan.
3. Satu orang bisa menempati belasan baris (satu per pelatihan), sel gabungan (JFT RSUD: 1.847), blok tanda
   tangan di dalam kolom PIM.

**Ringkasan txt bukan jalan keluar:** empat total di dalamnya dicek dan benar, tetapi ringkasan membekukan angka
hitungan AI saat dibuat, tak memuat angka lintas OPD, dan basi saat ada revisi.

## 2. Keputusan & Prinsip (Owner 2026-09-21)

1. **Jalur baru "data tabel"**, terpisah dari RAG. Bagian depan dipakai bersama (membaca berkas, OCR yang sudah
   ada); bagian belakang **tanpa vektor** — baris data di database.
2. **Satu keluarga dokumen dulu:** data ASN dengan bentuk baku yang jelas. Bukan "baca spreadsheet apa saja" —
   bentuk tujuan yang jelas itulah yang membuat hasilnya bisa dipercaya. Keluarga lain (mis. anggaran) = bentuk
   tujuan kedua dengan aturannya sendiri.
3. **Kode yang menghitung dan menyaring; AI memahami pertanyaan & merangkai jawaban** dari hasil kode, dengan
   sumber berkas/sheet/baris. Sejalan dengan "label bukan janji": angka bisa dibuktikan dari baris asal.
4. **Pratinjau & konfirmasi Owner sebelum disimpan — wajib**, bukan pelengkap (pembaca otomatis tak pernah langsung
   sempurna: versi pertama pengukuran membaca DPRD 94 orang, benarnya 47).
5. **Aturan dulu, AI hanya untuk yang tak dikenali aturan, dan hanya melihat judul kolom** (bukan nama/NIP).
   Koreksi Owner atas pemetaan disimpan dan dipakai ulang.
6. **Rumahnya ws-assistant** (data pribadi ASN, pekerjaan kantor Owner). Mesinnya bisa dipakai ws-lite nanti.
7. Dokumen naratif (surat edaran, pengantar) tetap di RAG.

## 3. Bukti Pengukuran (2026-09-21, di luar aplikasi, $0)

Pembaca percobaan `frontend/node_modules/.uji-rag/ukur-data-tabel.cjs` (di luar git; `xlsx` yang sudah terpasang),
pembanding `cek-oracle.cjs`, hasil `hasil-ukur-data-tabel-2026-09-21.json`. Folder Owner tidak diubah.

| | Hasil (pembaca versi 3) |
|---|---|
| Berkas xlsx | 53/53 terbaca |
| Sheet | 166: **138 bersih** (77 tanpa catatan + 61 catatan kecil), 9 perlu dicek, 19 kosong, **0 gagal** |
| Orang | 2.312 baris orang |
| Pembanding independen | **48/48** sheet ber-JUMLAH orang cocok (8 baris JUMLAH lain ternyata total nilai IPA — bukan pembanding); **5/5** total kunci & ringkasan Owner cocok: RSUD 559, Satpol PP 272, Disdik 103, Bapenda 100, Muara Jaya 22 |

Perbaikan pembaca selama pengukuran (pelajaran untuk Tahap 1): judul bertingkat 3 baris (Baturaja Timur, DPRD);
"NAMA/NIP" digabung di atas dua kolom (Bapenda); NIP di baris bawah nama (DPRD); nomor urut sel gabungan dua baris
dihitung ganda (DPRD 94 → 47; alamat sel harus digeser dari awal `!ref`); sheet kosong ≠ gagal; baris templat
bernomor tanpa nama (Muara Jaya "1.", "2.", "3" → 0 orang — ringkasan Owner benar, hitungan polos salah).

**Kejanggalan di data kiriman OPD** (bahan rekonsiliasi — bukan salah pembaca):
- JUMLAH salah hitung: Kel. Air Gading L2+P5=7, orangnya 6 (L2 P4); Kel. Tanjung Agung L2+P3=5, orangnya 3.
- Jabatan kosong: 154 JFT RSUD, 8 DPPKB, 8 berkas REKON Bagian Umum, dll.
- Nomor urut ganda: Perikanan, PU PR, PBJ, Kemelak. NIP sama dua kali dalam satu berkas: RSUD 4, Satpol PP 1.
- 395 orang tanpa NIP terbaca (sebagian besar PPPK paruh waktu).

**Versi ganda antar berkas: 137 orang tercatat dua kali** — INSPEKTORAT senin/selasa (60), Muara Jaya kamis/`muara
jaya.xlsx` (20), **DPPKB / `REKON --- RENCANA PENGEMBANGAN KOMPETENSI ASN.xlsx` (18 — tak terlihat dari nama
berkas)**, PBJ lama/"yg baru" (18), DP3A senin/rabu (15). Tanpa pengenalan versi, total se-kabupaten kelebihan 137.

Belum diukur: 10 PDF (sebagian pindaian CamScanner) dan 1 `.doc`.

## 4. Rancangan

```
[Unggah xlsx/csv]  (ws-assistant)
      │  baca di browser (SheetJS), $0
      ▼
Pengenal struktur (aturan): baris judul bertingkat, sel gabungan, orang multi-baris, templat kosong, tanda tangan,
      │  NIP 18 digit di mana pun di baris/baris bawah
      │  judul tak dikenal → AI (hanya teks judul) menebak bidang
      ▼
PRATINJAU OWNER: pemetaan kolom per sheet, jumlah orang vs baris JUMLAH, kejanggalan, dugaan versi (NIP sama)
      │  setuju / betulkan (koreksi disimpan)
      ▼
Tabel database: satu baris per orang, bentuk baku + asal (berkas, sheet, baris) + versi
      ▼
Chat: AI → alat `data_tabel_saring` / `data_tabel_hitung` (dijalankan kode/SQL) → hasil + sumber → AI merangkai
```

**Bentuk baku per orang (usulan):** `opd`, `berkas`, `sheet`, `baris_asal`, `kelompok` (struktural / jft /
pelaksana / pppk / paruh_waktu), `nama`, `nip`, `jenis_kelamin`, `status`, `pendidikan_cpns`, `pendidikan_akhir`,
`jabatan`, `pim` (II/III/IV), `pelatihan` (daftar), `nilai_ipa`, `versi`/`digantikan_oleh`. Kolom asal yang tak
terpetakan disimpan mentah (tidak dibuang diam-diam).

**Keamanan:** RLS per pengguna seperti dokumen RAG; alat hanya bisa menyaring data milik penanya.

## 5. Tahapan & Kriteria Selesai

### Tahap 1 — Pembaca & pratinjau Excel (browser, tanpa menyimpan)
- [x] Pengenal struktur dari pembaca percobaan dipindah ke modul murni (bisa diuji di Node), `.xlsx`/`.csv` diterima. ✅ `dataTabelAsn.js` + `bacaExcelAsn.js` (SheetJS 0.20.3 dari CDN resmi — 0.18.5 npm ber-CVE). **Penyimpangan:** hanya `.xlsx`/`.xls`; `.csv` tetap ke RAG seperti sebelumnya (belum ada contoh CSV rekonsiliasi).
- [x] Layar pratinjau: pemetaan kolom, jumlah orang vs JUMLAH, daftar kejanggalan, baris yang dilewati & alasannya. ✅ `PratinjauDataTabel.jsx` di Research App (huruf kolom Excel, "⚠ N catatan" di kepala kartu, tabel semua orang).
- [x] **Kriteria:** 53 berkas ukur — 0 gagal; 48/48 JUMLAH & 5/5 total kunci tetap cocok; kejanggalan §3 muncul. ✅ semua lulus + DPRD 47 / pendidikan 47/47; kejanggalan baru dari pratinjau: L & P terisi bersamaan, pembagian L/P ≠ JUMLAH, NIP ganda RSUD.

### Tahap 2 — Simpan + versi
- [ ] Tabel + RLS; simpan hanya sesudah konfirmasi; koreksi pemetaan disimpan & dipakai ulang.
- [ ] Dugaan versi dari NIP sama ("60 NIP sama dengan INSPEKTORAT senin — ganti yang lama?").
- [ ] **Kriteria:** 5 pasangan versi §3 terdeteksi (termasuk DPPKB/REKON); total unik = 2.312 − 137 ganda − duplikat dalam berkas.

### Tahap 3 — Alat saring & hitung untuk AI
- [ ] Alat server `data_tabel_hitung` / `data_tabel_saring` (filter: OPD, kelompok, kolom kosong/terisi, teks di
      pelatihan, pendidikan, jabatan); hasil membawa berkas/sheet/baris.
- [ ] Label: angka dari alat = VERIFIED dengan sumber; tanpa alat = tidak boleh mengarang angka.
- [ ] **Kriteria (kunci):** RSUD struktural **14**; belum PIM **14**; belum teknis struktural **1** (Kabid Bina
      Pelayanan Medik), pelaksana **131**, JFT **155** (kunci awal 130/154 salah — blok tanda tangan di baris orang terakhir terhitung pelatihan; ditemukan modul Tahap 1); lintas OPD tanpa hitung ganda versi.

### Tahap 4 — Daftar kejanggalan per OPD
- [ ] Laporan per OPD: JUMLAH ≠ orang, jabatan kosong, nomor/NIP ganda, tanpa NIP — siap dikirim balik ke OPD.

### Tahap 5 — PDF & pindaian
- [ ] Lewat OCR tabel yang sudah ada (mistral-ocr) → pengenal struktur yang sama; `.doc` → minta simpan ulang.

## 6. Risiko & Pertanyaan Terbuka

- **Privasi — usulan 2026-09-21 (belum diputuskan):** NIP **tidak** disamarkan sebagian; model tidak pernah melihat NIP — alat mengirim penanda `[P-0231]`, kode menukarnya dengan NIP asli sesudah model menjawab (privasi + ketepatan). Nama: dikirim atau ikut penanda, keputusan sebelum Tahap 3. Catatan lama: baris yang relevan untuk sebuah jawaban (nama, NIP) ikut terkirim
  ke penyedia model saat bertanya. Alternatif: alat mengembalikan hitungan + daftar nama, NIP disamarkan kecuali diminta.
- **Nama pelatihan tidak baku** ("PIM IV", "Diklat PIM IV", "Diklat Kepemimpinan Tingkat IV", tanda "√"/"V"):
  aturan normalisasi PIM perlu diuji di 53 berkas; pelatihan teknis dicari sebagai teks, bukan disamakan.
- **Kolom baru dari OPD** yang belum pernah terlihat → selalu lewat pratinjau, tidak ditebak diam-diam.
- **Versi tanpa NIP** (PPPK paruh waktu) → dugaan versi dari nama + OPD, konfirmasi Owner.
- **Ukuran:** ±2.300 orang × beberapa putaran rekonsiliasi — kecil bagi Postgres; tidak perlu embedding.
