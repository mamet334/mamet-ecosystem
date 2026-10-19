# 19 Oktober 2026 — Settings bertab: daftar di kiri, satu bagian di kanan (Item 127 Tahap 2, langkah 2b)

Item 127 ([`ROADMAP-TAMPILAN-MENU-GAME.md`](../../roadmap/ROADMAP-TAMPILAN-MENU-GAME.md)), Tahap 2 "kerangka
standar". Bentuknya sama dengan gambar referensi menu Owner (daftar bagian di kiri, isi di kanan) — dan sama
dengan halaman pengaturan aplikasi asisten standar. Disetujui Owner sesudah dilihat sendiri di
`npm run desktop`.

## Yang berubah

Settings dulu sembilan kartu dalam satu halaman yang digulir panjang. Kini satu bagian pada satu waktu:

| Tab | Bagian (isinya tidak diubah) |
|---|---|
| Model AI | AI Model Management |
| API Key | API Key + Test Connection |
| Tingkat Model | Adaptive Model Tiering |
| Batas Biaya | Batas Biaya Harian |
| **Pembaruan** — hanya di aplikasi terpasang | Pembaruan Aplikasi |
| **Aplikasi Desktop** — hanya di web | Unduh Aplikasi Desktop |
| Alat & Kemampuan | Tools & Capabilities |
| Tool Registry | Tool Registry |
| Identitas | User Identity — **tombol Keluar tetap di sini** sampai menu utama ada (Tahap 3) |

Yang tampil selalu delapan: Pembaruan dan Aplikasi Desktop saling meniadakan, dan daftar tab mengikuti
syarat yang SAMA dengan bagiannya — tak ada tab yang membuka halaman kosong. Ikon tiap tab diambil dari kepala
bagiannya sendiri (Identitas memakai `person`, bukan `logout` milik tombolnya). Warna tab sengaja putih
transparan, bukan token Material atau `slate-*`, supaya angka ciri tampilan generik tidak naik.

Di seluler daftar tab menjadi baris yang bisa digeser.

## Berkas

| Berkas | Perubahan |
|---|---|
| `frontend/src/components/Settings.jsx` | +52 / −3 — keadaan `bagianAktif`, daftar `BAGIAN_SETTINGS`, `<nav>` tab, tiap `<section>` dibungkus syarat tab aktif; isi sembilan bagian **tidak disentuh** |
| `uji/uji-settings-bertab.mjs` (baru) | menjaga pembungkus — di situlah fungsi bisa hilang tanpa suara |
| `uji/uji-panel-pembaruan.mjs` → v2 · `uji/uji-unduh-desktop.mjs` → v2 | mencocokkan teks harfiah `{adaPembaruan && (`; kini menjaga NIATNYA: syarat asli wajib tetap ada |

## Bukti

- **Kedelapan tab diklik satu per satu di browser (1366×720):** tiap klik menampilkan **tepat satu** bagian
  dengan judul yang benar, dan tab aktif ditandai `aria-current`.
- **Cacat seluler ketahuan sebelum commit:** di 375px kedelapan tab saling menimpa — tombolnya menyusut melebihi
  lebar teksnya. Diperbaiki (`shrink-0`) dan diukur ulang: tumpang tindih 0, baris bisa digeser (isi 1087px di
  wadah 341px).
- **Mutasi — 6, semuanya menggigit:** satu bagian kehilangan syarat tab · bagian dengan id salah (tak pernah
  bisa dibuka) · syarat asli Pembaruan dibuang · tab Aplikasi Desktop selalu tampil (tab kosong di aplikasi
  terpasang) · tab menyusut lagi · ikon di luar subset font. Dua uji v2 juga dibuktikan: membuang syarat asli
  → keduanya merah.
- Suite **102/102**; angka ciri tampilan generik tidak naik.

## Sisa, untuk Tahap 3

- Judul besar "Settings" dan kalimat Inggris generik di bawahnya (*"Configure your deep-dark AI workspace…"*).
- Kartu tiap bagian masih bergaya kaca bertepi (`glass-panel rim-light`).
- "Reset · Terapkan" di bawah tiap bagian (roadmap §5.3) belum ditambahkan — bagian-bagian ini menyimpan
  dengan caranya sendiri, dan menyatukannya mengubah logika, bukan susunan.
