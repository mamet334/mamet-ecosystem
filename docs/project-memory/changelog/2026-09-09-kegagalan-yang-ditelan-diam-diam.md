# Enam Kegagalan yang Ditelan Diam-diam

**Tanggal:** 2026-09-09
**Status:** ✅ Semua Selesai & Diverifikasi Live
**Commit:** `b5207e0`, `82d8ed2`, `c1ce08b`, `da75da3`, `6fe1155`, `ec27c52`
**Deploy:** `agent-process` + `rag-process`, drift check `[MATCH]`
**Terkait:** Item 38–43 di INDEX-ROADMAP

---

## 1. Satu Penyakit, Enam Gejala

Sesi ini bermula dari satu permintaan sederhana — kerjakan Item 38 — dan berakhir
dengan enam cacat terpisah. Semuanya berbagi satu pola:

> **Sistem melaporkan keberhasilan, atau gagal tanpa suara, dan tidak ada yang
> pernah memeriksa apakah itu benar.**

Tidak satu pun dari enam cacat ini ditemukan lewat pencarian bug. Semuanya muncul
karena sesuatu yang lain memaksa jalurnya bersuara.

| # | Cacat | Ditemukan karena |
|---|---|---|
| 38 | Intent Router mati untuk model non-Gemini | `console.log` yang ditambahkan Item 35 |
| 39 | Penjaga dimensi embedding tertinggal di 768 | Owner bertanya "apakah RAG pakai Gemini?" |
| 40 | Impor rusak di `rag-process` | penelusuran lanjutan dari #39 |
| 41 | `gpt-4o-mini` ditagih tarif `gpt-4o` | Owner bertanya soal plafon biaya |
| 42 | Dua sistem biaya sama-sama menebak | pemeriksaan lanjutan dari #41 |
| 43 | CHECK_007 menghukum kepatuhan | uji live Owner |

---

## 2. Item 38 — Intent Router Mati untuk Model Non-Gemini

**Akar pertama.** `runCoordinatorLLM()` mematok `preferredProvider = 'gemini'`
secara hardcoded, tapi `callLLMWithMetadata()` tetap meneruskan model Owner ke
adapter apa pun. GeminiAdapter menerima `deepseek/deepseek-v4-flash-0731` dan
menembak endpoint Google dengan model yang mustahil ada di sana.

Terukur: **18 request 404 per pesan** (2 panggilan koordinator × 3 key × 3
percobaan), **±6,5 detik terbuang**. Kegagalannya ditelan `catch` yang hanya
menulis `console.warn`, sehingga Intent Router praktis tidak pernah berfungsi
bagi Owner tanpa satu pun gejala di UI.

Menariknya pola penjagaan ini **sudah ada** untuk OpenRouterAdapter lewat
`forceDefaultModel`. GeminiAdapter tidak pernah dibuatkan padanannya.

**Akar kedua, muncul setelah yang pertama diperbaiki.** Log membuktikan perbaikan
menyala tepat:

```
[Cascade] "deepseek/deepseek-v4-flash-0731" bukan model Gemini — GeminiAdapter memakai model bawaannya
```

Tapi tetap 404, karena model cadangannya sendiri sudah mati. Google menjawab:

> *"This model models/gemini-2.0-flash is no longer available. Please update your
> code to use models/gemini-3.6-flash"*

Dokumentasi resmi mencantumkannya di "Previous models" dengan status **"(Shut down)"**.

**Model mati kedua yang ikut ketemu:** `google/gemini-2.0-flash-exp:free` — sudah
hilang dari katalog OpenRouter (diverifikasi langsung ke
`https://openrouter.ai/api/v1/models`). Dipakai `tool_subscriber.ts` untuk **semua
sub-agent** yang jatuh ke OpenRouterAdapter, jadi jalur itu pasti gagal. Ditelan
`catch` yang cuma `console.warn`. Lagi.

**Perbaikan struktural:** nilai default Gemini disentralkan jadi satu konstanta
`DEFAULT_GEMINI_MODEL`, bukan lagi di-hardcode terpisah di jalur `execute()` dan
`stream()`. Drift antara dua salinan itulah yang menyebabkan masalahnya.

**Bukti sembuh:**
```
[Cascade] "openai/gpt-4o-mini" bukan model Gemini — GeminiAdapter memakai model bawaannya
[PR#6 TOKEN METRICS] Gemini non-stream (gemini-2.5-flash): prompt=437t completion=1t
✅ GeminiAdapter succeeded
```
`completion=1t` adalah jawaban satu kata Intent Router — persis seperti dirancang.
Dari 18 request gagal menjadi satu percobaan ulang.

---

## 3. Item 39 — Penjaga Dimensi Embedding Tertinggal di 768

Owner bertanya apakah unggah dokumen RAG benar-benar memakai embedding Gemini
demi hemat biaya. Jawabannya: niatnya benar, tapi ada penjaga yang membatalkannya.

`rag/embedding.ts` mensyaratkan dimensi **tepat 768**, sisa era model embedding
lama. GeminiEmbeddingAdapter mengembalikan **3072**. Akibatnya
`generateEmbedding()` **selalu** mengembalikan array kosong:

```
[Embedding] Adapter GeminiEmbeddingAdapter returned invalid dimension (expected 768, got 3072).
[Embedding] All embedding adapters failed. Errors:
```

Perhatikan `Errors:` yang kosong — tidak ada fallback berbayar yang terjadi. Jadi
ini bukan pemborosan biaya, melainkan **pencarian vektor yang mati diam-diam** di
`context_builder.ts` dan `knowledge_manager.ts`.

Angka 3072 ditentukan skema database, bukan sebaliknya: `document_chunks.embedding`
bertipe `vector(3072)` dan seluruh 512 chunk berdimensi 3072 (diverifikasi lewat
`information_schema` + `vector_dims`).

**Catatan jujur:** fallback OpenAI sengaja dibiarkan tidak lolos penjaga — ia
mematok `dimensions: 768`, dan lebih baik gagal jujur daripada menyimpan vektor
berdimensi salah yang tetap ditolak Postgres.

---

## 4. Item 40 — Ranjau di `rag-process` yang Belum Meledak

`rag-process/index.ts` mengimpor `getGeminiEmbeddingWithRetry` dari
`vector_utils.ts`, tapi fungsi itu **dihapus** commit `3176c6e` (2026-07-01,
*"vendor decoupling for llm and embeddings"*) tanpa memutakhirkan pemanggilnya.

Belum meledak hanya karena kebetulan waktu: versi yang berjalan di produksi masih
bundel **30 Juni 2026** — sehari sebelum commit itu. Deploy ulang kapan pun akan
membuat fungsinya gagal boot.

**Kehati-hatian yang perlu dicatat:** nol dokumen sejak Juli memang cocok dengan
garis waktu ini, tapi itu **bukan bukti**. Owner mengonfirmasi ia memang belum
mengunggah dokumen sejak era transisi. Tanpa konfirmasi itu, korelasi tersebut
mudah disalahartikan sebagai sebab-akibat.

**Bukti sembuh:** setelah fungsi dipulihkan dan `rag-process` di-deploy ulang,
probe menghasilkan `HTTP 400 {"error":"Missing title, text, or userId"}` — pesan
validasi milik fungsi itu sendiri, artinya ia berhasil boot dan impornya
teratasi. Kalau masih rusak, responsnya `BOOT_ERROR`.

---

## 5. Item 41 — Circuit Breaker Memblokir Biaya yang Tidak Pernah Terjadi

Owner bertanya apakah ia bisa menaikkan plafon sistem sendiri. Pemeriksaan itu
menyingkap dua sistem biaya mencatat **26 panggilan yang sama** dengan angka
berbeda 28 kali lipat.

| Sumber | Hari itu | Peran |
|---|---|---|
| `api_usage` | **$1,7158** | dibaca RPC `check_daily_quota` — **ini yang memblokir** |
| `cost_ledger` | $0,0609 | tidak menentukan apa pun |
| Dashboard OpenRouter | **~$0,0910** | tagihan sesungguhnya |

Penyebabnya satu baris:

```js
if (modelName.includes('gpt-4o')) { costIn = 0.005; costOut = 0.015; }
```

`"openai/gpt-4o-mini"` **mengandung** substring `"gpt-4o"`. Model termurah ditagih
tarif model termahal. Aritmetikanya cocok persis: 335.485 × $0,005/1K + 2.301 ×
$0,015/1K = **$1,7119**, sementara tagihan asli untuk model yang sama $0,0606.

**Dampak nyatanya bukan sekadar angka salah:** Owner sepanjang hari kena circuit
breaker dan menaikkan batas hariannya $1 → $1,5 → $2 → $3, mengejar biaya yang
tidak pernah ada. Saldo OpenRouter-nya sendiri tenang di $4,80.

Tarif `gpt-4o` juga salah untuk gpt-4o sendiri: $0,005/$0,015 padahal aslinya
$0,0025/$0,01.

Rantai `if` diganti tabel `MODEL_PRICING` yang dicocokkan dari yang paling
spesifik — `"gpt-4o-mini"` **wajib** sebelum `"gpt-4o"`. Seluruh angka diambil
dari katalog resmi `https://openrouter.ai/api/v1/models`.

Ke-26 baris hari itu dihitung ulang atas persetujuan Owner: $1,7158 → **$0,0618**,
mengembalikan ruang dari $1,28 ke $2,94.

---

## 6. Item 42 — `usage.cost`: Menghapus Seluruh Kelas Kesalahan

Owner bertanya: bisakah OpenRouter memberi angka pemakaian yang valid supaya
circuit breaker tidak perlu menebak?

Bisa — dan tanpa syarat apa pun. Dokumentasi OpenRouter (usage-accounting,
diverifikasi 2026-09-09) menyatakan `usage.cost` **selalu** disertakan di setiap
respons: tanpa parameter tambahan, tanpa biaya ekstra, tanpa tambahan latensi.
Parameter `usage: { include: true }` yang mungkin diingat orang sudah usang.

Perbaikan Item 41 memindahkan galat dari 19× terlalu mahal menjadi ~30% terlalu
murah — lebih baik, tapi masih menebak. Dua sebabnya bukan soal tarif:

- jumlah token masih ditebak dari `Math.ceil(text.length / 4)`
- **token reasoning ditagih tapi tidak pernah muncul di teks jawaban**, jadi
  mustahil ditebak dari panjang. Inilah sebab DeepSeek Pro paling meleset —
  dialah yang paling banyak bernalar.

Dengan `usage.cost`, tidak ada tabel tarif yang bisa basi dan tidak ada token yang
perlu ditebak. Tabel tarif turun pangkat jadi cadangan untuk provider yang tidak
melaporkan biaya.

Ikut ketemu: tabel `model_pricing` di database **tidak punya baris DeepSeek sama
sekali**, sehingga semua panggilan DeepSeek tercatat berbiaya nol. Baris itu
ditambahkan agar jalur cadangan pun jujur.

**Bukti sembuh:** `biaya=$0.00308745` untuk `prompt=20451t` gpt-4o-mini —
20451/1e6 × $0,15 = $0,00307. Cocok.

---

## 7. Item 43 — Sistem Menghukum Model karena Mematuhi Perintahnya Sendiri

Uji live Owner: pertanyaan santai "apa game changer?" dijawab dengan benar, lalu
**diblokir total** dengan pesan "Verification Failed". Owner tidak menerima
jawaban apa pun.

Tiga sumber saling bertentangan pada frasa yang persis sama:

1. `evidence_validator.ts` **MEMERINTAHKAN**, saat RAG & Memory kosong:
   *"Jawab dari pengetahuan umum dan sampaikan bahwa tidak ada data spesifik
   project ditemukan."*
2. `CHECK_002B` di `verification_engine.ts` **MEMBERI NILAI** untuk frasa
   "pengetahuan umum" — ketiadaannya justru diberi status `WARN`.
3. `CHECK_007` di **berkas yang sama** **MELARANGNYA**: `FAIL`, skor −50, blokir total.

Satu respons bisa sekaligus lulus CHECK_002B dan gagal CHECK_007 karena kalimat
yang sama.

**Syarat yang hilang:** `universal_contract.ts:136` menuliskan aturan aslinya
sebagai *'Menyebut "berdasarkan pengetahuan umum saya" **di Engineer mode**'*.
Aturan itu memang selalu bersyarat — CHECK_007 yang kehilangan syaratnya.

Daftar larangan dipisah sesuai maksud aslinya:

- **Selalu dilarang:** sikap ragu-ragu dan bahasa robot. Tidak pernah bisa dibenarkan.
- **Dilarang hanya bila evidence tersedia:** `"berdasarkan pengetahuan umum saya"`.
  Di situlah pelanggaran sesungguhnya — model mengabaikan sumber yang ada.

Aturannya tidak dilemahkan: respons yang mengaku memakai pengetahuan umum padahal
evidence tersedia tetap `FAIL`, kini dengan pesan yang menyebut berapa evidence
yang diabaikan. Ditelusuri untuk empat skenario sebelum deploy.

---

## 8. Bukti Verifikasi Akhir

Satu pertanyaan menutup seluruh rangkaian — `siapa nama panggilan saya?`:

> **"Nama panggilan Anda adalah Pak Slamet."**

| Perbaikan | Bukti live |
|---|---|
| Item 37 (penyaring kategori) | jawaban benar, `Tahap 1 → 7 kandidat` |
| Item 35 (`thinking`) | `reasoning=363t` di tier SEDANG |
| Item 38 | `✅ GeminiAdapter succeeded`, nol 404 |
| Item 39 | `3072 dimensions`, `invalid dimension` hilang |
| Item 40 | `HTTP 400` validasi (bukan `BOOT_ERROR`) |
| Item 41 & 42 | `biaya=$0.00308745` cocok tarif resmi |
| Item 43 | jawaban tersampaikan, tanpa "Verification Failed" |

---

## 9. Yang Sengaja Tidak Dikerjakan, dan Yang Belum Terbukti

- **Profil verifikasi ENGINEERING untuk obrolan santai Assistant.**
  `synthesis_handler.ts:95` memetakan `ASSISTANT → ENGINEERING`, profil paling
  ketat, sementara Engineer mode justru punya penyesuaian ke PERSONAL untuk chat
  natural. Itu keputusan desain, bukan bug — diserahkan ke Owner.
- **Jawaban tertukar.** Satu kali AI menjawab pertanyaan sebelumnya. Dugaan: turn
  yang diblokir verifikasi meninggalkan pertanyaan menggantung tanpa jawaban
  asisten. Tidak terulang setelah Item 43 diperbaiki — **konsisten, tapi tidak
  terbukti**, karena hipotesisnya tidak diuji langsung. Ikut tercatat: `history`
  sudah memuat pesan yang sedang dikirim (`ConversationEngine.jsx:726`), lalu
  dikirim lagi sebagai `message` — pesan Owner muncul dua kali di prompt.
- **API key Gemini #0 menjawab 403.** Rotasi key menutupinya, tapi setiap panggilan
  koordinator menanggung satu percobaan gagal. Perlu dicek di Google AI Studio.
- **Token per pesan percakapan `prompt=20451t`.** Besar. Belum diselidiki apakah
  wajar (konstitusi + RAG + memori) atau ada yang berlebihan.

---

## 10. Pelajaran

**Kegagalan yang bisu lebih mahal daripada kegagalan yang berisik.** Keenam cacat
ini berjalan entah berapa lama tanpa satu pun gejala di UI. Yang membuatnya
terlihat selalu sesuatu yang tidak berhubungan: satu `console.log` untuk fitur
lain, satu pertanyaan Owner tentang biaya, satu uji coba santai.

**`catch { console.warn }` adalah tempat bug bersembunyi.** Tiga dari enam cacat
bersembunyi persis di situ. Kegagalan yang ditelan bukan kegagalan yang hilang —
ia hanya menunggu ditemukan lewat gejala yang jauh lebih membingungkan.

**Verifikasi di satu ujung bukan verifikasi.** Log klien hanya membuktikan niat;
log server membuktikan pengiriman. Item 35 adalah pertama kalinya proyek ini
memverifikasi di kedua ujung, dan justru log baru itulah yang membongkar Item 38.

**Jangan percaya angka yang tidak pernah diperiksa.** Circuit breaker memutus Owner
sepanjang hari dengan angka 19× lipat dari kenyataan. Yang menyelamatkan bukan
kode, melainkan Owner membuka dashboard OpenRouter dan melihat saldo aslinya.
