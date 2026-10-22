# ADR-CRW-0006: Crawler Dapat Dipakai Mandiri Sebelum Integrasi Mamet

Status: Accepted (disetujui Owner 2026-10-21)
Tanggal: 2026-10-21
Memperjelas: ADR-CRW-0003 (siapa perencana dalam mode mandiri), ADR-CRW-0005 (urutan wajah dan ekspor)
Diperbarui oleh: ADR-CRW-0008 (pantauan dan `crawler pantau` tidak dibangun; M2 selesai dengan MCP)

Status tahapan (2026-10-21): M1 selesai; M2 selesai (MCP); M3 tahap 1 selesai (YouTube lewat yt-dlp, Kaskus dari
link thread, sumber `web` dengan trafilatura, tangga eskalasi tingkat 1–2, saringan `kecualikan_penulis`). M3 tahap 2
(tingkat browser dan komentar portal berita) belum dibangun.

## Context

Owner sengaja memisahkan `ecosystem crawler` dari folder `mamet os ecosystem`. Crawler harus sudah berguna sebelum
diintegrasikan ke Mamet.

ADR-CRW-0001 sampai 0005 menempatkan Mamet sebagai konsumen utama dan MAEF sebagai perencana. Agar bisa dipakai
mandiri, dua hal perlu dijawab:

1. Tanpa MAEF, siapa yang menyusun misi?
2. Tanpa Mamet, bagaimana Owner melihat dan memakai hasilnya?

## Decision

1. **Mode mandiri adalah mode kelas satu, bukan mode sementara.** Saat runtime, crawler tidak bergantung pada Mamet sama
   sekali: tidak mengimpor kode dari repo Mamet, tidak memegang kredensial Supabase, dan tidak membaca konfigurasi
   Mamet. Format kontrak Mamet (input/output dan fungsi capability) tetap diterapkan di dalam crawler, sehingga
   integrasi kelak cukup menambah adapter di sisi Mamet.

2. **Tiga cara memberi perintah dalam mode mandiri:**

   | Cara | Contoh | Perencana |
   |---|---|---|
   | CLI langsung | `crawler cari "mutasi ASN" "PNS dimutasi" --sumber reddit,google_news --sejak 90h --batas 200` | Owner (perintah terstruktur) |
   | File preset misi | `crawler misi jalankan misi/keluhan-asn.yaml` | Owner (menulis/menyunting preset) |
   | Chat lewat Claude Code / Claude Desktop (MCP) | "cari keluhan ASN soal mutasi 3 bulan terakhir" | Claude (perintah bebas diubah menjadi Misi) |

   Ketiganya menghasilkan format Misi yang sama (ADR-CRW-0003). Crawler tetap tidak menafsirkan perintah bebas. Bila
   `trace_id` tidak diisi, crawler membuatnya sendiri dengan prefiks `lokal-`.

   Pantauan dalam mode mandiri: `crawler pantau misi/keluhan-asn.yaml --setiap 120m`.

3. **Hasil bisa dilihat dan dipakai tanpa Mamet:**

   | Perintah | Hasil |
   |---|---|
   | `crawler lihat <misi_id>` | Ringkasan di terminal: jumlah per sumber, item baru, kegagalan beserta alasannya |
   | `crawler ekspor <misi_id> --format csv` | `hasil/<misi_id>/tangkapan.csv`, untuk dibuka di Excel |
   | `crawler ekspor <misi_id> --format jsonl` | `hasil/<misi_id>/tangkapan.jsonl`, untuk skrip atau AI mana pun |
   | `crawler ekspor <misi_id> --format md` | `hasil/<misi_id>/daftar.md`, berupa daftar tangkapan yang dikelompokkan per sumber dan diurutkan menurut waktu/metrik. Ini bukan ringkasan, jadi tidak ada analisis |
   | `crawler katalog` | Daftar sumber, kanal, status aktif, dan kesehatannya |

   Ekspor mengikuti aturan pseudonim (ADR-CRW-0002 butir 4). Username asli hanya keluar bila misi dibuat dengan
   `buka_identitas_penulis: true`.

4. **Analisis dalam mode mandiri dilakukan oleh konsumen di luar crawler:** Claude lewat MCP (`baca_tangkapan`), file
   ekspor yang ditempel atau diunggah ke AI mana pun, atau `analysis/` milik `scraping masalah` yang membaca JSONL.
   Crawler tetap tidak menganalisis (ADR-CRW-0001 butir 2).

5. **Urutan pembangunan wajah: CLI, lalu MCP, lalu HTTP API.** HTTP API hanya dibutuhkan Mamet, sehingga ditunda sampai
   tahap integrasi. Rincian endpoint di ADR-CRW-0005 tetap berlaku untuk tahap itu.

6. **Tahapan:**

   | Tahap | Isi | Bisa dipakai untuk |
   |---|---|---|
   | M1 | Inti (kontrak, Misi, Tangkapan, Dispatcher), gudang SQLite, CLI (`cari`, `misi jalankan`, `lihat`, `ekspor`, `katalog`), sumber: Google News RSS (baru), Reddit (mode RSS tanpa kredensial), Bluesky, Play Store, inbox (pindahan dari `scraping masalah`) | Misi sekali jalan dan ekspor ke Excel/AI |
   | M2 | Pantauan terjadwal dan MCP server | Satu perintah chat lewat Claude, serta pemantauan rutin |
   | M3 | Kanal laptop dengan tangga eskalasi (Scrapling), Kaskus, komentar portal berita, YouTube Data API | Sumber Indonesia yang lebih luas |
   | M4 | HTTP API dan adapter di sisi Mamet (dengan ADR di repo Mamet) | Integrasi ke Mamet Ecosystem |

## Alternatives

- **Menunggu integrasi Mamet sebelum crawler dipakai.** Ditolak, karena bertentangan dengan kebutuhan Owner, dan
  menunda umpan balik tentang sumber mana yang benar-benar berguna.
- **Membuat antarmuka web kecil khusus crawler.** Ditunda. CLI, MCP, dan ekspor sudah cukup untuk mode mandiri, dan
  antarmuka visual kelak disediakan oleh Mamet.
- **Memberi crawler perencana sendiri agar bisa menerima perintah bebas tanpa Claude.** Ditolak, dengan alasan yang
  sama seperti di ADR-CRW-0003. Perintah bebas tanpa Claude diganti dengan file preset misi.

## Consequences

- Crawler dapat dipakai sejak M1, tanpa menyentuh repo Mamet.
- Crawler membawa konfigurasinya sendiri (`.env`, `misi/`, `hasil/`). Folder `hasil/` dan `data/` masuk `.gitignore`.
- Pengalaman "satu perintah chat" sudah tersedia di M2 lewat Claude Code, sebelum integrasi Mamet.
- Saat integrasi (M4), tidak ada perubahan format. Mamet hanya mengambil alih peran perencana dan konsumen.

## Impact Scope

Wajah CLI dan MCP, perintah ekspor, folder preset misi, serta urutan tahapan pembangunan.

## Related Components

Capability Port (Search, Research), Capability Adapter, Owner Sovereignty, Configuration Port.
