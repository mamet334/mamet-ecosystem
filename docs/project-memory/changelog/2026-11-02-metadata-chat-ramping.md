# 2 November 2026 — Metadata chat membengkak: langkah proses tersimpan sekali, bukan dua kali

Butir Parkir (ADR-0022) dikerjakan atas permintaan Owner. Hanya kode klien (`frontend/`) — **tak perlu deploy**.

## Akar (diukur di tabel `chats`, hanya angka)

| | Ukuran |
|---|---|
| Teks pesan seluruhnya (219 chat, 1.183 pesan, 1 akun) | 22 MB |
| `steps` | 9,9 MB |
| `metadata.processingSteps` | 9,9 MB — **salinan persis** ekor `steps` di 418/418 pesan |
| di dalamnya `[SYSTEM CONTEXT FINAL]` | rata-rata 22.927 huruf, terbesar 153.467 |

`AssistantService` onDone menyusun `steps = [...langkah klien, ...processingSteps server]` dan `metadata = seluruh
respons server` — jadi langkah server tersimpan dua kali. Kedua salinan juga ikut terkirim di `history` setiap kiriman,
padahal server tak membacanya: model hanya menerima `role`/`content` (`ai_adapter.ts`), server hanya membaca
`metadata.terpotong`/`bahanLanjutan` (`batas_waktu.ts`). Mametlite tak terdampak (riwayatnya hanya `role`/`content`).

## Perbaikan

- `frontend/src/core/runtime/services/pesanRamping.js` (baru):
  - `rampingkanPesan` — dipakai `saveChatToDB`: `metadata.processingSteps` dibuang **hanya bila** sama persis dengan
    ekor `steps`.
  - `pesanUntukServer` — dipakai di 3 jalur `history` ke server (percakapan, LOOKUP, skill): tanpa `steps` &
    `metadata.processingSteps`; `role`, `content`, penanda patok, `metadata.terpotong`/`bahanLanjutan` tetap ikut.
- **Sengaja TIDAK dipangkas:** `steps` utuh termasuk `[SYSTEM CONTEXT FINAL]` — satu-satunya bukti prompt yang
  benar-benar dibaca model (verifikasi jawaban RAG, set uji mutu K1).
- Yang dikirim ke model tidak berubah → biaya token, cache prompt, dan penjaga NIP Data Tabel (K3) tak tersentuh.

## Chat lama dibersihkan (izin Owner, sesudah "Cadangkan data")

- `UPDATE` membuang `metadata.processingSteps` dari pesan yang terbukti salinan persis: **418 pesan di 157 chat**;
  lalu `VACUUM FULL public.chats`.
- Sidik MD5 sebelum = sesudah untuk **isi pesan, `steps`, metadata lain, `updated_at`** (urutan riwayat tak berubah);
  salinan tersisa 0; `[SYSTEM CONTEXT FINAL]` masih ada di `steps` 418 pesan.

| | Sebelum | Sesudah |
|---|---|---|
| Teks pesan | 22 MB | 12 MB |
| Tabel `chats` | 13 MB | 6,9 MB |

## Bukti

- `uji/uji-pesan-ramping.mjs` 15/15; **mutasi 8/8 menggigit** (salinan bukan-ekor ikut dibuang, pesan tanpa `steps`
  dianggap salinan, metadata lain terbuang, `steps`/`processingSteps` ikut terkirim, simpan tanpa rampingkan, jalur
  LOOKUP tanpa pintu, state layar ikut diubah).
- Suite **141/141**. Bundel esbuild `AssistantService.js` OK.
- Belum: satu chat baru tersimpan ramping di `npm run desktop` — butuh saldo OpenRouter.
