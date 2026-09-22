# ROADMAP: KEDAULATAN DATA — Salinan Sendiri yang Terbukti Bisa Dipulihkan, lalu Postgres Lokal (Item 93)

**Status:** 📋 terdaftar 2026-09-22 — temuan RLS ✅ ditutup (22 Sep); Tahap 1 cadangan berikutnya
**Tanggal:** 2026-09-22
**Roadmap Index:** Item 93

---

## 1. Masalah & Tujuan

Owner ingin Mamet **tidak bergantung pada Supabase** demi kedaulatan data. Diskusi 2026-09-21/22 memisahkan dua hal:

- **Kedaulatan data tersimpan** — dokumen, vektor, data ASN, chat ada dalam kendali Owner dan bisa dibaca tanpa
  Supabase. **Bisa dicapai bertahap mulai sekarang.**
- **Kedaulatan data yang diproses** — setiap pertanyaan mengirim potongan RAG / nama pegawai ke penyedia model lewat
  OpenRouter. Database lokal **tidak** mengubah ini selama model penjawab di awan. Pagar yang sudah ada: NIP tidak
  pernah dikirim ke model (Item 92 Tahap 3).

Tujuan jangka dekat: **Supabase hilang besok pun, data utuh dan bisa dibaca.** Offline penuh = jangka sangat panjang.

## 2. Fakta (diukur 2026-09-21/22)

| | |
|---|---|
| Laptop Owner | RAM 11,7 GB, i7-1065G7 4 inti/8 thread, tanpa GPU khusus, disk D bebas 515 GB |
| Database Supabase | **52 MB** — 238 dokumen, 3.604 potongan (22 MB) |
| Prototipe `D:\SLAMET\other\gabut\engine` | Go + WAL + layanan embedding Python 768-D — proyek belajar; cacat daya tahan data (kompaksi menghapus log dulu, tulis tanpa kunci), server terbuka di semua jaringan tanpa login, mode cadangan hashing menyimpan vektor palsu. **Bukan** calon basis data produksi |

**Temuan penting pada cadangan yang sudah ada (`supabase/functions/backup-export`):**
1. `document_chunks` **tidak ikut dicadangkan** dengan alasan "embedding bisa di-regenerate dari dokumen induk" —
   **salah**: tabel `documents` hanya berisi judul & metadata (`id, user_id, title, created_at, space_id, source_url,
   source_type, retrieved_at`); **teksnya hanya ada di `document_chunks`**. Cadangan sekarang = seluruh isi RAG hilang
   (termasuk hasil OCR berbayar buku Kepbup).
2. `asn_berkas` / `asn_pegawai` (Item 92) **tidak ada** di daftar tabel cadangan.
3. Tidak ada pemanggil di frontend (tak ada tombol) dan tidak tercatat pernah diuji **sampai pemulihan**.
4. (diperiksa 2026-09-22) PostgREST memotong **diam-diam di 1.000 baris** (`agent_logs` 15.009, `asn_pegawai` 1.313);
   tabel tanpa `created_at`/`user_id` selalu gagal → kosong; ikut mencadangkan `agent_logs` (pernah berisi kunci API, T7).
   Arah Tahap 1: cadangan dibuat **dari aplikasi desktop dengan sesi Owner** (RLS membatasi ke milik sendiri, tanpa
   kunci server), per halaman, jumlah baris dicocokkan dengan hitungan database; `agent_logs` dikecualikan.

**Temuan keamanan saat memeriksa RLS (2026-09-22) — ✅ ditutup:** aturan `USING (true)` membuka `user_memories` &
`api_usage` (baca **dan tulis**) & `monitors` (tulis) untuk siapa pun tanpa login, dan catatan engineering untuk semua
pengguna login. Migrasi `20260922003711_rls_tutup_baca_semua` —
[log](../project-memory/changelog/2026-09-22-rls-tutup-baca-semua.md).

## 3. Peta Lapisan (keputusan arah — dari diskusi)

| Lapisan | Offline di laptop ini? | Catatan |
|---|---|---|
| Penyimpanan (Postgres + pgvector) | **Ya** — data 52 MB, Postgres ±200–300 MB RAM | SQL, migrasi, `match_documents_hybrid`, RLS sudah ada di repo → dipakai apa adanya. **Tidak** menulis mesin database sendiri |
| Embedding (model ±1 GB, CPU) | **Ya, bersyarat** | Wajib lolos set uji Kepbup 14/14 (Item 90) sebelum dipakai; mpnet hanya 128 token (potongan 800 huruf terpotong); e5 wajib awalan `query:`/`passage:`; ganti model = embed ulang semua |
| Login, RLS `auth.uid()`, fungsi server (Deno) | Mungkin, berat | Ketergantungan Supabase lebih luas dari database; Supabase self-host Docker ±4 GB+ RAM — terlalu berat untuk laptop ini |
| Model penjawab (LLM) | **Belum layak** | 7–8B di CPU ±3–6 token/detik, mutu jauh di bawah model sekarang |
| Mametlite (pengguna eksternal) | Tidak | Tetap awan |

Prinsip menjaga pintu keluar (sudah berjalan): logika murni di modul bersama (`dataTabelAsn*.js`, `KnowledgeService.js`),
skema lewat migrasi di repo, tidak mengunci fitur ke layanan khusus Supabase tanpa alasan.

## 4. Tahapan & Kriteria Selesai

### Tahap 1 — Cadangan yang benar-benar lengkap
- [ ] `backup-export` ikut mencadangkan **teks** `document_chunks` (vektor boleh dibuang — bisa dibuat ulang dari teks,
      berbayar embedding) + `asn_berkas`/`asn_pegawai`; perbaiki komentar yang keliru.
- [ ] Tombol "Cadangkan data" di aplikasi → berkas di laptop Owner (izin unduh per Owner).
- [ ] **Kriteria:** jumlah baris per tabel di berkas = jumlah di database; teks semua potongan Kepbup ada.

### Tahap 2 — Uji pulih ke Postgres lokal
- [ ] Postgres + pgvector lokal (instalasi biasa atau Docker, diputuskan saat itu), jalankan migrasi repo, pulihkan
      cadangan.
- [ ] **Kriteria:** hitungan baris sama; satu pencarian `match_documents_hybrid` lokal (vektor dibuat ulang atau ikut
      dicadangkan) mengembalikan potongan yang sama dengan Supabase untuk 3 pertanyaan set uji; Data Tabel RSUD
      struktural = 14.

### Tahap 3 — (jangka panjang) Embedding lokal
- [ ] Uji model 768-D lokal dengan set uji Kepbup 14 pertanyaan, di luar aplikasi, $0. Lolos 14/14 baru dirancang.

### Tahap 4 — (sangat jauh) Mamet desktop berjalan dengan database lokal
- [ ] Hanya bila Tahap 1–3 lolos dan perangkat keras memadai. Login & fungsi server dirancang saat itu.

## 5. Risiko & Pertanyaan Terbuka

- Cadangan berisi data pribadi ASN (nama, NIP) → berkas cadangan di laptop wajib diperlakukan rahasia (lokasi, enkripsi
  disk?) — keputusan Owner di Tahap 1.
- Berkas cadangan chat bisa besar; `agent_logs` sebaiknya tidak ikut (log, bukan data).
- Uji pulih memakai disk D; Docker/Postgres memakai RAM saat berjalan — dimatikan setelah uji.
