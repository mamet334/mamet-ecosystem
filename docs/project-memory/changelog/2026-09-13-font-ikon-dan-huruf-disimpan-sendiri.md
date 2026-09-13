# Ikon dan Huruf Tidak Lagi Menumpang Google

**Tanggal:** 13 September 2026
**Roadmap:** Item 74

## Masalahnya

Owner mengirim tangkapan layar: sidebar Mamet OS berubah menjadi daftar kata — `architecture`,
`home`, `chat_bubble`, `terminal`, `settings`. Di log:

```
GET https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined… net::ERR_TIMED_OUT
GET https://fonts.googleapis.com/css2?family=Inter…                     net::ERR_TIMED_OUT
```

Ikon di aplikasi ini ditulis sebagai **ligatur**: `<span class="material-symbols-outlined">home</span>`.
Kata "home" itu memang teks; fontnyalah yang mengubahnya menjadi gambar rumah. Dan deklarasi
`font-family` untuk kelas itu **tidak pernah ada di kode kita** — ia datang dari CSS yang diambil
dari Google. Begitu CSS itu gagal termuat, tidak ada `font-family` sama sekali, dan yang tampil
adalah katanya.

Dua hal lain ikut terungkap:

- Stylesheet yang timeout **menahan tampilnya halaman** sampai browser menyerah. Huruf teks
  sendiri aman (jatuh ke huruf sistem), tapi penantiannya merugikan.
- Di Mamet Desktop tanpa internet, hal ini **selalu** terjadi, bukan sesekali.

Timeout itu juga bukan kejadian sekali lewat: dicoba ulang dari mesin lain pada hari berikutnya,
`fonts.googleapis.com` tetap menolak tersambung (`ConnectTimeoutError`).

## Perbaikannya

Keduanya kini berkas milik sendiri di `frontend/src/assets/fonts/`:

| Berkas | Ukuran | Catatan |
|---|---|---|
| `material-symbols-subset.woff2` | 21 KB | 67 ikon yang benar-benar dipakai; font penuh 970 KB |
| `inter-latin-wght-normal.woff2` | 47 KB | satu berkas variabel, ketebalan 100–900, potongan latin |

`index.html` tidak lagi memuat `<link>` luar sama sekali, dan CSP dipersempit: `style-src` tak lagi
mengizinkan `fonts.googleapis.com`, `font-src` tinggal `'self'`.

Dua perincian yang menentukan:

**Aturan ikon ditulis di dalam `@layer base`.** Kelas `.material-symbols-outlined` milik Google
memuat `font-size: 24px`, dan banyak ikon di aplikasi ini memakai kelas ukuran Tailwind
(`text-[13px]`, `text-[16px]`). Dulu urutan itu terjaga sendiri karena CSS Google berada di `<link>`
terpisah sebelum bundel. Aturan biasa di `index.css` justru ditulis **sesudah** `@tailwind
utilities`, sehingga akan mengalahkan kelas ukuran dan membuat semua ikon membesar. `@layer base`
mengembalikan urutan yang benar.

**`font-display` berbeda untuk keduanya.** Ikon memakai `block` — selama font belum siap ikon
disembunyikan, sebab ikon yang "tampil apa adanya" berupa kata. Teks memakai `swap` — langsung
terbaca dengan huruf sistem lalu berganti begitu Inter siap.

Dua perintah pemeliharaan ditambahkan: `npm run ikon` memindai `src/` lalu mengunduh ulang subset
ikonnya (daftar nama ikut disimpan agar perubahannya terlihat di diff), dan `npm run huruf`
mengunduh huruf teks dari versi yang dipatok.

## Bukti

Diuji di server dev memakai `index.css` yang sebenarnya, lalu diukur lewat DOM:

| Yang diperiksa | Hasil |
|---|---|
| 67 ikon | semuanya selebar **24 px** — ligatur menjadi satu glyph; yang gagal akan menampilkan katanya dan jauh lebih lebar |
| Kelas ukuran Tailwind | `text-[13px]`/`[16px]`/`[32px]` → 13/16/32 px, jadi utilities tetap menang |
| `document.fonts` | tepat dua muka: `Inter 100 900 loaded`, `Material Symbols Outlined 100 700 loaded` |
| Lebar kalimat contoh | 445 px (Inter 400), 455 px (Inter 700), 428 px (huruf sistem) — Inter benar dipakai, sumbu ketebalan hidup |
| Permintaan jaringan | seluruhnya localhost; tidak ada satu pun ke googleapis/gstatic |
| Build produksi | kedua woff2 terbit ber-hash; `dist/index.html` tanpa `<link>` luar; aturan ikon di posisi 4.765 sedangkan utilities ukuran di 59.852+ |

## Yang dikorbankan

Tautan yang dicabut membawa **tiga** huruf, bukan satu. Geist (12 tempat: `font-display-lg`,
`font-headline-md`) dan JetBrains Mono (6 tempat: `font-label-mono`) tidak ikut diunduh dan kini
memakai huruf sistem. Agar judul tidak jatuh ke huruf bawaan browser, cadangan Geist diarahkan ke
Inter supaya tetap serumpun dengan sisa antarmuka.

Menyimpannya sendiri juga berbiaya kecil bila nanti diputuskan: Geist 27,7 KB, JetBrains Mono
39,5 KB. Barisnya sudah disiapkan sebagai komentar di `scripts/perbarui-huruf.mjs`.

## Keterbatasan yang disadari

- **Ikon baru tidak otomatis masuk.** Subset hanya berisi nama yang terpindai; ikon yang namanya
  dirakit saat berjalan harus ditambahkan manual di `TAMBAHAN_MANUAL`. Yang terlewat akan tampil
  sebagai kata — sama seperti keadaan sebelum perbaikan ini, tapi hanya untuk ikon itu saja.
- **Sumber unduhan pindah ke jsDelivr/Fontsource** untuk huruf teks, karena Google tak terjangkau
  bahkan untuk mengunduhnya. Font ikon masih diunduh dari Google (hanya saat menjalankan skrip,
  tidak saat aplikasi berjalan).
- **Ini belum membuat aplikasi jalan offline.** Yang dijamin hanya ikon dan huruf. Offline penuh di
  versi web butuh service worker (Fase 4 rencana adaptive shell, Item 72).
- `mametlite/` tidak tersentuh — diperiksa, memang tidak pernah memuat Google Fonts.
