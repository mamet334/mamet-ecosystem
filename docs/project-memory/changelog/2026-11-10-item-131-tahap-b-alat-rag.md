# 10 November 2026 — Item 131 Tahap B: model punya alat RAG sendiri

Perintah Owner 9 Nov: *"tahab b"*. Keputusan Owner: urutan potongan = **kolom `urutan` + "Perbarui" murah**; alat RAG
aktif di **Assistant + Engineer** (Mametlite tidak). Migrasi atas perintah Owner (*"jalankan migrasinya"*).

## Temuan sebelum membangun: urutan potongan tidak tersimpan — dan migrasi Tahap A mengacaknya

`document_chunks` tidak punya nomor urut; urutan hanya tersirat dari letak fisik baris. Migrasi Tahap A
`20261109063313_vektor_dalam_baris` menjalankan `cluster` pada kunci utama (UUID acak), sehingga jejak itu hilang.
Bukti: di 4 PDF bertanda `[Halaman N]`, 1.421 dari 2.828 pasangan berurutan "mundur" — sama persis dengan urutan acak.
Berkas cadangan juga diurutkan `id`. Pencarian RAG tidak terdampak (tidak butuh urutan); yang terdampak hanya membaca
dokumen berurutan. Seharusnya diperiksa sebelum `cluster`.

## Yang dibuat

1. **Migrasi `20261109090057_urutan_potongan`** — kolom `document_chunks.urutan` + indeks `(document_id, urutan)`;
   `simpan_kelompok_perbarui` mendapat `p_mulai` (urutan dari posisi kelompok); fungsi baru `cari_potongan_dokumen`
   (cari di dalam satu dokumen; saring akun, `selesai`, space tak diarsip). Kedua fungsi hanya `service_role`.
2. **`rag-process`** — unggahan baru & "Perbarui" menulis `urutan` 1..N; "Perbarui" dengan isi sama tetap menulis
   ulang bila urutan belum tersimpan (vektor disalin dari versi lama, tanpa biaya embedding).
3. **`shared/ragAlat.js`** (klien & server) — tag `<alat_rag>` (satu objek atau daftar `[…]`), pemeriksa argumen,
   penyusun hasil `[HASIL ALAT RAG]` (isi dokumen dinetralkan), catatan kerja, sumber untuk pemeriksa label, blok prompt.
   - `rag_daftar` — space & dokumen (judul, tanggal unggah, jumlah potongan, id), saring space/judul, urut
     terbaru/terlama/judul, halaman `dari`/`jumlah` (bawaan 100, maks 500).
   - `rag_cari` — kueri model sendiri (bawaan 8, maks 50), per space atau di dalam satu dokumen.
   - `rag_baca` — isi dokumen per potongan menurut `urutan`, maks 60.000 huruf per panggilan (sama dengan baca folder),
     sisanya dengan `dari`; dokumen lama terbaca dengan pemberitahuan "URUTAN TIDAK TERSIMPAN" + saran "Perbarui".
   - Putaran & alat per putaran memakai angka folder (4 × 5) sampai Tahap E. Setiap koreksi angka diberitahukan ke model.
4. **Server** — endpoint `action: 'rag_alat'` (`rag_alat_endpoint.ts`, akun dari token, Engineer dikunci ke space
   "Pengetahuan Engineer" seperti RAG otomatisnya), pelaksana `lib/rag/alat_rag.ts`, blok prompt hanya bila klien
   memintanya dan bukan Mametlite, hasil alat RAG menjadi sumber pemeriksa label.
5. **Klien** (`AssistantService.js`) — putaran alat seperti folder/konektor, membawa `signal` (tombol Hentikan),
   catatan kerja `📚 _RAG (dicatat dari proses utama…)_`, pesan hasil RAG dikenali sebagai putaran alat.

## Uji live pertama menemukan dua cacat (diperbaiki)

Model menulis `<alat_rag>[{…},{…}]</alat_rag>` (daftar dalam satu tag) — ditolak, dan penolakannya **diam** (tag mentah
tampil, model tak diberi tahu). Kini daftar diterima, dan tag yang semuanya tidak sah dikembalikan ke model sebagai
putaran berisi galatnya. Teks model yang sebenarnya dipakai sebagai kasus uji.

## Bukti

- Uji baru `uji-alat-rag-b.mjs` (basis data tiruan yang benar-benar menyaring: dokumen akun lain — termasuk yang
  `space_id`-nya milik akun ini — belum selesai, space arsip; urutan id ≠ urutan potongan). **Mutasi 27/27 mati** di
  salinan scratchpad (2 sempat hidup karena data uji terlalu rapi → data diperbaiki). Suite penuh **164/164**.
  `uji-hentikan-kiriman` menangkap `fetch` alat RAG tanpa `signal` → diperbaiki. Uji lama disesuaikan
  (`uji-unggah-bertahap` tiruan `.is()` & `p_mulai`, `uji-shared-t15` modul ke-11, dua uji galat).
- **Platform:** migrasi tercatat `20261109090057`, kolom ada, kedua fungsi tanpa hak `anon`/`authenticated`/`PUBLIC`.
  `rag-process` **v86** (isi menulis `urutan`, `p_mulai`, `urutanLengkap`); `agent-process` **v557**: 111 berkas = 105
  identik dengan repo, 0 berbeda, 6 berkas tipe dikosongkan platform.
- **Live (10 Nov 00:37–00:41 UTC, percakapan baru):**
  - "Dokumen paling awal di space sejarah aplikasi" — `rag_daftar` 2×, `rag_cari` 6× (4 putaran); jawaban
    `2026-06-23-execution-engine-stabilization-and-fail-fast-architecture.md` **benar** (dicocokkan dengan database:
    judul bertanggal paling awal di space itu), dengan catatan jujur bahwa baru 80 dari 385 judul dilihat.
  - "Bandingkan 2026-10-28-electron-45.md dan 2026-10-01-memori-engineer-bersih.md" — `rag_cari` 2×, `rag_baca` 2×
    (8 & 6 potongan); fakta yang dikutip ada di berkas repo; `[STATUS: VERIFIED]` lolos pemeriksa label.

## Belum selesai / temuan

- **Mametlite** belum dibuktikan tidak rusak (unggah ke `rag-process` ikut berubah).
- Pertanyaan 1 butuh 4 putaran: ke-385 dokumen diunggah dalam beberapa detik, jadi "terlama menurut unggahan" tak
  bermakna; `rag_daftar` dengan `urut: "judul"` (judul bertanggal terurut tanggal) akan menjawab sekali jalan — keterangan
  alat bisa menyebutnya.
- Dokumen lama baru bisa dibaca berurutan sesudah diunggah ulang dengan "Perbarui".
- Model menyebut blok contoh `xml_zip` di prompt sistem sebagai "perintah aneh" yang diabaikannya — bahan Tahap I.
- Pencarian gabungan masih kena batas 8 s (`rag_cari` 6,6–12,6 s) — sisa Tahap A.
