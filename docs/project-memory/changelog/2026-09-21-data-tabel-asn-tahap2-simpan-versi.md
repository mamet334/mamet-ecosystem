# Data Tabel Rekonsiliasi ASN — Tahap 2: Simpan & Versi (Item 92)

**Tanggal:** 21 September 2026
**Roadmap:** Item 92 ([`ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md`](../../roadmap/ROADMAP-DATA-TABEL-REKONSILIASI-ASN.md))
**Status:** ✅ Tahap 2 selesai (kecuali koreksi pemetaan kolom — ditunda, lihat bawah); terbukti Owner di `npm run desktop`.

## Database (migrasi `20260921090000_data_tabel_asn.sql`, dijalankan atas izin Owner)

- `asn_berkas`: satu baris per berkas yang dikonfirmasi — OPD, nama berkas, jumlah orang, ringkasan tiap sheet
  (kejanggalan & pemetaan), **`digantikan_oleh`** (null = aktif).
- `asn_pegawai`: satu baris per orang — nama, NIP (`^[0-9]{18}$` atau null), L/P, status, pendidikan CPNS/akhir, tahun
  lulus, jabatan, pangkat, `pim[]`, `pelatihan[]`, nilai IPA, **`baris_asal`**. Tanpa UPDATE (salinan Excel apa adanya;
  perbaikan = unggah revisi).
- `asn_simpan_berkas(p_berkas, p_pegawai, p_gantikan)`: berkas + semua pegawai + tandai versi lama dalam **satu
  transaksi**, `SECURITY INVOKER`, tertutup untuk `anon`.
- RLS kedua tabel milik sendiri (4 & 3 kebijakan); pegawai hanya bisa ditambahkan ke berkas milik sendiri.
- Security advisor sesudah migrasi: tidak ada temuan pada tabel baru. Tiga peringatan fungsi lama
  (`check_daily_quota`, `get_active_knowledge`, `match_memories`) dicek — ketiganya menolak akses lintas akun lewat
  `auth.uid()`; bukan temuan baru.

## Aplikasi

| Berkas | Isi |
|---|---|
| `dataTabelAsn.js` | `opdDariNamaBerkas` (usulan nama OPD, bisa dibetulkan), `siapkanSimpan`, `dugaVersi` + `AMBANG_VERSI` (≥3 NIP **dan** ≥30% dari berkas yang lebih kecil; nama berkas sama untuk berkas tanpa NIP). Variasi baru: nomor urut di baris NIP, nama di baris atasnya (DPRD Struktural no. 3) → nomor "dipinjam". |
| `dataTabelAsnDb.js` (baru) | `ambilBerkasAktif` (NIP per halaman 1.000 — batas PostgREST), `simpanBerkasAsn`, `daftarBerkasAsn`, `hapusBerkasAsn`. |
| `PratinjauDataTabel.jsx` | Nama OPD + "Simpan N orang"; bila ada berkas aktif berbagi NIP → **tiga pilihan**: lebih baru (gantikan) / **justru versi lama** (simpan sebagai riwayat) / bukan versi (terpisah). |
| `DaftarDataTabel.jsx` (baru) | "Data Tabel Tersimpan": AKTIF / RIWAYAT ("digantikan oleh …"), "N berkas aktif · M orang dihitung", hapus dengan konfirmasi (hapus pengganti → versi lama aktif lagi, `ON DELETE SET NULL`). |

## Kenapa tiga pilihan, bukan dua

Simulasi menyimpan 53 berkas berurutan: kelima pasangan versi terdeteksi, tetapi **arahnya ikut urutan unggah** —
"EDARAN PBJ.xlsx" (lama) sempat "menggantikan" "PBJ yg baru.xlsx". Mesin tahu dua berkas berbagi NIP, tidak tahu
mana yang lebih baru (nama folder hanya hari). Owner benar-benar mengalaminya: selasa diunggah sebelum senin.

## Uji

- Logika (`frontend/node_modules/.uji-rag/uji-data-tabel-asn-tahap2.mjs`, di luar git) — SEMUA LULUS: tepat 5
  pasangan versi (termasuk DPPKB ↔ "REKON --- …"), PERKIM ↔ susulan (1 NIP kebetulan) tidak dianggap versi, 2.312
  baris siap simpan (NIP sah, nama & baris asal terisi), 48 berkas aktif sesudah semua disimpan. Uji Tahap 1 tetap lulus.
- **Live (database):**

| Berkas | Orang | Status |
|---|---|---|
| RSUD | 559 (557 ber-NIP) | AKTIF |
| INSPEKTORAT (selasa, diunggah dulu) | 60 (59 ber-NIP) | AKTIF |
| INSPEKTORAT (senin) | 60 | RIWAYAT — Owner memilih "berkas ini justru versi lama"; `digantikan_oleh` = selasa |

  Kotak versi: "INSPEKTORAT — INSPEKTORAT.xlsx (59 NIP sama, 100%)". Aktif: **2 berkas, 619 orang** (tanpa hitung
  ganda INSPEKTORAT). 4 NIP berulang di data aktif = NIP ganda **di dalam RSUD** (sudah ditunjukkan pratinjau).
  Isi RSUD di database = kunci Tahap 1: struktural 14 (belum PIM 14, belum pelatihan 1), pelaksana 134 (belum
  pelatihan 131), JFT 411 (belum pelatihan 155, tanpa jabatan 154).

## Bug yang ditemukan Owner & diperbaiki

Pratinjau diberi `key` = nama berkas. `senin\INSPEKTORAT.xlsx` sesudah `selasa\INSPEKTORAT.xlsx` (nama sama) memakai
ulang layar lama **termasuk tulisan "Tersimpan"** — berkas senin tampak tersimpan padahal tidak (database: hanya satu
INSPEKTORAT). Kini setiap unggahan mendapat tanda unik (`_unggahan`); terbukti: unggahan ulang senin menampilkan
tombol Simpan lalu kotak versi.

## Ditunda

**Koreksi pemetaan kolom oleh Owner (disimpan & dipakai ulang):** pratinjau baru *menunjukkan* pemetaan. Semua berkas
uji terpetakan benar oleh aturan, jadi belum ada kebutuhan nyata — dikerjakan saat pertama kali ada berkas yang
kolomnya salah baca.
