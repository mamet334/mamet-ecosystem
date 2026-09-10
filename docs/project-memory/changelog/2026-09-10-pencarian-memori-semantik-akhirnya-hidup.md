# Pencarian Memori Semantik Akhirnya Hidup — dan Ambang 0,8 yang Nyaris Membuatnya Sia-Sia

**Tanggal:** 10 September 2026
**Roadmap:** Item 54 (menutup Item 46)

## Yang ditutup

Item 46 menyisakan satu kalimat: *"jalur penulisan yang sebenarnya belum
tersentuh."* Seluruh memori Owner ditulis oleh `MemoryGovernorService` di
frontend, dan tak satu pun punya embedding. `match_memories` karenanya mustahil
menemukan apa pun — pencarian memori berbasis makna tidak pernah hidup sejak
fungsi itu ada.

Sekarang hidup.

## Pilihan (a): endpoint di server

Item 46 mencatat dua opsi. Yang diambil adalah endpoint kecil di
`agent-process` (`{ action: 'embed', text }`), bukan menghitung embedding di
klien.

Alasannya struktural, bukan selera:

- Kunci Gemini tidak boleh tersebar ke setiap perangkat.
- Dimensi vektor harus ditentukan di **satu** tempat. Opsi (b) berarti menyalin
  logika provider ke frontend — persis cara penjaga dimensi 768 dulu tercecer
  di dua berkas dan bertahan berbulan-bulan tanpa ketahuan.

### Penjagaan yang wajib

`agent-process` di-deploy `--no-verify-jwt`, karena `/health` dan `proxy_fetch`
dipanggil langsung dari browser. Endpoint ini karenanya harus memeriksa
tokennya sendiri. Tanpa itu, siapa pun di internet bisa membakar kunci Gemini
Owner.

| Uji | Hasil |
|---|---|
| Tanpa token | `401` |
| Anon key (bukan pengguna) | `401` |
| `proxy_fetch` masih jalan | ya |

### Satu jebakan saat menyambungkannya

Blok POST di `index.ts` dibungkus `try { ... } catch (_) { /* lanjut */ }` yang
menelan **semua** galat, bukan hanya kegagalan parse JSON. Menaruh action baru
di dalamnya berarti setiap galatnya diam-diam jatuh ke pipeline chat —
pemanggil menerima jawaban chat untuk permintaan embedding, tanpa satu pun
pesan galat.

Parse-nya dipisahkan. Kini hanya kegagalan parse yang boleh diabaikan dalam
diam.

## Jalur tulis ketiga yang nyaris terlewat lagi

Setelah memperbaiki `MemoryGovernorService`, saya hampir melapor selesai. Lalu
kolom `source` diperiksa:

| Sumber | Baris | Sejak |
|---|---|---|
| MemoryGovernorService | 3 | 3 Sep |
| rule_based_async_worker | 2 | 23 Jun |
| MemoryService | 1 | 24 Jul |

`MemoryService` mendelegasikan ke Governor bila tersedia, jadi jalur utamanya
aman. Tapi jalur cadangannya menulis langsung tanpa vektor — dan diam. Baris 24
Juli itu buktinya.

Jalur itu **sengaja tidak** diberi embedding sendiri: ia justru menyala ketika
Governor tidak ada, jadi menduplikasi logika di sana salah. Yang ditambahkan
adalah suara — `console.warn` dan event `Memory:StoredWithoutEmbedding`.

Ini kesalahan yang sama yang sudah tercatat di Item 46: memetakan pemanggil di
kode, bukan penghasil baris di produksi. Kolom `source` yang menyelamatkannya,
untuk kedua kalinya.

## Backfill

Metode `backfillMissingEmbeddings()` ditambahkan ke `MemoryGovernorService`.
Aman diulang — hanya menyentuh baris yang `embedding`-nya NULL.

Dijalankan Owner dari konsol: **6 berhasil, 0 gagal, dari 6 diperiksa.**

| | Sebelum | Sesudah |
|---|---|---|
| Total memori | 7 | 7 |
| Bervektor | 1 | **7** |
| Tanpa vektor | 6 | **0** |
| Dimensi | — | 3072 (min = max) |

## Ambang 0,8 — temuan yang hanya bisa muncul setelah datanya benar

Angka 0,8 di `request_pipeline.ts` tidak pernah teruji. Selama tidak ada memori
bervektor, pencarian itu mustahil mengembalikan apa pun, jadi ambang berapa pun
menghasilkan hal yang sama: nol.

Begitu ketujuh memori bervektor, ia langsung terbukti terlalu ketat. Diukur
dengan vektor "saya suka kopi" sebagai kueri:

| Memori | Kemiripan |
|---|---|
| saya suka kopi | 1,0000 |
| saya juga suka teh | **0,7263** |
| ya, saya suka menggunakan ai | 0,5728 |
| Menyukai clean architecture dan micro-kernel | 0,5256 |
| dan saya kuliah di universitas terbuka (UT) | 0,5138 |
| saya lebih suka penjelasan dengan tabel | 0,5117 |
| nama panggilan saya adalah pak slamet | 0,5083 |

Yang benar-benar berhubungan duduk di 0,73. Yang tidak berhubungan mengumpul
rapat di 0,51–0,57.

Ambang 0,8 memotong **tepat di atas** pasangan yang benar. Ia hanya akan
meloloskan teks yang nyaris identik — artinya pencarian semantiknya tetap akan
terasa mati meski datanya sudah benar. Perbaikan Item 46 nyaris menjadi
kosmetik.

### Bukti bahwa 0,8 penyimpangan, bukan kebijakan

Pencarian **dokumen** sudah lama memakai ambang **0,60–0,68**, dinamis menurut
panjang pertanyaan (`execution_context.ts:16-19`). Hanya pencarian memori yang
di-hardcode 0,8.

### Keputusan Owner: 0,70

Ditaruh di celah lebar antara 0,73 dan 0,57. Dampaknya terukur, bukan teoretis:

| Ambang | Memori lolos untuk kueri "kopi" |
|---|---|
| 0,80 | **1** — hanya dirinya sendiri |
| 0,70 | **2** — kopi + teh |

Konsekuensi biaya disadari. Item 44 mencatat 99,3% belanja Owner ada di prompt,
jadi meloloskan lebih banyak memori berarti prompt lebih panjang. Yang
membatasinya adalah `match_count: 5` — paling banyak lima memori, apa pun
ambangnya.

## Bukti tiga ujung

1. **Klien:** `[MemoryGovernorService] Embedding didapat: 3072 dimensi.`
2. **Basis data:** 7 dari 7 bervektor, `vector_dims` 3072 min dan max.
3. **Fungsi pencariannya sendiri:** `match_memories` mengembalikan
   `similarity: 1` untuk memori itu sendiri, dan **0,7263 untuk "teh" terhadap
   kueri "kopi"** — dua kalimat yang tidak berbagi satu kata pun selain "suka".
   Pencarian SQL biasa tidak akan pernah menemukannya.

Ujung ketiga itu yang penting. Dua yang pertama hanya membuktikan ada angka di
kolom; yang ketiga membuktikan fungsinya benar-benar menemukan sesuatu — untuk
pertama kalinya.

Deploy `agent-process` diverifikasi `[MATCH]`.

## Yang belum terbukti

Ambang 0,70 belum diuji pada percakapan nyata dengan basis memori yang lebih
besar. Dengan tujuh memori, jarak antar kelompok masih lebar dan mudah
dipisahkan. Pada ratusan memori jaraknya akan menyempit, dan angka ini mungkin
perlu ditinjau ulang. Dicatat sebagai catatan, bukan diklaim selesai selamanya.
