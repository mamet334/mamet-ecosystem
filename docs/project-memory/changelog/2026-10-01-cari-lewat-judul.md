# Dokumen bisa ditemukan lewat judulnya — 221 Kepbup yang selama ini tak terjangkau nomornya

**1 Oktober 2026** · migrasi `20261001000100_cari_lewat_judul.sql` · belum diuji live

## Masalahnya, diukur sendiri — bukan dikutip

Temuan asalnya dari catatan `engine-vector` (93%). Diukur ulang langsung ke database produksi, dan
hasilnya **lebih buruk**:

```
221 dokumen Kepbup · 3.629 potongan
kata "kepbup" muncul di          0 potongan
nomornya sendiri ada di isi       0 dari 221 dokumen   ← bukan 206, melainkan SEMUA
```

Contoh nyata yang diperiksa satu per satu:

```
Judul : "Kepbup OKU 2025 - 204 - Camat (Kecamatan Lengkiti).pdf"
14 potongan · yang memuat "204": 0
Baris konteks: [Konteks: Nama Jabatan: Camat · Urusan Pemerintah: Kecamatan Lengkiti › …]
```

Baris konteks (Item 89) memuat jabatan dan urusan, **bukan** nomor dokumen. Judul memuat keduanya,
tetapi `document_chunks.fts` hanya dihitung dari `content` — **judul tidak pernah ikut dicari.**

Jadi menemukan dokumen lewat nomornya bukan "sulit": ia **mustahil**.

## Kenapa RRF tidak bisa menolong, berapa pun bobotnya

`match_documents_hybrid` menyaring dengan:

```sql
where p.similarity > match_threshold
```

Itu kemiripan **vektor**. Untuk "Kepbup 204", potongan tabel kompetensi berkemiripan rendah → **dibuang
sebelum RRF sempat bekerja**. Menaikkan bobot kata kunci tidak menyelamatkan yang sudah tersaring.
Ini sebab struktural, bukan soal penyetelan.

## Yang dikerjakan

**Jalur terpisah, fungsi lama tidak disentuh.** `match_documents_hybrid` memegang patokan terukur
**recall@8 14/14** (Item 90 Tahap B); mengubahnya menggeser patokan itu dan membuat setiap pengukuran
sesudahnya tidak sebanding.

| | |
|---|---|
| `documents.fts_judul` | kolom tsvector dihitung Postgres dari `title` + indeks GIN |
| `match_documents_judul()` | RPC baru; **semua kata wajib ada di judul** (`&`), tanpa ambang kemiripan |
| `lib/rag/cari_judul.ts` | penggabung hasil, murni & bisa diuji |
| `document_search.ts` | memanggil jalur judul, menggabungkan; `match_documents_hybrid` tetap apa adanya |

## Terbukti di database, bukan diperkirakan

| Kueri | Hasil |
|---|---|
| `kepbup 204` | **1 dokumen — yang benar**, 14 potongan |
| `pangkat camat lengkiti` | **0** — tidak merebut pertanyaan biasa |
| `camat lengkiti` | 2 dokumen |
| kata kosong | 0 |

Syarat **semua-kata** itulah yang membuatnya sempit dengan sendirinya: "pangkat" tidak ada di judul
mana pun, jadi pertanyaan biasa tetap dijawab jalur hibrida. Tidak perlu pendeteksi "kueri identitas"
yang bisa salah menebak.

## Tiga aturan penggabungan, masing-masing ada alasannya

1. **Dokumen yang sudah ketemu tidak disisipkan lagi** — hanya akan menggeser potongan lain keluar.
2. **Disisipkan di DEPAN** — pertanyaan yang menyebut nomor dokumen adalah pertanyaan tentang dokumen
   itu; di belakang, ia yang pertama terpotong saat konteks dipangkas.
3. **Dibatasi 3 potongan** — satu Kepbup punya ±14. Memasukkan semuanya mengusir seluruh hasil
   pencarian isi: menukar satu kegagalan dengan kegagalan lain.

Panjang hasil **tidak bertambah** — total tetap dipotong ke batas yang sama, jadi anggaran konteks dan
biaya tidak berubah diam-diam. Kegagalan jalur judul dibungkus `try/catch`: pencarian biasa tetap jalan.

## Dua cacat pada uji saya sendiri

1. Asersi ditulis `!x.length > 1`, yang dibaca `(!x.length) > 1` — **selalu false**, jadi merah walau
   kodenya benar.
2. Regex pembuang antarmuka TypeScript mencari `\n}\n`, sementara berkas di direktori kerja ber-CRLF
   → modulnya gagal dimuat **sesudah normalisasi CRLF**. Jebakan CRLF yang dijaga
   `scripts/samakan-crlf.mjs`, kali ini menggigit berkas ujinya sendiri.

## Bukti

60 berkas uji hijau · `agent-process` lolos esbuild · migrasi terpasang di produksi.

**Uji live yang masih perlu:** deploy `agent-process`, lalu satu chat yang menyebut nomor Kepbup —
mis. *"apa isi Kepbup 204?"*. Yang dibuktikan: log `[RAG] Judul cocok: N potongan disisipkan dari "…"`
dan jawabannya menyebut jabatan yang benar. Kendali: pertanyaan biasa tanpa nomor **tidak** memunculkan
baris log itu.

---

## Uji live 1 Oktober: jalur judul TIDAK menyala — dan sebabnya ada di pembuktian saya

Owner deploy lalu bertanya **"apa isi Kepbup 204"**. Log:

```
[RAG] Pencarian gabungan vektor+kata: 8 potongan, 3 kata kunci [isi, kepbup, 204]
```

Tidak ada satu pun baris `[RAG] Judul cocok`. Jalur judulnya **tidak menyala sama sekali**.

**Sebabnya:** syarat "SEMUA kata harus ada di judul". Judul
"Kepbup OKU 2025 - 204 - Camat (Kecamatan Lengkiti).pdf" tidak memuat kata **"isi"**.

**Kesalahan yang sebenarnya ada pada cara saya membuktikan.** Pembuktian SQL sebelumnya memakai
`['kepbup','204']` — **kasus bersih yang saya pilih sendiri**. Pertanyaan manusia selalu membawa kata
yang tidak ada di judul ("apa", "isi", "berapa"). Syarat semua-kata hanya bekerja untuk kueri yang
sudah dibersihkan, yaitu kueri yang tidak pernah ada.

Bukti yang disusun dari masukan pilihan sendiri bukan bukti — ia cermin, dalam bentuk lain.

## Perbaikan: minimal DUA kata cocok

Migrasi `20261001010000_cari_judul_minimal_dua_kata.sql`. Diukur terhadap data nyata **sebelum**
ditulis, dan diperiksa lagi sesudah dipasang:

| Kueri | Hasil |
|---|---|
| `isi kepbup 204` | **3 potongan dari 1 dokumen — yang benar** |
| `kabar hari` | 0 |
| `kepbup` (satu kata) | **0** — penting: seluruh 221 judul memuat kata itu |
| kosong | 0 |

Kenapa **dua**, bukan satu: semua 221 judul memuat "kepbup", jadi satu kata cocok akan menarik 221
dokumen sekaligus. Dua kata membuat **nomornya** (atau jabatan + wilayah) yang menentukan.

Diurutkan dari yang paling banyak cocok, supaya dokumen paling tepat berada di depan saat
`match_count` memotong.

**Tidak perlu deploy ulang** — yang berubah hanya fungsi SQL; `agent-process` yang sudah terpasang
memanggilnya dengan nama yang sama.

## TERBUKTI LIVE 1 Oktober — dan satu batas yang ikut ketahuan

Chat kedua Owner, pertanyaan yang sama persis:

```
00:52:16  [RAG] Pencarian gabungan … 3 kata kunci [isi, kepbup, 204]     ← aturan lama, tidak menyala
00:59:49  [RAG] Pencarian gabungan … 3 kata kunci [isi, kepbup, 204]
00:59:49  [RAG] Judul cocok: 3 potongan disisipkan dari
          "Kepbup OKU 2025 - 204 - Camat (Kecamatan Lengkiti).pdf"       ← aturan baru
```

Kata kuncinya **identik** di kedua chat, jadi yang berubah memang aturannya — bukan pertanyaannya.
Sebab-akibat yang bersih, dan Owner memberikannya tanpa diminta dengan bertanya dua kali.

Jawabannya benar dan **berlabel VERIFIED**: Camat · Administrator · Kecamatan Lengkiti, beserta
Ikhtisar Jabatan yang tepat, dengan baris `Sumber:` yang sah.

### Batas yang ikut ketahuan dari jawabannya sendiri

Model menutup jawabannya dengan jujur: *"Dokumen yang tersimpan di database hanya memuat sebagian isi
(Halaman 1 dan 3)… kompetensi nomor 1–6, 8–9, dan 12 ke atas tidak tersedia."*

Diperiksa: **`document_chunks` tidak punya kolom urutan** — hanya `id` bertipe **uuid**. Jadi
`order by dc.id` di `match_documents_judul` **bukan urutan dokumen, melainkan acak**. Tiga potongan
yang disisipkan adalah tiga **sembarang** dari 14, bukan tiga yang pertama.

Akibatnya untuk pertanyaan "apa isi dokumen X", jawabannya **selalu sebagian**, dan bagian mana yang
terbawa tidak bisa diduga.

**Tidak diperbaiki hari ini, dan alasannya:** menambah kolom urutan mudah untuk unggahan baru, tetapi
**mengisi ulang urutan 3.629 potongan lama tidak bisa diandalkan** — uuid tidak menyimpan jejak urutan,
dan urutan fisik baris bukan jaminan. Memalsukan urutan lebih buruk daripada mengakui tidak punya.

Yang menyelamatkan keadaan ini: **model mengatakannya sendiri.** Ia tidak mengarang bagian yang tidak
ia terima — justru menyebut nomor kompetensi mana yang hilang. Label VERIFIED tetap sah karena yang
ia tuliskan memang bersumber.

**Bila nanti ingin diperbaiki:** kolom urutan diisi saat unggah untuk dokumen BARU, dan potongan lama
dibiarkan apa adanya sampai dokumennya diunggah ulang. Jangan menebak urutan yang sudah hilang.
