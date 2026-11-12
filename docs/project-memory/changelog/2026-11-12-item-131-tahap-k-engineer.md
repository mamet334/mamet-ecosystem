# 12 November 2026 — Item 131 Tahap K: Engineer ikut dimaksimalkan (K.1–K.4)

Perintah Owner 12 Nov: *"catat, commit, push, lakukan k1-k4 otonom"* — atas pertanyaan *"apakah roadmap memaksimalkan
model juga sama untuk engineer?"*. Penomoran K.1–K.4 = langkah Tahap K, bukan kriteria hardening K1–K7.

## K.1 — Ukur apa yang sampai ke model

- Log `[PROMPT_KOMPOSISI]` (`llm_orchestrator.ts`) kini memecah segmen: `alat_folder`, `alat_rag`, `alat_web`,
  `konektor_crawler`, `konektor_umum`, `engineer_mode`, `konteks_engineer` (Brain 1/2), `engineer_identitas_aturan`.
  Dulu semuanya tercampur di "dasar_identitas_panduan" (22.000 huruf) dan "konteks_engineer" (17.600).
- `jejakSisipan` (klien) kini mengukur juga sisipan konstitusi & daftar perintah.

**Angka live (log server, Engineer, 12 Nov):**

| | Sebelum (14:51–15:13) | Sesudah (15:44, v565) |
|---|---|---|
| Prompt sistem tanpa potongan RAG | 45.946 | **35.919** |
| Prompt sistem dengan potongan RAG | 55.636 | **45.519** |
| Aturan identitas Engineer | (di dalam 17.626) | **5.693** |
| Konteks Brain 1/2 | (di dalam 17.626) | 2.964 |
| ENGINEER MODE | (di dalam 22.000) | **1.111** |
| **Konektor umum (alat GitHub MCP)** | (tak terlihat) | **13.890 — kini blok terbesar** |

Riwayat percakapan di sesi yang sama: 4.800–11.400 huruf.

## K.2 — Batas keluaran perintah = anggaran konteks Settings

- `alatFolderJalan.cjs`: `keluaranMaksByte` dari renderer, dipagari `batasKeluaranAman` (min 20 KB agar satu perintah
  tetap berguna, maks 4 MB = pagar memori proses utama); tanpa nilai (klien lama) tetap 20 KB.
- Engineer (`runCommand` → IPC `engineer:jalankan` dengan opsi) dan `folder_run` Assistant (sisa anggaran pertanyaan)
  mengirim anggaran konteks (`_batasBacaFolderHuruf`). Dialog izin, catatan "dipotong dari X byte menjadi Y byte", peta
  repo (ambang baris berkas besar diturunkan dari anggaran, angka KB disebut di bentuk indeks juga) memakai angka nyata.
- `constitution/28` §3a/3b: pernyataan "dipotong di 20 KB, tidak ada peringatan" diganti batas yang berlaku (kejadian
  bertanggal dibiarkan).

## K.3 — Prompt Engineer dirampingkan

- `engineer_context.ts` blok `[ENGINEER IDENTITY & CONVERSATION MODE]` **14.696 → 5.691 huruf**: dibuang RULE 1–4
  (ritual tinjauan/“Engineering Confidence”/“Self Verification”/laporan kesehatan — tak dibaca kode mana pun), anekdot
  bertanggal, ancaman "pelanggaran MAEF", "user MUST provide git diff" (Engineer menjalankan git sendiri), aturan basi
  *"Comments explain WHY"* (bertentangan dengan keputusan Owner 6 Nov → kini "tanpa komentar penjelas"), daftar program
  salinan tangan. Kontrak yang dibaca kode tetap: patch & `[MAMET_PATCH_READY]`, `[MAMET_CMD]`, `[MAMET_CRITICAL]`,
  `<uji_klaim>`, `<temuan>`, `<pengetahuan>`, baris "TUGAS YANG DIKERJAKAN", lampiran.
- `request_pipeline.ts` ENGINEER MODE **2.173 → ±1.100**; rujukan ke "RULE 1-6" yang sudah dihapus dicabut.
- Peringatan klien (klaim tak teruji, tugas tak diumumkan, mengaku menjalankan) **tidak** dicabut: itu pemeriksaan
  oleh kode, bukan aturan prompt.

## K.4 — Daftar perintah dari satu sumber

- `kebijakanPerintah(PROFIL.engineer)` di `alatFolderJalan.cjs` (tabel yang sama yang menolak/mengizinkan) → IPC
  `engineer:kebijakan-perintah` → `catatanKebijakanPerintah` → sisipan `[PERINTAH YANG BISA DIJALANKAN]` tiap pesan:
  yang jalan tanpa dialog (git baca), git yang boleh, program dengan dialog, yang ditolak karena internet /
  menerbitkan, batas waktu & keluaran. Prompt server merujuk catatan itu; salinan tangan (yang menyatakan "semua perintah
  lewat dialog") dibuang.

## Bukti

- Uji: `uji-komposisi-konteks-engineer` (segmen tepat, jumlah = panjang prompt), `uji-keluaran-anggaran-k2`
  (**15**, proses sungguhan 100 KB: utuh dengan anggaran 200 KB, 20 KB tanpa anggaran, 64 KB tepat), 
  `uji-engineer-ramping-k34` (**74**, tiap klaim catatan perintah dicocokkan dengan pagar yang dijalankan),
  `uji-peta-repo`, `uji-jejak-sisipan`; uji pembaca sumber `uji-audit-perintah` & `uji-perintah-tanpa-persetujuan`
  disesuaikan dengan parameter baru. **Mutasi 30/30 mati** di salinan scratchpad. Suite 169 (167 + 2 disesuaikan),
  bundel esbuild bersih, `vite build` berhasil.
- **Platform:** `agent-process` **v565** — 116 berkas = 110 identik, 0 berbeda, 6 berkas tipe dikosongkan platform.
- **Live:** Owner deploy + jalankan ulang `npm run desktop` + percakapan Engineer (12 Nov); angka log di atas.

## Lanjutan (12–13 Nov) — dua temuan dari uji live K.2

1. **Pemotong kedua 8.000 huruf.** Owner meminta Engineer membaca `AssistantService.js` (±75 KB) utuh; log server:
   pesan hasil perintah **8.589 huruf**. Sebab: `BATAS_KELUARAN_MODEL = 8000` di `pesanKeluaranPerintah`
   (`ProsedurEngineer.js`) memotong lagi keluaran (kepala + ekor) sebelum dikirim ke model — K.2 baru setengah.
   Perbaikan: `runCommand` memakai SATU anggaran untuk proses dan pesan ke model (`batasKeluaran` dikembalikan), kedua
   jalur (klik Jalankan & otomatis) meneruskannya; 8.000 hanya bila anggaran tak diketahui/lebih kecil; catatan potong
   menyebut batasnya. Uji: keluaran 75 ribu huruf utuh dengan anggaran 240 ribu; mutasi 6/6 mati.
2. **Model menulis `<MAMET_CMD: …>` berkurung sudut** (jawaban live: perintah tak jalan, percakapan berhenti; sebelumnya
   tag alat RAG tak sah dikembalikan ke model). Kemungkinan dari K.3: prompt kini memuat tiga alat bergaya `<alat_…>` dan
   contoh `[MAMET_CMD]` tinggal satu berisi penampung `<…>`. Perbaikan: prompt memberi 4 contoh konkret berkurung siku
   ("not an alat tag"), tanpa penampung; klien menormalkan `<MAMET_CMD: …>` → `[MAMET_CMD: …]` di luar nalar (perintah
   tetap lewat pagar & dialog yang sama). Mutasi 3/3 mati.

Suite **169/169**, `vite build` berhasil. **Platform:** `agent-process` **v566** — 116 berkas = 110 identik, 0 berbeda,
6 berkas tipe dikosongkan platform (memuat contoh perintah baru & `shared/folderKerjaAlat.js` dengan normalisasi).

## Belum dibuktikan / sisa

- Pembacaan berkas besar utuh (K.2) belum terlihat di log sesudah kedua perbaikan di atas — perlu satu percakapan
  Engineer lagi (muat ulang halaman `npm run desktop`).
- **Konektor umum 13.890 huruf** (daftar & skema alat GitHub MCP) dikirim di setiap pesan — kini penyumbang terbesar.
- `.exe` 4.5.0 mendapat K.2–K.4 & sakelar nalar di rilis berikutnya.
