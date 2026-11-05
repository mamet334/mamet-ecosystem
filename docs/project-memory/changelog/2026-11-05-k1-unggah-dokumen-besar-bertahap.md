# K1 Langkah 2 — Unggah Dokumen Besar Bertahap (Satu Berkas Mentah = Satu Dokumen)

**Tanggal:** 5 November 2026
**Roadmap:** [`ROADMAP-HARDENING.md`](../../roadmap/ROADMAP-HARDENING.md) K1 langkah 2 · K2 · K5 · K6
**Status:** ✅ live — `rag-process` v82, `agent-process` v548, migrasi `unggah_bertahap` (20261105135519),
`kunci_unggah`, `indeks_document_id`; klien Ecosystem + Mametlite (logika identik).

## Kenapa

Pagi ini buku umum Owner ("48 hukum kekuasaan", 1.986 potongan) berhenti di 1.856 sesudah 105 s — anggaran
`rag-process` 110 s — dan SELURUHNYA dibuang (embedding 58 kelompok tetap dibayar). Unggahan 385 changelog gagal 11:
9× 503 gerbang Supabase, 1× penolakan lokasi Google, 1× karakter NUL ([log](./2026-11-05-unggah-buku-besar-dan-sejarah-aplikasi.md)).
Keputusan Owner: **berkas mentah diunggah utuh sebagai satu dokumen; yang gagal di tengah menjadi cache; berkas yang
sama melanjutkan tanpa embedding ulang dari awal**; cache OCR di perangkat (A), di server (B) = Parkir; Mametlite ikut.

## Yang dipasang

| Bagian | Perubahan |
|---|---|
| `rag-process` | Dokumen dibuat `selesai=false` + `sidik` (SHA-256 teks, dihitung server) + `total_potongan`; setiap kelompok 32 potongan disimpan begitu vektornya jadi. ±80 s per panggilan → `selesai:false` + jumlah tersimpan. Judul sama + sidik sama → **lanjut dari potongan yang tersimpan (dihitung server)**; sidik/total beda → 409. Gagal di tengah → dokumen dipertahankan (kecuali 0 tersimpan). NUL dibuang. Batas volume menghitung sisa saja. |
| Kunci sementara | `diproses_sampai` ±130 s: panggilan lain selagi terkunci → 423 `SEDANG_DIPROSES` tanpa embedding; dilepas di `finally` (selesai, jeda, ditolak, gagal); kedaluwarsa sendiri. |
| `vector_utils.ts` (chat juga) | 400 "User location is not supported" diulang seperti 429/5xx. Rute penyedia **sengaja tidak diatur** (lihat ukur rute). |
| Database | `documents.selesai/sidik/total_potongan/diproses_sampai`; `match_documents`, `_hybrid`, `_judul` + cadangan pencocokan kata (`shared/KnowledgeService.js`) hanya membaca dokumen `selesai`; indeks `document_chunks(document_id)`. Hak fungsi tetap service_role (K5). |
| Klien | `unggahBertahap.js`: memanggil lagi sampai selesai; 503/502/429/jaringan diulang 2–16 s; 423 ditunggu 30 s ×6; 401/402/403/409/413 berhenti. `cacheOcr.js` (IndexedDB, kunci SHA-256 berkas + halaman) + `terapkanOcrHalaman(…, { cache })`. Daftar dokumen menandai "Belum selesai". Mametlite: versi lama dihapus hanya bila selesai & bukan dokumen yang dilanjutkan. |
| Batas K5 | Per akun 10.000 → **25.000** (keputusan Owner; paket gratis 500 MB, DB 86 MB, 6.503 B/potongan; akun hanya lewat undangan sejak 31 Okt); total tetap 45.000. |

## Ukur rute embedding (sebelum deploy)

`uji/ukur-rute-embedding.js`: 8 potongan tersimpan divektorkan ulang per rute (`allow_fallbacks:false`).
`google-vertex` → **404 "No endpoints found"** (disaring "Regional Surcharge"); `google-ai-studio` → kosinus
**1,0000 pada 8/8**. Semua vektor tersimpan berasal dari AI Studio; rencana "utamakan Vertex" dicabut sebelum deploy.

## Bukti live (log `rag-process` + database)

| Uji | Hasil |
|---|---|
| A — buku 1.986 potongan | 14:01:45 mulai → 14:03:03 ⏸ 1.440 (81,1 s) → "lanjut dari 1440" → ✅ 1.986/1.986 (1.440 dari cache, 31,8 s). 1 dokumen, 1.986 unik, 0 tanpa vektor. |
| Batas 25.000 | Kamus 6.472 potongan (akun 8.304) ditolak 413 sebelum embedding pada batas lama; diterima pada v80. |
| B — Kamus 6.472, Ctrl+R di tengah | panggilan 2 berjalan terus sesudah Ctrl+R (2.496); unggah ulang 4 menit kemudian → "**lanjut dari 2496**" → … → ✅ 6.472/6.472 (6.464 dari cache). Potongan per panggilan 1.440+1.056+1.504+992+1.472+8 = 6.472 → **setiap potongan divektorkan tepat sekali**; 6.472 unik, 0 tanpa vektor. Cache OCR: "20/181 (20 dari cache)" sesudah muat ulang. |
| Kunci (v81) | Unggah ulang segera sesudah Ctrl+R: kunci diambil & dilepas (`PATCH … or=(diproses_sampai…)` 200). Tabrakan 423 belum terjadi live (panggilan lama selesai 4 s sebelumnya) — terbukti di uji otomatis & mutasi. |
| Temuan → indeks | Hitungan potongan bersamaan dengan pemuatan Home → `HEAD document_chunks?document_id=…` **500, 3× "statement timeout"** (tanpa indeks `document_id`). Klien mengulang → selesai, 1.986 unik. Sesudah indeks: Index Only Scan **31 ms**. Pesan galat kini tak lagi menulis "0 dari N" bila hitungan gagal (v82). |
| Data tak tercampur | Daftar Research App sempat menampilkan dokumen semua workspace sesudah muat ulang — database: tiap workspace utuh (tampilan berlomba; Parkir). |

## Uji

`uji/uji-unggah-bertahap.mjs` (baru, 69 kasus): `rag-process` dibundel sungguhan dengan database tiruan berisi + jam
tiruan (anggaran, lanjutan tanpa embedding ulang, urutan, tanpa ganda, gagal → cache, 409, NUL, galat simpan, volume
sisa, kunci & kedaluwarsa, hitungan gagal), `vector_utils` (rute tak dipaksa, lokasi diulang), klien (ulang 503/jaringan/
502, berhenti 401/402/409/413, tunggu 423, macet), cache OCR (IndexedDB tiruan + PDF asli pdf-lib), penyaring pencarian.
`uji-batas-rag-process` disesuaikan (25.000). Mutasi di salinan **36/36** (1 mati lewat batas waktu: tanpa penjaga macet, uji berputar tanpa henti).
`uji-salinan-mametlite` lulus. Suite **157/157**.

## Diperbaiki sambil jalan

`2026-07-28_engineer_debugging_fixes.md` & `OWNER_MANIFESTO.md` → UTF-8 (commit sebelumnya). Item 88 ditutup di
INDEX & roadmap-nya. Pengingat VACUUM FULL di INDEX §1 + ROADMAP-HARDENING K6.

## Sisa (ROADMAP-HARDENING)

K1 langkah 3 💳: hapus 221 Kepbup pecahan → unggah buku 1.008 halaman utuh → uji penuh K1/K2 → VACUUM FULL.
Parkir: daftar yang berlomba, perkiraan biaya OCR belum menghitung cache, halaman OCR gagal tak di-cache, cache OCR server.
