# ADR-CRW-0005: Crawler sebagai Layanan Python Lokal dengan Tiga Wajah (CLI, HTTP, MCP)

Status: Accepted (disetujui Owner 2026-10-21; implementasi belum dimulai)
Tanggal: 2026-10-21
Diperjelas oleh: ADR-CRW-0006 (urutan wajah: CLI, MCP, lalu HTTP; perintah ekspor)
Diperbarui oleh: ADR-CRW-0008 (butir 3 tentang penjadwal pantauan tidak berlaku)

## Context

Semua library pengambil data yang dipilih (Scrapling, curl_cffi, Playwright, Crawl4AI, PRAW, google-play-scraper)
adalah library Python. `scraping masalah` juga sudah ditulis dalam Python 3.12.

Mamet berjalan sebagai aplikasi desktop Electron + React/Vite, dengan server AI berupa Supabase Edge Function (Deno) di
cloud. `frontend/electron/main.cjs` dan `preload.cjs` berstatus CORE IMMUTABLE.

Owner juga ingin bisa memberi perintah lewat chat. Sebelum adapter Mamet ada, chat itu bisa dilakukan lewat Claude
Code.

## Decision

1. **Crawler ditulis sebagai paket Python** (target Python 3.12) dengan satu inti dan tiga wajah tipis yang memanggil
   inti yang sama:

   | Wajah | Untuk | Catatan |
   |---|---|---|
   | **CLI** | Owner, Windows Task Scheduler, uji manual | `crawler misi jalankan misi.json`, `crawler status` |
   | **HTTP API lokal** | Adapter Mamet | Hanya `127.0.0.1`, dengan token lokal di header |
   | **MCP server (stdio)** | Claude Code / Claude Desktop sebagai perencana sementara | Tool: `katalog`, `jalankan_misi`, `status_misi`, `baca_tangkapan` |

2. **Endpoint HTTP awal:**

   | Metode | Path | Fungsi kontrak |
   |---|---|---|
   | `GET` | `/health` | `HealthCheck()` |
   | `GET` | `/status` | `ReportStatus()`: versi, katalog sumber, ukuran gudang, pantauan aktif |
   | `POST` | `/execute` | `Execute()`: menerima format Misi/Pantauan (ADR-CRW-0003) |
   | `GET` | `/misi/{misi_id}` | status misi |
   | `GET` | `/tangkapan?misi_id=&kursor=&batas=` | pembacaan berbasis kursor (ADR-CRW-0002) |
   | `POST` | `/configure` | `Configure()`: sumber aktif, batas laju |
   | `DELETE` | `/pantauan/{id}` | menghentikan pantauan |

3. **Jadwal pantauan dijalankan oleh crawler sendiri** (penjadwal internal selama layanan hidup), dengan cadangan
   Windows Task Scheduler lewat CLI. Edge Function `cron-agent` di Supabase berjalan di cloud dan tidak dapat
   menjangkau `localhost`, sehingga tidak dipakai untuk memicu crawler.

4. **Rahasia** (token API, garam pseudonim, token HTTP lokal) disimpan di `.env`, dan tidak pernah dikembalikan oleh
   API atau MCP mana pun.

5. **Susunan folder awal:**

   ```
   ecosystem crawler/
     crawler/
       inti/          # kontrak capability, format Misi & Tangkapan, Dispatcher
       kanal/         # fetcher: http (curl_cffi), browser, stealth; tangga eskalasi; deteksi blokir
       sumber/        # satu adapter per sumber (pindahan dari scraping masalah + baru)
       gudang/        # SQLite + file mentah, dedup, pseudonim
       wajah/         # cli.py, http_api.py, mcp_server.py
     data/            # gudang (di .gitignore)
     docs/adr/
     tests/
   ```

6. **Adapter di sisi Mamet tidak termasuk ADR ini.** Pembuatan Search/Research Adapter di repo Mamet harus diputuskan
   lewat ADR tersendiri di `mamet os ecosystem/docs/adr/`, sesuai aturan bahwa penambahan capability wajib memiliki ADR.

## Alternatives

- **Crawler ditulis dalam Node/TypeScript agar satu bahasa dengan Mamet.** Ditolak, karena ekosistem library yang
  dipilih berbasis Python.
- **Crawler sebagai Supabase Edge Function.** Ditolak. Deno tidak bisa menjalankan Playwright atau browser, ada batas
  waktu eksekusi, dan library Python tidak tersedia.
- **Docker sejak awal.** Ditunda. Docker menambah lapisan di Windows, sementara tahap awal cukup memakai virtualenv.
  Bisa ditinjau saat crawler dipindah ke server.
- **Hanya CLI.** Ditolak, karena Mamet dan Claude butuh antarmuka yang bisa dipanggil program.

## Consequences

- Crawler dapat dipakai segera lewat CLI dan Claude Code (MCP), sebelum integrasi Mamet selesai.
- Crawler hanya hidup selama laptop menyala. Pantauan berhenti saat laptop mati, dan dilanjutkan saat layanan hidup
  kembali.
- **Risiko terbuka:** jalur panggilan dari Mamet ke `http://127.0.0.1` perlu diperiksa terhadap CSP Electron dan
  aturan CORE IMMUTABLE (`main.cjs` dan `preload.cjs` tidak boleh di-patch). Bila renderer tidak bisa memanggil
  `localhost`, jalur alternatifnya ditentukan di ADR Mamet.
- Playwright memerlukan unduhan browser (sekali pasang), yang dijalankan oleh Owner.

## Impact Scope

Seluruh struktur proyek `ecosystem crawler` dan titik integrasi dengan Mamet serta Claude Code.

## Related Components

Capability Adapter (Tool/Runtime Adapter), Search Port, Research Port, Workflow Port, Configuration Port,
Deployment Architecture.
