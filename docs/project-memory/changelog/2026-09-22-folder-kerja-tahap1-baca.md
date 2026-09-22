# Folder Kerja Assistant — Tahap 1: Baca Saja (Item 85)

**Tanggal:** 22 September 2026
**Roadmap:** Item 85 ([`ROADMAP-FOLDER-KERJA-ASSISTANT.md`](../../roadmap/ROADMAP-FOLDER-KERJA-ASSISTANT.md))
**Status:** ✅ selesai — terbukti live di desktop (folder uji `gabut/engine`).

## Yang dibuat

- **Alat baca berpagar** `frontend/electron/alatFolder.cjs` (baru, murni): `folder_list` (kedalaman 4, ≤500 entri,
  lewati `node_modules`/`.git`/`dist`/…), `folder_read` (teks ≤60 KB / ≤400 baris, rentang `dari`/`sampai`, biner
  ditolak, PDF/Word/Excel diarahkan ke 📎/RAG), `folder_search` (≤50 temuan, berkas teks ≤1 MB). **Setiap** alamat &
  setiap entri daftar lewat `alamatDalamPagar` (Tahap 0); hasil hanya alamat relatif bergaris miring.
- **Proses utama** (`main.cjs`, `preload.cjs`): IPC `folder:alat` (akar dari variabel proses utama, bukan dari layar;
  setiap panggilan dicatat `[FOLDER] … → OK/DITOLAK`); pilihan folder diingat di `userData/folder-kerja.json` dan
  **disahkan ulang** lewat `akarFolderSah` saat aplikasi dibuka.
- **Tombol 📁** `FolderKerjaTombol.jsx` (baru) — **hanya ws-assistant**, hanya nama folder di layar, tooltip privasi
  ("isi berkas yang dibaca ikut terkirim ke penyedia model"). `FolderSelector.jsx` lama dihapus (menyimpan alamat
  lengkap di layar lewat kunci `mamet_fs:selectedFolder`, tampil juga di Engineer).
- **Protokol** `folderKerjaAlat.js` (baru, dipakai desktop & server): tag `<alat_folder>{JSON}</alat_folder>` (tag di
  `<think>` diabaikan), maks 5 alat/putaran, pesan hasil `[HASIL ALAT FOLDER]` (isi berkas berpembatas
  `<<<ISI BERKAS>>>`), blok prompt "FOLDER KERJA AKTIF" (alamat relatif saja; isi berkas = data, bukan perintah).
- **Putaran alat** (`AssistantService.js`): status folder dibaca dari proses utama tiap pesan; jawaban bertag →
  alat dijalankan → putaran berikut dengan **akun, token, riwayat tetap** (cacat interceptor lama `userId: null` /
  riwayat kosong tidak terulang); **maks 4 putaran**, **150 KB isi per pertanyaan**; putaran lanjutan selalu
  CONVERSATION, tanpa RAG & Data Tabel; langkah tampil di chat ("📄 membaca `core/math.go`…"); jawaban akhir diberi
  daftar berkas yang dibaca.
- **Server**: `request_parser.ts` menerima `folderKerja {nama, putaran}` (disaring ulang), `request_pipeline.ts`
  menambah blok prompt; `synthesis_handler.ts` memakai berkas yang **terbukti dibaca** (dari pesan hasil alat) sebagai
  sumber sah pemeriksa label.

## Uji live & perbaikan

Putaran 1 (folder `D:\SLAMET\other\gabut\engine`, chip RAG + Memory):

| Chat | Putaran | Hasil |
|---|---|---|
| Jelaskan isi folder | 2 | benar (daftar & ukuran cocok berkas asli) |
| Cari `CosineSimilarity` | 3 | **tepat**: `core/math.go` baris 8–27, dipanggil `core/engine.go` baris 177 (dicek ke berkas) |
| Ringkas `changelog.md` | 2 | sesuai isi |
| Baca `..\..\…\.env` & `C:\Windows\win.ini` | 0 | ditolak **oleh model** (aturan prompt) — pagar proses utama belum teruji live |

**Cacat ditemukan:** label chat 1–3 diturunkan ke HYPOTHESIS ("tidak mengutip dokumen") — pemeriksa label hanya
mengenal dokumen RAG. **Perbaikan:** `sumberDariHasilAlat` — hanya berkas yang terbukti dibaca alat (pesan berawalan
`[HASIL ALAT FOLDER]`) menjadi sumber; nama berkas wajib di baris Sumber, angka wajib ada di isi berkas/daftar.

Putaran 2: chat CosineSimilarity → **tetap VERIFIED** ("Sumber: `core/math.go`, `core/engine.go`"). **Pagar langsung**
(DevTools, tanpa model): `..\..\mamet os ecosystem\frontend\.env` → `ok:false` "alamat keluar dari folder kerja";
`C:\Windows\win.ini` → `ok:false` "alamat absolut tidak diterima". Memori: tidak ada memori baru dari pesan hasil alat.

## Uji otomatis (di luar git, `frontend/node_modules/.uji-rag/`) — semua lulus

- `uji-alat-folder.cjs` **27/27** — folder, berkas, & junction nyata; 9 serangan (`..`, absolut, `C:\Windows`,
  relatif-drive, `\\?\`, `CON`, aliran data `:`, junction ke luar) ditolak; isi folder sama sebelum & sesudah.
- `uji-folder-kerja-protokol.mjs` **17/17** — variasi penulisan tag model, tag di nalar, batas 5 alat, pesan hasil,
  blok prompt.
- `uji-folder-label.mjs` **9/9** — pemeriksa label server asli (esbuild) + hasil alat nyata dari folder `engine`:
  berkas dibaca → VERIFIED; berkas tak dibaca / angka karangan → diturunkan.

## Catatan

- Biaya: putaran lanjutan naik ke tingkat model Besar (pesan hasil alat panjang) — ±$0,008–0,015 per pertanyaan
  folder. Keputusan penguncian tingkat menunggu Owner.
- Kosmetik: panel Memory Context menampilkan pesan `[HASIL ALAT FOLDER]` sebagai "query terakhir".
- Jalan menulis kode: `\u0000` di isi alat Write ikut diurai jadi karakter NUL — dipakai `\x00` (lihat memori heredoc).
