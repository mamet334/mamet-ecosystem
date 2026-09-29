# Panel Pembaruan di Pengaturan — jembatan yang tidak pernah dipakai

**29 September 2026** · dilaporkan Owner sesudah 4.2.0 terbit

## Yang dilaporkan Owner

> "aplikasi mamet ai sudah mendeteksinya, hanya saja di kolom setting tidak ada fitur update atau
> sebagainya"

## Sebabnya

`preload.cjs` sudah menyediakan tiga hal sejak lama — `checkForUpdates()`, `getAppVersion()`,
`onUpdateStatus()` — tetapi pencarian di seluruh `frontend/src` menemukan **nol pemakai**.

Bentuknya persis kebalikan dari kode mati yang dihapus minggu ini: di sana **pendengar tanpa pemancar**
(READ_REPO, AnalyzeTask/ReviewChanges), di sini **jembatan tanpa pemakai**. Keduanya sama-sama kode yang
tampak lengkap tetapi tidak pernah tersambung.

## Yang ditambahkan

Satu bagian di Pengaturan, hanya muncul di aplikasi terpasang (di web tidak ada auto-updater):

- **Versi terpasang** — dibaca dari proses utama, bukan ditulis tangan di layar
- **Tombol "Periksa Pembaruan"**
- **Baris status** — tersedia / mengunduh N% / siap dipasang / sudah terbaru / galat

Nilai terbesarnya yang pertama: tanpa itu, **tidak ada cara memastikan dua orang memakai versi yang
sama**, dan laporan bug dari rekan kantor jadi membingungkan.

## Cacat yang ikut ketahuan — dan ini yang terpenting

`update-downloaded` dan `error` **tidak pernah dikirim ke layar** — keduanya hanya masuk konsol dan
dialog. Akibatnya:

- panel akan berhenti di **"Mengunduh… 100%" selamanya**, padahal unduhannya sudah selesai;
- **kegagalan pembaruan tidak pernah terlihat** — persis yang terjadi hari ini, saat token rilis
  kedaluwarsa membuat rilis tak pernah sampai tanpa satu pun gejala di aplikasi.

Keduanya kini dikirim. Koreksi atas perkiraan asisten sebelumnya: pekerjaan ini **menyentuh proses
utama**, jadi butuh `npm run desktop` dijalankan ulang atau build baru.

## Dua keputusan

**1. "Sudah diunduh" TIDAK boleh terlihat seperti "sudah terbaru".** Pemasangan baru terjadi saat
aplikasi ditutup, jadi keadaan itu masih **menunggu tindakan Owner** — nada dan warnanya sengaja
dibedakan, dan kalimatnya menyebut apa yang harus dilakukan.

**2. Status yang tidak dikenal tidak dikarang jadi kalimat menenangkan.** Pesan aslinya ditampilkan apa
adanya; bila tak ada pesan pun, nama statusnya tetap disebut.

## Berkas

| Berkas | |
|---|---|
| `frontend/src/core/runtime/services/statusPembaruan.js` | **baru** — terjemahan keadaan, murni & bisa diimpor |
| `frontend/src/components/Settings.jsx` | bagian Pembaruan Aplikasi |
| `frontend/electron/main.cjs` | `update-downloaded` & `error` kini dikirim ke layar |
| `uji/uji-panel-pembaruan.mjs` | **baru** |

Logikanya ditaruh di modul tersendiri, bukan di dalam komponen React, supaya berkas uji bisa
**mengimpornya** — bukan menyalinnya (lihat penanda `UJI-CERMIN`).

## Bukti

56 berkas uji hijau · `vite build` lolos · `node --check main.cjs` lolos.

Uji menjaga tiga hal yang paling mudah lepas: persentase yang dijepit dan tidak pernah `NaN`,
**"siap dipasang" berwarna berbeda dari "sudah terbaru"**, dan **pendengar dilepas saat panel ditutup**
(tanpa itu tiap kali Pengaturan dibuka akan menumpuk pendengar baru pada peristiwa yang sama).

**Belum diuji live.** Perlu build baru — panel ini tidak akan muncul di 4.2.0 yang sudah terpasang.

---

## Uji live 29 September: panelnya bekerja, ikonnya tidak

Owner memasang 4.2.1 dan mengirim tangkapan layar. **Isinya benar semua** — "Versi terpasang v4.2.1",
tombol Periksa Pembaruan, dan status "Aplikasi Anda sudah di versi terbaru."

Tetapi ikonnya tampil sebagai **TULISAN raksasa "TEM_UPDATE" yang menimpa judul panel.**

**Sebabnya, dan ini kali KETIGA:** font ikon yang dibundel bukan font penuh, melainkan **subset** 70
ikon yang dibuat `scripts/perbarui-ikon.mjs` dari `daftar-ikon.txt`. Nama di luar subset tidak menjadi
gambar — ia dirender sebagai **ligatur gagal**, yaitu teksnya sendiri, berukuran ikon.

| Kapan | Ikon | Terlihat sebagai |
|---|---|---|
| 14 Sep | `expand_more` | — diganti `chevron_right` diputar 90° |
| 23 Sep | `data_usage`, `history_toggle_off` | "DATA_USAGE" |
| **29 Sep** | `system_update` | **"TEM_UPDATE"** |

Diganti `refresh`, yang sudah ada di subset. (`download` di tombol unduh aman — ia memang ada.)

## Kenapa ini lolos tiga kali, dan apa yang menghentikannya

Tidak ada yang merah. Build sukses, uji hijau, `vite build` lolos — cacatnya **hanya terlihat oleh mata
manusia yang kebetulan membuka layar itu.** Dua uji yang ada (`uji-konteks-chat`, `uji-padatkan-konteks`)
memeriksa ikon TERTENTU di layar tertentu, jadi ikon baru di layar baru tidak terjaga.

`uji/uji-ikon-subset.mjs` **memindai seluruh `frontend/src`** dan menolak setiap nama ikon literal yang
tidak ada di subset. Ikon baru di layar mana pun kini ikut terjaga.

Dua hal yang membuatnya tidak mengganggu:

- **Ekspresi dinamis dilewati.** `<span …>{icon}</span>` di `MobileBottomNav.jsx` nilainya datang dari
  data, tidak diketahui saat memindai. Tanpa pengecualian ini ujinya merah palsu — dan uji yang merah
  palsu akan diabaikan orang.
- **Uji kendali membuktikan pemindainya bisa merah**: `system_update` tertangkap sebagai nama literal,
  dan memang terbukti tidak ada di subset.

58 berkas uji hijau.
