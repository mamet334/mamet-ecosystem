# 2 November 2026 — J3: suite uji menjadi gerbang rilis; suite tak lagi bergantung pada laptop Owner (K7, ADR-0022)

Item 125 Fase C. Prasyarat J3b (uji goyah) dipatok 30 Okt; **J3c diputuskan Owner — pilihan B**: pemeriksa akhir baris
(CRLF) tidak ikut gerbang (785 berkas tidak CRLF; akhir baris tak memengaruhi cara Mamet berjalan).

## Temuan

- `.github/` tidak menjalankan satu uji pun: `build.yml` = checkout → npm ci → `dist:publish`. Rilis bisa terbit dengan
  uji merah.
- Suite hanya bisa berjalan di laptop Owner. Diukur di salinan repo yang bersih (hanya berkas terlacak git;
  `node_modules` disambungkan, bukan diunduh):
  - **71 dari 139** berkas uji memaku `D:/SLAMET/other/mamet os ecosystem`;
  - 3 uji membaca versi lama lewat `git show 8dd5e3b|d548881|abcdced` — commit yang **tak terhubung ke cabang mana pun**,
    jadi tak pernah ada di GitHub (clone dengan riwayat penuh pun gagal);
  - `uji-data-tabel-asn-tahap5` jatuh ENOENT tanpa data berisi NIP (`uji/data-lokal`, `D:/REKONSIALISASI 2026`);
  - `uji-konektor-stealth` mengandaikan `.venv` crawler terpasang.

## Yang dibuat

- **68 berkas uji** (77 alamat): akar repo dihitung dari letak berkas (`AKAR_REPO`, `fileURLToPath(new URL('..',
  import.meta.url))` / `__dirname`) — diubah mekanis oleh skrip; komentar, data uji ber-backslash
  (`uji-catatan-akar-repo`), dan repo lain (`gabut/engine`, sudah DILEWATI bila tak ada) tak disentuh.
- **`uji/kendali-revisi/`** (baru): isi ketiga revisi lama, byte-sama dengan `git show` — `uji-klaim-sumber`,
  `uji-trace-kurung-terbuka`, `uji-trace-parser-kendali-tetap` membacanya dari sana. Akhiran `.ts.txt` supaya tak
  dianggap kode aktif.
- `uji-data-tabel-asn-tahap5`: tanpa data lokal → **DILEWATI** jujur. `uji-konektor-stealth`: tanpa `.venv` crawler →
  tetap memeriksa status tak membocorkan alamat folder.
- **`.github/workflows/uji.yml`** (baru): suite penuh pada push & PR ke main (Windows, Node 24, Python 3.12, `npm ci`
  frontend & Mametlite); kode keluar penjalan diteruskan; DILEWATI dicetak; hasil JSON jadi artefak.
- **`build.yml`**: job `uji` (memanggil `uji.yml`) bila versi naik; job `build` → `needs: [periksa-versi, uji]`.
- **`uji/uji-gerbang-uji.mjs`** (baru): pemicu push/PR, kode keluar diteruskan, build butuh uji, tak ada uji yang
  memaku alamat laptop, tak ada `git show <hash>`. `uji-konektor-komponen`: asersi teks job build menerima `needs`
  berdaftar (pengaman "build hanya bila versi naik" tetap).
- `uji/README.md`: pemeriksa CRLF bukan gerbang CI (J3c pilihan B); `PatchGenerator` tetap dijaga `uji-patch-crlf`.

## Bukti

- Laptop: suite **140/140**, kode keluar 0.
- Salinan bersih (tanpa riwayat): 130 lulus · 2 DILEWATI (.venv crawler) · 7 gagal → sesudah perbaikan:
  `tahap5` DILEWATI, `konektor-stealth` lulus. Clone dengan riwayat penuh: **133 lulus · 3 DILEWATI · 0 gagal**
  sesudah `kendali-revisi` (3 uji revisi lepas lulus di clone).
- Mutasi `uji-gerbang-uji` **5/5 menggigit** (build tak butuh uji; kode keluar ditelan; PR tak memicu; alamat laptop
  dipaku lagi; `git show` revisi lepas lagi). Asersi `uji-konektor-komponen` yang dilonggarkan polanya tetap menggigit
  bila syarat "versi naik" dibuang.
- YAML kedua workflow diurai `js-yaml`: urutan `periksa-versi → uji → build`.
- **Belum terbukti di GitHub** — run pertama `uji.yml` terjadi saat push; patokan selesai J3 ("PR dengan satu uji
  sengaja merah → CI menolak") butuh satu PR uji.

## Run pertama di GitHub (83fb424) — merah, dan apa yang ditangkapnya

- Run `41372936324`: **131 lulus · 5 dilewati · 4 gagal** (37 detik). Keempatnya uji Data Tabel ASN (`uji-data-tabel-asn`,
  `-tahap2`, `-tahap3`, `-tahap4`) yang membaca `D:/REKONSIALISASI 2026` — Excel pegawai sungguhan di luar repo. Salinan
  bersih di laptop tak menangkapnya karena folder itu ADA di laptop: ini yang hanya bisa dibuktikan di mesin lain.
- Cacat di langkah saya sendiri: shell GitHub `bash -e` berhenti di kode keluar 1 SEBELUM ringkasan tercetak — run merah
  tanpa menyebut uji mana (dibaca dari artefak `hasil-uji.json`). Kini `kode=0; … || kode=$?`, dijaga `uji-gerbang-uji`.
- Perbaikan: keempatnya DILEWATI jujur tanpa folder itu. `tahap4` lebih dulu menjalankan 8 pemeriksaan NIP buatan; bila
  satu gagal, uji tetap **GAGAL** (keluar 1) dan tidak tertutup DILEWATI — dibuktikan dengan merusak kondisinya.
  Satu mutasi pertama saya keliru (`&& false` mengenai teks pesan, bukan kondisi) — diulang dengan benar.
- Laptop 140/140.
