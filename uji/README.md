# `uji/` — berkas uji Mamet

Uji di sini dijalankan dengan **node biasa**, bukan kerangka uji. Tiap berkas mencetak `SEMUA LULUS`
atau `N GAGAL` di baris terakhir dan keluar dengan kode 0/1.

```bash
# satu berkas
node uji/uji-konteks-chat.mjs

# semua (±27 detik untuk 43 berkas)
cd uji && for f in uji-*.mjs uji-*.cjs; do printf '%-42s ' "$f"; node "$f" | tail -1; done
```

---

## Kenapa folder ini pindah ke sini (24 September 2026)

Sebelumnya seluruh berkas uji tinggal di `frontend/node_modules/.uji-rag/`. Alasan aslinya benar: Vite
tidak memantau `node_modules`, jadi menulis atau mengubah berkas uji tidak memicu aplikasi memuat ulang
saat Owner sedang memakainya.

Tetapi akibat sampingannya tidak pernah dipertimbangkan:

```
npm ci                → node_modules dihapus & dipasang ulang → 48 berkas uji HILANG
npm install dari nol, pindah laptop, disk rusak → sama
```

`node_modules/` ada di `.gitignore`, jadi berkas-berkas itu **tidak ikut ke GitHub** dan **tidak ada di
cadangan mana pun** (cadangan Item 93 mencakup 13 tabel database, bukan berkas). Satu perintah pemasangan
yang sangat wajar akan menghapus seluruh disiplin verifikasi proyek ini, **tanpa galat, tanpa peringatan** —
suatu hari folder itu kosong dan tak ada yang tahu sejak kapan.

Ini bentuk yang sama dengan yang ditulis di `constitution/28` PRINSIP DASAR (a): **kerugian yang datang tanpa
suara.** Ditemukan bukan dari audit, melainkan saat Owner bertanya apakah pekerjaan ini bisa dilanjutkan di
sesi cloud — dan jawabannya "tidak, karena berkas ujinya tidak ada di GitHub".

Folder ini diletakkan di **akar repo**, bukan di dalam `frontend/`, supaya alasan aslinya tetap terpenuhi:
Vite hanya memantau `frontend/`, jadi mengubah berkas uji di sini tetap tidak memicu muat ulang.

Ini juga prasyarat praktis bagi **Tahap 6** (`ROADMAP-ENGINEER-MANDIRI.md`) — verifikasi patch yang dijalankan
bergantung penuh pada berkas-berkas ini.

---

## `data-lokal/` — TIDAK ikut repo, dan tidak boleh

Sebagian uji butuh data nyata: hasil OCR dokumen Kepbup dan data rekonsiliasi ASN. **Berkas itu memuat NIP
dan nama pegawai**, sementara `github.com/mamet334/mamet-ecosystem` adalah repositori **publik**.

Karena itu pembagiannya tegas:

| | Isi | Git |
|---|---|---|
| `uji/*.mjs`, `uji/*.cjs` | **kode** uji | ✅ ikut |
| `uji/data-lokal/` | **data** uji (OCR Kepbup, rekonsiliasi ASN) | ❌ di `.gitignore` |

Aturannya satu kalimat: **kode ikut repo, data tinggal di laptop.**

Akibatnya `uji-data-tabel-asn-tahap5.mjs` hanya bisa dijalankan di mesin yang punya `data-lokal/`. Itu
disengaja. Lebih baik satu uji tidak bisa dijalankan di tempat lain daripada NIP pegawai terbit di GitHub.

NIP yang **ada** di dalam berkas uji (mis. `198001012005011002` dengan nama "Budi"/"Ani") seluruhnya
**karangan** — bahan uji untuk fitur penyamaran NIP, bukan data nyata. Diperiksa ulang 24 September 2026.

---

## Aturan menulis uji di sini

Ketiganya lahir dari kegagalan nyata; rinciannya di `constitution/28`.

1. **Uji harus bisa gagal, dan butuh uji kendali** (langkah 8). Tunjukkan gejalanya ADA sebelum perbaikan dan
   HILANG sesudahnya. Uji kendali yang mengambil versi lama dari git harus **memaku revisinya**, jangan
   menunjuk `HEAD` — begitu perbaikannya ikut di-commit, `HEAD` sudah memuatnya dan kendalinya mati diam-diam.
2. **Jangan menguji cermin** (langkah 8b). Menyalin logika ke dalam berkas uji lalu menguji salinannya akan
   tetap hijau walau kode aslinya berubah. Kalau logikanya terkurung di komponen React, pindahkan keluar
   supaya bisa diimpor — pola yang sudah terbukti di `pemulihanChat.js`, `KonteksChat.js`, `IngatanTemuan.js`.
3. **Berkas uji yang diubah diberi nama baru + penanda versi** yang dicetak saat dijalankan
   (mis. `console.log('uji-konteks-chat v4')`), supaya terlihat versi mana yang barusan berjalan.

## Catatan teknis

- `esbuild` dan paket lain dipasang di `frontend/node_modules`, jadi dari sini dirujuk lewat **alamat**
  (`new URL('frontend/node_modules/…', new URL('../', import.meta.url))`), bukan nama paket — folder ini
  berada di luar `frontend/` sehingga Node tidak bisa menemukannya lewat nama.
- Berkas `.cjs` menguji kode proses utama Electron; rujukannya `../frontend/electron/…`.
- Skrip penyelidikan sekali pakai (`cek-*.mjs`, `baca-kepbup.mjs`, dan lainnya) **masih tertinggal** di
  `frontend/node_modules/.uji-rag/` dan tetap rentan terhapus `npm ci`. Belum dipindahkan karena sifatnya
  sekali pakai — pindahkan bila ternyata masih dipakai.
