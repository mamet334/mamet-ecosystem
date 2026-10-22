# ADR-CRW-0001: Crawler sebagai Capability Indra dan Tangan Mamet

Status: Accepted (disetujui Owner 2026-10-21; implementasi belum dimulai)
Tanggal: 2026-10-21
Diperbarui oleh: ADR-CRW-0008 (mode pantauan tidak dibangun; hanya mode misi)

## Context

Owner ingin menggabungkan beberapa alat pengumpul data (Scrapling, Scrapy, Playwright, curl_cffi, Crawl4AI/Firecrawl,
serta pendekatan medsos: sesi akun, intercept API/GraphQL, Apify) menjadi satu ekosistem yang terorganisir. Topik
pencariannya berganti sesuai perintah: ilmu pengetahuan (mis. fisika), keluhan masyarakat, masalah ASN yang dipost
publik, riset produk, dan lainnya.

Owner sudah memiliki Mamet Ecosystem sebagai otak (penalaran, pengetahuan, memori, verifikasi). Analogi Owner: crawler
adalah **orang dengan laptop, HP, dan TV**. Ia hanya melihat, mendengar, mengambil, dan mencatat, tanpa menyimpulkan.

Konstitusi Mamet menetapkan bahwa:

- MAEF hanya mengenal Capability Port, bukan implementasi (`03_CAPABILITY_PORT.md`).
- Capability terhubung lewat Adapter dengan kontrak dan format masuk/keluar yang seragam
  (`12_CAPABILITY_ADAPTER_SPEC.md`).
- Data luar masuk sebagai Hypothesis di Raw Data Layer, dan kebenaran baru muncul setelah verifikasi
  (`05_KNOWLEDGE_SYSTEM.md`).
- MAEF Orchestrator yang memahami intent, memecah tugas, dan memilih capability (`14_MAEF_ORCHESTRATOR_SPEC.md`).

Sebelumnya sudah ada proyek `D:\SLAMET\other\scraping masalah` yang mencampur dua peran: `sources/` (mengambil data)
dan `analysis/` (klasifikasi niat, frustrasi, willingness to pay, papan ide).

## Decision

1. **Ecosystem Crawler adalah satu Capability** yang mengisi **Search Port** dan **bagian pengumpulan dari Research
   Port**. Sintesis dan laporan riset tetap menjadi tugas MAEF bersama Reasoning Port.

2. **Peran crawler dibatasi pada mencari, mengambil, menormalkan, dan menyimpan.** Crawler TIDAK melakukan:
   - klasifikasi, sentimen, peringkasan, atau penilaian relevansi berbasis makna;
   - penentuan kebenaran, atau promosi data menjadi knowledge;
   - penulisan langsung ke tabel Knowledge/Memory Mamet;
   - pemanggilan model LLM.

3. **Tiga kanal, sesuai analogi Owner.** Setiap adapter sumber termasuk salah satu kanal:

   | Kanal | Arti | Contoh sumber |
   |---|---|---|
   | `tv` | Siaran pasif yang tinggal diikuti | RSS berita, Google News, halaman trending, arXiv listing |
   | `laptop` | Mencari dan menjelajah web | API resmi (Reddit, YouTube, Stack Exchange, OpenAlex), HTTP, browser, Crawl4AI |
   | `hp` | Platform medsos/aplikasi | Bluesky, Play Store, Apify actor, folder `inbox/` (salinan manual) |

4. **Dua mode kerja:**
   - **Misi (tangan):** sekali jalan atas perintah, misalnya "ambil 500 komentar soal tunjangan ASN".
   - **Pantauan (telinga):** berjalan terjadwal, misalnya "dengarkan topik X setiap 2 jam".

5. **Tangga eskalasi pengambilan** di kanal `laptop`. Selalu coba cara termurah dulu, dan naik satu tingkat hanya bila
   terdeteksi blokir (HTTP 403/429, halaman challenge, konten kosong karena butuh JavaScript):

   ```
   API resmi / feed  →  HTTP + TLS fingerprint (curl_cffi via Scrapling Fetcher)
     →  browser headless (Playwright via Scrapling DynamicFetcher) + intercept JSON
     →  browser stealth (Scrapling StealthyFetcher), hanya untuk halaman publik
   ```

   Ekstraksi dari HTML memakai selector adaptif Scrapling. Konversi ke Markdown (Crawl4AI) dipakai hanya untuk sumber
   berupa artikel/dokumen panjang, dan hasilnya disimpan berdampingan dengan data mentah, bukan sebagai pengganti.

6. **Memenuhi kontrak Capability dan Adapter Mamet:**
   - Capability Contract: Name, Version, Capability Type, Description, Health Status, Permission, Configuration,
     Supported Features, Lifecycle.
   - Fungsi: `Initialize()`, `Shutdown()`, `HealthCheck()`, `Execute(input)`, `Normalize(output)`, `Configure()`,
     `ReportStatus()`.
   - Input: `{ "type", "context", "payload", "trace_id" }`. Output: `{ "result", "confidence", "source", "trace_id" }`.
   - Event observabilitas: `Adapter.Request`, `Adapter.Response`, `Adapter.Error`, `Adapter.FallbackTriggered`.
     Naik tingkat di tangga eskalasi dilaporkan sebagai `Adapter.FallbackTriggered`.

7. **Arti `confidence` di crawler adalah keandalan pengambilan**, bukan kebenaran isi. Nilai awal per jenis akses
   (dapat diatur Owner dan dikalibrasi kemudian):

   | Jenis akses | Nilai awal |
   |---|---|
   | API resmi | 0,90 |
   | Feed RSS/Atom | 0,85 |
   | Intercept JSON dari browser | 0,80 |
   | Apify actor | 0,75 |
   | HTTP/browser + parser HTML | 0,70 |
   | Salinan manual `inbox/` | 0,50 |

8. **Aset `scraping masalah` dipakai ulang secara terpisah per peran.** `sources/` dipindahkan menjadi adapter sumber
   crawler, dengan `Keluhan` digeneralisasi menjadi format Tangkapan (lihat ADR-CRW-0002). `analysis/` tidak dipindahkan
   ke crawler. Ia tetap menjadi konsumen data, atau kelak dipindahkan ke sisi Mamet.

## Alternatives

- **Crawler pintar (mengumpulkan sekaligus menganalisis).** Ditolak. Penalaran akan terduplikasi dengan Reasoning Port,
  mengunci crawler ke vendor LLM tertentu, dan melanggar pemisahan otak dan otot di `14_MAEF_ORCHESTRATOR_SPEC.md`.
- **Satu alat saja (mis. hanya Scrapling).** Ditolak sebagai keputusan arsitektur. Scrapling dipakai sebagai mesin
  utama kanal `laptop`, tetapi banyak sumber lebih baik lewat API resmi, dan sebagian hanya lewat Apify/inbox.
- **Scrapy sebagai mesin utama sejak awal.** Ditunda. Volume tahap awal (puluhan sampai ribuan item per misi) cukup
  ditangani antrian asyncio. Scrapy dapat ditambahkan nanti di belakang antarmuka fetcher yang sama.

## Consequences

- Crawler dapat diganti atau ditingkatkan tanpa mengubah MAEF, Knowledge System, atau Memory System (hot swap).
- Semua nilai tambah analitis (pola keluhan, peluang produk, tren) dihasilkan di Mamet. Crawler sendiri tidak
  menghasilkan insight.
- `scraping masalah` perlu dipecah. Selama masa transisi, kedua proyek bisa berjalan berdampingan.
- Setiap sumber baru cukup berupa satu adapter sumber yang mendeklarasikan kanal, kemampuan, dan batas lajunya.

## Impact Scope

Proyek `ecosystem crawler` (baru), `scraping masalah` (dipecah), dan sisi Mamet yang akan menambahkan Search/Research
Adapter untuk crawler (melalui ADR di repo Mamet).

## Related Components

Capability Port (Search, Research), Capability Adapter, Knowledge System (Raw Data Layer), MAEF Orchestrator,
Event System.

## Referensi

- `mamet os ecosystem/constitution/03_CAPABILITY_PORT.md`
- `mamet os ecosystem/constitution/05_KNOWLEDGE_SYSTEM.md`
- `mamet os ecosystem/constitution/12_CAPABILITY_ADAPTER_SPEC.md`
- `mamet os ecosystem/constitution/14_MAEF_ORCHESTRATOR_SPEC.md`
- ADR-CRW-0002 … ADR-CRW-0005
