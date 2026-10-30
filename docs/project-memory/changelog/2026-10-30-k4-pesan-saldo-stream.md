# 30 Oktober 2026 — K4: kegagalan semua penyedia di jalur stream tampil manusiawi, tanpa label palsu (ADR-0022)

Temuan uji nyata Owner dua akun di Mametlite ([log K4](./2026-10-29-k4-isolasi-dua-akun.md)), dikerjakan atas permintaan Owner.

## Temuan

- Saat saldo OpenRouter habis, Mametlite menampilkan sebagai JAWABAN: "*(Fallback Note: OpenRouterAdapter failed,
  cascading...)*" lalu "**Semua AI Provider sedang limit atau gangguan.** Detail error: [OpenRouterAdapter]: Saldo …
  plafon ulangnya 26 token …". Asalnya `runStreamLLM` (`llm_orchestrator.ts`): stream sudah HTTP 200, jadi kegagalan
  ditulis ke isi jawaban — penerjemah pesan M4 di klien tak menyentuhnya karena bukan galat. "Fallback Note" bahkan
  ikut tertulis saat penyedia berikutnya BERHASIL.
- Bila ada dokumen dilampirkan, `stream_handler` memeriksa label pesan kegagalan itu seperti jawaban model →
  menempelkan `[STATUS: HYPOTHESIS]` + "model tidak menulis label status".
- `pesanGalat.js` Mametlite (jalur non-stream) belum mengenali kalimat saldo berbahasa Indonesia dari server
  (`pesanSaldoTakCukup`) — Ecosystem sudah sejak v2 (23 Okt).

## Yang dibuat

- **`lib/streaming/pesan_gagal_stream.ts`** (baru): `pesanSemuaPenyediaGagal(detail)` — bentuk pesan galat M4: judul +
  tindakan, lalu teks teknis kecil. Saldo (penanda disamakan dengan `pesanGalat.js` Ecosystem v2) → "Saldo OpenRouter
  Anda tidak cukup … Isi ulang saldo di openrouter.ai …"; selain itu → "Layanan AI sedang gangguan …".
- **`llm_orchestrator.ts`**: "Fallback Note" tak lagi ditulis ke jawaban (tetap di log); pesan akhir lewat fungsi di atas;
  `rctx.semuaPenyediaGagal = true`.
- **`stream_handler.ts`**: penanda itu → pemeriksaan label & catatan RAG dilewati.
- **`mametlite/src/lib/pesanGalat.js`**: + "saldo openrouter", "saldo tidak cukup", "saldo penyedia".

## Bukti

- `uji/uji-pesan-gagal-stream.mjs` (baru — `runStreamLLM` & `stream_handler` asli dibundel, kalimat saldo dari
  `pesanSaldoTakCukup` asli, `pesanGalat` Mametlite asli): **11/11**. Mutasi **8/8** menggigit.
- `uji-komposisi-konteks-engineer` disesuaikan (impor ke-4 `llm_orchestrator.ts` ikut ditiru). Suite **137/137**;
  bundel esbuild `agent-process` & `vite build` Mametlite berhasil; tanpa karakter kendali.
- **Deploy (Owner) — diperiksa di platform:** `agent-process` **542 → 543**, ACTIVE, `verify_jwt` tetap `false`; 103 berkas
  (+1), 98 sama persis + 5 berkas tipe murni yang dikosongkan platform; "Fallback Note" tak ada di paket.
- **Live (Owner, akun A di mametlite.vercel.app, saldo habis):** jawaban = "⚠️ **Saldo OpenRouter Anda tidak cukup untuk
  menjawab pertanyaan ini.** Isi ulang saldo di openrouter.ai, atau coba pertanyaan yang lebih pendek …" + *Pesan
  teknis* — tanpa "Fallback Note" / "Semua AI Provider". Perubahan `pesanGalat.js` Mametlite terbit lewat Vercel saat push.
