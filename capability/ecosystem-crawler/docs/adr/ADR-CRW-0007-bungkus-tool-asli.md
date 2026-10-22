# ADR-CRW-0007: Memakai Tool Asli dari GitHub dengan Pembungkus, Bukan Membangun Ulang

Status: Accepted (kebutuhan dari Owner 2026-10-21; cara "bungkus, jangan ubah" adalah rekomendasi engineer)
Tanggal: 2026-10-21
Memperjelas: ADR-CRW-0001 (tangga eskalasi dan pemakaian ulang `scraping masalah`), ADR-CRW-0003 (format Misi)
Diperbarui oleh: ADR-CRW-0009 (google-play-scraper dan yt-dlp tidak dipakai karena jalurnya dilarang robots.txt;
peta tool yang berlaku ada di README)

## Context

Owner ingin crawler memakai tool asli dari GitHub, bukan membangun ulang kemampuan yang sudah ada. Tool-tool itu cukup
dimodifikasi sedikit supaya bisa dipanggil lewat satu cara dan digabungkan, sehingga saling menutup kekurangan dan
memanfaatkan kelebihan masing-masing.

Tool anti-bot dan scraper (Scrapling, curl_cffi, yt-dlp, google-play-scraper) diperbarui sangat sering, karena platform
target terus berubah. Salinan yang diubah langsung akan cepat tertinggal dan rusak.

## Decision

1. **Tool dipakai dalam bentuk asli dari upstream.** Instalasinya lewat PyPI (paket resmi yang diterbitkan dari repo
   GitHub masing-masing), dengan versi dikunci di `pyproject.toml`. Kodenya tidak disalin ke repo ini dan tidak diubah.

2. **"Modifikasi sedikit" dilakukan di pembungkus (adapter), bukan di tool.** Setiap tool dibungkus satu modul tipis di
   `crawler/sumber/` atau `crawler/kanal/`. Pembungkus menerjemahkan Misi menjadi panggilan tool, lalu mengubah hasil
   tool menjadi Temuan dengan format yang sama. Karena semuanya berbicara dengan format yang sama, tool bisa
   dipanggil sendiri-sendiri atau digabung dalam satu misi.

3. **Tiga cara menggabungkan tool:**
   - **Berdampingan:** satu misi menjalankan beberapa sumber sekaligus. Satu sumber gagal, yang lain tetap jalan.
   - **Cadangan dalam satu sumber:** bila jalur utama tidak tersedia, pembungkus pindah ke jalur kedua. Contoh: Reddit
     memakai PRAW, lalu feed RSS bila kredensial kosong. Kejadian ini dilaporkan sebagai `Adapter.FallbackTriggered`.
   - **Bertingkat:** tangga eskalasi fetcher (ADR-CRW-0001 butir 5), dengan curl_cffi, lalu Playwright, lalu
     Scrapling stealth.

4. **Peta tool, kelebihan, dan pasangan penutup kekurangannya:**

   | Tool (repo GitHub) | Tahap | Peran | Kelebihan | Kekurangan | Ditutup oleh |
   |---|---|---|---|---|---|
   | feedparser (`kurtmckee/feedparser`) | M1 | Kanal tv: RSS/Atom (Google News, Reddit RSS) | Tahan feed rusak, ringan | Hanya feed | — |
   | PRAW (`praw-dev/praw`) | M1 | Reddit API resmi, termasuk komentar | Lengkap, stabil | Butuh kredensial yang disetujui Reddit | feedparser (RSS) |
   | google-play-scraper (`JoMingyu/google-play-scraper`) | M1 | Ulasan dan pencarian aplikasi Play Store | Tanpa kunci API | Bisa rusak saat Google mengubah halaman | — |
   | API Bluesky (AppView publik, tanpa SDK) | M1 | Postingan dan balasan | Resmi, tanpa login | Pencarian dibatasi laju | — |
   | yt-dlp (`yt-dlp/yt-dlp`) | M3 | Komentar YouTube tanpa kunci API | Tanpa kuota | Lambat untuk video besar | YouTube Data API |
   | curl_cffi (`lexiforest/curl_cffi`) | M3 | HTTP dengan TLS fingerprint browser | Ringan, menembus proteksi jaringan dasar | Tidak menjalankan JavaScript | Playwright |
   | Playwright (`microsoft/playwright-python`) | M3 | Browser headless, intercept JSON | Menangani SPA, lazy load, dan komentar | Berat | curl_cffi untuk halaman ringan |
   | Scrapling (`D4Vinci/Scrapling`) | M3 | Fetcher stealth dan parser adaptif | Selector tahan perubahan DOM | Lapisan tambahan di atas tool lain | — |
   | trafilatura (`adbar/trafilatura`) | M3 | Ekstraksi isi artikel berita | Cepat, tanpa browser | Gagal pada halaman berbasis JS | Crawl4AI |
   | Crawl4AI (`unclecode/crawl4ai`) | M3 | Halaman menjadi Markdown | Menangani JS, keluaran siap LLM | Berat | trafilatura |
   | apify-client (`apify/apify-client-python`) | Opsional | Memanggil Apify actor untuk medsos tertutup | Tanpa merawat anti-bot | Berbayar | `inbox/` |
   | Scrapy (`scrapy/scrapy`) | Nanti | Crawling skala besar | Antrian dan pipeline matang | Event loop sendiri (Twisted) | — |

   Firecrawl (`mendableai/firecrawl`) tidak dipilih untuk saat ini. Fungsinya tumpang tindih dengan Crawl4AI, dan
   versi self-host-nya berlisensi AGPL-3.0. Tool yang hanya berguna dengan login akun medsos (mis. `twscrape`, mode
   login `instaloader`) tidak dipasang, sesuai ADR-CRW-0004.

5. **Urutan bila sebuah tool benar-benar perlu diubah:**
   1. konfigurasi, hook, subclass, atau penyesuaian di pembungkus;
   2. mengirim perbaikan (pull request) ke repo upstream;
   3. upaya terakhir: fork di akun GitHub Owner, dikunci ke satu commit, dengan perubahan didokumentasikan lewat ADR
      baru.

   File di `site-packages` tidak pernah diedit diam-diam.

6. **Lisensi dan asal setiap tool dicatat di katalog sumber** (field `alat`), supaya Owner tahu apa yang dipakai.

7. **Penambahan pada format Misi (ADR-CRW-0003):** field opsional `payload.opsi_sumber`, berisi pengaturan khusus per
   sumber. Contoh: `{"reddit": {"subreddit": "indonesia"}, "playstore": {"aplikasi": ["id.go.bkn.mysapk"]}}`. Sumber
   yang tidak disebut memakai nilai default.

## Alternatives

- **Membangun ulang kemampuan tool sendiri.** Ditolak, karena bertentangan dengan kebutuhan Owner, mahal, dan pasti
  tertinggal dari upstream.
- **Menyalin (vendoring) dan mengubah kode tool.** Ditolak, karena pembaruan upstream (terutama perbaikan anti-bot)
  tidak lagi bisa diambil dengan mudah.
- **Mengendalikan tool sebagai program terpisah lewat command line saja.** Ditolak sebagai default. Pemanggilan
  sebagai library lebih cepat dan memberi data yang terstruktur. Cara command line tetap boleh dipakai untuk tool yang
  memang paling baik dipakai begitu (mis. yt-dlp), asalkan dibungkus dengan cara yang sama.

## Consequences

- Kekuatan crawler naik setiap kali upstream merilis versi baru. Cukup naikkan versinya dan jalankan uji.
- Versi harus dikunci dan diuji. Pembaruan tool bisa mengubah perilaku, jadi uji pembungkus menjadi penting.
- Kerusakan karena perubahan platform biasanya diperbaiki upstream lebih cepat daripada kita bisa memperbaikinya
  sendiri.
- Adapter dari `scraping masalah` dipindahkan dengan pola yang sama: jalur tulisan tangan diganti dengan tool asli bila
  tersedia (mis. parser RSS Reddit diganti feedparser).

## Impact Scope

`crawler/sumber/`, `crawler/kanal/`, `pyproject.toml`, katalog sumber, dan format Misi (`opsi_sumber`).

## Related Components

Capability Adapter (fallback, isolation), Search Port, Configuration Port.
