# Kedaulatan Data — Pulihkan Cadangan ke Postgres Lokal (Item 93 Tahap 2)

Membuktikan berkas dari tombol **"Cadangkan data"** (Research App) bisa dihidupkan kembali **tanpa Supabase**.
Terbukti 2026-09-22 dengan berkas nyata Owner (47,9 MB): 13/13 tabel cocok, kunci asing lolos, pencarian gabungan
sama dengan Supabase — lihat [changelog](../../docs/project-memory/changelog/2026-09-22-uji-pulih-postgres-lokal.md).

## Sekali pasang (Windows, tanpa admin, tanpa Docker)

Installer Postgres resmi Windows (EDB) tidak menyertakan pgvector; pgvector perlu dikompilasi dengan Visual Studio.
Jalan yang dipakai: PostgreSQL 16 + pgvector yang sudah dikompilasi di **conda-forge**, dipasang dengan **micromamba**
(satu berkas .exe dari rilis resmi `mamba-org/micromamba-releases`, cek sha256). Semuanya di satu folder; hapus folder
= bersih (tanpa layanan Windows, PATH, atau registry).

```powershell
$P = 'D:\SLAMET\other\pg-lokal'          # folder bebas
# 1. micromamba-win-64.exe (+ .sha256) dari https://github.com/mamba-org/micromamba-releases/releases → $P\micromamba.exe
# 2. Postgres + pgvector
$env:MAMBA_ROOT_PREFIX = "$P\mamba"
& "$P\micromamba.exe" create -y -p "$P\env" -c conda-forge --override-channels 'postgresql=16' 'pgvector'
# 3. Klaster (kata sandi acak di $P\sandi.txt — jangan dibagikan)
python -c "import secrets;open(r'$P\sandi.txt','w').write(secrets.token_urlsafe(24))"
& "$P\env\Library\bin\initdb.exe" -D "$P\data" -U mamet --pwfile="$P\sandi.txt" -A scram-sha-256 -E UTF8 --locale=C
```

## Setiap kali uji pulih

```powershell
& "$P\env\Library\bin\pg_ctl.exe" -D "$P\data" -l "$P\pg.log" -o "-p 55432 -c listen_addresses=127.0.0.1" -w start
node scripts/kedaulatan/pulih-cadangan.mjs --berkas "<berkas cadangan>.json" --pg-bin "$P\env\Library\bin" --sandi-file "$P\sandi.txt"
& "$P\env\Library\bin\pg_ctl.exe" -D "$P\data" stop -m fast    # matikan lagi (hemat RAM)
```

`pulih-cadangan.mjs` **membuat ulang** database `mamet_pulih` (hanya di Postgres lokal yang disebut), memuat
`skema-pulih.sql` (disalin dari Supabase: 13 tabel + `match_documents_hybrid`), memasukkan data, menambah kunci asing,
lalu mencocokkan jumlah baris. Keluar dengan kode 0 hanya bila **PULIH LENGKAP**.

## Catatan

- Database lokal berisi salinan data pribadi (nama & NIP ASN) — hanya mendengarkan `127.0.0.1`, berkata sandi.
- Tanpa skema `auth` Supabase: satu pengguna, tanpa RLS. Menjalankan Mamet di atasnya = Item 93 Tahap 4 (jauh).
- Skor pencarian bisa berbeda di desimal ke-7 antara Supabase (ARM) dan laptop (x86) → urutan dua potongan yang
  hampir seri bisa bertukar di tepi daftar. Bukan perbedaan data.
