# Cadangan Data Lengkap dari Aplikasi (Item 93 Tahap 1)

**Tanggal:** 22 September 2026
**Roadmap:** Item 93 ([`ROADMAP-KEDAULATAN-DATA.md`](../../roadmap/ROADMAP-KEDAULATAN-DATA.md))
**Status:** ✅ selesai — berkas cadangan nyata Owner diperiksa terpisah: 13/13 tabel cocok dengan database.

## Kenapa cadangan lama dibuang

Edge function `backup-export` / `backup-restore` (tak pernah dipanggil aplikasi, tak pernah diuji sampai pulih):
- **tidak memuat teks RAG** — `document_chunks` dilewati dengan alasan "bisa di-regenerate dari dokumen induk", padahal
  `documents` hanya judul & metadata; teks (termasuk hasil OCR berbayar Kepbup) hanya ada di potongan;
- tidak memuat data ASN (`asn_berkas`/`asn_pegawai`);
- **memotong diam-diam di 1.000 baris** (batas PostgREST; `agent_logs` 15.009, `asn_pegawai` 1.313);
- tabel tanpa `created_at`/`user_id` selalu gagal → kosong;
- ikut mencadangkan `agent_logs` (pernah berisi kunci API, T7).

Keduanya **dihapus dari repo** (keputusan Owner); penghapusan versi yang ter-deploy dilakukan Owner.

## Yang dibuat

- `frontend/src/core/runtime/services/cadanganData.js` (baru): 13 tabel (`knowledge_spaces`, `documents`,
  `document_chunks` + vektor 768-D, `workspace_summaries`, `asn_berkas`, `asn_pegawai`, `chats`, `user_memories`,
  `api_usage`, 4 tabel catatan engineering) diambil **dengan sesi pengguna** (RLS membatasi ke milik sendiri — tanpa
  kunci server), per halaman berurutan `id` (potongan 300/halaman, chat 200), lalu dicocokkan dengan hitungan
  database (count exact, RLS sama). Satu tabel gagal → dilempar, tidak ada berkas setengah jadi; baris baru di tengah
  proses → terlihat "tidak cocok". Log (`agent_logs`, audit) & pemantauan tidak ikut. `periksaBerkasCadangan` memeriksa
  berkas yang dibaca ulang.
- Research App: tombol **"Cadangkan data"** — peringatan data pribadi, status per tabel, isi berkas dibaca ulang &
  diperiksa sebelum diunduh, ringkasan ✓/✗ per tabel; jendela Simpan Electron.

## Bukti

- Uji `uji-cadangan-data.mjs` (di luar git, Supabase tiruan): **14/14** — 3.604 potongan tidak terpotong, urutan id,
  baris baru di tengah terdeteksi (814 vs 815), galat tabel dilempar dengan namanya, isi berkurang terdeteksi.
- RLS akun Owner (SET ROLE, transaksi dibatalkan): 13 tabel terbaca.
- **Berkas nyata Owner** (`mamet-cadangan-2026-09-22-01-35.json`, 47,9 MB), diperiksa skrip terpisah
  `periksa-berkas-cadangan.mjs`: 13/13 tabel cocok (222 dokumen, 3.455 potongan, 1.313 pegawai, 130 chat, 12 memori,
  814 pemakaian API); **3.455/3.455 vektor 768 angka**; 0 potongan tanpa teks (2,7 juta huruf); 221 dokumen Kepbup,
  0 tanpa potongan; hanya satu `user_id`; 0 tabel log.

## Catatan

- Berkas berisi nama & NIP ASN → diperlakukan rahasia; saran 3-2-1 (salinan kedua di media lain, bukan awan umum).
- Pemulihan (menulis balik) belum ada — Tahap 2 menguji pulih ke Postgres lokal, bukan ke Supabase.
- Kekeliruan heredoc/Python kembali terjadi saat menyisipkan handler (`\n` jadi baris baru); diperbaiki dengan berkas
  yang ditulis alat Write lalu disambung — sesuai memori "Heredoc Merusak Backslash".
