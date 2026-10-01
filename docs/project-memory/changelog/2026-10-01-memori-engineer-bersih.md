# 1 Oktober 2026 — Engineer berhenti menulis memori pribadi Owner

## Owner yang melihatnya

Panel Memory Context, lalu pertanyaannya: *"ada yang masuk ke memory context, wajarkah?"*

```
"Engineering session ENG-SESSION-1790841170222-7n6h90"   memory_type: engineer_session, conf 1
"Patch PATCH-1790841319400 applied"                      memory_type: engineer_patch,   conf 1
```

## Diukur, bukan ditebak

| | Jumlah | Rentang |
|---|---|---|
| Sesi Engineer | 3 | **hari itu** |
| Patch Engineer | 3 | **hari itu** |
| Memori Owner yang sungguhan | 12 | sejak 23 Juni |

**Sepertiga daftar memori pribadi Owner lahir dari mesin dalam beberapa jam**, dan bertambah satu
tiap sesi serta tiap patch — tanpa batas.

## Tiga alasan ia dibuang, bukan dipindah

Owner bertanya tepat: *"apakah berguna untuk engineer sendiri? jika berguna, lebih baik tempatnya
yang dipisahkan."*

**1. Tidak ada yang membacanya.** `engineer_session` dan `engineer_patch` hanya muncul di dua tempat
penulisannya dan dua baris komentar JSDoc. Tidak satu pun kode mencarinya kembali — di klien maupun
di server. Ditulis, tidak pernah dibaca.

**2. Isinya nomor mesin.** Jenis memori yang dikenali server adalah `IDENTITY`, `LOCATION`, `JOB`,
`PREFERENCE`, `PROJECT` — semuanya fakta pribadi tentang Owner. Nomor sesi rekayasa benda asing di
sana, dan tersimpan dengan `confidence: 1` sehingga duduk sejajar dengan memori Owner yang nyata.

**3. Melanggar kontraknya sendiri.** Prompt Engineer mengirim, tiap pesan:
`Batasan: … | Tidak boleh menulis memory otomatis | …`

Jadi **memindahkannya ke tabel lain hanya memindahkan sampah ke rak yang lebih rapi.**

## Rumah yang benar sudah ada

Yang Owner inginkan — *"mamet engineer semakin pintar dan tahu di mana dia berada"* — dilayani oleh
mekanisme yang sudah dibangun dan sudah tersambung ke tiap kiriman:

| | |
|---|---|
| **`TEMUAN-ENGINEER.md`** (IngatanTemuan.js, Tahap 3b) | berkas **di dalam repo**, bisa Owner baca & KOREKSI, ikut ter-commit bersama kode yang dibicarakan, selamat walau database dibersihkan. Salah satu dari tiga sisipan tiap kiriman |
| **Brain 1** (`project_memory_entries`) | untuk `Lesson`/`RootCause`/`Solution` — dibaca Engineer tiap pesan |
| **`git log`** | untuk "apa yang berubah, kapan, kenapa". Selalu benar, tidak membeku jadi potret satu saat, dan sejak 4.2.5 bisa dijalankan Engineer **sendiri tanpa izin** |

Baris memori itu hanya menyalin sebagian kecil dari yang terakhir, dalam bentuk yang lebih buruk.

## Perbandingan yang paling menjelaskan

| | Jumlah | Rentang |
|---|---|---|
| Temuan sungguhan (berguna, dibaca tiap pesan) | **1** — TMN-0001 | seminggu |
| Nomor sesi & patch (tak ada pembaca) | **6** | **satu hari** |

**Yang otomatis tumbuh. Yang perlu keputusan, mandek.** Yang satu gratis; yang satu menuntut Owner
menyetujui penulisan berkas. Jadi sistem ini diam-diam mengumpulkan yang tak berguna dan membiarkan
yang berguna kering.

**Dugaan sebab keringnya, dan baru hilang hari ini:** TMN-0001 lahir 24 September, sesudah itu nol —
dan kacamata kuda Engineer baru dilepas 1 Oktober. Sebelumnya ia dilarang menjalankan perintah dan
dilarang memakai apa pun di luar dokumen RAG. TMN-0001 sendiri lahir dari `git grep`: temuan hanya
bisa muncul dari menengok. **Belum terbukti** — perlu diuji sekarang setelah ia bisa melihat.

## Uji

`uji/uji-memori-engineer-bersih.mjs` (baru) — 14 pemeriksaan. **70/70 berkas uji hijau**, dua berkas
tersunting lolos parser esbuild.

Separuh ujinya menjaga yang **bukan** sasaran: finalisasi & verifikasi sesi, `MemoryGovernorService`,
`SessionArtifact`, blok Tahap 6, peristiwa `Engineer:PatchApplied`, dan checkpoint — semuanya tetap
hidup. Membuang satu panggilan dari tengah fungsi gampang menyeret tetangganya.

Dua asersi terakhir menjaga rumah yang benar tetap tersambung: `TEMUAN-ENGINEER.md` tetap di dalam
repo, dan ringkasan temuan tetap ikut sebagai sisipan tiap kiriman.

## Yang BELUM dikerjakan

**Enam baris yang telanjur masuk masih ada di `user_memories`.** Penghapusan permanen menunggu izin
tegas Owner.

## Belum sampai ke aplikasi

Ada di `main`. Perubahan renderer saja — ikut rilis berikutnya, tidak perlu deploy.
