# 20 Oktober 2026 — tema aplikasi Tahap D: warna dasar bisa diganti setelan; tema Biru malam & Terang (Item 128)

Item 128 ([`ROADMAP-TEMA-APLIKASI.md`](../../roadmap/ROADMAP-TEMA-APLIKASI.md)), Tahap D — **menutup Item 128**.
Pilihan Owner dari pratinjau: **Terang B (netral)** dan **Biru A (biru malam, gelap)**. Permintaan Owner:

> *"buat warna dasar dari code dibuat bisa berubah-ubah sesuai setelan, agar bila nanti ingin membuat tema lain bisa
> mudah diterapkan tanpa mengubah code source"*

## D1 — warna dasar menjadi variabel (tema gelap tidak berubah)

- **`src/tema/dasar-gelap.css`** (tema bawaan `:root` + `[data-dasar="gelap"]`): putih, hitam, **17 rona × 11 tingkat**
  bawaan Tailwind, dan 7 warna yang dulu ditulis langsung di komponen — nilainya **apa adanya**.
- **`tailwind.config.js`**: `white`, `black`, 17 rona, dan `di-warna` menunjuk variabel. Komponen yang memakai
  `text-white` / `bg-emerald-600` / … tidak perlu diubah.
- Hex di komponen → variabel dengan nilai sama: panel kanan Home, status Observability (beserta pendarnya), tautan unduh
  desktop. Kanvas graf Home membaca variabel tema (label, jalur aktif, garis, partikel) dan membacanya ulang saat tema
  berganti.
- **Layar masuk selalu Ruangan kayu:** `App.jsx` membungkus `LampLogin` dengan `data-tema="ruangan-kayu"
  data-dasar="gelap"` — `LampLogin.jsx` tidak disentuh.
- Penghitung `warnaTetap` (uji-ciri-tampilan v6): putih/hitam kini ikut tema, tak dihitung lagi → **150 → 6**. Sisa 6
  sengaja: 5 titik legenda graf (warna makna konstitusi 23) + 1 di `Login.jsx` (kode mati, K6).

## D2 — Biru malam

Entri metadata saja (`dasar: "gelap"`): biru tua, teks utama 13,83:1, teks tebal diturunkan ke 14,92:1 agar tak
setajam batas nyaman; lulus di latar, di atas dinding, di dalam kartu, dan di menu.

## D3 — Terang

- **`src/tema/dasar-terang.css`** (`[data-dasar="terang"]`): putih ↔ hitam bertukar; tingkat rona dibalik ke yang
  terbaca di latar terang (100–200 → 900, **300–600 → 800**, 700–800 → 900, 900/950 → 100/50). Tingkat 700 semula
  dicoba — 14 pasangan gagal untuk rona yang terang secara alami (kuning, amber, hijau); dengan 800 **32 kelas teks
  rona** yang dipakai komponen ≥ 5,40:1.
- Teks putih **di atas latar warna padat** (18 tempat) → token baru **`text-di-warna`** (tetap putih di semua tema);
  di atas latar padat dasar terang ≥ 6,85:1.
- Palet Terang (netral): teks utama 13,00:1. Menu teks hitam di tema Terang — label redup menu memakai opasitas
  (55–70%), dan hanya hitam yang lulus di sana (≥ 4,74:1).
- Tema berdasar terang: **dinding & lampu tak tampil** (teks gelap tak terbaca di atas dinding gelap); Settings
  menjelaskannya, pilihan pengguna tetap tersimpan untuk tema gelap.
- **"Ikuti sistem"** saat Windows terang → **Terang** (T2: "Gelap netral sampai tema Terang ada").

## Tema baru = metadata

Setiap tema di `themes.json` memilih `"dasar": "gelap" | "terang"` dan menulis palet utamanya; warna dasar
mengikuti. Biru malam & Terang tidak disebut di komponen mana pun.

## Bukti

- Peramban: komponen sungguhan dirender dalam tema Terang & Biru malam berdampingan — status hijau/merah tua terbaca,
  tombol hijau tua bertulisan putih.
- **Owner memilih Terang di Settings dan masuk kembali** — setelan akun `tema: terang` terbaca dan langsung terpasang
  (penyimpanan per akun terbukti ujung ke ujung). Tanpa galat konsol.
- Build produksi tanpa peringatan.

## Uji

| Uji | Yang dijaga |
|---|---|
| `uji-tema-tahap-d.mjs` v1 (baru) | dasar gelap = palet Tailwind & nilai lama persis; dasar terang lengkap; config; 221 kelas rona/putih/hitam dikompilasi — 57 variabel ada di kedua dasar; tak ada hex lama; `text-di-warna`; kanvas graf; layar masuk; kontras teks rona & teks di latar padat di Terang; tema baru cukup metadata |
| `uji-tema-tahap-b.mjs` v2 | T2 mengikuti tema terang bila ada; dinding hanya untuk tema berdasar gelap |
| `uji-latar-ruangan.mjs` v7 | lampu & dinding hanya diukur untuk tema berdasar gelap |
| `uji-ciri-tampilan.mjs` v6 | `warnaTetap` = hex di kelas saja; 6 |

Sebelas mutasi dibuktikan menggigit. Suite 114/114.
