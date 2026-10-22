# ADR-CRW-0008: Hanya Mode Reaktif, Tanpa Pantauan Terjadwal

Status: Accepted (keputusan Owner 2026-10-21)
Tanggal: 2026-10-21
Menggantikan sebagian: ADR-CRW-0001 butir 4 (mode Pantauan), ADR-CRW-0003 butir 4 (format Pantauan),
ADR-CRW-0005 butir 3 (penjadwal internal), ADR-CRW-0006 butir 2 dan 6 (perintah `crawler pantau`, pantauan di M2)

## Context

ADR-CRW-0001 merancang dua mode kerja: **misi** (tangan, sekali jalan atas perintah) dan **pantauan** (telinga,
berjalan terjadwal). Setelah mencoba M1 dan perintah lewat chat (MCP), Owner memutuskan bahwa crawler cukup bekerja
saat diperintah: ada aksi, baru bereaksi. Otomasi terjadwal tidak dibutuhkan.

## Decision

1. Crawler **hanya memiliki mode misi**. Setiap pengambilan data dimulai oleh perintah Owner, lewat CLI, preset, atau
   chat (MCP), atau kelak oleh MAEF atas perintah Owner.
2. Mode pantauan, tipe `crawler.pantauan.buat`, perintah `crawler pantau`, dan penjadwal internal **tidak dibangun**.
   `Execute()` tetap menolak tipe selain `crawler.misi.jalankan`.
3. Tahap M2 dinyatakan **selesai** dengan wajah MCP saja. Pekerjaan berlanjut ke M3.
4. Bila kelak Owner ingin pengulangan, caranya tetap reaktif: Owner (atau MAEF) menjalankan ulang preset misi yang
   sama. Dedup dan revisi di gudang (ADR-CRW-0002) sudah menangani pengambilan berulang.

## Alternatives

- **Tetap membangun pantauan terjadwal.** Ditolak oleh Owner, karena tidak dibutuhkan saat ini.
- **Memakai Windows Task Scheduler untuk menjalankan preset.** Tidak dibangun di dalam crawler. Owner tetap bisa
  melakukannya sendiri di luar crawler bila suatu saat berubah pikiran, karena CLI `crawler misi jalankan` sudah ada.

## Consequences

- Crawler lebih sederhana: tidak ada proses yang harus terus hidup, dan tidak ada misi yang berjalan tanpa
  sepengetahuan Owner.
- Risiko akses berlebihan ke sumber (rate limit, blokir) lebih kecil, karena tidak ada pengambilan otomatis berulang.
- Tren jangka panjang hanya terlihat bila Owner rutin menjalankan misi serupa.

## Impact Scope

Dispatcher dan capability (`Execute()`), CLI, MCP, serta rencana tahapan di ADR-CRW-0006.

## Related Components

Owner Sovereignty, MAEF Orchestrator, Workflow Port.
