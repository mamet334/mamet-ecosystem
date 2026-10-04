# 4 Oktober 2026 — Plafon token diturunkan, bukan permintaan dibuang

## Kenapa ini yang dikejar

Owner memasang 4.2.11 tetapi **tidak bisa menguji apa pun** karena saldo OpenRouter habis. Semua
uji live yang menumpuk — empat untuk 4.2.10, satu untuk 4.2.11, enam warisan — menunggu satu hal
yang sama: satu panggilan model.

Jadi yang dikerjakan adalah penghalangnya sendiri, bukan menambah daftar tunggu.

## Keadaannya lebih buruk daripada catatan lama

Catatan lama berbunyi: *"`max_tokens: 8192` dipaku di enam tempat; pada 402 yang menyebut 'can
only afford N', ulangi sekali dengan N."* Diperiksa 4 Okt, dan ternyata:

**402 hanya ditangani di jalur embedding** (`vector_utils.ts:70`). Jalur **chat** tidak
menanganinya sama sekali:

```ts
if (!res.ok) throw new Error(`OpenRouter API Error: ${res.status} ${await res.text()}`);
```

Badan jawaban OpenRouter — yang **menyebutkan** berapa token yang masih terjangkau — ikut masuk ke
pesan galat, lalu dibuang sebagai teks mentah. Keterangannya sampai; tak ada yang memakainya.

## Akarnya: plafon diperlakukan sebagai kebutuhan

`max_tokens: 8192` adalah **plafon**, bukan panjang jawaban yang dibutuhkan. Tetapi OpenRouter
memutuskan keterjangkauan dari plafon yang **diminta**. Jadi saldo yang masih cukup untuk jawaban
pendek pun ditolak — semata karena yang diminta 8192.

## Yang dikerjakan

`MAKS_TOKEN_JAWABAN` menggantikan keenam angka yang dipaku. Lalu di
`kirimOpenRouterDenganReasoning`: pada 402, angka terjangkau dibaca dari badan jawaban dan
permintaan diulang **sekali** dengan plafon itu.

**Pola ulang-cobanya mengikuti yang sudah ada di fungsi yang sama** untuk HTTP 400 (model menolak
nalar dimatikan): periksa respons gagal, putuskan, ulangi sekali. Bukan mekanisme baru. Cabang 400
itu diuji tetap utuh.

Satu hal yang harus diperbaiki urutannya: baris lama memulangkan **setiap** kegagalan non-400 lebih
dulu, sehingga 402 tak pernah sampai ke mana pun. Cabang 402 karena itu ditaruh sebelum cabang 400.

Permintaan yang ditolak 402 **tidak ditagih**, jadi pengulangan ini tidak menambah biaya.

### Lantai kelayakan — kenapa tidak selalu diulang

Mengulang dengan plafon sangat kecil menghasilkan jawaban terpotong yang **tampak seperti model
gagal atau membodohkan diri**. Itu lebih buruk daripada galat yang terang, karena ia menyesatkan.

Di bawah `MIN_TOKEN_LAYAK = 512` permintaan tidak diulang, dan Owner menerima kalimat yang bisa
ditindaklanjuti:

> *"Saldo OpenRouter hanya cukup untuk 180 token jawaban, sedangkan jawaban yang layak butuh
> minimal 512. Permintaan TIDAK diulang dengan plafon sekecil itu — jawaban terpotong akan terlihat
> seperti model gagal. Isi ulang saldo."*

Itu menggantikan dumping JSON mentah, dan **ini bagian yang pasti menolong** apa pun hasil
pengulangannya: Owner akhirnya tahu **berapa** yang terjangkau, bukan hanya bahwa sesuatu gagal.

## Yang tidak bisa saya pastikan

Kalimat 402 OpenRouter tidak bisa saya verifikasi tanpa benar-benar kena 402. Polanya diambil dari
pesan yang **teramati di proyek ini**, bukan dari dokumentasi.

Kalau kalimatnya berubah, pengurainya mengembalikan `null` dan perilakunya **kembali seperti sebelum
perubahan ini** — galatnya dilempar apa adanya. Tebakan yang salah karena itu tidak merugikan apa
pun; ia hanya tidak menolong. Ada asersi khusus untuk jalur itu.

Dan apakah chat Owner benar-benar jalan lagi bergantung pada dua hal di luar kode ini: apakah
OpenRouter melayani permintaan yang lebih kecil, dan apakah angka terjangkaunya ≥ 512. Jadi:
**mungkin menolong, dan pasti memberi tahu.**

## Uji

`uji/uji-saldo-plafon-token.mjs` (baru) — 30 asersi. Modul aslinya **dijalankan di Node** (tanpa
impor apa pun, cukup ditransformasi dari `.ts`) dengan fungsi `kirim` disuntik, dan panggilannya
**dihitung** beserta badan yang dikirim ulang.

| Keadaan | Panggilan |
|---|---|
| berhasil | 1 |
| 402, terjangkau 1234 | **2** — yang kedua `max_tokens: 1234` |
| 402, terjangkau 180 (< lantai) | **1** |
| 402, kalimat tak terbaca | **1** |
| 402, plafon diminta sudah < terjangkau | **1** |

| Mutasi | Asersi jatuh |
|---|---|
| M1 cabang 402 dicabut | 1 |
| M2 **perbaikan salah**: lantai dihapus (jawaban terpotong lolos) | 1 |
| M3 **perbaikan salah**: diulang dengan angka tebakan, bukan N | 2 |
| M4 cabang 400 lama ikut terbuang | 1 |
| M6 badan JSON mentah kembali diteruskan ke Owner | 2 |

### Satu mutasi yang TIDAK menggigit, dan itu benar

M5 menukar pengulangan menjadi **rekursi**, menduga itu akan berputar tak berujung. Ia tidak jatuh —
dan setelah diperiksa, **mutasinya bukan cacat**: pengulangan menyetel plafon tepat ke `n`,
sehingga pada putaran kedua syarat `diminta > n` menjadi `1234 > 1234` dan berhenti sendiri.

Jadi yang menjamin ia berhenti bukan bentuk panggilannya, melainkan syarat itu. Klaim *"tidak
berputar"* yang semula ditulis di uji karena itu **menyesatkan** dan diganti dengan yang benar:
plafon pengulangan harus **mengecil tegas**. Asersi baru itu ikut menjatuhkan M3.

Memaksa M5 menggigit dengan menambah asersi baru akan berarti menguji bentuk kode alih-alih
jaminannya.

**80/80 berkas uji hijau.** Bundel `agent-process` bersih (507,4 kb).

## ✅ DIUJI LIVE — separuh berhasil, separuh gagal, dan gagalnya mengajari

Owner men-deploy lalu mengirim *"apa itu RLS?"* dengan saldo masih habis, dan mengirim dua
tangkapan layar: sebelum dan sesudah.

**Sebelum** — dumping JSON mentah berisi `{"error":{"message":"…can only afford 779…"}}` beserta
`previous_errors` dan URL.

**Sesudah** — persis seperti yang dirancang:

> *"Saldo OpenRouter hanya cukup untuk 733 token jawaban (diminta 8192), dan pengulangan dengan
> plafon itu juga gagal. Isi ulang saldo."*

Jadi **pesannya terbukti**. Tetapi kalimat itu sendiri melaporkan bahwa **pengulangannya gagal** —
dan tangkapan layar pertama menjelaskan kenapa.

### Dua cacat di implementasi pertama, keduanya terbaca dari badan 402 yang nyata

Satu badan 402 memuat **beberapa** kutipan: `779` di tingkat atas, lalu `734`, `1558`, `1558` di
`previous_errors` — karena OpenRouter sudah mencoba beberapa **penyedia** untuk nama model yang
sama, dan harga tiap penyedia berbeda.

| | Cacat | Akibat |
|---|---|---|
| 1 | `.match()` **tanpa `/g`** mengambil kutipan **pertama** (779) | diminta lebih besar daripada batas penyedia termurahnya (734) → ditolak lagi |
| 2 | Diminta **tepat** sebesar angka yang dikutip | angka itu **batas**, bukan nilai aman; dan ia **bergeser** antar panggilan (779 → 733) |

Keduanya diperbaiki: kutipan **terkecil** diambil dari seluruh badan, lalu dikali
`MARGIN_SALDO = 0.9`. Untuk badan nyata di atas: `min(779, 734, 1558) = 734` → diminta **660**.

**Nilai margin itu dipelajari dari produksi, bukan dipilih di muka.** Catatan itu ditulis di
konstantanya supaya tidak terbaca sebagai angka sembarang nanti.

### Badan 402 yang nyata itu kini jadi data uji

Tangkapan layar Owner masuk ke berkas uji apa adanya — empat kutipan dalam satu badan, dengan
`previous_errors`-nya. Dua mutasi baru meniru **persis** cara ia gagal di produksi:

| Mutasi | Asersi jatuh |
|---|---|
| M7 **cara gagal #1**: ambil kutipan pertama, bukan terkecil | 2 |
| M8 **cara gagal #2**: minta tepat batasnya, tanpa kelonggaran | 2 |
| M9 kelonggaran berlebihan (margin 0,3) menembus lantai | 2 |

Satu asersi lama ikut usang dan diperbarui: ia menuntut plafon ulang **tepat** sama dengan angka
OpenRouter — padahal kelonggaran itulah perbaikannya.

### Yang masih mungkin: saldonya memang terlalu tipis

Perbaikan ini belum tentu membuat chat jalan. Di tangkapan layar kedua prompt-nya hanya **56
token** dan tetap tidak terjangkau. Kalau 660 pun ditolak, batasnya bukan di kode — saldonya
memang tidak cukup untuk jawaban yang berguna, dan pesannya kini mengatakan itu apa adanya:
*"sudah diulang dengan N dan tetap ditolak. Saldonya memang terlalu tipis…"*.

Membedakan dua hal itu — kode yang salah memilih plafon versus saldo yang benar-benar habis —
adalah yang sebelumnya tidak mungkin dilakukan dari dumping JSON.

## Perlu DEPLOY, tanpa rilis klien

`reasoning_openrouter.ts` dan `ai_adapter.ts` keduanya di `agent-process`.

**Cara memastikan live:** kirim satu pesan dengan saldo masih habis. Dua kemungkinan, dan
**keduanya kemajuan**:

1. **Jawaban keluar** — pengulangan berhasil; log fungsi memuat
   `[Saldo] 402: plafon 8192 token tidak terjangkau, hanya N — diulang SEKALI`.
2. **Galat, tetapi berbunyi** *"Saldo OpenRouter hanya cukup untuk N token…"* — pengulangan tidak
   layak, dan angkanya sekarang diketahui.

Yang berarti belum sampai: galat yang masih berbentuk `OpenRouter API Error: 402 {"error":…}`.
