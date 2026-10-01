# 1 Oktober 2026 — Perintah baca dijalankan sendiri; yang krusial tetap ditanyakan

## Keputusan Owner

> *"perintah yang krusial saja yang perlu persetujuan saya. Seperti anda menjalankan perintah dari
> saya ini — anda tidak meminta approval. Baru hal yang akan kritis baru bertanya. Ini seperti
> membuat ribet dengan hal yang sebenarnya aman."*

Dan memang tidak konsisten. Uji peta repo memperlihatkannya: model menerbitkan **lima** perintah
`git grep` untuk satu pertanyaan, dan tiap perintah menuntut **dua** persetujuan — tombol "Jalankan"
di chat, lalu dialog izin asli dari proses utama. **Sepuluh kali menyetujui** untuk membaca jumlah
baris berkas sendiri. Owner menjadi tangan model.

## Akarnya: gerbang yang menjaga sesuatu yang sudah dijaga

Arsitekturnya **sudah** punya jawabannya, tinggal tidak dipakai:

| Yang sudah ada | Apa yang dijaminnya |
|---|---|
| `PROFIL.engineer.gitSub = GIT_BACA` | Engineer hanya boleh git yang MEMBACA |
| `GIT_BRANCH_UBAH` | `git branch` yang membuat/menghapus/memindah ditolak |
| `OPSI_TERLARANG` | opsi yang menulis berkas atau memanggil alat luar ditolak |

Untuk git, dialog itu **tidak menambah perlindungan apa pun** — hanya gesekan.

## Garisnya, dan kenapa di situ

**Tanpa persetujuan:** git yang membaca — `status, log, diff, show, blame, grep, ls-files,
rev-parse, branch (daftar saja), shortlog, describe`.

**Tetap minta izin:** `node -e`, `python -c`, dan program lain. Profil Engineer memang
mengizinkannya, dan itu **kode bebas yang tidak dibatasi pagar folder** — ia bisa membaca dan
mengubah berkas di mana pun di laptop. Membaca repo itu aman; menjalankan kode karangan model tidak.

`tanpaPersetujuan()` hanya **menyempitkan**. Seluruh pemeriksaan lain tetap berjalan sesudahnya: ia
memutuskan siapa yang perlu ditanya, bukan apa yang boleh jalan.

## Penegakannya di proses utama, bukan di layar

Teks perintah berasal dari model, jadi penilaiannya tidak boleh tinggal di tempat yang sama dengan
yang menampilkannya. Layar **bertanya** lewat IPC (`engineer:perintah-aman`); proses utama pula yang
melewati dialognya (`izinLaluJalankan`). Kalaupun jawaban itu dipalsukan di layar, gerbang
sebenarnya tetap di pelaksana.

Penentunya memakai **pemecah perintah yang sama** dengan pelaksana (`pecahPerintah`). Dua pemecah
yang berbeda pendapat adalah lubang keamanan, bukan kerapian.

## Satu kiriman, bukan lima panggilan berbayar

Jalur manual mengirim balik hasil tiap perintah satu per satu. Kalau pola itu dipakai untuk perintah
otomatis, lima perintah menjadi **lima panggilan model berbayar** tanpa Owner pernah memintanya.
Jadi hasilnya dikumpulkan dan dikirim sekali.

## Yang sengaja tidak dijalankan sendiri

- **Pindah percakapan & pemuatan awal dilewati sekali.** Tanpa itu, membuka riwayat lama akan
  menjalankan ulang perintah yang dulu sudah dijawab — Owner tidak meminta apa pun, tiba-tiba
  terminal bekerja.
- Perintah yang sudah pernah dijalankan otomatis tidak diulang (disimpan di ref, bukan state:
  mengubah state akan memicu render, dan render memicu efeknya lagi).

## Uji

`uji/uji-perintah-tanpa-persetujuan.mjs` (baru) — 38 pemeriksaan, sebagian besar berisi percobaan
**menembus** garisnya: `--ext-diff`, `--output=`, `--exec=`, `--git-dir=`, `--work-tree=`,
`--upload-pack=`, `git branch -D/-m/-f/-u`, dan `git -c core.pager=… log` yang menyisipkan
konfigurasi sebelum sub-perintah. Juga dijaga bahwa profil **assistant tidak ikut dilonggarkan** dan
profil kosong gagal ke sisi aman.

> Pelonggaran izin yang hanya diuji dengan contoh yang seharusnya lolos bukan uji keamanan,
> itu hanya uji keberuntungan.

**65/65 berkas uji hijau.**

### Satu uji lama memerah — dan memang seharusnya

`uji-peringatan-skrip.mjs` merah di kasus `git status`: ia memeriksa isi dialog, padahal `git status`
kini tidak membuka dialog sama sekali. Perilakunya yang berubah, bukan kodenya yang rusak.

Diperbarui tanpa melemahkannya: kasus itu kini menjaga **perilaku baru** (git baca tidak membuka
dialog), dan maksud aslinya dipindah ke `node <berkas>` — perintah yang masih lewat dialog tetapi
bukan skrip sebaris.

## Belum sampai ke aplikasi

Ada di `main`, menunggu rilis berikutnya. `main.cjs` dan `preload.cjs` ikut berubah, jadi perlu
build baru — hard refresh tidak cukup.
