# 2 Oktober 2026 — Dua hal yang membuat Engineer salah membaca buktinya sendiri

Owner memilih dua pekerjaan ini dari tiga yang diusulkan, dengan alasan yang menentukan prioritasnya:

> *"karena menyangkut kemudahan engineer mencari informasi code mamet, dan itu sebenarnya yang
> dibutuhkan engineer agar dapat memberikan path yang benar dan tepat."*

Keduanya soal **mutu bukti** — dan patch yang benar lahir dari bukti yang benar.

---

## A. `git grep` terbaca sebagai isi berkas

> *"kenapa engineer terlalu cepat mengambil kesimpulan? padahal grep yang dijalankan hanya
> menghasilkan separuh isinya."*

**Ini bukan pemotongan.** `git grep` mengembalikan baris yang **cocok** — itu wataknya. Tidak ada
yang hilang, jadi:

- `petunjukKeluaranTerpotong` **diam** — keluarannya memang utuh menurut ukurannya sendiri
- tidak ada catatan kaki `— keluaran dipotong dari N byte`
- hasilnya tampak rapi dan lengkap

**Hasil rapi tanpa tanda apa pun justru paling meyakinkan.** Pandangan **tersaring** disangka
**keseluruhan**, dan kesimpulan diambil terlalu cepat.

### Penjaga ketiga

`petunjukGrepSebagian()` di `ProsedurEngineer.js`, sejajar dengan dua yang sudah ada:

| Penjaga | Menangani |
|---|---|
| `petunjukHasilKosong` | keluaran kosong yang menyesatkan |
| `petunjukKeluaranTerpotong` | dipotong pada 20 KB |
| **`petunjukGrepSebagian`** (baru) | **keluaran utuh tetapi tersaring** |

Ia menyebut **jumlah baris** yang benar-benar dilihat, menegaskan itu bukan isi berkas, lalu memberi
**cara keluarnya** — bukan sekadar melarang menyimpulkan:

```
git grep -n -B2 -A4 "<pola>" -- <alamat>
git blame -L <awal>,<akhir> -- <alamat>
```

Dan satu kalimat yang sama pentingnya: *"Bila kesimpulan Anda memang hanya tentang ADA/TIDAKNYA pola
itu, hasil ini sudah cukup — katakan begitu."* Tanpa itu, penjaganya melarang kesimpulan yang sah.

### Kapan ia DIAM

Sudah meminta konteks (`-A/-B/-C/--context`), atau hanya menghitung/mendaftar (`-c/-l/-L`). Di situ
model sudah tahu ia melihat cuplikan. **Penjaga yang berbunyi di saat yang salah akan diabaikan juga
di saat yang benar.**

---

## B. Satu gembok, dua arti — dan yang satu berbohong

> *"perintah grep adalah hal wajar kan, kenapa harus terbatas (ketika ingin saya jalankan di ui
> engineer masih ada ikon gembok)."*

Owner benar curiga. Penyebabnya satu baris:

```js
(ditolakAturan || ditolakProsedur) ? 'blocked'
```

Dua hal yang sangat berbeda dipetakan ke satu keadaan, dan layar menulis **kalimat yang sama** untuk
keduanya:

> 🔒 *"Tidak diizinkan untuk Engineer — … Jalankan sendiri di terminal bila perlu."*

| Sebenarnya | Kalimat itu |
|---|---|
| Aturan melarang Engineer (mis. `npm install`) | benar |
| **Perintah sama persis sudah dijalankan di percakapan ini** | **bohong** |

`git grep` yang diulang tetap **boleh**. Penjaganya memang bermaksud baik — prosedur langkah 0.4:
satu cara gagal → ganti cara, jangan ulangi perintah identik. Tetapi layar menuduhnya terlarang dan
menyuruh Owner ke terminal, **untuk sesuatu yang hasilnya sudah ada di layar itu juga**.

### Yang diperbaiki

Keadaan tersendiri `'diulang'`, ikon `history` (bukan gembok), nada netral:

> 🕘 *"Sudah dijalankan di percakapan ini — hasilnya ada di atas. Perintahnya boleh; mengulanginya
> tidak akan memberi hasil berbeda."*

Larangan yang **sungguhan** tidak ikut melunak: tetap `'blocked'`, tetap gembok, tetap tegas.

---

## Uji

`uji/uji-grep-sebagian-dan-gembok.mjs` (baru) — 30 pemeriksaan. **72/72 berkas uji hijau**, tiga
berkas tersunting lolos parser esbuild.

Sebagian besar ujinya menjaga penjaga itu **DIAM pada saat yang tepat**: empat bentuk permintaan
konteks, empat bentuk hitung/daftar, bukan-grep, keluaran kosong, perintah gagal. Penjaga yang
cerewet akan diabaikan, dan itu lebih buruk daripada tidak ada penjaga.

Dua asersi khusus menjaga pemisahan gemboknya tetap terlihat: ikonnya **harus ada di subset font**
(jebakan yang sudah tiga kali menggigit) dan **harus berbeda dari `lock`** — kalau sama, pemisahannya
tidak terlihat Owner dan pekerjaan ini sia-sia.

## Yang TIDAK dikerjakan, atas pilihan Owner

Usul ketiga — `max_tokens: 8192` yang dipaku di enam tempat sehingga permintaan ditolak bulat-bulat
saat OpenRouter hanya mampu 623 — **ditunda**. Owner memilih dua yang menyangkut mutu bukti lebih
dulu. Dicatat di INDEX.

Pengetahuan pendukungnya dari Owner, yang tidak terlihat dari kode mana pun: **saldo OpenRouter-nya
minus $-0,19 dan tetap melayani sebagian**; utangnya terpotong saat isi ulang. Jadi 402 "can only
afford N" bukan tanda layanan mati.

## Belum sampai ke aplikasi

Keduanya renderer/klien — ikut rilis berikutnya, **tidak perlu deploy**.
