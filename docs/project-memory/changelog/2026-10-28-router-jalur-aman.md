# 28 Oktober 2026 — Router gagal ke jalur aman; sintesis "multi-agen" hanya bila ada hasil sub-agent (Item 126 Fase 1)

Lanjutan [router kata utuh](./2026-10-28-router-kata-utuh.md) hari yang sama. Kode server — **berlaku sesudah Owner
men-deploy `agent-process`** (aktif sekarang: v533).

## Bukti dulu (riwayat chat, hanya agregat di database — nol isi pesan keluar)

Dari 418 jawaban yang punya langkah proses:

| | |
|---|---|
| LLM pengklasifikasi router gagal | **6** |
| …lalu Coordinator **juga gagal** (model & kunci sama) | **6 / 6** |
| …lalu sub-agent benar-benar jalan | **0** |
| …lalu tetap tercatat "Coordinator **memutuskan** tidak ada sub-agent" | **6 / 6** |
| Sintesis "multi-agen" dijalankan | 80 |
| …dengan **nol** sub-agent | **66 (82%)** |
| …dengan sub-agent sungguhan | 14 |

Jadi "router gagal → jalur mahal" (temuan 4) dalam praktiknya = **satu panggilan Coordinator yang pasti ikut gagal**.
Temuan yang lebih besar ketahuan saat menelusurinya: `synthesis_handler.ts` memilih cabang menurut "fase orkestrasi
dijalankan", bukan "ada sub-agent yang bekerja" — 66 kali model diberi *"Anda telah menugaskan beberapa sub-agent…
Riwayat pekerjaan sub-agent:"* dengan riwayat **kosong**: klaim palsu yang memancing model mengarang tindakan.
Perbaikan kedua ini di luar persetujuan awal — **ditanyakan dulu, Owner menyetujui** dimasukkan sekalian.

## Yang dibuat

- **`intent_router.ts`**
  - pengklasifikasi gagal → `isChatBiasa = true` (**jalur aman**: dijawab langsung, Coordinator tak dipanggil);
    langkah proses: *"⚠️ Intent Router gagal (…) → jalur aman: dijawab langsung tanpa sub-agent"*;
  - Coordinator gagal → `rencanaGagal`; baris *"Coordinator memutuskan tidak ada sub-agent"* **tidak** lagi ditulis
    sesudah gagal ("tidak ada" ≠ "gagal"). Coordinator yang berhasil memutuskan `[]` tetap ditulis — itu keputusan.
- **`synthesis_handler.ts`**: `tanpaHasilSubAgen` (`subagentRuns` kosong — ia hanya terisi bila Execution Planner
  benar-benar menjalankan sub-agent) → cabang **jawab langsung** (prompt = pesan asli; konteks sistem, riwayat, dan
  bahan pemeriksa label sama), langkah proses *"↩️ Tak ada sub-agent yang bekerja → dijawab langsung (bukan sintesis
  multi-agen)"*. Sub-agent yang jalan lalu gagal tetap lewat cabang multi-agen (kegagalannya ikut dilaporkan).

## Bukti

- **`uji/uji-router-jalur-aman.mjs`** (baru): `intent_router.ts` **dibundel sungguhan** (esbuild); yang ditiru hanya
  pemanggil LLM, parser rencana, daftar plugin. 16 pemeriksaan (jalur aman, Coordinator gagal, jalur normal tak
  berubah). **Mutasi 4/4 menggigit.**
- **`uji/uji-sintesis-tanpa-subagen.mjs`** (baru): `synthesis_handler.ts` dibundel sungguhan; yang ditiru hanya
  pemanggil LLM, telemetri, bus event, klien Supabase. Mode stream — handler mengembalikan **prompt yang akan dikirim
  ke model** tanpa memanggilnya. 10 pemeriksaan. **Mutasi 5/5 menggigit** (cabang kembali ke "fase orkestrasi",
  penanda selalu false / selalu true, alasan tak disebut, baris alasan muncul di obrolan biasa).
- Bundel esbuild `agent-process` lolos (0 karakter kendali). **Suite penuh 125/125** (110,7 s).

## Efek yang diharapkan

- Router gagal: jawaban datang lebih cepat (tanpa satu panggilan gagal), hasil akhirnya sama dengan yang selama ini.
- ±82% jawaban jalur Coordinator kini memakai prompt jujur (pesan asli), bukan sintesis dengan riwayat sub-agent
  kosong. Gaya jawaban bisa sedikit berubah — prompt sintesis memuat aturan format sendiri ("jangan format laporan",
  "sertakan gambar"); prompt langsung memakai aturan sistem biasa.

## Menunggu

- Deploy `agent-process` oleh Owner → periksa versi (533 → 534) & isi di platform.
- Bukti live di chat (saldo): langkah "jalur aman" / "↩️ Tak ada sub-agent yang bekerja".
