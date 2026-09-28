# 2026-09-28 — Tahap 5: akar repo dipilih Owner, bukan ditebak dari folder aplikasi

Akar dari tiga pekerjaan lain (Tahap 6, T12, dan kewajaran Tahap 1). Kode selesai, **belum diuji di
aplikasi terpasang**.

## Masalah

`PROJECT_ROOT = path.resolve(__dirname, '..', '..')` benar di `npm run desktop` — `main.cjs` memang di
dalam repo. Di build `npm run dist` ia menunjuk **folder instalasi**: `git` gagal *"not a git
repository"*, dan patch akan menulis ke folder aplikasi.

Yang lebih berbahaya: seluruh handler `fs:*` memakai `path.resolve(PROJECT_ROOT, filePath)`, sehingga
alamat relatif **diam-diam menunjuk berkas aplikasi**. Tidak ada galat — hanya berkas yang salah.

## Perbaikan

`frontend/electron/akarRepo.cjs` (baru, murni tanpa `require('electron')` supaya bisa diuji node biasa):

| Mode | Akar repo |
|---|---|
| `npm run desktop` | folder induk `main.cjs` apa adanya |
| aplikasi terpasang | **hanya** pilihan Owner |
| terpasang & belum dipilih | **`null`** — alat repo mati dengan alasan |

Baris terakhir itu inti perbaikannya.

### Dua penjaga

1. **Wajib ada `.git`.** Tanpa riwayat, checkpoint dan rollback kehilangan artinya — Engineer
   kehilangan seluruh jaring pengamannya, bukan cuma satu fitur.
2. **Folder di dalam direktori instalasi ditolak.** Uninstall menghapus folder itu beserta seluruh
   riwayat git di dalamnya; update menimpanya sehingga git melihat ribuan perubahan yang bukan
   pekerjaan Owner. Kerugian yang datang tanpa suara, jadi ditolak di depan.

Pagar dasarnya (folder ada, bukan berkas, bukan akar drive, bukan folder sistem) **dipakai ulang** dari
`akarFolderSah` Item 85 — bukan ditulis ulang, supaya tidak ada dua versi aturan yang bisa berbeda.

### Penyimpanan

Alamatnya saja, di `%APPDATA%\Mamet AI\repo-engineer.json`, dan **disahkan ulang tiap aplikasi dibuka**:
folder yang sudah dihapus, dipindah, atau kehilangan `.git` tidak dipakai diam-diam. Pola yang sama
dengan `folder-kerja.json`.

Tiga tempat tetap terpisah tegas — folder instalasi (dihapus/ditimpa), `%APPDATA%` (selamat), repo
pilihan Owner (tidak tersentuh; aplikasi hanya menyimpan alamatnya).

### Handler yang dijaga

`eng:git-checkpoint`, `eng:git-rollback`, `engineer:uji-klaim`, `engineer:jalankan`, dan seluruh `fs:*`.
Yang terakhir kini lewat `alamatRepoRelatif()` yang **melempar dengan alasan** alih-alih menebak.

### UI

`AkarRepoTombol.jsx` — kembaran tombol 📁 Assistant, tampil hanya di workspace Engineer. Kuning
"Pilih repo" bila belum dipilih, hijau bernama folder bila sudah. Di mode pengembangan tampil sebagai
keterangan yang tidak bisa diklik.

Pesan galatnya menunjuk tombol itu secara harfiah — bukan menyuruh Owner mencari menu yang tidak ada.

## Uji

| Berkas | |
|---|---|
| `uji/uji-akar-repo.cjs` | **baru** — modul murni, folder uji sungguhan di temp |
| `uji/uji-checkpoint-engineer.cjs` | **v2** — menjalankan SUMBER handler yang asli |

Yang v2 itu penting: ia membuktikan checkpoint **dan** rollback menolak saat akar belum dipilih, lewat
kode yang benar-benar dijalankan aplikasi — bukan lewat modul `akarRepo.cjs` saja. Modul yang benar
tetapi tidak dipanggil berarti bug masih hidup.

Satu penjaga khusus: untuk empat nilai `akarDev` yang berbeda (termasuk folder instalasi), aplikasi
terpasang tanpa pilihan Owner **selalu** menghasilkan akar `null`. Itu bug 23 September, dikunci uji.

## Terbukti, dan belum

- ✅ 48 berkas uji hijau; `vite build` lolos; `node --check` lolos untuk ketiga berkas proses utama.
- ⏳ **Belum diuji di aplikasi terpasang.** Pembuktiannya: `npm run dist` → pasang → buka workspace
  Engineer. Tombol kuning dan alat repo menolak dengan alasan; pilih folder hasil clone → tombol hijau
  dan `git status` Engineer menunjuk repo itu; coba folder tanpa `.git` dan folder di dalam direktori
  instalasi → keduanya ditolak dengan alasan yang terbaca.

## Yang tidak dikerjakan di sini

Penjaga baca `.env` (usul hari ini, menempel pada T12) — mengubah perilaku alat baca yang sudah hidup,
jadi butuh persetujuan Owner tersendiri.

---

## TERBUKTI LIVE di aplikasi terpasang (2026-09-28)

Diuji di `.exe` hasil `npm run dist`. Tombol kuning sebelum memilih → Owner menunjuk folder
`mamet os ecosystem` → tombol hijau → `[MAMET_CMD: git status]`:

```
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
Kode keluar 0 (0,5 s).
```

Bukan `not a git repository`. `git show HEAD:frontend/...` juga mengembalikan isi berkas sungguhan.
**Bug 23 September tertutup**, dan seluruh rantai bekerja: dialog → `akarRepoSah` → simpan alamat di
`%APPDATA%` → sahkan ulang → dipakai sebagai `cwd` perintah.

Ikut terlihat bekerja: penolakan perintah identik kedua (prosedur langkah 0.4) dan penolakan
`python -c "…"` berkutip bersarang oleh pemecah perintah.

## Dua batas yang ketahuan dari uji live itu

**Engineer tidak bisa membaca berkas > 20 KB.** `alatFolderJalan.cjs:27` `keluaranByte: 20 * 1024`;
`engineer.js` 47.767 byte, jadi `git show` hanya menyampaikan ±40% awalnya dan **baris 1035 — isi
TMN-0001 — tidak terjangkau**. Menaikkan batasnya bukan jawaban (berkas 47 KB menghabiskan jendela
konteks); yang dibutuhkan alat baca repo per rentang baris, sejajar `dari`/`sampai` milik Assistant.
Selama belum ada, **temuan di paruh kedua berkas besar tidak bisa diverifikasi Engineer sendiri.**

**Model tidak diberi tahu akar repo-nya** — ia menulis "dijalankan dari direktori kerja yang berbeda"
lalu mengarang perintah `python` untuk mencari berkas yang alamatnya sudah diketahui. Sekarang bisa
diperbaiki karena akarnya eksplisit; menunggu keputusan Owner (perubahan prompt).

Keduanya dicatat sebagai sisa pekerjaan di `ROADMAP-ENGINEER-MANDIRI.md`.
