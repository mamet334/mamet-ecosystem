# 29 Oktober 2026 — Kata pengisi percakapan & pembersih RSS bersama: contoh ADR-0021 dari 0 hasil → 5 (Item 126 Fase 1)

Dua cacat yang ketahuan dari uji live tanggal terbit ([log](./2026-10-29-tanggal-terbit-web.md)), dikerjakan bersama
karena sama-sama menyentuh modul bersama dan cukup satu deploy.

## 1. Kata pengisi percakapan — `shared/kueri_pencarian.js` (`ringkasKueri`)

Contoh di ADR-0021 sendiri — *"tolong carikan berita terbaru soal OKU dong"* — menyisakan "terbaru soal OKU dong" →
Bing **0** hasil. Diukur live per kata:

| Kueri | Hasil |
|---|---|
| "terbaru soal OKU dong" | 0 |
| "terbaru OKU dong" | 1 — aktor Ma Dong Seok |
| "soal banjir Baturaja" vs "banjir Baturaja" | 3 melenceng vs 9 |
| "contoh soal CPNS" vs "contoh CPNS" | soal CPNS vs **surat lamaran** — di sini "soal" adalah isi |

- Partikel **`dong|deh|sih|nih`** masuk daftar buangan.
- **"soal" dibuang hanya bila berarti "tentang"** (`SOAL_SEBAGAI_TENTANG`): tidak didahului kata yang menjadikannya
  benda (contoh/latihan/kunci/kisi-kisi/buatkan … soal) dan bukan bagian "soal-soal". Lookbehind berjalan di V8 & Deno.
- Pesan pengguna di DB (hanya hitungan, isi tidak keluar — T12): 482 pesan; "dong" 0, "soal" 2 (keduanya bukan arti
  benda). Yang paling terbantu adalah pengguna yang menulis santai, bukan Owner.
- Berlaku di **dua sisi**: web Tier 3 klien dan sub-agent researcher/deep_research server.

## 2. Pembersih RSS bersama — `shared/teks_rss.js` (modul baru)

`entitas`, `tanpaTag`, `urlAsliBing` dipindah dari `pencarian_berita.ts` (aturannya sama; hanya ditambah
`String(s || '')`). Parser klien (`WebComparisonService._parseRssResults`) kini memakainya dengan urutan server —
entitas dulu, baru tag:

- **URL sumber = alamat situs**, bukan `bing.com/news/apiclick.aspx?…&amp;…` (model & Owner kini melihat situsnya).
- **Cuplikan Google News tanpa potongan HTML** — dulu tag dibuang sebelum entitas terurai, sehingga `<a href=…>` hasil
  penguraian ikut ke cuplikan.
- Judul dengan `&quot;`/`&#39;` terurai.

## Bukti

- `uji/uji-kueri-pencarian.mjs` **v4** bagian 8 + `uji/bantu-deno-kueri.ts`: 9 contoh ringkasan; satu sumber pembersih
  RSS; **klien dan server (Deno 2.2.7 sungguhan) mengurai RSS yang sama dengan hasil yang sama persis**; aturan "soal"
  terbukti jalan di Deno. `uji-shared-t15` mencatat modul ke-7.
- **Mutasi 7/7 menggigit** — termasuk "soal selalu dibuang", "klien kembali meneruskan tautan pengalih", "server kembali
  menyimpan salinan urlAsliBing".
- **Live** (kode klien asli, Bing sungguhan): contoh ADR → "terbaru OKU" → **5 hasil** dengan URL situs asli & tanggal
  terbit (satu bertanggal 2020-09-29 — kini terlihat lama); "info soal banjir Baturaja dong" → "banjir Baturaja" → 5.
- Suite penuh **127/127**; bundel esbuild `agent-process` dan `vite build` berhasil; nol karakter kendali.

## Deploy — diperiksa di platform

Owner men-deploy `agent-process` 29 Okt. API Supabase: versi **537 → 538**, ACTIVE, `verify_jwt` tetap `false`, 98
berkas (+1: `teks_rss.js`); 0 dari `frontend/`, **7** dari `shared/`. `teks_rss.js`, `kueri_pencarian.js`,
`RetrievalStrategyService.js`, `pencarian_berita.ts` **sama persis** dengan repo (setelah CRLF → LF). Di paket:
`function urlAsliBing` hanya di `shared/teks_rss.js`, `SOAL_SEBAGAI_TENTANG` hanya di `shared/kueri_pencarian.js`.

Aplikasi terpasang (klien) menerima bagian klien lewat rilis berikutnya; bagian server berlaku sejak v538.
