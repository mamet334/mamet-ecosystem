# 29 Oktober 2026 — T16: modul konsol uji RAG dirapikan & tersambung lagi

Temuan T16 (19 Okt — [roadmap](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md)): lima modul konsol DevTools (`uji-pengambilan*.js`,
`uji-konteks-potongan.js`) mengimpor dan mengambil data dari `frontend/node_modules/.uji-rag/`, folder yang hilang sejak
24 Sep — rusak tanpa suara (suite tak menjalankan berkas `.js`), dan `vite.config` tak mengizinkan `/@fs/` ke `uji/`.

## Yang ketahuan saat diperiksa

- **Tiga dari lima hanya duplikat:** `uji-pengambilan.js` = `-v2.js` huruf demi huruf; `-v4.js` mencakup `-v3.js` (+ pilihan
  set). Yang berbeda tinggal dua.
- **Premis pilihan (b) di roadmap keliru:** modul ini memakai `set-uji-pengambilan.json` (set bangun ulang Item 90, sah),
  bukan set lama 13 pertanyaan yang tak sah (`set-uji-rag.json`). Datanya masih ada di `uji/data-lokal/` (diabaikan git).

## Yang dibuat (pilihan 1 Owner)

- Hapus `uji-pengambilan.js`, `-v2.js`, `-v3.js`.
- `-v4.js` → **`uji-pengambilan-v5.js`**, `uji-konteks-potongan.js` → **`-v2.js`** (nama baru + "versi skrip" baru, aturan
  skrip uji yang diubah). Jalur data & `shared/KnowledgeService.js` kini **relatif terhadap berkasnya**
  (`new URL('./data-lokal', import.meta.url)`), tidak lagi jalur mati `D:/…/.uji-rag`.
- `frontend/vite.config.js` `server.fs.allow` + `'../uji'`. `uji/data-lokal/` memuat NIP & nama pegawai — server dev Vite
  hanya mendengarkan `localhost` (tanpa `host`), jadi tak terjangkau jaringan.
- `uji-verifikasi-tahap6` (contoh modul konsol yang wajib DILAPORKAN) & komentar `jalankan-semua` menunjuk nama baru.

## Bukti

- **Server dev Vite sungguhan:** kedua modul diimpor (`uji` = fungsi); `set-uji-pengambilan.json`,
  `set-uji-buku-penuh.json`, `potongan-uji-kepbup-tahapC.json` → 200 & JSON sah (isi tidak dibaca);
  `shared/KnowledgeService.js` → 200; berkas di luar izin (`.gitignore` akar) → **403**.
- Suite penuh **129/129**; modul "tak dijalankan" yang dilaporkan 6 → 3; `vite build` berhasil.
- Menjalankan pengukurannya sendiri tetap butuh saldo (embedding berbayar).
