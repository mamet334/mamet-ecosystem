# RLS — Aturan "Baca Semua" & "Tulis Publik" Ditutup (temuan Item 93)

**Tanggal:** 22 September 2026
**Roadmap:** Item 93 ([`ROADMAP-KEDAULATAN-DATA.md`](../../roadmap/ROADMAP-KEDAULATAN-DATA.md))
**Status:** ✅ selesai — migrasi `20260922003711_rls_tutup_baca_semua` diterapkan (izin Owner), terbukti di database &
aplikasi.

## Temuan

Ditemukan saat memeriksa RLS untuk rancangan cadangan. Aturan `USING (true)` = semua baris boleh dibaca; kunci *anon*
memang publik (tertanam di aplikasi web & Mametlite), jadi yang menjaga data hanya RLS.

| Tabel | Terbuka untuk | Isi |
|---|---|---|
| `user_memories` | **siapa pun tanpa login** | memori pribadi |
| `api_usage` | **siapa pun tanpa login** — baca **dan tulis** | pemakaian & biaya 3 akun; tulis publik = biaya palsu atas nama siapa pun → kuota harian orang itu habis |
| `monitors` | **siapa pun tanpa login** — baca, tambah, ubah, hapus | URL yang di-ping `health-check` dengan kunci service role |
| `checks`, `incidents`, `service_heartbeat` | siapa pun tanpa login | pemantauan (bukan data pribadi) |
| `project_memory_entries`, `engineering_tasks`, `architecture_gaps`, `verification_runs`, `knowledge_conflicts`, `knowledge_relationships` | semua pengguna login (termasuk eksternal Mametlite) | catatan engineering |

Akun di proyek: `3841e124…` (Owner, utama), `23a39918…` (Owner, akun kedua — pemilik 50 baris catatan engineering),
`52e37376…` (penguji tepercaya Owner). Sebelum ditutup, akun-akun ini saling bisa membaca memori & catatan engineering.
Tidak ada tanda penyalahgunaan (2 monitor yang ada milik Owner, nonaktif).

## Perubahan (migrasi)

- `user_memories`: hapus "Allow all read" (aturan baca milik sendiri sudah ada).
- `api_usage`: hapus baca & tulis publik; tambah "baca milik sendiri" (authenticated). Tulis hanya server.
- 4 tabel catatan engineering & 2 tabel relasi pengetahuan: hapus "authenticated baca semua".
- `checks`, `incidents`, `monitors`: baca hanya pengguna login; semua tulis publik `monitors` dihapus;
  `service_heartbeat`: hapus baca publik (baca login tetap).

Penulis sah semuanya service role (melewati RLS): `runtime_context.ts`, `health-check`, `heartbeat.ts`,
`verification_service.ts`, `knowledge-health`. Pembaca aplikasi sudah menyaring milik sendiri.

## Bukti (SET ROLE di transaksi yang di-ROLLBACK)

| Pembaca | Sebelum | Sesudah |
|---|---|---|
| anon: memori / api_usage / monitors / incidents / heartbeat / checks | 12 / 825 / 2 / 1 / 1 / 0 | **0 semua** |
| pengguna login lain: memori / api_usage / catatan proyek / tugas / gaps / runs | 12 / 825 / 15 / 15 / 6 / 14 | **0 semua** (monitors 2 — boleh) |
| akun Owner: memori / api_usage / dokumen / heartbeat | — | 12 / 813 / 222 / 1 (utuh) |
| pembanding yang sudah benar sejak awal: `documents`, `asn_pegawai` untuk pengguna lain | 0 | 0 |

Aplikasi (Owner): Memory App, Billing, dasbor tampil normal; tiga widget engineering kosong di akun utama (datanya
milik akun kedua — perilaku benar). Chat sesudah migrasi (00:50 UTC): `LogAPIUsage` berhasil, baris `api_usage` baru
tercatat → pencatatan server tidak terganggu.

Catatan uji: percobaan pertama "akun Owner = 0" adalah cacat uji (ID diambil lewat subkueri yang ikut tersaring RLS),
diulang dengan ID tertulis langsung.

## Sisa

- 50 baris catatan engineering akun kedua Owner: biarkan atau pindahkan `user_id` ke akun utama — keputusan Owner.
- Gagasan (tidak dikerjakan): pertanyaan "apakah sistem sehat?" dijawab dari data nyata (heartbeat/health-check);
  sekarang model mengarang tabel status dan label turun ke HYPOTHESIS (pemeriksa label bekerja).
