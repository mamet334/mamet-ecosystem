# 29 Oktober 2026 — Satu pendeteksi kata waktu untuk klien & server (Item 126 Fase 1, ADR-0021 §7)

Sisa yang tercatat di ADR-0021 §7: aturan "pesan menuntut info terkini" (19 kata: `terbaru`, `hari ini`, `berita`,
`news`, …) ada **dua salinan identik huruf demi huruf**:

- klien — `RetrievalOrchestrator.isTemporalQuery()`: memicu web Tier 3;
- server — `RetrievalStrategyService.isTemporalOrRecencyQuery()` (`shared/`, sejak T15): memaksa skor kecukupan dokumen
  lokal 0,15 agar naik ke tier berikutnya.

Hari ini keduanya sama. Bahayanya: satu diubah, yang lain lupa → klien mencari ke web sementara server menganggap dokumen
cukup (atau sebaliknya), tanpa ada yang tahu.

## Yang dibuat

- **`shared/kueri_pencarian.js`**: `adalahKueriWaktu(teks)` — pola **disalin persis** dari kedua salinan; perilaku tidak
  berubah. Memperbaiki isi aturannya (mis. konteks tanggal untuk "terbaru") adalah pekerjaan terpisah.
- **Kedua metode lama tetap ada** (pemanggil tak berubah) dan kini hanya memanggil fungsi bersama itu.
- **`uji/uji-shared-t15.mjs` v2**: modul `shared/` boleh mengimpor sesama `shared/` (berkasnya harus ada); impor ke luar
  `shared/` tetap ditolak.
- **`uji/uji-kueri-pencarian.mjs` v2**, bagian 6: 17 contoh = pola lama; **tiap 19 kata diuji sendirian** dalam kalimat;
  klien (dibundel esbuild dengan supabase tiruan) & server memakai fungsi bersama; pola itu tak boleh ada di berkas lain.

## Bukti

- **Mutasi 3/3 menggigit:** klien kembali menyimpan salinan pola · server tak memakai aturan bersama · kata "berita"
  dihapus dari aturan bersama. Yang terakhir **sempat lolos** — semua contoh yang memuat "berita" juga memuat kata waktu
  lain — sehingga ditambah uji per kata.
- Bundel `agent-process` (esbuild) dan `vite build` berhasil; nol karakter kendali.
- **Suite penuh 127/127** (90,1 s).

## Menunggu

- Deploy `agent-process` oleh Owner (`shared/RetrievalStrategyService.js` berubah) → periksa isi paket di platform:
  `RetrievalStrategyService.js` mengimpor `./kueri_pencarian.js`. Perilaku server tidak berubah.
