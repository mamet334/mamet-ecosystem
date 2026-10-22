# ADR-CRW-0010: Fork Tool ke Akun Owner dan Mengaktifkan Fitur Bypass Anti-Bot

Status: Accepted (keputusan Owner 2026-10-21)
Tanggal: 2026-10-21
Menggantikan: ADR-CRW-0007 (bungkus tanpa fork → fork di akun Owner), ADR-CRW-0009 butir 1 dan 4 (jalur hanya yang
diizinkan + tanpa penyamaran → robots.txt jadi sakelar Owner + stealth diaktifkan)

## Context

Sejak awal Owner meminta crawler memakai tool asli dari GitHub (Scrapling, Scrapy, Playwright, curl_cffi, Crawl4AI,
Firecrawl), hanya disesuaikan, bukan dibangun ulang. ADR-CRW-0007 menerapkannya sebagai "bungkus tanpa fork", dan
ADR-CRW-0009 kemudian membatasi akses ke jalur yang diizinkan robots.txt serta melarang penyamaran.

Owner menilai pembatasan itu terlalu ketat untuk strategi yang legal tetapi berada di wilayah abu-abu, dan memutuskan:
proyek ini untuk pakai pribadi, semua tool di-fork ke akun GitHub Owner, fitur penembus anti-bot disambungkan, dan
kepatuhan robots.txt dimatikan secara default. Owner memegang risikonya. Konstitusi Mamet menempatkan keputusan akhir
pada Owner (04_OWNER_SOVEREIGNTY), dengan AI sebagai penasihat.

## Decision

1. **Semua tool di-fork ke akun GitHub Owner (mamet334)**, tetap tersambung ke repo upstream agar pembaruan bisa
   ditarik. Crawler memasang dari fork tersebut, versi dikunci pada rilis resmi upstream. Perubahan Owner (bila ada)
   hidup di cabang terpisah di fork, didokumentasikan lewat ADR.

2. **robots.txt menjadi sakelar Owner, default tidak dipatuhi.** `Configure()` dan opsi misi `patuhi_robots` (serta
   `.env` `CRAWLER_PATUHI_ROBOTS`) mengaturnya. Dengan default ini, sumber yang jalurnya sempat dimatikan di
   ADR-CRW-0009 diaktifkan kembali: `google_news`, `playstore`, dan `youtube` (yt-dlp).

3. **Tingkat stealth disambungkan ke tangga eskalasi:**
   `requests → curl_cffi → Playwright/Scrapling dinamis → Scrapling StealthyFetcher (Camoufox)`. Tingkat stealth
   dipakai otomatis hanya bila tingkat di bawahnya diblokir, dan punya sakelar Owner (`stealth` di konfigurasi).
   StealthyFetcher menyamarkan sidik jari browser dan menangani tantangan Cloudflare/Turnstile pada halaman publik.

4. **Dua garis yang tetap dijaga** (bukan karena legalitas, tetapi karena melindungi Owner dan pihak ketiga):
   - **Tidak ada pemecahan CAPTCHA otomatis.** Crawler tidak mengirim CAPTCHA ke layanan pemecah dan tidak mengisi
     kotak "saya manusia". Bila sebuah halaman benar-benar menampilkan CAPTCHA, halaman itu dilewati dan dicatat.
     StealthyFetcher boleh mencegah tantangan muncul, tetapi tidak menjawab tantangan yang sudah muncul.
   - **Tidak ada login, sesi, atau kredensial milik orang lain, dan tidak mengincar individu.** Tetap tanpa akun
     medsos, penulis tetap dipseudonimkan (ADR-CRW-0002), fokus pada isu bukan orang.

5. **Kesopanan tetap berlaku** (ADR-CRW-0004 butir 3): jeda acak antar-permintaan, mundur saat 429, batas kecil per
   misi. Tujuannya tidak membebani situs.

## Alternatives

- **Tetap pasang dari upstream tanpa fork.** Ditawarkan (lebih sedikit perawatan), tidak dipilih Owner.
- **robots.txt tetap dipatuhi, stealth hanya di halaman yang diizinkan.** Ditawarkan, tidak dipilih Owner.
- **Firecrawl self-host disambungkan sekarang.** Ditunda: butuh Docker + Redis yang belum ada di laptop ini. Repo
  tetap di-fork. Firecrawl AGPL-3.0: aman untuk pakai pribadi; kewajiban membuka kode hanya bila dijadikan layanan
  untuk pihak lain.

## Consequences

- Risiko blokir berpindah ke IP rumah Owner; browsing biasa Owner ke situs yang sama bisa ikut terkena tantangan.
- Camoufox (Scrapling stealth) dan browser Playwright perlu diunduh sekali (ratusan MB) oleh Owner.
- Fork perlu dirawat agar tidak tertinggal dari upstream.
- Data lama di gudang tetap tersimpan.

## Impact Scope

`crawler/kanal/web.py` (eskalasi, sakelar robots), registri sumber, `pyproject.toml` (sumber paket dari fork),
`konfig.py`, `.env.example`, MCP, README.

## Related Components

Owner Sovereignty, Capability Adapter, Search Port, Configuration Port.
