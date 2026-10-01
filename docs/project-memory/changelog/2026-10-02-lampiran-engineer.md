# 2 Oktober 2026 — Engineer diberi mata: lampiran gambar & dokumen (dan satu medan yang tak pernah cocok)

## Permintaan Owner

> *"menempelkan berkas maupun gambar ke engineer belum ada, karena itu sebagai **mata** untuk
> engineer terhadap aplikasi yang dikerjakannya menyangkut nanti **tata letak** yang seharusnya
> berada. Dan **dokumen** yang bisa ditempel agar engineer tahu instruksi secara teknis."*

Engineer sudah bisa **membaca kode** sejak 1 Oktober, ketika kacamata kudanya dilepas. Ini yang
membuatnya bisa **melihat hasilnya**.

Tangkapan layar adalah **satu-satunya** bukti tentang rupa aplikasi — tata letak, jarak, warna, glif
yang tampil sebagai kotak. Itu tidak bisa diturunkan dari kode sumber, berapa pun banyak kode yang
dibaca.

## Cacat yang ketahuan saat mengerjakannya

Jalur kliennya sudah generik: `buildFileData()` → base64 → payload `file`. Tombolnya saja yang
dikunci ke `ws-lite` dan `ws-assistant`.

Tetapi saat memeriksa sisi server, ketahuan **nama medan yang tidak pernah cocok**:

| | Medan |
|---|---|
| Klien kirim (`AssistantService.buildFileData`) | `{ name, **type**, size, data }` |
| Server baca (`request_parser`) | `file.**mimeType**` |

Diperiksa: **`mimeType` nol kemunculan** di `frontend/src` maupun `mametlite/src`. Satu-satunya
pembuat muatan ini adalah `buildFileData`, dan ia mengirim `type`.

**Jadi cabang gambar tidak pernah menyala.** Setiap tangkapan layar yang dilampirkan — di ruang mana
pun, sejak fitur itu ada — jatuh ke cabang terakhir, dan model hanya menerima:

```
[DOKUMEN TERLAMPIR: tataletak.png]
(Catatan: Edge Function saat ini memprioritaskan teks/gambar…)
```

Gambarnya **tidak pernah dikirim**. Fitur yang terlihat ada tetapi buta, dan tak ada yang memberi
tahu. Membuka tombolnya untuk Engineer tanpa memperbaiki ini hanya akan memperbanyak kebutaan itu.

## Yang dikerjakan

### 1. Medannya dipertemukan

Server menerima **keduanya** — `type` dari klien, `mimeType` untuk pemanggil lama. Dan bila mime
tidak terbaca sama sekali (peramban kadang mengirimnya kosong), **akhiran berkas** yang menentukan:
`.png .jpg .jpeg .gif .webp .bmp`.

Klien **tidak diubah**. Yang salah bukan pengirimnya — ia memakai `type` sejak awal, dan `type`
memang nama standarnya pada objek `File`.

### 2. Dokumen teknis bisa dibaca

Dulu hanya `.txt .csv .md`. Kini ditambah `.json .yaml .sql .js .jsx .mjs .cjs .ts .tsx .html .css
.xml .ini .env .log .sh .ps1 .py` — semuanya teks biasa, **tidak butuh mesin baru**. Batas 50.000
huruf dipertahankan, bukan dibuka lebar diam-diam.

### 3. Yang tidak didukung dikatakan apa adanya

Kalimat lama berjanji *"PDF akan dibaca secara ringkas jika memungkinkan"* — janji yang **tidak
pernah ditepati siapa pun** di jalur ini. Model lalu menebak isi dari nama berkas.

Sekarang: **"ISINYA TIDAK DIBACA"**, disertai daftar yang didukung dan larangan tegas menebak isi
dari nama berkas.

### 4. Tombolnya dibuka untuk Engineer

Dua ruang lama tidak dicabut. Judul tombolnya di Engineer menyebut T12 di tempat Owner menekannya:
*"isinya ikut ke penyedia model"* — bukan hanya tertulis di dokumen yang tak dibaca saat sedang
bekerja.

### 5. Model diberi tahu

Pelajaran termahal 1 Oktober: **kemampuan yang tidak disebut di prompt tidak akan pernah dipakai.**
Langkah `[0.2e]` ditambahkan: sebut dulu apa yang **dilihat** sebelum menafsirkan, katakan terus
terang bila gambarnya terlalu kecil atau terpotong, perlakukan dokumen sebagai instruksi Owner dan
kutip bagian yang dijadikan dasar, dan bila melihat penanda `ISINYA TIDAK DIBACA` — **jangan menebak
dari nama berkas**, minta isinya sebagai teks.

## Risiko yang Owner terima secara sadar

> *"saya sadar apa pun yang terkirim ke model itu jadi risiko saya karena keterbatasan
> infrastruktur."*

Sejalan dengan T12 (membaca berarti mengirim). Keputusan tercatat; batasnya tidak digeser diam-diam.

## Uji

`uji/uji-lampiran-engineer.mjs` (baru) — 27 pemeriksaan. **73/73 berkas uji hijau**, klien lolos
parser esbuild, bundel `agent-process` bersih.

Satu asersi khusus menjaga jebakan yang sudah menggigit hari ini juga: **tidak ada backtick** di
dalam langkah `[0.2e]`. Berkas itu satu template literal raksasa, dan satu backtick di teks instruksi
menutupnya serta menggagalkan deploy — persis yang terjadi beberapa jam sebelumnya saat menulis
langkah `[0.2d]`.

## Perlu DEPLOY

`request_parser.ts` dan `engineer_context.ts` ada di `agent-process`. Tombolnya ikut rilis klien
berikutnya.

**Cara memastikan live:** lampirkan tangkapan layar ke Engineer dan minta ia menyebut **apa yang
dilihatnya**. Kalau ia menyebut warna, posisi, atau tulisan yang ada di gambar — matanya terbuka.
Kalau ia hanya menyebut nama berkasnya, gambarnya masih tidak sampai.
