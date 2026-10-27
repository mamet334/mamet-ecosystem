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

## Terbukti live (`npm run desktop`, uji Owner 27 Okt)

- **Penilaian sungguhan pertama tersambung ke biaya**: `umpan_balik_jawaban` +1 (`ws-assistant`, 01:39:39 UTC) →
  `cost_ledger` lewat `trace_id`: `deepseek-v4-flash` · pemilih **`tier-auto`** · 3.845 token · **$0,000512** ·
  `completed`. Satu jawaban berhasil kini punya harga — pembilang North Star yang sebelumnya tidak ada.
- **Cacat ditemukan dari pemakaian, lalu diperbaiki**: pesan chat tersimpan membawa `traceId`, tetapi `umpanBalik` tetap
  `null` — chat disimpan 01:39:27, 👍 ditekan 01:39:39, dan tidak disimpan ulang. Sebab: `kunciSimpan`
  (`pemulihanChat.js`) hanya melihat id chat, jumlah pesan, dan pesan terakhir; 👍 pada pesan lama tidak mengubah
  satu pun, jadi chat dianggap tak berubah. Dibuka ulang → jempol tampil tak terpilih padahal tabel mencatat +1.
  Perbaikan: tanda penilaian (`<indeks><+|->`) ikut di kunci — kosong bila belum ada penilaian, jadi kunci chat tanpa
  👍/👎 persis seperti dulu (`uji-pemulihan-chat-v6` tetap lulus). `uji-umpan-balik-jawaban` v2 bagian 4b; mutasi
  (tanda dibuang dari kunci) menggigit.
- **Sesudah perbaikan** (Owner tekan 👍, muat ulang, jempol tetap terpilih): tabel `updated_at` 01:47:53 — **tetap 1
  baris** (upsert, bukan ganda); chat disimpan 01:47:54 dengan **`umpanBalik: 1`**. Suite 120/120.

## Penilaian ikut dicadangkan (Item 93)

Owner ingin penilaian kelak dipakai sebagai bahan algoritma. Diperiksa: "Cadangkan data" hanya mencadangkan 13 tabel —
**`umpan_balik_jawaban` dan `cost_ledger` tidak termasuk**, jadi pemulihan dari berkas cadangan (mis. pindah ke
Postgres lokal) akan kehilangan semua penilaian beserta sambungan biayanya. Keduanya bisa dibaca sesi pengguna sendiri
(RLS diperiksa: `cost_ledger_owner_select` `auth.uid()::text = user_id`; insert juga hanya milik sendiri).

- `cadanganData.js`: `cost_ledger` & `umpan_balik_jawaban` ditambahkan ke `TABEL_CADANGAN` (15 tabel).
- `scripts/kedaulatan/skema-pulih.sql`: definisi kedua tabel (kolom disalin dari `information_schema` database live) —
  tanpanya `pulih-cadangan.mjs` gagal, karena ia mengisi lewat `jsonb_populate_record(null::public.<tabel>)`. README
  diperbarui (13 → 15 tabel).
- `uji-cadangan-data.mjs` v2: keduanya ikut dicadangkan & cocok dengan hitungan; **setiap** tabel cadangan wajib punya
  definisi di skema pulih (penjaga umum, bukan hanya dua tabel ini). Dua mutasi menggigit.
- Belum dijalankan: pemulihan sungguhan ke Postgres lokal (`D:\SLAMET\other\pg-lokal`) — butuh berkas cadangan baru &
  menyalakan klaster lokal Owner.
- Suite: satu kali `uji-konektor-stealth` merah (bagian 5 membuka example.com sungguhan lewat Chromium); tiga putaran
  berikutnya lulus, berkasnya tidak disentuh perubahan ini. Sebabnya tak terekam — keluaran suite tidak menyimpan
  rincian kegagalan.

## Belum dibuktikan

- Aplikasi terpasang: versi ditunda atas keputusan Owner — tombol sampai lewat rilis berikutnya.
