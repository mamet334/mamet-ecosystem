# 5 Oktober 2026 — 45% korpus tak bisa dicari lewat nomornya

## Asalnya: Owner menunjuk `engine-vector`

Owner meminta Item 93 Tahap 3 (embedding lokal) dikerjakan, sambil menunjuk folder
`D:\SLAMET\other\gabut\engine-vector`. `LANGKAH-BERIKUTNYA.md` di sana menutup dirinya dengan
nasihat yang langsung terpakai:

> *"Periksa `mamet-ecosystem` sebelum membangun apa pun. Empat kali di sesi ini pekerjaan ternyata
> sudah ada di sana."*

Dokumen itu mendaftar satu pekerjaan **yang tidak tergantung gerbang Tahap 3**: *"93% Kepbup tidak
bisa dicari lewat nomornya."* Diperiksa lebih dulu — dan memang sudah dikerjakan di Mamet:
`cari_judul.ts`, RPC `match_documents_judul`, kolom `documents.fts_judul`, semuanya hidup di
produksi dan dipanggil `document_search.ts`.

Lalu dibuktikan, bukan diterima: **"Kepbup 204" → tepat satu dokumen yang benar.** Lulus.

## Uji kendali yang membongkar lubangnya

Satu contoh yang berhasil bukan bukti. Nomor lain dicoba — dan **kosong**:

```
match_documents_judul(['kepbup','017'])  → 3 potongan ✓
match_documents_judul(['kepbup','17'])   → 0          ✗
match_documents_judul(['kepbup','007'])  → 3 ✓
match_documents_judul(['kepbup','7'])    → 0          ✗
```

"204" selama ini berhasil **semata karena ia kebetulan sudah tiga digit**. Itulah yang membuat
cacatnya lolos dari pemeriksaan sekilas selama empat hari.

## Rantainya putus DUA kali

```
"kepbup 17"  →  kataKunciPencarian  →  ["kepbup"]     ← w.length > 2 membuang "17"
             →  satu kata saja       →  array_length >= 2 gagal  →  KOSONG
```

1. **`kataKunciPencarian` membuang token ≤2 huruf.** Saringan itu ditulis untuk kata sambung dalam
   prosa dan tak pernah ditinjau ulang untuk **penanda** — padahal nomor satu-dua digit justru
   penanda yang paling sering diketik orang.
2. **Seandainya lolos pun ia tak cocok**: judul menyimpan `"017"`, dan `"17"` ≠ `"017"` sebagai
   leksem `to_tsquery('simple', …)`.

Melegakan satu hal: kegagalannya **kosong**, bukan dokumen salah yang dikembalikan dengan yakin.
Penjaga `cocok >= 2` di dalam fungsi SQL yang menyelamatkannya.

## Diukur di korpus PENUH, dua arah

Nomor 001–221, 221 nomor unik, berpadding tiga digit. Disapu seluruhnya lewat SQL dengan oracle
independen (nomor dari judul dokumen yang dikembalikan harus sama dengan nomor yang dicari):

| | Ketemu | Kosong | Ganda | Dokumen salah |
|---|---|---|---|---|
| **LAMA** | 122 | **99 (44,8%)** | — | — |
| **BARU** | **221** | **0** | **0** | **0** |

Bukan sampel. Bukan fixture. 221 dari 221, masing-masing tepat satu dokumen dan dokumen yang benar.

## Perbaikannya

`kataKunciJudul()` di `cari_judul.ts` — daftar kata **terpisah** untuk jalur judul saja.

```
"kepbup 17"      → ["kepbup", "17", "017"]
"kepbup nomor 7" → ["kepbup", "nomor", "7", "07", "007"]
"kepbup 017"     → ["kepbup", "017", "17"]
"kepbup 204"     → ["kepbup", "204"]          ← PERSIS seperti sebelumnya
```

**Kenapa daftar terpisah, bukan memperbaiki `kataKunciPencarian`.** Fungsi itu juga memasok
`match_documents_hybrid`, yang memegang patokan terukur recall@8 **14/14** (Item 90 Tahap B).
Menambah token di sana menggeser patokan itu dan membuat seluruh pengukuran lama tak lagi
sebanding. `cari_judul.ts` memang sudah sengaja berdiri sendiri; perbaikan ini mengikuti pemisahan
yang sama, dan satu asersi menjaga daftar baru **tidak bocor** ke jalur hybrid.

**Dua arah, bukan satu.** `"17"` juga mencoba `"017"`, dan `"017"` juga mencoba `"17"`. Korpus lain
boleh jadi menyimpan tanpa padding; menebak satu arah saja akan mengulang cacat yang sama dari sisi
sebaliknya.

**Ketepatan tidak dikorbankan.** Varian hanya untuk token ANGKA, dan `cocok >= 2` tetap berlaku —
terbukti pada sapuan penuh: nol dokumen ganda, nol dokumen salah.

## Uji

`uji/uji-cari-judul-nomor.mjs`.

| Mutasi | Asersi jatuh |
|---|---|
| M1 varian padding dicabut | 4 |
| M2 angka tidak ikut sama sekali | 3 |
| M3 hanya lebar 3 (dua digit hilang) | 2 |
| M4 bentuk apa adanya tidak ikut | **0 — bukan cacat** |
| M4′ nol di depan tidak dikupas (arah balik mati) | 2 |
| M5 jalur judul kembali pakai kata kunci lama | 3 |
| M6 daftar baru BOCOR ke hybrid | 3 |

**M4 tidak menggigit, dan jawabannya bukan menambah asersi — melainkan MENGHAPUS barisnya.**
`keluar.add(asli)` terbukti mati: bentuk apa adanya selalu sudah tercakup (sama dengan `telanjang`,
atau sudah lolos ke `dasar` bila ≥3 huruf, atau justru hasil padding bila pendek; stopword tidak
memuat angka, jadi tak ada jalan ketiga). Baris yang tak pernah bisa salah adalah baris yang tak
perlu ada. Keluarannya diperiksa identik sebelum dan sesudah penghapusan.

## Tiga asersi rapuh ikut diperbaiki — dan ketiganya sekelas

Perubahan yang **benar** menjatuhkan tiga asersi milik uji lain. Tak satu pun menunjukkan kerusakan:

| Di mana | Yang dipaku | Dijatuhkan oleh |
|---|---|---|
| `uji-peta-repo` | seluruh daftar impor + urutannya | menambah satu nama yang sah |
| `uji-cari-judul` | seluruh daftar impor + urutannya | idem |
| `uji-cari-judul` | `try {` harus dalam 400 huruf sebelum RPC | satu komentar penjelas di atasnya |

Ketiganya menguji **ejaan baris**, bukan sifat yang hendak dijaga. Diganti: impor diperiksa per
nama, dan `try/catch` ditelusuri (cari `try {` terdekat ke belakang, `} catch` ke depan, lalu
pastikan `try` itu memang belum tertutup). Keduanya dibuktikan **masih menggigit** lewat N1/N2 —
dilonggarkan dari ejaannya, bukan dari sifatnya.

### Dan pemuat `uji-cari-judul` ikut diganti

Ia mengupas TypeScript dengan **rantai regex, satu pola per tanda tangan fungsi**. Setiap ekspor
bertipe baru wajib didaftarkan di sana; bila lupa, modulnya gagal dengan `SyntaxError: Unexpected
token ':'` — kegagalan yang **terlihat seperti kode rusak** padahal pemuatnyalah yang usang. Itu
persis yang terjadi saat `kataKunciJudul` ditambahkan.

Diganti esbuild, sama seperti seluruh uji lain di repo ini. Jebakan CRLF yang dulu ditangani manual
ikut hilang, dan `AKAR` yang dipaku sebagai jalur absolut (`'D:/SLAMET/...'`) kini diturunkan dari
letak berkasnya — ujinya tak lagi terikat satu mesin.

**83/83 berkas uji hijau.** Bundel esbuild bersih.

## PERLU DEPLOY, tanpa rilis klien

Seluruhnya di `supabase/functions/agent-process/lib/rag/`. Tidak ada migrasi: `fts_judul`,
`match_documents_judul`, dan indeksnya **sudah ada** di produksi.

**Cara memastikan live, tanpa saldo:** jalankan sapuan SQL yang sama. Pencarian judul adalah
pencarian TEKS — ia tidak memanggil embedding sama sekali, jadi saldo OpenRouter tidak
menghalanginya.

## Item 93 Tahap 3 — tetap TERHALANG, dan bukan oleh keputusan

Gerbang Tahap 3 belum bisa dijalankan. PostgreSQL 17 **sudah terpasang dan berjalan** di laptop
Owner, tetapi:

| Langkah | Penghalang |
|---|---|
| Terapkan migrasi ke Postgres lokal | **kata sandi `postgres`** — percobaan menggantung di prompt, dihentikan |
| Pasang model E5 | unduhan ~1 GB, sekali |
| Re-embed korpus | 10–15 menit |
| Jalankan `gerbang_tahap3.py` | sesudah tiga di atas |

Ketiganya hanya bisa dibuka Owner.
