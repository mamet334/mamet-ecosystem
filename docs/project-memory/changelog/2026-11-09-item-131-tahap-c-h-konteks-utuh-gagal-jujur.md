# 9 November 2026 — Item 131 Tahap C + H: riwayat sampai utuh ke model, kegagalan disebut apa adanya

Perintah Owner 9 Nov: *"catat atau ingat dulu, lanjutkan pekerjaan lain"* (sisa Tahap A dicatat, lanjut ke C + H sesuai
urutan). Keputusan Owner sepanjang pengerjaan: C4 = **catatan kerja saja**; blokir Cloudflare = **jangan dibungkus
base64, catat saja**.

## Yang diubah

### Tahap C — anggaran klien satu-satunya penentu riwayat

1. **C2 dicabut** (`request_parser.ts`): potongan riwayat >15 pesan (pesan pertama + catatan palsu
   *"[MAMET HEALER: Memori obrolan lama telah diringkas…]"* + 10 terakhir) dihapus. Parser kini membawa
   `riwayatDilewati` dari klien (bilangan bulat > 0, dibatasi 100.000 — `jumlahDilewatiAman`).
2. **C3 dicabut** (`history_compressor.ts`): pemotongan 800 huruf untuk semua pesan kecuali 2 terakhir dihapus. Yang
   tersisa di server hanya yang tidak membuang isi percakapan: buang blok `<think>`, buang tag panggilan alat, buang
   duplikat pesan saat ini, dan `bersihkan_data_tabel` (melindungi NIP — K3). Setiap lapis dicatat di jejak.
3. **C5 dicabut** (`AssistantService.js`): `MAX_RAG_CONTEXT_CHARS = 4000` & semantik `2000` dihapus. Konteks
   dokumen/web/memori kini memakai anggaran yang sama (`bagiAnggaranKonteks`, porsi 0,5 dari anggaran Settings); bila
   lebih, sisanya tidak dikirim **dengan catatan** berapa huruf yang tidak dikirim. Riwayat memakai sisa anggaran.
4. **C6 dihapus**: `CognitiveMemoryGovernorService.js` (penjaga yang terbukti tak pernah menolak).
5. **C7 dicabut**: jalur `LOOKUP` (`history.slice(-3)`) dan skill (`history.slice(-5)`) kini memakai
   `pilihPesanKonteks` dengan anggaran yang sama, dan ikut mengirim `riwayatDilewati`.
6. **C4 (catatan kerja saja)**: catatan yang ditulis proses utama — "📂 _Dibaca dari folder …" dan "(dicatat dari proses
   utama, bukan dari kata model)" — kini terbawa ke pertanyaan berikutnya karena tidak lagi terpotong. Isi berkas mentah
   tidak disimpan di Supabase. `shared/ukurRiwayat.js` menghitung `catatanKerjaPesan`; gerbang `catatan_kerja_hilang`
   menggantikan `hasil_alat_dibuang`.

### Tahap H — kegagalan disebut apa adanya

- `lib/catatan_jujur.ts` (baru): catatan untuk model bila klien melewatkan riwayat karena anggaran, dan bila RAG gagal;
  catatan untuk pengguna bila RAG gagal (ditempel `synthesis_handler.ts` sesudah `catatanRag`). Jejak mencatat
  `catatanJujur` (`riwayat_dilewati`, `rag_gagal`).
- Gerbang `uji/lib/gerbangJejak.mjs`: merah baru `pemotongan_tanpa_pemberitahuan` dan `rag_gagal_diam`;
  `jalur_memotong_riwayat` hanya bila jalur tak membawa `anggaran`.

### Galat klien (ditemukan saat skenario)

- Galat "body stream already read" menutupi sebab asli: badan jawaban gagal dibaca dua kali (`json()` lalu `text()`).
  `galatRespons.js` (baru) membaca sekali; kedua jalur kirim memakainya.
- Sebab aslinya: **HTTP 403 halaman blokir Cloudflare** di depan Supabase — permintaan tidak sampai ke server Mamet.
  Terbukti dengan kiriman uji: pola path traversal (`../../etc/passwd`) diblokir; SQL injection, `<script>`, perintah
  shell lolos; base64 lolos semua. Satu jawaban model tentang keamanan yang memuat contoh itu mematikan sisa percakapan
  karena ikut di setiap riwayat. Kode `DIBLOKIR_CLOUDFLARE` di `pesanGalat.js`: pengguna diberi tahu sebabnya & disarankan
  percakapan baru (dulu: "periksa API Key"). Dicatat di Parkir `ROADMAP-HARDENING.md`.

## Bukti

- Uji: `uji-konteks-utuh-c` 30/30 (baru), `uji-galat-respons` 12/12 (baru), `uji-jejak-prompt` 72/72 (percakapan
  20 & 40 pesan kini hijau; pemangkas buatan tetap terdeteksi merah); uji lama yang memeriksa teks kode lama
  (`slice(-3)`, pola `json`-lalu-`text`) diperbarui dengan maksud yang sama. Suite penuh 162: 161 lulus, 1 gagal
  `uji-catch-diam` (`galatRespons.js` menambah satu `catch` diam) → diperbaiki (galat baca dicatat `console.warn`),
  patokan diturunkan 173 → 171 karena `AssistantService.js` membaik 8 → 6; `uji-catch-diam` lulus.
- **Deploy oleh Owner:** `agent-process` v552 → **v553**; paket 108 berkas = 102 identik dengan repo, 0 berbeda (sisanya
  berkas di luar repo fungsi).
- **Skenario v553, percakapan 1 (07:39–07:43 UTC):** riwayat sampai ke model utuh kecuali `<think>` & duplikat; catatan
  kerja terbawa 0 → 1 → 2 → 3; RAG gagal 3×, **ketiganya disertai catatan** (`catatanJujur: rag_gagal`). Pertanyaan
  "bypass" dibatasi kebijakan (ALLOW_WITH_LIMIT) dan 2 putaran alat pembaca berkas (45–56 KB) di-BLOCK — itu Tahap D.
  Percakapan lalu terhenti oleh blokir Cloudflare (pesan galat baru tampil benar); Owner melanjutkan di percakapan baru.
- **Percakapan 2 (07:45–07:49 UTC, pertanyaan 9–16):** semua ALLOW; RAG 8 → 8 potongan pada 7 dari 8 giliran, 1 gagal
  **dengan catatan**; contoh riwayat 15 pesan / 34.604 huruf → model 14 pesan / 11.361 huruf (selisih = `<think>` &
  duplikat saja); tanpa potongan parser, tanpa potongan 800 huruf, tanpa catatan palsu; `riwayatDilewatiKlien` 0.
- Log fungsi 07:38–07:50: `match_documents_hybrid` kena batas query **15×**, berhasil 1×; Tier 1 selesai 12× (lewat
  cadangan vektor), gagal total 4× — sisa Tahap A, bukan C/H.

## Belum selesai

- **Mametlite** belum dibuktikan tidak rusak sesudah v553 (satu chat + RAG di Mametlite live) — syarat sebelum C ✅.
- C4 "pertanyaan ke-N memakai hasil folder tanpa memanggil alat lagi" baru terbukti sebagai catatan kerja yang terbawa;
  apakah model memakainya alih-alih membaca ulang belum diukur tersendiri.
- Tahap H yang tersisa: catatan sub-agen dihentikan & label "MAMET HEALER" (ikut Tahap E); RAG lambat (Tahap A).
- Merah yang bukan C/H: BLOCK putaran alat & pembatasan "bypass" (Tahap D); hybrid kena batas 8 s (Tahap A).
