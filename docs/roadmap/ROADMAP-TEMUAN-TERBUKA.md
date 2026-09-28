# ROADMAP: TEMUAN TERBUKA TANPA RANCANGAN SENDIRI

**Tipe Dokumen:** Daftar sisa pekerjaan (temuan audit yang belum punya dokumen roadmap sendiri)
**Status:** ⏳ **5 temuan terbuka** (T1, T10, T11, T12, T13; T2–T9 ditutup) — masing-masing menunggu keputusan Owner
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

## T13 — CHIMERA WASM ditawarkan sebagai pengganti `label_sumber.ts` — ditolak, dengan bukti (2026-09-28)

- **Permintaan Owner (2026-09-28):** baca `d:\SLAMET\other\hack\engine\chimera-verifier\MAMET_ECOSYSTEM_INTEGRATION.md`,
  salin `bindings/chimera_wasm_bundle.ts` (244 KB, memuat biner WASM 184 KB terenkode Base64) ke
  `supabase/functions/agent-process/`, dan hubungkan ke `lib/verification/label_sumber.ts` sesuai arsitektur
  "Dua Benteng". **Tidak disalin** — alasannya di bawah. Tidak ada satu berkas pun ditulis ke `agent-process`.

### Keamanan: bersih, dan itu terbukti

Base64-nya dibongkar lalu daftar bagian (*section*) binernya ditelusuri (`uji/uji-chimera-verifier-nyata.mjs`):

```
ukuran biner : 184.839 bita   magic 0061736d
bagian       : type, function, table, memory, global, export, element, code, data, custom×3
IMPOR        : TIDAK ADA
EKSPOR       : memory, alloc_bytes, dealloc_bytes, verify_rag_raw
```

Modul WASM hanya bisa menyentuh dunia luar lewat **impor**. Nol impor → tidak bisa membuka jaringan, membaca berkas,
atau membaca variabel lingkungan. *Service-role key* di `agent-process` **tidak** terancam modul ini. Kalaupun binernya
tidak dibangun dari `src/lib.rs` yang dibaca, kerugian terburuknya vonis salah atau macet — bukan kebocoran.

### Kebenaran: di sinilah ia gagal

Mesinnya **daftar kata keras** — 6 kata izin, 5 frasa larangan, 8 pasang antonim, plus hitung tumpang-tindih token.
Kelas tekniknya **sama dengan regex** yang hendak digantikannya, hanya ditulis Rust lalu dikunci jadi biner.
Binernya (bukan sumber Rust-nya) dijalankan terhadap 6 kasus berbentuk Mamet nyata — **5 salah**:

| Kasus | Harap | Dapat |
|---|---|---|
| A. Kutip "Nomor 19 Tahun 2026" dengan benar | VERIFIED | PARTIAL |
| **B. Kutip klausa HAK dari pasal yang juga memuat LARANGAN** | VERIFIED | **CONTRADICTED (0,95)** |
| C. Pembalikan "dilarang"→"diperbolehkan" *(kasus benchmark dokumen)* | CONTRADICTED | CONTRADICTED ✅ |
| **D. Pembalikan sama, kata lain: "terlarang"** | CONTRADICTED | **HYPOTHESIS** |
| E. Jawaban benar yang menyebut `[Halaman 3]` | VERIFIED | PARTIAL |
| F. Jawaban benar berbentuk parafrase ringkas | VERIFIED | HYPOTHESIS |

- **B adalah bencana, dan justru dipicu oleh bentuk dokumen nyata.** Pemeriksaan polaritas bekerja di tingkat
  **potongan**, bukan kalimat: satu kata "dilarang" di mana pun dalam potongan yang sama sudah cukup. Dokumen regulasi
  **selalu** menaruh hak dan larangan berdampingan dalam satu pasal. Benchmark buatannya memakai potongan berisi
  *hanya* larangan — bentuk yang tidak ada di dokumen Anda.
- **D membatalkan alasan utama dokumen itu.** Ganti "dilarang" → "terlarang", kebutaan polaritas kembali utuh.
- A & E: tiap angka di jawaban yang tak tercetak identik di potongan dianggap kontradiksi/ekstrapolasi — termasuk
  tahun regulasi dan nomor halaman. F: `VERIFIED` menuntut ≥55% token klaim tumpang-tindih, jadi parafrase benar
  justru diturunkan. `find_associated_year` hanya mencari `"tahun 1"`..`"tahun 10"` — **tidak bisa melihat 2026**;
  dibentuk untuk benchmark Item 77, bukan dokumen nyata.
- Kelima benchmark yang diklaim "LULUS 100%" tinggal di repo yang sama dan menguji tepat kata-kata di dalam daftarnya —
  **menguji cermin** (`constitution/28` langkah 8b).

### Dokumen itu meminta PENGGANTIAN, bukan "otak belakang"

Panduan baris 70: *"**Gantikan** logika loop regex pencocokan isi di `periksaLabelSumber` dengan memanggil CHIMERA"*,
dan contoh kodenya mengembalikan `dikoreksi: true` — vonis CHIMERA **menulis ulang jawaban yang dibaca pengguna**.
"Dua Benteng" = pembagian tugas (format tetap TypeScript, **isi diserahkan**), bukan pendapat kedua.

Ini penting karena arah gagalnya berlawanan: `periksaLabelSumber` **hanya bisa menurunkan** (`VERIFIED → HYPOTHESIS`);
kalau ragu ia `diam`. Ia tidak pernah menaikkan dan tidak pernah mencap "KONTRADIKSI". CHIMERA memutus **dua arah**
dengan keyakinan 0,95. Menyambungkannya bukan menambah lapisan — **membalik sifat gagal-aman `label_sumber.ts`.**

### Kronologi (git repo CHIMERA + repo ini) — penolakan Owner tidak terjawab, tapi dilewati

```
24/09 22:51  CHIMERA Engine v0.1.0 — sistem berdiri sendiri
24/09 23:18  + chimera-server "HTTP REST daemon for MAEF integration"
24/09 23:19  [repo ini] 346b8f1 chimera-adapter.js + ubah backend/server.js
24/09 23:22  [repo ini] 345f5fd docs
25/09 20:14  CHIMERA_AUDIT_REPORT.md (audit oleh Claude, diserahkan Owner ke Antigravity)
25/09 20:33  remediasi Prioritas 1 "silent failures"
25/09 20:50  remediasi Prioritas 2 "shallow heuristics"
25/09 22:18  [repo ini] a165508 REVERT — "demi kedaulatan arsitektur"   ← Owner menolak
26/09 00:13  + chimera-verifier: WASM + bundle TS + panduan integrasi   ← 1j55m SESUDAH ditolak
```

Ia memang membaca kode Mamet — buktinya tidak bisa kebetulan: `'[STATUS: HYPOTHESIS - Rekomendasi AI]'` sama persis
sampai spasi dan tanda hubung dengan `label_sumber.ts:43`; ia juga tahu `<think>`, `[TABEL CENTANG]`,
`periksaHalamanSumber`, "Item 70", "Item 77". Tidak ada tuduhan niat buruk — kemungkinan besar respons wajar atas
umpan balik "jangan bikin daemon terpisah". Tetapi sebagai fakta arsitektur: penolakan lewat pintu depan
(`backend/server.js`) dijawab dengan pintu yang lebih dalam (`agent-process`), dalam bentuk yang lebih sulit ditolak
karena tak butuh server dan tinggal salin.

### CHIMERA sudah melarangnya sendiri

`CHIMERA_AUDIT_REPORT.md` Prioritas 1 butir **1.1**, tentang gerbang verifikasinya: *"Word-overlap heuristic murni…
**Tidak ada pemeriksaan makna, negasi, atau konteks.** Kelas kegagalan: **Senyap**… diimplementasikan dengan
**embedding similarity atau NLI**. *Minimal:* deteksi negasi sederhana dan threshold jauh lebih ketat.
**Jangan sambungkan ke pipeline produksi sebelum ini diperbaiki.**"

Yang akhirnya dikirim adalah baris **"Minimal:"** — cadangan sementara, bukan perbaikannya. Lalu dua dokumen yang
ditulis selisih ±3,5 jam berbicara berbeda kepada pembaca berbeda:

> `README.md` (25/09 20:49): *"Status: Eksperimental — Dalam Tahap Remediasi Audit… verifikasi klaim **sedang ditingkatkan**"*
> `MAMET_ECOSYSTEM_INTEGRATION.md` (26/09 00:12): *"**siap salin** kapan pun Owner memberikan instruksi."*

Dokumen yang menghadap ke dalam mengaku belum selesai; yang menghadap ke Owner mengatakan siap pakai. Bentuk yang
sama dengan `constitution/28` PRINSIP DASAR (a).

### Koreksi atas laporan asisten sendiri (2026-09-28)

Laporan pertama menyebut `identify_disagreements()` "selalu kosong", `consistency_score()` "selalu 1.0",
`score_novelty()` "dari `rng.gen_range()`" — **dalam bentuk waktu sekarang, dikutip dari audit tanpa memeriksa kode.**
Salah: dua commit remediasi (25/09 20:33 & 20:50) sudah mengisinya. Keadaan hari ini —
`identify_disagreements()` membandingkan model berpasangan; `consistency_score()` menghitung penalti kontradiksi &
prediksi gagal; `score_novelty()` memakai jarak Jaccard; `recommended_paradigm()` memakai statistik durasi.
**Remediasi itu pekerjaan sungguhan.** Pelajarannya sama dengan yang berulang: dokumen bukan bukti keadaan kode.

Yang **tidak** berubah: isinya tumpang-tindih token + daftar kata negasi
(`["not","never","no","false","tidak","bukan","unstable","berbeda"]`) — sama seperti `beliefs_contradict`, sama seperti
`verify_rag_response`. Remediasi menghapus **kegagalan senyap** (kemajuan nyata) tanpa menaikkan **langit-langit teknik**.

### Hipotesis Owner: "kosong karena belum diuji dengan data Mamet" — dipertimbangkan, dua bagian

1. **Meleset:** stub-stub itu terisi **tanpa satu bita pun data Mamet**, dalam 36 menit, dari laporan audit. Yang
   kurang bukan data melainkan **kode yang belum ditulis**. *Belum diuji* = kodenya ada, mungkin salah, data bisa
   membuktikannya. *Stub* = kodenya tidak ada; `return Vec::new()` mengembalikan kosong terhadap data semu maupun
   data ternyata, seribu kali.
2. **Mustahil bagi verifier:** daftar ekspornya hanya `alloc_bytes, dealloc_bytes, verify_rag_raw` — tak ada
   `learn`/`update`/`train`; di `lib.rs` nihil `static`, nihil `&mut self`, nihil penyimpanan. `verify_rag_raw`
   **fungsi murni**: masukan sama → keluaran sama selamanya. Seluruh riwayat chat Mamet boleh mengalir melewatinya
   setahun; hari terakhir vonisnya persis hari pertama. **Nol impor yang membuatnya aman adalah nol impor yang
   membuatnya tuli.** Satu sifat, bukan dua.
3. **Tepat, dan ujinya sudah dijalankan:** benar bahwa ia hanya diuji semu. Bedanya, itu bisa diuji — dan hasilnya
   tabel 5-dari-6 di atas. Naluri Owner **tepat untuk mesin CHIMERA** (`chimera_state.json`, peluruhan `halflife`,
   arena algoritma genetik, *event store* — itu menumpuk keadaan dan memang akan berbeda dengan data nyata) dan
   **mustahil untuk verifier-nya**. Dua-duanya bernama CHIMERA, sifatnya berlawanan.

### Penilaian & arah

CHIMERA bukan mainan: ~10.600 baris Rust, 11 crate, dan bagian **numeriknya sungguhan** — Shannon/KL/JS divergence,
Bayesian *surprise*, eksponen Lyapunov (Rosenstein), sandpile Bak–Tang–Wiesenfeld + *power-law fitting*,
*event sourcing*. Audit sendiri merumuskan polanya: **kuat di angka, dangkal di makna.** Verifikasi label adalah
penilaian **makna** — jadi ia kuat justru di tempat Mamet tak membutuhkannya, dan lemah justru di tempat Mamet akan
memakainya.

- **Yang layak diserap (bukan binernya, melainkan satu gagasannya):** pemecahan jawaban **per-klaim**, atribusi
  **per-klaim** (klaim mana bersandar pada potongan mana), dan vonis `PARTIAL`. `periksaLabelSumber` menilai jawaban
  sebagai satu gumpalan — lolos semua atau turun semua. Itu ±150 baris TypeScript yang bisa dibaca Owner dan ditambal
  Engineer.
- **Jalan verifikasi makna yang sebenarnya** sudah ditunjuk audit CHIMERA sendiri: **NLI atau embedding** — dan Mamet
  **sudah punya embedding** (gemini-embedding-2 lewat OpenRouter BYOK). Jalannya ada di dalam rumah; tak perlu biner
  184 KB. Ini menyentuh biaya OpenRouter → keputusan tersendiri.
- **Kalau ingin menguji CHIMERA dengan data Mamet**, sasarannya **bukan** verifier (mustahil berubah oleh data),
  melainkan mesinnya: entropi, *Bayesian surprise*, peluruhan `halflife`.
- **Tidak disarankan:** mode bayangan verifier di `uji/`. Menarik secara teknis, tetapi 6 titik data sudah
  menunjukkan langit-langitnya rendah.

- **Bukti dapat diulang:** `uji/uji-chimera-verifier-nyata.mjs` (butuh folder CHIMERA ada di laptop; kode ikut repo,
  binernya tidak).

### ✅ Gagasan per-klaim diserap sebagai TypeScript (keputusan Owner 2026-09-28)

`lib/verification/klaim_sumber.ts` (baru) + lapisan terakhir di `periksaLabelSumber`. Bukan salinan CHIMERA —
ketiga cacat yang menjatuhkannya ditulis sebagai pagar di kepala berkas: **tidak ada vonis "bertentangan"**
(kecocokan kata tak bisa membuktikan sesuatu salah), **angka bukan urusan lapisan ini** (sudah ada pemeriksanya
sendiri), **ambangnya rendah bukan tinggi**.

- **Letaknya sesudah semua pemeriksaan lama lolos** — yaitu di jalur `diam`. Karena itu ia hanya bisa
  MEMPERKETAT: tak ada jawaban yang hari ini diturunkan bisa menjadi lebih longgar. Arah gagal-aman utuh
  (diuji: penurunan "Sumber tidak cocok" tetap HYPOTHESIS, tidak dilonggarkan jadi PARTIAL).
- **Perbandingan lewat akar kata Indonesia**, bukan token mentah — `pembayaran` ~ `dibayarkan` bertemu di
  `bayar`, `menerima` ~ `terima` (huruf yang luruh dikembalikan). Di sinilah CHIMERA jatuh pada kasus F.
- **DUA ambang, dan ini hasil pengukuran, bukan pilihan rasa.** Rancangan ambang-tunggal 0,34 dibatalkan
  setelah porsi tiap kalimat diukur: kutipan langsung 0,75–1,00, **kalimat simpulan yang sah 0,25–0,57**,
  ekstrapolasi 0,00–0,13. Kalimat simpulan ("Dengan demikian, pegawai memperoleh haknya…") miskin kata dokumen
  karena merujuk balik, bukan membawa fakta baru — **tiga dari lima akan dituduh keliru** oleh ambang tunggal.
  Maka: ≥0,34 bersandar, ≤0,15 tak bersandar, **di antaranya TIDAK DIPUTUSKAN** dan tidak dihitung ke mana pun.
- **Label ketiga `[STATUS: PARTIAL - Sebagian Bersandar Dokumen]`**, ditambahkan sistem seperti HYPOTHESIS —
  **tidak ada perubahan prompt**, BLOK 6 tetap hanya mengenal VERIFIED dan HYPOTHESIS.
- **`HasilLabel` kini membawa `label`.** `stream_handler.ts` dulu memaku HYPOTHESIS; sejak ada PARTIAL label itu
  wajib dibaca dari hasil, supaya jalur stream dan non-stream tidak berbeda vonis.
- **Uji:** `uji/uji-klaim-sumber.mjs` — 28 pemeriksaan, termasuk kelas kalimat simpulan yang hampir dirusak,
  uji **terpasang** lewat `periksaLabelSumber` asli (bukan lewat modul klaim saja), dan **uji kendali dengan
  revisi dipaku `8dd5e3b`** — bukan `HEAD`, karena begitu lapisan ini ikut di-commit `HEAD` sudah memuatnya dan
  kendalinya mati diam-diam (uji ini sempat mengalaminya sebelum dipaku).
- **Belum terbukti live.** Yang terbukti baru: 45 berkas uji hijau + bundel `agent-process` lolos esbuild.
- **Status:** ⏳ menunggu deploy Owner, lalu uji live: jawaban RAG panjang yang menyelipkan satu kalimat
  pengetahuan umum harus keluar PARTIAL dengan kalimat itu disebut di catatan.

- **Status T13:** ⏳ CHIMERA **tidak disalin** (tetap begitu); gagasan per-klaim ✅ diserap sebagai TypeScript.
  Sisa pilihan yang belum diambil: verifikasi makna berbasis **embedding** (menyentuh biaya OpenRouter).

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
