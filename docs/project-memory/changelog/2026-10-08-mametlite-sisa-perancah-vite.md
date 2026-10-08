# 8 Oktober 2026 — Sisa perancah Vite dibersihkan dari Mametlite

M8 blok M item 125 ([`ROADMAP-SIAP-PENGGUNA.md`](../../roadmap/ROADMAP-SIAP-PENGGUNA.md)).

Owner menyerahkan keputusannya ("no preference" pada daftar centang), jadi keempat kelompok
dikerjakan. Semuanya sudah dibuktikan nol rujukan lebih dulu, dan git tetap menyimpan isinya — itu
"hapus lunak"-nya.

## Yang dihapus

| Berkas | Bukti |
|---|---|
| `src/App.css` | **184 baris, 0 pengimpor** (`git grep "App.css" -- mametlite/*` → nol; `main.jsx` hanya mengimpor `index.css`) |
| `src/assets/hero.png`, `react.svg`, `vite.svg` | 0 rujukan di `src` maupun `index.html` |
| `public/icons.svg` | 0 rujukan |
| dependency `react-markdown`, `remark-gfm` | **0 impor sungguhan** — 3 kemunculan di `src` semuanya komentar yang menjelaskan kenapa keduanya TIDAK dipakai (react-markdown membuat React 19 jatuh) |
| dependency `autoprefixer`, `postcss` | 0 impor, dan **tidak ada `postcss.config.js`** sama sekali |

`App.css` yang paling perlu hilang, dan bukan karena 184 barisnya: **6 `@media` di dalamnya adalah
satu-satunya `@media` di seluruh proyek.** Siapa pun yang membacanya akan menyangka Mametlite sudah
responsif — padahal sampai M3 kemarin, nol dari 102 `className` punya prefiks responsif. Ia bukan
sekadar mati, ia **menyesatkan**.

## Yang diperbaiki (bukan dihapus)

| | Sebelum | Sesudah |
|---|---|---|
| `README.md` | template Vite verbatim — *"This template provides a minimal setup…"*, nol kata tentang Mametlite | ditulis ulang: beda dengan Ecosystem, cara menjalankan, variabel lingkungan, daftar uji, dan tiga hal yang wajib diketahui sebelum menyunting |
| `index.html` | `lang="en"` pada UI yang seluruhnya bahasa Indonesia | `lang="id"` |
| `index.html` | `<title>mametlite</title>` | `<title>Mamet Lite</title>` — aplikasinya menyebut dirinya begitu di layar |
| `.custom-scrollbar` | dipakai `App.jsx:659`, **tidak didefinisikan di mana pun** | didefinisikan di `index.css` |

`custom-scrollbar` **didefinisikan, bukan dicabut**: daftar dokumennya memang bergulir
(`max-h-32 overflow-y-auto`), jadi kelas yang hilang itu kebutuhan yang tak pernah dipenuhi — batang
gulirnya memakai bawaan peramban yang terang di atas panel gelap.

## Dua celah yang ketahuan saat mengerjakannya

### 1. Nama variabel lingkungan tidak tercatat di mana pun

`src/lib/supabase.js` memanggil `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`, tetapi tidak ada
`.env.example` dan README-nya template Vite — jadi orang yang baru meng-clone repo tidak punya cara
tahu apa yang harus diisi selain membaca kodenya. Ditambahkan `mametlite/.env.example`.

### 2. `.gitignore` menelan contohnya sendiri

Dan `.env.example` itu **tidak bisa di-commit**: `.gitignore:45` memuat `.env*`, yang mencakup
`.env.example` juga. Jadi berkas yang justru HARUS terbaca orang yang baru meng-clone repo ikut
hilang bersama rahasianya.

`backend/.env.example` selamat **hanya karena ia sudah terlacak sebelum pola `.env*` ditambahkan** —
bukan karena diizinkan. Begitu seseorang menghapus lalu menambahkannya kembali, ia lenyap juga.

Ditambahkan pengecualian `!.env.example` + `!**/.env.example`. Diperiksa dengan `git add --dry-run`,
bukan dengan `git check-ignore` yang keluarannya ambigu untuk pola negasi:

```
git add --dry-run mametlite/.env.example   → add 'mametlite/.env.example'
git add --dry-run mametlite/.env           → The following paths are ignored…
```

Contohnya bisa masuk; `.env` sungguhan tetap ditolak.

## Bukti

`npm install` (lock diselaraskan) lalu `npm run build` → lulus. Suite penuh: **92/92**.

## Berkas

Dihapus: `src/App.css`, `src/assets/{hero.png,react.svg,vite.svg}`, `public/icons.svg`.
Diubah: `package.json` (−4 dependency), `package-lock.json`, `README.md`, `index.html`,
`src/index.css`, `.gitignore`.
Ditambah: `mametlite/.env.example`.

## Temuan baru yang TIDAK dikerjakan di sini

`npm audit --omit=dev` di `mametlite/` → **8 kerentanan (5 high, 3 moderate)** di dependency
produksi. Satu di antaranya mendesak dan ditangani terpisah: **`pdfjs-dist` GHSA-hq66-cqwq-w95j —
"Arbitrary JavaScript execution upon opening a malicious PDF"**, rentang rentan `>=5.6.83 <6.2.108`,
dan Mametlite memasang `^6.0.227`. Membuka PDF adalah fungsi utama Mametlite.

Dicatat sebagai temuan tersendiri di roadmap, bukan diselipkan ke commit pembersihan ini.
