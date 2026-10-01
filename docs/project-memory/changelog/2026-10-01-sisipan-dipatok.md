# 1 Oktober 2026 — Sisipan konteks dipatok: peta repo berhenti dibuang diam-diam

## Sebabnya diukur, bukan diduga

Uji peta repo gagal: Engineer mengabaikan larangan "tanpa menjalankan perintah", langsung menyusun
perintah, dan perintahnya gagal karena kutipnya rusak — kelas kegagalan yang sama dengan 28 September.

Dua angka menutup pertanyaannya:

| | |
|---|---|
| Peta di proses utama | **15.493 huruf** (DevTools: `petaRepo().length` → `15493`) |
| Riwayat yang sampai ke model | **4.042 huruf** (`[PROMPT_KOMPOSISI]`, 15.00 WIB) |

Model bukan mengabaikan peta. **Ia tidak pernah melihatnya.**

Anggaran dicoret sebagai tersangka lewat hitungan, bukan perasaan: pada anggaran terkecil yang
mungkin (`ANGGARAN_MIN` 8.000 − 2.000 cadangan jawaban = 6.000 token), peta (±3.873 token) ditambah
seluruh riwayat (±1.010 token) hanya 4.883 token — muat.

## Dua cacat, satu akar

Sisipan diperlakukan sebagai **pesan paling tua**.

**1. Indeks dihitung pada daftar yang salah.** `simpanMulaiDari` menyimpan panjang daftar
**tampilan**, tetapi `pilihPesanKonteks` menerapkannya pada `sisipan + tampilan` yang lebih panjang.
Merusak dua arah sekaligus: sisipan terbuang, dan sebagai gantinya pesan lama yang seharusnya sudah
dibersihkan justru ikut terkirim.

**2. Pemotong anggaran membuang dari yang paling tua.** Sisipan ada di posisi paling tua, jadi
konteks yang paling tidak boleh hilang adalah yang **pertama** dikorbankan setiap kali percakapan
memanjang. Memperbaiki indeksnya saja akan menyembuhkan hari ini dan kambuh nanti.

## Yang dikerjakan

Sisipan kini dikenali dari **penandanya** (`_patok`), bukan dari posisinya:

- dihitung **lebih dulu** terhadap anggaran, lalu sisanya untuk percakapan
- `mulaiDari` hanya berlaku pada bagian percakapan
- penanda internal dibuang sebelum payload dikirim, jadi tak ada yang bocor ke server

Berlaku untuk ketiganya: catatan akar repo, peta repo, dan ingatan temuan.

### Satu keadaan yang sengaja tetap melepas patokan

Bila memakai sisipan akan **menyingkirkan pertanyaan terbaru itu sendiri**, patokan dilepas.
Konteks tambahan yang mengusir pertanyaannya sendiri lebih buruk daripada tidak ada konteks:
model berjendela sempit akan menerima peta tanpa pertanyaan, lalu menjawab entah apa.

Kejadiannya dilaporkan lewat `patokDilepas`, bukan hilang diam-diam.

## Biayanya, disebut di muka

Peta ±3.873 token kini **benar-benar** ikut setiap kiriman Engineer. Itu memang maksudnya sejak
awal — tetapi sampai hari ini ia tak pernah terkirim, jadi biayanya juga belum pernah terasa.

## Uji

`uji/uji-sisipan-dipatok.mjs` (baru) — 19 pemeriksaan, termasuk keadaan sempit tempat patokan harus
melepaskan diri, dan jaminan bahwa percakapan **tanpa** sisipan tidak berubah perilakunya sama sekali.
**64/64 berkas uji hijau**, dua berkas tersunting lolos parser esbuild.

### Angka ujinya diukur, bukan ditaksir

Versi pertama uji ini merah dua kali — dua-duanya aritmetika uji, bukan kodenya:

1. `mulaiDari` disetel sama dengan panjang percakapan, sehingga **tidak ada** pesan tersisa; yang
   diharapkan ikut memang seharusnya tidak ada.
2. Anggaran disetel terlalu longgar, jadi tak ada satu pun pesan yang benar-benar dipotong —
   asersi "percakapan lama yang dikorbankan" hijau tanpa pernah ada yang dikorbankan.

Keduanya diperbaiki dengan **mengukur** `tokenPesan()` lebih dulu (4.000 huruf = 1.004 token), lalu
menyetel anggaran pada angka yang memotong tepat satu pesan. Uji yang anggarannya longgar akan tetap
hijau walau pemotongnya rusak.

## Belum sampai ke aplikasi

Ada di `main`, menunggu rilis berikutnya. Uji peta repo harus diulang **di percakapan baru**.
