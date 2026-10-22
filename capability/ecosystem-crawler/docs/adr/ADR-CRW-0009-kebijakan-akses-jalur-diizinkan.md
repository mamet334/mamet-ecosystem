# ADR-CRW-0009: Kebijakan Akses — Hanya Jalur yang Diizinkan atau API Resmi

Status: Accepted (disetujui Owner 2026-10-21)
Tanggal: 2026-10-21
Memperketat: ADR-CRW-0004 butir 3 (robots.txt kini berlaku untuk semua jalur, bukan hanya HTML)
Mengubah: ADR-CRW-0007 butir 4 (peta tool), ADR-CRW-0001 butir 3 (isi kanal)

## Context

Saat membangun M3, setiap jalur yang dipakai sumber dicek ke `robots.txt` situsnya. Beberapa sumber M1 ternyata
memakai jalur yang dilarang untuk robot:

| Sumber | Jalur | robots.txt |
|---|---|---|
| google_news | `news.google.com/rss/` | dilarang |
| reddit (mode RSS) | `reddit.com/.../search.rss`, `.../.rss` | dilarang |
| playstore | `play.google.com/_/PlayStoreUi/data/batchexecute` | dilarang |
| youtube (yt-dlp) | `youtube.com/results`, `youtube.com/youtubei/` | dilarang |

Owner meminta dicarikan jalan lain. Jalur alternatif dicek dan diuji dengan data nyata pada 2026-10-21.

Owner juga meminta crawler bekerja "senyap", menyamar seperti manusia agar tidak dikenali sebagai robot.
Permintaan ini tidak diterapkan (lihat butir 4).

## Decision

1. **Crawler hanya memakai dua jenis jalur:**
   - jalur yang **diizinkan `robots.txt`** situsnya, dicek otomatis sebelum mengambil (`kanal/web.py`); atau
   - **API resmi yang disediakan untuk program**, yang tunduk pada ketentuan API-nya sendiri (mis. Reddit API lewat
     PRAW, YouTube Data API, Bluesky AppView API).

   Sumber yang tidak punya jalur seperti itu dimatikan.

2. **Perubahan sumber:**

   | Sumber | Keputusan | Pengganti |
   |---|---|---|
   | `google_news` | dihapus | `rss_media` (RSS resmi Detik, CNN Indonesia, Antara), dan pencarian oleh perencana lalu isi lengkap lewat `web` |
   | `reddit` | hanya PRAW (API resmi); jalur RSS dihapus | `arctic_shift` (arsip Reddit untuk riset, diizinkan robots.txt) selama kredensial PRAW belum ada |
   | `playstore` | dihapus | tidak ada jalur yang diizinkan; keluhan aplikasi didengar lewat `mediakonsumen`, `reddit`, `youtube` |
   | `youtube` | yt-dlp diganti YouTube Data API v3 | butuh `YOUTUBE_API_KEY` (gratis); tanpa kunci, sumber tidak aktif |
   | `mediakonsumen` | baru | surat pembaca keluhan konsumen; feed per tag/kategori, diizinkan robots.txt |

3. **Kesopanan tetap berlaku:** jeda acak antar-permintaan, mundur saat 429, batas kecil per misi (ADR-CRW-0004
   butir 3). Jeda acak bertujuan tidak membebani situs, bukan menyamar.

4. **Identitas jujur, tanpa penyamaran.** Crawler tidak menyamar sebagai manusia: tidak memalsukan gerakan mouse,
   tidak memutar User-Agent palsu, dan tidak menyembunyikan identitas untuk menghindari deteksi robot. Alasannya:
   - semua jalur di butir 1 memang terbuka untuk program, jadi tidak ada yang perlu disembunyikan;
   - menyamar untuk lolos dari aturan robot bertentangan dengan butir 1;
   - yang mencegah blokir adalah akses yang sopan (butir 3), bukan penyamaran.

   Tangga eskalasi tingkat 2 (sidik jari TLS curl_cffi, ADR-CRW-0001 butir 5) tetap hanya dipakai untuk halaman
   publik yang diizinkan robots.txt. Halaman yang tetap memblokir dilewati dan dicatat.

## Alternatives

- **Tetap memakai jalur yang dilarang dengan volume kecil.** Ditawarkan, tidak dipilih Owner.
- **Menyamar sebagai manusia agar tidak terdeteksi.** Ditolak, dengan alasan di butir 4.
- **GDELT DOC API** sebagai pengganti pencarian berita. Diizinkan, tetapi saat diuji selalu menjawab 429. Ditunda.
- **RSS ulasan App Store (Apple).** Diizinkan, tetapi feed-nya kini kosong. Ditolak.

## Consequences

- Ulasan Play Store tidak lagi tersedia.
- Pencarian berita bergantung pada perencana (mesin pencari Claude) atau RSS media yang hanya memuat berita terbaru.
- Komentar YouTube membutuhkan langkah sekali dari Owner: membuat kunci YouTube Data API.
- Data Reddit dari `arctic_shift` berasal dari pihak ketiga dan bisa terlambat beberapa jam.
- Data lama di gudang dari sumber yang dihapus tetap disimpan (ADR-CRW-0002 butir 6).

## Impact Scope

Registri sumber, `crawler/sumber/`, `kanal/web.py`, `pyproject.toml`, MCP, dan README.

## Related Components

Owner Sovereignty, Capability Adapter (Security Layer), Search Port.
