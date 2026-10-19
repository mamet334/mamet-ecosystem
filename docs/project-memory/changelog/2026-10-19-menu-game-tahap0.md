# 19 Oktober 2026 — tampilan menu game, Tahap 0: diukur dulu, sebelum satu baris tampilan pun diubah

Item 127 ([`ROADMAP-TAMPILAN-MENU-GAME.md`](../../roadmap/ROADMAP-TAMPILAN-MENU-GAME.md)). Owner memutuskan
**K1 = B** (graf pengetahuan terbuka di panel sebagai halaman pertama — konstitusi 23 tetap dipatuhi) dan
**K3 = fondasi dulu**, lalu memerintahkan Tahap 0. **Kode aplikasi tidak diubah** — tahap ini hanya
menambah berkas uji dan mengukur.

## Yang dibuat

| Berkas | Isi |
|---|---|
| `uji/uji-ciri-tampilan.mjs` (baru) | gigi searah atas 9 penanda tampilan generik — angkanya hanya boleh turun |
| `uji/uji-penjaga-lamplogin.mjs` (baru) | `LampLogin.jsx` tidak berubah satu bait pun, dan tetap layar masuk yang tampil |
| `uji/uji-ukur-tumpukan.js` (baru) | skrip konsol DevTools, **hanya membaca** — biaya 11 aplikasi yang hidup bersamaan |

### `uji-ciri-tampilan.mjs`

"Tidak terasa hasil generate AI" adalah rasa, dan rasa tidak bisa diuji. Penandanya bisa. Garis dasar 19 Okt
(45 berkas `.jsx`, tanpa `LampLogin`, komentar dibuang):

| Penanda | Batas atas |
|---|---:|
| token warna gaya Material 3 | 568 |
| warna mentah `slate-*` | 615 |
| aksen pelangi | 250 |
| gerak dekoratif `animate-pulse/ping/spin` | 51 |
| `backdrop-blur` | 15 |
| bayangan glow `rgba` | 26 |
| gradien | 6 |
| berkas yang memakai ikon lucide · Material Symbols | 26 · 8 |

`LampLogin` dikecualikan karena ia acuan yang dilindungi: angkanya tak pernah boleh turun, jadi hanya akan
mengaburkan gerak berkas lain. Selisih dengan tabel roadmap §2.1 (yang menghitung 46 berkas) seluruhnya
milik `LampLogin` — gradien 19→6, glow 37→26 — karena cahaya lampunya memang dibuat dari situ. Di sana ia
bermakna; di layar lain ia resep.

### `uji-penjaga-lamplogin.mjs`

Owner: *"untuk pekerjaan ini jangan dulu mengubah lamblogin."* Batas seperti itu paling mudah dilanggar
tanpa sengaja di Tahap 3 — langkah paling wajar untuk menggambar ruangan aplikasi adalah "ekstrak ruangannya
jadi komponen bersama", yang berarti mengubah `LampLogin`. Kini itu merah, bukan sekadar tertulis.

Sidik jari SHA-256 dengan **akhir baris dinormalkan** — git di mesin Owner mengubah LF→CRLF saat checkout
(berkas di disk memang ber-CR), dan tanpa normalisasi uji akan merah karena cara berkasnya diambil, bukan
karena isinya. Uji juga memastikan `App.jsx` masih merender `<LampLogin>`: sidik jari yang utuh tak berarti
apa-apa bila layar masuk diam-diam diganti komponen lain.

## Bukti bahwa keduanya menggigit

| Mutasi | Hasil |
|---|---|
| satu `bg-slate-900` di berkas sementara di `src/` | `warnaSlate: 616 ≤ 615` **merah**; hijau lagi sesudah berkasnya dibuang |
| satu spasi ditambahkan ke `LampLogin.jsx` | sidik jari **merah**; berkas dipulihkan dari salinan, `git diff` bersih |
| fixture berisi tiap penanda (termasuk yang hanya di komentar) | tiap penghitung menghitung tepat yang diklaim; komentar tidak terhitung |

Suite penuh **98/98** (96 + 2 uji baru).

## Yang terukur — biaya tumpukan aplikasi

Server dev di panel browser, Owner login sendiri, viewport **1366×720** dari awal sampai akhir. Dua sampel;
angka simpul sampel pertama dibuang karena lebar panel berubah di tengah pengukuran.

| Ukuran | Hasil |
|---|---|
| aplikasi terpasang · terlihat · tersembunyi tetap hidup | **11 · 1 · 10** |
| kotak ketik terpasang | **3** — tiga `ConversationEngine` hidup bersamaan |
| simpul DOM milik aplikasi tersembunyi | **2.868 dari 3.333 (86%)** — sama persis di kedua sampel |
| pendengar EventBus | 81–90; banyak event didengar **tepat 3 kali** — sidik jari tiga mesin chat |
| tugas panjang selama 15 detik diam | 2 (139 ms) · **0** |
| heap JS | 39–56 MB, naik-turun — tidak bisa diatribusikan dari satu keadaan |

**Kesimpulan, ditulis apa adanya seperti dijanjikan roadmap:** biaya tumpukan **bukan prosesor** — saat diam
aplikasi hampir tidak bekerja. Biayanya **struktur**: 86% DOM dan pendengar berlipat tiga untuk layar yang
tidak dilihat. Alasan Tahap 1 karena itu **kebenaran keadaan** dan **satu halaman pada satu waktu**, bukan
"aplikasi jadi lebih cepat" — klaim kecepatan tidak boleh dibuat sebelum diukur ulang sesudah Tahap 1.

## Inventaris fungsi dilengkapi

Roadmap §6 kini mencakup semua halaman yang terjangkau. Tiga temuan:

1. **Tiga komponen mati, bukan satu** — `Login.jsx` (152), `EngineerChat.jsx` (227), `ActivityBar.jsx` (91);
   tak diimpor di mana pun. Dicatat (K6 diperluas), **tidak dihapus**.
2. **Keluar (logout) hanya ada di dasar halaman Settings** (`Settings.jsx:768`). Di menu baru ia naik ke menu
   utama.
3. **Lima dari enam widget tak dibuka kode mana pun** — dan pengukuran mengonfirmasinya: tak ada di tata
   letak tersimpan mana pun. Yang tersimpan justru **Monitor MAEF terbuka** untuk Assistant dan Engineer,
   jadi di profil yang diukur kolom chat dimulai dari **±632px**, bukan ±982px. *Batasnya:* itu
   `localStorage` panel browser di `localhost:5173`, bukan `.exe` Owner.

## Ikut ketahuan — didaftarkan sebagai T16

Lima modul konsol uji (`uji-pengambilan.js`, `-v2`, `-v3`, `-v4`, `uji-konteks-potongan.js`) masih menunjuk
`frontend/node_modules/.uji-rag/` — folder yang **sudah tidak ada** sejak uji dipindah ke `uji/` (`e1ca067`,
24 Sep). Rusak tanpa suara: suite tidak menjalankan berkas `.js`, jadi tak ada yang merah. Memperbaiki path
saja tidak cukup — `vite.config` tidak mengizinkan `/@fs/` ke `uji/` (itu juga sebabnya `uji-ukur-tumpukan.js`
dibuat untuk ditempel, bukan diimpor). Tidak diubah di sini; didaftarkan sebagai **T16** di
`ROADMAP-TEMUAN-TERBUKA.md` karena masih ada keputusan dan pekerjaan.
