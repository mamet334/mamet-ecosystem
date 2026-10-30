# 30 Oktober 2026 — K5 / T1: izin sub-agent di server, pagar alamat di setiap pengalihan, token Apify hanya pemilik

Hasil model ancaman garis dasar (skill `openai-security-threat-model`, 30 Okt — laporan sengaja TIDAK di repo publik
sebelum ditutup). Dikerjakan atas keputusan Owner: butir 1–3; **semua sub-agent tetap tersedia** (pagar, bukan
pemangkasan); pendaftaran akun Supabase **tetap menyala** (untuk pengembangan).

## Temuan

- **Pendaftaran akun terbuka** → siapa pun bisa mendapat token `authenticated` lewat API Auth dengan kunci anon publik
  (Mametlite tak punya tombol daftar, tetapi API-nya tetap menerima). "Wajib masuk" tidak menghalangi siapa pun.
- **`tools` klien hanya menyaring daftar yang DITAWARKAN** ke Coordinator (`getPluginPromptList`); nama apa pun yang
  dikembalikan model dijalankan `tool_subscriber` lewat `getPluginByName`. Batas alat Mametlite hanya di klien.
  Klien sah hanya pernah meminta `researcher` (`web_search`) dan `deep_research` — 9 sub-agent lain hanya tercapai lewat
  permintaan rakitan.
- **`communicator`** mengirim permintaan HTTP sembarang (URL, metode, header, isi) buatan model tanpa pagar alamat;
  **`scraper`** mengikuti pengalihan tanpa cek; **`proxy_fetch`** (ditutup 30 Okt pagi) memeriksa alamat AWAL saja —
  RSS publik yang mengalihkan ke 127.0.0.1/169.254 tetap diambil.
- **`youtube_analyst`** membaca token Apify server (biaya Owner) untuk akun siapa pun.

## Yang dibuat

- **`lib/orchestration/izin_subagent.ts`** (baru): sub-agent hanya jalan bila DIMINTA di `tools` (sesudah alias);
  `appSource: 'mametlite'` hanya `researcher`/`deep_research` (menjaga klien sah — `appSource` dikirim klien, bukan batas
  keamanan); `youtube_analyst` hanya akun di rahasia `MAMET_PEMILIK_IDS` (kosong → tak ada yang boleh, gagal tertutup).
- **`execution_handler.ts`**: rencana Coordinator disaring sebelum `Tool.Requested` — satu-satunya pemancar, jadi
  satu-satunya jalan ke `plugin.execute`; penolakan tampil di langkah proses ("⛔ Sub-agent … tidak dijalankan: …").
  Token Apify diteruskan hanya untuk pemilik.
- **`lib/web/alamat_publik.ts`** (baru): `alamatBolehDiambil` (pindah dari `proxy_fetch_endpoint.ts`) + `ambilAman` —
  pengalihan diikuti sendiri (`redirect: 'manual'`), tujuan TIAP lompatan diperiksa, maks 5; 303 / POST→301/302 jadi GET
  tanpa isi. Dipakai `proxy_fetch`, `communicator`, `scraper` (Jina, ambil langsung, alur login).
- **`youtube_analyst.ts`**: token dari env eksekusi, bukan `Deno.env`.

## Bukti

- **`uji/uji-izin-subagent.mjs`** (baru, modul asli dibundel — `execution_handler`, 3 plugin, `proxy_fetch`): **28/28**.
  Mutasi pada berkas sumber asli **12/12 menggigit** (berkas dipulihkan, hash dicek). Satu mutasi awal lolos dan
  membongkar cek alamat ganda di `communicator` (sudah dicakup `ambilAman`) — dibuang.
- `uji-langkah-terlihat` disesuaikan (kini mengirim `tools` + tiruan `Deno`). Suite **134/134**; bundel esbuild
  `index.ts` berhasil; tanpa karakter kendali.
- **Deploy (Owner, 30 Okt) — diperiksa di platform:** `agent-process` **540 → 541**, ACTIVE, `verify_jwt` tetap
  `false`; **102 berkas** (+2: `izin_subagent.ts`, `alamat_publik.ts`), 0 dari `frontend/`; **97 sama persis** dengan repo
  (CRLF → LF), 5 sisanya berkas tipe murni (0 ekspor nilai, tak diubah) yang dikosongkan platform saat dibundel.
  Penyaring, token Apify khusus pemilik, dan `youtube_analyst` tanpa `Deno.env` ada di paket.
- **Live:** fungsi menyala — `proxy_fetch` tanpa token → 401; chat dengan kunci anon + `tools:['communicator']` → 401.
  Penolakan sub-agent bagi akun masuk tidak diuji live (butuh token pengguna + saldo OpenRouter) — dibuktikan oleh paket
  ter-deploy + uji repo.
- **Rahasia `MAMET_PEMILIK_IDS` belum diisi** (pilihan Owner) → `youtube_analyst` tertutup bagi semua akun; tak ada klien
  sah yang memintanya.

## Sisa dari model ancaman (K5)

- TM-004: batas volume per pengguna di `rag-process` (kuota DB 500 MB bisa dipenuhi akun asing) — medium.
- Pendaftaran publik: menyala atas keputusan Owner; menurunkan peringkat seluruh ancaman bila dimatikan di luar masa
  pengembangan.
- Host bernama tidak di-resolve DNS (nama yang menunjuk alamat privat lolos) — batas yang diketahui.
