# ROADMAP: TEMUAN TERBUKA TANPA RANCANGAN SENDIRI

**Tipe Dokumen:** Daftar sisa pekerjaan (temuan audit yang belum punya dokumen roadmap sendiri)
**Status:** ⏳ **3 temuan terbuka** (T1, T10, T11; T2–T9 ditutup) — masing-masing menunggu keputusan Owner
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
- **Status:** ⏳ dicatat, belum dirancang.

## T11 — `check-keys` bisa dipanggil dengan kunci anon (asal Item 85 Tahap 3, 2026-09-22)

- **Temuan (baca kode):** `verify_jwt` hanya mensyaratkan JWT sah — kunci anon publik lolos. Fungsi menguji kunci
  OpenRouter server dan menampilkan 8 huruf awalnya; siapa pun bisa memicunya (biaya kecil per panggilan).
- **Arah solusi:** cek pengguna (`auth.getUser`) + batasi ke Owner, atau hapus bila tak dipakai.
- **Status:** ⏳ dicatat.

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
