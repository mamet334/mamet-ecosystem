# 27 Oktober 2026 — Kata kunci pendek crawler + analisis kata kunci oleh model (Item 129)

Temuan sampingan uji live Tahap D ([log](./2026-10-27-konektor-mcp-tahap-d-uji-live.md)): misi "berita 7 hari tentang
Ogan Komering Ulu" menangkap 14 berita `rss_media` yang tidak relevan. Owner meminta analisis oleh LLM atas perintahnya;
disepakati perbaikan **dua sisi** dengan alat yang tepat untuk masing-masing (keputusan Owner: "kerjakan nomor 1 dan 2").

## Akar masalah

| Tahap | Pelaku | Yang terjadi |
|---|---|---|
| 1. Memahami perintah | model (Mamet) | Owner menulis "Ogan Komering Ulu"; model — sesuai arahan "termasuk sinonim" — menambah **"OKU"** |
| 2. Menyaring | crawler (tanpa model) | `kata_kunci_cocok` = **potongan teks** tak peka huruf besar → "OKU" cocok di "F**oku**s" |
| 3. Menilai | model (Mamet) | menyimpulkan sendiri "hasil rss_media tidak relevan … OKU terlalu generik" |

**14/14** tangkapan `rss_media` lolos karena "Fokus" (diperiksa per tangkapan, gudang dibuka hanya-baca). Kenapa tahap 2
tidak diganti model: satu misi menyaring ratusan entri (ratusan panggilan model per misi), crawler sengaja alat data
mentah tanpa model, dan analisis model terbaik pun tidak memperbaiki cacat mekanisnya — menghindari "OKU" justru
membuang berita yang paling relevan ("Polres OKU", "OKU Timur").

## Diukur dulu di korpus penuh (sebelum mengubah kode)

Tiga aturan pada dua korpus — gudang Mamet (30 tangkapan) dan gudang crawler lama `D:\SLAMET\other\ecosystem crawler`
(21 misi, 466 tangkapan) — tiap kecocokan yang hilang dinilai dari konteksnya:

| Korpus | Cocok sekarang | B: semua kata utuh | **C: pendek/akronim saja** |
|---|---|---|---|
| Gudang Mamet | 25 | −14 | **−14** ("OKU" di "Fokus" ×14 — salah) |
| Gudang lama | 236 | −3 | **−2** ("ASN" di "atasnya", "Batasnya" — salah) |

Aturan B juga membuang "side hustle" ⊂ "side hustle**s**" — kecocokan BENAR (imbuhan). Aturan C: **16 hilang, 16 salah,
0 kecocokan benar hilang**. Diukur ulang dengan kode terpasang (bukan prototipe): hasil sama.

## Yang dibuat

1. **Crawler** `capability/ecosystem-crawler/crawler/inti/teks.py` — `kata_kunci_pendek`: kata ≤ 4 huruf tanpa spasi
   atau akronim (huruf besar semua) wajib **kata utuh** (`(?<!\w)…(?!\w)`, tetap tak peka huruf besar); kata lain tetap
   potongan teks. Satu tempat → berlaku untuk saringan `rss_media`/`inbox`/`mediakonsumen`, kolom `kata_kunci_cocok`,
   dan `kata_kunci_kecuali` (pengecualian pendek tak lagi membuang tangkapan keliru). Batas yang diketahui: akronim
   dirangkai huruf lain tidak cocok ("OKUT" ≠ "OKU" → tambahkan sebagai kata kunci sendiri). Docstring alat
   `jalankan_misi` diselaraskan.
2. **Arahan model** `frontend/src/core/runtime/services/konektorAlat.js` aturan 1 (dipakai desktop & server) — model
   mengenali dulu APA yang dicari (daerah, lembaga, orang, topik); diberi tahu crawler mencocokkan harfiah, bukan
   makna (kata ≥ 5 huruf potongan teks, ≤ 4 huruf & akronim kata utuh); akronim didampingi nama lengkap & penanda khas
   (untuk daerah: ibu kota/kecamatan, mis. "Baturaja"); makna lain lewat `kata_kunci_kecuali`. Disambung ke aturan 1,
   bukan nomor baru — penomoran aturan lain tetap.

## Bukti

- `tests/test_kata_kunci.py` (pytest, baru) — kasus nyata dari kedua korpus; **3 mutasi menggigit** (kembali substring,
  kata utuh untuk semua, kata utuh peka huruf besar). Uji crawler 39/39.
- `uji/uji-konektor-kata-kunci.mjs` (baru) — **arahan model selaras dengan crawler**: angka batas di prompt = di
  `teks.py`, akronim di keduanya, docstring alat sama; **2 mutasi menggigit** (batas crawler diubah sepihak 4→3, arahan
  analisis entitas dihapus).
- Bundel `agent-process` dicek esbuild sebelum deploy (arahan baru terbawa). **Deploy Owner: v532 ACTIVE, 02:55:05
  UTC**, `verify_jwt` tetap `false` — diperiksa di platform.
- Suite Mamet 121/121.

## Belum dibuktikan

- Misi "Ogan Komering Ulu" diulang: model menyusun kata kunci dengan arahan baru, crawler tidak lagi meloloskan
  "Fokus" — butuh saldo OpenRouter (sekaligus bukti label Hypothesis Tahap D). Di `npm run desktop` sakelar konektor
  dimatikan-dinyalakan dulu supaya proses crawler memuat kode baru; aplikasi terpasang lewat rilis berikutnya.
