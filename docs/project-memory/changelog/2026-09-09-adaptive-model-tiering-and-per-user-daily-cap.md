# Changelog: Adaptive Model Tiering (Kecil/Sedang/Thinking) + Batas Biaya Harian Per-User

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai & Diverifikasi Live Penuh (2026-09-09) — ketiga tier terbukti memakai model berbeda, classifier & override dua-duanya jalan, edge function ter-deploy dengan `[MATCH]` drift check.
**Scope:** `TierClassifierService.js` (baru), `BrainService.js`, `AssistantService.js`, `Kernel.js`, `Settings.jsx`, `ConversationEngine.jsx`, `quota_middleware.ts` (edge function), migrasi DB `restrict_system_config_update_to_service_role`
**Referensi:** [`ROADMAP-ADAPTIVE-MODEL-TIERING.md`](../../roadmap/ROADMAP-ADAPTIVE-MODEL-TIERING.md)

---

## 1. Verifikasi Dokumen Sebelum Implementasi

Klaim kode di roadmap (ditulis 2026-09-08) dicek ulang dulu dan **masih akurat**: `BrainService.state` memang `{provider, model}` tunggal, hanya `localStorage`, `getActiveBrainContext()` tanpa parameter. Titik integrasi ada 4 — tiga di `AssistantService` (CONVERSATION, LOOKUP, SKILL) dan satu di `engineer.js:600`.

**Celah yang tidak diperhitungkan dokumen:** rencana §4.3 mengandalkan parameter `thinking` untuk membedakan Kecil vs Sedang (model sama, toggle beda). Pencarian di seluruh edge function `agent-process` menemukan **nol** kemunculan `thinking` maupun `reasoning_effort` — adapter hanya meneruskan `model`, dengan `temperature: 0.1, max_tokens: 8192` hardcoded. Jadi rencana itu tidak bisa jalan apa adanya tanpa plumbing baru lintas klien → edge function → adapter.

**Keputusan Owner:** kerjakan tiering dulu tanpa `thinking` (semuanya sisi klien, tanpa deploy), plumbing menyusul terpisah. Cakupan: **CONVERSATION + LOOKUP** (bukan SKILL).

## 2. `TierClassifierService` (Baru)

Deterministik dan 100% lokal, pola sama seperti `RequestClassifierService` (PR#8) — tidak pernah memanggil LLM untuk menebak tingkat, karena itu justru menambah biaya saat sedang berusaha menghemat.

Heuristik: kata kunci berat/ringan dwibahasa ID+EN dalam satu pencarian (tanpa deteksi bahasa terpisah), panjang pesan (≤40 karakter cenderung Kecil, ≥400 karakter langsung Thinking), dan **smoothing riwayat** — pesan pendek seperti "oke lanjut" di tengah diskusi berat tidak turun ke Kecil kalau 2 pesan terakhir bertingkat lebih tinggi. Default kalau tidak cocok apa pun: Sedang.

## 3. `BrainService` Multi-Tier

`state.tiers` baru berisi 3 slot `{provider, model, thinking, note}`. Disimpan di `localStorage` dan disinkronkan ke `user_metadata.model_tiers` — pola identik `WorkspaceManager._syncLayoutToSupabase()` yang sudah terbukti, **dengan debounce 1,5 detik** karena Settings memanggil `setTier()` tiap ketikan (tanpa debounce, tiap karakter jadi satu request `updateUser`).

**Dua keputusan desain yang diambil di luar teks dokumen, disetujui Owner:**

1. **Field Provider+Model tunggal TIDAK dihapus.** Dokumen §4.1 menulis "dari 1 slot jadi 3 slot", tapi kalau slot tunggal dihapus, Engineer kehilangan sumber modelnya — `executeLLM()` (jalur patch Engineer) memanggil `getActiveBrainContext()` tanpa argumen. Padahal §3 justru menegaskan Engineer harus terpisah total dari tiering. Jadi model utama tetap ada khusus untuk Engineer, 3 slot tier khusus Assistant.
2. **Slot awal disalin dari model utama.** Mengaktifkan tiering tidak boleh diam-diam mengganti model yang sedang dipakai Owner — perilaku baru hanya muncul setelah Owner sendiri mengisi slot berbeda.

`getActiveBrainContext(tier)` menerima tier opsional; tanpa argumen perilakunya persis seperti sebelumnya (nol perubahan untuk Engineer).

## 4. Wiring & UI

- **CONVERSATION:** tier dipilih classifier, kecuali kalau ada override manual.
- **LOOKUP:** dipatok tetap `KECIL` tanpa classifier — jalur ini memang sudah dirancang ringan (skip memory/RAG/semantic).
- **ENGINEER:** dikecualikan penuh, tidak pernah menyentuh slot tier.
- **Settings:** 3 slot (provider + model ID + catatan opsional).
- **Pil override di toolbar chat:** Auto / Kecil / Sedang / Thinking. Client-side-only (React state), reset otomatis saat ganti chat, buat chat baru, atau reload — **tanpa kolom DB atau migrasi apa pun**, sesuai §4.4. Tidak ditampilkan di workspace Engineer.

**Penyimpangan dari dokumen:** §4.4 menempatkan pil "di dekat kolom input chat"; diletakkan di toolbar atas sebelah tombol Tools agar semua kontrol sesi berkumpul, konsisten dengan keputusan Owner sebelumnya yang memindahkan toggle tool ke panel demi menghindari layar penuh.

## 5. Batas Biaya Harian Per-User (Muncul dari Live Test)

Saat menguji tiering, Owner kena `[CIRCUIT BREAKER AKTIF] ($1.29 / $1)` dan bertanya apakah batasnya bisa dibuatkan tombol. Penelusuran menemukan **dua mekanisme batas yang saling bertentangan**:

| Lokasi | Nilai | Sumber hitungan | Yang benar-benar memblokir |
|---|---|---|---|
| `quota_middleware.ts:9` | `$1` hardcoded | RPC `check_daily_quota` | ✅ ya |
| `costTracker.ts:67` | `$0,50` dari `system_config` | `cost_ledger` | ❌ tidak |

Pemakaian $1,29 sudah melewati keduanya, artinya cap $0,50 tidak benar-benar menahan — belum ditelusuri sampai tuntas (dua sumber hitungan berbeda), dicatat sebagai dugaan, bukan kesimpulan.

**Temuan keamanan (lebih serius):** policy RLS `system_config_authenticated_update` mengizinkan **setiap** user terautentikasi mengubah `system_config`, termasuk `daily_budget_cap_usd` dan `kill_switch_active`. Karena pengguna eksternal mametlite tanpa BYOK key memakai API key sistem milik Owner (lihat komentar `callAgentSimple.js:77-80`), mereka bisa menaikkan sendiri jatah belanja atau mematikan kill switch.

**Solusi (disetujui Owner, plafon dipilih $2):**
- Migrasi `restrict_system_config_update_to_service_role`: policy UPDATE dihapus. Aman karena tidak ada kode klien yang menulis tabel ini — hanya `costTracker.ts` lewat service role, dan service role melewati RLS. Policy SELECT dipertahankan agar UI bisa menampilkan plafon.
- `system_config.daily_budget_cap_usd` dinaikkan `0.50 → 2.00`.
- `quota_middleware.ts` tidak lagi hardcode: batas efektif = **min(batas pribadi user, plafon sistem)**. Batas pribadi disimpan di `user_metadata.daily_budget_cap_usd` (pola sama seperti `model_tiers`, tanpa tabel baru). Karena plafon hanya bisa ditulis service role, tombol di UI **hanya bisa memperketat** — tidak ada pengguna yang bisa menaikkan jatah belanjanya sendiri.
- Settings: input "Batas Biaya Harian" + tampilan plafon sistem aktif.

## 6. Verifikasi Live

**Sudah terbukti (log Owner):**
```
Model tier: KECIL    (pesan pendek & cocok kata kunci ringan) → openrouter/openai/gpt-4o-mini
Model tier: THINKING (pesan dinilai THINKING)                 → openrouter/deepseek/deepseek-v4-pro-0813
Model tier: KECIL    (override manual Owner)                  → openrouter/openai/gpt-4o-mini
Model tier: SEDANG   (override manual Owner)                  → openrouter/deepseek/deepseek-v4-flash-0731
Model tier: THINKING (override manual Owner)                  → openrouter/deepseek/deepseek-v4-pro-0813
[BrainService] Model tiers disinkron dari user_metadata (lintas device)
[BrainService] Model tiers tersinkron ke Supabase user_metadata
```

Jalur **Auto** terbukti di kedua ujung spektrum: pesan ringan ("hai") turun ke Kecil, dan pesan analitis 196 karakter berisi kata kunci berat ("kenapa", "bandingkan", "analisis", "evaluasi", "rancang") naik ke Thinking — tanpa override sama sekali. **Sinkronisasi lintas device dikonfirmasi Owner:** ketiga slot tampil sama di HP.
Ketiga tier memakai model berbeda, semuanya HTTP 200. Deploy edge function diverifikasi `[MATCH]` terhadap commit `9025c20` lewat `scripts/verify-deployment-drift.ps1`.

**Rantai batas biaya per-user juga terbukti langsung, bukan cuma tersirat — di kedua arah:**

1. **Arah menaikkan:** Owner menaikkan batas pribadinya ke **$1,50** lewat tombol baru di Settings, lalu chat berjalan normal padahal pemakaian hari itu sudah $1,29. Di bawah aturan lama (`$1` hardcoded), $1,29 pasti tetap diblokir.
2. **Arah memperketat:** Owner mengubah batas ke **$0,50**, dan circuit breaker langsung menyala dengan pesan `[CIRCUIT BREAKER AKTIF] ($1.46 / $0.5)` — angka pembanding yang muncul adalah **batas pribadi**, bukan `$1` hardcoded lama maupun plafon sistem $2,00.

Keduanya membuktikan dalam satu jalur: tombol Settings benar-benar menulis ke `user_metadata`, `quota_middleware` yang ter-deploy benar-benar membacanya, dan aturan min(pribadi, plafon) menghasilkan angka yang benar di kedua arah.

**Kesalahan konfigurasi yang sempat terjadi (bukan bug kode):** Owner mengisi slot Thinking dengan `deepseek/deepseek v4` (pakai spasi), OpenRouter menolak `400 is not a valid model ID`. Sistem sudah benar — ia mengirim persis apa yang dikonfigurasi. ID yang benar diambil dari katalog OpenRouter: `deepseek/deepseek-v4-flash-0731` dan `deepseek/deepseek-v4-pro-0813`.

**Belum diuji:** hanya satu — reset override otomatis ke Auto saat ganti chat / buat chat baru / reload. Kodenya ada (`useEffect` pada `currentChatId` + `setModelTierOverride(null)` di `handleNewChat`), tapi belum dikonfirmasi live.

## 7. Yang Sengaja TIDAK Dikerjakan

- **Plumbing parameter `thinking`** (klien → edge function → adapter, plus pemetaan nama parameter per provider). Field-nya sudah disimpan per slot tapi belum dikirim ke LLM. Konsekuensi praktis: Kecil dan Sedang harus diisi model ID berbeda untuk benar-benar terasa bedanya.
- **Tiering untuk mode SKILL** — di luar cakupan yang dipilih Owner.
- **Menelusuri kenapa cap `$0,50` di `costTracker` tidak menahan** — dicatat sebagai dugaan di §5, belum diinvestigasi.
