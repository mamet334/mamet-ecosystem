# 9 November 2026 — Item 131 Tahap 0: mengukur apa yang benar-benar sampai ke model

Perintah Owner 9 Nov: *"mulai tahap 0 bagian kode"*. Tahap 0 adalah gerbang semua tahap Item 131
([roadmap](../../roadmap/ROADMAP-MAKSIMALKAN-MODEL.md)): suite dan mutasi selama ini mengukur potongan kecil, tak satu pun
mengukur isi prompt nyata dalam percakapan panjang dengan korpus penuh dan alat.

## Yang dibuat

**Jejak per permintaan (server, hanya angka — tanpa isi pesan).** `supabase/functions/agent-process/lib/jejak_prompt.ts`;
satu baris log `[JEJAK_PROMPT] {…}` dan medan `jejakPrompt` di jawaban DIRECT (termasuk jalur nalar hybrid):
- **riwayat**: yang diterima dari klien, lalu ukuran sebelum/sesudah di setiap lapis — `buang_tag_call`,
  `parser_15_pesan` (termasuk pesan yang disisipkan), `buang_think`, `rapikan_riwayat` (pesan yang dipendekkan,
  duplikat pesan saat ini), `bersihkan_data_tabel` (ditandai melindungi);
- **RAG**: diminta, batas waktu, habis waktu, potongan ditemukan/dikirim, dan **potongan yang datang sesudah batas
  waktu** (janji yang kalah balapan kini dipantau, bukan dibiarkan); turun ke pencocokan kata; data tabel menggantikan;
- **kebijakan**: keputusan, skor, alat/web dimatikan, RAG topK; **penolakan**: kebijakan eksekusi (jawaban BLOCK ikut
  membawa jejak), evidence gate, kuota;
- **panggilan model**: ukuran prompt sistem, pesan, riwayat yang benar-benar dikirim, per segmen (dibatasi 12 catatan,
  kelebihannya dihitung).

Urutan pemangkasan riwayat di pipeline kini satu fungsi bernama `siapkanRiwayatUntukModel` (`history_compressor.ts`) —
yang diuji adalah fungsi yang dijalankan. Parser tidak lagi memutasi pesan riwayat di tempat.

**Pengukur bersama** `shared/ukurRiwayat.js` (pesan, huruf, hasil alat `[HASIL ALAT FOLDER|KONEKTOR]`, sisipan berpatok)
dipakai server dan klien. **Jejak klien** `frontend/src/core/runtime/services/JejakKlien.js`: jalur percakapan, LOOKUP,
dan skill mencatat riwayat tersedia vs dikirim, pemotong konteks klien (4.000/2.000 huruf), status penjaga memori lama,
anggaran, dan tanda putaran alat; `AssistantService.riwayatJejak` memasangkannya dengan jejak server per `traceId`.
Jejak server **dipisahkan dari metadata pesan** sebelum disimpan — tidak masuk tabel `chats`.

**Gerbang** `uji/lib/gerbangJejak.mjs`: merah untuk riwayat hilang di jalan, pesan dibuang/dipendekkan oleh lapis yang
tidak diizinkan, catatan palsu, hasil alat tak terbawa ke giliran berikutnya, kebijakan membatasi, penolakan, RAG habis
waktu/ketemu dibuang/tak terkirim, pemotong klien, riwayat berubah sebelum model. Lapis yang diizinkan dan alasannya
tertulis (`buang_think`, `buang_tag_call`, `bersihkan_data_tabel`). **Skenario** `uji/uji-jejak-prompt-t0.js`: 16
pertanyaan dijalankan lewat kotak chat sungguhan di `npm run desktop`, laporan angka saja.

## Bukti

- `uji/uji-jejak-prompt.mjs` 66/66 — menjalankan parser, `siapkanRiwayatUntukModel`, pencatat RAG terlambat, jejak klien,
  gerbang, dan laporan skenario (aplikasi tiruan) yang asli; privasi: isi pesan tidak ada di log, jejak klien, maupun
  laporan. **Mutasi** di worktree terpisah: 17/17 + 2 susulan MATI (catatan palsu tak ditandai, jawaban tanpa jejak,
  hasil terlambat tak dicatat, lapis tak dicatat, lapis pemangkas dianggap sah, jejak tersimpan di metadata chat,
  penyebutan di tengah teks dihitung hasil alat, jejak dibuat sesudah kebijakan, batas catatan hilang, gerbang lupa
  kebijakan/klien-server, pencatat mengubah riwayat, pengelompokan & harapan giliran, tanda putaran alat, laporan tanpa
  gerbang, duplikat hasil alat, pemendekan dihitung per indeks).
- Suite penuh 160/160; `vite build` berhasil; bundel esbuild bersih; `uji-kode-tanpa-komentar` lulus.
- Disesuaikan: `uji-komposisi-konteks-engineer` (impor `jejak_prompt.ts` di salinan sementara), `uji-shared-t15`
  (modul `ukurRiwayat`).
- **Deploy oleh Owner:** `agent-process` v549 → **v550** (kode Tahap 0) → **v551** (perbaikan pencatat), ACTIVE,
  `verify_jwt: false`; isi paket v551 107 berkas = **101 identik, 0 berbeda**, 6 kosong (berkas tipe), 10 berkas
  `shared/` termasuk `ukurRiwayat.js`.

## Angka "sebelum" (skenario 16 giliran, 26 kiriman, 9 Nov 03:38–03:49 UTC, `npm run desktop`, Assistant)

Gerbang: **MERAH — 77 merah** (88 tercatat; 11 di antaranya salah hitung pencatat, lihat bawah).

| Temuan | Angka | Tahap |
|---|---|---|
| RAG dihentikan batas 5 s | 14 dari 16 giliran | A |
| RAG **ketemu lalu dibuang** (8 potongan datang 5,3–11,4 s) | 11 | A |
| RAG sampai utuh | 1 giliran (8 → 8); 1 dibatasi kebijakan (2 → 2) | A |
| Riwayat klien → server | utuh di semua kiriman (kehilangan terjadi di server) | — |
| Riwayat di giliran terakhir | dikirim 33 pesan / 54.330 huruf → ke model **11 / 3.953 (±7%)** | C |
| Catatan palsu "diringkas" + pesan dibuang parser | 11 kali (sejak riwayat > 15 pesan, model selalu 11 pesan) | C |
| Pesan lama dipotong 800 huruf | 21 | C |
| Hasil alat folder tak terbawa ke pertanyaan berikutnya | 6 | C4 |
| Kebijakan membatasi diam-diam | 1× ALLOW_WITH_LIMIT ("bypass"), 1× **BLOCK pada putaran baca berkas** | D |
| Prompt sistem vs riwayat ke model | 11.000–19.000 vs ±4.000 huruf | I |
| Konteks dipotong di klien / penjaga memori lama menolak | 0 / 0 di skenario ini | C5/C6 |

Owner sempat memilih folder kerja yang salah lalu menggantinya; itu mengubah isi berkas yang dibaca, bukan apa yang
diukur.

## Koreksi pada alat ukur sendiri

- Pembacaan pertama memberi merah palsu `hasil_alat_dibuang` pada putaran alat: yang dibuang hanyalah salinan ganda
  pesan saat ini (hasil alat dikirim sebagai pesan), isinya tetap sampai. Gerbang diperbaiki.
- `pesanDipotong` lapis `parser_15_pesan` dilaporkan 5–6 per kiriman padahal parser tidak memendekkan apa pun:
  pencatat membandingkan per posisi sementara urutan pesan bergeser. Kini per posisi hanya bila susunan sejajar, selain
  itu per identitas pesan (`shared/ukurRiwayat.js`, v551). 11 temuan merah di laporan 9 Nov karenanya tidak sah.

## Batas yang diketahui

- Jalur STREAM (Mametlite) mencatat log sebelum model dipanggil — ukuran prompt panggilan model belum tercatat di sana.
- Satu uji mutasi gerbang sempat dijalankan di checkout utama (beberapa detik, `uji/lib/gerbangJejak.mjs`), bukan di
  salinan; dipulihkan dan diuji ulang.
