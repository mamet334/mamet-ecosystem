# Prosedur Kerja Engineer — constitution, RULE 0, dan tiga penjaga kode

**Tanggal:** 23 September 2026
**Roadmap:** T10 di [`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md) (uji Engineer)
**Status:** ✅ selesai; sebagian besar terbukti live pada tiga putaran uji TUGAS-02

## Latar

Uji TUGAS-02 (22–23 September) menunjukkan kegagalan Engineer yang berulang bukan karena kurang pintar, melainkan
karena tidak punya **prosedur**: ia mengerjakan tugas yang salah tanpa sadar, mengulang perintah yang sama setelah
gagal, dan memakai bentuk perintah yang keliru (`git show <alamat>` tanpa `HEAD:` → keluaran kosong, disangka berkas
hilang). Owner meminta cara kerja itu dituliskan sebagai rujukan tetap.

## Yang dikerjakan

1. **`constitution/28_PROSEDUR_KERJA_ENGINEER.md`** — 12 langkah kerja, setiap aturan disertai kejadian nyata yang
   melahirkannya. Dua bagian penutup: aturan mana yang **dipaksakan kode** (aturan yang hanya ditulis akan dilanggar),
   dan **batas yang jujur** (prosedur memperbaiki ketertiban, bukan kecerdasan). Disambungkan ke pencarian rujukan
   Engineer (`FileSystemGateway.findRelevantADR`) dan daftar di `constitution/README.md`.
2. **RULE 0 di `engineer_context.ts`** (server) — ringkasan prosedur yang ikut di setiap permintaan, diletakkan
   sebelum RULE 1. Termasuk bentuk baris pengumuman yang wajib:
   `TUGAS YANG DIKERJAKAN: <id> — "<kutipan kalimat sumber>"`, larangan memakai id BRAIN 2 (`TASK-00xx`), dan contoh
   `[MAMET_CMD:]` yang benar (`git show HEAD:<alamat>`, `git grep -n … -- frontend/src`).
3. **`engineer/ProsedurEngineer.js`** (baru) — tiga penjaga deterministik:
   - `cekPerintahBerulang` — perintah sama persis tidak dijalankan lagi; jawabannya menyuruh ganti pendekatan dan
     TETAP dikirim ke model (berbeda dari penolakan aturan yang ditahan);
   - `petunjukHasilKosong` — `git show <alamat>` yang kosong diberi petunjuk `git show HEAD:<alamat>` (perintah Owner
     tidak diubah diam-diam);
   - `peringatanTugasTakDiumumkan` — pengguna menyebut "TUGAS-xx" tetapi jawaban tidak memuat baris pengumuman, atau
     mengumumkan tugas LAIN → peringatan sistem di bawah jawaban.

## Bug yang ditemukan lewat uji ini (semuanya diperbaiki)

| Bug | Akibat | Perbaikan |
|---|---|---|
| `trace_parser.ts` memotong trace dari BARIS PERTAMA bila ada pola ID | seluruh jawaban jadi kosong → HARD GATE `CHECK_001` memblokir, Owner hanya menerima "Verification Failed" (live 01:53) | pemotongan yang mengosongkan jawaban dianggap "tidak ada trace"; uji kendali membuktikan versi lama memang mengosongkannya |
| Penyimpanan chat berjalan sebelum pemulihan riwayat selesai | chat ditimpa SATU pesan laporan patch; percakapan uji putaran 1 hilang (live 09:29) | autosave & laporan pasca-muat-ulang menunggu `initialRestoreDone` |
| Tombol Undo menyerah bila Kernel belum selesai boot | pemulihan patch mustahil persis sesudah aplikasi memuat ulang — keadaan normal setelah setiap patch (live 09:33) | Undo memakai IPC `eng:git-rollback` langsung bila service belum ada; pesan gagal tak lagi menyarankan `git stash pop` (mekanisme lama) |
| Pola pengumuman menolak kutipan ber-backtick | pengumuman yang sah dikira tidak ada (live 09:00) | pola diperbaiki; kutipan boleh memuat backtick |
| Peringatan Vite `module-loader.js` (CORE IMMUTABLE, izin Owner) | peringatan di tiap `npm run desktop` | `import(/* @vite-ignore */ objectUrl)`; **uji kendali**: `npm run build` TIDAK memunculkan peringatan itu pada versi lama maupun baru (alat ukur salah), server pengembangan memunculkannya pada versi lama dan tidak pada versi baru |

## Hasil uji live TUGAS-02 (model `openai/gpt-4o-mini`)

Lulus: mengumumkan `TUGAS-02` dengan kutipan yang benar · membaca berkas dengan `git show HEAD:` · patch tepat satu
baris dokumentasi, fungsi tidak dihapus · percakapan tersimpan utuh (6 pesan).

Gagal: `git grep -n logCommand -- frontend/src` **tidak pernah dijalankan**, sehingga temuan "`logCommand` tidak punya
pemanggil (hanya definisi di baris 100)" tidak dilaporkan. Juga: usulan patch ditulis dari tebakan SEBELUM berkas
dibaca, lalu dikoreksi sendiri setelah isinya diterima.

Kesimpulan: Engineer **mampu mengikuti prosedur, belum mampu menilai**. TUGAS-03 sebelumnya juga menolak mem-patch
berkas CORE IMMUTABLE atas kesadarannya sendiri, tetapi penjelasannya salah letak.

Uji pembanding dengan model lain **belum sah**: setelan model utama tidak tersimpan, log server membuktikan kedua
putaran memakai `openai/gpt-4o-mini` yang sama (`[DEBUG][runLLM] rctx.model=`). Pemilih tingkat model memang
disembunyikan di workspace Engineer (disengaja — Engineer memakai model utama dari Settings, di luar tiering).

## Uji otomatis (di luar git)

`uji-prosedur-engineer.mjs` v3 **32/32**, `uji-trace-parser.mjs` v3 **9/9** (termasuk uji kendali versi lama dari
`git show HEAD:`), `uji-pemulihan-chat.mjs` v4 **23/23**, `uji-pagar-immutable.mjs` **15/15** (blokir CORE terjadi
sebelum checkpoint; patch campuran dibatalkan seluruhnya). Bundel `agent-process` ✅.

## Berikutnya

Uji pembanding model yang sah (pastikan Reasoning Report menampilkan model yang dimaksud) · tombol Undo belum teruji
live sesudah perbaikan · TUGAS-04 · T10 Tahap 2 (sumber web teknis).
