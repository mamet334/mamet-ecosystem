# 2 November 2026 — Item 130 Tahap B: graf Home gratis & lampu jujur

[Roadmap Item 130](../../roadmap/ROADMAP-GRAF-HOME-PETA-SISTEM.md). Hanya kode klien (`frontend/`) — tak perlu deploy.
Dicek Owner di `npm run desktop` (tangkapan layar 13.12): SYSTEM STATUS DEGRADED, lampu sesuai di bawah.

## Gratis — yang dibuang dari setiap buka Home

| Dulu | Sekarang |
|---|---|
| `supabase.functions.invoke('ping')` — kuota Edge, hanya untuk lampu Edge | dibuang; Edge dinilai dari heartbeat yang ditulis agent-process sendiri |
| `agent_logs.select('*')` (100 baris ±29 kB, 11 kB metadata) | `KOLOM_LOG_AGEN`: `event_type, provider, created_at` + 5 nilai metadata lewat jalur JSON (tanpa `message`/`metadata` utuh); `bentukLogAgen` memulihkan bentuk `l.metadata?.…` untuk pembaca lama |
| `api_usage.select('*')` | `select('created_at')` (yang dipakai hanya jumlah & waktu terakhir) |
| `ai_system_logs.select('*')` | kolom yang ada & dibaca saja |
| `document_chunks` `id, document_id` | `document_id` saja |

Nol panggilan model sebelum maupun sesudah; tak ada polling (data diambil sekali, pembaruan lewat Realtime).
`storage.listBuckets()` tetap (satu permintaan kecil, satu-satunya sinyal Storage).

## Lampu jujur (`nilaiLampu`, `grafHome.js`)

Sinyal yang sudah ada, diukur dulu (hanya hitungan/tanggal):
- `service_heartbeat` ditulis agent-process **setiap selesai melayani permintaan** (HEALTHY/DOWN) — DOWN sejak 30 Okt
  18:25 = permintaan terakhir gagal, bukan fungsi mati (fungsinya sendiri yang menulis baris itu).
- `api_usage` (milik akun, RLS): panggilan model **berhasil** terakhir 27 Okt. `agent_logs` `PROVIDER_ERROR`: terakhir
  30 Okt. `agent_logs` lain tak andal sebagai denyut (`Capability.Executed` tanpa `user_id` → tak terbaca RLS;
  `VERIFICATION_DIAG` berhenti 5 Okt).
- Embedding: 0 baris model embedding di `api_usage` → tak ada sinyal.

| Lampu | Dulu | Aturan baru | Keadaan Owner 2 Nov |
|---|---|---|---|
| Agent Process | heartbeat DOWN → DOWN | DOWN → DEGRADED "permintaan terakhir gagal"; tanpa heartbeat → UNKNOWN | DEGRADED |
| Edge | `ping` | heartbeat ≤ 7 hari → HEALTHY, selain itu UNKNOWN | HEALTHY |
| LLM Provider | `ai_system_logs` (0 baris) → selalu HEALTHY | galat penyedia lebih baru dari keberhasilan → DEGRADED; tak ada keduanya ≤ 30 hari → UNKNOWN | DEGRADED |
| Embedding | HEALTHY bila potongan lama ada | UNKNOWN (tak ada sinyal) | UNKNOWN |
| Realtime | tak pernah diisi | dari callback `channel.subscribe` Home (`statusRealtime`) | HEALTHY |
| SYSTEM STATUS | DOWN | — | DEGRADED |

Alasan tiap lampu tampil saat barisnya disorot di panel (`title`, teks).

## Dua cacat warna ikut dibetulkan

- Graf disusun dengan `vitals` **state awal** (efek berjalan sekali, sebelum `setVitals`) → 11 simpul layanan selalu
  abu-abu bergaris merah. Kini satu objek terkini (`vitalsBaru`) untuk panel & graf; simpul layanan membawa `statusKey`
  dan warnanya dibaca dari vitals terkini saat digambar (Realtime yang terlapor belakangan ikut), garisnya mengikuti.
- UNKNOWN digambar **merah** (sama dengan DOWN) → kini abu-abu (`warnaStatus`); merah hanya untuk bukti kegagalan.

## Bukti

- `uji/uji-graf-home-tahap-b.mjs` 21/21 — termasuk keadaan Owner yang diukur, sinyal basi, tanpa sinyal, dan penjaga
  "gratis" atas 6 berkas Home (tanpa `functions.invoke`, `select('*')`, `setInterval`, panggilan model).
  **Mutasi 13/13 menggigit** (ping kembali, `select('*')` kembali, vitals basi, UNKNOWN merah, embedding dikarang hijau,
  urutan penyedia terbalik, heartbeat DOWN = mati, dll.).
- `uji-catch-diam`: catch diam `useDashboardData.js` 2 → 1 (try/catch `ping` ikut terbuang); patokan diturunkan 92 → 91.
- Suite 143/143; bundel esbuild `HomeDashboard`, `useDashboardData` OK.
- Live (Owner): DEGRADED PROVIDER membuktikan kueri `agent_logs` baru terbaca (tanpa PROVIDER_ERROR ia hijau dari
  keberhasilan 27 Okt); LLM CALLS 100 membuktikan kueri `api_usage`.
