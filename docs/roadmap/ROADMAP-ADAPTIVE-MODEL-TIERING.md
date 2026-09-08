# ROADMAP — Adaptive Model Tiering (Kecil / Sedang / Thinking)

**Status:** 🟡 PROPOSED — arah desain disetujui Owner lewat diskusi, menunggu implementasi
**Tanggal Disusun:** 2026-09-08 (diperbarui via diskusi lanjutan — scope Assistant-only & override client-side-only dikonfirmasi)
**Owner:** Andre
**Scope:** `BrainService.js`, `RequestClassifierService.js` (referensi pola), Settings UI, `ConversationEngine.jsx`, sinkronisasi Supabase `user_metadata`. **Hanya berlaku untuk mode Assistant** — Engineer TIDAK termasuk (lihat §3).
**Referensi Terkait:** [`INDEX-ROADMAP.md`](./INDEX-ROADMAP.md), [`PR8-linux-style-dispatch.md`](./PR8-linux-style-dispatch.md) (pola classifier deterministik tanpa panggilan LLM)

---

## 1. Latar Belakang

Dua masalah nyata ditemukan lewat diskusi dan pengecekan kode langsung (2026-09-08):

**A. Konfigurasi model tidak sinkron antar-device.**
`BrainService.js:31-34` menyimpan pilihan provider/model **hanya di `localStorage`** (`maef_ai_provider`, `maef_ai_model`) — tidak pernah disinkron ke akun Supabase. Owner mengamati langsung: model di HP (DeepSeek v4) berbeda dari model di laptop (`openai/gpt-4o-mini` via OpenRouter, dikonfirmasi dari screenshot Settings). Setiap device punya "ingatan" sendiri.

**B. Satu model dipakai untuk semua jenis percakapan — boros token.**
Sapaan ringan ("hai") dan pertanyaan analitis berat sama-sama ditangani satu model yang sama (saat ini `openai/gpt-4o-mini` via OpenRouter untuk semua). Tidak ada mekanisme membedakan bobot percakapan untuk memilih model yang proporsional.

## 2. Tujuan

Membangun sistem **3 tingkat model (Kecil / Sedang / Thinking)** yang:
1. Owner **kurasi manual** model spesifik untuk tiap tingkat (berdasarkan riset Owner sendiri di luar sistem — tiap model AI punya kekuatan tugas berbeda).
2. Sistem **otomatis menebak** tingkat mana yang cocok untuk tiap pesan — tanpa memanggil LLM untuk menebak (supaya tidak menambah biaya justru saat mencoba menghemat biaya).
3. Owner bisa **override manual per-percakapan** kapan saja saat butuh satu model konsisten sepanjang thread.
4. Konfigurasi **sinkron lintas device** via Supabase, bukan `localStorage` saja.

## 3. Prinsip Desain (Hasil Diskusi — Jangan Diubah Tanpa Diskusi Ulang)

- **Pembagian tanggung jawab tegas:** Owner memutuskan *model apa* mengisi tiap tingkat (riset eksternal, keahlian Owner). Sistem hanya memutuskan *tingkat mana* yang dipakai per pesan (heuristik lokal). Sistem **tidak pernah** memilih model secara otomatis dari daftar bebas.
- **Classifier wajib zero-cost:** penilaian tingkat percakapan memakai heuristik deterministik lokal (panjang pesan + kata kunci), **bukan** panggilan LLM — mengikuti pola `RequestClassifierService.js` yang sudah terbukti di PR#8 (classify LOOKUP vs CONVERSATION tanpa biaya token).
- **Context-aware, bukan cuma pesan tunggal:** classifier melihat beberapa pesan terakhir dalam thread, bukan cuma pesan yang baru masuk — supaya pesan pendek seperti "oke lanjut" di tengah diskusi berat tidak salah dinilai "ringan".
- **Dwibahasa dari awal:** daftar kata kunci memuat versi Indonesia **dan** Inggris digabung dalam satu pencarian (Owner menulis campuran ID/EN) — tidak perlu deteksi bahasa terpisah.
- **Default Auto, override eksplisit:** setiap percakapan baru mulai di mode Auto (tingkat berubah otomatis per pesan). Owner bisa mengunci satu model untuk seluruh sisa percakapan lewat kontrol di area kolom chat. Chat baru selalu kembali ke Auto.
- **Tidak perlu tombol "upgrade jawaban ini"** — diputuskan eksplisit oleh Owner: cukup override manual per-percakapan sebagai jalan keluar kalau classifier salah tebak, tidak perlu mekanisme koreksi per-pesan yang lebih rumit.
- **Scope: Assistant-only, Engineer pakai jalur terpisah.** Engineer sudah punya jalur model sendiri (validasi BYOK key di `request_pipeline.ts`) — di luar sistem tiering ini sepenuhnya. Kalau sebuah thread berpindah mode dari Assistant ke Engineer, tier/override yang aktif di Assistant **tidak ikut terbawa**; Engineer tetap pakai jalur BYOK-nya sendiri seperti sekarang.
- **Override manual bersifat client-side-only, tidak persisten.** Berlaku hanya untuk sisa sesi thread yang sedang aktif di tab/browser saat itu — state React biasa, bukan disimpan ke database. Menutup chat, reload halaman, atau membuka chat yang sama dari device lain akan mengembalikannya ke Auto. **Konsekuensi:** tidak perlu kolom `chats.model_override` atau migrasi skema apa pun untuk fitur ini (lihat §4.4 & §5 yang sudah direvisi).

## 4. Arsitektur & Komponen

### 4.1 Settings UI — dari 1 slot jadi 3 slot
**Sekarang:** satu field Provider + satu field Model ID (lihat screenshot Settings, 2026-09-08).
**Rencana:** tiga slot berlabel **Kecil / Sedang / Thinking**, masing-masing berisi Provider + Model ID + kolom catatan opsional (alasan Owner memilih model itu, supaya tidak lupa beberapa bulan ke depan).

### 4.2 `TierClassifierService` (baru)
Service baru, pola sama seperti `RequestClassifierService.js:20` (deterministik, tanpa LLM). Input: pesan terbaru + N pesan riwayat terakhir. Output: `'KECIL' | 'SEDANG' | 'THINKING'`.
Heuristik awal:
- Panjang pesan (pendek → cenderung Kecil)
- Daftar kata kunci ringan dan berat/analitis (draf disetujui Owner 2026-09-08, lihat tabel di bawah)
- Sinyal dari riwayat: kalau 1-2 pesan terakhir di thread bertingkat Sedang/Thinking, pesan pendek berikutnya tidak otomatis turun ke Kecil (heuristik smoothing sederhana)
- Tidak match kata kunci ringan maupun berat, dan bukan sinyal smoothing dari riwayat → default tier **Sedang**

**Daftar kata kunci (draf disetujui, siap dipakai sebagai titik awal implementasi):**

| Tier | ID | EN |
|---|---|---|
| Kecil (ringan) | halo, hai, oke, ok, makasih, terima kasih, gimana, siap, lanjut, boleh, iya, ya, sip, mantap | hi, hey, hello, thanks, thank you, ok, okay, sure, got it, alright, cool, nice |
| Thinking (berat/analitis) | analisis, analisa, bandingkan, rencanakan, rancang, kenapa, jelaskan detail, strategi, evaluasi, optimalkan, pertimbangkan, trade-off, dampak, konsekuensi | analyze, compare, strategy, explain in detail, evaluate, optimize, design, architecture, pros and cons, implications, deep dive |

### 4.3 `BrainService.js` — routing per tingkat
**Sekarang:** `state = { provider, model }` tunggal (`BrainService.js:24-27`).
**Rencana:** `state.tiers = { KECIL: {provider, model}, SEDANG: {...}, THINKING: {...} }`. `getActiveBrainContext()` menerima parameter tingkat (dari `TierClassifierService` atau dari override manual) dan mengembalikan provider/model/key sesuai slot itu.

### 4.4 Override Manual Per-Percakapan (Client-Side-Only, Sesi Aktif Saja)
**UI:** kontrol pil/dropdown di dekat kolom input chat (`ConversationEngine.jsx`), mirip pola tombol Database RAG/Web Search yang sudah ada di Mamet Lite — menunjukkan status "Auto" atau nama model yang sedang dipin.
**Penyimpanan:** **TIDAK disimpan ke database.** Cukup React state biasa di `ConversationEngine.jsx` (atau context lokal), di-scope ke thread yang sedang di-mount di tab itu. Reset otomatis ke Auto saat: chat baru dibuka, halaman di-reload, chat yang sama dibuka lagi nanti (termasuk dari device lain), atau thread berpindah mode dari Assistant ke Engineer. **Tidak perlu kolom `chats.model_override` atau migrasi skema apa pun** — keputusan ini sekaligus menghindari risiko skema tak-terlacak seperti bug `verification_audit_logs.metadata` sebelumnya, karena memang tidak ada skema baru yang ditambah.

### 4.5 Sinkronisasi Lintas Device
Ikuti pola yang **sudah terbukti jalan**: `WorkspaceManager.js:212` (`_syncLayoutToSupabase`) memakai `supabase.auth.updateUser({ data: {...} })` untuk sinkron `workspace_layouts` ke `user_metadata`. Tiering config disinkron dengan pola identik, key baru `model_tiers` di `user_metadata`. `BrainService.initialize()` baca dari `user_metadata` dulu (fallback ke `localStorage` kalau offline/gagal fetch).

> **Catatan pencegahan bug:** field `custom_models` sudah ada di `user_metadata` beberapa akun (ditemukan saat investigasi bug Mamet Lite hari ini) tapi **tidak pernah dibaca kode manapun** — orphan field. Pastikan `model_tiers` yang baru ini benar-benar dibaca & ditulis konsisten, jangan menambah field metadata mati lagi.

## 5. Rencana Implementasi Bertahap

1. **`TierClassifierService`:** bangun + unit-test manual dengan contoh pesan campuran ID/EN dari gaya chat Owner sendiri.
2. **`BrainService` multi-tier:** ubah `state` jadi 3 slot, sinkron ke `user_metadata`. Pastikan jalur Engineer (BYOK) tidak tersentuh perubahan ini sama sekali.
3. **Settings UI:** 3 slot input + catatan opsional.
4. **`ConversationEngine.jsx`:** kontrol override manual di kolom chat — state lokal React saja (lihat §4.4), reset saat thread berganti mode ke Engineer.
5. **Verifikasi live:** kirim beberapa pesan campur ringan-berat dalam satu thread, konfirmasi tier berpindah sesuai; kirim pesan setelah override manual aktif, konfirmasi tetap terkunci ke model yang dipilih sepanjang sesi itu; reload halaman / buka chat yang sama dari device lain, konfirmasi override sudah kembali ke Auto; pindah mode ke Engineer di thread yang sama, konfirmasi Engineer tetap pakai jalur BYOK-nya sendiri tanpa terpengaruh tier/override Assistant; buka Settings dari device lain, konfirmasi 3 slot model tersinkron.

## 6. Item yang Masih Perlu Keputusan Owner

- **Kurasi model aktual untuk tiap slot (Kecil/Sedang/Thinking)** — riset eksternal Owner, di luar scope teknis dokumen ini. **Masih terbuka** — implementasi `BrainService` multi-tier (§5 langkah 2) menunggu ini.
- ~~Daftar awal kata kunci ringan/berat ID+EN~~ — **Selesai.** Draf disetujui Owner 2026-09-08, lihat tabel di §4.2.

## 7. Kriteria Sukses

- [ ] 3 slot model tersinkron identik di HP dan laptop (dites langsung oleh Owner).
- [ ] Pesan ringan (sapaan) terverifikasi log memakai slot Kecil; pesan analitis memakai slot Thinking.
- [ ] Override manual per-percakapan berfungsi dan tidak "lepas sendiri" selama sesi thread masih aktif di tab yang sama.
- [ ] Override otomatis kembali ke Auto saat: chat baru dibuka, halaman di-reload, chat lama dibuka ulang (device mana pun), atau thread berpindah mode ke Engineer.
- [ ] Engineer tidak pernah menerima model dari slot Kecil/Sedang/Thinking — jalur BYOK-nya tetap terpisah total dan tidak berubah perilaku.
- [ ] Tidak ada panggilan LLM tambahan yang dipakai semata-mata untuk menentukan tingkat (classifier 100% lokal/gratis).
