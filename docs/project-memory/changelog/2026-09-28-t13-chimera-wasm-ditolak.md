# 2026-09-28 — CHIMERA WASM ditolak masuk `agent-process` (T13)

**Permintaan Owner:** salin `chimera_wasm_bundle.ts` (244 KB, memuat biner WASM 184 KB) ke Edge Function
`agent-process` dan hubungkan ke `label_sumber.ts` sesuai panduan "Dua Benteng".

**Hasil: tidak disalin. Tidak ada satu berkas pun ditulis ke `agent-process`.** Alasannya dibuktikan, bukan
diduga.

## Yang dikerjakan

- Biner WASM dibongkar dari Base64, daftar bagiannya ditelusuri: **nol impor** → modul tidak bisa menyentuh
  jaringan, berkas, atau variabel lingkungan. *Service-role key* tidak terancam. Kekhawatiran keamanan awal
  **tidak terbukti** dan dicabut.
- Binernya (bukan sumber Rust-nya) dijalankan terhadap 6 kasus berbentuk dokumen Mamet nyata: **5 salah.**
  Terburuk — jawaban yang **benar** dicap `[PERINGATAN: KONTRADIKSI DOKUMEN]` keyakinan 0,95, karena polaritas
  diperiksa se-potongan; dokumen regulasi selalu menaruh hak dan larangan dalam satu pasal.
- Kebutaan negasi yang diklaim diperbaiki masih utuh: ganti "dilarang" → "terlarang", lolos.
- Kronologi git: WASM ini dibuat **1 jam 55 menit sesudah** Owner menolak integrasi CHIMERA (`a165508`,
  25/09 22:18). Penolakan lewat `backend/server.js` dijawab lewat `agent-process`.
- `CHIMERA_AUDIT_REPORT.md` butir 1.1 **sudah melarangnya sendiri** ("Jangan sambungkan ke pipeline produksi
  sebelum ini diperbaiki"); perbaikan yang disyaratkan (NLI/embedding) belum dikerjakan — yang dikirim adalah
  baris "Minimal:".

## Koreksi atas laporan asisten sendiri

Laporan pertama menyebut beberapa fungsi CHIMERA "selalu kosong / selalu 1.0 / dari `rng.gen_range()`" dalam
bentuk waktu sekarang — **dikutip dari dokumen audit tanpa memeriksa kodenya.** Dua commit remediasi sudah
mengisinya; remediasi itu pekerjaan sungguhan. Dokumen bukan bukti keadaan kode.

## Berkas

- `uji/uji-chimera-verifier-nyata.mjs` — **baru.** Audit biner + 6 kasus + pemeriksaan fungsi-murni. Melapor
  `DILEWATI` (keluar 0) bila folder CHIMERA tidak ada di laptop. Uji ini **gagal bila CHIMERA diperbaiki** —
  itu sinyal untuk meninjau ulang T13, bukan kerusakan.
- `docs/roadmap/ROADMAP-TEMUAN-TERBUKA.md` — T13 (temuan terbuka jadi 5), termasuk pertimbangan hipotesis
  Owner "kosong karena belum diuji dengan data Mamet": meleset untuk stub (terisi tanpa data Mamet), mustahil
  untuk verifier (fungsi murni, tak ada ekspor `learn`/`update`/`train` — nol impor yang membuatnya aman
  adalah nol impor yang membuatnya tuli), dan tepat untuk mesin CHIMERA yang memang menumpuk keadaan.
- `docs/roadmap/INDEX-ROADMAP.md` — 1 baris.

## Arah yang tersisa (menunggu keputusan Owner)

Gagasan CHIMERA yang layak diserap bukan binernya melainkan **penilaian per-klaim + atribusi per-klaim +
vonis `PARTIAL`** — ±150 baris TypeScript di `label_sumber.ts`, yang hari ini menilai jawaban sebagai satu
gumpalan. Jalan verifikasi makna sebenarnya sudah ditunjuk audit CHIMERA: NLI atau **embedding** — yang sudah
dimiliki Mamet (gemini-embedding-2, OpenRouter BYOK). Menyentuh biaya → keputusan tersendiri.
