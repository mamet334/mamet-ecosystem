# 20 Oktober 2026 — tema aplikasi Tahap A: token palet menjadi variabel CSS (Item 128)

Item 128 ([`ROADMAP-TEMA-APLIKASI.md`](../../roadmap/ROADMAP-TEMA-APLIKASI.md)), Tahap A — fondasi. Janji tahap ini
satu: **tampilan Ruangan kayu tidak berubah sedikit pun**.

## Hasil

| Sebelum | Sesudah |
|---|---|
| nilai palet ditulis sebagai hex di `tailwind.config.js`, dibakukan saat build | `tailwind.config.js` hanya menunjuk variabel: `rgb(var(--warna-<nama>) / <alpha-value>)` |
| — | nilai ada di **`frontend/src/tema/ruangan-kayu.css`** (48 token + 11 slate, saluran "R G B"), tema bawaan `:root` dan bisa dipilih `[data-tema="ruangan-kayu"]` |
| kelas global `index.css` (body, `.glass-panel`, `.rim-light`, `.input-etched`, `.btn-glow`, bilah gulir) menulis hex/rgba tetap | semuanya menunjuk variabel tema; krem kilau tepi kaca & bilah gulir menjadi `--warna-kilau` |

Bentuk `rgb(var(--…) / <alpha-value>)` menjaga pengubah opasitas yang dipakai di mana-mana (`bg-primary/30`,
`border-primary/35`). Tema lain (Tahap B: Gelap netral) cukup memberi nilai lain untuk variabel yang sama — komponen
tidak disentuh.

## Bukti tampilan tidak berubah

- **Di peramban:** warna terhitung **2.608 elemen** (semua layar terpasang, termasuk yang tersembunyi) direkam sebelum
  perubahan dan dibandingkan sesudahnya. Selisih hanya pada elemen yang **keadaannya** berbeda karena muat ulang — tab
  Settings yang aktif dan item navigasi yang aktif — yang bertukar di antara dua warna palet yang sudah ada.
- **Build produksi** berhasil tanpa peringatan; variabel tema ter-inline di CSS, tak ada `@import` tersisa.

## Uji

| Uji | Yang dijaga |
|---|---|
| `uji-tema-tahap-a.mjs` v1 (baru) | nilai tema = `uji/patokan-palet-ruangan-kayu.json` (direkam tepat sebelum diubah); config tanpa hex & menunjuk variabel bernama sama; 14 nilai kelas global = nilai lama; 144 kelas warna token/slate dari komponen dikompilasi Tailwind — 36 variabel dirujuk, semuanya terdefinisi; contoh berpengubah opasitas menghasilkan nilai yang persis sama |
| `uji/palet-tema.mjs` (pembaca bersama, bukan uji) | satu cara membaca palet dari berkas tema untuk semua uji warna |
| `uji-palet-lamplogin.mjs` v4 · `uji-latar-ruangan.mjs` v5 | membaca palet dari berkas tema; hasil ukur tak berubah (teks di kartu jawaban 11,07:1) |

Delapan mutasi dibuktikan menggigit (nilai bergeser satu angka, variabel hilang, token kembali hex, nama variabel
salah, opasitas kaca berubah, kelas global kembali warna tetap, tema tak diimpor, fokus input menunjuk token lain).
Suite 111/111.
