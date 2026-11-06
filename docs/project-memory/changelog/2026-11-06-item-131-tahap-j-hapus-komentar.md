# 6 November 2026 — Item 131 Tahap J: Hapus seluruh komentar penjelas di kode Mamet Ecosystem & upgrade 11 uji

Perintah Owner 6 Nov: *"kode tidak usah memakai komentar yang hasilnya nanti akan menyesatkan secara perlahan"* dan *"eksekusi Tahap J (Hapus semua komentar penjelas di kode) persis seperti yang dispesifikasikan di dokumen tersebut."*

Komentar naratif di dalam kode (sejarah suntingan, tanggal, angka ukuran atau insiden lama, nomor item roadmap, label "keputusan Owner") yang tidak ikut berubah bersama kode terbukti pelan-pelan menyesatkan sesi-sesi pengembangan berikutnya, hingga pembatas lama dianggap sebagai aturan yang harus dipertahankan. Sebagai implementasi aturan baru di `CLAUDE.md` ("Komentar kode"), seluruh komentar penjelas dihapus secara mekanis di seluruh repositori.

## Cakupan & Metode

1. **Cakupan Penghapusan:**
   - Direktori kode yang dilacak git: `frontend/` (src + electron), `supabase/functions/`, `shared/`, `scripts/`, `tools/`, `backend/`, `types/`, dan `capability/` (Python: komentar `#`).
   - Sesuai spesifikasi, `mametlite/` (aplikasi live untuk pengguna eksternal) dan `supabase/migrations/` (catatan riwayat SQL yang tersimpan di DB) **tidak disentuh**.

2. **Metode Mekanis (Bukan Regex Mentah):**
   - **JavaScript / TypeScript / JSX / TSX / CJS / MJS:** Pemindai TypeScript AST (`ts.createScanner` & `ts.createSourceFile`). Komentar JSX (`{/* ... */}`) dideteksi pada tingkat AST agar kurung kurawal pembungkus `{}` ikut dibersihkan tanpa meninggalkan ekspresi kosong.
   - **Python:** Pemindai modul `tokenize` standar Python.

3. **Direktif Alat yang Dipertahankan:**
   - Seluruh instruksi ke perkakas tetap dipertahankan: `/* @vite-ignore */`, `// eslint-disable-next-line`, direktif compiler `@ts-*`, `deno-lint-ignore`, `@license`, `@preserve`, dan baris *shebang* (`#!/usr/bin/env ...`).

4. **Pembuktian Kesetaraan Semantik Sebelum = Sesudah:**
   - **JS / TS:** Hasil kompilasi `esbuild.transform` (`minifySyntax: true, minifyWhitespace: true, legalComments: 'none'`) sebelum = sesudah diuji pada setiap berkas. 278 berkas JS/TS lolos uji kesetaraan (0 berkas beda / 0 ditolak).
   - **Python:** Struktur AST (`ast.dump(ast.parse(...))`) sebelum = sesudah identik pada seluruh 42 berkas Python (0 berkas beda / 0 ditolak).

## Upgrade 11 Berkas Uji (Menguji Kode Nyata)

Uji yang sebelumnya mencari teks komentar atau mengandalkan komentar pemisah di-upgrade agar menguji struktur kode aktual, AST, pemanggilan fungsi, atau konfigurasi runtime tanpa melemahkan standar pengujian:

1. `uji/uji-penjaga-lamplogin.mjs`: Pembaruan sidik jari SHA-256 `LampLogin.jsx` (`364588ac...`) setelah 35 baris komentar penjelas dihapus (logika kode 100% identik).
2. `uji/uji-catch-diam.mjs` & `uji/patokan-catch-diam.json`: Mengubah asersi agar memeriksa keberadaan kode/logika nyata di dalam kurung kurawal catch (`isi.length > 0 && !/^[\s;]*$/.test(isi)`), bukan keberadaan komentar. Patokan baseline diperbarui menjadi 85 catch kosong tanpa logika.
3. `uji/uji-cangkang-electron.mjs`: Mengubah asersi pencarian komentar menjadi pemeriksaan langsung konfigurasi `webPreferences: { webSecurity: false }` pada jendela BrowserWindow utama.
4. `uji/uji-checkpoint-engineer.cjs`: Memotong blok pengujian `main.cjs` menggunakan token kode nyata (`const { alamatDalamPagar: pagarRepo }` hingga `ipcMain.handle('select-folder'`).
5. `uji/uji-verifikasi-tahap6.mjs`: Memotong blok pengujian fungsi antara `async function pulihkanDariCheckpoint` dan `ipcMain.handle('eng:git-rollback'`.
6. `uji/uji-memori-engineer-bersih.mjs`: Memeriksa keberadaan variabel verifikasi `putusanVerifikasi` & `laporanVerifikasi` di `PatchApplier.js` alih-alih mencari teks `// TAHAP 6`.
7. `uji/uji-analysis-review-dihapus.mjs`: Memvalidasi fungsi `detectIntent` di `IntentClassifier.js` secara langsung serta memastikan `verifyPatchEngineering` & `MODIFY_CODE` tetap ada di `engineer.js`.
8. `uji/uji-baca-berkas-besar.mjs`: Menguji batas pembacaan 20 KB menggunakan simbol metode nyata `_checkCompliance` yang terletak di luar batas 20 KB pertama alih-alih teks komentar `"dihapus total"`.
9. `uji/uji-byok-tanpa-kunci-sistem.mjs`: Memeriksa definisi antarmuka TypeScript `ProviderKeys` (pemisahan `openRouter` dan `openRouterByok`) di `runtime_context.ts`.
10. `uji/uji-komentar-tak-berbohong.mjs` (Opsi B): Mengubah pengujian menjadi validasi pemanggilan kode nyata: menghitung jumlah riil `supabase.from(...)` dan memastikan pemanggilan `logCommand`.
11. `uji/uji-laporan-patch-bertahan.mjs`: Memeriksa ketiadaan `_generateFallbackPatch` dan keberadaan `async _generatePatch` di `engineer.js`.
12. `uji/uji-pemulihan-chat-v6.mjs`: Memotong rentang effect di `ConversationEngine.jsx` berdasarkan baris kode aktual (`localStorage.setItem(chatStorageKey, currentChatId);`, `simpanOtomatis = () => {`, `laporanSetelahMuatUlang((p) => storageManager.read(p)`).
13. `uji/uji-salinan-mametlite.mjs`: Menggunakan parser mekanis `hapusKomentar` untuk membandingkan ekspor kode antara frontend dan mametlite secara bersih tanpa komentar di kedua sisi.

## Bukti Verifikasi

- **Vite Build (`frontend/`):** Berhasil penuh (1m 31s, 0 error).
- **Esbuild Bundle Edge Functions:**
  - `supabase/functions/agent-process/index.ts`: 534.279 karakter, 0 error, 0 warning.
  - `supabase/functions/rag-process/index.ts`: 28.554 karakter, 0 error, 0 warning.
- **Suite Uji Penuh (`node uji/jalankan-semua.mjs`):**
  - **158 / 158 LULUS (100% hijau)** dalam 158.4 detik (0 gagal, 0 dilewati).
- **Skala Perubahan:** 329 berkas diubah, 764 penambahan (penyesuaian uji/perapian), 13.122 baris komentar dihapus.
