# 27 Oktober 2026 — Umpan balik 👍/👎 per jawaban (Item 126 Fase 0)

Item 126 ([`Roadmap Data Flywheel`](../../roadmap/Roadmap%20Data%20Flywheel%20%E2%80%94%20Mamet%20Ecosystem.md)), Fase 0.
Dipilih Owner sesuai usul: North Star roda gila = *biaya per jawaban **berhasil***, dan sampai hari ini tidak ada data
apa pun tentang jawaban mana yang berhasil. Tampilan disetujui Owner dari pratinjau: "transparan … sesuai tema dan
tidak mengganggu".

## Keadaan Fase 0 yang diperiksa lebih dulu (platform, 27 Okt)

- Penanda pemilih model: **8 dari 8** baris `cost_ledger` sejak 18 Okt bertanda (semua `tier-auto`) — cakupan 100%.
- Tetapi Gerbang 1 (≥ 100 pesan) belum bisa dinilai: sejak 18 Okt hanya **6** permintaan berhasil
  (`Capability.Executed`) dan **7** gagal (`PROVIDER_ERROR`), semuanya karena saldo OpenRouter. Dari aplikasi
  terpasang 4.3.x: 0 baris (belum ada chat berhasil sejak terbit).
- Catatan ukur: permintaan yang GAGAL tidak masuk `cost_ledger`, hanya `agent_logs` (`PROVIDER_ERROR`) — cakupan
  "≥ 99% request punya catatan" harus dihitung dari kedua tabel.

## Temuan sebelum membangun

- **Pesan jawaban yang tersimpan tidak membawa `traceId`** (dan tak punya `id`) — 👍/👎 tidak akan bisa disambungkan ke
  `cost_ledger`. Diperiksa: `trace_id` 8 baris `cost_ledger` tidak ditemukan di pesan mana pun.
- Server memakai `traceId` kiriman klien apa adanya (`request_parser.ts:12`), jadi cukup klien menyimpannya.
- **Jalur LOOKUP & skill tidak mengirim `traceId` sama sekali** — baris `cost_ledger` mereka ber-`trace_id` kosong.

## Yang dibuat

- **Migrasi `20261027000000_umpan_balik_jawaban.sql`** — diterapkan lewat alat Supabase atas izin Owner dan
  **diperiksa**, bukan dipercaya dari `success`: 7 kolom (`user_id` bawaan `auth.uid()`, `trace_id`, `nilai`,
  `workspace`, waktu), CHECK `nilai ∈ {-1, 1}`, unik `(user_id, trace_id)`, RLS + 4 kebijakan milik sendiri, hak `anon`
  dicabut. Tanpa kolom isi percakapan (Gerbang 1).
- **`AssistantService.js`** — LOOKUP & tiap langkah skill kini membuat dan mengirim `traceId`; ketiga pemanggil
  `_handleResponseStream` meneruskannya; jalur JSON & stream membawanya di `extras` `onDone`.
- **`ConversationEngine.jsx`** — `traceId` disimpan di pesan jawaban (stream, JSON, jawaban terlantar); `nilaiJawaban`
  menampilkan nilai lebih dulu, menyimpan, dan bila gagal **mengembalikan** nilai + menampilkan alasan.
- **`services/umpanBalikJawaban.js`** (baru) — `nilaiBerikutnya` (klik ulang = batal), `bolehDinilai` (hanya jawaban
  model selesai ber-`traceId`; pesan sistem & jawaban lama tidak), `simpanUmpanBalik` (upsert / hapus, user dari sesi).
- **`TombolUmpanBalik.jsx`** (baru) — tanpa latar & bingkai, `on-surface-variant` 40% saat diam, terang saat diarahkan,
  **terisi** & warna utama tema saat dipilih; selalu tampak (layar sentuh); `aria-pressed`.
- **Font ikon** (`npm run ikon`, unduhan atas izin Owner): `thumb_up`, `thumb_down` — 104 ikon, 30,5 KB (28,5 KB).

## Bukti

- **Platform**: dari klien yang belum masuk, baca & tulis langsung ke tabel → `42501 permission denied`; lewat layanan
  → ditolak lebih dulu ("belum masuk"). Tabel tetap 0 baris.
- **Pane** (komponen asli, tema Ruangan kayu): latar `rgba(0,0,0,0)`, bingkai 0 px, opacity 0,4; 👍 → 👎 → batal →
  gagal simpan berjalan benar (dipilih: `FILL 1`, warna emas tema; gagal: kembali tak terpilih + "Penilaian tidak
  tersimpan: …"); konsol bersih.
- `uji-umpan-balik-jawaban.mjs` v1 (baru, 5 bagian) — **5 mutasi menggigit** (LOOKUP tanpa traceId, pesan stream tanpa
  traceId, klik ulang tak membatalkan, tombol berlatar & berbingkai, gagal simpan tak dikembalikan).
- Dua uji lama merah karena perubahan ini dan diperbaiki di sisi kode/catatan, bukan dilonggarkan:
  `uji-kiriman-percakapan` (komentar mendorong `simpanTerlantar` keluar jendela yang dijaga → komentar diringkas),
  `uji-keadaan-chat-di-luar-layar` (`galatUmpanBalik` dicatat di `DAFTAR_LOKAL` beserta alasannya).
- Suite **120/120**.

## Belum dibuktikan

- Satu penilaian sungguhan masuk tabel & tersambung ke `cost_ledger` — butuh satu chat berhasil (saldo OpenRouter).
- Aplikasi terpasang: versi ditunda atas keputusan Owner — tombol sampai lewat rilis berikutnya.
