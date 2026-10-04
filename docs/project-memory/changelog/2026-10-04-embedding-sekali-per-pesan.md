# 4 Oktober 2026 — Satu pesan = satu percobaan embedding

## Buktinya dari log produksi, bukan dari dugaan

Temuan ini awalnya saya sebut sebagai kemungkinan dan tunda. Yang mengubah statusnya adalah log
Supabase 1 Oktober 17:24:49 — **satu pesan**, mode **ENGINEER**:

```
.108  [Embedding] Gagal (SALDO_HABIS): Saldo OpenRouter Anda tidak cukup … (402)
.291  [Embedding] Gagal (SALDO_HABIS): Saldo OpenRouter Anda tidak cukup … (402)
.292  [RAG] Mode: ENGINEER — vektor tidak tersedia, cadangan pencocokan kata
```

Dua panggilan berjarak **183 milidetik** untuk satu pesan. Terekam, bukan diteorikan.

## Akarnya: dua titik panggil yang tidak saling tahu

`request_pipeline` membuat vektor pertanyaan lebih dulu — dipakai pencarian memori, lalu
disimpan di `ctx.request.queryEmbedding` supaya pencarian dokumen memakai yang sama. Niatnya
sudah benar sejak awal; komentarnya bahkan berbunyi *"satu embedding per pesan, bukan dua"*.

Tetapi `generateEmbeddingThroughAdapter` **melempar** bila dimensinya tidak 768. Lemparan itu
melewati baris penyimpanan, jadi `queryEmbedding` tak pernah disetel. `context_builder` kemudian
melihat vektor yang tak siap — dan memanggil pintu embedding **sekali lagi**.

Jadi jalur suksesnya hemat, jalur gagalnya menggandakan. Justru ketika sesuatu sudah salah.

## Ini bukan kebijakan ulang-coba yang dihapus

Pembedaan ini penting supaya perbaikannya tidak dibaca sebagai membuang ketahanan.

Jarak 183 ms **di dalam satu permintaan** tidak menyembuhkan apa pun. 402 saldo habis tidak,
ketiadaan kunci BYOK jelas tidak, dimensi yang tak cocok juga tidak. Tak ada di antaranya yang
berubah dalam seperlima detik. Yang ada bukan dua percobaan, melainkan **satu percobaan yang
tidak diketahui oleh pemanggil kedua**.

## Yang dikerjakan

`ctx.request.embeddingGagal` membawa sebab kegagalan dari hulu ke hilir, sehingga percobaan kedua
tahu yang pertama sudah terjadi:

```ts
const queryEmbedding: number[] = vektorSiap
    ? (ctx.request.queryEmbedding || [])
    : gagalDiHulu ? []                                      // sudah dicoba, milidetik lalu
    : await generateEmbedding(pesan, rctx, jejakVektor);
```

Sebabnya **ikut diwariskan** (`jejakVektor` diisi dari `gagalDiHulu`), jadi pesan ⚠️ ke Owner
tetap menyebut sebab yang nyata. Tanpa itu, perbaikan ini akan menukar satu kebisuan dengan
kebisuan lain: pesannya akan berbunyi *"sebabnya tidak tercatat"*.

Kedua medan juga **diberi tipe** di `types.ts` — `queryEmbedding` dulu diselipkan lewat
`as any`, dan itu salah satu alasan dua titik panggil itu bisa tidak saling tahu tanpa ada yang
menyadarinya.

### Penjaga yang paling mudah salah

`catch` di `request_pipeline` juga menangkap galat **non-embedding** — misalnya RPC
`match_memories`. Pada saat itu vektornya **sudah jadi**. Menandainya `embeddingGagal` akan
membuang vektor yang baik dan menurunkan pencarian dokumen ke pencocokan kata **tanpa sebab** —
memperburuk keadaan sambil memperbaiki yang lain.

Karena itu syaratnya `jejakVektorMemori.sebab`, bukan sekadar "ada galat". Uji M3 menjaga tepat
ini.

### Yang TIDAK dibungkam

Embedding untuk pertanyaan yang **ditulis ulang** (Item 67) tetap hidup: teksnya berbeda, jadi ia
embedding yang sah. Ia juga hanya terjangkau ketika vektor pertama **berhasil**, karena
cabangnya berada di dalam penjaga dimensi.

## Uji

`uji/uji-embedding-sekali-per-pesan.mjs` (baru) — 19 asersi.

Ekspresi keputusannya **diambil dari berkas sumber lalu dijalankan** dengan tiruan, dan panggilan
ke pintu embedding **dihitung**. Jadi yang diuji adalah ekspresi yang sebenarnya dipakai — bukan
salinan yang ditulis ulang di berkas uji, yang akan tetap hijau walau kodenya berubah. Satu-satunya
sintaks TypeScript di ekspresi itu adalah anotasi di sisi kiri, dan ada asersi yang memastikan
isinya tetap JavaScript murni agar teknik ini tidak diam-diam berhenti berlaku.

| Keadaan | Panggilan |
|---|---|
| vektor hulu berhasil | **0** |
| vektor hulu gagal | **0** ← dulu 1 (jadi 2 per pesan) |
| hulu tak pernah mencoba | **1** |
| vektor pakai-ulang cacat | **1** |

Empat mutasi, semuanya menggigit — dan dua di antaranya adalah **perbaikan yang SALAH**, bukan
sekadar perbaikan yang dibatalkan:

| Mutasi | Asersi jatuh |
|---|---|
| M1 cacat aslinya dikembalikan | 1 |
| M2 perbaikan salah: sebabnya tidak diteruskan | 1 |
| M3 perbaikan salah: galat non-embedding pun ditandai gagal | 1 |
| M4 jalur tulis-ulang ikut dibungkam | 1 |

**77/77 berkas uji hijau.** Bundel `agent-process` bersih (505,4 kb).

## Perlu DEPLOY

`context_builder.ts`, `request_pipeline.ts`, `types.ts` — ketiganya di `agent-process`. Tidak ada
perubahan renderer, jadi **tanpa rilis klien**.

**Cara memastikan live:** picu kegagalan embedding (mis. saldo OpenRouter habis) lalu kirim satu
pesan, dan baca log fungsi. Harus muncul **satu** baris `[Embedding] Gagal`, bukan dua — dan baris
`[RAG] … vektor tidak tersedia` kini menyebut `sudah gagal di hulu — TIDAK diulang`. Dua baris
`[Embedding] Gagal` berjarak milidetik berarti perubahannya belum sampai.
