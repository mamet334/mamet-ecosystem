# 2 November 2026 — Item 130 Tahap C: pusat graf Home = MAMET dua belahan; Konstitusi 23 direvisi

[Roadmap Item 130](../../roadmap/ROADMAP-GRAF-HOME-PETA-SISTEM.md). Hanya kode klien (`frontend/`) + konstitusi — tak
perlu deploy. Dicek Owner di `npm run desktop` (dua tangkapan layar 13.52 & sesudah perbaikan): sesuai.

## Konstitusi 23 (`constitution/23_HOME_DASHBOARD_SPEC.md`)

Revisi 2 Nov dicatat di kepala berkas (revisi pertama dihasilkan AI; cocok untuk pengetahuan, bukan untuk sistem & fitur).
- **CENTRAL NODE:** `SUPABASE` ("node pusat mutlak") → **`MAMET`** dua belahan (Desktop/Klien & Server) dengan penyambung
  jalur pesan & putaran alat; `shared/` & Supabase = yang dipegang bersama.
- **LAYERS** (baru): lingkar 1 kemampuan inti + belahannya; lingkar 2 alat lewat tombol; data = ekor pemakainya; fondasi
  Supabase/OpenRouter/Electron.
- **STATUS LIGHTS** & **FREE & SAFE** (baru): lampu dari sinyal nyata, abu-abu bila tak ada sinyal; tanpa biaya; teks
  selalu teks; tanpa NIP; MCP baca-saja.
- Warna: Biru = kemampuan, Putih = MAMET & fondasi. Tata letak: Directory & Menu tertutup di awal.
- Tetap: inspirasi visual, prinsip inti, pertumbuhan dinamis, garis = relasi nyata (diperluas ke relasi di kode), panel
  kanan, mode live, tujuan emosional.

## Graf (`grafHome.js` `susunGrafHome` ditulis ulang)

| Dulu | Sekarang |
|---|---|
| bintang ke `SUPABASE KERNEL` + 5 cluster + 12 sub-cluster label kosong + 11 simpul layanan | `MAMET · DESKTOP` (−140, 0) & `MAMET · SERVER` (140, 0) dipaku, disambung **jalur pesan** berlampu (permintaan terakhir) |
| — | lingkar 1: Chat (D+S), RAG Dokumen (S), Data Tabel ASN (D), Engineer (D+S), Memori (S) |
| memori tanpa relasi melayang (10/10 milik Owner) | data = ekor: dokumen → RAG Dokumen, memori → Memori, percakapan Engineer (`ws-engineer`/`OWNER`/`ws-owner`) → Engineer, selebihnya → Chat; relasi memori ↔ percakapan/dokumen asal tetap |
| 11 lampu layanan | 3 fondasi berlampu gabungan (`statusGabungan`: terburuk yang diketahui): Supabase → kedua belahan, OpenRouter → server, Electron → desktop (lampu baru: `window.electronAPI` ada → hijau, web → abu-abu) |
| `zoomToFit(400, 50)` | `tataPas`: graf dimuat di bawah pita judul & legenda (`RUANG_ATAS` 150 px) |

Ikut diganti: sorotan jalur (`HomeDashboard`) & sorotan jejak gagal (`useDashboardData`) memakai kedua belahan, bukan
`core-maef`; legenda "Core / Infra" → "Kemampuan" + "MAMET / Fondasi"; garis berlampu memakai `warnaLampu` (vitals
terkini).

## Tata letak — diukur, bukan ditebak (`uji/lib/simulasiGrafHome.mjs`, sebaran data Owner)

1. Belahan dipaku ±60 → "MAMET · DESKTOP"/"SERVER" saling tindih di semua keadaan → ±140.
2. Dengan pegas saja, kemampuan (didorong awan datanya, RAG ±229 dokumen) terlempar **lebih jauh** dari fondasi
   (438 vs 323) → `gayaCincin` (rumus `forceRadial` d3): kemampuan 200, fondasi 480.
3. Tangkapan layar Owner 13.52: label kemampuan tertimbun titik datanya ("RAG Dokume●") → kerangka dilukis **paling
   akhir** (urutan daftar simpul); legenda tertimpa awan Chat → `tataPas`.
4. Pita atas mengurangi ruang tegak → "Data Tabel ASN" (tanpa ekor) menindih "MAMET · DESKTOP". Dicoba: jari cincin
   240/260 ✗, tolakan belahan −1200 ✗, garis kemampuan–pusat 150 → **230** ✓.

Hasil: 0 label tindih di 6 keadaan (layar Owner, 1920×1080, 768×900, data 2×, 120 memori, hampir kosong); fondasi di
lingkar luar (447 vs kemampuan 280); layar Owner skala 0,737 (setelan bawaan pada susunan yang sama: 8 tindih, 0,428).

## Bukti

- `uji/uji-graf-home-tahap-c.mjs` (baru): pusat, belahan tiap kemampuan (berpijak pada `tools/data_tabel.js` &
  `context_builder.ts`), ekor per sebaran Owner, tak ada simpul melayang, fondasi, lampu Electron, rumus cincin & `tataPas`,
  pita atas kosong, urutan lukis, telusur jalur percakapan → Chat → Server, teks Konstitusi 23.
- Uji Tahap A & B diperbarui ke susunan baru tanpa melemahkan penjagaan: gravitasi kini diuji langsung pada gaya yang
  dipasang; lampu diuji pada fondasi & jalur pesan.
- **Mutasi 17/17 menggigit** atas ketiga uji graf (mis. belahan ±60, tanpa/terbalik cincin, RAG di desktop, memori
  melayang, OWNER bukan Engineer, OpenRouter ke desktop, konstitusi lama, kerangka dilukis dulu, pita diabaikan, kembali
  ke `zoomToFit`, garis kemampuan 150). Satu mutasi semula lolos karena **setara** (saringan UNKNOWN di `statusGabungan`
  tak berpengaruh) → saringannya dibuang.
- `uji-ciri-tampilan`: warna tetap 5 → 6, glow 18 → 19 — titik legenda "Kemampuan", golongan yang sama dengan 5 titik
  legenda graf yang memang dikecualikan (alasan tercatat di berkas uji).
- Suite 144/144; bundel esbuild `HomeDashboard`, `useDashboardData` OK.
