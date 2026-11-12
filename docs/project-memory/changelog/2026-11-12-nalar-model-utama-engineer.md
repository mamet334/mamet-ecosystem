# 12 November 2026 — Engineer bernalar: sakelar nalar model utama (bawaan nyala)

Keputusan Owner 12 Nov: *"ya bawaan nyala"* — atas pertanyaan *"kenapa kebanyakan reasoning model di engineer tidak
tampil?"*.

## Temuan

- Data 21 hari (hitungan saja): Assistant **131/183** jawaban tersimpan dengan nalar; Engineer **0/64**.
- Sebab: Engineer sengaja tidak memakai pil tier (selalu model utama Settings), tetapi sakelar "Thinking" hanya ada di
  slot tier. `BrainService.getActiveBrainContext()` tanpa tier selalu `thinking: false` → klien mengirim `thinking: false`
  → server meminta OpenRouter `reasoning: { enabled: false }`; aliran nalar (`streamNalar`) dan sisipan `<think>` pun
  mati. **Model Engineer diperintah tidak bernalar**, bukan sekadar nalarnya disembunyikan. Bukan keputusan Owner yang
  tercatat — efek samping "Engineer tanpa tier".

## Yang diubah (klien saja, tanpa deploy)

- `BrainService`: `state.thinking` model utama, bawaan **nyala**, disimpan `localStorage` `maef_ai_thinking`;
  `getActiveBrainContext()` tanpa tier memakai sakelar ini; slot tier tetap memakai sakelarnya sendiri.
- Settings → Model AI: kotak **"Nalar (reasoning) untuk model utama"** (kelas Tailwind sama persis dengan sakelar tier).
- **Isi nalar tidak pernah menjadi bahan kerja Engineer** (lubang yang terbuka begitu nalar menyala): perintah otomatis
  `[MAMET_CMD]` (`perintahDariJawaban`, termasuk nalar yang masih mengalir), pengubahan blok ```bash jadi perintah
  (`blokKodeKeMametCmd`), berkas sasaran & usulan patch (`tugasDariUsulan`), `<temuan>` dan `<pengetahuan>` — semuanya
  hanya membaca bagian jawaban.

## Bukti

- `uji/uji-nalar-engineer.mjs` **24 pemeriksaan**: BrainService & AssistantService sungguhan (dibundel esbuild) —
  Engineer bawaan mengirim `thinking=true` + `streamNalar=true`, dimatikan → `thinking=false`; pilihan bertahan sesudah
  muat ulang; nalar utama tak menyentuh slot tier; perintah/patch/temuan/pengetahuan hanya dari jawaban.
  **Mutasi 15/15 mati** di salinan scratchpad. Suite penuh **167/167**, `vite build` produksi berhasil.
- **Live (Owner, `npm run desktop`, 12 Nov):** sakelar tampil di Settings (tercentang); jawaban Engineer kini dengan nalar.

## Batas yang diketahui

- Biaya & waktu jawaban Engineer naik (token nalar dibayar sebagai keluaran). Rem: batas biaya harian Settings.
- `.exe` 4.5.0 mendapatkannya di rilis berikutnya; setelan tersimpan per instance (`.exe` ≠ `npm run desktop`).
- Bila jawaban melewati beberapa putaran alat, hanya nalar putaran terakhir yang tersimpan (Parkir).
