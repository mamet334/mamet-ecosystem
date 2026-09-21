# T3: Rute Mati `/api/agent/process` Dihapus dari Backend

**Tanggal:** 21 September 2026
**Roadmap:** T3 ([`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md)), asal Item 49
**Status:** ✅ dihapus (keputusan Owner: hapus).

## Yang dihapus

`backend/server.js` baris 309–1477 (**1.170 baris**): rute `POST /api/agent/process` — router sub-agent lama
(researcher, scraper, coder + eksekusi kode, communicator + Slack/API eksternal) dengan model OpenRouter yang sudah
tidak ada (`google/gemini-2.0-flash-exp:free`) dan mengabaikan model pilihan pengguna.

## Pemeriksaan sebelum hapus

- **Tanpa pemanggil:** di seluruh repo hanya dirujuk dokumen lama (dan satu worktree `.claude` sisa sesi lain) —
  frontend & Mametlite tidak memanggilnya. Chat Assistant/Lite lewat Edge Function `agent-process`.
- **Tidak ada fungsi bantu yang ikut yatim:** semua nama tingkat atas `server.js` masih dipakai di luar rentang itu.
- **Batas dipastikan skrip:** awal = `app.post('/api/agent/process'`, akhir = `});` + baris kosong; skrip berhenti
  bila tak cocok.
- `node --check backend/server.js` lolos. Rute tersisa: `/api/health`, `/api/chat` (Engineer, tidak disentuh),
  `/api/tools`.

## Rujukan yang dibetulkan

- Banner saat backend menyala: "Agent Process: /api/agent/process" → "Chat (Engineer): /api/chat".
- `docs/QUICK-START.md`, `docs/ARCHITECTURE.md`: menunjuk `/api/chat` + catatan penghapusan.
- Changelog lama dibiarkan (catatan sejarah).

## Belum diuji live

Backend tidak dinyalakan di sesi ini. Bukti yang tersisa: kirim satu pesan di Engineer (`npm run desktop`) — jalur
`/api/chat` harus tetap berjalan.
