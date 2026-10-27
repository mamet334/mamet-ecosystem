# 27 Oktober 2026 — Konektor MCP Tahap D: uji misi live dari chat (Item 129)

Item 129 ([`ROADMAP-KONEKTOR-MCP.md`](../../roadmap/ROADMAP-KONEKTOR-MCP.md)), Tahap D — sisa terakhirnya: uji misi
sungguhan di chat Assistant. Dijalankan Owner di `npm run desktop`; dibuktikan dari tiga ujung (layar Owner, log
`agent-process`, gudang crawler), bukan dari tampilan saja.

## Prasyarat diperiksa di platform

`agent-process` **v531** di-deploy **2026-10-26 06:23:25 UTC** — 33 detik sesudah commit koreksi `3153dba` (keterangan
sumber crawler, pesan saldo); tak ada perubahan server sesudahnya. Catatan roadmap "perlu deploy lagi" sudah basi.

## Jalannya (permintaan Owner: "kumpulkan berita 7 hari terakhir tentang Ogan Komering Ulu, maksimal 10 hasil, lalu ringkas")

| UTC | Kejadian | Bukti |
|---|---|---|
| 02:25:38 | putaran 0 — model meminta `jalankan_misi` lewat tag | log `[Konektor] aktif … putaran alat 0 · 14 sumber siap` |
| 02:25:53 | dialog persetujuan muncul (sumber, kata kunci, rentang, batas, akses) → Owner **Izinkan**; misi `01M5XJVB…` dimulai | gudang `misi` |
| 02:26:56 | putaran 1 — `status_misi` → "berjalan", **tanpa dialog** | log putaran 1 + catatan kaki |
| 02:27:02 | misi `selesai_sebagian` (69 dtk): **30 tangkapan** — google_news 16, rss_media 14; antaranews.com timeout | gudang `misi.ringkasan` |
| 02:27:10 | putaran 3 — `baca_tangkapan` → 30 tangkapan dibaca, **tanpa dialog** | log putaran 3 + catatan kaki |
| 02:27:17 | jawaban akhir **terpotong pada 359 token, isi 0 huruf** | log `[Saldo] jawaban TERPOTONG …` |

Catatan kaki di layar, ditulis gerbang di proses utama: "🛰️ Ecosystem Crawler (dicatat dari proses utama, bukan dari
kata model): misi … disetujui, masih berjalan · status misi …: berjalan · 30 tangkapan dibaca".

## Kriteria Tahap D

| Kriteria | Hasil |
|---|---|
| Dialog muncul **sekali** per misi; `status_misi` & `baca_tangkapan` misi itu tanpa dialog (K8) | ✅ |
| Model memakai tag `<alat_konektor>`; tag tidak tersisa di jawaban | ✅ 4 putaran dikenali & dijalankan |
| Catatan kaki dari gerbang, bukan dari kata model | ✅ |
| Label **Hypothesis** atas data konektor | ⏳ **belum bisa dinilai** — lihat di bawah |

**Kenapa label belum terbukti:** saldo OpenRouter tipis (Owner belum mengisi). Setiap putaran dipersempit server ke
plafon yang terjangkau (`[Saldo] 402 … diulang SEKALI dengan max_tokens: 481` lalu `359`); di putaran terakhir seluruh
359 token habis untuk nalar sehingga jawaban **0 huruf**. Yang tampil di layar (daftar berita Polsek Ulu Ogan dst.)
adalah **nalar** model, bukan jawabannya — label `[JAWABAN TERPOTONG]` dari server mengatakannya apa adanya.

## Temuan sampingan (belum dikerjakan)

1. **Kata kunci "OKU" terlalu umum di `rss_media`** — model sendiri menilai banyak hasil tidak relevan ("OKU" cocok
   sebagai akronim lain); google_news lebih relevan. Mutu pencocokan di crawler, bukan di konektor.
2. **Suite uji menulis ke data crawler pengembangan Owner**: misi "uji rantai" 02:04 UTC di
   `capability/ecosystem-crawler/data/gudang.db` berasal dari `uji-konektor-mcp.mjs` (misi sungguhan lewat gerbang),
   bukan dari folder sementara — data uji bercampur dengan data Owner.
3. **Biaya putaran konektor di bawah saldo tipis**: satu pertanyaan = 4 panggilan model (putaran 0–3), masing-masing
   dipersempit — nalar menghabiskan anggaran jawaban.

## Sisa

- Ulangi satu permintaan sesudah saldo OpenRouter diisi → buktikan label Hypothesis.
- Bagian B: uji yang sama di workspace Engineer (sakelar Engineer dinyalakan), sekaligus sesudah saldo ada.
