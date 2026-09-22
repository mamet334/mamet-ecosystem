# ROADMAP: FOLDER KERJA ASSISTANT

**Tipe Dokumen:** Engineering Roadmap
**Area:** Desktop Assistant (`ConversationEngine.jsx`, `AssistantService.js`, `electron/main.cjs`, `preload.cjs`) & `agent-process`
**Status:** 📝 **Tahap 0 selesai 2026-09-21** (jalur lama dihapus `ed19ba1`; pagar `folder:*` + `pagarFolder.cjs`, uji serangan 33/33, uji Owner 4/4 — [log](../project-memory/changelog/2026-09-21-folder-kerja-tahap0-pagar.md)); **Tahap 1 selesai 2026-09-22** (baca saja: folder_list/read/search berpagar, putaran alat ≤4, label dari berkas terbukti dibaca; live `gabut/engine` + pagar DevTools — [log Tahap 1](../project-memory/changelog/2026-09-22-folder-kerja-tahap1-baca.md)); Tahap 2 menunggu aba-aba Owner
**Tanggal:** 2026-09-15
**Roadmap Index:** Item 85

---

## 1. Tujuan

Tombol 📁 di kolom chat Assistant membuat Mamet **bekerja di dalam folder yang dipilih**, seperti asisten koding
bekerja di sebuah repo:

- tahu folder mana yang sedang dipakai;
- melihat daftar berkas lalu membaca yang perlu;
- membuat dan memperbarui berkas **di dalam folder itu**, sehingga hasil kerja tersimpan di sana;
- menjalankan perintah dengan folder itu sebagai folder asal;
- meminta izin Owner untuk tindakan yang mengubah sesuatu, lalu melapor hasilnya.

**Keputusan Owner (2026-09-15):**
- Folder kerja **hanya untuk workspace Assistant**.
- Engineer tidak memakai folder kerja ini. Engineer tetap bekerja di repo Mamet. Untuk Engineer, folder kerja kelak
  mungkin dipakai sebagai **sandbox**; lihat §7.
- **Jalur lama dihapus** (bukan sekadar dibiarkan mati); rinciannya di Tahap 0.
- **Ke server hanya dikirim nama folder dan alamat relatif.** Alamat lengkap (mis. `D:\Data\Proyek`) tetap di desktop.

---

## 2. Kondisi Sekarang (hasil penelusuran kode, 2026-09-15)

Semua potongan sudah ada, tetapi tidak saling tersambung. Tombol 📁 saat ini **hanya tampilan**.

| # | Putusan | Letak | Akibat |
|---|---|---|---|
| 1 | 📁 tampil di `ws-assistant` **dan** `ws-engineer`. Alamat folder hanya disimpan di state layar (`selectedFolder`) dan lewat `StorageManager.write('mamet_fs:selectedFolder')`; tidak dikirim bersama pesan dan tidak dibaca kode lain | `ConversationEngine.jsx:135, 1707`, `FolderSelector.jsx` | AI tidak tahu folder aktif |
| 2 | Plugin server `file_analyzer.ts` menunggu `[LOCAL FOLDER CONTENT]` di pesan; pengirimnya (`AIAgent.jsx` + `workspaceScanner.js`) adalah layar lama yang tidak dipakai lagi. Untuk Assistant, plugin ini juga disaring `workspace_guardian` (target SUPABASE) dan diblokir `policy_middleware` (`canUseDesktopTools=false`) | `plugins/file_analyzer.ts`, `components/AIAgent/` | Plugin tidak pernah bekerja untuk Assistant |
| 3 | Desktop Assistant mengirim `mode: 'ASSISTANT'`, sedangkan `canUseDesktopTools` hanya nyala untuk `mode === "AI"`. Prompt `[STATUS: DESKTOP NATIVE AWARENESS ENABLED]` (`<terminal>`, `<edit_file>`, `<search_disk>`, `<run_airdrop>`) **tidak** dikirim ke Assistant; prompt ini tersebar di **tiga** tempat | `execution_context.ts:49`, `request_pipeline.ts:358`, `llm_orchestrator.ts:247`, `stream_handler.ts:28` | AI Assistant tidak diberi cara apa pun untuk menyentuh berkas lokal |
| 4 | Pelaksana tag di desktop (`_runOSInterceptor` → `runDesktopInterceptors`) hanya jalan bila workspace punya `cap:code-execution`; izin itu tidak ada di metadata workspace mana pun | `AssistantService.js:1351`, `public/metadata/workspace.json` | Tag dari AI tidak akan dijalankan meski ada |
| 5 | `CommandRegistry` punya aturan batas folder (tulis hanya di dalam workspace), tetapi `setWorkspace()` tak pernah dipanggil dan jalur chat Assistant tidak memakainya | `CommandRegistry.js` | Batas folder tidak berlaku |
| 6 | Jalur berkas & terminal di Electron tidak berpagar folder: `fs:writeFile`/`fs:deleteFile` menerima alamat absolut mana pun; `edit-file-surgical` hanya menolak folder sistem & ekstensi berbahaya; terminal `exec` tanpa `cwd`; `<search_disk>` menyisir seluruh C:\ dan D:\ | `electron/main.cjs` | Bila dinyalakan apa adanya, AI bisa menyentuh berkas di luar folder pilihan |

**Temuan tambahan (berlaku bila interceptor lama dinyalakan):**
- `_runOSInterceptor` memanggil ulang `processMessage` dengan `userId: null`, `token: ''`, dan `history: []`, sehingga laporan
  eksekusi kehilangan akun dan konteks percakapan.
- Interceptor hanya menangkap **satu** `<terminal>` dan **satu** `<edit_file>` per jawaban.
- Interceptor menganggap **blok kode markdown tanpa bahasa** (atau berbahasa `bash`/`cmd`/`powershell`) sebagai perintah
  terminal. Contoh kode biasa di jawaban bisa ikut dijalankan; masih lewat dialog izin, tetapi membingungkan.
- `StorageManager` di Electron memakai backend berkas (`fs:writeFile` relatif ke akar proyek), bukan localStorage, sehingga
  kunci `mamet_fs:selectedFolder` ditulis sebagai nama berkas bertitik dua. Hasil tulisnya tidak ditemukan di akar repo.
  Penyimpanan alamat folder perlu diganti (lihat Tahap 1).
- Tombol **File Reader** sudah dihapus pada 2026-09-15. Berkas tunggal tetap lewat 📎 (`AssistantService.buildFileData`),
  sekali jalan, dan tidak diubah oleh roadmap ini.

**Yang sudah bisa dipakai ulang:**
- Dialog izin terminal dan edit berkas di `main.cjs`, termasuk blocklist perintah Windows/Unix dan pemecahan rangkaian
  perintah.
- `CommandRegistry` (daftar perintah yang diizinkan, penanda destruktif, batas workspace).
- Pola `[OS EXECUTION REPORT]` untuk mengembalikan hasil ke AI (setelah diperbaiki).
- Handler `fs:listFilesRecursive`, `fs:readFile`, dan `select-folder` (`openFolderDialog` di `preload.cjs`).

---

## 3. Prinsip

1. **Semua jalan di dalam folder.** Setiap alamat diselesaikan relatif terhadap folder kerja dan ditolak bila keluar dari
   folder itu (`..`, alamat absolut lain, symlink keluar). Pemeriksaan dilakukan di **proses utama Electron**, bukan
   hanya di layar.
2. **Baca bebas di dalam folder, ubah butuh izin.** Membaca tidak meminta dialog. Menulis, mengganti nama, dan
   menjalankan perintah memakai dialog. Menghapus memakai dialog tegas.
3. **Baca bertahap, bukan jejal.** AI meminta daftar berkas, lalu membaca berkas yang perlu dengan batas ukuran. Isi
   seluruh folder tidak dimasukkan ke prompt seperti pemindai lama.
4. **Tanpa folder, tanpa alat.** Bila 📁 kosong, alat folder tidak ditawarkan ke AI.
5. **Jujur.** Setiap hasil (berhasil, ditolak Owner, gagal, di luar folder) dilaporkan apa adanya. Tidak ada klaim
   "sudah disimpan" tanpa bukti dari proses utama.
6. **OpenRouter-first & tanpa kunci server baru** (sesuai Item 82).
7. **Jalur lama dihapus.** Folder kerja dibangun sebagai jalur baru yang berpagar, bukan menghidupkan kembali prompt
   `DESKTOP NATIVE AWARENESS`, `runDesktopInterceptors`, atau `file_analyzer.ts`.
8. **Alamat lengkap tidak keluar dari desktop.** Server dan model hanya melihat nama folder dan alamat relatif
   (`src/app.js`); desktop yang menerjemahkannya ke alamat sebenarnya di dalam pagar.

---

## 4. Rancangan Umum

```
[📁 pilih folder] → ConversationEngine (ws-assistant saja)
        │                └─ proses utama Electron mencatat folder akar
        ▼
AssistantService — payload: penanda folder kerja aktif (nama folder saja; alamat lengkap tidak dikirim)
        │
        ▼
agent-process — blok prompt "FOLDER KERJA AKTIF" + daftar alat folder (hanya bila penanda ada)
        │   (AI menjawab dengan permintaan alat)
        ▼
Desktop pelaksana alat → IPC folder:* di main.cjs (pagar alamat + dialog izin)
        │
        ▼
Hasil → dikirim balik sebagai laporan (userId, token, history tetap) → AI melanjutkan / menjawab
```

**Alat folder (usulan nama):**

| Alat | Tahap | Izin | Keterangan |
|---|---|---|---|
| `folder_list` | 1 | — | Daftar berkas & subfolder (lewati `node_modules`, `.git`, dll.), dengan ukuran |
| `folder_read` | 1 | — | Baca satu berkas teks, batas ukuran, rentang baris opsional |
| `folder_search` | 1 | — | Cari teks di berkas dalam folder, hasil dibatasi |
| `folder_write` | 2 | dialog + pratinjau | Buat/timpa berkas di dalam folder |
| `folder_edit` | 2 | dialog + pratinjau beda | Ganti potongan teks tertentu dalam berkas |
| `folder_rename` / `folder_mkdir` | 2 | dialog | Di dalam folder |
| `folder_delete` | 2 | dialog tegas | Di dalam folder; pertimbangkan ke Recycle Bin, bukan hapus permanen |
| `folder_run` | 3 | dialog | Perintah dengan `cwd` = folder kerja, blocklist lama tetap berlaku |

Format permintaan alat (tag di jawaban, atau function-calling bila penyedia mendukung) diputuskan di Tahap 1 berdasarkan
cara pipeline sekarang memproses jawaban (JSON/hybrid dengan nalar).

---

## 5. Tahapan

### Tahap 0 — Pagar & Pembersihan (prasyarat)
- [x] IPC baru `folder:*` di `main.cjs` dengan satu fungsi pagar alamat (folder akar dicatat di proses utama saat
      dipilih, bukan dipercaya dari layar setiap panggilan). ✅ 2026-09-21: `folder:pilih`/`status`/`lepas` +
      `frontend/electron/pagarFolder.cjs` (`akarFolderSah`, `alamatDalamPagar` — dinilai dari alamat sebenarnya,
      junction ke luar ditolak). Alat Tahap 1+ WAJIB memakai `alamatDalamPagar`.
- [x] **Hapus jalur lama** (keputusan Owner). ✅ `ed19ba1` (2026-09-15); `edit-file-surgical` **dipertahankan** (masih
      dipakai `CommandRegistry.writeFile`); mode `AI` diperiksa 2026-09-21 — **tidak pernah aktif** (parser mengisi
      `ASSISTANT`), akibatnya `cron_manager` selalu diblokir & `subAgentEnabled` selalu salah; dilaporkan, tidak diubah
      (keputusan Owner). Setiap penghapusan didahului pencarian pemakai; yang ternyata masih dipakai
      jalur lain dilaporkan dulu, tidak ikut dihapus diam-diam:
  - prompt `[STATUS: DESKTOP NATIVE AWARENESS ENABLED]` di `request_pipeline.ts`, `llm_orchestrator.ts`,
    `stream_handler.ts`, beserta "shadow interceptor" `<terminal>` di `stream_handler.ts`;
  - `_runOSInterceptor` di `AssistantService.js` dan `components/AIAgent/hooks/useDesktopInterceptor.js`
    (`<terminal>`, `<edit_file>`, `<search_disk>`, `<run_airdrop>`, Docker otomatis);
  - plugin `plugins/file_analyzer.ts` beserta rujukannya (`registry.ts`, `workspace_guardian.ts`, `policy_middleware.ts`,
    `policy_enforcer.ts`, `execution_handler.ts`, `intent_router.ts`), dan penanda `[LOCAL FOLDER CONTENT]` /
    `[DESKTOP DIRECTORY ABSOLUTE PATH]` di `request_parser.ts`;
  - layar lama `components/AIAgent/` (termasuk `workspaceScanner.js`) dan `components/AIAgent.jsx.bak`, bila tak ada
    pemakai lain;
  - IPC `edit-file-surgical` bila setelahnya tak ada pemakai;
  - mode `AI` di `execution_context.ts` diperiksa dulu (juga dipakai `canUseAutomation`, `subAgentEnabled`, dan fallback
    `desktopOSMode`) — dilaporkan ke Owner sebelum diubah.
  - **Tidak disentuh:** `run-terminal-command` (dipakai Engineer & `ModuleDiscoveryService`), `airdropEngine.cjs` & IPC
    `run-airdrop-stealth` (sengaja dinonaktifkan Owner, keputusan terpisah).
- [x] Putuskan nasib `fs:writeFile`/`fs:deleteFile` tanpa pagar (dipakai `StorageManager` & Engineer) — dibatasi atau
      dibiarkan untuk Engineer. ✅ **dibiarkan untuk Engineer**; folder kerja tidak memakainya. Temuan terkait: T8
      (perintah PowerShell dari alamat mentah di `CommandRegistry.js`).

### Tahap 1 — Baca Saja
- [x] 📁 hanya tampil di `ws-assistant`; alamat disimpan & dipulihkan tanpa kunci bertitik dua. ✅ `FolderKerjaTombol.jsx`; akar di `userData/folder-kerja.json` (proses utama), disahkan ulang saat dibuka; `FolderSelector.jsx` dihapus.
- [x] Payload membawa penanda folder aktif; server menambah blok "FOLDER KERJA AKTIF" + alat `folder_list`,
      `folder_read`, `folder_search`. ✅ format alat diputuskan: tag `<alat_folder>{JSON}</alat_folder>` (`folderKerjaAlat.js`).
- [x] Putaran alat: jawaban AI → desktop menjalankan alat baca → hasil kembali ke AI (dengan akun & riwayat) → jawaban
      akhir. Batas jumlah putaran per pesan. ✅ 4 putaran, 5 alat/putaran, 150 KB isi/pertanyaan. **Tambahan:** label
      VERIFIED dari berkas yang terbukti dibaca (`sumberDariHasilAlat` di pemeriksa label server).
- [x] Tampilan langkah di chat ("📂 membaca `src/app.js`"). ✅ + daftar berkas yang dibaca di bawah jawaban akhir.
- **Kriteria selesai:** "jelaskan isi folder ini", "cari di mana fungsi X", dan "ringkas dokumen Y di folder" terjawab
  dari isi berkas nyata; permintaan membaca `..\` atau `C:\Windows` ditolak di proses utama (bukti log).
  ✅ live: ketiganya terjawab tepat (baris 177 / 8–27 dicek ke berkas), label VERIFIED; `..\..\…\.env` & `C:\Windows\win.ini`
  → `ok:false` di proses utama (DevTools). **Sisa kecil:** biaya putaran lanjutan (tingkat model Besar) — keputusan
  Owner; panel Memory Context menampilkan pesan hasil alat sebagai "query terakhir".

### Tahap 2 — Tulis & Perbarui
- [ ] Alat `folder_write`, `folder_edit`, `folder_mkdir`, `folder_rename`, `folder_delete` lewat `CommandRegistry`
      (`setWorkspace` dipanggil saat folder dipilih).
- [ ] Dialog izin menampilkan berkas & pratinjau perubahan; tolak = dilaporkan jujur.
- **Kriteria selesai:** "buat laporan.md berisi ringkasan" menghasilkan berkas di folder terpilih setelah izin;
  mengedit berkas hanya mengubah potongan yang diminta; penulisan di luar folder ditolak.

### Tahap 3 — Perintah
- [ ] `folder_run` dengan `cwd` = folder kerja, dialog izin & blocklist tetap.
- **Kriteria selesai:** perintah berjalan di folder terpilih (bukti keluaran `cd`/`dir`), rangkaian perintah berbahaya
  tetap diblokir.

---

## 6. Risiko & Pertanyaan Terbuka

- **Format alat vs pipeline sekarang:** jawaban akhir berupa JSON/hybrid dengan nalar; perlu dipastikan putaran alat
  tidak merusak label status, nalar, dan batas waktu 130 s (Item 83).
- **Biaya:** setiap putaran alat = satu panggilan model tambahan; perlu batas putaran & batas ukuran baca.
- **Berkas biner/besar:** PDF/Word di folder — dibaca teksnya saja, dilewati, atau diarahkan ke jalur 📎/RAG.
- **Privasi:** isi berkas yang dibaca ikut terkirim ke penyedia model pengguna; perlu disebut jelas di UI.
- **Alamat di jawaban model:** model bisa saja menulis alamat absolut; pelaksana alat wajib menolaknya (hanya alamat
  relatif yang diterima), dan hasil alat yang dikirim balik tidak memuat alamat lengkap.
- **Mametlite/web:** di luar cakupan (tanpa Electron, tanpa alat folder).

---

## 7. Catatan untuk Nanti — Engineer

Owner (2026-09-15): bagi Engineer, folder kerja mungkin lebih cocok sebagai **sandbox** — tempat mencoba perubahan tanpa
menyentuh repo Mamet. Tidak dikerjakan di roadmap ini; pagar alamat dari Tahap 0 bisa dipakai ulang bila ide ini
dijadwalkan.
