# ROADMAP-HARDENING — Menuju Garis Dasar Mamet (5.0.0)

**Keputusan:** [ADR-0022](../adr/ADR-0022-mamet-cukup-dan-fase-hardening.md) (ACCEPTED 2026-10-29).
**Garis dasar** = pekerjaan inti — **Chat + RAG dokumen** dan **Data tabel ASN** — andal & aman dipakai sehari-hari,
di Mamet Ecosystem dan Mametlite. Sesudah tercapai Mamet tetap berevolusi; perubahan tidak boleh merusak garis dasar.

**Aturan temuan baru** (ADR-0022 §2.4): menyentuh K1–K7, keamanan, atau kehilangan data → masuk daftar di bawah.
Lainnya → **Parkir** (bukan utang). Fitur baru boleh jalan, asal uji yang menjaga K1–K7 tetap hijau.
**Laporan ditutup dengan status K1–K7**, bukan "sisa roadmap".

Legenda: ✅ terbukti · ⏳ dikerjakan/menunggu · 💳 butuh saldo OpenRouter · 👤 tindakan Owner

## Status K1–K7 (30 Okt 2026)

| # | Kriteria | Status | Sisa |
|---|---|---|---|
| K1 | RAG menemukan & menjawab benar | ⏳ | 1 |
| K2 | RAG jujur saat gagal | ⏳ | 1 |
| K3 | Data tabel ASN benar, NIP/nama tak ke model | ✅ (ulang sebelum rilis) | 1 |
| K4 | Mametlite layak bagi orang awam | ⏳ (T19 ✅ live, isolasi dua akun ✅ live) | 2 (pesan saldo teknis · 👤 ganti sandi live) |
| K5 | Keamanan | ⏳ | 1 (👤 ganti kunci) |
| K6 | Data aman & bisa dipulihkan | ✅ (ulang sebelum rilis) | 1 |
| K7 | Stabil & sampai ke aplikasi terpasang | ⏳ | 1 (rilis 💳👤) |

## Daftar kerja

### K1 — RAG menemukan & menjawab benar
- ✅ Pengambilan: recall@8 **14/14** (Item 90 Tahap A–C).
- ⏳💳 **Set uji mutu jawaban yang sah** dibangun ulang (set lama 13 pertanyaan tak sah — dokumennya terhapus) dan lulus
  ambang: **semua pertanyaan pokok benar + sumber benar**; "tidak ditemukan" yang jujur boleh, mengarang tidak.

### K2 — RAG jujur saat gagal
- ✅ RAG turun bersuara (2 Okt).
- ⏳💳 **U8b** (Item 90): cadangan pencocokan kata saat embedding gagal. ✅ **Pengguna kini diberi tahu di jawaban**
  (30 Okt, v542): satu baris "Catatan sistem" tampil di kotak label Mametlite & Ecosystem — dulu hanya di langkah proses
  yang tak ditampilkan Mametlite ([log](../project-memory/changelog/2026-10-30-k5-batas-rag-j3b-u8b.md)). Sisa: bukti
  live (0 dari 278 pesan RAG pernah turun) — butuh chat yang menjawab sementara embedding gagal.

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
  OpenRouter satu kunci untuk semua akun) → **diperbaiki** (data per akun, pilihan a). ✅ **Uji nyata Owner 30 Okt** di
  mametlite.vercel.app: akun B tak melihat kunci, riwayat, maupun dokumen akun A ([log](../project-memory/changelog/2026-10-29-k4-isolasi-dua-akun.md)).
- ⏳ **Pesan saldo habis terlalu teknis di Mametlite** (30 Okt): galat saldo OpenRouter sampai sebagai teks jawaban
  ("Fallback Note: OpenRouterAdapter failed…", "plafon ulangnya 26 token"), jadi penerjemah pesan M4 tak menyentuhnya.
- ⏳👤 Uji live ganti kata sandi bagi yang sudah masuk.

### K5 — Keamanan
- ✅ RLS "baca semua" ditutup (Item 93); rahasia tak masuk `agent_logs` (T7).
- ✅ **Alamat mati di pengaturan masuk Supabase** (29 Okt): Site URL `otak-box-ai-navy.vercel.app` & Redirect URL
  `ai-agent-project-2a9h.vercel.app/*` menunjuk deployment Vercel yang sudah tidak ada — diganti/dihapus Owner.
- ✅ **Hak tabel dipangkas** (30 Okt): `anon` 0 hak; `authenticated` 54 hak di 27 tabel = persis yang dipakai klien;
  `TRUNCATE` dkk. 0; 9 fungsi tanpa pemanggil klien → service_role. Dijaga `uji-hak-tabel-k5`; Cadangkan data 15/15
  sesudahnya ([log](../project-memory/changelog/2026-10-30-k5-hak-tabel.md)).
- ✅ **T1 izin sub-agent di server** (30 Okt, v541): sub-agent hanya jalan bila diminta `tools`; Mametlite hanya riset;
  `youtube_analyst` + token Apify hanya akun pemilik (`MAMET_PEMILIK_IDS`, belum diisi → tertutup); pagar alamat di setiap
  pengalihan untuk `proxy_fetch`/`communicator`/`scraper` ([log](../project-memory/changelog/2026-10-30-k5-t1-izin-subagent.md)).
- ✅ **Batas volume `rag-process`** (30 Okt, v77, TM-004): per akun 10.000 potongan, total 45.000 — diperiksa sebelum
  embedding; unggahan live Owner sesudah deploy berhasil ([log](../project-memory/changelog/2026-10-30-k5-batas-rag-j3b-u8b.md)).
- ✅ **`proxy_fetch` wajib token + hanya alamat publik; log autentikasi hanya ID** — ter-deploy v540 30 Okt, live tanpa token → 401
  ([log](../project-memory/changelog/2026-10-30-k5-proxy-fetch-log-email.md)).
- ⏳👤 **Ganti kunci API** yang pernah bocor (T7) & token Apify (T1).

### K6 — Data aman & bisa dipulihkan
- ✅ "Cadangkan data" 13/13 cocok; uji pulih ke Postgres lokal 13/13 (Item 93 Tahap 1–2).
- ⏳ Ulang sekali sebelum rilis garis dasar.

### K7 — Stabil & sampai ke aplikasi terpasang
- ✅ Suite 129/129; galat dalam bahasa manusia (Item 125 M4).
- ✅ **Uji goyah J3b dipatok** (30 Okt): asersi dipecah tiga + satu percobaan ulang bila Python belum menyala; tetap gagal
  bila pohon proses tak dimatikan ([log](../project-memory/changelog/2026-10-30-k5-batas-rag-j3b-u8b.md)). Suite 136/136.
- ⏳💳👤 **Rilis** yang membawa semua perubahan — chat & PDF di Electron 45 diuji; Node 24 & `icacls` di laptop Owner.
  Rilis garis dasar diberi nomor **5.0.0**.

## Parkir (bukan utang — Owner boleh mengambil kapan saja)

- Item 126 Fase 1 bukti live (router, jalur aman, baris langkah di chat sungguhan) · Fase 0 kegagalan telemetri · Fase 2–4
- ADR-0021 §7 penulis ulang kueri untuk pesan yang merujuk percakapan
- Item 129 Tahap D (label Hypothesis & Engineer)
- Item 92 koreksi pemetaan Data Tabel
- Item 88 BUKU-10 · Item 90 U4, U6, U7 · Item 93 Tahap 3–4
- Kode mati (graphify 30 Okt): `supabase/functions/test-suite/` (rusak sintaks, tak ter-deploy),
  `agent-process/lib/maef/engineering_lifecycle.ts` (1 baris "MOVED"), `agent-process/plugins/memory_manager.ts` (tak terdaftar)
- Metadata chat menyimpan `[SYSTEM CONTEXT FINAL] fullSystemContext=…` (termasuk teks potongan dokumen) di langkah proses
  ±300 pesan — membengkakkan baris `chats` & berkas cadangan (milik pengguna sendiri, RLS; bukan kebocoran)
- `.gitignore` akar tidak memuat `hasil/` padahal CLAUDE.md melarang meng-commit-nya
- `npm run dev` Mametlite layar kosong — CSP `script-src 'self'` memblokir preamble React inline Vite (build tak terdampak)
- T18 kelas Tailwind tak dibuat · retensi tabel log lain (`verification_audit_logs`, `evidence_audit_logs`, `memory_audit_logs`)
- Graf Home diperkaya & `graf-bercahaya`
- Engineer: T10 Tahap 2–3, Engineer Mandiri Tahap 1 & 4
