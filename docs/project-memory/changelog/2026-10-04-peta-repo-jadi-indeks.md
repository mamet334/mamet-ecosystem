# 4 Oktober 2026 — Peta repo jadi INDEKS: −83,8% sisipan, tiap pesan

## Permintaan Owner

> *"Kerjakan pemangkasan peta repo dengan metode sama seperti skill, yaitu memuat judul atau kata
> kunci saja, bukan keseluruhan peta maupun penjelasan."*

## Kenapa sekarang, dengan angka

Terukur di produksi lewat `[PROMPT_KOMPOSISI]`: sisipan peta + akar repo tercatat
`riwayat=2 pesan/16.557 huruf`, **identik di lima kali jalan** termasuk di percakapan berbeda —
karena sisipan ini memang disematkan ulang **tiap kiriman** (`ConversationEngine.jsx:1255`,
PATOK). Itu **30% dari seluruh prompt**, untuk pertanyaan apa pun.

## Yang penting: mekanisme pengambilnya SUDAH ada

Pemangkasan ini murah justru karena Engineer sudah bisa mengambil sendiri yang ia perlukan —
`git grep` **jalan tanpa dialog izin** sejak 4.2.5 (item 104). Jadi yang dibuang bukan
kemampuannya, hanya **pengirimannya di muka**.

## Hasilnya

```
sisipan LAMA : 16.557 huruf
sisipan BARU :  2.687 huruf      (−83,8%, ≈3.584 token per pesan)
```

Isi indeksnya: jumlah berkas & folder, **daftar folder beserta jumlah berkasnya** (18 baris),
perintah pengambil daftar & pencari isi, dan **daftar berkas >600 baris**.

### Apa yang sengaja DIPERTAHANKAN

Daftar berkas besar tidak ikut terpangkas. Jumlah baris bukan hiasan — ia yang mengajari model
memilih `git grep` sejak awal alih-alih `git show` yang akan terpotong 20 KB diam-diam. Ambangnya
dinaikkan 400 → **600 baris** (16 berkas, 913 huruf): di bawah itu `petunjukKeluaranTerpotong`
sudah menangkapnya setelah kejadian.

### Bahaya baru yang dibawa pemangkasan ini

Model tak lagi tahu alamat tiap berkas tanpa bertanya. Dua larangan ditulis **di dalam indeksnya
sendiri**, bukan diserahkan pada ingatan model:

- **jangan menebak alamat berkas**
- **jangan menyimpulkan sebuah berkas tidak ada** — indeks hanya menyebut folder

Larangan kedua itu benar-benar baru: peta lama boleh dipakai menyimpulkan ketiadaan (*"bila sebuah
berkas tidak ada di sini, ia memang tidak ada"*), indeks **tidak boleh**. Klaim "LENGKAP" dicabut
karena sudah tidak benar. Mutasi M2 menjaga tepat ini.

## Cacat rancangan yang ditemukan oleh ujinya sendiri

Uji pemangkasan memakai 300 berkas yang masing-masing punya folder sendiri. Hasilnya: indeks
**12.808 huruf untuk peta 8.729 huruf** — **lebih besar daripada yang dipangkasnya**. Pengelompokan
tidak memampatkan apa pun bila jumlah folder ≈ jumlah berkas.

Tambalan pertama memakai ambang `folder * 3 > berkas`. Angka 3 itu **sewenang-wenang**, dan
langsung salah menilai: fixture uji 3-berkas ikut terjerat, sembilan asersi jatuh.

Diganti dengan yang **tepat**: susun kedua bentuk, kirim yang lebih kecil. Tidak ada yang ditebak,
dan janji "lebih kecil" jadi berlaku **tanpa syarat** — bukan hanya pada bentuk repo yang kebetulan
cocok. Repo ini 273 berkas / 18 folder, jadi cabang peta-utuh tak menyala di sini; ia ada supaya
klaimnya benar di mana pun.

## Uji

`uji/uji-peta-repo.mjs` — **arah asersinya dibalik, bukan dilonggarkan.** Uji ini dulu menegakkan
keputusan lama (peta utuh, dinyatakan LENGKAP); keputusan itu diubah Owner, jadi yang dulu wajib
ada kini wajib **tidak** ada, dan penggantinya harus benar-benar bisa dipakai.

Fixture-nya ikut diperbaiki: yang lama (3 berkas) tidak cocok menguji indeks, karena pada peta
sekecil itu peta utuh memang lebih kecil dan fungsinya sengaja mengirim yang lebih kecil.

| Mutasi | Asersi jatuh |
|---|---|
| M1 kembali kirim peta utuh (pemangkasan batal) | 11 |
| M2 **bahaya baru**: larangan menyimpulkan ketiadaan dihapus | 2 |
| M3 perintah pengambil daftar dicabut (indeks jadi membutakan) | 1 |
| M4 peringatan berkas besar ikut terpangkas | 3 |
| M5 penjaga tepat diganti "kirim indeks selalu" | 3 |

**81/81 berkas uji hijau.**

## Perlu RILIS KLIEN, tanpa deploy

`ProsedurEngineer.js` ada di `frontend/src`. Tak ada perubahan edge function.

**Cara memastikan live:** kirim satu pertanyaan ke Engineer, lalu lihat `[PROMPT_KOMPOSISI]` —
`riwayat` harus turun dari **16.557** ke **±2.700 huruf**. Dan satu uji mutu yang lebih penting
daripada angkanya: tanya sesuatu yang menuntut alamat berkas (mis. *"di mana penanganan 402?"*).
Engineer harus **menjalankan `git grep` lebih dulu**, bukan menebak alamat atau menjawab bahwa
berkasnya tidak ada.

## Tentang konstitusi — bentuk pekerjaannya BERBEDA

Owner menyebut metode yang sama dipakai nanti untuk konstitusi. Satu hal perlu diluruskan lebih
dulu: konstitusi saat ini **tidak disuntikkan sama sekali**. `engineer.js:316` memuat 32 berkas
lalu membuang isinya — hanya `loadedFiles.length` yang dipakai.

Jadi di sana "metode skill" **menambah** token, bukan memangkas: membuat indeks judul konstitusi
lalu benar-benar mengirimkannya. Nilainya besar (Engineer akhirnya membaca aturan yang Owner
tulis, bukan melaporkan "Coverage BRAIN 1 ✓" tanpa dasar), tetapi arah biayanya berlawanan dengan
pekerjaan hari ini — dan itu pantas diputuskan dengan sadar, bukan disamakan begitu saja.
