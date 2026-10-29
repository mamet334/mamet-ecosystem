# ROADMAP-HARDENING — Menuju Garis Dasar Mamet (5.0.0)

**Keputusan:** [ADR-0022](../adr/ADR-0022-mamet-cukup-dan-fase-hardening.md) (ACCEPTED 2026-10-29).
**Garis dasar** = pekerjaan inti — **Chat + RAG dokumen** dan **Data tabel ASN** — andal & aman dipakai sehari-hari,
di Mamet Ecosystem dan Mametlite. Sesudah tercapai Mamet tetap berevolusi; perubahan tidak boleh merusak garis dasar.

**Aturan temuan baru** (ADR-0022 §2.4): menyentuh K1–K7, keamanan, atau kehilangan data → masuk daftar di bawah.
Lainnya → **Parkir** (bukan utang). Fitur baru boleh jalan, asal uji yang menjaga K1–K7 tetap hijau.
**Laporan ditutup dengan status K1–K7**, bukan "sisa roadmap".

Legenda: ✅ terbukti · ⏳ dikerjakan/menunggu · 💳 butuh saldo OpenRouter · 👤 tindakan Owner

## Status K1–K7 (29 Okt 2026)

| # | Kriteria | Status | Sisa |
|---|---|---|---|
| K1 | RAG menemukan & menjawab benar | ⏳ | 1 |
| K2 | RAG jujur saat gagal | ⏳ | 1 |
| K3 | Data tabel ASN benar, NIP/nama tak ke model | ✅ (ulang sebelum rilis) | 1 |
| K4 | Mametlite layak bagi orang awam | ⏳ (T19 ✅ live, isolasi ✅ kode) | 1 (uji nyata dua akun) |
| K5 | Keamanan | ⏳ | 5 |
| K6 | Data aman & bisa dipulihkan | ✅ (ulang sebelum rilis) | 1 |
| K7 | Stabil & sampai ke aplikasi terpasang | ⏳ | 2 |

## Daftar kerja

### K1 — RAG menemukan & menjawab benar
- ✅ Pengambilan: recall@8 **14/14** (Item 90 Tahap A–C).
- ⏳💳 **Set uji mutu jawaban yang sah** dibangun ulang (set lama 13 pertanyaan tak sah — dokumennya terhapus) dan lulus
  ambang: **semua pertanyaan pokok benar + sumber benar**; "tidak ditemukan" yang jujur boleh, mengarang tidak.

### K2 — RAG jujur saat gagal
- ✅ RAG turun bersuara (2 Okt).
- ⏳ **U8b** (Item 90): jalur tanpa kunci OpenRouter (cadangan pencocokan kata) terbukti live — atau dinyatakan tak ada
  dan pengguna diberi tahu dengan jelas.

### K3 — Data tabel ASN
- ✅ Tanya-jawab live **5/5 VERIFIED**, NIP tidak ke model (Item 92).
- ⏳ Ulang sekali sebelum rilis garis dasar.

### K4 — Mametlite layak bagi orang awam
- ✅ RAG Mametlite live (U8a), tampilan HP (Item 125 M3).
- ✅ **T19 kode** lupa & ganti kata sandi di Ecosystem + Mametlite ([log](../project-memory/changelog/2026-10-29-t19-lupa-ganti-kata-sandi.md)).
- ✅ **T19 terbukti live 29 Okt** (Mametlite: email → tautan → kata sandi baru `PUT /user` 200 → masuk di HP & laptop; Site URL &
  Redirect URLs dibereskan Owner). Belum diuji live: ganti kata sandi bagi yang sudah masuk. Pertimbangkan SMTP sendiri bila
  pengguna Mametlite bertambah (batas kirim email bawaan).
- ✅ **Isolasi data antar-akun diuji 29 Okt** ([log](../project-memory/changelog/2026-10-29-k4-isolasi-dua-akun.md)): database (RLS baca/tulis,
  fungsi SECURITY DEFINER) ✅, server (`agent-process`, `rag-process`) ✅; **peramban Mametlite bocor** (riwayat & kunci
  OpenRouter satu kunci untuk semua akun) → **diperbaiki** (data per akun, pilihan a). ⏳ uji nyata Owner dua akun di satu peramban.

### K5 — Keamanan
- ✅ RLS "baca semua" ditutup (Item 93); rahasia tak masuk `agent_logs` (T7).
- ✅ **Alamat mati di pengaturan masuk Supabase** (29 Okt): Site URL `otak-box-ai-navy.vercel.app` & Redirect URL
  `ai-agent-project-2a9h.vercel.app/*` menunjuk deployment Vercel yang sudah tidak ada — diganti/dihapus Owner.
- ⏳ **Hak bawaan 39 tabel** bagi `anon`/`authenticated` + fungsi yatim (Item 125 Fase C — [roadmap](./ROADMAP-SIAP-PENGGUNA.md)).
- ⏳ **T1** daftar izin sub-agent di server.
- ⏳ **`proxy_fetch` terbuka tanpa token** (terbukti live 29 Okt; pemanggil hanya web Tier 3 yang bertoken — bukan crawler).
- ⏳ **Log autentikasi menulis seluruh objek pengguna** (email & metadata) — cukup ID.
- ⏳👤 **Ganti kunci API** yang pernah bocor (T7) & token Apify (T1).

### K6 — Data aman & bisa dipulihkan
- ✅ "Cadangkan data" 13/13 cocok; uji pulih ke Postgres lokal 13/13 (Item 93 Tahap 1–2).
- ⏳ Ulang sekali sebelum rilis garis dasar.

### K7 — Stabil & sampai ke aplikasi terpasang
- ✅ Suite 129/129; galat dalam bahasa manusia (Item 125 M4).
- ⏳ **Uji goyah J3b** (Item 125 Fase C).
- ⏳💳👤 **Rilis** yang membawa semua perubahan — chat & PDF di Electron 45 diuji; Node 24 & `icacls` di laptop Owner.
  Rilis garis dasar diberi nomor **5.0.0**.

## Parkir (bukan utang — Owner boleh mengambil kapan saja)

- Item 126 Fase 1 bukti live (router, jalur aman, baris langkah di chat sungguhan) · Fase 0 kegagalan telemetri · Fase 2–4
- ADR-0021 §7 penulis ulang kueri untuk pesan yang merujuk percakapan
- Item 129 Tahap D (label Hypothesis & Engineer)
- Item 92 koreksi pemetaan Data Tabel
- Item 88 BUKU-10 · Item 90 U4, U6, U7 · Item 93 Tahap 3–4
- T18 kelas Tailwind tak dibuat · retensi tabel log lain (`verification_audit_logs`, `evidence_audit_logs`, `memory_audit_logs`)
- Graf Home diperkaya & `graf-bercahaya`
- Engineer: T10 Tahap 2–3, Engineer Mandiri Tahap 1 & 4
