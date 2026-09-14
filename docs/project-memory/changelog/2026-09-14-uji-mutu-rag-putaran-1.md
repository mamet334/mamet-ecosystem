# Uji Mutu RAG Putaran 1: Angka Awal, Bug Sub-Agent, dan Label yang Keliru Turun

**Tanggal:** 14 September 2026
**Roadmap:** Item 78 (lanjutan Item 76–77)
**Berkas kode:** `supabase/functions/agent-process/lib/orchestration/dispatcher/tool_dispatcher.ts`,
`supabase/functions/agent-process/lib/verification/label_sumber.ts`
**Status:** di-commit; belum di-deploy — putaran 2 set uji dijalankan sesudah `agent-process` di-deploy

## Kenapa

Owner bertanya kenapa masalah chat dan RAG "tidak tuntas-tuntas". Jawabannya: kesalahan bertumpuk di
beberapa lapisan (ekstraksi → potongan → pencarian → model → label) dan setiap perbaikan membuka lapisan
berikutnya; beberapa klaim "sudah beres" tidak berbukti; model tidak deterministik; dan ukurannya selama ini
**satu pertanyaan, satu kali** (HCDP "target rasio tahun 3"). Tanpa angka mutu, tidak ada titik "tuntas".

Maka dibuat **set uji mutu RAG**: pertanyaan nyata dengan jawaban benar, dijalankan berulang, dinilai
otomatis, dibandingkan antar deploy.

## Set uji

Berkas (tidak masuk git — `frontend/node_modules/.uji-rag/`, dilayani Vite dev lewat `/@fs/`):

- `set-uji-rag.json` — 13 pertanyaan. Jawaban benar dicocokkan ke isi `document_chunks`:
  - HCDP-01…08: tabel HCDP — rasio JF tahun 3 (20,0%) dan tahun 1 (5,93%, jebakan kolom), IP-ASN tahun 5
    (80,0), layanan tepat waktu tahun 2 (88%), IKM tahun 4 (84,0), sistem merit tahun 3 (Baik), total PNS
    (4.828), SMP/SD (2,41%, 116 orang);
  - KAT-01…03: KATALOG-PENDAS — Pancasila MKWN4110 (2 sks, I.3; konsisten di 41 potongan), arti Waktu Ujian 99,
    prasyarat TAPS Akuntansi Keuangan Publik (EPFA4104/4221/4223/4225);
  - NEG-01…02: data yang tidak ada di dokumen (target tahun 2030, biaya SPP).
- `jalankan-uji-rag.js` — dijalankan dari konsol DevTools `npm run desktop`:
  `await (await import('/@fs/D:/SLAMET/other/mamet os ecosystem/frontend/node_modules/.uji-rag/jalankan-uji-rag.js')).jalankan()`.
  - Memanggil `AssistantService.processMessage` persis seperti chat (tier, model, header BYOK, payload,
    klasifikasi permintaan sama). Kunci OpenRouter tidak pernah dicetak.
  - `userId` sengaja kosong → `finalizeAssistantSession` tidak jalan (memori sesi tidak disentuh; memori
    personal tidak dimuat ke prompt). Jawaban tidak disimpan ke `chats`.
  - Tiap pertanyaan 2 putaran. Menilai isi (benar / perlu_cek / salah — angka dibandingkan sebagai angka),
    kejujuran label, dan apakah potongan yang benar terambil (`[SYSTEM CONTEXT FINAL]`). Hasil diunduh sebagai
    `hasil-uji-rag-<waktu>.json`.
  - "tidak_boleh_memuat" hanya menjadikan `perlu_cek`, bukan salah: jawaban benar sering menyalin deret tabel
    lengkap.
- Penilai diuji dulu pada jawaban produksi yang hasilnya sudah diketahui (`uji-penilai-rag.mjs`, 14/14).

## Hasil putaran 1 (2026-09-14 11.56 UTC, `agent-process` v426)

26 panggilan, tanpa galat.

| Ukuran | Penilaian otomatis | Sesudah dicek manual |
|---|---|---|
| Isi jawaban dokumen (22) | 20 benar, 2 perlu cek, 0 salah | **22/22 benar** — 2 "perlu cek" (HCDP-04) menyalin deret tabel |
| Potongan yang benar terambil | 22/22 | 22/22 |
| Tanpa label | 0 | 0 |
| Label tidak jujur | 1 | **0** (lihat temuan 3) |
| Label diturunkan sistem | 6 | **4 keliru turun, 2 layak turun** (lihat temuan 1) |

Sufficiency pencarian 0,714–0,803; potongan terambil 4–8 per pertanyaan; waktu 4–33 s.

## Temuan

1. **Label keliru turun karena kutipan judul di dalam dokumen.** Model menulis
   `Sumber: "DOKUMEN PERENCANAAN PENGEMBANGAN KOMPETENSI ASN HUMAN CAPITAL DEVELOPHMENT PLAN (HCDP) …"` atau
   `Sumber: "Katalog Kurikulum FEB, FHISIP, FKIP (Non PGSD, Non PGPAUD, dan Non PAI), FST UT 2026/2027"` — judul
   sampul / tajuk halaman, bukan nama berkas. Pemeriksa Sumber (Item 71) hanya menerima nama berkas → catatan
   "tidak mengutip dokumen" pada KAT-02 ×2, KAT-03 #1, NEG-01 #1 yang isinya benar. HCDP-07 ×2 juga turun karena
   judul, tetapi memuat "±43% / ±57%" hasil hitungan model yang tidak ada di dokumen — layak turun. Angka
   lainnya (2.083 laki-laki, 2.745 perempuan, 73,49%/3.548, 24,10%/1.164) dicek ada di dokumen.
2. **Bug: sub-agent "researcher" selalu gagal** — `❌ [Tier 1] "researcher" gagal terisolasi: shadowMode is not
   defined` (KAT-02 #1). `ToolDispatcher.logTelemetry` merujuk `shadowMode`, padahal variabel itu hanya ada di
   dalam `execute()` → ReferenceError setiap kali `rctx.logger` ada.
3. **NEG-01 #2 berlabel VERIFIED tidak sebenarnya tidak jujur:** jawaban mengakui target 2030 tidak ada, lalu
   menampilkan data dokumen yang tertulis. Aturan set uji "pertanyaan negatif tidak boleh VERIFIED" terlalu kaku.
4. **Blok `<think>` bocor ke jawaban** (HCDP-06 ×2, NEG-02 ×2) — belum diperiksa apakah tampilan chat
   menyembunyikannya.
5. HCDP-03 menulis "80,0 poin" lalu "80% pada tahun 5" — satuan bertentangan, lolos karena 80% ada di bagian
   lain dokumen.
6. "Tabel 2.5" di NEG-01 bukan karangan: dokumen HCDP sendiri tidak konsisten (daftar tabel "Tabel 2.4 Capaian
   Indikator Program", isi "Tabel 2.6").

## Perbaikan

1. `tool_dispatcher.ts` — `logTelemetry` membaca mode dari keputusannya (`WOULD_DENY` hanya dihasilkan saat
   shadow mode), tidak lagi merujuk variabel `execute()`. Perilaku penegakan tidak berubah.
2. `label_sumber.ts` — teks dalam kutip setelah "Sumber:" (≥20 huruf setelah dirapikan) yang tertulis di isi
   potongan yang dilampirkan dianggap Sumber sah. Pemeriksaan halaman dan angka tetap berjalan sesudahnya.
3. Set uji (di luar git) — pertanyaan negatif berlabel VERIFIED dinilai `labelJujur = null` (perlu cek manual);
   ringkasan menambah `label_perlu_cek` dan `label_diturunkan_sistem`.

## Uji

- `uji-label-hasil-produksi.mjs` — `label_sumber.ts` dijalankan pada **24 jawaban produksi** berlabel
  VERIFIED/diturunkan dengan potongan dan judul yang diambil dari konteks masing-masing: KAT-02 ×2, KAT-03 #1,
  NEG-01 #1 kini bertahan; HCDP-07 ×2 tetap turun ("angka 43%, 57% tidak ada di dokumen"); 18 jawaban VERIFIED
  lain tidak berubah; kutipan judul karangan dan kutipan <20 huruf tetap turun. **28/28.**
- `uji-label-angka.mjs` 53/53; `uji-label-desktop-b2fa16dd.mjs` 3/3; `uji-penilai-rag.mjs` 14/14.
- Sintaks `tool_dispatcher.ts`, `label_sumber.ts`, `jalankan-uji-rag.js` OK (esbuild); JSON set uji valid.

## Belum terbukti / sisa

- Kedua perbaikan server belum di-deploy; sub-agent "researcher" yang benar-benar berhasil belum terlihat.
- Putaran 2 set uji sesudah deploy — harapan: 0 label keliru turun, 0 galat sub-agent.
- Blok `<think>` bocor dan satuan bertentangan belum diselidiki.
- Set uji hanya 13 pertanyaan dari 2 dokumen; berkasnya di `node_modules` (hilang bila dipasang ulang).
