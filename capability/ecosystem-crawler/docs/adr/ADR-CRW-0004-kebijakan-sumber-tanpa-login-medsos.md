# ADR-CRW-0004: Kebijakan Sumber Tahap Awal, Tanpa Login Medsos

Status: Accepted (disetujui Owner 2026-10-21; implementasi belum dimulai)
Tanggal: 2026-10-21

## Context

Diskusi Owner dengan Gemini mengusulkan "Session-Based Playwright": memakai cookies dari akun yang sudah login untuk
merayapi X, Instagram, TikTok, LinkedIn, dan Quora. Sebaliknya, README `scraping masalah` sengaja menolak scraping
Facebook Groups, Quora, dan X dengan login, karena melanggar ketentuan platform dan berisiko akun diblokir permanen.
Proyek itu menggantinya dengan folder `inbox/` (salinan manual).

Kedua sikap ini bertentangan, sehingga perlu satu keputusan.

Selain itu, sebagian tujuan Owner (keluhan masyarakat, masalah ASN) menyentuh data pribadi orang. Di Indonesia, hal
ini diatur UU 27/2022 tentang Pelindungan Data Pribadi.

## Decision

1. **Tahap awal hanya memakai sumber yang tidak memerlukan login otomatis:**
   - API resmi: Reddit (PRAW/OAuth), YouTube Data API, Stack Exchange, Hacker News (Algolia), Bluesky, OpenAlex,
     arXiv, X API berbayar bila token diisi;
   - feed publik: RSS/Atom portal berita, Google News RSS;
   - halaman publik yang terbuka tanpa login: portal berita beserta komentarnya, Kaskus, ulasan Play Store;
   - Apify actor (opsional dan berbayar), aktif hanya bila token diisi Owner;
   - folder `inbox/` untuk salinan manual dari platform tertutup.

2. **Yang tidak dilakukan crawler:**
   - login otomatis, membuat akun, atau memakai cookies akun untuk merayapi medsos;
   - menyelesaikan CAPTCHA secara otomatis. Bila sebuah sumber selalu meminta CAPTCHA, sumber ditandai `terblokir`
     dan perencana diarahkan ke Apify atau `inbox/`;
   - mengirim pesan, berkomentar, memberi like, atau mengikuti akun. Crawler hanya membaca;
   - mengumpulkan data untuk menghubungi orang satu per satu.

3. **Kesopanan akses default:** jeda acak antar-permintaan, batas laju per sumber (`batas_laju` di katalog), mundur
   otomatis saat 429, dan `robots.txt` dihormati untuk sumber HTML. Owner dapat mengubah batas laju per sumber. Setiap
   pengecualian `robots.txt` harus berupa pengaturan eksplisit per sumber dan tercatat di log.

4. **Browser stealth** (tingkat 4 di tangga eskalasi ADR-CRW-0001) hanya dipakai untuk halaman publik tanpa login.

5. **Fokus pada isu, bukan individu.** Pseudonim penulis aktif secara default (ADR-CRW-0002 butir 4). Crawler tidak
   menyediakan fitur "kumpulkan semua postingan dari akun X".

6. **Owner dapat menyalakan dan mematikan setiap sumber** lewat `Configure()`, tanpa mengubah kode.

## Alternatives

- **Sesi akun medsos sejak awal.** Ditolak untuk tahap awal. Risikonya akun Owner diblokir, melanggar ToS platform,
  biaya perawatannya tinggi (anti-bot berubah tiap minggu), dan bertentangan dengan keputusan di `scraping masalah`.
- **Hanya Apify untuk semua medsos.** Ditolak sebagai default karena biaya berjalan per pemakaian. Tetap tersedia
  sebagai opsi.
- **Tanpa batasan sama sekali.** Ditolak karena risiko hukum (UU PDP), risiko blokir IP, dan bertentangan dengan Owner
  Sovereignty, karena Owner harus memegang kendali atas risiko yang diambil.

## Consequences

- X, Instagram, TikTok, Facebook, dan Quora pada tahap awal hanya terjangkau lewat Apify (berbayar), API berbayar, atau
  `inbox/` manual. Cakupan medsos tertutup akan terbatas.
- Crawler lebih stabil dan murah dirawat, karena sebagian besar sumbernya API dan feed.
- **Jalan ke depan:** adapter sesi akun dapat ditambahkan lewat ADR baru yang menggantikan (supersede) butir 2. Syarat
  minimum: akun khusus (bukan akun pribadi Owner), modul adapter terpisah yang mati secara default, sakelar per
  sumber, dan pernyataan penerimaan risiko oleh Owner.

## Impact Scope

Katalog sumber, adapter sumber, fetcher (tangga eskalasi), dan konfigurasi per sumber.

## Related Components

Owner Sovereignty, Capability Adapter (Security Layer), Search Port, Configuration Port.
