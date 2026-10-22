# ADR Ecosystem Crawler

Catatan keputusan arsitektur untuk Ecosystem Crawler, yaitu indra dan tangan Mamet Ecosystem. Formatnya mengikuti
`mamet os ecosystem/constitution/10_ADR_SYSTEM.md`. Prefiks `CRW` dipakai supaya nomornya tidak bentrok dengan ADR di
repo Mamet.

```
Owner ──perintah bebas──▶ MAEF / Claude (otak: rencana)
                              │  Misi terstruktur
                              ▼
                     ECOSYSTEM CRAWLER (indra & tangan)
              📺 tv: feed   💻 laptop: web & API   📱 hp: medsos & inbox
                              │  simpan apa adanya
                              ▼
                     gudang mentah lokal (Hypothesis)
                              │  ditarik lewat kursor
                              ▼
                 Mamet Knowledge System (verifikasi, analisis)
```

| ID | Keputusan | Status |
|---|---|---|
| [ADR-CRW-0001](ADR-CRW-0001-crawler-sebagai-capability-indra.md) | Crawler adalah Capability indra dan tangan: tiga kanal, dua mode, tangga eskalasi, tanpa analisis | Accepted |
| [ADR-CRW-0002](ADR-CRW-0002-gudang-mentah-milik-crawler.md) | Gudang mentah lokal milik crawler, format Tangkapan, pseudonim, ditarik oleh Mamet | Accepted |
| [ADR-CRW-0003](ADR-CRW-0003-misi-terstruktur-dari-maef.md) | Perencanaan di MAEF/Claude, crawler menerima Misi terstruktur, Dispatcher tanpa LLM | Accepted |
| [ADR-CRW-0004](ADR-CRW-0004-kebijakan-sumber-tanpa-login-medsos.md) | Tahap awal tanpa login medsos; API, feed, halaman publik, Apify opsional, inbox | Accepted |
| [ADR-CRW-0005](ADR-CRW-0005-layanan-python-lokal.md) | Paket Python lokal dengan wajah CLI, HTTP `127.0.0.1`, dan MCP | Accepted |
| [ADR-CRW-0006](ADR-CRW-0006-mandiri-sebelum-integrasi-mamet.md) | Mode mandiri kelas satu: perintah lewat CLI, preset, atau Claude (MCP); ekspor CSV/JSONL/MD; tahapan M1–M4 | Accepted |
| [ADR-CRW-0007](ADR-CRW-0007-bungkus-tool-asli.md) | Memakai tool asli dari GitHub lewat pembungkus ("bungkus, jangan ubah"); peta tool dan pasangan penutup kekurangannya | Accepted |
| [ADR-CRW-0008](ADR-CRW-0008-hanya-mode-reaktif.md) | Hanya mode misi (reaktif); pantauan terjadwal tidak dibangun, M2 selesai dengan MCP | Accepted |
| [ADR-CRW-0009](ADR-CRW-0009-kebijakan-akses-jalur-diizinkan.md) | Hanya jalur yang diizinkan robots.txt atau API resmi; identitas jujur, tanpa penyamaran; Google News, Play Store, dan yt-dlp diganti | Diperbarui 0010 |
| [ADR-CRW-0010](ADR-CRW-0010-fork-tool-dan-fitur-bypass.md) | Fork tool ke akun Owner; robots.txt jadi sakelar (default mati); tingkat stealth (Camoufox) disambungkan tanpa pemecah CAPTCHA; google_news/playstore/youtube aktif lagi | Accepted |

Semua ADR disetujui Owner pada 2026-10-21. Sudah dibangun: M1, M2 (MCP), dan M3 tahap 1. Status tahapan ada di
ADR-CRW-0006.

Crawler dipakai **mandiri** lebih dulu (ADR-CRW-0006). Dalam mode itu, peran "otak" pada diagram di atas diisi oleh
Owner lewat CLI/preset, atau oleh Claude lewat MCP. Mamet mengambil alih peran tersebut saat tahap integrasi (M4).

Masih terbuka (perlu ADR di repo Mamet): Search/Research Adapter untuk crawler, dan jalur panggilan dari Electron ke
`localhost`.
