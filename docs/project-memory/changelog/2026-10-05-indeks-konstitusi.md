# 5 Oktober 2026 — Konstitusi berhenti dibaca-lalu-dibuang

## Permintaan Owner

> *"lanjut ke konstitusi yang tertinggal setelah boot"*

Keberatan saya sudah disampaikan **dua kali** sebelum ini: arah biayanya berlawanan dengan item
120 — ini **menambah** token, bukan memangkas — dan saldo sedang di 1.048 token. Owner tetap
memutuskan lanjut. Dikerjakan penuh, dengan angkanya ditaruh di meja lebih dulu.

## Dua cacat yang saling menyembunyikan

### 1. Isinya dibaca tiap boot, lalu dibuang

`_loadStaticKnowledge()` membaca **33 berkas konstitusi** — `168.299 huruf ≈ 43.942 token` — ke
`brain.static.raw` setiap kali Engineer hidup.

Ditelusuri ke seluruh repo: **`raw` punya NOL pemakai.** Yang mengalir hanya jumlahnya:

```js
staticKnowledgeLoaded: brain.static?.loadedFiles?.length || 0   // TaskHandlers.js
```

Dan angka itu pun berhenti di `projectContext` → `brain.dynamic`, yang **hanya ditugaskan, tak
pernah dibaca** (`generatePatch` menerima `brain` tetapi tidak menyentuh `static` maupun
`dynamic`). Jadi 33 pembacaan berkas per boot, isinya dibuang, jumlahnya tak sampai ke mana-mana.

Akibat yang paling merugikan: Engineer melaporkan *"Coverage BRAIN 1 ✓"* tanpa pernah membaca satu
pun aturan yang Owner tulis — dan "BRAIN 1" yang dilaporkannya itu sebenarnya **7 baris** dari
`project_memory_entries`, bukan konstitusi.

### 2. Daftarnya dipaku, dan sudah melenceng

32 jalurnya ditulis tangan di `engineer.js`. Dicocokkan dengan foldernya:

```
constitution/28_PROSEDUR_KERJA_ENGINEER.md   ADA di disk, TIDAK di daftar
```

Itu justru berkas yang **mengatur cara Engineer bekerja**. Ia tak pernah ikut termuat, dan tak ada
yang menyadarinya berbulan-bulan — **karena isinya toh dibuang.** Cacat kedua bersembunyi di balik
yang pertama; menutup satu tanpa yang lain hanya akan memindahkan kebisuannya.

## Yang dikerjakan

| | |
|---|---|
| `engineer:indeks-konstitusi` (main) | **memindai** folder — tak ada daftar yang bisa melenceng lagi |
| yang menyeberangi IPC | alamat + judul, **±2 KB** alih-alih 168 KB |
| `catatanKonstitusi()` | menyusun indeks untuk sisipan, sekeluarga `catatanPetaRepo` |
| `_loadStaticKnowledge()` | tidak lagi mengisi `raw`; menyimpan alamat + judul |

Judul diambil dari tajuk `#` pertama dan **hanya disertakan bila ia menambah sesuatu** di luar nama
berkasnya. Terukur: cuma **7 dari 33** yang begitu — `01_VISION.md — 01_VISION.md` tidak menambah
apa pun. Itu menurunkan indeks dari 565 ke 384 token sebelum blok aturan ditambahkan.

Hanya **2.000 huruf pertama** tiap berkas yang dibaca untuk mengambil judulnya. Membaca utuh akan
mengulangi persis pemborosan yang sedang ditutup.

### Daftar lama DIPERTAHANKAN sebagai cadangan

`constitutionPaths` tidak dihapus. Ia dipakai bila pemindaian gagal — misalnya Electron lama tanpa
kanal baru. Tanpa itu, perbaikan ini bisa membuat Engineer kehilangan seluruh konstitusinya:
menukar satu kerugian dengan kerugian lain.

## Biayanya, apa adanya

```
indeks terkirim : 2.210 huruf ≈   577 token  — SETIAP pesan
isi penuh       : 168.299 huruf ≈ 43.942 token — dibaca lalu dibuang, tiap boot
```

**Ini MENAMBAH 577 token per pesan.** Bukan penghematan, dan tidak boleh disamakan dengan item 120:
peta repo bisa dipangkas karena ia **sudah dikirim**; konstitusi **tidak dikirim sama sekali**.

Yang ditukar: 577 token per pesan, melawan 43.942 token yang dibaca lalu dibuang tiap boot — dan
melawan Engineer yang mengaku punya cakupan yang tak pernah ia punya.

Satu asersi menjaga agar biaya ini **tidak merayap**: di atas 700 token, uji jatuh dan keputusannya
harus ditimbang ulang.

## Tiga bahaya yang dibawa indeks, dijaga di dalam indeksnya sendiri

Sama seperti item 120: memangkas membuka kelas kesalahan baru, dan larangannya ditulis di dalam
teks yang dikirim — bukan diserahkan pada ingatan model.

- **jangan mengaku sudah membaca** berkas yang belum dibuka — ini cacat aslinya
- **jangan menyimpulkan sebuah aturan tidak ada** dari judulnya; sebagian judul cuma nama berkas
- **baca berkasnya lebih dulu** untuk pertanyaan aturan, jangan menjawab dari ingatan atau kode

Dan caranya diberikan, bukan sekadar diperintahkan: `git show HEAD:<alamat>` sudah jalan **tanpa
dialog izin** sejak 4.2.5. Yang hilang selama ini bukan kemampuan membaca, melainkan pengetahuan
bahwa ada yang bisa dibaca.

## Uji

`uji/uji-indeks-konstitusi.mjs`.

| Mutasi | Asersi jatuh |
|---|---|
| M1 klaim "ini daftar, bukan isi" dicabut | 1 |
| M2 larangan mengaku sudah membaca dihapus | 1 |
| M3 cara membaca dicabut (indeks jadi membutakan) | 2 |
| M4 tidak ikut sisipan (disusun lalu dibuang) | 1 |
| M5 cadangan dicabut | 1 |
| M6 berkas dibaca UTUH lagi untuk judul | 1 |

**M1 sempat terbaca "tidak menggigit" — itu sed-nya yang tak pernah menempel, bukan asersinya.**
Diulang dengan Edit: jatuh 1. Pelajaran yang sama dengan `\b` jadi backspace: perubahan ber-kutip
dan ber-backslash jangan lewat `sed`.

### Dua asersi rapuh milik uji LAIN ikut jatuh — dan ini kali KEEMPAT hari ini

`uji-peta-repo` dan `uji-sisipan-dipatok` sama-sama memaku **isi larik sisipan persis**
(`[catatanAkar, catatanPeta, ringkasanTemuan]`), jadi menambah sisipan keempat yang sah
menjatuhkan keduanya tanpa ada yang rusak. Kata "ketiga sisipan" di salah satunya ikut jadi bohong
begitu jumlahnya berubah.

Diganti dengan sifatnya: `catatanPeta` **ada di dalam** larik; ketiga unsur lama masih ada; dan
**hanya ada SATU tempat penandaan `[PATOK]: true`**, sehingga seluruh isi larik pasti lewat jalur
yang sama. Dibuktikan masih menggigit lewat N1–N3 (mengeluarkan peta, mengeluarkan akar+temuan,
mencabut PATOK).

Empat kali dalam satu hari asersi yang menguji **ejaan baris** menjatuhkan perubahan yang benar.
Polanya cukup jelas untuk disebut: asersi yang menyalin sepotong kode apa adanya akan menuduh
setiap penambahan yang sah.

**84/84 berkas uji hijau.**

## PERLU RILIS KLIEN — dan jalankan ulang, bukan muat ulang

`main.cjs` dan `preload.cjs` ikut berubah, jadi `npm run desktop` harus **dijalankan ulang**; muat
ulang jendela tidak cukup. Untuk .exe, perlu build baru.

**Cara memastikan live:** `[PROMPT_KOMPOSISI]` — `riwayat` harus naik dari **2.687** ke **±4.900
huruf** (indeks konstitusi 2.210 masuk ke sisipan). Lalu tanya sesuatu yang menyangkut aturan,
mis. *"apa kata konstitusi tentang mengubah file CORE IMMUTABLE?"* — Engineer harus
**menjalankan `git show`** pada berkas konstitusi lebih dulu, bukan menjawab dari ingatan.

> ⚠️ Bila `riwayat` tetap 2.687, indeksnya tidak sampai. Periksa apakah Electron benar-benar
> dijalankan ulang: kanal `engineer:indeks-konstitusi` baru ada di proses utama yang baru.

---

## Tambahan sesudah Owner bertanya *"hanya menanyakan saja? tidak ada yang lain?"*

Pertanyaan itu tepat, dan jawabannya: **tidak cukup.** Dua kekurangan nyata.

### 1. Perbaikan yang tidak bisa dijalankan uji

Pemindainya semula ditulis **di dalam `main.cjs`**. Berkas itu menyalakan Electron saat diimpor,
jadi apa pun di dalamnya hanya bisa diperiksa lewat **teksnya**.

Itu lemah justru di sini: cacat yang ditutup adalah **daftar yang melenceng diam-diam selama
berbulan-bulan**. Penggantinya yang hanya diperiksa lewat teks bisa melenceng lagi dengan cara
yang persis sama, dan tak ada yang akan tahu — pola kegagalan yang sama, cuma pindah tempat.

Dipindahkan ke `frontend/electron/indeksKonstitusi.cjs`, mengikuti `alatFolderJalan.cjs`
(`pecahPerintah`, `tanpaPersetujuan`) yang memang sudah memakai pola itu. Kini ujinya
**MENJALANKAN** pemindai terhadap folder sungguhan:

```
33 berkas terpindai
constitution/28_PROSEDUR_KERJA_ENGINEER.md IKUT   ← yang hilang dari daftar paku
tidak satu pun .md di folder yang luput
judul hanya untuk yang menambah informasi (7/33)
akar kosong / null / tak ada -> daftar kosong, bukan lempar
```

Asersi berkas 28 itu yang paling berharga: bila ia jatuh suatu hari, pemindainya melenceng lagi.

| Mutasi modul | Asersi jatuh |
|---|---|
| P1 folder salah | 4 |
| P2 berkas akar dicabut | 1 |
| P3 judul mubazir ikut dikirim | 1 |
| P4 berkas dibaca utuh lagi | 1 |
| P5 penjaga akar tak sah dicabut | 1 |

**P3 sempat terbaca "tidak menggigit" — lagi-lagi sed-nya yang tak menempel, bukan asersinya.**
Diulang dengan Edit: jatuh 1 (`judul hanya untuk yang menambah informasi (33/33)`). Ini kedua
kalinya dalam satu item, dan ketiga kalinya hari ini: **mutasi lewat `sed` yang menyentuh kutip
atau backslash tidak boleh dipercaya tanpa dipastikan menempel.**

### 2. Uji live-nya cuma satu pertanyaan — tanpa kendali

Rancangan semula: tanya soal aturan, lihat apakah Engineer menjalankan `git show`. Itu menguji
satu arah saja.

Aturan *"BACA berkasnya lebih dulu"* membawa bahaya kebalikannya: Engineer bisa membuka berkas
konstitusi untuk **setiap** pertanyaan, termasuk yang sepele. Itu menukar satu kegagalan (tak
pernah membaca) dengan kegagalan lain (selalu membaca — tiap jawaban jadi mahal dalam perintah
maupun token). **Uji satu-arah akan menyebut itu sukses.**

§5b kini memuat tiga langkah, dan yang ketiga adalah kendalinya: pertanyaan sepele
(*"berapa berkas di `uji/`?"*) **TIDAK** boleh memicu pembacaan konstitusi.

**84/84 berkas uji hijau.**
