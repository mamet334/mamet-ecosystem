# 1 Oktober 2026 — Patokan sisipan sampai ke server: misteri peta hilang TERPECAHKAN

## Buktinya, dari log server sendiri

```
14:18:51  [Riwayat] 3 pesan, 16999 → 16999 huruf
14:19:39  [Riwayat] 5 pesan, 17311 →  2065 huruf
```

Dua kiriman berurutan, percakapan Engineer yang sama.

## Penyebabnya

`history_compressor.ts` — `rapikanRiwayat()`:

```ts
const PESAN_UTUH = 2;
const MAKS_HURUF_PESAN_LAMA = 800;
```

Ia memangkas **setiap pesan kecuali dua terakhir** menjadi 800 huruf. Sisipan ada di **paling
depan**.

| Kiriman | Yang terjadi |
|---|---|
| ke-1 | riwayat hanya 3 sisipan → peta masih termasuk "dua terakhir" → **selamat utuh** |
| ke-2 | ada pesan percakapan di belakangnya → peta terdorong jadi "pesan lama" → **16.059 huruf dipotong jadi 800** |

Hitungannya cocok sampai satuan huruf: 428 (akar) + 813 (peta terpangkas) + 512 (temuan) + 47 + 265
= **2.065**.

## Cacat yang sama, di tempat yang tidak terlihat

Ini **persis** kesalahan arsitektur yang sudah diperbaiki di klien hari ini (`pilihPesanKonteks`):
**sisipan diperlakukan sebagai pesan paling lama**. Bedanya, pemangkas server berdiri sendiri dan
tidak kelihatan sama sekali dari sisi klien.

## Dan kekeliruan saya sendiri yang membuatnya mungkin

Penanda `_patok` dulu **sengaja saya buang** sebelum payload dikirim, dengan alasan *"penanda
internal tidak boleh bocor ke server"*. Keputusan itu yang membuat pemangkas di seberang **buta**.

Saya menutup mata server, lalu seharian mencari kenapa ia buta. Itu bukan kebersihan; itu memutus
satu-satunya cara penjaga di seberang mengenali apa yang dijaganya.

## Empat teori meleset sebelum ini

| Teori | Ditumbangkan oleh |
|---|---|
| anggaran konteks sempit (saya) | jendela model 1.048.576 token |
| turun ke mode LOOKUP (saya) | log `[RequestParser]` menyebut ENGINEER di kedua kiriman |
| jendela konteks (Owner) | sama dengan yang pertama |
| Engineer jatuh ke jalur ringan (saya) | `RequestClassifierService` sudah menjaganya di hulu |

**Instrumen `[Sisipan]` menemukannya dalam satu kali jalan.** Ia memisahkan "tidak pernah dibuat"
dari "hilang di jalan" — klien membangun 16.999 huruf di kedua kiriman, server menerima 2.065 di
kiriman kedua. Sesudah itu tinggal menelusuri satu arah saja.

## Yang dikerjakan

**Klien:** penanda `_patok` **ikut** ke payload (`tanpaPatok()` dihapus).

**Server:** `rapikanRiwayat()` melewati pesan berpatok berapa pun panjangnya. Satu aturan, dua
tempat penegakan — bukan dua aturan yang bertengkar.

Baris lognya juga ikut menyebut jumlah sisipan yang diselamatkan, supaya pembuktian berikutnya tidak
perlu menghitung manual:

```
[Riwayat] 5 pesan, 17311 → 17311 huruf (…, 3 sisipan dipatok tidak dipangkas).
```

### Yang sengaja TIDAK diubah

Perapian riwayat itu sendiri tetap bekerja untuk pesan biasa: 800 huruf, dua terakhir utuh. Aturan
itu lahir dari Item 68 dan menggantikan peringkas AI yang makan 36,5 detik dan **lebih mahal
daripada yang dihemat**. Yang diperbaiki hanya **siapa yang kebal**, bukan aturannya.

## Uji

`uji/uji-patok-sampai-server.mjs` (baru) — 16 pemeriksaan, dan kali ini **menguji perilaku, bukan
teks**: modul servernya bisa diimpor Node, jadi `rapikanRiwayat()` benar-benar dijalankan. Kasus
intinya menirukan keadaan yang gagal persis, dan memastikan totalnya kembali **17.311** (sebelum
perbaikan: 2.065).

Tiga perilaku lama ikut dijaga agar tidak ikut mati: pemangkasan pesan biasa, pembuangan pesan saat
ini yang terduplikasi (Item 66), dan pembersihan `<think>` jawaban lama.

**69/69 berkas uji hijau**, bundel esbuild `agent-process` bersih.

### Satu uji lama memerah — dan memang harus

`uji-sisipan-dipatok.mjs` menjaga kebalikannya: penanda **tidak boleh** ikut terkirim. Itu aturan
yang saya tulis sendiri beberapa jam sebelumnya, dan ternyata keliru. Dibalik, dengan alasannya
ditulis di tempat asersinya — supaya siapa pun yang membacanya nanti tahu kenapa, dan tidak
membaliknya kembali.

## ✅ TERBUKTI LIVE — 1 Oktober 2026, 14.46–14.48

Deploy server + pasang klien 4.2.7, lalu tiga kiriman berturut-turut di satu percakapan Engineer:

```
14:46:40   3 pesan, 16999 → 16999 huruf   (3 sisipan dipatok tidak dipangkas)
14:48:14   5 pesan, 19202 → 19202 huruf   ← kiriman ke-2, TIDAK TURUN
14:48:47   7 pesan, 22449 → 21108 huruf   ← kiriman ke-3
```

Sebelum perbaikan, kiriman kedua berbunyi `5 pesan, 18756 → 3510 huruf (0 sisipan dipatok)`.

`[PROMPT_KOMPOSISI]` menegaskan dari sisi lain: `riwayat=5 pesan/19202 huruf`, lalu
`riwayat=7 pesan/21108 huruf`. Peta repo dan ingatan temuan akhirnya sampai ke model **di kiriman
lanjutan**, bukan hanya di yang pertama.

### Kiriman ketiga membuktikan hal kedua

22.449 → 21.108: **masih memangkas 1.341 huruf**. Satu jawaban lama yang panjang tetap dipotong ke
800. Jadi perapian riwayat untuk pesan biasa tidak ikut mati — yang kebal hanya sisipan, persis
seperti yang dirancang. Perbaikan yang mematikan penjaga lain akan terlihat sama berhasilnya di
kiriman kedua; baris ketiga inilah yang membedakannya.

### Dua tahap, dan angka `0` yang menyelamatkan dari salah kesimpulan

Sesudah deploy server tetapi SEBELUM klien 4.2.7, log berbunyi
`5 pesan, 18756 → 3510 huruf (0 sisipan dipatok)`. Tanpa hitungan sisipan di baris itu, kita akan
menyimpulkan perbaikannya gagal — padahal yang kurang hanyalah separuh kliennya, yang masih
membuang penanda sebelum mengirim.

Hitungan itu ditambahkan saat memperbaiki, bukan sesudah bingung.

## Biaya yang kini benar-benar dibayar

Riwayat yang terkirim naik dari ±2.000 huruf menjadi **±19.000–21.000 huruf** per pesan Engineer
(±5.000 token). Itu memang maksudnya sejak peta dibuat — tetapi sampai hari ini ia tak pernah
benar-benar terkirim di kiriman lanjutan, jadi biayanya juga belum pernah terasa.

## Perlu DEPLOY

Ini menyentuh `agent-process`. Perubahan kliennya ikut rilis berikutnya; perubahan servernya butuh
deploy oleh Owner.

**Cara memastikannya live:** kirim **dua pesan berturut-turut** di satu percakapan Engineer, lalu
lihat log `[Riwayat]`. Angka sesudah panah harus **tetap belasan ribu**, bukan turun ke dua ribuan.
