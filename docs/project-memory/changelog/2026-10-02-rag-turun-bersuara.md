# 2 Oktober 2026 — RAG yang mati sendiri akhirnya bersuara

## Koreksi atas laporan saya sendiri

Saat mengusulkan pekerjaan ini saya mengatakan embedding gagal berarti *"model menjawab tanpa
konteks apa pun"*. **Itu terlalu keras.** Ada cadangannya: pencarian dokumen turun ke pencocokan
kata lewat `KnowledgeService`. Dicatat di sini supaya angkanya tidak dipakai ulang sebagai dasar.

Cacatnya tidak hilang karena itu — ia jadi lebih tajam, dan akibatnya **berbeda di dua jalur**.

## Apa yang sebenarnya terjadi

`generateEmbedding` mengembalikan array kosong untuk **semua** kegagalan: tanpa kunci BYOK,
OpenRouter menolak, dimensi tak cocok. Sebabnya hilang di titik itu. Lalu:

| Jalur | Akibat |
|---|---|
| **Dokumen** | turun ke pencocokan **kata** — justru perilaku yang Item 64/65 buktikan jauh lebih buruk: dokumen yang pertanyaannya tak memuat kata dari judulnya **tidak ditemukan sama sekali** |
| **Memori** | **dilewati seluruhnya**. Memori hanya bisa ditemukan lewat vektor; tak ada cadangan apa pun |

Dan keduanya hanya meninggalkan `console.warn`/`console.error` di sisi server, sementara
`processingSteps` — yang sampai ke pengguna — tetap melaporkan:

```
✅ [RAG TIER 1 OK] 4 chunks (strategy: ...)
```

Tanda **✅**, dengan nama strategi internal sebagai satu-satunya petunjuk. Jawabannya tampak
normal. Mutunya tidak. Tak ada yang memberi tahu.

Ini bersambung langsung dengan yang sudah diketahui: saldo OpenRouter boleh minus dan tetap
melayani **sebagian** — jadi embedding bisa mati sementara chat tetap berjalan.

## Yang dikerjakan

### 1. Sebabnya dicatat, tanpa mengubah kontraknya

`JejakEmbedding` opsional diisi di tempat: `'tanpa-kunci'` / `'galat'` / `'dimensi'`, beserta
pesan aslinya (termasuk **kode** — 402 saldo habis bisa dibedakan dari galat jaringan).

Array kosong tetap jadi nilai kembaliannya. Mengubahnya menjadi objek akan menyentuh kelima
pemanggil sekaligus, padahal yang hilang hanyalah **sebabnya** — dan sebab itulah yang menentukan
tindakan: `'tanpa-kunci'` tak akan pernah berhasil kalau dicoba lagi, `'galat'` mungkin sesaat.
Pemanggil yang tidak peduli cukup tidak mengirim argumennya. **Perilakunya tidak berubah.**

### 2. Penurunannya ditulis ke layar, dengan akibatnya

```
⚠️ [RAG TURUN KE PENCOCOKAN KATA] Pencarian makna tidak jalan: OpenRouter menolak atau
   gagal — 402: … Dokumen yang pertanyaannya tak memuat kata dari judulnya bisa TIDAK
   ditemukan — jawaban di bawah mungkin melewatkan sumber yang sebenarnya ada.
```

Bukan "lebih lambat", bukan nama keadaan internal: **akibatnya**.

### 3. Memori dibedakan dari dokumen

Karena memori tak punya cadangan, pesannya mengatakannya terus terang: *"tak satu pun memori ikut
ke model pada pesan ini."* Galat RAG non-embedding tetap punya cabangnya sendiri supaya tidak ikut
mengaku sebagai kegagalan vektor.

### 4. Satu pengerasan — dan uji mutasi yang membongkar klaim saya

`const [vektor] = await embedLewatOpenRouter(...)` bernilai `undefined` bila penyedia mengembalikan
daftar kosong. `?? []` ditambahkan.

Saya menduga manfaatnya adalah "tidak mengembalikan undefined". **Uji mutasi membuktikan dugaan itu
salah:** kembaliannya `[]` pada kedua versi, karena `TypeError` dari `.length` ditelan oleh `catch`
milik fungsi itu sendiri. Yang sebenarnya berbeda adalah **tuduhannya**:

| | sebab yang dilaporkan |
|---|---|
| tanpa `?? []` | `galat` — *"Cannot read properties of undefined"* → dibaca Owner sebagai "OpenRouter menolak atau gagal" |
| dengan `?? []` | `dimensi` — *"didapat 0 dimensi, perlu 768"* |

Asersi pertama saya hijau **secara hampa** dan mutasi M3 lolos sampai asersinya ditulis ulang untuk
memeriksa hal yang benar-benar berbeda.

## Uji

`uji/uji-rag-turun-bersuara.mjs` (baru) — 34 asersi. Pintu embedding yang **asli dijalankan di
Node**: sumber `.ts`-nya ditransformasi dengan esbuild (paket lokal `frontend/node_modules`, bukan
unduhan), lalu satu-satunya impornya ditukar penyedia vektor palsu yang bisa disuruh gagal dengan
cara tertentu. Pola yang sama dengan `uji-pemutus-arus-engineer.mjs` hari ini: perilaku yang diuji,
bukan teks kode. Bagian `processingSteps` tetap statis (menjalankan seluruh pipeline edge function
tidak sepadan) — tetapi diukur pada kode **tanpa komentar**, karena komentar penjelasnya menyebut
`processingSteps` dan pernah membuat uji lain hijau secara keliru.

| Mutasi | Asersi jatuh |
|---|---|
| M1 sebab `'galat'` tak dicatat | 1 |
| M2 sebab `'dimensi'` tak dicatat | 1 |
| M3 pengerasan `?? []` dicabut | 2 (setelah asersinya diperbaiki; **0** sebelumnya) |
| M4 langkah penurunan dokumen dibuang | 2 |
| M5 langkah memori-dilewati dibuang | 1 |
| M6 jejak tak dikirim ke pintu embedding | 1 |

**75/75 berkas uji hijau.** Bundel `agent-process` bersih (505,3 kb).

Satu jebakan lingkungan ikut tercatat di berkas ujinya: `new URL('..', import.meta.url).pathname`
menyimpan spasi di *"mamet os ecosystem"* sebagai `%20`, dan menyusunnya kembali jadi URL
menghasilkan `%2520`. Pakai `fileURLToPath`.

## Temuan sampingan yang DITUNDA

Saat embedding gagal, vektornya dicoba **dua kali** per pesan: `generateEmbeddingThroughAdapter` di
`request_pipeline` melempar, sehingga `ctx.request.queryEmbedding` tak pernah disetel, lalu
`context_builder` memanggil pintu embedding sekali lagi.

Besarnya **bergantung sebab**: untuk `'tanpa-kunci'` panggilan kedua kembali seketika (tak ada
jaringan), jadi tak terasa. Untuk `'galat'` yang berupa waktu habis, ini menambah hingga ~15 detik
lagi per pesan. Jejak sebab yang baru dipasang hari ini sudah cukup untuk menutupnya — tetapi itu
soal **biaya & latensi**, bukan soal kebisuan, jadi tidak digabungkan ke pekerjaan ini. Keputusan
Owner.

## Perlu DEPLOY

Ketiganya ada di `agent-process`: `rag/embedding.ts`, `orchestration/handlers/context_builder.ts`,
`request/request_pipeline.ts`.

**Cara memastikan live:** kirim satu pertanyaan tanpa kunci OpenRouter (atau saat embedding gagal).
Di langkah pemrosesan harus muncul **⚠️ [RAG TURUN KE PENCOCOKAN KATA]** beserta sebabnya — dan
bila memori juga dilewati, **⚠️ [MEMORI DILEWATI]**. Kalau yang muncul hanya *"✅ RAG TIER 1 OK"*,
perubahannya belum sampai.
