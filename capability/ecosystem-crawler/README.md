# Ecosystem Crawler

Indra dan tangan untuk Mamet Ecosystem. Crawler ini **hanya mencari, mengambil, dan menyimpan** data mentah dari
banyak sumber. Analisis dilakukan di luar crawler: oleh Claude, oleh AI lain lewat file ekspor, atau kelak oleh Mamet.
Crawler bisa dipakai sendiri tanpa Mamet.

> **Di Mamet Ecosystem (23 Okt 2026):** folder ini salinan crawler yang kini dikembangkan di sini, sebagai
> capability Mamet (Item 129, [`ROADMAP-KONEKTOR-MCP.md`](../../docs/roadmap/ROADMAP-KONEKTOR-MCP.md)). Repo
> `ecosystem-crawler` asal tidak diikuti lagi. Paket **tidak** dipasang mode editable: semua perintah dijalankan dari
> folder ini lewat `.venv\Scripts\python -m …` — mis. `python -m crawler katalog`, `python -m crawler.wajah.mcp_server`,
> `python -m pytest`. Program `crawler.exe`/`crawler-mcp.exe` di bawah ini tidak ada di salinan ini.

Keputusan arsitekturnya ada di [`docs/adr/`](docs/adr/README.md). Yang sudah dibangun: **16 sumber**, perintah lewat
chat (MCP), tangga eskalasi lengkap sampai tingkat stealth, dan colokan proxy. Crawler hanya bekerja bila diperintah
(tanpa pemantauan terjadwal, ADR-CRW-0008). Komentar portal berita (Detik, Kompas) belum dibangun.

**Kebijakan akses (ADR-CRW-0010):** `robots.txt` adalah sakelar Owner (default **tidak** dipatuhi), dan tingkat
stealth boleh dipakai untuk menembus halaman publik yang memblokir. Dua garis tetap dijaga: crawler **tidak** menjawab
CAPTCHA/tantangan yang sudah muncul, dan **tidak** memakai akun/kredensial orang lain. Jeda acak antar-permintaan
dipakai supaya tidak membebani situs. Tool aslinya di-fork ke akun Owner (lihat `pyproject.toml`).

## ⚠️ Disclaimer / Tanggung jawab pemakai

Perangkat ini dibuat untuk **riset dan edukasi pribadi**. Disediakan apa adanya, **tanpa jaminan apa pun**
(lihat `LICENSE`).

**Segala akibat dari pemakaian sepenuhnya menjadi tanggung jawab pemakai.** Dengan memakai perangkat ini, Anda
setuju untuk:

- menghormati **ketentuan layanan (ToS)** setiap situs yang Anda akses;
- mematuhi **hukum yang berlaku** di wilayah Anda, termasuk di Indonesia UU ITE dan UU 27/2022 tentang Pelindungan
  Data Pribadi;
- **tidak** memakainya untuk mengakses sistem tanpa izin, memanen data pribadi secara massal, melecehkan, menipu,
  atau merugikan pihak lain;
- menanggung sendiri risiko pemblokiran IP/akun dan konsekuensi hukum atas pilihan pemakaian Anda.

Pembuat dan kontributor tidak bertanggung jawab atas penyalahgunaan oleh pihak mana pun. Fitur yang berisiko
(mematikan `robots.txt`, tingkat stealth) bersifat **pilihan sadar** yang bisa dimatikan — gunakan dengan bijak.

| Kanal | Sumber | Tool asli yang dibungkus | Cara pakai |
|---|---|---|---|
| 📺 tv | `google_news` | feedparser | kata kunci; judul berita (isi lewat `web`) |
| 📺 tv | `rss_media` | feedparser + trafilatura | kata kunci; berita terbaru Detik, CNN Indonesia, Antara |
| 📺 tv | `turnbackhoax` | feedparser + trafilatura | kata kunci/tag; cek fakta Mafindo (label `[SALAH]`/`[PENIPUAN]`) |
| 💻 laptop | `mediakonsumen` | feedparser + trafilatura | tag atau kata kunci; surat pembaca keluhan konsumen |
| 💻 laptop | `openalex` | OpenAlex API | kata kunci; karya ilmiah (abstrak, DOI, sitasi) |
| 💻 laptop | `arxiv` | arXiv API + feedparser | kata kunci; preprint sains (fisika, matematika, CS) |
| 💻 laptop | `stackexchange` | Stack Exchange API | kata kunci; tanya-jawab teknis & rekomendasi software |
| 💻 laptop | `wikipedia` | MediaWiki API | kata kunci; ensiklopedi rujukan |
| 💻 laptop | `arctic_shift` | Arctic Shift API (arsip Reddit untuk riset) | kata kunci + subreddit |
| 💻 laptop | `reddit` | PRAW (API resmi) | kata kunci; **butuh kredensial Reddit** |
| 💻 laptop | `kaskus` | requests + curl_cffi | link thread (`--url`) |
| 💻 laptop | `web` | trafilatura + curl_cffi (+ stealth) | link halaman apa pun (`--url`) |
| 📱 hp | `youtube` | YouTube Data API v3 / yt-dlp | kata kunci atau link video (yt-dlp bila tanpa kunci) |
| 📱 hp | `playstore` | google-play-scraper | kata kunci atau ID aplikasi; ulasan |
| 📱 hp | `bluesky` | Bluesky AppView API | kata kunci (akun robot berita dibuang otomatis) |
| 📱 hp | `inbox` | salinan manual Anda (Facebook Groups, Quora, X, TikTok, ...) | berkas di `inbox/` |

Google News hanya memberi judul berita; untuk isi lengkap, cari link-nya lalu ambil lewat `web`.

`kaskus` dan `web` tidak bisa mencari sendiri: link-nya dicari dulu lewat mesin pencari, lalu dikirim dengan `--url`.
Di chat, Claude melakukan ini sendiri. Dari Kaskus yang diambil adalah postingan pembuka thread beserta jumlah
balasannya, bukan isi balasannya. Halaman yang diblokir dicoba naik ke tingkat stealth; bila tetap gagal (mis.
tantangan Cloudflare aktif yang tidak dijawab), halaman itu dilewati dan alasannya dicatat.

## Pasang (cukup sekali)

```bash
py -3.12 -m venv .venv
```

Lalu pasang **dependensi** yang tercantum di `pyproject.toml` (`dependencies` + `pytest`) dengan
`.venv\Scripts\python -m pip install <paket>==<versi> …` — **jangan** memasang paket crawler itu sendiri (`pip
install -e .` atau `pip install .`): keduanya membuat Python bisa memuat kode crawler dari tempat lain selain folder
ini. Di salinan Mamet `.venv` sudah ada (disalin, 23 Okt), jadi langkah ini hanya bila `.venv` dibuat ulang.

Untuk tingkat stealth (sumber yang perlu menembus pemeriksaan browser), unduh sekali browser-nya:

```bash
.venv\Scripts\scrapling install
```

Garam pseudonim dibuat otomatis di `.env` saat pertama jalan. **Jangan diganti** setelah ada data. Kunci opsional
diisi di `.env` (contohnya di `.env.example`):

- **`YOUTUBE_API_KEY`** untuk sumber `youtube`. Gratis, dengan kuota 10.000 unit per hari. Cara membuatnya:
  1. Buka [console.cloud.google.com](https://console.cloud.google.com/), masuk dengan akun Google, lalu buat
     project baru (mis. "ecosystem-crawler").
  2. Menu **APIs & Services → Library**, cari **YouTube Data API v3**, klik **Enable**.
  3. Menu **APIs & Services → Credentials → Create credentials → API key**. Salin kuncinya.
  4. Disarankan: klik kunci itu, lalu di **API restrictions** pilih hanya *YouTube Data API v3*.
  5. Tempel ke `.env` sebagai `YOUTUBE_API_KEY=...`, lalu jalankan `crawler katalog` untuk memastikan statusnya
     `siap`.
- **`REDDIT_CLIENT_ID`** dan **`REDDIT_CLIENT_SECRET`** untuk sumber `reddit`, setelah akses API disetujui Reddit.
  Sebelum itu, pakai `arctic_shift`.
- **`CRAWLER_PROXY`** (opsional): mengarahkan semua permintaan HTTP lewat proxy, berguna bila sebuah situs memblokir
  IP Anda. Kosong = pakai koneksi langsung (IP rumah). Format: `http://user:sandi@host:port` atau
  `socks5://host:port` (SOCKS perlu `pip install "requests[socks]"`). Cek statusnya dengan `crawler katalog` (baris
  teratas; kata sandi disamarkan). Untuk pemakaian kecil biasanya belum perlu. **Hindari daftar proxy gratis** —
  pemiliknya bisa menyadap lalu lintas Anda; pakai penyedia berbayar yang tepercaya.
- **`CRAWLER_PATUHI_ROBOTS`** (default `0` = tidak dipatuhi, ADR-CRW-0010): set `1` untuk mematuhi `robots.txt`.
- **`CRAWLER_STEALTH`** (default `1` = nyala): tingkat 3 tangga eskalasi memakai Scrapling StealthyFetcher
  (Camoufox) untuk halaman yang diblokir di tingkat bawah. Perlu `pip install "scrapling[fetchers]"` + `scrapling
  install`. `solve_cloudflare` **dimatikan di kode** — stealth menyamarkan sidik jari agar tantangan tidak muncul,
  tetapi crawler tidak menjawab CAPTCHA/tantangan yang sudah aktif (ADR-CRW-0010 butir 4). Set `0` untuk mematikan.

## Pakai

Semua perintah dijalankan dari folder ini dengan `.venv\Scripts\crawler` (atau `crawler` saja bila venv aktif).

| Tujuan | Perintah |
|---|---|
| Lihat sumber, kesehatan, dan tool aslinya | `crawler katalog` |
| Misi langsung | `crawler cari BPJS "Mobile JKN" --sumber rss_media,arctic_shift,bluesky --sejak 90h --batas 50` |
| Keluhan konsumen | `crawler cari --sumber mediakonsumen --opsi mediakonsumen.tag=bpjs-kesehatan` |
| Diskusi + komentar | `crawler cari BPJS --sumber arctic_shift --komentar --opsi arctic_shift.subreddit=indonesia,finansial` |
| Komentar YouTube | `crawler cari "keluhan BPJS" --sumber youtube --komentar --batas 60` |
| Thread Kaskus / halaman web | `crawler cari --sumber kaskus,web --url https://www.kaskus.co.id/thread/... --url https://...` |
| Misi dari preset | `crawler misi jalankan misi/contoh-keluhan-asn.yaml` |
| Daftar misi | `crawler misi daftar` |
| Ringkasan misi | `crawler lihat <misi_id> --peristiwa` |
| Ekspor | `crawler ekspor <misi_id> --format csv,jsonl,md` |
| Matikan/nyalakan sumber | `crawler konfigurasi --matikan bluesky` |

`--sejak` menerima `90h` (hari), `12mg` (minggu), `6b` (bulan), atau `YYYY-MM-DD`. Opsi per sumber:

| Opsi | Arti |
|---|---|
| `rss_media.media=detik,antara` | Pilih media: `detik`, `detik_finance`, `cnnindonesia`, `cnnindonesia_ekonomi`, `antara` (default semua) |
| `rss_media.ambil_isi=true` | Ambil isi lengkap artikel (maks `rss_media.maks_isi`, default 20) |
| `mediakonsumen.tag=bpjs-kesehatan,pinjol` | Tag Media Konsumen (slug). Default: dibentuk dari kata kunci |
| `mediakonsumen.halaman=3` | Halaman feed per tag (10 surat per halaman) |
| `turnbackhoax.tag=mbg` | Tag cek fakta; kosong = feed utama disaring kata kunci |
| `openalex.urut=terbaru` | Urut karya ilmiah terbaru (default: paling relevan); `openalex.bahasa=id` |
| `arxiv.bidang=cat:quant-ph` | Batasi bidang arXiv (mis. `cat:quant-ph`, `ti`=judul, `abs`=abstrak); `arxiv.urut=terbaru` |
| `stackexchange.site=softwarerecs` | Situs Stack Exchange (koma utk banyak, mis. `superuser,webapps`; default `stackoverflow`) |
| `wikipedia.bahasa=en` | Bahasa Wikipedia (default: bahasa misi); `wikipedia.isi_penuh=true` untuk seluruh teks halaman |
| `arctic_shift.subreddit=indonesia,finansial` | Subreddit yang dicari (default `indonesia`) |
| `arctic_shift.maks_utas_komentar=10` | Jumlah utas yang diambil komentarnya |
| `reddit.subreddit=indonesia` | Batasi ke subreddit (gabung dengan `+`, mis. `indonesia+finansial`) |
| `bluesky.lang=en` | Bahasa postingan Bluesky (default: `--bahasa`) |
| `bluesky.kecualikan_penulis=` | Bluesky membuang akun robot berita (`*-poster.bsky.social`) secara default. Kosongkan untuk mematikan, atau isi pola lain. Opsi ini berlaku untuk semua sumber |
| `mediakonsumen.halaman_cadangan=5` | Bila tag tidak ada, jumlah halaman feed utama (surat terbaru) yang dibaca dan disaring kata kunci |
| `youtube.video_per_kata_kunci=5` | Jumlah video per kata kunci (tiap kata kunci memakai 100 unit kuota) |
| `youtube.komentar_per_video=30` | Jumlah komentar per video (bersama `--komentar`) |
| `youtube.urut=terbaru` | Video terbaru dulu (default: paling relevan) |
| `inbox.saring_kata_kunci=false` | Ambil semua isi inbox tanpa saringan kata kunci |

## Perintah lewat chat (MCP)

Claude bertindak sebagai perencana. Ia mengubah perintah bebas Anda menjadi misi (memilih sumber, menyusun kata
kunci, menentukan rentang waktu), menjalankannya, lalu membaca dan menganalisis hasilnya di chat. Crawler sendiri
tetap hanya mengambil dan menyimpan (ADR-CRW-0003).

**Claude Code:** salin `.mcp.json.example` menjadi `.mcp.json`, lalu ganti `<path-ke-folder-ini>` dengan path folder
ini. Buka folder sebagai sesi baru; Claude Code akan meminta persetujuan sekali untuk menyalakan server
`ecosystem-crawler`.

**Claude Desktop (tab Chat):** tambahkan ke `%APPDATA%\Claude\claude_desktop_config.json` (ganti path sesuai mesin
Anda), lalu mulai ulang Claude Desktop:

```json
{
  "mcpServers": {
    "ecosystem-crawler": {
      "command": "<path-ke-folder-ini>\\.venv\\Scripts\\crawler-mcp.exe"
    }
  }
}
```

Contoh perintah di chat:

- "Cari keluhan masyarakat soal BPJS Kesehatan sebulan terakhir, lalu kelompokkan masalahnya."
- "Kumpulkan ulasan bintang 1–2 aplikasi Presensi SIMPEGNAS, apa saja yang paling sering dikeluhkan?"
- "Cari diskusi di r/indonesia tentang mutasi ASN, ambil komentarnya juga."

| Tool MCP | Fungsi |
|---|---|
| `katalog` | Daftar sumber, kegunaannya, dan opsi per sumber |
| `jalankan_misi` | Menjalankan misi. Menunggu hingga 110 detik; bila belum selesai, mengembalikan `misi_id` |
| `status_misi` | Status misi yang masih berjalan atau sudah selesai |
| `daftar_misi` | Misi terbaru |
| `baca_tangkapan` | Membaca hasil per halaman (kursor), dengan penulis berupa pseudonim |
| `ekspor_misi` | Menyimpan hasil ke `hasil/` dalam bentuk CSV/JSONL/MD |

Identitas asli penulis sengaja tidak bisa dibuka lewat chat. Gunakan CLI `--buka-identitas` bila memang perlu.
Misi yang masih berjalan bisa terhenti bila sesi Claude ditutup sebelum misi selesai. Setelah kode crawler
diperbarui, buka sesi chat baru agar server MCP memuat versi terbaru.

## Hasil

| Lokasi | Isi |
|---|---|
| `hasil/<misi_id>/tangkapan.csv` | Untuk Excel |
| `hasil/<misi_id>/tangkapan.jsonl` | Untuk AI atau skrip (mis. `analysis/` milik `scraping masalah`) |
| `hasil/<misi_id>/daftar.md` | Daftar per sumber, beserta komentar di bawah induknya |
| `data/gudang.db` | Gudang SQLite. Satu item yang ditemukan beberapa misi hanya disimpan sekali |
| `data/mentah/` | Payload asli dari setiap sumber, untuk diurai ulang kelak |

Penulis ditampilkan sebagai pseudonim (`p_…`). Penulis yang sama selalu mendapat pseudonim yang sama. Username asli
hanya keluar bila misi dibuat dengan `--buka-identitas`. Folder `data/` dan `hasil/` berisi data orang lain, jadi
jangan dibagikan sembarangan.

## Uji

```bash
.venv\Scripts\python -m pytest
```

## Menambah sumber

Buat `crawler/sumber/<nama>.py` berisi kelas turunan `Sumber` yang membungkus tool aslinya. Method `ambil()`
menghasilkan `Temuan`. Lalu daftarkan di `crawler/sumber/__init__.py`. Tool tidak diubah, hanya dibungkus
(ADR-CRW-0007).
