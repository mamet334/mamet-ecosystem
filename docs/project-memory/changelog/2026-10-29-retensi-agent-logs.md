# 29 Oktober 2026 — Retensi agent_logs: 90 hari, diringkas dulu, lalu dihapus (Item 126 Fase 0)

Butir Fase 0 Item 126 "retensi otomatis dan ringkasan agregat — termasuk retrofit `agent_logs`". Keputusan Owner:
**90 hari**, **diringkas dulu**, plus `VACUUM FULL`.

## Diukur dulu (hanya agregat — tak satu pun isi log dibaca)

- Database **69 MB dari kuota 500 MB** — tidak darurat. `agent_logs` 15.561 baris / 4,3 MB.
- **13.786 baris (89%) dari Juni 2026**: `FALLBACK_TRIGGERED` 7.456 & `RATE_LIMIT_HIT` 6.051 — era kunci Gemini/Groq server
  (dihapus 15 Sep). Pertumbuhan kini ±250 baris/bulan (18 baris seminggu terakhir), rata-rata 142 bita/baris.
- Pembaca: dasbor (100 terbaru), pelacak eksekusi per `trace_id`, pemeriksaan dua-ujung sesudah deploy — semuanya log
  baru. Tak ada view/fungsi database yang memakainya.
- Ikut ketahuan: `net._http_response` **6,3 MB untuk 24 baris** — ruang kosong menumpuk lagi sejak dibersihkan 10 Sep.

## Yang dibuat — migrasi `20261029000000_retensi_agent_logs.sql`

- Tabel **`agent_logs_ringkasan`** (bulan × event_type × provider → jumlah) — **hanya hitungan, tanpa message & metadata**.
  RLS menyala tanpa kebijakan + hak `anon`/`authenticated` dicabut (diperiksa: keduanya tak bisa membaca).
- Fungsi **`ringkas_dan_hapus_agent_logs(batas_hari)`**: meringkas lalu menghapus dalam satu transaksi; kelompok yang ada
  DITAMBAH (aman dijalankan tiap hari); menolak batas < 30 hari (diuji: `(10)` → ditolak sebelum menyentuh apa pun);
  hak eksekusi `anon`/`authenticated` dicabut.
- Jadwal **`ringkas-agent-logs-harian`** `15 1 * * *` (08:15 WIB) — aktif, tercatat di repo (bukan dashboard).

## Penerapan pertama (manual, izin Owner)

| | Pembanding (sebelum) | Hasil |
|---|---|---|
| Kelompok yang diringkas | 30 | **30** |
| Baris diringkas = dihapus | 14.257 | **14.257** |
| Ringkasan per bulan | Mei 13 · Jun 13.786 · Jul 458 | **sama** |
| Log mentah tersisa | 15.561 − 14.257 | **1.304** (tertua 4 Agu) |

`vacuum full public.agent_logs; vacuum full net._http_response;` →

| | Sebelum | Sesudah |
|---|---|---|
| Database | 69 MB | **59 MB** |
| `agent_logs` | 4,3 MB | **472 kB** |
| `net._http_response` | 6,3 MB (24 baris) | **72 kB** (24 baris — tak ada data hilang) |

## Catatan

- `net._http_response` menggembung lagi dalam ±7 minggu (respons pg_net dari jadwal `health-checker-15min`). Tidak
  dijadwalkan `VACUUM FULL` otomatis (mengunci tabel); ukur ulang bila kuota dipertanyakan.
