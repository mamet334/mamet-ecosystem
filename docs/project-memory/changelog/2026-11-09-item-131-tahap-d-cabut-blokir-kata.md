# 9 November 2026 — Item 131 Tahap D: blokir kata kunci dicabut

Perintah Owner 9 Nov: *"mulai tahap D"*. Keputusan arah sudah tercatat di roadmap (6 Nov): pemblokir kata kunci & skor
panjang dicabut; perlindungan yang dipertahankan adalah yang menilai **tindakan**, bukan kata.

## Masalah yang dibuktikan

`execution_context.ts` memberi skor pada seluruh teks kiriman — termasuk isi berkas hasil alat: daftar kata ("ignore
previous instructions", "system prompt", "developer mode", "reveal memory", "bypass" +3; "all data", "dump all",
"entire database", "recursive agent requests" … +2), panjang > 5.000 huruf +1, kata berulang +1. Skor 2–3 =
`ALLOW_WITH_LIMIT`: alat dimatikan, web dimatikan, RAG diturunkan ke 2 potongan — **diam-diam**. Skor ≥ 4 = BLOCK
("Permintaan ditolak oleh Sistem Kebijakan Eksekusi"). Aturan P-002 di `policy_engine.ts` memakai skor yang sama.
Skenario v553 (9 Nov 07:39–07:43): 2 putaran alat pembaca berkas (45–56 KB) di-BLOCK dan pertanyaan "bypass" dibatasi.
Tidak melindungi apa pun: sinonim lolos, sementara dokumen Owner sendiri (`constitution/07` memuat "bypass" dan > 5.000
huruf) ditolak.

## Yang diubah (server)

1. `lib/request/execution_context.ts` — seluruh penilaian (daftar kata, panjang, kata berulang) dicabut; isi pesan tidak
   lagi mengubah alat, web, RAG, atau izin. Konteks tidak lagi membawa `decision`, `riskScore`, `toolsEnabled`,
   `policy.webSearchEnabled`.
2. `lib/request/policy_middleware.ts` — jalur BLOCK & ALLOW_WITH_LIMIT dihapus; tersisa `saringAlatMenurutKemampuan`
   (alat otomasi `cron_manager` hanya di mode AI).
3. `lib/verification/policy_engine.ts` — P-002 ("skor risiko ≥ 4 menolak panggilan model") dihapus; `riskScore` dibuang
   dari `PolicyContext`, `context_builder.ts`, `memory_write_worker.ts`.
4. `lib/jejak_prompt.ts` & `request_pipeline.ts` — bagian `kebijakan` di jejak dihapus (tak ada keputusan lagi untuk
   dicatat); penolakan lain (kuota, evidence gate) tetap tercatat dan tetap merah di gerbang.
5. **Privasi** (`request_pipeline.ts`): log `[L1] auth binding` mencatat 50 huruf awal isi pesan pengguna → kini hanya
   `hurufPesan` (panjang).
6. `import type` untuk impor yang hanya tipe (`execution_context.ts`, `policy_middleware.ts`, `policy_engine.ts`) agar
   bisa diuji langsung di Node.

**Tetap menjaga (menilai tindakan, bukan kata):** izin tulis folder & konektor (K17), isolasi akun, hasil alat
diperlakukan sebagai data, saring rahasia, gerbang `run_command` berbahaya (`tool_dispatcher.ts`), izin alat per
workspace (`policy_enforcer.ts`), Mametlite tanpa memori & folder kerja, aturan bukti Engineer P-001.

**Yang hilang:** teks berpola injeksi di dokumen tidak lagi ditandai — model membacanya sebagai isi. Bila kelak perlu
pengaman injeksi, ia menilai aksi berefek yang hendak dijalankan model. Cloudflare di depan Supabase tetap memblokir
pola path traversal (Parkir, keputusan Owner 9 Nov).

## Bukti

- Uji baru `uji-tanpa-blokir-kata-d.mjs` 15/15: 32 berkas `constitution/` + gabungan 04–08 (24.041 huruf) + 6 pola lama
  di 4 mode (AI, ASSISTANT, LITE, ENGINEER) → alat, web, RAG, izin, strategi sama persis dengan pertanyaan netral;
  perlindungan per mode tetap; P-001 tetap; tak ada daftar kata/skor di 104 berkas `supabase/functions`.
- **Mutasi di salinan scratchpad 7/7 MATI** (kata "bypass" menurunkan RAG, pesan panjang mematikan folder kerja, pesan
  panjang mengosongkan alat, kata berulang mematikan web, P-002 kembali, saringan otomasi dicabut, log mencatat isi
  pesan). Mutan "kata berulang mematikan web" mula-mula HIDUP → uji diperketat (membandingkan `execution` & `rag` juga).
- `uji-jejak-prompt` & `uji-konteks-utuh-c` disesuaikan (penolakan apa pun tetap merah). Suite penuh **163/163**; bundel
  esbuild bersih (521,6 kb), tanpa daftar kata di paket.
- **Deploy oleh Owner:** `agent-process` v553 → **v554** (08:16 UTC), ACTIVE, `verify_jwt: false`; paket 108 berkas =
  102 identik dengan repo, 0 berbeda, 6 berkas tipe saja dikosongkan platform (sama seperti v553).
- **Pertanyaan Owner di percakapan baru (08:17–08:25 UTC, 15 permintaan):** **0 penolakan**; rangkaian putaran alat
  pembaca berkas berjalan sampai selesai dengan pesan 19–33 ribu huruf per putaran dan riwayat sampai 106 ribu huruf
  (dulu > 5.000 huruf saja sudah +1, dan dua putaran 45–56 KB di-BLOCK); RAG 4× diminta → 8 ditemukan, 8 dikirim.

## Belum selesai

- **Mametlite** belum dibuktikan tidak rusak sesudah v553/v554 (satu chat + RAG live).
- RAG: keempat pencarian kena batas 8 s di hybrid (cadangan vektor menyelamatkan, 15–16 s) — sisa Tahap A.
- Kolom `kebijakan` di alat uji DevTools `uji-jejak-prompt-t0.js` kini selalu "-" (skrip tak diubah: mengubahnya wajib
  nama berkas baru).
