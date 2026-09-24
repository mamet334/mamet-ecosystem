# ROADMAP: TEMUAN TERBUKA TANPA RANCANGAN SENDIRI

**Tipe Dokumen:** Daftar sisa pekerjaan (temuan audit yang belum punya dokumen roadmap sendiri)
**Status:** ⏳ **4 temuan terbuka** (T1, T10, T11, T12; T2–T9 ditutup) — masing-masing menunggu keputusan Owner
**Tanggal:** 2026-09-17 (dipindah dari INDEX-ROADMAP Item 33, 44, 48, 49, 50 saat perampingan)
**Aturan:** temuan yang dikerjakan dan tumbuh besar pindah ke dokumen roadmap sendiri; yang selesai dicatat di
changelog lalu barisnya diberi ✅ di sini.

Semua temuan di bawah **diperiksa ulang terhadap kode/database 2026-09-17**. Riwayat lengkapnya ada di
[`INDEX-ROADMAP-ARSIP-2026-09-17.md`](./INDEX-ROADMAP-ARSIP-2026-09-17.md) (nomor item asal).

---

## T1 — Jalur Lite: `web_search` & `rag_search` tanpa aturan izin per-tool (asal Item 33, 2026-09-09)

- **Temuan:** `agent-process` `lib/request/policy_middleware.ts` hanya punya aturan spesifik untuk
  `cron_manager` (`canUseAutomation`) dan `knowledge_manager` (`canWriteKnowledge`) — aturan `file_analyzer`
  ikut terhapus bersama jalur desktop lama (Item 85). `web_search`/`rag_search` lolos selama
  `toolsEnabled`. Dicek 2026-09-17: masih benar.
- **Dampak:** hanya jalur Lite (ws-lite desktop & mametlite.vercel.app, pengguna eksternal): tidak ada rem
  biaya/latensi pencarian web. Bukan kebocoran data (RAG terisolasi per pengguna).
- **Arah solusi:** tabel `tool → flag policy` (data-driven) menggantikan `if` per tool, lalu flag baru
  mis. `canUseWebSearch` per mode.
- **Keputusan Owner (2026-09-09):** di luar cakupan saat itu ("tidak perlu untuk ws lite karena ada mametlite").
- **Pemeriksaan ulang 2026-09-21 (baca kode, belum diuji live) — kekhawatiran awal terbalik:**
  - **Pencarian web tidak memakai uang/token Owner.** `plugins/researcher.ts`: (1) Google Search grounding **hanya
    dengan kunci Gemini BYOK pengguna**; (2) bila tidak ada → RSS Bing/Google News **gratis tanpa kunci**. Model
    perangkum memakai kunci pengguna. Sisa risiko pencarian web: waktu tunggu & IP server dibatasi Bing bila berlebihan.
  - **Risiko sebenarnya: daftar sub-agent ditentukan klien.** `plugins/registry.ts:39` menyaring sub-agent untuk
    Coordinator dari `tools` kiriman **klien**; `tools` kosong = **semua** sub-agent ditawarkan. Server hanya
    memblokir `cron_manager` (`policy_middleware.ts`; aturan `knowledge_manager` ikut terhapus bersama pluginnya di T9). `plugins/youtube_analyst.ts:34`
    memakai **token Apify server (milik Owner)** → pengguna login mana pun (termasuk eksternal Mametlite) secara teori
    bisa memicu pemakaian Apify Owner dengan mengirim `tools` lain. Mametlite resmi menyaring `tools` di klien —
    bukan pengaman.
- **Arah disetujui Owner (2026-09-21):** daftar izin sub-agent **di server** per asal aplikasi — Mametlite hanya
  `rag_search`, `researcher`, `deep_research`; permintaan lain dibuang; `tools` kosong ≠ semua. Sub-agent yang
  memakai token server (`youtube_analyst`, dan yang sejenis — periksa `scraper`, `communicator`, `shopee_ninja`,
  `coder`) hanya dari desktop Owner. Menggantikan arah lama (`canUseWebSearch` per mode).
- **Urutan (keputusan Owner):** dicatat dulu; dikerjakan **sesudah Owner mengganti token Apify** (sisa T7).
  Pembuktian nanti: permintaan Mametlite dengan `tools: ['youtube_analyst']` / `tools: []` harus tidak menawarkan
  sub-agent itu (log Coordinator), sementara desktop tetap bisa.
- **Status:** ⏳ arah disetujui, menunggu penggantian token Apify (T7).

## T2 — ✅ Lima komponen dasbor yatim (asal Item 48, 2026-09-10)

- **Temuan:** tak diimpor/dipasang di mana pun (dicek 2026-09-17, 0 pemakai):
  `MemoryHealthDashboard.jsx`, `MonitoringDashboard.jsx`, `ObservabilityDashboard.jsx`, `EngineerDashboard.jsx`,
  `WorkDashboard.jsx`, ditambah `ShopeeDashboard.jsx` (kemungkinan peninggalan). `BillingDashboard` sudah dipasang
  (commit `119bd09`). `Login.jsx` **bukan** yatim (3 rujukan) — koreksi atas catatan lama.
- **Peringatan dari pemasangan BillingDashboard:** jangan pasang layar berisi angka basi (batas hardcode $0,50
  vs batas nyata $3) — setiap dasbor wajib memakai sumber angka yang sama dengan server.
- **Keputusan Owner yang dibutuhkan:** per komponen — pasang (dengan angka diperiksa) atau hapus.
- **Keputusan Owner (2026-09-21):** hapus semua.
- **Status:** ✅ keenamnya dihapus 2026-09-21 (1.364 baris; `ShopeeDashboard` membaca tabel `shopee_queue` yang sudah tidak ada; build lolos) — [log](../project-memory/changelog/2026-09-21-t2-hapus-dasbor-yatim.md).

## T3 — ✅ Rute mati `/api/agent/process` di `backend/server.js` (asal Item 49, 2026-09-10)

- **Temuan:** rute masih ada (`backend/server.js:309`), tanpa pemanggil di frontend maupun mametlite; memetakan ke
  model OpenRouter yang sudah hilang (`google/gemini-2.0-flash-exp:free`) dan mengabaikan model pilihan pengguna.
  `/api/chat` yang dipakai Engineer bersih. `self_healing.ts` dari item yang sama sudah dihapus (`c902361`).
- **Risiko:** tidak ada selama tak disambungkan; menggigit bila dipakai ulang tanpa dibaca.
- **Keputusan Owner (2026-09-21):** hapus.
- **Status:** ✅ dihapus 2026-09-21 (1.170 baris; tanpa pemanggil, tanpa fungsi bantu yatim; `/api/chat` tidak disentuh) — [log](../project-memory/changelog/2026-09-21-t3-hapus-rute-mati-agent-process.md). Sisa: bukti live Engineer `/api/chat` sesudah backend dinyalakan.

## T4 — ✅ `match_documents` bisa dieksekusi `anon` (asal Item 50, 2026-09-10)

- **Temuan:** `has_function_privilege('anon', match_documents(...), 'execute') = true` (dicek 2026-09-17).
  Risiko rendah: fungsi `SECURITY INVOKER` sehingga RLS `document_chunks`/`documents` tetap berlaku, tetapi hak
  itu tampaknya tidak disengaja.
- **Arah solusi:** `REVOKE EXECUTE … FROM anon` lewat migrasi (diajukan ke Owner; pastikan tidak ada pemanggil
  tanpa login — mametlite memanggil dengan sesi).
- **Status:** ✅ ditutup 2026-09-17 — migrasi `20260917124719_revoke_anon_match_documents` (anon false,
  authenticated/service_role tetap). [log](../project-memory/changelog/2026-09-17-t4-t6-hak-anon-dan-kueri-verifikasi.md)

## T5 — ✅ Hapus dokumen di mametlite: potongan ikut terhapus? (asal Item 91, 2026-09-17)

- **Temuan awal:** mametlite hanya menghapus baris `documents`; cascade tidak terlihat di `supabase/migrations/`.
- **Dicek di DB live (baca-saja, 2026-09-17):** `document_chunks_document_id_fkey` ber-`ON DELETE CASCADE`;
  potongan yatim = 0. Tidak perlu perubahan.
- **Status:** ✅ ditutup — [changelog](../project-memory/changelog/2026-09-17-hapus-dokumen-cek-baris-terhapus.md).

## T6 — ✅ `fetchExecutionTrace` meminta kolom `verification_audit_logs.metadata` yang tidak ada (2026-09-17)

- **Temuan:** `frontend/src/core/runtime/services/ExecutionTraceService.js:610–615` memilih kolom `metadata` dan
  menyaring `metadata->>trace_id` pada `verification_audit_logs` → **400** `42703 column … metadata does not exist`
  (terlihat di console desktop Owner). Kolom tabel live: `id, created_at, timestamp, provider, model, request_id,
  user_id, decision, status, score, execution_time_ms, checks, failures, source_trace, confidence, evidence,
  confidence_score, review_confirmed` — tanpa `metadata`.
- **Dampak:** non-fatal (ditangkap sebagai `console.warn`), tetapi bagian verifikasi di jejak eksekusi **selalu
  kosong** dan tiap pemanggilan menambah satu request gagal.
- **Arah solusi (keputusan Owner):** sesuaikan kueri ke kolom yang ada (mis. `request_id`/`source_trace` bila
  memang memuat trace id — perlu dicek isinya dulu), atau tambah kolom `metadata` lewat migrasi bila penulisnya
  memang berniat mengisinya.
- **Catatan 2026-09-17:** isi kolom sudah dicek — `request_id` selalu `null` (398/398) dan `source_trace` berisi
  teks jejak sumber jawaban, bukan trace id; penulis aktif (`verification_service.ts`) tidak pernah menulis trace id.
  Preseden 2026-09-08 (`useDashboardData.js`): kolom `metadata` dibuang dari kueri tanpa mengubah skema.
- **Status:** ✅ ditutup 2026-09-17 — kueri verifikasi dihapus dari `ExecutionTraceService.js` (tak ada kolom
  pencocok trace id); build lolos. **Sisa kecil:** pastikan 400 hilang dari konsol sesudah build Vercel / reload
  desktop. Menampilkan hasil verifikasi di jejak butuh penulis menyimpan trace id (belum diminta).
  [log](../project-memory/changelog/2026-09-17-t4-t6-hak-anon-dan-kueri-verifikasi.md)

## T7 — ✅ Kunci API tersimpan di `agent_logs.metadata` (2026-09-17)

- **Temuan:** `audit_subscriber.ts` & `lifecycle_subscriber.ts` menyalin `event.payload` (berisi `rctx`/`env`) ke
  metadata log → 698 baris berisi kunci OpenRouter, Apify, Google, Groq (30 Juni – 17 September); terbaca pemilik
  di dasbor browser dan ikut `backup-export`.
- **Selesai:** penyaring `saring_rahasia.ts` di `persistTelemetryLog` (live v458, terbukti di log chat), 698 baris
  dibersihkan dengan izin Owner, pindai ulang seluruh DB = 0.
  [log](../project-memory/changelog/2026-09-17-kunci-api-bocor-di-agent-logs.md)
- **Sisa (Owner):** ganti kunci OpenRouter & token Apify (+ secret Supabase); cabut kunci Google/Groq lama bila
  masih aktif di tempat lain.

---

## T8 — Perintah PowerShell disusun dengan menyisipkan alamat mentah (asal Item 85 Tahap 0, 2026-09-21)

- **Temuan:** `frontend/src/core/runtime/services/CommandRegistry.js` (sekitar baris 202–240: `readFile`,
  `createFolder`, `deleteFolder`, `deleteFile`, `moveFile`, dst.) menyusun perintah
  `powershell -Command "… -Path '${args.path}'"` lalu menjalankannya lewat `run-terminal-command`. Alamat yang memuat
  tanda petik tunggal (`'`) keluar dari tanda kutip dan bisa menambah perintah PowerShell lain.
- **Jalur pemicu:** tombol perintah Engineer di `ConversationEngine.jsx` (`handleRunCommand` →
  `AssistantService.runCommand` → `CommandRegistry.executeConfirmed`) — sesudah pengguna mengklik. Nilai `args` berasal
  dari jawaban model, jadi dokumen/berkas yang dibaca model bisa memengaruhinya.
- **Risiko:** nyata tetapi sempit (butuh klik pengguna; desktop Owner saja). Belum diuji live — hasil baca kode.
- **Arah solusi:** jangan menyusun perintah dari teks — operasi berkas lewat `fs` Node di proses utama (atau
  argumen terpisah `execFile`), dan bila folder kerja aktif, lewat `pagarFolder.cjs` (Item 85).
- **Keputusan Owner (2026-09-21):** dicatat, belum diperbaiki.
- **Pemeriksaan ulang 2026-09-22:** injeksi ternyata tak tercapai — tombol mengirim fungsi sebagai `args`, perintah
  nyata selalu "tidak terdaftar" (tombol Engineer rusak diam-diam). Keputusan Owner: **A** hapus jalur perintah-teks
  (`CommandRegistry`, `run-terminal-command`, `edit-file-surgical`) + **B1** tombol lewat mesin `folder_run` dengan
  **profil peran** (Engineer: repo Mamet, git baca saja, tanpa pemasang paket, 180 s). Ikut ditemukan & diperbaiki:
  aturan Engineer tak sampai ke model sejak Wave 5.4; pesan hasil mesin jadi kueri Web/RAG/memori.
- **Status:** ✅ ditutup 2026-09-22 — [log](../project-memory/changelog/2026-09-22-t8-engineer-perintah-tanpa-shell.md).

## T10 — Sumber pengetahuan Engineer (asal T8, 2026-09-22)

- **Temuan (live):** RAG Engineer (scope CORE) mencari di SEMUA space pengguna — "tampilkan 5 commit terakhir"
  memasukkan 4–7 potongan dokumen kepegawaian (skor 0,56–0,66) ke prompt Engineer. Web desktop berorientasi berita
  (Google News, Antara, Wikipedia, DuckDuckGo) — untuk pertanyaan teknis hasilnya meleset.
- **Keputusan Owner (2026-09-22):** RAG & Web tetap menyala di Engineer (pengetahuan internal + dunia terkini); Memory
  mati di Engineer.
- **Arah solusi:** space pengetahuan khusus Engineer atau ambang kemiripan lebih ketat untuk mode ENGINEER; sumber web
  teknis (dokumentasi resmi, npm registry, GitHub release).
- **Rancangan (2026-09-22):** Tahap 1 RAG Engineer hanya dari space "Pengetahuan Engineer" · Tahap 2 web teknis (npm,
  PyPI, GitHub releases, DuckDuckGo; tanpa sumber berita) · Tahap 3 isi space dengan ADR/roadmap/changelog.
- **Status:** ⏳ Tahap 1 ✅ live; uji Engineer TUGAS-01 menemukan & memperbaiki jalur patch (checkpoint git stash,
  pemeriksa format, patch palsu, muat ulang Vite) — [log](../project-memory/changelog/2026-09-22-t10-engineer-pengetahuan-dan-jalur-patch.md).
- **TUGAS-01 ✅ live (2026-09-23):** patch Engineer tepat **1 baris komentar** di `SkillGuardService.js` (berkas utuh
  96 baris, `git stash list` kosong, checkpoint berisi isi asli untuk Undo, verifikasi server confidence A/100).
- **Temuan sampingan dari uji itu — sudah diperbaiki & terbukti live:** riwayat chat hilang setiap muat ulang (effect
  sinkronisasi menghapus penunjuk chat sebelum effect pemulihan membacanya), `loadChat` menyamakan "gagal baca" dengan
  "chat hilang", pesan sistem melahirkan chat siluman, dan membuka chat lama menaikkan `updated_at` sehingga urutan
  riwayat melompat — [log](../project-memory/changelog/2026-09-23-riwayat-chat-hilang-setelah-muat-ulang.md).
- **Prosedur kerja Engineer (2026-09-23):** `constitution/28_PROSEDUR_KERJA_ENGINEER.md` (12 langkah) + RULE 0 di
  `engineer_context.ts` + tiga penjaga kode (`engineer/ProsedurEngineer.js`: perintah berulang, petunjuk `git show
  HEAD:`, wajib mengumumkan tugas + kutipan sumber) —
  [log](../project-memory/changelog/2026-09-23-prosedur-kerja-engineer.md).
- **TUGAS-02 (live, `gpt-4o-mini`):** lulus mengumumkan tugas, membaca berkas, dan patch 1 baris; **gagal**
  menjalankan `git grep` pembuktian dan melaporkan temuan. Engineer mampu mengikuti prosedur, belum mampu menilai.
- **TUGAS-03 (live):** menolak mem-patch CORE IMMUTABLE atas kesadaran sendiri ✅, tetapi penjelasan perbaikannya
  salah letak; peringatan Vite diperbaiki Owner (`@vite-ignore`, terbukti dengan uji kendali).
- **TUGAS-04 ✅ live (2026-09-23):** dengan `gpt-4o-mini` hanya penjelasan umum; dengan `deepseek-v4-pro-0813`
  **11 dari 12 klaim terbukti** (saya jalankan `detectIntent` asli pada tiap contoh), menemukan force-check baris 41
  dan dua kelas cacat di luar kunci jawaban, usulan perbaikannya tepat sasaran —
  [log](../project-memory/changelog/2026-09-23-uji-engineer-tugas04-dan-pagar-perintah.md).
- **Kesimpulan uji model:** batasnya memang di model untuk penilaian & kehati-hatian; prosedur yang sama dipakai
  model kuat sebagai alat (menolak tugas yang tak ada di sumber, verifikasi alamat sebelum membaca, ganti cara sambil
  menyebut RULE 0.4). Biaya satu sesi ±$0,03.
- **Belum diperbaiki (Engineer tidak siap dipakai dari aplikasi terpasang):** `PROJECT_ROOT` menunjuk folder
  instalasi di build `npm run dist` → `git` gagal dan patch akan menulis ke folder instalasi; setelan & riwayat
  terpisah antara `mamet://app` dan `http://localhost:5173` (model yang diganti di satu sisi tidak berlaku di sisi
  lain — sempat membuat uji banding model tidak sah tanpa disadari).
- **Label (2026-09-23) ✅ kode selesai, bukti live menunggu deploy:** keluaran perintah Engineer yang Owner setujui
  kini sumber sah (`sumberDariKeluaranTerminal` + blok kontrak `[LABEL UNTUK KELUARAN PERINTAH ENGINEER]`); perintah
  yang ditolak tetap bukan sumber dan pemeriksaan angka tetap jalan —
  [log](../project-memory/changelog/2026-09-23-label-sumber-keluaran-perintah.md).
- **Lanjutan jangka panjang:** rancangan [`ROADMAP-ENGINEER-MANDIRI.md`](./ROADMAP-ENGINEER-MANDIRI.md) (disetujui
  Owner 23 September): lingkaran baca-saja beranggaran, mesin uji klaim, ingatan temuan, antrean kerja, dan Engineer
  di aplikasi terpasang.
- **Sisa:** tombol Undo belum teruji live sesudah perbaikan · perbaikan `IntentClassifier` sesuai temuan Engineer
  belum dikerjakan · Tahap 2 (web teknis) & Tahap 3 (isi space) belum.

## T11 — `check-keys` bisa dipanggil dengan kunci anon (asal Item 85 Tahap 3, 2026-09-22)

- **Temuan (baca kode):** `verify_jwt` hanya mensyaratkan JWT sah — kunci anon publik lolos. Fungsi menguji kunci
  OpenRouter server dan menampilkan 8 huruf awalnya; siapa pun bisa memicunya (biaya kecil per panggilan).
- **Arah solusi:** cek pengguna (`auth.getUser`) + batasi ke Owner, atau hapus bila tak dipakai.
- **Pemutakhiran 2026-09-24 — bobotnya naik, bukan temuan baru.** Saat T11 ditulis, risikonya diperkirakan
  sebagai "siapa pun yang punya kunci anon". Sekarang bisa dipastikan kunci itu **tertulis di repositori publik**:
  ```
  .github/workflows/build.yml:37   VITE_SUPABASE_ANON_KEY=eyJhbGciOi…
  repo: github.com/mamet334/mamet-ecosystem — visibility PUBLIC
  ```
  **Ini BUKAN kebocoran.** Kunci anon memang dirancang publik — ia ikut terbundel di frontend, jadi siapa pun
  bisa mengambilnya dari sana; yang melindungi data adalah RLS (sudah ditutup 22 September,
  `rls_tutup_baca_semua`), bukan kerahasiaan kuncinya. Yang berubah hanyalah **kemudahan jalan masuknya**:
  memicu `check-keys` tidak lagi menuntut seseorang membongkar bundel aplikasi, cukup membuka GitHub. Setiap
  panggilan menguji kunci OpenRouter server dan menampilkan 8 huruf awalnya, dan ada biayanya.
  Ditemukan saat memindai repo setelah Owner menyambungkan GitHub untuk kredit sesi cloud — bukan dari audit
  terjadwal. Konteks sambungan itu sendiri: repo ini memang sudah publik, jadi sambungannya tidak menambah
  paparan repo ini; yang perlu Owner periksa sendiri adalah apakah izin GitHub mencakup repo **privat** lain
  (GitHub → Settings → Applications → Authorized GitHub Apps).
- **Status:** ⏳ dicatat; bobot dinaikkan 2026-09-24, menunggu keputusan Owner.

## T12 — Membaca berkas = mengirimnya keluar, dan tak ada satu pun pemberitahuan (diskusi Owner, 2026-09-24)

- **Temuan (baca kode):** isi berkas yang dibaca tidak berhenti di layar. `buildPatchPrompt` mengirim isi berkas
  ke model; alat folder kerja (`alatFolder.cjs`, batas 60 KB / 400 baris per berkas) mengembalikan isinya ke
  renderer lalu masuk prompt; keluaran perintah Engineer yang Owner setujui juga ikut. Semuanya berakhir di
  OpenRouter — dan `ai_adapter.ts` sendiri mencatat bahwa **satu nama model bisa dilayani beberapa penyedia hulu**
  (`penyedia=` di log token, Item 73), jadi tujuannya tidak selalu pihak yang sama.
  Diperiksa 2026-09-24: **tidak ada satu pun pemberitahuan** di jalur folder kerja maupun jalur Engineer.
- **Kenapa ini penting justru setelah aturan izin dirumuskan:** Owner merumuskan batas izin sebagai
  *"yang sulit ditarik kembali"* — hapus kode, pakai saldo, tulis berkas. Dengan ukuran itu, membaca berkas yang
  **belum pernah keluar dari laptop** masuk kategori yang sama: setelah terkirim, tidak bisa ditarik. Jadi batas
  yang benar bukan "baca vs tulis", melainkan **"tetap di laptop ini vs keluar dari laptop ini"**.
- **Yang TIDAK termasuk masalah:** dokumen Kepbup & data ASN sengaja diunggah Owner ke RAG — keputusan sadar,
  bukan kebocoran. Kunci API tidak pernah ikut (disaring `saring_rahasia.ts`, tidak pernah masuk prompt).
  Yang belum pernah diperiksa: folder mana saja yang pernah ditunjuk lewat tombol 📁.
- **Konteks kedaulatan data (Item 93):** Owner sudah memisahkan dua ketergantungan. **Penyimpanan** sudah merdeka —
  cadangan penuh terbukti bisa dipulihkan ke Postgres lokal (Tahap 1–2 ✅, 22 Sep). **Komputasi** tidak, dan tidak
  realistis: bukti dari uji kita sendiri, `gpt-4o-mini` (remote, jauh lebih kuat daripada model yang muat di laptop)
  mengerjakan tugas yang salah tiga kali, sementara `deepseek-v4-pro` menolak tugas yang tak ada di sumbernya.
  Model lokal bukan kompromi — ia membuang kemampuan yang membuat Engineer berguna. Jadi pertanyaannya bukan
  "bagaimana 100% privat", melainkan **"isi apa yang diterima untuk dikirim, dan apa imbalannya"** — yang selama ini
  sudah Owner jawab dengan baik, hanya belum tertulis.
- **Arah solusi (tidak menambah klik yang sudah ada, hanya menambah kalimat pada klik yang memang dilakukan):**
  1. Saat folder kerja BARU dipilih: satu baris di dialognya — isi berkas yang dibaca akan ikut dikirim ke penyedia model.
  2. Saat Engineer hendak membaca alamat di luar akar repo: alamatnya ditandai di dialog izin yang sudah ada.
  3. Daftar folder yang boleh dibaca ditetapkan sekali; di luar itu ditolak dengan pesan jelas, bukan diam-diam.
     Ini mengubah privasi dari "bergantung pada ingatan" menjadi "dijaga kode" — 24 September terbukti bahwa
     ingatan tidak cukup, termasuk ingatan asistennya.
- **Beririsan dengan Tahap 5** (`ROADMAP-ENGINEER-MANDIRI.md`): momen Owner memilih akar repo di aplikasi terpasang
  adalah tempat alami menetapkan batas "yang boleh dibaca". Sebaiknya dikerjakan bersama, bukan terpisah.
- **Status:** ⏳ dicatat atas permintaan Owner. Belum dikerjakan.

## T9 — Sub-agent `knowledge_manager` rusak & ikut dipanggil Coordinator (asal Item 92 Tahap 3, 2026-09-21)

- **Temuan (uji live chat Data Tabel, 2026-09-21):** untuk pertanyaan data pegawai, Coordinator menugaskan
  `knowledge_manager` (`plugins/knowledge_manager.ts`). Dua jalurnya gagal:
  - statistik: `supabase.rpc('get_workspace_stats', …)` (baris ±189) → "Could not find the function
    public.get_workspace_stats" — fungsi itu tidak ada di migrasi mana pun;
  - simpan: `evaluateKnowledgeQuality(…, env.GROQ_API_KEY, …)` (baris ±128) → "Groq API Key tidak tersedia" — kunci
    Groq server sudah dihapus 2026-09-15 (fokus OpenRouter). Sub-agent itu **mencoba MENYIMPAN pengetahuan** dari
    pertanyaan data; gagal hanya karena kunci tak ada.
- **Dampak:** pesan galatnya masuk konteks jawaban → model menulis "tidak bisa menjawab" / "API key tidak tersedia" +
  label INSUFFICIENT. Untuk Data Tabel sudah diatasi (bila data tabel berhasil, Coordinator & sub-agent dilewati);
  pertanyaan lain yang memicu `knowledge_manager` tetap kena.
- **Arah solusi (keputusan Owner):** perbaiki (buat `get_workspace_stats` + pindahkan filter mutu ke OpenRouter) atau
  cabut `knowledge_manager` dari daftar sub-agent Coordinator. Perlu dicek juga apakah menyimpan pengetahuan dari chat
  memang dikehendaki.
- **Tambahan uji live (sesudah dicatat, 2026-09-21):** juga merusak jawaban RAG biasa (pertanyaan Kepbup → "tidak ada
  dokumen Kepbup", HYPOTHESIS, walau RAG menemukan 2 potongan tepat) dan **membuat knowledge_space bernama pertanyaan
  pengguna** (08:59, kosong) — Research App memilih space terbaru sebagai bawaan. Tiga space "Observasi Pasar…" (Juni)
  kemungkinan lahir dengan cara yang sama; salah satunya kini berisi 222 dokumen Kepbup.
- **Langkah darurat (keputusan Owner 2026-09-21):** `knowledge_manager` DICABUT dari daftar sub-agent (`plugins/registry.ts`)
  & aturan Coordinator "MACRO QUERY → knowledge_manager" diganti; space kosong dihapus (0 dokumen/chat/memori/ringkasan).
  Sisa: `workspace_guardian.ts` masih menyebut knowledge_manager di arahan prompt; nasib plugin (perbaiki atau hapus).
- **Terbukti sesudah deploy v465 (2026-09-21):** pertanyaan Kepbup kembali VERIFIED dari 2 potongan tepat; tidak ada
  space baru. (Uji hanya chip RAG → Coordinator tidak berjalan; plugin tetap tak bisa dipilih karena keluar dari daftar.)
- **Sumber masalah di UI ikut ditutup (2026-09-21, [log](../project-memory/changelog/2026-09-21-workspace-research-app.md)):**
  Research App kini bisa membuat / mengganti nama / menghapus (bila kosong) workspace, dan mengingat pilihan terakhir —
  bukan lagi otomatis space terbaru. Space Kepbup dinamai "Kepbup OKU 2025"; dua space "Observasi Pasar…" kosong dihapus
  Owner dari UI.
- **Keputusan Owner (2026-09-21): HAPUS.** Plugin, filter mutu Groq, penyuntikan di `workspace_guardian.ts`, dan aturan
  di `policy_middleware.ts` dihapus; bukti: 0 dokumen tersimpan dari chat, 0 ringkasan workspace. Live sesudah deploy: tak
  ada `knowledge_manager`, tak ada workspace baru — [log](../project-memory/changelog/2026-09-21-t9-hapus-knowledge-manager.md).
- **Status:** ✅ ditutup. Gagasan (tidak dikerjakan): "simpan jawaban ke workspace" sebagai tombol UI berkonfirmasi, bukan keputusan AI.

## Ditutup saat perampingan (tidak perlu dikerjakan)

- **Item 44 (2026-09-09) — tiga sisa temuan kecil:** kunci Gemini #0 403 → kunci server Gemini dihapus (Item 82);
  `prompt=20451t` → penyebab ditemukan & diperbaiki (Item 65 Kasus A, Item 66 prompt dobel −50%); pesan Owner
  terkirim dua kali → terkonfirmasi, efeknya sepanjang pertanyaan saja (Item 66).
