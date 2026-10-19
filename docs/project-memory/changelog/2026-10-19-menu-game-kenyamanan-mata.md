# 19 Oktober 2026 — kenyamanan mata: Markdown & kode di chat, latar dinding LampLogin (Item 127, Tahap 3)

Item 127 ([`ROADMAP-TAMPILAN-MENU-GAME.md`](../../roadmap/ROADMAP-TAMPILAN-MENU-GAME.md)), lanjutan palet LampLogin.
Owner menilai palet itu *"sama sih tapi kurang nyaman di mata"*. Dikerjakan dalam dua putaran penilaian, lalu
disetujui.

## Putaran 1 — susunan chat meniru gambar rujukan Owner

Owner menunjuk tangkapan layar aplikasi asisten lain: *"kalau susunannya dibuat seperti di gambar apakah bisa? garis
tepi dibiarkan saja, jangan diredupkan"*. Lalu menambahkan: *"pikirkan juga kalau yang ditampilkan sebuah code"*.

| Bagian | Sebelum | Sesudah |
|---|---|---|
| Jawaban model | teks polos di kotak kaca bergaris — `**`, `\| tabel \|`, `\|---\|` tampil mentah | **Markdown dirender** (`TeksMarkdown.jsx`, `react-markdown` + `remark-gfm` yang sudah terpasang): tebal, daftar, tabel, kode sebaris, tautan; **tanpa kotak**, teks langsung di latar |
| Pesan Owner | gelembung | tetap gelembung bergaris, ditampilkan apa adanya (tidak dirender Markdown) |
| Blok kode | — | kotak kode: baris tidak dipatahkan, digulir mendatar di dalam kotaknya, huruf mono 14px, label bahasa, tombol **Salin** berupa teks yang melaporkan berhasil/gagal |
| Teks utama | krem `#f3e7d3`, 16,3:1 — terlalu tajam untuk tema gelap | `#dbd0be`, 13,1:1 |
| Jarak baris prosa | 1,625 | 1,75 (kolom 1088px ±134 karakter) |
| Kolom | — | tetap 1088px (Owner memilih A) |

Aman tanpa daftar putih buatan sendiri: HTML mentah jadi teks, tautan `javascript:` tak punya href, tautan dibuka di
peramban luar. Nalar `<think>`, penanda Engineer (`[MAMET_CMD]` dll.), dan label `[STATUS: …]` tetap seperti
sebelumnya. Tanpa pewarnaan sintaks — menambah paket butuh izin Owner.

## Putaran 2 — latar dinding, bilah gulir, keluaran terminal

Owner: *"sudah cukup nyaman. di Home yang belum diterapkan model scroll-nya… soal kenyamanan mata penyebabnya warna
hijau kayu yang mendominasi… bisakah background dasar yang terletak paling dalam menggunakan background yang sama di
LampLogin?"*

**Latar dinding.** Akar masalahnya: sebelas layar mengecat latar terdalamnya sendiri (`#050505`, `slate-950`,
`slate-900/50`, `bg-background`) — dinding apa pun di belakang akan tertutup. Kini satu lapisan `os/LatarRuangan.jsx`
(gradien dinding, tekstur noise, bayangan samping, vinyet — sama dengan LampLogin) dipasang di `OSDesktopShell`, dan
akar sebelas layar tembus pandang. Vinyet sengaja di **bawah** isi (di LampLogin di atas) agar tidak menggelapkan teks
di tepi layar. Pembungkus isi `relative` tanpa z-index, jadi laci chat tetap menutupi tombol MENU.

Kontras dihitung di titik dinding **paling terang** (`rgb(77, 45, 23)`): teks utama 8,09:1, teks redup 6,15:1, emas
7,85:1. `slate-500` lama jatuh ke 3,35:1 di titik itu → dinaikkan ke `#b49975` (4,55:1); `slate-400` ke `#c4a886`
agar urutan terang tetap terjaga.

**Bilah gulir.** Gaya tipis dulu hanya berlaku bagi elemen berkelas `.custom-scrollbar`; daftar Knowledge Directory dan
panel Observability tidak memakainya. Kini berlaku untuk semua elemen (4px, jempol krem). MenuTeks tetap tanpa bilah.

**Keluaran terminal Engineer.** Pesan `[TERMINAL OUTPUT for: …]` dulu teks biasa di gelembung — baris panjang tanpa
spasi menjebol tepinya. Kini kotak kode (`KotakKode`, sama dengan blok kode jawaban) berlabel `terminal · <perintah>`,
digulir mendatar dan tegak di dalam kotaknya. Diurai dengan `riwayatPerintahDariPesan` — pengurai yang sama dengan
riwayat perintah, jadi perintah yang memuat `]` tidak terpotong.

**Belum terjawab:** bilah gulir mendatar di panel kanan Home tidak muncul dengan data contoh; penyebabnya belum
ditemukan. Bilahnya kini ikut tipis.

## Utang K5

Nilai dinding **disalin** dari `LampLogin.jsx`, bukan diimpor — LampLogin tidak boleh disentuh. `uji-latar-ruangan`
membaca kedua berkas dan merah bila salinannya menyimpang. `LampLogin.jsx` tidak berubah (hash penjaga lulus).

## Uji

| Uji | Yang dijaga |
|---|---|
| `uji-markdown-chat.mjs` v2 (baru) | merender komponen sungguhan (esbuild + react-dom/server): bentuk Markdown, blok kode utuh & tak dipatahkan (termasuk lekuk baris pertama dan pagar yang belum ditutup), keamanan, pemasangan, keluaran terminal |
| `uji-latar-ruangan.mjs` v1 (baru) | salinan dinding = LampLogin, terpasang tanpa konteks tumpukan baru, sebelas akar tembus, kontras di titik terang (dihitung dari gradiennya sendiri), bilah gulir global |
| `uji-kerangka-chat.mjs` v5 | gelembung pengguna dipadatkan & bergaris; jawaban model tanpa kotak |
| `uji-palet-lamplogin.mjs` v2 | teks utama 7–14:1 (tidak menyilaukan), body = token |
| `uji-ciri-tampilan.mjs` v3 | `tokenMaterial` 568 → 576 (satu-satunya kenaikan: elemen baru Markdown, token mubazir dibuang dulu); `warnaSlate` 615 → 609; `LatarRuangan.jsx` dikecualikan seperti LampLogin (dijaga uji-latar-ruangan) |

Dua puluh mutasi dibuktikan menggigit; satu yang semula lolos (memangkas lekuk awal kode) menghasilkan asersi baru.
Suite 109/109.
