# 1 Oktober 2026 — Jejak sisipan: mata untuk hilangnya konteks di kiriman lanjutan

## Ini bukan perbaikan

Sisipan Engineer hilang di kiriman **lanjutan**: riwayat 16.945 huruf di pesan pertama, **2.290
huruf** di pesan kedua percakapan yang sama — padahal mode tetap `ENGINEER` (log `[RequestParser]`).

**Tiga teori sudah ditumbangkan angka:**

| Teori | Dipatahkan oleh |
|---|---|
| anggaran konteks sempit (saya) | jendela model 1.048.576 token → anggaran ±629.000 |
| turun ke mode LOOKUP (saya) | log menyebut ENGINEER di kedua kiriman |
| jendela konteks (Owner) | sama dengan yang pertama |

Sisipan disusun di **sisi klien** dan tidak meninggalkan satu pun jejak di log server. Itu sebabnya
kita buta. Menebak keempat kali bukan ketekunan.

## Yang paling merugikan bukan petanya

Uji live 1 Oktober justru **berhasil** di kiriman yang tanpa peta — Engineer menjalankan `git grep`
dan menjawab dengan tepat. Yang merugikan adalah penumpang ketiga: **ingatan temuan**. Kesepakatan
antara Owner dan Engineer di pesan sebelumnya ikut lenyap, tanpa satu pun tanda di layar.

Karena itu instrumen ini tetap dikerjakan walau peta kemungkinan akan dipindah ke berkas:
memindahkan peta **tidak** menyembuhkan hilangnya ingatan temuan.

## Yang dicatat

Satu baris per kiriman Engineer:

```
[Sisipan] akarRepo=ADA petaMentah=15493 → akar=1180 peta=15742 temuan=300 | 3 sisipan / 17222 huruf | mulaiDari=0 dari 4 pesan
```

### Kenapa `petaMentah` dipisah dari `peta`

Dua kerusakan yang gejalanya **identik di layar**:

| | Baris log |
|---|---|
| jembatan IPC gagal | `petaMentah=0` **dan** `peta=0` |
| jembatan baik, penyusun catatannya membuang isinya | `petaMentah=15493` tetapi `peta=0` |

Tanpa pemisahan itu, kedua keadaan menghasilkan baris yang sama dan instrumennya tidak menjawab
apa-apa.

### Yang kosong disebut namanya

`KOSONG: peta, temuan` — bukan sekadar "2 sisipan", karena jumlah saja tidak memberi tahu **yang
mana** yang hilang.

### `mulaiDari` ikut dicatat

Teori pertama yang harus disingkirkan saat sisipan hilang: Owner pernah menekan "Bersihkan
konteks"/"Padatkan". Angkanya ada di `localStorage`; mencatatnya di sini berarti tidak perlu
bertanya lagi kepada Owner atas sesuatu yang sudah bisa dijawab sendiri.

## Yang TIDAK dicatat: isinya

Sisipan memuat alamat repo dan potongan temuan. Mencatat isinya ke konsol berarti menaruh salinan
konteks di tempat yang tidak pernah diminta Owner. Yang dicatat **ukuran**; keberadaan akar repo
dilaporkan sebagai `ADA`/`KOSONG`, bukan alamatnya.

Lima asersi khusus menjaga ini: isi peta, alamat akar, daftar berkas, dan teks temuan dipastikan
**tidak** muncul di baris log.

## Dicatat SEBELUM apa pun memotong

Pemotongan terjadi jauh di hilir (`pilihPesanKonteks` di `AssistantService`). Baris ini sengaja
menggambarkan apa yang **disusun**, bukan apa yang tersisa — supaya pertanyaannya terjawab pasti:
sisipannya memang tidak dibuat, atau dibuat lalu hilang di jalan. Uji menjaga urutan itu.

## Uji

`uji/uji-jejak-sisipan.mjs` (baru) — 24 pemeriksaan, termasuk pembedaan dua kerusakan dan lima
pemeriksaan kebocoran isi. **68/68 berkas uji hijau**, dua berkas tersunting lolos parser esbuild.

Satu asersi menjaga hal yang sudah terbukti menggigit di tempat lain: instrumen ini benar-benar
**dipanggil**. Kode yang dibaca lalu tidak dipakai tidak mengukur apa pun — persis nasib konstitusi
di Brain 1 (`engineer.js:316`, 32 berkas dimuat, hanya jumlahnya yang dipakai).

## Cara memakainya

Di aplikasi: **View → Toggle Developer Tools → Console**, lalu kirim dua pesan berturut-turut di satu
percakapan Engineer. Dua baris `[Sisipan]` akan muncul. Baris kedua yang menjawab pertanyaannya.

## Belum sampai ke aplikasi

Ada di `main`. Perubahan renderer saja — ikut rilis berikutnya, tidak perlu deploy.
