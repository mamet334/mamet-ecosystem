# ROADMAP-HARDENING — Menuju Garis Dasar Mamet (5.0.0)

**Keputusan:** [ADR-0022](../adr/ADR-0022-mamet-cukup-dan-fase-hardening.md) (ACCEPTED 2026-10-29).
**Garis dasar** = pekerjaan inti — **Chat + RAG dokumen** dan **Data tabel ASN** — andal & aman dipakai sehari-hari,
di Mamet Ecosystem dan Mametlite. Sesudah tercapai Mamet tetap berevolusi; perubahan tidak boleh merusak garis dasar.

**Aturan temuan baru** (ADR-0022 §2.4): menyentuh K1–K7, keamanan, atau kehilangan data → masuk daftar di bawah.
Lainnya → **Parkir** (bukan utang). Fitur baru boleh jalan, asal uji yang menjaga K1–K7 tetap hijau.
**Laporan ditutup dengan status K1–K7**, bukan "sisa roadmap".

Legenda: ✅ terbukti · ⏳ dikerjakan/menunggu · 💳 butuh saldo OpenRouter · 👤 tindakan Owner

## Status K1–K7 (6 Nov 2026)

| # | Kriteria | Status | Sisa |
|---|---|---|---|
| K1 | RAG menemukan & menjawab benar | ✅ **11 Nov — dengan batas yang diketahui (keputusan Owner)**: uji mutu sesudah Item 131 — 44/44 putaran benar saat pencarian jalan, 8/52 putaran pencarian gagal karena CPU paket gratis (Nano) dan dilaporkan jujur ([log](../project-memory/changelog/2026-11-11-k1-k2-uji-mutu-sesudah-item-131.md)); sebelumnya ❌ 6 Nov: RAG chat kosong karena batas waktu (korpus 12.445 potongan); **terukur 9 Nov (Item 131 Tahap 0): 14/16 giliran dihentikan 5 s, 11× potongan ketemu lalu dibuang**; sesudah Tahap A bagian 1 (v552): 0 dibuang, tetapi pencarian masih bisa kena batas query 8 s saat database dibatasi — [Item 131](./ROADMAP-MAKSIMALKAN-MODEL.md) A–C; sebelumnya lulus di korpus pecahan 5 Nov (pokok 22/22, BUKU-10 5/5); unggah dokumen besar ✅ live | 2 (Item 131 A → 💳 buku utuh + uji penuh) |
| K2 | RAG jujur saat gagal | ✅ **11 Nov**: tidak_ada 8/8 jujur, label bohong 0, setiap pencarian gagal disebut apa adanya ([log](../project-memory/changelog/2026-11-11-k1-k2-uji-mutu-sesudah-item-131.md)); sebelumnya ❌ 6 Nov: kegagalan batas waktu RAG & pemangkasan konteks tak diberitahukan — Item 131 C, H; sebelumnya tidak_ada 8/8 JUJUR (5 Nov) | ikut K1 |
| K3 | Data tabel ASN benar, NIP/nama tak ke model | ✅ final 5 Nov (5/5 VERIFIED, 0 NIP ke model) | — |
| K4 | Mametlite layak bagi orang awam | ✅ (T19, isolasi dua akun, CORE, undangan, ganti sandi — live) | — |
| K5 | Keamanan | ⏳ 9 Nov: pemblokir kata kunci **dicabut** (Item 131 D, v554 — [log](../project-memory/changelog/2026-11-09-item-131-tahap-d-cabut-blokir-kata.md)), Mametlite tidak rusak — terbukti 11 Nov ([log](../project-memory/changelog/2026-11-11-item-131-bukti-mametlite-dan-label-daftar-rag.md)); log `[L1]` tak lagi mencatat isi pesan; 6 Nov: pemblokir kata kunci = keamanan semu (memblokir dokumen Owner, mematikan alat diam-diam) — [Item 131](./ROADMAP-MAKSIMALKAN-MODEL.md) D; email akun tertulis di 3 dokumen publik (menunggu keputusan Owner); sebelumnya ✅ OpenRouter diganti, Apify dicabut (3 Nov) | 1–2 |
| K6 | Data aman & bisa dipulihkan | ✅ 16 tabel (ulang sebelum rilis) | 1 (👤 cadangkan → uji pulih) |
| K7 | Stabil & sampai ke aplikasi terpasang | ⏳ 4.4.2 draf (build GitHub ✅, menunggu Publish) | 1 (rilis 5.0.0 💳👤 sesudah K1–K6) |

## Daftar kerja

### K1 — RAG menemukan & menjawab benar
- ✅ Pengambilan: recall@8 **14/14** (Item 90 Tahap A–C).
- ⏳💳 **Set uji mutu jawaban yang sah** dibangun ulang (set lama 13 pertanyaan tak sah — dokumennya terhapus) dan lulus
  ambang: **semua pertanyaan pokok benar + sumber benar**; "tidak ditemukan" yang jujur boleh, mengarang tidak.
  ✅ **Set & penguji siap (3 Nov):** `set-uji-mutu-k1.json` (22 pokok HCDP-01..08 + BUKU-01..14, 4 tidak_ada — susunan
  disetujui Owner; KEP-01..06 dibuang, dokumennya tak ada lagi), penilai `uji/lib/penilaiMutuRag.mjs` (mutasi 23/23),
  modul konsol `uji/uji-mutu-rag-k1.js` (versi `k1-2`). Jalan pertama 3 Nov tanpa saldo: 52/52 berhenti di model
  (402) — **belum terukur**; pengambilan potongan terbukti live (HCDP-01 6–8 potongan, skor 0,73, gate PASSED). Galat
  kini = TIDAK_TERUKUR, bukan SALAH. Sisa: dijalankan sesudah saldo diisi (💳) — perintahnya di kepala modul.
- ❌ **Uji penuh pertama (5 Nov):** pokok 43/44 benar; **BUKU-10 salah** (4/5 pada ulang ×5). Penilai diperbaiki
  (pengakuan sebagian = PERLU_CEK; pasangan baris → nilai) — [log](../project-memory/changelog/2026-11-05-k1-uji-penuh-penilai-pasangan.md).
  Menempel tingkat dengan menghitung sel OCR **ditolak** (83% setuju di korpus). Keputusan Owner: dirapikan saat unggah,
  tanpa LLM. Sisa, berurutan:
  1. ✅ **Centang ditulis sebagai kata saat unggah** (5 Nov): `| √ |` → `| √ Mutlak |` dari posisi tanda di PDF — OCR
     lewat pemasangan urutan berpenjaga, pdf.js langsung di item; "Ö" dihitung; Ecosystem + Mametlite. Korpus: 210/247
     halaman bercentang ditulis, 0 geseran berbahaya lolos, 177 = kunci BUKU-10 —
     [log](../project-memory/changelog/2026-11-05-k1-centang-ditulis-saat-unggah.md). ✅ **Uji ulang live** sesudah 221
     pecahan diunggah ulang: BUKU-10 5/5 benar; uji penuh pokok **22/22** benar, tidak_ada 8/8 jujur (HCDP sempat hilang
     dari RAG, diunggah ulang) — [log](../project-memory/changelog/2026-11-05-k1-uji-ulang-sesudah-centang.md).
  2. ✅ **Unggah dokumen besar bertahap** (5 Nov, live: rag-process v82, migrasi `unggah_bertahap`, `kunci_unggah`,
     `indeks_document_id`): satu berkas mentah = satu dokumen; setiap kelompok 32 potongan langsung tersimpan sebagai
     cache; ±80 s per panggilan, klien memanggil lagi; putus → berkas yang sama melanjutkan dari potongan terakhir
     (sidik SHA-256, dihitung server); dokumen belum selesai tak dipakai chat; kunci sementara (423); cache OCR di
     perangkat; NUL dibuang; penolakan lokasi diulang. Live: buku 1.986 potongan (2 panggilan, 1.440 dari cache),
     Kamus 6.472 (Ctrl+R di tengah → "lanjut dari 2496", tiap potongan tepat sekali) —
     [log](../project-memory/changelog/2026-11-05-k1-unggah-dokumen-besar-bertahap.md). Riwayat: **terbukti perlu 5 Nov**
     dengan buku umum Owner (gagal di 1.856/1.986 potongan, 105 s) dan unggah massal 385 changelog — ikut dirancang:
     ulang kelompok yang ditolak sesaat (503 gerbang Supabase, penolakan lokasi Google), bersihkan karakter NUL —
     [log](../project-memory/changelog/2026-11-05-unggah-buku-besar-dan-sejarah-aplikasi.md).
  3. ⏳💳 Unggah ulang **buku asli utuh** (sekali, sesudah 1 & 2 — OCR tidak dibayar dua kali) → BUKU-10 ×5 → K1/K2 penuh.
     5 Nov: buku masuk "kepbup oku" (2.880 potongan) tetapi saldo habis di halaman ±442 → 522 halaman tanpa OCR (tak
     sah untuk uji). ✅ **Perbarui dokumen + OCR berhenti saat 402** (live 6 Nov: migrasi `perbarui_dokumen`,
     rag-process v84; uji SQL live) — nama sama di workspace yang sama → versi baru dibangun, potongan tak berubah
     menyalin vektor lama di database, versi lama dihapus sesudah selesai —
     [log](../project-memory/changelog/2026-11-06-k1-perbarui-dokumen-dan-ocr-402.md). Sisa: uji pakai dokumen pendek;
     💳 isi saldo → unggah ulang "Kepbup Standar Kompetensi Jabatan(1).pdf" (nama persis) → Perbarui → uji penuh.
     ❌ **Temuan 6 Nov:** RAG chat kosong karena batas 5 s (pencarian gabungan dingin 6,9 s, tanpa indeks vektor — hasil
     yang sudah ketemu dibuang, tanpa pemberitahuan) dan konteks percakapan dipangkas server → **uji penuh menunggu
     [Item 131](./ROADMAP-MAKSIMALKAN-MODEL.md) Tahap A** (lalu C & H untuk K2).

### K2 — RAG jujur saat gagal
- ✅ RAG turun bersuara (2 Okt).
- ⏳💳 **U8b** (Item 90): cadangan pencocokan kata saat embedding gagal. ✅ **Pengguna kini diberi tahu di jawaban**
  (30 Okt, v542): satu baris "Catatan sistem" tampil di kotak label Mametlite & Ecosystem — dulu hanya di langkah proses
  yang tak ditampilkan Mametlite ([log](../project-memory/changelog/2026-10-30-k5-batas-rag-j3b-u8b.md)). Sisa: bukti
  live (0 dari 278 pesan RAG pernah turun) — butuh chat yang menjawab sementara embedding gagal.

### K3 — Data tabel ASN
- ✅ Tanya-jawab live **5/5 VERIFIED**, NIP tidak ke model (Item 92).
- ✅ **Diulang 5 Nov** (pertanyaan sama dengan 21 Sep, kunci dihitung dari DB): 5/5 VERIFIED & benar (total kini 634 —
  Kelurahan Baturaja Lama masuk), 0 NIP karangan (190/190 ada di DB), 0 NIP di konteks model —
  [log](../project-memory/changelog/2026-11-05-k3-uji-ulang-data-tabel.md).

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
- ✅ **Pesan saldo habis manusiawi** (30 Okt, v543): kegagalan semua penyedia di jalur stream kini "⚠️ Saldo OpenRouter
  Anda tidak cukup … isi ulang di openrouter.ai" + teks teknis kecil; tanpa "Fallback Note" & tanpa label HYPOTHESIS
  palsu — terbukti live di Mametlite ([log](../project-memory/changelog/2026-10-30-k4-pesan-saldo-stream.md)).
- ✅ **Akun baru langsung punya ruang inti (CORE)** (31 Okt): dulu tak ada yang membuatnya → pengguna Mametlite baru gagal
  mengunggah dokumen ("Core space belum di-setup"); pemicu di `auth.users` + isi ulang, CORE 3/3
  ([log](../project-memory/changelog/2026-10-31-k4-ruang-inti-akun-baru.md)).
- ✅ **Tautan undangan Supabase membuka layar buat kata sandi** (31 Okt, kode): akun didaftarkan Owner lewat "Send invitation";
  dulu yang diundang masuk tanpa pernah membuat kata sandi. ✅ **Terbukti live 31 Okt**: akun undangan membuat sandi, masuk, dan
  langsung punya CORE.
- ✅ **Ganti kata sandi saat sudah masuk terbukti live** (2 Nov, Owner): sandi diganti dari Pengaturan, lalu masuk dengan
  sandi baru berhasil (database: masuk 01:03 UTC; log audit Auth tak terbaca dari alat yang ada).

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
- ✅ **Pendaftaran publik ditutup** (31 Okt, Owner): `disable_signup: true`, daftar lewat API → 422 `signup_disabled`; akun baru
  hanya lewat undangan dashboard — akar TM-001..004 tertutup ([log](../project-memory/changelog/2026-10-31-k6-hapus-akun-dan-daftar-tertutup.md)).
- ✅ **Tooltip graf Home tak lagi menjalankan HTML** (2 Nov, Item 130 Tahap A): nama simpul (judul chat, nama berkas,
  ringkasan memori) dulu ditulis lewat innerHTML di renderer yang memegang `electronAPI` (desktop tanpa CSP) — kini
  di-escape ([log](../project-memory/changelog/2026-11-02-graf-home-tahap-a.md)).
- ✅ **Kunci OpenRouter** yang pernah tersimpan di `agent_logs` (T7) — sudah diganti Owner sesudah 17 Sep (keterangan Owner 3 Nov).
- ✅ **Token Apify dicabut, bukan diganti** (3 Nov, Owner): satu-satunya pemakai `youtube_analyst`, yang sejak T1 hanya
  jalan untuk `MAMET_PEMILIK_IDS` (sengaja kosong) — Apify tak terpakai. Token dihapus di Apify + secret `APIFY_API_TOKEN`
  di Supabase. Sesudahnya `agent-process` v545 (tanpa deploy) `booted 70ms` + OPTIONS 200 pukul 02:43 UTC, tanpa galat;
  daftar secret tak terbaca dari alat yang ada (keterangan Owner). Chat penuh terbukti bersama uji K1/K2 (💳).

### K6 — Data aman & bisa dipulihkan
- ✅ "Cadangkan data" 13/13 cocok; uji pulih ke Postgres lokal 13/13 (Item 93 Tahap 1–2).
- ✅ **Hapus akun = hapus seluruh datanya** (31 Okt, pilihan A Owner): pemicu BEFORE DELETE di auth.users, sisa data 0;
  regresi CORE (semua akun tak bisa dihapus) diperbaiki ([log](../project-memory/changelog/2026-10-31-k6-hapus-akun-dan-daftar-tertutup.md)).
- ✅ **`raw_memory_content` ikut dicadangkan** (3 Nov, keputusan Owner): sumber asli memori (22 baris) dulu tak tercadang —
  hanya ringkasannya di `user_memories`. Cadangan & skema pulih kini 16 tabel; uji 4/4 mutasi.
- ⏳ **VACUUM FULL `document_chunks`** (pengingat Owner 5 Nov, juga di INDEX §1) sesudah dokumen besar dihapus —
  pertama sesudah 221 Kepbup pecahan dihapus di K1 langkah 3. Paket Supabase gratis 500 MB; DELETE tidak menurunkan
  pemakaian kuota sampai VACUUM FULL (kunci eksklusif sebentar → jalankan saat tak ada unggahan/chat). Ukur
  `pg_database_size` sebelum & sesudah. Batas volume K5 per akun dinaikkan 10.000 → 25.000 (5 Nov, total tetap 45.000).
- ⏳👤 **Sekali tepat sebelum rilis** (keputusan Owner 3 Nov): "Cadangkan data" (16 tabel) → uji pulih ke Postgres lokal.
  Uji pulih terakhir 27 Okt (15/15); cadangan 2 Nov hanya pengaman sebelum chat dirampingkan, belum memuat tabel baru.

### K7 — Stabil & sampai ke aplikasi terpasang
- ✅ Suite 129/129; galat dalam bahasa manusia (Item 125 M4).
- ✅ **Uji goyah J3b dipatok** (30 Okt): asersi dipecah tiga + satu percobaan ulang bila Python belum menyala; tetap gagal
  bila pohon proses tak dimatikan ([log](../project-memory/changelog/2026-10-30-k5-batas-rag-j3b-u8b.md)). Suite 136/136.
- ✅ **J3 gerbang uji** (2 Nov, terbukti di GitHub: main hijau 131 lulus/9 dilewati/0 gagal; PR #6 berisi uji sengaja merah
  DITOLAK): suite penuh jalan di GitHub pada push/PR, rilis hanya terbit sesudah uji lulus; suite tak
  lagi bergantung pada laptop Owner; J3c pilihan B (CRLF bukan gerbang). Laptop 140/140
  ([log](../project-memory/changelog/2026-11-02-j3-gerbang-uji.md)).
- ✅ **Rilis 4.4.0 TERBIT** (30 Okt 15:06Z, Latest): Electron 45 + hasil hardening sisi klien; build GitHub hijau,
  `latest.yml` cocok dengan aset ([log](../project-memory/changelog/2026-10-30-rilis-4.4.0-hardening.md)).
- ✅ **Rilis 4.4.1 TERBIT** (3 Nov 04:35Z, Latest; keputusan Owner, bukan 5.0.0): graf Home tata surya dan hasil
  hardening klien sejak 4.4.0. Build GitHub hijau, `latest.yml` cocok dengan aset; aplikasi terpasang Owner sudah
  diperbarui ke 4.4.1, termasuk di PC kedua (Windows 10) dengan crawler menyala di percobaan pertama
  ([log](../project-memory/changelog/2026-11-03-rilis-4.4.1.md)).
- ⏳👤 **Rilis 4.4.2** (perintah Owner 6 Nov, bukan 5.0.0): konektor umum (Item 129 G1–G5, F1–F2, GH2–GH3) + K1 unggah
  bertahap, hapus banyak, perbarui dokumen, OCR berhenti saat 402. Build lokal & suite 158/158 hijau; build GitHub
  `e5dcd87a` ✅ (gerbang uji + build), draf `v4.4.2` berisi `.exe`, `.blockmap`, `latest.yml` (API 6 Nov); sisa:
  Publish (Owner) → bukti `latest.yml` & `releases/latest` ([log](../project-memory/changelog/2026-11-06-rilis-4.4.2.md)).
  Belum membawa Item 131.
- ⏳💳👤 **Rilis garis dasar 5.0.0** — hanya bila K1–K7 semuanya ✅.

## Parkir (bukan utang — Owner boleh mengambil kapan saja)

- Item 126 Fase 1 bukti live (router, jalur aman, baris langkah di chat sungguhan) · Fase 0 kegagalan telemetri · Fase 2–4
- Biaya embedding pertanyaan (RAG) tak tercatat di `cost_ledger`/`api_usage` — terlihat 3 Nov: saldo turun tiap
  percobaan walau semua jawaban ditolak 402 (pembukuan Data Flywheel)
- ADR-0021 §7 penulis ulang kueri untuk pesan yang merujuk percakapan
- Item 129 Tahap D (label Hypothesis & Engineer)
- Item 92 koreksi pemetaan Data Tabel
- ~~Item 88 BUKU-10~~ (ditutup 5 Nov lewat K1 langkah 1) · Item 90 U4, U6, U7 · Item 93 Tahap 3–4
- ✅ **Diambil Owner 5 Nov:** Research App — daftar yang berlomba sesudah muat ulang (jawaban usang kini dibuang) +
  **pilih banyak dokumen lalu hapus** ([log](../project-memory/changelog/2026-11-05-research-app-hapus-banyak-dokumen.md)).
  Mametlite belum punya hapus banyak.
- Unggah bertahap: perkiraan biaya OCR di dialog belum memperhitungkan cache (biaya sebenarnya lebih kecil); halaman
  yang tetap gagal di-OCR tidak disimpan di cache → bila sesudahnya berhasil, teks berubah dan lanjutan ditolak 409
  (pesan menyuruh hapus & unggah ulang); cache OCR di server (pilihan B, lintas perangkat).
- ✅ **Dibereskan 2 Nov:** kode mati (`test-suite/`, `maef/engineering_lifecycle.ts`, `plugins/memory_manager.ts`),
  12 baris sampah uji `api_usage`, `.gitignore` untuk `.venv`/`data`/`hasil`
  ([log](../project-memory/changelog/2026-11-02-bersih-bersih-parkir.md))
- ✅ **Dibereskan 2 Nov:** metadata chat membengkak — langkah proses tersimpan dua kali (`steps` +
  `metadata.processingSteps`); kini sekali, tak ikut terkirim di `history`; chat lama dibersihkan (teks 22 → 12 MB,
  tabel 13 → 6,9 MB); `[SYSTEM CONTEXT FINAL]` sengaja dipertahankan
  ([log](../project-memory/changelog/2026-11-02-metadata-chat-ramping.md)). ✅ Bukti chat baru desktop 5 Nov (chat uji K3:
  langkah sekali, ±52 KB — [log](../project-memory/changelog/2026-11-05-unggah-buku-besar-dan-sejarah-aplikasi.md))
- `npm run dev` Mametlite layar kosong — CSP `script-src 'self'` memblokir preamble React inline Vite (build tak terdampak)
- T18 kelas Tailwind tak dibuat · retensi tabel log lain (`verification_audit_logs`, `evidence_audit_logs`, `memory_audit_logs`)
- Graf Home → peta sistem Mamet: **terdaftar sebagai Item 130** ([rancangan](./ROADMAP-GRAF-HOME-PETA-SISTEM.md)) ·
  `graf-bercahaya` (graphify) terpisah, belum ditanggapi
- Engineer: T10 Tahap 2–3, Engineer Mandiri Tahap 1 & 4
- **Cloudflare di depan Supabase memblokir (HTTP 403) kiriman yang memuat pola path traversal** seperti
  `../../etc/passwd` — terbukti 9 Nov dengan kiriman uji (SQL injection, `<script>`, perintah shell lolos; base64 lolos
  semua). Satu jawaban model tentang keamanan cukup mematikan sisa percakapan karena ikut di setiap riwayat; membaca
  berkas berisi contoh semacam itu juga diblokir. **Keputusan Owner 9 Nov: tidak dibungkus base64, dicatat saja.** Yang
  dikerjakan: pesan galat kini menyebut Cloudflare & menyarankan percakapan baru (dulu: "periksa API Key"), dan galat
  "body stream already read" yang menutupi sebab asli diperbaiki (`galatRespons.js`).
- `agent-process` `/health` melaporkan `deployed_commit_sha`/`deployed_at` 10 Sep — data deteksi *drift* (Item 8) basi
  karena deploy biasa tidak lewat `scripts/deploy-agent-process.ps1` (terlihat 9 Nov, v549 —
  [log](../project-memory/changelog/2026-11-09-item-131-tahap-j-diperiksa-dan-dilengkapi.md))
