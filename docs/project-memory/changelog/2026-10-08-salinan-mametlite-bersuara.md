# 8 Oktober 2026 — Tiga salinan tangan Mametlite akhirnya bersuara bila menyimpang

M9 blok M item 125 ([`ROADMAP-SIAP-PENGGUNA.md`](../../roadmap/ROADMAP-SIAP-PENGGUNA.md)).

## Utangnya

`mametlite/src/lib/` memuat tiga berkas (±1.000 baris) yang **menyatakan dirinya salinan**, lengkap
dengan perintah di headernya:

| Berkas | Baris | Header |
|---|---|---|
| `documentTextExtractor.js` | 420 | *"SALINAN dari frontend/… **Ubah keduanya bersamaan.**"* |
| `pdfOcrService.js` | 216 | *"SALINAN … Ubah keduanya bersamaan."* |
| `tabelCentang.js` | 377 | *"SALINAN … Ubah keduanya bersamaan."* |

**Tidak ada apa pun yang menegakkan perintah itu.** Constitution menuntut satu berkas satu tanggung
jawab, dan ini melanggarnya.

**Penyatuannya TIDAK dikerjakan di sini** — itu perubahan arsitektur dan pantas jadi ADR sendiri,
bukan diselipkan ke pekerjaan stabilisasi. Yang dikerjakan: membuat penyimpangannya **bersuara**.

## Aturannya BUKAN "harus identik" — dan itu diputuskan dari pengukuran, bukan dari selera

Diukur lebih dulu: ketiganya **sudah** berbeda hari ini.

- `documentTextExtractor` & `tabelCentang` — hanya di komentar header. Itu **disengaja**: masing-masing
  menunjuk ke kembarannya, jadi kalimatnya memang tak bisa sama.
- `pdfOcrService` — **penyimpangan sungguhan**: sisi `frontend` punya `hitungHalamanPdf()` yang
  Mametlite tidak punya.

Diperiksa sebelum dijadikan kegagalan: `hitungHalamanPdf` hanya dipakai `bacaPdfAsn.js`, yaitu jalur
tabel ASN yang **khusus Ecosystem** (Item 92). Mametlite memang tidak membutuhkannya.

Jadi aturan "harus identik" **salah** — ia akan merah sejak lahir karena perbedaan yang sah, lalu
dicabut orang dalam sepekan. Itu persis perangkap yang `uji-catch-diam.mjs:16-21` peringatkan, dan
yang J3b & J3c di roadmap catat. Aturan yang dipakai:

| | |
|---|---|
| **GAGAL** | nama yang ada di **kedua** sisi tetapi isinya beda — penyimpangan yang sesungguhnya |
| **LAPOR** | nama yang hanya ada di satu sisi — sah, tetapi harus **terlihat** supaya tak ada yang menyimpang diam-diam di balik izin ini |

Komentar diabaikan saat membandingkan; header memang berbeda, dan itu bukan logika. Tetapi kata
`SALINAN` **wajib tetap ada** di keduanya — kalau ia dihapus, pembaca berikutnya tak akan tahu ada
kembarannya, dan uji ini jadi satu-satunya yang tahu.

## Satu bug di uji ini sendiri, dan ia pantas dicatat

Bentuk pertama uji ini melaporkan **8 ekspor menyimpang** di `documentTextExtractor` — pada berkas
yang `diff -w --strip-trailing-cr` nyatakan hanya beda **4 baris header**. Dua pengukuran yang
bertentangan, jadi tak satu pun dilaporkan sebelum sebabnya ditemukan.

Sebabnya: **salinan Mametlite CRLF, salinan frontend LF** (785 berkas repo ini memang masih LF di
disk — J3c). Dan di JavaScript, `.` **tidak** cocok dengan `\r`, karena `\r` terminator baris:

```js
"// catatan\r".replace(/\/\/.*$/, '')   →  "// catatan\r"   // tidak terhapus
"// catatan".replace(/\/\/.*$/, '')     →  ""               // terhapus
```

Jadi komentar terhapus di satu sisi dan selamat di sisi lain, lalu blok yang dibandingkan jadi beda.
**Yang salah ujinya, bukan kodenya** — dan kegagalannya terlihat persis seperti temuan sungguhan.

Kembaran cermin dari kegagalan live 24 September, saat berkas LF membuat cari-ganti `PatchGenerator`
cocok **nol** baris. Perbaikannya satu baris (`.replace(/\r/g, '')` lebih dulu), tetapi alasannya
ditulis panjang di kodenya supaya tidak dihapus orang sebagai "pembersihan".

## Bukti

`uji/uji-salinan-mametlite.mjs` (baru) — **SEMUA LULUS**: 26 ekspor bersama diperiksa isinya,
1 ekspor sepihak dicatat (`hitungHalamanPdf`, hanya di frontend).

**Dibuktikan menggigit** lewat dua mutasi yang lalu dipulihkan:

| Mutasi | Hasil |
|---|---|
| satu baris disisipkan ke `perkiraanOcr` di sisi Mametlite saja | **GAGAL**, dan pesannya **menyebut nama ekspornya** — bukan "ada yang beda" |
| kata `SALINAN` dihapus dari header `tabelCentang` | **GAGAL** |

Suite penuh: **92/92**.

## Berkas

| Berkas | |
|---|---|
| `uji/uji-salinan-mametlite.mjs` | **baru** |

## Sisa

**M8** kode mati Mametlite — **menunggu izin Owner** (Constitution: *hapus lunak sebelum hapus
permanen*). Dengan M9 ini, seluruh blok M selesai kecuali yang memang menunggu keputusan.

Penyatuan tiga berkas ini tetap terbuka sebagai **usul ADR**, bukan pekerjaan yang tertunda.
