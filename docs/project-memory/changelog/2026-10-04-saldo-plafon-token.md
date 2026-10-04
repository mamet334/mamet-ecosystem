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

## ✅ UJI LIVE KEDUA — kendalanya PINDAH, dan membuka temuan yang lebih besar

Deploy kedua, pertanyaan yang sama. Galatnya berubah bentuk sama sekali:

```
Prompt tokens limit exceeded: 14250 > 3621
```

Tak ada *"can only afford"* sama sekali, jadi jalur baru jatuh ke cabang "tak terbaca" dan
menyuruh **"isi ulang saldo"** — **menyesatkan**, karena saldo sebesar 3.621 token itu **cukup**;
prompt-nyalah yang 14.250. Menurunkan `max_tokens` tidak menolong **sedikit pun** di sini.

Varian ini kini dikenali (`batasPrompt`), tidak diulang (mengecilkan plafon keluaran tak mengubah
ukuran prompt), dan pesannya menghitungkan kelebihannya.

### Dari mana 14.250 token itu — diukur, bukan ditebak

Log `[PROMPT_KOMPOSISI]` untuk pertanyaan **empat kata** *"apa itu rls?"*:

| Bagian | Huruf |
|---|---|
| **`memori_personal_klien`** | **18.195** |
| `blok4_rag` | 7.025 |
| `dasar_identitas_panduan` | 6.030 |
| `blok5_constraint` | 2.706 |
| `blok4_brain` | 2.013 |
| `kontrak_blok1_2` | 1.099 |
| `blok6_format` | 1.248 |
| `blok3_memori` | 196 |
| **riwayat** (2 pesan) | **16.557** |
| pesan Owner | 12 |
| **total** | **55.081 huruf ≈ 14.250 token** ✓ |

Angkanya cocok dengan galatnya, jadi ukuran ini bukan perkiraan.

**Dugaan pertama saya salah dan sempat masuk ke pesan galat.** Saya menulis bahwa *"mode ENGINEER
menyuntikkan aturan + peta repo"* yang membengkak. Datanya membantah: seluruh kontrak Engineer
(`kontrak_blok1_2` + `blok5_constraint`) hanya **±3.800 huruf**. Kalimat itu dicabut sebelum
di-commit — diperiksa dulu, bukan dikirim sebagai tebakan.

### Dua temuan yang sebenarnya, dan keduanya besar

**1. `memori_personal_klien` menyembunyikan konteks Engineer — dan saya salah DUA KALI sebelum
menemukannya.**

Diukur langsung ke basis data: `user_memories` berisi **10 baris, 316 huruf SELURUHNYA**,
terpanjang 45. Tetapi bagian prompt berlabel itu **18.195 huruf** — 57× lipat, dan **identik di
empat kali jalan**, tak peduli pertanyaannya maupun apakah RAG menemukan 8 potongan atau 0.

**Tebakan saya yang pertama:** aturan Engineer + peta repo yang membengkak. Saya tulis di pesan
galat, lalu **dicabut** karena kontrak Engineer (`kontrak_blok1_2` + `blok5_constraint`) hanya
±3.800 huruf.

**Tebakan saya yang kedua:** `globalMemory` kiriman klien, yang di `AssistantService.js:1313`
berisi `trimmedRagContext`. Ini pun **salah** — dan sempat ter-commit: `MAX_RAG_CONTEXT_CHARS = 4000`
membatasi `globalMemory` di **4.000 huruf**, tak mungkin 18.195.

**Yang sebenarnya, dengan bukti:** `context_pipeline.ts:24` menyusun prompt dengan urutan

```ts
agentIdentityPrompt + userContextPrompt + memoryPrompt + engineerContextPrompt
```

`engineerContextPrompt` duduk **persis di antara** blok memori dan kontrak. Dan karena tiap segmen
diukur sebagai **jarak ke segmen berikutnya**, sementara blok Engineer **tidak punya penandanya
sendiri**, ia ikut terhitung ke dalam `memori_personal_klien`.

Jadi tebakan pertama saya **benar**, "koreksi" keduanya yang keliru — dan baru yang ketiga punya
bukti. Konstannya angka 18.195 itulah petunjuknya: memori personal dan RAG berubah tiap
pertanyaan; konteks Engineer tidak.

**Diperbaiki:** `konteks_engineer` kini segmen tersendiri (`llm_orchestrator.ts`). Diuji dengan
menjalankan fungsi aslinya pada prompt tiruan — `konteks_engineer: 14.044` berdiri sendiri, dan
`memori_personal_klien` turun ke 333, ukuran sebenarnya.

Satu cacat ikut terjadi saat menulis perbaikannya: penanda Engineer sempat dicari dengan `cari()`,
yang **sengaja mulai dari awal kontrak** — padahal blok Engineer ada **sebelumnya**, sehingga
hasilnya selalu −1 dan segmennya diam-diam tak pernah muncul. Persis kebisuan yang hendak
dihentikan. Ada asersi khusus untuk itu, dan mutasi M2 menjatuhkan 6 asersi.

**Artinya:** biaya terbesar mode Engineer — ±14.000 huruf ≈ 3.600 token **di setiap pesan** —
selama ini tak pernah punya namanya sendiri di log. Owner melihat "memori personal" sebagai biaya
terbesarnya dan tak punya cara tahu yang sebenarnya. Ini juga memberi angka untuk usul Owner yang
masih tertunda: peta repo dibaca **saat perlu** lewat `git show`, bukan disuntikkan tiap pesan.

**2. Riwayat 16.557 huruf untuk DUA pesan.** Pertanyaannya 12 huruf, jadi pesan satunya ±16.545
huruf — hampir pasti **dumping JSON 402 yang lama**, tersimpan sebagai pesan lalu ikut terkirim di
setiap pesan berikutnya. Galat yang besar **meracuni prompt seterusnya**.

Perbaikan hari ini menutup sumbernya: galat 402 kini pesan pendek, bukan dumping JSON. Tetapi
yang **sudah** tersimpan tetap di riwayat — karena itu pesan barunya menyarankan **mulai
percakapan baru**, yang seketika memotong 16.557 huruf.

### Apa artinya untuk saldo setipis ini

Percakapan baru: 55.081 → ±38.500 huruf ≈ **9.950 token**. Masih di atas 3.621. Jadi pada saldo
sekarang, mode Engineer memang **tidak bisa jalan** — dan itu kesimpulan yang jujur, bukan
kegagalan kode. Yang berubah: Owner kini **tahu angkanya** dan tahu mana yang bisa ditekan.

## Perlu DEPLOY, tanpa rilis klien

`reasoning_openrouter.ts` dan `ai_adapter.ts` keduanya di `agent-process`.

**Cara memastikan live:** kirim satu pesan dengan saldo masih habis. Dua kemungkinan, dan
**keduanya kemajuan**:

1. **Jawaban keluar** — pengulangan berhasil; log fungsi memuat
   `[Saldo] 402: plafon 8192 token tidak terjangkau, hanya N — diulang SEKALI`.
2. **Galat, tetapi berbunyi** *"Saldo OpenRouter hanya cukup untuk N token…"* — pengulangan tidak
   layak, dan angkanya sekarang diketahui.

Yang berarti belum sampai: galat yang masih berbentuk `OpenRouter API Error: 402 {"error":…}`.
