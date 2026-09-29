# T12 — penjaga berkas rahasia

**29 September 2026** · `frontend/electron/berkasRahasia.cjs` · keputusan Owner 28 September

## Yang berubah

Alat folder menolak **membaca isi** berkas rahasia: `.env` (beserta `.env.local`, `.env.production`, …),
`*.key`, dan `*.pem`. Penolakannya menyebut sebabnya dan memberi jalan lain.

```
folder_read .env   → ditolak
folder_search      → berkas rahasia dilewati, jumlahnya DILAPORKAN (dilewatiRahasia)
folder_list .      → nama ".env" TETAP terlihat
```

## Kenapa

T12 bukan bug melainkan **sifat sistem**: apa pun yang dibaca alat folder/repo berakhir di dalam prompt,
dan prompt dikirim ke OpenRouter yang merutekannya lagi ke penyedia hulu yang berganti-ganti — terukur
28 September, **8 penyedia untuk satu nama model dalam 4 jam**. Tidak ada satu pun pemberitahuan.

Sifat itu tidak bisa dihilangkan selama modelnya di awan, dan Owner menutupnya sebagai **batas yang
diketahui**. Yang bisa ditutup kode adalah bagian yang paling mahal bila lolos: **sekali kunci API atau
kunci privat masuk ke prompt, ia sudah keluar — tidak ada cara menariknya kembali.**

## Empat keputusan

**1. Daftarnya sempit, persis yang diputuskan Owner.** Melarang terlalu banyak membuat alatnya dihindari,
dan yang dihindari tidak menjaga apa pun.

**2. `.env.example` dan kerabatnya TIDAK ikut** (`.sample`, `.template`, `.dist`, `.default(s)`). Berkas itu
memang dibuat untuk dibaca — berisi **nama** variabel tanpa nilainya, dan justru itu yang dibutuhkan model
saat menjelaskan setelan. Menolaknya berarti menolak berkas yang tidak memuat satu pun rahasia.

**3. Yang dijaga ISInya, bukan keberadaannya.** Nama `.env` tetap terlihat di `folder_list`. Menyembunyikan
berkasnya akan membuat model menyimpulkan ".env tidak ada" lalu menyuruh Owner membuatnya — lebih buruk
daripada menolak dengan jujur.

**4. `folder_search` adalah jalur yang paling mudah terlewat.** Ia membaca **seluruh** berkas di folder,
jadi tanpa penjaga di sana satu kata yang kebetulan ada di `.env` akan mengirim baris rahasianya ke prompt
sebagai "temuan". Berkas yang dilewati **dihitung dan dilaporkan** — pengecualian yang diam adalah cara
`uji-folder-label` merah tanpa ketahuan selama empat hari.

## Penolakan yang memberi jalan lain

> `".env"` adalah berkas rahasia (.env / kunci) dan TIDAK dibaca: isinya akan ikut terkirim ke penyedia
> model, dan yang sudah terkirim tidak bisa ditarik kembali. Bila Anda butuh NAMA variabelnya, baca berkas
> contoh seperti `.env.example`, atau minta pengguna menyebutkannya sendiri.

Prosedur kerja Engineer langkah 0.4: larangan tanpa ganti cara hanya memindahkan kemacetan, dan model yang
ditolak tanpa arah akan mengarang jalan memutar — terbukti live 28 September.

## Bukti

`uji/uji-berkas-rahasia.cjs` dijalankan terhadap **folder sungguhan** berisi `.env`, `.env.example`,
`server.key`, dan `app.js`, lewat `jalankanAlat()` yang sama dipakai proses utama — bukan tiruan logikanya.

**Uji kendali (langkah 8):** folder itu juga memuat `.env2` — bentuk isinya sama persis dengan `.env`,
tetapi sengaja **tidak** masuk daftar rahasia. Nilainya memang ditemukan pencarian. Itu membuktikan
pencarian benar-benar membaca berkas bertitik semacam ini, sehingga absennya `.env` dari hasil adalah
karena **penjaganya**, bukan karena aturan ekstensi/biner yang kebetulan sudah mengecualikannya. Tanpa
kendali ini, ujinya bisa hijau karena alasan yang salah.

54 berkas uji hijau.

## Batas yang TIDAK ditutup — harus tertulis

- **Perintah Engineer** (`[MAMET_CMD: …]`) tidak dijaga penjaga ini. Sebuah skrip sebaris seperti
  `node -e "…"` bisa membaca apa saja. Yang menjaganya di sana tetap yang sudah ada: daftar program
  terbatas, peringatan skrip sebaris, dan **dialog izin Owner** sebelum perintah dijalankan.
- **Explorer berkas** (`fs:readFile`) juga tidak dijaga — itu Owner membaca berkasnya sendiri di
  layarnya sendiri, dan tidak ada yang dikirim ke mana pun.
- Yang dijanjikan penjaga ini hanya: **alat folder tidak akan mengirim isi berkas rahasia ke prompt.**
  Bukan: rahasia tidak mungkin bocor.
