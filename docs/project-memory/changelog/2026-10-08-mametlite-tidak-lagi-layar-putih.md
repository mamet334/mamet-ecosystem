# 8 Oktober 2026 — Mametlite tidak lagi bisa jadi layar putih

Lanjutan blok M item 125 ([`ROADMAP-SIAP-PENGGUNA.md`](../../roadmap/ROADMAP-SIAP-PENGGUNA.md)),
sesudah [M1](./2026-10-07-mametlite-berhenti-menyuntikkan-html.md). Owner memilih menuntaskan seluruh
blok M lebih dulu sebelum gerbang penilaian.

## Cacatnya

`mametlite/src/App.jsx`, di dalam inisialisator `useState`:

```js
const saved = localStorage.getItem('mametlite_conversations');
if (saved) return JSON.parse(saved);          // ← tanpa try, DI JALUR RENDER
```

Satu nilai rusak → `JSON.parse` melempar saat render → **layar putih**. Dan karena nilai buruknya
masih tersimpan, layar putih itu **kembali setiap muat ulang**. Mametlite tidak punya satu pun error
boundary (`grep errorboundary|componentDidCatch|getDerivedStateFromError` → **0**), jadi tidak ada
yang menangkapnya, dan pengguna awam tidak punya jalan keluar.

Dua cacat bersebelahan di jalur yang sama:

- `localStorage.setItem(...)` juga tanpa `try` — `QuotaExceededError` melempar di dalam `useEffect`.
- Dan ia menulis **seluruh** array percakapan pada **setiap token SSE** (`updateMessages` dipanggil
  per potongan arus), jadi satu jawaban RAG panjang menulis ratusan kali ke arah batas ±5 MB.

## Yang dikerjakan

Bukan menambal satu `try`. Akarnya **keadaan tersimpan yang tak dipercaya, dibaca di jalur render,
tanpa jaring** — jadi ketiganya ditutup:

| | |
|---|---|
| `lib/riwayatLokal.js` **(baru)** | satu pintu untuk baca/simpan/hapus riwayat. Tidak pernah melempar, selalu memulangkan riwayat yang sah |
| `lib/BatasGalat.jsx` **(baru)** | error boundary membungkus seluruh aplikasi di `main.jsx` |
| `App.jsx` | memakai satu pintu itu; penyimpanan ditunda 500 ms + sekali lagi saat halaman ditinggalkan |

### Tiga keputusan yang pantas disebut

**1. Bentuknya diperiksa, bukan hanya JSON-nya.** `'{}'` adalah JSON yang **sah** tetapi akan membuat
`conversations.find(...)` jatuh beberapa baris kemudian. Menangkap `JSON.parse` saja hanya
**memindahkan** kejatuhannya, tidak menghapusnya. `sahkanRiwayat()` karena itu memeriksa sampai ke
bentuk `messages[].role`.

**2. "Tidak bisa dibaca" tidak boleh terlihat sama dengan "tidak ada".** Aturan yang sama dengan
TMN-0006. `bacaRiwayat()` memulangkan `{riwayat, masalah}`; riwayat rusak memunculkan pemberitahuan
di layar chat, sementara **belum pernah ada riwayat** memulangkan `masalah: null` — kosong itu wajar
dan tidak boleh memunculkan peringatan. Peringatan yang selalu menyala sama tak bergunanya dengan
yang tak pernah menyala.

**3. Jalan keluarnya tidak boleh menghapus kunci berbayar pengguna.** Tombol di `BatasGalat`
menghapus **hanya** `mametlite_conversations`, bukan `localStorage.clear()` — kunci OpenRouter
pengguna tetap, dan layarnya mengatakan itu. Pesan teknisnya juga tetap ditampilkan: pengguna
Mametlite membuka dari HP dan tidak punya DevTools, jadi kalau sebabnya disembunyikan, satu-satunya
cara melapor adalah *"layarnya putih"*.

`pagehide` dipakai untuk simpan-terakhir, bukan `beforeunload`: di Safari iOS `beforeunload` sering
tidak menyala sama sekali, dan penggunanya ada di HP.

## Bukti

`uji/uji-riwayat-lokal.mjs` (baru) — **SEMUA LULUS**. Simpanan disuntik, bukan `localStorage` asli:
kuota penuh dan `getItem` yang melempar justru paling penting diuji dan paling sulit dibuat di
peramban.

| Bagian | Yang dibuktikan |
|---|---|
| 1 | 11 bentuk isi rusak (`{rusak`, `{}`, `[]`, `[{}]`, `[{"id":1}]`, `messages` bukan array, pesan tanpa `role`, …) → semuanya riwayat sah, nol lemparan |
| 2 | rusak → **ada** pesan; kosong → `masalah: null`; pesannya tanpa istilah teknis dan memakai kata "percakapan" |
| 3 | `getItem` melempar & tanpa simpanan sama sekali (mode privat) → sah **dan** bersuara |
| 4 | kuota penuh dibedakan: pesannya menyebut **tindakan** (hapus percakapan lama); galat lain tidak menyuruh itu |
| 5 | `hapusRiwayat` menghapus riwayat, **kunci `x-byok-openrouter` tetap** |
| 6 | **TERPASANG** — `JSON.parse(localStorage` hilang dari `App.jsx`, penundaan ada, `pagehide` ada, `main.jsx` benar-benar membungkus `<App />` |

**Di peramban** (bundel produksi, `vite preview`):

| Yang diuji | Hasil |
|---|---|
| `localStorage['mametlite_conversations'] = '{rusak'` lalu muat ulang | halaman **merender**, nol galat konsol. Sebelumnya `JSON.parse` melempar saat App dipasang — layar putih bahkan di halaman masuk |
| galat render dipaksa (suntikan sementara) | layar **"Mamet Lite tersendat"** muncul dengan dua tombol & pesan teknis |
| tombol "Hapus riwayat & mulai dari awal" ditekan | `mametlite_conversations` **hilang**, `x-byok-openrouter` **tetap** `sk-or-milik-pengguna-uji` |

Suntikan galat itu dicabut sesudahnya dan dibuktikan bersih: bundel yang berjalan `index-2V_Fj0Gz.js`,
sementara semua galat di penyangga konsol menyebut `index-CGq_U_0i.js` — bundel lama yang sudah
diganti.

Suite penuh: **89/89**.

## Berkas

| Berkas | |
|---|---|
| `mametlite/src/lib/riwayatLokal.js` | **baru** — satu pintu, tidak pernah melempar |
| `mametlite/src/lib/BatasGalat.jsx` | **baru** — jaring terakhir + jalan keluar orang awam |
| `uji/uji-riwayat-lokal.mjs` | **baru** — 6 bagian |
| `mametlite/src/App.jsx` | satu pintu, penundaan simpan, pemberitahuan di layar chat |
| `mametlite/src/main.jsx` | `<BatasGalat>` membungkus `<App />` |

## Sisa blok M

**M3** tata letak HP (0 dari 102 `className` punya prefiks responsif; bilah sisi `w-80` menyisakan
±55px untuk chat di 375px), **M4** pesan galat bahasa Indonesia, **M8** kode mati, **M9** uji penjaga
tiga berkas salinan tangan.
