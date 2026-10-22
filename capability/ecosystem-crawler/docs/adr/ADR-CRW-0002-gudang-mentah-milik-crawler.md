# ADR-CRW-0002: Gudang Data Mentah Milik Crawler, Ditarik oleh Mamet

Status: Accepted (disetujui Owner 2026-10-21)
Tanggal: 2026-10-21
Diperbarui oleh: ADR-CRW-0010 (pseudonim penulis dikecualikan untuk sumber rujukan yang penulisnya byline publik —
openalex, turnbackhoax, rss_media, google_news — lewat penanda `Sumber.pseudonim_penulis=False`; sumber sosial tetap
dipseudonimkan)

## Context

Crawler akan menghasilkan banyak data mentah: ribuan komentar per misi, ulasan, postingan, dan artikel. Sebagian
besarnya noise dan belum tentu dipakai Mamet.

Mamet menyimpan pengetahuan di Supabase (Postgres + pgvector, tabel `documents` dan `document_chunks` dengan vektor 768).
Embedding dibuat lewat OpenRouter dengan kunci milik Owner. Konstitusi Mamet menetapkan:

- Capability tidak boleh terhubung langsung, dan seluruh komunikasi lewat MAEF (`03_CAPABILITY_PORT.md`,
  Connection Policy).
- Knowledge tidak boleh bercampur dengan noise, dan disimpan berlapis: Raw, Processed, Verified, Active
  (`05_KNOWLEDGE_SYSTEM.md`).

Proyek `scraping masalah` sebelumnya memakai satu file JSON sebagai memori dan dedup berdasarkan URL. Cara ini tidak
bisa di-query dan akan melambat ketika data membesar.

## Decision

1. **Crawler memiliki gudang mentahnya sendiri, di lokal:**

   ```
   data/
     gudang.db                      # SQLite: misi, pantauan, tangkapan
     mentah/<sumber>/<YYYY-MM-DD>/<id_tangkapan>.<json|html>   # payload asli apa adanya
     markdown/<sumber>/<YYYY-MM-DD>/<id_tangkapan>.md          # opsional, untuk artikel panjang
   ```

2. **Format Tangkapan** (pengganti `Keluhan` yang bisa memuat topik apa saja):

   | Field | Isi |
   |---|---|
   | `id` | ID internal (ULID) |
   | `misi_id`, `trace_id` | Asal misi/pantauan dan jejak dari MAEF |
   | `sumber`, `kanal`, `jenis_akses` | Mis. `reddit` / `laptop` / `api_resmi` |
   | `jenis` | `artikel`, `postingan`, `komentar`, `ulasan`, `dokumen` |
   | `id_asli`, `url`, `url_induk`, `parent_id` | Identitas di platform asal dan hubungan utas komentar |
   | `judul`, `teks`, `bahasa` | Isi yang sudah dinormalkan (teks bersih, tanpa tag HTML) |
   | `penulis_hash` | Pseudonim penulis (lihat butir 4) |
   | `waktu_terbit`, `waktu_ambil` | ISO-8601 UTC |
   | `metrik` | JSON: suka, balasan, rating, dll. Tidak semua sumber punya |
   | `kata_kunci_cocok` | Kata kunci misi yang muncul di teks (pencocokan string, bukan makna) |
   | `confidence` | Keandalan pengambilan (ADR-CRW-0001 butir 7) |
   | `hash_isi` | SHA-256 teks, untuk mendeteksi isi yang berubah |
   | `path_mentah` | Lokasi payload asli di `data/mentah/` |
   | `status_knowledge` | Selalu `hypothesis`. Crawler tidak pernah mengubahnya |

3. **Dedup** memakai kunci `(sumber, id_asli)`, atau `(sumber, url kanonis)` bila `id_asli` tidak ada. Jika item yang
   sama diambil ulang dengan `hash_isi` berbeda, versi baru disimpan sebagai revisi, dan versi lama tidak ditimpa.

4. **Pseudonim penulis secara default.** `penulis_hash = HMAC-SHA256(garam_lokal, sumber + ":" + username)`. Garam
   disimpan di `.env` dan tidak pernah keluar dari mesin. Hasilnya, penulis yang sama tetap bisa dikenali sebagai satu
   orang untuk analisis pola, tanpa membawa identitasnya. Payload asli di `data/mentah/` tetap utuh (dibutuhkan untuk
   parsing ulang), tetapi **tidak pernah diberikan lewat API**. Membuka username asli memerlukan pengaturan eksplisit
   Owner per misi.

5. **Mamet menarik data, crawler tidak mendorong.** Crawler menyediakan pembacaan berbasis kursor (lihat ADR-CRW-0005).
   Adapter Mamet yang memutuskan item mana yang dimasukkan ke Knowledge System, dengan status Hypothesis, melalui
   pipeline Mamet sendiri (mis. `rag-process`). Crawler tidak menyimpan catatan konsumen. Kursor dipegang oleh Mamet.

6. **Tidak ada penghapusan otomatis.** Data mentah hanya dihapus atas perintah Owner (per sumber, per misi, atau per
   rentang tanggal), dan setiap penghapusan dicatat di log.

## Alternatives

- **Crawler menulis langsung ke Supabase Mamet.** Ditolak. Ini melanggar Connection Policy, membuat crawler memegang
  kredensial database Mamet, menghabiskan kuota penyimpanan dan biaya embedding untuk noise, dan mencampur data mentah
  dengan knowledge.
- **Tabel mentah terpisah di Supabase.** Ditunda. Kopling dan biayanya tetap ada. Bisa dipertimbangkan bila crawler
  kelak berjalan di server.
- **Hanya file JSON seperti `scraping masalah`.** Ditolak. Tidak bisa di-query, lambat untuk data besar, dan rawan
  rusak ketika ditulis bersamaan.

## Consequences

- Mamet hanya menanggung biaya penyimpanan dan embedding untuk data yang benar-benar dipilih.
- Data bisa dianalisis ulang dengan sudut pandang baru tanpa crawling ulang.
- Gudang berada di satu laptop, sehingga perlu cadangan (salin `data/` secara berkala). Disk akan terus bertambah
  karena tidak ada penghapusan otomatis, jadi crawler wajib melaporkan ukuran gudang di `ReportStatus()`.
- Data mentah berisi username asli, sehingga folder `data/` harus diperlakukan sebagai data sensitif dan masuk
  `.gitignore`.

## Impact Scope

Lapisan penyimpanan crawler, API pembacaan crawler, dan adapter Mamet yang menarik data.

## Related Components

Knowledge System (Raw Data Layer, lifecycle Hypothesis), Storage Port, Database Port, Capability Adapter.
