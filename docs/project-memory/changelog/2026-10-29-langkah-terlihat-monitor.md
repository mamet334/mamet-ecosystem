# 29 Oktober 2026 — Rencana Coordinator & kata kunci researcher terlihat; langkah klien sampai ke panel Monitor (ADR-0021 §2.3, Item 126 Fase 1)

Pekerjaan ADR-0021 §7 "rencana Coordinator ditampilkan ke Owner". Saat menelusuri ke mana baris itu akan tampil,
ketahuan masalah yang lebih mendasar.

## Temuan: langkah proses tak terlihat di layar chat

- **Gelembung chat tidak pernah menggambar langkah proses** — `ConversationEngine.jsx` menyimpan `steps` ke tiap pesan,
  tetapi tak satu komponen pun membacanya (Mametlite juga tidak).
- **Satu-satunya tempatnya panel "Monitor"** (`MaefExecutionMonitorWidget`, dibuka manual), dan panel itu diberi
  `jsonMetadata` saja:
  - jalur hybrid (bawaan): langkah server **tanpa** baris klien;
  - jalur mengalir: hanya `{ penyedia }` — panel menampilkan JSON mentah.
- **Koreksi atas 28 Okt** ([log](./2026-10-28-modul-bersama-kueri.md)): baris klien "🔍 Dicari (web): …" disusun dan
  tersimpan di data pesan, tetapi **tidak tampil di layar mana pun** sampai hari ini. Ujinya memeriksa baris itu
  DISUSUN, bukan SAMPAI ke layar.

## Yang dibuat (Owner memilih: panel Monitor dulu, gelembung chat sesudah pratinjau)

**Server** — modul kecil `lib/orchestration/langkah_terlihat.ts`:
- `barisRencana(plan)`: `📋 Rencana: 1 sub-agent akan ditugaskan → researcher: "Cari pemenang MotoGP 2026"` — tugas
  hasil tulisan ulang Coordinator ikut tampil (dulu hanya nama sub-agent); spasi dirapikan, dipotong 140 huruf, satu baris.
- `barisDicariSubagent(...)`: `🔍 Dicari (berita, researcher): "pemenang MotoGP 2026" → Bing News` — kata kunci yang
  benar-benar dikirim researcher/deep_research (dulu hanya `console.log` server); dipasang di `execution_handler` tepat
  sebelum baris "selesai".

**Klien** — `components/widgets/jejakMonitor.js` `jejakUntukMonitor(steps, jsonMetadata)`: panel menerima langkah
**gabungan** klien + server (metadata server lain tetap), juga di jalur mengalir; `ConversationEngine` memakainya.

## Bukti

- `uji/uji-langkah-terlihat.mjs` (baru): `intent_router` & `execution_handler` dibundel sungguhan (hanya LLM, parser,
  registry, event bus ditiru); data panel diperiksa untuk jalur hybrid & mengalir. **Mutasi 5/5 menggigit.**
  `uji-router-jalur-aman` tetap lulus (awalan baris rencana dipertahankan).
- **Peramban sungguhan:** panel Monitor ASLI dirender dengan `jejakUntukMonitor` ASLI —

  | | Cara kirim lama | Sekarang |
  |---|---|---|
  | jalur hybrid | baris "🔍 Dicari (web)" klien **tidak ada** | ketiga baris tampil |
  | jalur mengalir | `{ "penyedia": "DeepSeek" }` mentah | ketiga baris tampil |
- Suite penuh **128/128**; bundel esbuild `agent-process` & `vite build` berhasil; nol karakter kendali.

## Deploy — diperiksa di platform

Owner men-deploy `agent-process` 29 Okt. API Supabase: versi **538 → 539**, ACTIVE, `verify_jwt` tetap `false`, 99
berkas (+1 `langkah_terlihat.ts`); 0 dari `frontend/`, 7 `shared/`. `langkah_terlihat.ts`, `intent_router.ts`,
`execution_handler.ts` **sama persis** dengan repo (setelah CRLF → LF); bunyi lama baris rencana tak ada lagi.

## Sisa

- **Nomor 2 (menunggu pratinjau Owner):** baris §2.3 tampil di gelembung jawaban, bukan hanya di panel Monitor yang
  harus dibuka manual. Mengubah tampilan → pratinjau dulu.
- Bagian klien sampai ke aplikasi terpasang lewat rilis berikutnya; `npm run desktop` langsung.
