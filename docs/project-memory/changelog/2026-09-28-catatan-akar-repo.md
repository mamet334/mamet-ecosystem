# 2026-09-28 — Model diberi tahu akar repo-nya (sisa Tahap 5)

## Masalah (live, 28 September)

Engineer menulis *"Keduanya dijalankan dari direktori kerja yang berbeda"*, lalu mengarang perintah
`python -c "…"` untuk menelusuri filesystem mencari berkas yang **alamatnya sudah ia ketahui**.
Perintah itu ditolak pemecah perintah karena kutipnya tidak ditutup.

Perintahnya memang dijalankan dengan `cwd = akarRepo()` — secara teknis selalu benar. Tetapi **tidak
ada satu pun tempat yang memberitahukan itu kepada model**, jadi ia menebak, dan menebak ke arah yang
salah. Sebelum Tahap 5 catatan ini mustahil ditulis: akarnya sendiri tidak pasti.

## Perbaikan

`catatanAkarRepo()` di `ProsedurEngineer.js`, disisipkan ke **tiap kiriman** Engineer sejajar ringkasan
temuan Tahap 3b:

```
[AKAR REPO ENGINEER]
Seluruh perintah [MAMET_CMD: …] dijalankan dengan direktori kerja: <akar>
Anda SUDAH berada di akar repo. Pakai alamat RELATIF terhadap folder itu
(mis. frontend/src/core/runtime/Kernel.js), bukan alamat absolut.
JANGAN menelusuri filesystem untuk mencari letak berkas — untuk menemukannya pakai
git ls-files (daftar berkas) atau git grep -n (cari isi), keduanya sudah diizinkan.
```

Tiga keputusan di dalamnya:

1. **Larangan disertai ganti cara.** `git ls-files` dan `git grep -n` disebutkan langsung — prosedur
   langkah 0.4: melarang tanpa memberi jalan lain hanya memindahkan kemacetan.
2. **Dibaca tiap kiriman, bukan sekali di awal.** Owner bisa berganti repo lewat tombol "Pilih repo",
   dan catatan sekali-di-awal hilang begitu "Bersihkan konteks" atau "Padatkan" menggeser jendela.
3. **Diam bila akar kosong** — di web/Mametlite tidak ada Electron, dan di aplikasi terpasang akar bisa
   belum dipilih. Catatan yang menyebut akar kosong lebih buruk daripada tidak ada catatan.

Disisipkan hanya ke yang **dikirim** — tidak tampil di layar, tidak ikut tersimpan. Pola yang sama
dengan ingatan temuan: catatan ini milik sistem, bukan bagian percakapan Owner.

## Uji

`uji/uji-catatan-akar-repo.mjs` — tiga bagian: isi catatan (menyebut akar, direktori kerja,
alamat relatif, larangan menelusuri filesystem, dan ganti caranya), kapan diam (enam bentuk masukan
kosong), dan **terpasang**: diimpor, dipanggil di `handleSend`, akarnya dibaca dari proses utama,
ikut ke `historyKirim` yang benar-benar dikirim ke server, dan hanya di workspace Engineer.

50 berkas uji hijau; `vite build` lolos.

## Belum diuji live

Perlu `npm run dist` + pasang, lalu satu chat Engineer yang menyuruhnya membaca berkas. Yang dibuktikan:
ia langsung memakai alamat relatif dan `git grep`/`git ls-files`, tanpa jalan memutar mencari letak
berkas. Perubahan ini di renderer, jadi ikut terbawa build biasa — tidak perlu deploy Edge Function.
