# 7 Oktober 2026 — Mametlite berhenti menyuntikkan HTML

## Permintaan Owner

> *"upgrade dan stabilkan untuk mamet ecosystem ini. lihat kode yang ada dari awal hingga akhir siap
> di sajikan untuk user."*

Lalu, saat ditanya apakah lubang ini ditambal atau dikerjakan lebih dalam:

> *"jangan hanya di tambal. tapi digunakan logikanya dengan semestinya"*

Arahan kedua itu yang menentukan bentuk pekerjaan ini. Rencana awal saya memang "perbaiki daftar
putihnya" — dan itu akan menyisakan kelas cacatnya hidup.

## Lubangnya

`mametlite/src/App.jsx:52` membangun satu string HTML lalu menyuntikkannya dengan
`dangerouslySetInnerHTML` (`:105` dan `:692`). Pelolosannya memakai daftar putih tag:

```js
.replace(/<(?!div|\/div|img|a|\/a|strong|\/strong|em|\/em|br\/?)([^>]+)>/g, '&lt;$1&gt;')
```

Alternatif `a` di daftar itu panjangnya **satu huruf**. Jadi yang lolos bukan hanya `<a>` —
**setiap tag yang namanya mulai dengan "a"** lolos tanpa di-escape: `<audio src=x onerror=…>`,
`<animate onbegin=…>`. Dan karena polanya `([^>]+)`, **atributnya ikut lolos utuh**.

`:56` juga menyisipkan `$2` ke `href` tanpa memeriksa skema, jadi `javascript:` lolos.

Di origin yang sama, `localStorage` menyimpan **kunci OpenRouter pengguna** (`:387`) dan sesi
Supabase. Mametlite tidak punya `vercel.json`, jadi **nol CSP**.

### Bobotnya, apa adanya

Pemicunya **keluaran model** atau **isi dokumen yang diunggah pengguna sendiri**. Ini **bukan** jalur
lintas-pengguna — RAG terisolasi per pengguna. Jadi: lubang nyata yang hadiahnya kredensial berbayar
milik pengguna itu sendiri, bukan pembajakan akun orang lain. Ditulis begini supaya bobotnya tidak
dibesar-besarkan, dan supaya alasan mendahulukannya tetap jujur: ia kecil untuk ditutup, bukan
karena ia bencana.

## Yang dikerjakan — bukan daftar putih yang lebih rapat

Akar sebenarnya bukan isi daftar putihnya, melainkan bahwa ada **string HTML yang disuntikkan**.
Selama itu ada, daftar putihnya harus benar selamanya, dan lubang berikutnya hanya menunggu.

| | Sebelum | Sesudah |
|---|---|---|
| Penguraian | regex berantai di `App.jsx`, hasilnya `{ __html }` | `mametlite/src/lib/markdown.js` → **data biasa** (token) |
| Perenderan | `dangerouslySetInnerHTML` | `mametlite/src/lib/TeksKaya.jsx` → **elemen React** |
| Pelolosan | daftar putih tag buatan tangan | **React**, dengan sendirinya |
| Alamat | `$2` langsung ke `href` | `alamatAman()` — hanya `http:`/`https:`/`mailto:` |
| Header | nol | `mametlite/vercel.json` — CSP + 4 header lain |

**Alamat yang ditolak jatuh jadi TEKS, bukan dibuang.** `[klik](javascript:alert(1))` tampil sebagai
tulisannya sendiri. Penolakan yang senyap akan membuat pengguna menyangka jawabannya begitu.

**Nalar tetap tampil.** Blok `<think>` Mametlite memang disengaja, termasuk dua kelonggaran
stream-nya (teks yang mulai "think " tanpa kurung sudut; `<think>` tanpa penutup ditutup di `\n\n`
atau di salam). Semuanya dipindahkan apa adanya dan diuji.

**Parser tangan dipertahankan.** `react-markdown` tidak dipakai — alasannya sudah tertulis di kode
lama: ia membuat React 19 jatuh. Bahwa `react-markdown` & `remark-gfm` masih terpasang tanpa dipakai
adalah perkara kerapian dependency (M8 di roadmap), bukan alasan membalik keputusan itu.

### CSP yang teruji sebelum produksi, bukan sesudah

CSP di `vercel.json` hanya hidup di Vercel — artinya kalau ia memblokir sesuatu yang dipakai
aplikasi, yang menemukannya **pengguna**, bukan kita. Itu bentuk lain dari penjaga yang tak pernah
menyala.

`mametlite/vite.config.js` karena itu **membaca header dari `vercel.json`** dan memakainya di
`server` & `preview`. Satu sumber, dua tempat pakai — `npm run dev` kini memakai CSP yang sama
dengan produksi. `vercel.json` rusak → Vite gagal menyala dengan galat yang menyebut berkasnya,
bukan diam-diam berjalan tanpa header.

## Bukti

`uji/uji-uraian-markdown.mjs` (baru) — 5 bagian, **semua lulus**:

| Bagian | Yang dibuktikan |
|---|---|
| 1 | 9 muatan suntikan (`<img onerror>`, `<audio onerror>`, `<animate>`, `<script>`, `<iframe>`, `<svg><set>`, …) jadi **teks**, nol simpul tautan/gambar |
| 2 | `javascript:` / `JaVaScRiPt:` / `data:` / `vbscript:` / `file:` / relatif ditolak — **dan tulisannya tetap terlihat** |
| 3 | nalar, tebal, miring, tautan, gambar, baris baru tetap bekerja; gambar diurai sebelum tautan |
| 4 | **TERPASANG** — `dangerouslySetInnerHTML` tidak dipakai lagi, rantai App → TeksKaya → markdown utuh, CSP ada |
| 5 | **keluaran render sebenarnya** lewat `react-dom/server`: dari muatan jahat, **nol `<` lahir** di dalam pembungkusnya |

Bagian 5 ada karena bagian 1 belum cukup: token yang aman belum membuktikan apa yang **sampai ke
halaman**. Layar chat Mametlite ada di belakang login Supabase produksi dan tidak dibuka di sini —
`react-dom/server` memberi bukti yang sama tanpa menyentuh akun siapa pun.

**Ujinya dibuktikan menggigit, bukan hanya lulus.** Dua mutasi sengaja dijalankan lalu dipulihkan:

| Mutasi | Hasil |
|---|---|
| `'javascript:'` ditambahkan ke `SKEMA_AMAN` | **7 GAGAL** |
| `dangerouslySetInnerHTML` dikembalikan di `App.jsx` | **2 GAGAL** |

Di peramban (`vite preview`, bundel produksi): aplikasi memuat, **nol pesan konsol**, nol pelanggaran
CSP, dan kelima header terkirim — diperiksa dengan `fetch(location.href).headers`.

Suite penuh: **88/88 lulus**.

## Satu asersi uji lama yang ikut diperbaiki — dan kenapa itu bukan pelemahan

`uji-label-ramah.mjs` merah setelah perubahan ini, pada dua asersi:

```js
cek(/… : <div[^>]*dangerouslySetInnerHTML=\{parseMarkdown\(msg\.content\)\}/.test(APP), …)
cek(blok.indexOf('{label.judul}') < blok.indexOf('dangerouslySetInnerHTML'), …)
```

Keduanya memaku **mekanisme** perenderan. Sifat yang dijaganya — pesan asisten lewat
`JawabanBerlabel` sementara pesan pengguna tidak, dan label diletakkan **di atas** jawaban — sama
sekali tidak rusak. Ini menguji **ejaan, bukan sifatnya**: pelajaran yang sama dengan `44d4f9d`.

Diperbaiki jadi tahan-mekanisme, lalu **dibuktikan masih menggigit** dengan dua mutasi:

| Mutasi | Hasil |
|---|---|
| pesan pengguna juga dibungkus `JawabanBerlabel` | **GAGAL** di asersi 1 |
| blok label dipindah ke bawah badan jawaban | **GAGAL** di asersi 2 |

Jadi tidak ada uji yang berubah merah → hijau karena asersinya dilemahkan.

## Satu uji yang GOYAH, dan ia bukan disebabkan pekerjaan ini

Saat memverifikasi perubahan **dokumen** roadmap (dua berkas markdown), suite melaporkan
`uji-alat-folder-jalan.cjs` GAGAL. Dipisahkan sebelum dilanjutkan:

| Percobaan | Hasil |
|---|---|
| suite penuh saat itu | GAGAL — `habis waktu 3 s → pohon proses dimatikan (3661 ms)` |
| sendirian, 3× | LULUS (3153, 3175, 3156 ms) |
| sendirian + 6 pembebani CPU | LULUS (3182 ms) |
| proses python yatim sesudahnya | **nol** |
| suite penuh sesudah M1 | **LULUS** |

Dan **pesan gagalnya menyesatkan**: namanya menyebut milidetik, tetapi toleransi di
`uji-alat-folder-jalan.cjs:100` adalah **15.000 ms** dan ia gagal pada **3.661 ms**. Yang runtuh
asersi lain di baris majemuk yang sama — `h.habisWaktu` atau `h.keluaran.includes('mulai')`.

Dicatat sebagai **J3b** di `ROADMAP-SIAP-PENGGUNA.md`, dan ia **prasyarat** sebelum suite
disambungkan ke CI: gerbang yang kadang merah tanpa sebab akan dicabut orang dalam sepekan — persis
peringatan `uji-catch-diam.mjs:16-21`.

## Berkas

| Berkas | |
|---|---|
| `mametlite/src/lib/markdown.js` | **baru** — penguraian, menghasilkan data |
| `mametlite/src/lib/TeksKaya.jsx` | **baru** — perenderan, elemen React |
| `mametlite/vercel.json` | **baru** — CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` |
| `uji/uji-uraian-markdown.mjs` | **baru** — 5 bagian, termasuk render sebenarnya |
| `mametlite/src/App.jsx` | parser & penyuntikan dihapus (−48 baris), merender dengan `<TeksKaya>` |
| `mametlite/vite.config.js` | membaca header dari `vercel.json` |
| `uji/uji-label-ramah.mjs` | dua asersi dilepaskan dari ejaan mekanismenya |
| `.claude/launch.json` | entri `mametlite-preview` untuk memverifikasi bundel produksi |

## Sisa pekerjaan

Blok M lainnya di [`ROADMAP-SIAP-PENGGUNA.md`](../../roadmap/ROADMAP-SIAP-PENGGUNA.md): **M2** layar
putih permanen dari `JSON.parse` tanpa `try`, **M3** tata letak HP (0 dari 102 `className` punya
prefiks responsif), **M4** pesan galat bahasa Indonesia, **M8** kode mati, **M9** tiga berkas salinan
tangan.
