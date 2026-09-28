# 2026-09-28 — Engineer bisa membaca berkas besar: dua perintah, nol kode baru

Ditemukan saat Owner bertanya *"fitur explorer itu apa?"* — dan jawabannya menutup masalah yang satu
jam sebelumnya saya taksir sebesar Tahap 5.

## Masalah (live, 28 September)

Temuan TMN-0001 menunjuk komentar di `engineer.js` sekitar baris 1035. Engineer menjalankan
`git show HEAD:…`, menerima 20 KB pertama dari **47.767 bita**, lalu mengarang perintah `python` untuk
menelusuri filesystem mencari berkas yang **alamatnya sudah ia ketahui**. Perintah itu ditolak karena
kutipnya tidak ditutup.

Ia **tahu** keluarannya terpotong — ia menuliskannya sendiri. Yang tidak ia punya: **jalan keluarnya.**

## Apa yang sebenarnya kurang

Bukan kemampuan, bukan izin, bukan batas ukuran. `constitution/28` hanya mengajarkan **satu** cara
membaca berkas — ambil utuh. Sementara dua perintah ini sudah diizinkan profil Engineer sejak lama
(`alatFolderJalan.cjs:74` `GIT_BACA` memuat `grep` dan `blame`), tetapi tidak pernah disebutkan.

Diukur di repo ini:

| Cara | Keluaran |
|---|---|
| `git show HEAD:engineer.js` | **47.767 bita** → terpotong 20 KB; baris yang dicari ada di bita ke-45.000-an, **tak pernah sampai** |
| `git grep -n -B2 -A4 "<pola>" -- <berkas>` | **801 bita** — ketemu, lengkap nomor baris |
| `git blame -L <awal>,<akhir> -- <berkas>` | **735 bita** |

**59× lebih kecil, dan justru menjangkau baris yang dengan cara lain mustahil.**

## Perbaikan

**1. `constitution/28` §3a (baru) — cari dulu, baru baca sempit.** Kedua perintah, angka nyatanya, dan
kejadian 28 September sebagai alasannya. `git show` diturunkan ke §3b: hanya untuk berkas kecil,
karena untuk berkas besar ia **gagal diam-diam**.

**2. `petunjukKeluaranTerpotong()` di `ProsedurEngineer.js` (baru).** Saat pembacaan utuh terpotong,
sistem memberi **jalan keluarnya** — bukan sekadar menandai "dipotong". Meniru `petunjukHasilKosong`
yang sudah terbukti: bila sistem tahu bentuk perintah yang keliru, ia menyebut bentuk yang benar.
Dipasang berdampingan dengannya di `AssistantService` jalur perintah.

Sengaja **diam** pada: keluaran tidak terpotong, `git status`/`git log` yang terpotong, `git show <sha>`,
dan `git grep` yang terpotong — menyarankan `git grep` kepada `git grep` tidak berguna.

## Uji

`uji/uji-baca-berkas-besar.mjs` — tiga lapis:

1. **Kendali di repo sungguhan**: membuktikan pembacaan utuh memang melewati batas, bahwa baris yang
   dicari memang di luar 20 KB pertama, dan kedua perintah alternatif memang menjangkaunya.
2. **Fungsi murni**: kapan petunjuk menyala, kapan diam.
3. **Terpasang**: diimpor & dipanggil di `AssistantService`, kedua perintah benar-benar ada di
   `GIT_BACA`, dan `constitution/28` benar-benar menyebutkannya. Petunjuk yang menyarankan perintah
   terlarang lebih buruk daripada tidak ada petunjuk.

49 berkas uji hijau; `vite build` lolos.

## Ikut selesai: TMN-0001 ditutup

Dibaca langsung: `engineer.js:1054-1058` kini berbunyi *"`_generateFallbackPatch` **dihapus total**
(T10, 2026-09-22)"* — persis perbaikan yang Engineer kerjakan 24 September, dan masih utuh.

## Catatan untuk diri sendiri

Taksiran saya atas pekerjaan ini meleset tiga kali berturut-turut, selalu ke arah yang sama —
"perlu alat baca per rentang baris" → "beberapa baris saja" → "sebesar Tahap 5" — sampai akhirnya
**nol kode baru untuk kemampuannya**. Ketiganya ditulis sebelum menjalankan dua perintah yang
membuktikannya. Mengukur lebih dulu memakan waktu dua menit.
