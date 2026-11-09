# ROADMAP-MAKSIMALKAN-MODEL — Item 131: Mamet Memaksimalkan Model, Bukan Membatasinya

**Keputusan Owner (6 Nov 2026):** *"keputusan anda kurang tepat, dan hanya membatasi aplikasi mamet yang seharusnya bisa
memaksimalkan kemampuan model llmnya. anda hanya memberikan keamanan semu saja. tidak membuat hal yang maksimal."* —
lalu *"buat roadmap dengan semua temuan"*.

**Hubungan dengan fase hardening ([ADR-0022](../adr/ADR-0022-mamet-cukup-dan-fase-hardening.md)):** sebagian besar temuan
menyentuh **K1** (RAG menemukan), **K2** (jujur saat gagal), dan **K5** (keamanan) — jadi bukan Parkir. Sisanya diambil
Owner dari Parkir lewat perintah di atas. Status hardening tetap ditutup dengan K1–K7 di
[`ROADMAP-HARDENING.md`](./ROADMAP-HARDENING.md); uji K1/K2 buku utuh (K1 langkah 3) **menunggu Tahap A** — tanpanya uji
itu akan kena batas waktu yang sama.

Legenda: 📋 terdaftar · 📝 berjalan · ✅ terbukti · 🔧 server (Owner deploy dulu) · 🖥 klien (ikut rilis) · 🗄 migrasi
(izin tersendiri) · 💳 butuh saldo OpenRouter

## Dampak ke Mametlite (keputusan Owner 9 Nov: cukup dipastikan tidak rusak)

Mametlite memanggil `agent-process` yang sama (`mametlite/src/lib/callAgentSimple.js`), jadi setiap perubahan server di
tahap A, C (C2/C3), D, F, H ikut mengubah perilakunya bagi pengguna luar (K4). Mametlite **tidak ikut diperbaiki** di
Item 131: kodenya tidak disentuh, termasuk pemangkas riwayatnya sendiri (`history.slice(-5)`). Setiap tahap yang
mengubah server wajib membuktikan Mametlite tidak rusak (satu chat + RAG di Mametlite live sesudah deploy, atau uji K4
diulang) sebelum ditandai ✅.

## Prinsip

1. **Buat model BISA dulu.** Untuk setiap kegagalan/batasan, jalan pertama adalah membuat model mampu: indeks agar cepat,
   alat agar model bisa menelusuri sendiri, batas berdasar anggaran — bukan hitungan kecil yang ditebak.
2. **Keamanan hanya di titik yang benar-benar melindungi:** izin Owner sebelum aksi berefek (tulis, hapus, kirim —
   Human-in-Command), isolasi data per akun, saring rahasia di log & lingkungan server MCP, hasil alat diperlakukan
   sebagai data. Pemblokir kata kunci bukan keamanan: penyerang tinggal memakai sinonim, dokumen Owner sendiri tertolak.
3. **Kegagalan yang jujur adalah jaring terakhir, bukan perbaikannya.** Bila sesuatu tetap gagal, model & pengguna
   diberi tahu apa adanya — tidak ada catatan palsu ("telah diringkas") dan tidak ada kegagalan yang hanya ke `console`.
4. **Biaya adalah kendali yang sah.** Konteks lebih panjang dibayar ulang setiap pesan; batasnya diturunkan dari batas
   biaya harian & jendela model yang dipilih Owner di Settings — satu sumber, terlihat, bukan pemangkas tersembunyi.

## Sumber temuan

- **Percakapan Assistant Owner 5 Nov** (11:15–17:53 UTC, 37 pertanyaan, mulai "apa yang anda tau tentang mamet?"):
  model menjawab "RAG kosong" untuk dokumen yang ada, lupa hasil pencarian folder, ditolak "Sistem Kebijakan Eksekusi"
  3×, isi berkas GitHub kosong. Dibaca dari tabel `chats` dan log edge function (`function_logs`).
- **Pindai graphify 6 Nov:** `graphify update .` → 13.066 node, 19.913 sisi, 709 komunitas. **278 berkas** yang
  terjangkau impor dari `agent-process/index.ts`, `AssistantService.js`, `electron/main.cjs`, `ConversationEngine.jsx`
  dipindai untuk 6 pola (pemangkas teks, batas waktu, blokir, batas hitungan, catatan palsu, kegagalan diam) — 979 titik,
  disaring manual. **Celah:** 43 berkas `.sql` tak masuk graf (`tree_sitter_sql` tak terpasang); fungsi RAG dibaca
  langsung dari database (`pg_get_functiondef`).

## Tahap 0 — Ukur apa yang benar-benar diterima model (gerbang semua tahap) ✅ 🔧🖥💳

**Status: Selesai 9 Nov 2026** — jejak per permintaan (server + klien, angka saja), gerbang `uji/lib/gerbangJejak.mjs`,
skenario `uji/uji-jejak-prompt-t0.js` (16 giliran); `agent-process` v551. Angka "sebelum": **MERAH 77** — RAG ketemu
lalu dibuang 11×, riwayat ke model ±7% di giliran terakhir, catatan palsu 11×, hasil alat hilang 6×, 1× dibatasi & 1×
BLOCK pada baca berkas ([log](../project-memory/changelog/2026-11-09-item-131-tahap-0-ukur-yang-sampai-ke-model.md)).
**Cara memakainya di setiap tahap:** percakapan BARU di Assistant → DevTools
`const t0 = await import('/@fs/D:/SLAMET/other/mamet os ecosystem/uji/uji-jejak-prompt-t0.js'); t0.mulai();` →
`await t0.jalankan()` → bandingkan `perKode` dengan angka "sebelum"; log server `[JEJAK_PROMPT]`. Sisa: jalur STREAM
(Mametlite) belum mencatat ukuran prompt panggilan model.

**Kenapa ini ada (keluhan Owner 6 Nov: "selama ini membuat aplikasi mamet seperti memperbodoh model reasoningnya").**
Suite 158/158, mutasi, dan uji K1 22/22 semuanya lulus — tetapi semuanya mengukur potongan kecil (satu fungsi, satu
pertanyaan baru, korpus kecil). **Tak ada satu uji pun yang mengukur isi prompt nyata dalam percakapan panjang dengan
korpus penuh dan alat.** Karena itu pembatas bertumpuk berbulan-bulan tanpa ketahuan: tiap lapis lulus ujinya sendiri.

**Arah.**
1. **Jejak prompt per permintaan** (server, satu baris log terstruktur, HANYA angka — bukan isi, aturan privasi): huruf per
   blok prompt; pesan & huruf riwayat yang dipilih klien vs yang sampai ke model; potongan RAG ditemukan vs dikirim
   (+ sebab bila berbeda: batas waktu, saringan); hasil alat yang terbawa dari pertanyaan sebelumnya; keputusan kebijakan
   (izin/batas); pemotongan apa pun beserta lapisnya.
2. **Skenario ujung-ke-ujung** di `npm run desktop` (pola modul konsol seperti `uji-mutu-rag-k1.js`): percakapan ≥15
   giliran di korpus penuh — pertanyaan RAG (termasuk dokumen di space besar), baca folder lalu "jangan dicari kembali",
   pertanyaan lanjutan, konektor.
3. **Gerbang:** riwayat yang sampai = yang dipilih klien; potongan RAG yang ditemukan = yang dikirim; hasil alat
   sebelumnya masih ada (dalam anggaran) atau tercatat sebagai catatan kerja; 0 pemotongan/penolakan diam-diam.
   Dijalankan sebelum & sesudah setiap tahap di bawah, dan sebelum rilis.

**Selesai bila:** skenario jalan di aplikasi sungguhan dan angka "sebelum" untuk keadaan sekarang tercatat (harus merah
di C2/C3/C4 dan A — itulah bukti alat ukurnya bekerja); mutasi: mencabut satu pemangkas mengubah angkanya.

## Tahap A — RAG cepat & tak membuang hasil (K1, K2) 📝 🗄🔧

**Status 9 Nov — sebagian** ([log](../project-memory/changelog/2026-11-09-item-131-tahap-a-rag-tak-dibuang.md)): hasil
RAG tidak dibuang lagi (skenario: habis waktu 14 → 0, ketemu-dibuang 11 → 0); `match_documents_hybrid` disusun ulang
(hasil identik, 20 kasus) dan vektor disimpan di baris; HNSW sengaja belum dipakai. **Sisa:** di pemakaian nyata
pencarian masih berayun 0,1–17 s dan bisa kena batas query 8 s (5/5 di uji terakhir) — dugaan: CPU/IO paket gratis
dibatasi sesudah pemakaian berat; periksa grafik CPU & Disk IO budget dashboard Supabase, ukur ulang sesudah database
istirahat, bila tetap lambat → HNSW dengan recall@8 diukur terhadap hasil tepat (izin migrasi tersendiri).

**Masalah.** Lima pertanyaan awal tentang changelog: log server `Tier 1 RAG timeout after 5000ms`, lalu 2–3 detik
kemudian `pencarian makna: 8 potongan (skor teratas 0.72–0.76)` — **ketemu, tetapi dibuang**. Sekali
`match_documents_hybrid` dibatalkan database (`statement timeout`, batas peran authenticator 8 s). Dokumen yang ditanya
(mis. `2026-10-20-satu-set-ikon.md`) ada di space "sejarah aplikasi mamet ecosystem" (385 dokumen).

**Bukti ukur (database live, 12.445 potongan):** hybrid dingin **6.907 ms**, hybrid hangat 794 ms, vektor saja 149 ms,
judul 11 ms. `document_chunks` **tanpa indeks vektor** (hanya btree `document_id`, GIN `fts`).

**Akar.** `match_documents_hybrid` menghitung jarak vektor, `ts_rank_cd`, dan dua `rank() over` untuk **setiap**
potongan akun, baru menyaring ambang & memotong `limit` — indeks tak mungkin dipakai, biaya naik lurus dengan korpus.
`context_builder.ts` `TIER1_RETRIEVAL_TIMEOUT_MS = 5000` lalu `Promise.race` membuang hasil yang datang belakangan.

**Arah.**
1. Susun ulang pencarian gabungan ke pola standar: **dua top-K terpisah** — vektor `order by embedding <=> q limit N`
   (indeks **HNSW** `vector_cosine_ops`) dan kata `fts @@ to_tsquery` (GIN yang sudah ada) — lalu gabung **RRF**.
   Ukur dulu dengan `EXPLAIN ANALYZE` bahwa indeks benar-benar dipakai bersama saringan `user_id`/`selesai`/space
   (pertimbangkan `ef_search` / iterative scan pgvector bila saringan membuang terlalu banyak kandidat).
2. Patokan mutu tak boleh turun: uji pengambilan Item 90 (recall@8 14/14) & set K1 dijalankan ulang sebelum/sesudah.
3. Hapus batas yang membuang hasil yang sudah ketemu; tenggat diganti anggaran yang menunggu hasil (dibatasi batas
   dinding 150 s), dan kegagalan nyata diteruskan ke model & pengguna (Tahap H).
4. Fungsi `match_documents` & `match_documents_judul` diperiksa dengan cara yang sama.

**Selesai bila:** pencarian dingin < 1 s pada korpus penuh (terukur), 0 hasil dibuang karena tenggat, recall@8 & set K1
tidak turun, mutasi membunuh uji urutan/indeks, **ukuran indeks diukur & dicatat** terhadap kuota 500 MB (9 Nov: DB
121 MB, `document_chunks` 81 MB, `vector(768)`, pgvector 0.8.0 — iterative scan tersedia; batas per akun 25.000
potongan), Mametlite tidak rusak.

## Tahap B — Alat RAG untuk model (K1) 📋 🔧🖥

**Masalah.** Model tidak punya alat RAG sama sekali: ia hanya menerima ±8 potongan sekali di awal pertanyaan. Ia tak bisa
mencari ulang dengan kata-katanya sendiri, melihat daftar dokumen, atau membaca satu dokumen utuh — permintaan Owner
"cek rag, apa yang ada di sana", "cari yang paling awal" mustahil dikerjakan. (Pindai: tak ada `rag_*`/`cari_dokumen`
di daftar alat.)

**Arah.** Alat dengan pola yang sama seperti alat folder (tag permintaan → dijalankan → hasil sebagai putaran berikutnya):
- `rag_daftar` — space milik pengguna + dokumen (judul, jumlah potongan, tanggal, selesai), bisa disaring & diurutkan.
- `rag_cari` — kueri tulisan model sendiri, opsional per space / per dokumen, jumlah hasil ditentukan model dalam pagar.
- `rag_baca` — isi satu dokumen berurutan (rentang potongan), untuk membaca utuh atau "yang paling awal".
Tetap hanya data milik akun itu (RLS/service role + `user_id`), hanya dokumen `selesai`.

**Selesai bila:** live — model menjawab "dokumen paling awal di space X" dan membandingkan dua changelog tanpa Owner
menempelkan isinya; uji mutasi untuk isolasi akun & saringan `selesai`.

## Tahap C — Konteks percakapan utuh (K1, K2) 📋 🔧🖥

**Masalah.** Model sudah mencari tetapi tidak ingat. Tiga pemangkas bertumpuk + satu lubang:

| # | Di mana | Yang terjadi |
|---|---|---|
| C1 | klien `KonteksChat.js` `pilihPesanKonteks` | anggaran token dari batas biaya harian & jendela model — **sah** (Owner yang mengatur) |
| C2 | server `request_parser.ts` | riwayat >15 pesan → pesan pertama + **catatan palsu** *"[MAMET HEALER: Memori obrolan lama telah diringkas…]"* (tak ada yang diringkas — dibuang) + 10 terakhir |
| C3 | server `history_compressor.ts` `rapikanRiwayat` | semua pesan kecuali 2 terakhir dipotong **800 huruf** |
| C4 | lubang | **hasil alat** (daftar/isi berkas, hasil konektor) hanya hidup di dalam putaran satu pertanyaan; tak disimpan di `chats` → hilang di pertanyaan berikutnya |
| C5 | klien `AssistantService.js` | konteks memori + dokumen + **hasil web** dipotong `MAX_RAG_CONTEXT_CHARS = 4000`, semantik `2000` |
| C6 | klien `CognitiveMemoryGovernorService` (`LEGACY_COGNITION_ENABLED = true`) | bila menolak, **seluruh** konteks memori + dokumen klien dibuang, hanya `console.warn` |
| C7 | klien `AssistantService.js` jalur lain | `LOOKUP` mengirim **3 pesan terakhir** (`history.slice(-3)`, rancangan [PR8](./PR8-linux-style-dispatch.md)); jalur skill **5** (`history.slice(-5)`) — di luar anggaran C1 (ditemukan saat membaca turunan INDEX 6 Nov) |

**Bukti log (5 Nov 17:06–17:22):** setiap kiriman `riwayat=11 pesan / 2.818–4.209 huruf` untuk percakapan 30+ pesan;
prompt sistem 10–16 ribu huruf; hasil `folder_list` ±26.000 huruf di satu putaran, nol di pertanyaan berikutnya. Saat
Owner menulis "data yang sudah anda dapatkan jangan dicari kembali", model memang tak memegangnya lagi.

**Arah.** Anggaran klien (C1) = **satu-satunya** penentu untuk semua jalur (termasuk C7); C2 & C3 dihapus (penjaga ukuran jendela model tetap di klien).
Hasil alat disimpan bersama jawaban dan dikirim ulang dalam anggaran; yang lama **dipadatkan menjadi catatan kerja**
(berkas yang sudah dibaca + fakta pentingnya), bukan dibuang. **Perlu keputusan Owner sebelum C4 dikerjakan:** hasil
alat berisi isi berkas Owner — menyimpannya di `chats` berarti isi berkas tinggal di Supabase (perluasan T12, bukan
hanya dikirim ke penyedia model) dan menambah ukuran tabel yang dirampingkan 2 Nov; pilihan yang ditimbang: simpan
catatan kerja saja, atau isi mentah dalam batas. C5 mengikuti anggaran yang sama. C6 **dihapus** (keputusan Owner —
lihat bawah). Catatan palsu dihapus.

**Selesai bila:** live — pertanyaan ke-N memakai hasil folder dari pertanyaan ke-(N−k) tanpa memanggil alat lagi; log
`[Riwayat]` = jumlah yang dipilih klien; uji mutasi untuk tiap pemangkas yang dicabut.

## Tahap D — Cabut keamanan semu (K5) 📋 🔧

**Masalah.** `execution_context.ts` menilai **seluruh teks yang dikirim** — termasuk isi berkas hasil alat — dengan daftar
kata ("ignore previous instructions", "system prompt", "developer mode", "reveal memory", "bypass", "all data", …),
panjang > 5.000 huruf, dan kata berulang:
- skor ≥ 4 → **BLOCK**: "Permintaan ditolak oleh Sistem Kebijakan Eksekusi". **Terbukti** saat membaca
  `constitution/04–08` — `07_ENGINEERING_SYSTEM.md` memuat "bypass" (+3) dan teksnya > 5.000 huruf (+1). Log 5 Nov:
  3× BLOCK (17:34–17:46).
- skor ≥ 2 → **ALLOW_WITH_LIMIT**: **alat dimatikan dan RAG diturunkan ke 2 potongan, diam-diam**. Terbukti 1× (17:26:56),
  tepat saat Owner meminta membaca repo GitHub. Pesan hasil folder sepanjang 26.000 huruf sudah +1 hanya karena panjang.

**Arah.** Pemblokir kata kunci & skor panjang dicabut. Perlindungan nyata yang dipertahankan: gerbang izin aksi berefek
(K17 konektor, izin tulis folder), isolasi akun, hasil alat & deskripsi pihak luar dinetralkan sebagai data
(`konektorUmum`), saring rahasia. Bila kelak dibutuhkan pengaman injeksi, ia menilai **apa yang hendak dilakukan model**
(aksi berefek) — bukan kata di dokumen.

**Selesai bila:** membaca seluruh `constitution/` tidak ditolak; tak ada jalur yang mematikan alat/RAG tanpa
pemberitahuan; uji K5 lain tetap hijau.

## Tahap E — Batas kerja berdasar anggaran (K1) 📋 🖥🔧

| # | Di mana | Sekarang | Arah |
|---|---|---|---|
| E1 | `shared/folderKerjaAlat.js` | `MAKS_PUTARAN = 4` × `MAKS_ALAT_PER_PUTARAN = 5` (model: "hanya 5 file") | putaran berdasar anggaran token/biaya pertanyaan; pagar tinggi hanya anti-putaran-tanpa-akhir; sisa anggaran terlihat |
| E2 | `shared/konektorAlat.js` | `MAKS_PUTARAN_KONEKTOR = 6` × `3` | sama dengan E1 |
| E3 | `reasoning_openrouter.ts` | `MAKS_TOKEN_JAWABAN = 8192` untuk semua model | dari kemampuan model (katalog OpenRouter) dalam anggaran |
| E4 | sub-agen `execution_handler.ts` / `tool_subscriber.ts` | maks 5 tugas ("Mamet Healer… Budget Limit"), 12 s per plugin, 24 s total, keluaran researcher 6.500 / deep_research 15.000 huruf | waktu & keluaran berdasar anggaran dalam batas dinding 150 s; label *"SISTEM DILINDUNGI OLEH MAMET HEALER"* diganti keterangan apa adanya |

Yang **dipertahankan**: baca folder 60 KB / 400 baris per panggilan (asal putaran cukup), keluaran perintah 20 KB,
hasil konektor 60.000 huruf per hasil, tunggu sambung MCP 90 s.

## Tahap F — Hasil web tidak diringkas ulang (K1) 📋 🔧

**Masalah.** `context_builder.ts`: bila total artikel web > 6.000 huruf (`WEB_CONTEXT_TOTAL_THRESHOLD`), tiap artikel
diringkas **LLM tambahan** ke 800 huruf (`WEB_CONTEXT_PER_ARTICLE_MAX`) — dibayar dua kali dan detail hilang; lalu di klien
dipotong lagi 4.000 huruf (C5).

**Arah.** Artikel masuk utuh dalam anggaran konteks; bila anggaran sempit, pilih artikel paling relevan (bukan
meringkas semuanya); model boleh meminta isi lengkap satu artikel.

## Tahap G — Isi berkas konektor GitHub sampai ke model 📋 🖥

**Masalah.** Membaca `README.md` & `INIT.md`: konektor melapor "successfully downloaded text file (SHA …)", tetapi
blok `[isi resource]` kosong — isi resource (embedded resource MCP) tak diteruskan ke prompt.

**Arah.** `teksHasil` (konektorMcp.cjs / sesiUmum.cjs) membaca isi resource teks (dan blob teks) dari hasil alat; uji
dengan bentuk balasan server GitHub yang sebenarnya.

## Tahap H — Kegagalan jujur, sebagai jaring terakhir (K2) 📋 🔧🖥

Bila setelah A–G sesuatu tetap gagal, model & pengguna diberi tahu apa adanya, sebagai "Catatan sistem" (pola yang sudah
dipakai `ragTurunKeKata`):
- RAG gagal/terlambat — sekarang hanya `processingSteps` + `ctx.state.tier1Retrieval` yang **tak dibaca siapa pun**;
- penolakan penjaga memori (C6), pemangkasan konteks yang tersisa, sub-agen yang dihentikan (E4);
- tidak ada lagi catatan yang tidak benar (C2) atau label pemasaran (E4).

## Tahap I — Prompt sistem melayani tugas, bukan sebaliknya (K1) 📋 🔧

**Masalah.** Log `[PROMPT_KOMPOSISI]` 5 Nov: `dasar_identitas_panduan` **8.100–13.500 huruf** (prompt sistem total
10.500–16.600) melawan riwayat percakapan ±2.800–4.200 huruf. Aturan 3–4× lebih panjang daripada percakapan yang sedang
dikerjakan — model menghabiskan perhatian dan nalarnya untuk mematuhi aturan, bukan untuk tugas Owner.

**Arah.** Inventaris isi prompt sistem per bagian (asal, alasan, apakah masih berlaku — banyak aturan lahir sebagai
tambalan atas gejala yang kini diperbaiki di A–H, mis. aturan "jangan mengaku menjalankan alat" karena model tak memegang
hasil alatnya). Pertahankan yang benar-benar mengarahkan (identitas, bahasa, format, kejujuran sumber); buang/padatkan
yang mengulang atau menambal. Diukur dengan set K1/K2 dan Tahap 0 sebelum & sesudah — mutu tak boleh turun.

**Selesai bila:** prompt sistem terukur lebih ramping, set K1/K2 tidak turun, Tahap 0 menunjukkan porsi konteks untuk
percakapan & bahan naik.

## Tahap J — Hapus semua komentar penjelas di kode Mamet Ecosystem ✅ 🔧🖥

**Status: Selesai 9 Nov 2026.** 6 Nov dikerjakan sebagian ([log](../project-memory/changelog/2026-11-06-item-131-tahap-j-hapus-komentar.md))
lalu dicatat ✅ padahal `uji/` tertinggal, tiga uji dilemahkan, dan server tak di-deploy. 9 Nov diperiksa ulang dan
dilengkapi — 0 komentar penjelas di cakupan, uji penjaga `uji-kode-tanpa-komentar`, tiga uji dikembalikan ketat,
`agent-process` v549 & `rag-process` v85 identik dengan repo ([log](../project-memory/changelog/2026-11-09-item-131-tahap-j-diperiksa-dan-dilengkapi.md)).

**Perintah Owner (6 Nov):** *"kode tidak usah memakai komentar yang hasilnya nanti akan menyesatkan secara perlahan"* →
*"masukkan juga tahap penghapusan semua komentar di kode mamet ecosystem."*

**Kenapa.** Komentar naratif (sejarah, tanggal, angka ukuran, "keputusan", nomor item) tak ikut berubah bersama kodenya;
sesi AI berikutnya membacanya sebagai keputusan yang harus dijaga — itu salah satu akar pembatas bertumpuk di roadmap ini.
Isi komentar tidak hilang: tetap ada di sejarah git, dan alasan yang penting sudah tercatat di changelog/roadmap/ADR.

**Cakupan.** Semua berkas kode yang dilacak git: `frontend/` (src + electron), `supabase/functions/`, `shared/`, `uji/`,
`scripts/`, `tools/`, `backend/`, `types/`, `capability/` (Python: komentar `#`).
**Di luar cakupan:** `mametlite/` (aplikasi live pengguna eksternal — hanya bila Owner memerintahkan), berkas migrasi
`supabase/migrations/` (catatan riwayat yang sudah diterapkan; komentar di dalam badan fungsi SQL ikut tersimpan di
database, jadi mengubahnya tanpa menerapkan ulang membuat repo ≠ database), `_knowledge_archive/` (kode arsip yang tak
dipakai — keputusan Owner 9 Nov: dibiarkan), `node_modules`, `graphify-out/`, keluaran build.

**Yang DIPERTAHANKAN (perintah ke alat, bukan penjelasan):** `/* @vite-ignore */` (4 — tanpanya impor dinamis rusak),
`// eslint-disable-next-line` (6), `// BATAS-UJI-DETIK: N` (penanda batas waktu yang dibaca `uji/jalankan-semua.mjs`),
dan direktif sejenis bila ditemukan (`@ts-*`, `deno-lint-ignore`, shebang, lisensi). Penanda `UJI-CERMIN:` ditulis
sebagai konstanta string. Penjaga sesudahnya: `uji/uji-kode-tanpa-komentar.mjs`.

**Cara (mekanis, bukan regex — `//` juga muncul di URL & string):**
1. Rentang komentar diambil dengan pemindai TypeScript (`ts.createScanner`, sudah terpasang di `frontend/node_modules`)
   untuk `.js/.jsx/.ts/.tsx/.cjs/.mjs`; Python dengan modul `tokenize`. Hanya rentang komentar yang dibuang, sisa berkas
   tak disentuh (baris kosong yang tersisa dirapikan).
2. **Bukti tiap berkas:** keluaran `esbuild` (transform + minify) **sebelum = sesudah** untuk JS/TS; `ast.dump` sebelum =
   sesudah untuk Python. Berkas yang berbeda = ditolak & diperiksa tangan. Plus pindai karakter kendali.
3. Suite penuh, `vite build`, bundel esbuild `agent-process` & `rag-process`. Uji yang memeriksa teks sumber bisa
   bergantung pada komentar — disesuaikan agar memeriksa kode, bukan komentar.
4. **Salinan Mametlite** (`uji-salinan-mametlite` menjaga modul `shared`/`services` yang disalin identik): **keputusan
   Owner 6 Nov — uji salinan diubah** agar membandingkan kode tanpa komentar (pemindai yang sama); `mametlite/` tidak
   disentuh.
5. Server: Owner deploy `agent-process` & `rag-process` → isi paket diperiksa di platform → changelog → commit (alur biasa).
6. Aturan sesudahnya: `CLAUDE.md` "Komentar kode" — kode tanpa komentar penjelas.

**Selesai bila:** 0 komentar penjelas di cakupan (dihitung pemindai), 0 berkas dengan keluaran build berbeda, suite &
build hijau, server ter-deploy sama dengan repo.

## Urutan (disetujui Owner 6 Nov)

0. **Tahap 0** (ukur ujung-ke-ujung) — gerbang semua tahap; tanpa alat ukur ini kesalahan yang sama bisa terulang diam-diam.
   **J** (hapus komentar) — **keputusan Owner 6 Nov: langsung sesudah Tahap 0, sebelum A**, supaya sesi yang mengerjakan
   A–I tidak lagi disesatkan komentar lama; perubahannya terbukti tak mengubah kode (keluaran build sama). Dalam
   praktik J selesai lebih dulu (9 Nov); Tahap 0 ✅ 9 Nov — **berikutnya Tahap A**.
1. **A** (RAG cepat) — syarat uji K1/K2 buku utuh.
2. **C** (konteks utuh) + **H** (kegagalan jujur) — model berhenti lupa & berhenti diam.
3. **B** (alat RAG) — dibangun di atas A.
4. **D** (cabut keamanan semu).
5. **E**, **F**, **G**, **I** (prompt sistem — sesudah C/H, karena sebagian aturannya tambalan atas gejala yang hilang di sana).
Perubahan server mengikuti alur biasa: bundel esbuild + uji + mutasi → Owner deploy → periksa paket di platform →
changelog → commit. Migrasi (indeks HNSW, fungsi pencarian) minta izin tersendiri. Perubahan klien ikut rilis
berikutnya sesudah 4.4.2.

## Keputusan Owner (6 Nov)

- **E1/E2 anggaran putaran alat: ANGKA SENDIRI** — bukan turunan batas biaya harian konteks. Diatur di Settings; nilai
  awal diusulkan (dengan ukuran biaya per putaran) saat Tahap E dikerjakan.
- **C6 penjaga memori lama: HAPUS** (keputusan Owner 6 Nov, atas rekomendasi) — terbukti tak pernah menolak:
  `AssistantService` mengirim konteks tanpa `source`, jadi `calculateTruthScore` selalu 0,4 ≥ ambang tolak 0,3, dan
  `latent` selalu kosong → selalu ALLOW. Penjaga yang tampak menjaga tetapi tak melakukan apa pun = keamanan semu;
  menghapusnya tidak mengubah perilaku. Dikerjakan di Tahap C. Pemanggil hidup satu-satunya (9 Nov):
  `AssistantService.js`; versi server `cognitiveMemoryGovernor.ts` hanya ada di `_knowledge_archive/`, tidak dipakai.
- **Graf:** hasil pindai lama dihapus, graf terbaru (6 Nov) dilacak di GitHub (`graph.json`, `graph.html`,
  `GRAPH_REPORT.md`). Celah 43 berkas SQL (`graphifyy[sql]` = unduhan paket) belum diputuskan.

## Pemetaan ke catatan temuan 6 Nov

Nomor di catatan percakapan → tahap: 1 & 13 → A · 2 → B · 6, 8, 12 → C · 3 & 7 → D · 4, 10, 11 → E · 9 → F · 5 → G ·
catatan kegagalan → H. Ditambahkan sesudah keluhan Owner 6 Nov: Tahap 0 (ukur ujung-ke-ujung) dan Tahap I (prompt sistem).

## Agar tidak terulang

Aturan kerja AI coding kini tertulis di [`CLAUDE.md`](../../CLAUDE.md) bagian **"Memaksimalkan model"** dan dipasang
sebagai pengingat di kepala [`INDEX-ROADMAP.md`](./INDEX-ROADMAP.md) — dua tempat yang pertama dibaca setiap sesi.
Akar yang diakui: (1) pembatas ditambah satu per satu dengan alasan lokal (biaya, kecepatan, "keamanan") dan tak pernah
ditinjau saat korpus & pemakaian tumbuh; (2) sesi AI berikutnya menjaga pembatas lama seolah keputusan Owner; (3)
kecenderungan AI memilih menambah penjaga daripada membuat model mampu; (4) uji mengukur potongan kecil, bukan isi prompt
nyata; (5) biaya dihemat dua kali — batas harian Owner DAN pemangkas tersembunyi; (6) **komentar kode naratif**
(sejarah, angka ukuran, "keputusan", nomor item) yang tak ikut berubah bersama kodenya — ia yang membuat pembatas lama
terbaca sebagai keputusan. Aturan komentar: `CLAUDE.md` "Komentar kode"; penghapusan menyeluruh = Tahap J.
