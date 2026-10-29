# 29 Oktober 2026 — Tanggal terbit hasil web sampai ke model; kueri "terbaru" sengaja tidak diubah (Item 126 Fase 1, ADR-0021 §7)

Sisa terakhir ADR-0021 §7: "konteks tanggal untuk *terbaru*". Dikerjakan dengan mengukur dulu, dan pengukuran membalik
rancangan pertama.

## Pengukuran (Bing/Google News RSS live, 29 Okt)

- **Masalahnya nyata.** "terbaru OKU" (Bing): 2 dari 8 hasil berumur **2.221 & 2.164 hari**; "terbaru banjir Baturaja":
  4 hasil, semuanya **193–889 hari**; "berita Baturaja hari ini": **0** hasil.
- **Mengubah kueri tidak menolong — tiap cara merusak relevansi di topik yang berbeda** (dinilai dari JUDUL, bukan hanya
  umur; ukuran pertama yang hanya menghitung umur tampak "8 hasil, semua 1–15 hari" dan menyesatkan):

  | Cara | Bagus untuk | Rusak untuk |
  |---|---|---|
  | Bing urut tanggal (`sortbydate`) | "harga cabai" | "OKU" → berita Polandia/Kroasia ("na oku"), restoran sushi; "Pilkada OKU" → berita lain |
  | Bing jendela 7 hari | "banjir Baturaja" | "OKU" → bahasa Igbo, Jepang, Super Bowl |
  | Google News `when:7d` | "OKU" | "banjir Baturaja" → Aceh Singkil, Inggris; "Pilkada OKU" → 0 hasil |
  | "terbaru" → "Oktober 2026" | "OKU Oktober 2026" | "banjir Baturaja Oktober 2026" → banjir rob NTT & Jakarta |

- **Akar masalahnya di klien:** `_parseRssResults` membuang `<pubDate>`. Model sudah diberi tanggal hari ini
  (`waktu_pengguna.ts`), tetapi tidak bisa membedakan berita kemarin dari berita 6 tahun lalu. Sub-agent researcher di
  server sudah menyertakan tanggal (`susunDataPencarian`); web Tier 3 klien belum.

## Yang dibuat (klien saja — tanpa deploy)

- **`WebComparisonService.js`**: parser RSS menyimpan `<pubDate>`; potongan web membawa `terbit` (`YYYY-MM-DD` menurut jam
  lokal, `null` bila tak terbaca) lewat `tanggalTerbit()`.
- **`RetrievalOrchestrator.formatAsContext`**: kepala konteks web → `[Sumber: Berita Web — <url>, terbit 2026-10-21,
  akurasi tidak terverifikasi]`; tanpa tanggal → "tanggal terbit tidak diketahui". Jalur web post-hoc ([STATUS:
  INSUFFICIENT]) memakai fungsi yang sama.
- **Kueri tidak diubah** — dipaku uji, beserta alasannya.

## Bukti

- `uji/uji-kueri-pencarian.mjs` **v3**, bagian 7: parser → potongan → teks konteks model. **Mutasi 4/4 menggigit** (parser
  membuang tanggal · potongan tanpa `terbit` · konteks tanpa tanggal · tanggal tak terbaca jadi "NaN").
- **Live** (kode klien asli dibundel, Bing sungguhan): "kabar terbaru banjir Baturaja" → model kini melihat terbit
  2026-10-21 … 2025-11-27; "harga emas hari ini" → kelima hasil 2026-10-28.
- Suite penuh **127/127** (94,5 s); `vite build` berhasil. Aplikasi terpasang lewat rilis berikutnya.

## Ketahuan dari uji live — belum dikerjakan

- **Contoh di ADR-0021 sendiri gagal total:** "tolong carikan berita terbaru soal OKU dong" → `ringkasKueri` menyisakan
  "terbaru soal OKU dong" → **0 hasil**, lalu kalimat asli → 0. "soal" dan "dong" tidak ada di daftar kata pengisi.
  Memperbaikinya ikut mengubah server (sub-agent researcher) → perlu deploy.
- **URL sumber di klien = tautan pengalih Bing** (`bing.com/news/apiclick.aspx?…&amp;…`), bukan alamat situs. Server sudah
  punya `urlAsliBing()` + pengurai entitas; klien belum → kandidat modul bersama `shared/`.
