# 8 Oktober 2026 — pdf.js bisa menjalankan JavaScript dari PDF yang diunggah

C10a item 125 ([`ROADMAP-SIAP-PENGGUNA.md`](../../roadmap/ROADMAP-SIAP-PENGGUNA.md)). Temuan ini
**tidak ada di rencana** — ia muncul dari `npm audit` yang dijalankan sesudah M8 mencabut empat
dependency.

## Temuannya

```
npm audit --omit=dev   (mametlite/)
→ 8 kerentanan: 5 high, 3 moderate
```

Satu di antaranya berbeda jenis dari sisanya:

> **pdfjs-dist — HIGH — GHSA-hq66-cqwq-w95j**
> *"Arbitrary JavaScript execution upon opening a malicious PDF"*
> rentang rentan: `>=5.6.83 <6.2.108`

Mametlite memasang **`^6.0.227`** — di dalam rentang itu.

**Kenapa ini naik ke depan antrean, padahal rencana menaruh dependency paling akhir:**

1. **Membuka PDF adalah fungsi utama Mametlite.** Penggunanya mengunggah dokumen, dan `pdf.js`
   menguraikannya **di peramban mereka** — bukan di server.
2. **Origin itu menyimpan kunci OpenRouter mereka** (`localStorage`). Jadi ini kelas bahaya yang
   **sama persis** dengan M1 yang baru ditutup kemarin — eksekusi JS di origin berkunci — lewat
   pintu yang berbeda.
3. **Pemicunya dokumen yang pengguna unggah sendiri**, yaitu hal yang aplikasinya memang minta
   mereka lakukan.
4. Perbaikannya **di dalam major yang sama** (6.0 → 6.4), jadi ia memang "dependency aman" menurut
   batas yang sudah disepakati — bukan major upgrade yang menunggu jaring CI.

Alasan menunda dependency adalah "tidak ada yang akan memberi tahu kalau bump merusak sesuatu". Itu
dijawab di bawah dengan uji, bukan dengan menundanya.

## Yang dikerjakan

`mametlite/package.json`: `pdfjs-dist ^6.0.227` → **`^6.4.299`** (terpasang 6.4.299).
Sesudahnya `pdfjs-dist` **tidak lagi muncul di `npm audit`**.

## Bukti — dan kenapa buildnya saja tidak cukup

Menaikkan pustaka yang **menguraikan berkas tak terpercaya** hanya aman bila ada yang membuktikan
penguraiannya masih benar sesudahnya. Dan kodenya sendiri sudah menyimpan jejak bahwa API pdf.js
bergeser antar-major — `documentTextExtractor.js:233`:

> *"pdfjs 6 (mametlite) tak lagi punya `doc.destroy()` — terbukti saat uji salinan mametlite."*

`uji/uji-baca-pdf-mametlite.mjs` (baru) — **SEMUA LULUS**. Ia membuat PDF dua halaman dengan
`pdf-lib`, lalu menjalankannya lewat jalur Mametlite yang sesungguhnya (`ekstrakPdfDariData`):

| | Yang dibuktikan |
|---|---|
| 1 | versi terpasang **di luar rentang rentan** — satu-satunya asersi tentang versi, karena memang soal versi |
| 2 | teks terbaca (3 penanda), kedua halaman diberi penanda terpisah, dan **bentuk kemajuan** `{tahap, halaman, total}` utuh — itu yang jadi tulisan *"Membaca halaman n/total"* di layar pengguna, dan kalau bentuknya berubah ia jadi `undefined/undefined` tanpa ketahuan dari build |
| 3 | PDF rusak ditolak sebagai `GagalEkstrak` dengan pesan bahasa Indonesia, bukan galat mentah pdfjs |

**Logika batas rentangnya diperiksa di 9 titik**, bukan hanya pada versi yang kebetulan terpasang:

| Versi | Aman? | |
|---|---|---|
| 5.6.82 | ✅ | tepat sebelum batas bawah |
| **5.6.83** | ❌ | batas bawah rentan |
| **5.7.284** | ❌ | **versi `frontend` sekarang** |
| **6.0.227** | ❌ | versi mametlite sebelum bump |
| 6.2.107 | ❌ | tepat sebelum perbaikan |
| **6.2.108** | ✅ | batas perbaikan |
| 6.4.299 | ✅ | versi mametlite sekarang |

Build lulus. Suite penuh: **93/93**.

## ⚠️ Yang BELUM ditutup: `frontend` juga rentan

`frontend/package.json` memasang **`pdfjs-dist ^5.7.284`** — juga di dalam rentang rentan.

**Tidak dikerjakan di sini, dan alasannya bukan kemalasan:** memperbaikinya menuntut **naik satu
major** (5 → 6), karena perbaikannya hanya ada di `>=6.2.108`. Dan jalur PDF Ecosystem lebih luas
daripada Mametlite — `tabelCentang.js` bergantung pada koordinat pdf.js (Item 88), dan
`bacaPdfAsn.js` pada `hitungHalamanPdf`. Komentar di `documentTextExtractor.js:233` sudah merekam
satu API yang hilang antar major itu, jadi pergeserannya nyata, bukan dugaan.

Bobotnya **lebih rendah** daripada di Mametlite: penggunanya Owner sendiri, dan PDF yang dibuka
adalah dokumen Owner — bukan berkas dari orang luar. Tetapi ia tetap terbuka.

Pembuktiannya menuntut `npm run desktop` dan penilaian Owner, jadi ia menunggu keputusan — bukan
menunggu pekerjaan. Dicatat sebagai sisa C10a di roadmap.
