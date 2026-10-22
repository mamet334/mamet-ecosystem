# ADR-CRW-0003: Misi Terstruktur dari MAEF, Crawler Tanpa LLM

Status: Accepted (disetujui Owner 2026-10-21; implementasi belum dimulai)
Tanggal: 2026-10-21
Diperjelas oleh: ADR-CRW-0006 (perencana dalam mode mandiri)
Diperbarui oleh: ADR-CRW-0008 (butir 4 tentang Pantauan tidak berlaku)

## Context

Owner ingin cukup memberi satu perintah bebas, misalnya "cari ilmu pengetahuan tentang fisika" atau "cari keluhan ASN
yang terpost publik". Perintah seperti ini harus diterjemahkan menjadi rencana: kata kunci, sumber yang cocok, rentang
waktu, dan batas jumlah.

`14_MAEF_ORCHESTRATOR_SPEC.md` menetapkan bahwa MAEF Orchestrator yang melakukan Intent Interpretation, Task
Decomposition, dan Capability Mapping, sedangkan capability adalah "otot" yang menjalankan. Dalam diskusi awal, crawler
sempat disebut "orchestrator". Penamaan ini perlu diluruskan supaya tidak bentrok dengan MAEF Orchestrator.

## Decision

1. **Perencanaan dilakukan di luar crawler.** MAEF (dengan Reasoning Port) menerjemahkan intent Owner menjadi Misi
   terstruktur. Sebelum adapter Mamet tersedia, perencana sementara adalah Claude Code melalui MCP (ADR-CRW-0005).
   Dalam kedua kasus, perencananya selalu LLM di luar crawler.

2. **Crawler tidak memanggil LLM dan tidak menafsirkan perintah bebas.** Komponen internal yang menjalankan misi
   disebut **Dispatcher** (Pengatur Misi), bukan orchestrator.

3. **Format Misi** (mengikuti Input Standardization Mamet):

   ```json
   {
     "type": "crawler.misi.jalankan",
     "context": {
       "owner_intent": "cari keluhan ASN soal mutasi 3 bulan terakhir",
       "bahasa": ["id"],
       "wilayah": "ID"
     },
     "payload": {
       "sumber": ["youtube", "reddit", "kaskus", "google_news"],
       "kata_kunci": ["mutasi ASN", "PNS dimutasi", "rotasi pegawai"],
       "kata_kunci_kecuali": ["lowongan"],
       "url_awal": [],
       "rentang_waktu": { "dari": "2026-07-21", "sampai": "2026-10-21" },
       "batas": { "per_sumber": 200, "total": 1000 },
       "komentar": { "ambil": true, "kedalaman": 2 },
       "buka_identitas_penulis": false
     },
     "trace_id": "maef-…"
   }
   ```

   `owner_intent` hanya disimpan sebagai jejak, dan tidak ditafsirkan oleh crawler. `sumber` wajib disebut eksplisit.
   Crawler tidak memilih sumber sendiri.

4. **Pantauan** memakai format yang sama dengan `"type": "crawler.pantauan.buat"` dan tambahan
   `"jadwal": { "setiap_menit": 120 }`. Setiap putaran pantauan menghasilkan misi turunan dengan `trace_id` yang sama.

5. **Katalog sumber dilaporkan lewat `ReportStatus()`**, supaya perencana bisa memilih sumber dengan tepat. Setiap entri
   berisi: `id`, `kanal`, `jenis_akses`, `kemampuan` (`cari`, `feed`, `komentar`, `url_langsung`), `bahasa`,
   `cocok_untuk` (label deskriptif, mis. `akademik`, `keluhan`, `berita`, `ulasan_aplikasi`), `butuh_kredensial`,
   `aktif`, `berbayar`, `batas_laju`, `confidence_dasar`, dan `kesehatan` terakhir.

6. **Eksekusi bersifat asinkron.** `Execute()` untuk misi langsung mengembalikan `misi_id`, lalu status dapat dipantau.
   Output akhir misi tidak memuat data, hanya ringkasan dan kursor. Datanya ditarik terpisah (ADR-CRW-0002):

   ```json
   {
     "result": {
       "misi_id": "01J…",
       "status": "selesai_sebagian",
       "per_sumber": {
         "youtube": { "diambil": 200, "baru": 187, "gagal": 0 },
         "kaskus":  { "diambil": 0, "baru": 0, "gagal": 1, "alasan": "403 setelah eskalasi tingkat 3" }
       },
       "kursor": "…"
     },
     "confidence": 0.82,
     "source": "ecosystem-crawler@0.1.0",
     "trace_id": "maef-…"
   }
   ```

   `confidence` di tingkat misi adalah rata-rata `confidence` tangkapan yang berhasil diambil. Status yang mungkin:
   `antri`, `berjalan`, `selesai`, `selesai_sebagian`, `gagal`, `dibatalkan`.

7. **Satu sumber gagal tidak menghentikan sumber lain**, seperti perilaku `scraping masalah` saat ini. Kegagalan
   dilaporkan per sumber beserta alasannya.

## Alternatives

- **Crawler memiliki perencana LLM sendiri.** Ditolak. Ini menduplikasi Reasoning Port, membuat crawler terkunci ke
  vendor LLM, menambah biaya token, dan melanggar pemisahan coordinator dan executor.
- **Perintah bebas diurai dengan aturan kata kunci di crawler.** Ditolak, karena rapuh dan tidak bisa memilih sumber
  untuk topik baru.
- **Crawler memilih sumber otomatis dari label `cocok_untuk`.** Ditolak untuk tahap awal. Keputusan pemilihan tetap di
  tangan perencana, dan label hanya informasi.

## Consequences

- Kualitas hasil sangat bergantung pada kualitas rencana dari MAEF/Claude. Katalog sumber yang deskriptif menjadi
  penting.
- Crawler mudah diuji secara deterministik: misi yang sama menghasilkan perilaku yang sama.
- Owner dapat menjalankan misi tanpa Mamet sekalipun, dengan menulis JSON misi lewat CLI.

## Impact Scope

Dispatcher, kontrak `Execute()` dan `ReportStatus()`, serta perencana di sisi Mamet atau Claude Code.

## Related Components

MAEF Orchestrator, Reasoning Port, Search Port, Research Port, Capability Adapter, Event System.
