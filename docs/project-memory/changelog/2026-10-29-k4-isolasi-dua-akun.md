# 29 Oktober 2026 — K4: uji isolasi data antar-akun — database & server terisolasi, peramban Mametlite bocor lalu diperbaiki

Butir K4 ADR-0022 ("isolasi data antar-pengguna diuji dengan dua akun"). Diuji di tiga lapis **tanpa memakai kata sandi
siapa pun**: menyamar sebagai akun lain di Postgres (peran `authenticated` + klaim JWT), hanya **hitungan** baris,
percobaan tulis dibungkus blok yang sengaja dibatalkan.

Akun (ID dipotong): A `3841e124` (Owner — 217 chat, 228 dokumen, 1.313 baris ASN) · B `23a39918` · C `52e37376`
(Mametlite — 16 dokumen, 149 potongan).

## Lapis 1 — database (RLS): ✅ terisolasi

- **Baca:** sebagai **C**, 30 tabel data pengguna — hanya miliknya (16 dokumen, 149 potongan, 0 chat, 0 baris ASN);
  kolom "bukan miliknya" **0 di semua tabel**. Sebagai **B**: 50 baris, semuanya milik B (catatan uji Engineer).
  **anon**: **0**.
- **Tulis** (sebagai C atas data A): ubah/hapus chat, dokumen, potongan, ASN, memori → **0 baris**; sisip chat & dokumen
  atas nama A → **ditolak `42501` RLS**. Semua dibatalkan.
- **Fungsi `SECURITY DEFINER`** yang bisa dipanggil pengguna (`match_memories`, `get_active_knowledge`,
  `check_daily_quota`) — melewati RLS tetapi punya penjaga `auth.uid()`; sebagai C meminta data A → **ditolak** ketiganya;
  kontrol: kuota C sendiri boleh.

## Lapis 2 — server: ✅ terisolasi

- `agent-process`: identitas dari token yang diverifikasi (`auth_middleware.ts` → `auth.getUser(token)`), bukan dari isi
  permintaan; embed/hakim/padatkan memeriksa JWT sendiri; pencarian memori menolak tanpa ID pengguna.
- `rag-process`: menolak `userId` isi permintaan yang beda dari token (`USER_MISMATCH` 403) & memeriksa kepemilikan space;
  **live tanpa token → HTTP 401**.

## Lapis 3 — peramban Mametlite: ❌ BOCOR → diperbaiki

- **Temuan:** riwayat chat (`mametlite_conversations`) dan **kunci OpenRouter** (`x-byok-openrouter`) satu kunci
  `localStorage` untuk **semua akun**; keluar akun hanya `signOut`. Di komputer bersama (kantor) orang kedua yang masuk
  **melihat seluruh riwayat orang pertama** dan **memakai kunci OpenRouter-nya** (biaya ke orang pertama).
- **Perbaikan (klien saja):**
  - `lib/dataPerAkun.js` (baru): kunci per akun (`mametlite_conversations:<id>`, `x-byok-<penyedia>:<id>`);
    `pindahkanDataLama` — **pilihan (a) Owner**: data kunci-bersama lama → akun yang sedang masuk saat versi baru pertama
    dibuka; tanpa sesi → dihapus; riwayat akun yang sudah ada tak ditimpa.
  - `lib/riwayatLokal.js`: parameter akun (tanpa akun = perilaku lama; uji lama tetap lulus).
  - `App.jsx`: riwayat & status kunci dimuat ulang tiap akun berganti; penyimpanan hanya ke kunci **pemilik** riwayat yang
    tampil (`pemilikRiwayatRef`) — mencegah riwayat A tertulis ke kunci B di sela pergantian; semua pembacaan kunci API
    (chat, unggah, OCR, header) memakai kunci akun ini.

## Bukti

- `uji/uji-data-per-akun.mjs` (baru): B tak melihat riwayat/kunci A di peramban yang sama; pemindahan/penghapusan data
  lama; tak menimpa. **Mutasi 7/7 menggigit** (satu sempat lolos — urutan "pindahkan lalu pasang sesi" — uji diperketat).
- **Peramban sungguhan** (`npm run preview` Mametlite): data lama berkunci bersama + tanpa sesi → terhapus, tak ada kunci
  per akun terbentuk, layar masuk normal, konsol bersih.
- `uji-riwayat-lokal` lama lulus; `vite build` Mametlite berhasil; suite **131/131**.

## Ketahuan (K5 — menunggu keputusan Owner, belum dikerjakan)

- **`proxy_fetch` di `agent-process` terbuka tanpa token** (fungsi `verify_jwt: false`; aksi ini diproses sebelum pemeriksaan
  token). **Live:** tanpa token, server mengambilkan `example.com`. Pemanggil satu-satunya di repo: `WebComparisonService.js`
  (web Tier 3 versi web, selalu membawa token) — **bukan crawler** (diperiksa di `capability/ecosystem-crawler/`).
- **`auth_middleware.ts` menulis seluruh objek pengguna ke log** (`JSON.stringify(user)`: email & metadata) tiap permintaan.

Uji nyata Owner sesudah Vercel ter-deploy: satu peramban — masuk akun A, kirim chat, keluar, masuk akun B → riwayat A tak muncul.
