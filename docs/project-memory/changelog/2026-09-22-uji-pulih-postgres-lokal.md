# Uji Pulih Cadangan ke Postgres Lokal (Item 93 Tahap 2)

**Tanggal:** 22 September 2026
**Roadmap:** Item 93 ([`ROADMAP-KEDAULATAN-DATA.md`](../../roadmap/ROADMAP-KEDAULATAN-DATA.md))
**Status:** ✅ selesai — berkas cadangan nyata Owner hidup kembali di Postgres lokal tanpa Supabase.

## Pemasangan (izin unduh Owner)

- Pilihan Owner: instalasi biasa (bukan Docker). Kenyataan: installer Postgres resmi Windows (EDB) **tidak menyertakan
  pgvector**; pgvector perlu dikompilasi dengan Visual Studio Build Tools (beberapa GB). Dipakai jalan native yang
  ringan: **PostgreSQL 16.15 + pgvector 0.8.6 dari conda-forge**, dipasang **micromamba 2.9.0** (10,9 MB, rilis resmi
  `mamba-org/micromamba-releases`, **sha256 cocok**).
- Satu folder `D:\SLAMET\other\pg-lokal` (tanpa admin, layanan Windows, PATH, registry): program 314 MB, cache 62 MB.
  Klaster hanya `127.0.0.1:55432`, `scram-sha-256`, kata sandi acak di berkas lokal (tak pernah dicetak).
- Supabase: PostgreSQL 17.6 (aarch64) + pgvector 0.8.0 — beda versi tak berpengaruh karena data dimuat lewat SQL.

## Alat (di repo, `scripts/kedaulatan/`)

- `skema-pulih.sql` — 13 tabel + `match_documents_hybrid`, **disalin dari Supabase** (pg_attribute,
  pg_get_functiondef), bukan ditulis ulang. `fts` = kolom GENERATED (dibangun ulang dari teks); `asn_pegawai.id` identity
  → angka biasa supaya id asli pulih.
- `pulih-cadangan.mjs` — membuat ulang database lokal `mamet_pulih`, JSON per baris → `\copy` → `jsonb_populate_record`
  (kolom generated dilewati), menambah kunci asing sesudah dimuat, mencocokkan jumlah baris.
- `README.md` — langkah pasang & uji.

## Bukti (berkas `mamet-cadangan-2026-09-22-01-35.json`, 47,9 MB)

| Kriteria | Hasil |
|---|---|
| Jumlah baris 13 tabel | **13/13 cocok**, 17 detik |
| Keutuhan | kunci asing documents→spaces, chunks→documents, pegawai→berkas, berkas→berkas lolos |
| Indeks kata (fts) | dibangun ulang untuk 3.455/3.455 potongan |
| Pencarian gabungan vs Supabase (vektor potongan nyata sebagai kueri, $0) | A 8/8 identik · C 8/8 identik · B 7/8 |
| Data Tabel | RSUD struktural **14**; pegawai berkas aktif **634** (sama dengan chat) |

**Selisih B posisi ke-8 (ditelusuri):** potongan `73a49f0b` & `205b2682` berkemiripan 0,84629354 vs 0,84629363 —
beda di desimal ke-7; pembulatan float berbeda antara ARM (Supabase) dan x86 (laptop) menukar peringkat vektor 93/94,
sehingga skor RRF posisi ke-8 bergeser (0,022665 vs 0,022642). Data identik.

## Sesudah uji

- Postgres lokal dimatikan (hemat RAM); folder `data` (103 MB, salinan data pribadi) **dihapus** atas izin Owner.
  Program tetap; uji ulang = `initdb` + `pulih-cadangan.mjs` (README).
