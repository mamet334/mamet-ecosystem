# 20 Oktober 2026 — tema aplikasi Tahap B: Settings › Tampilan, dua tema gelap, per akun (Item 128)

Item 128 ([`ROADMAP-TEMA-APLIKASI.md`](../../roadmap/ROADMAP-TEMA-APLIKASI.md)), Tahap B. Keputusan Owner 20 Okt
"sesuai usul": **T1** nama tema berbahasa Indonesia · **T2** "Ikuti sistem" saat Windows terang → Gelap netral (sampai
tema Terang ada) · **T3** bawaan Ruangan kayu.

## Hasil

| Bagian | Isi |
|---|---|
| **Settings › Tampilan** (`BagianTampilan.jsx`, tab ke-10) | Tema: Ruangan kayu · Gelap netral · Ikuti sistem — tiap pilihan dengan **pratinjau berwarna sungguhan** (kotaknya diberi `data-tema`); saklar **Latar ruangan**; hasil simpan diberitahukan (berhasil / gagal) |
| **Daftar tema** | `public/metadata/themes.json` (MUS §21) — dimuat `MetadataService`; kegagalannya **tidak** menghentikan boot (jatuh ke tema bawaan). Menambah tema = menambah satu entri |
| **Gelap netral** | 65 variabel abu-abu murni (selisih R/G/B ≤ 4), galat tetap merah, menu tanpa cahaya; bawaan latar ruangan: mati |
| **Logika** (`tema.js`, murni) | pilihan tema, "Ikuti sistem", latar ruangan (pilihan pengguna mengalahkan bawaan tema), aturan CSS `html[data-tema=…]` (menang atas `:root`) + `[data-tema=…]` (pratinjau) |
| **Penerapan** (`TemaService.js`) | dipasang di **fase 1 boot**, tepat sesudah metadata — sebelum tampilan dipasang, jadi **tanpa kedipan**; salinan lokal `mamet_tampilan`; sesudah masuk, `user_metadata.tampilan` menjadi sumber kebenaran (**per akun**, pola batas biaya harian, tanpa tabel baru); Windows berganti gelap/terang → tema "Ikuti sistem" ikut |
| **Latar ruangan mati** | `html[data-latar="mati"] .latar-ruangan { display: none }` — cukup CSS |
| **Menu teks** | warna `MenuTeks` dulu ditulis di komponen → kini variabel tema `--warna-menu-*`; nilai Ruangan kayu **sama persis** (diukur di peramban) |

Ikon tab memakai `visibility` yang sudah ada di subset font — **tanpa mengunduh** ikon baru.

## Bukti

- Diterapkan **sementara di peramban, tanpa menyimpan ke akun**: Gelap netral → latar `rgb(18,18,18)`, teks
  `rgb(214,214,214)`, dinding tersembunyi; tombol MENU di Ruangan kayu tetap `rgb(11,8,6)` / `rgb(58,33,19)` /
  `rgb(255,248,236)`, di Gelap netral abu netral. Tab Tampilan tampil dengan pratinjau ketiga pilihan.
- Build produksi tanpa peringatan; `metadata/themes.json` ikut terbawa.
- **Belum dibuktikan:** menyimpan ke akun lalu tema ikut di web — itu mengubah setelan akun Owner, jadi diserahkan
  ke Owner untuk dicoba sendiri.

## Uji

| Uji | Yang dijaga |
|---|---|
| `uji-tema-tahap-b.mjs` v1 (baru) | metadata sah + T1–T3; tiap tema mendefinisikan variabel yang sama; kontras **setiap** tema di latar polos, di atas dinding, dan di dalam kartu kaca; Gelap netral netral; logika pilihan; terpasang dari boot sampai akun; ikon ada di subset; 83 kelas komponen dibuat Tailwind |
| `uji-menu-teks.mjs` v3 | warna menu = variabel tema; kontras menu diukur untuk setiap tema |
| `uji-settings-bertab.mjs` v2 | sepuluh bagian — bagian bisa berupa `<section>` atau komponen `<Bagian… />` |
| `uji-ciri-tampilan.mjs` v5 | penghitung `tokenMaterial` **dipensiunkan** (token palet kini mekanisme tema); diganti `warnaTetap` = warna yang **tak** ikut tema (hex di kelas, putih/hitam mentah): 154 → **150** sesudah MenuTeks; berkas ikon Material 8 → 9 (BagianTampilan, pecahan Settings) |
| `uji/palet-tema.mjs` | `menu-*` & `kilau` bukan token Tailwind |

Dua belas mutasi dibuktikan menggigit. Suite 112/112.

## Belum ikut tema

150 warna tetap (panel kanan Home `bg-[#0a0a0a]/90`, putih/hitam mentah di beberapa layar, dll.) — dibereskan bersama
tema Terang (Tahap D). Warna simpul graf Home sengaja tidak ikut tema (konstitusi 23).
