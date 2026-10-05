# 5 Oktober 2026 — Tiga kebocoran token dari SATU sesi nyata

Ketiganya terbaca dari sesi uji 4.2.12 pukul 01:33 — sesi yang justru **berhasil** di giliran
pertama berkat item 121, lalu patah di giliran kedua.

## Apa yang terjadi

```
01:33:22  [Saldo] 402: diulang SEKALI dengan max_tokens: 399   → BERHASIL (item 121)
          Engineer menjalankan git grep -n -B2 -A4 "402" -- (tiga folder)  → 15.671 huruf
01:33:25  [HakimBayangan] 402 "in-flight requests"
01:33:29  riwayat=4 pesan/3.064 huruf | pesan=15.769 | total=49.993  → 402 prompt kebesaran
```

## 1. Keluaran perintah tidak punya anggaran

Batas 20 KB yang sudah ada (`alatFolderJalan.cjs`) adalah batas **terminal** — ia menjaga proses,
bukan anggaran token. 15.671 huruf lolos darinya dengan mudah, lalu jadi 15.769 huruf di prompt.

Perlu dikatakan terus terang: sehari sebelumnya peta repo dipangkas 13.870 huruf dari **tiap**
pesan, lalu satu perintah tanpa anggaran mengembalikan 15.671. Pemangkasan itu tetap benar — ia
permanen dan berlaku di setiap pesan — tetapi ia tidak menyentuh kelas biaya ini sama sekali.

**`BATAS_KELUARAN_MODEL = 8000`**, dan angka itu **pilihan anggaran, bukan pengukuran**: ia
ditambatkan ke blok terbesar yang tersisa (`konteks_engineer`, 17.687 huruf) supaya keluaran satu
perintah tidak pernah jadi bagian terbesar prompt.

### Kepala DAN ekor, bukan potong-di-ujung

Pada keluaran `git grep` tiap baris adalah satu kecocokan, dan kecocokan **terakhir** sering ada
di berkas yang berbeda dari yang pertama. Membuang ekor berarti model menyimpulkan dari satu sudut
repo saja — persis kelas kesalahan yang dijaga `petunjukGrepSebagian`.

Dipotong pada batas **baris**: baris grep yang terpenggal (`supabase/func`) terbaca seperti alamat
berkas yang sebenarnya tidak ada.

Catatannya mengikuti pola keluarga `petunjuk*` — sebut batasnya dengan angka, lalu beri **cara**
keluarnya (`git grep -l`, `git grep -c`, persempit foldernya), bukan sekadar melarang.

### Satu titik rakit

Dua jalur mengirim keluaran ke model (otomatis dan tombol manual) dan keduanya merakit teksnya
sendiri-sendiri di `ConversationEngine.jsx`. Anggaran yang dipasang di satu jalur akan dilewati
jalur lain tanpa suara, jadi keduanya kini lewat `pesanKeluaranPerintah()`. Bentuk teksnya
**tidak berubah** — `riwayatPerintahDariPesan` mengurainya kembali dengan pola yang sama, dan itu
diuji.

## 2. Varian 402 KETIGA — in-flight, bukan saldo habis

```
"This request would exceed your available credits given your current in-flight requests.
 Retry after in-flight requests settle, or add credits."
```

Ini **tabrakan permintaan paralel**. Ia tidak memuat `can only afford` maupun
`Prompt tokens limit exceeded`, jadi ia jatuh ke cabang "tak terbaca" dan menyuruh *"isi ulang
saldo"* — tidak salah, tetapi menyembunyikan jalan keluar yang jauh lebih murah: **tunggu yang
satunya selesai**.

Tidak ada pengulangan otomatis: mengulang sekarang persis mengulangi tabrakannya, dan menunggu di
dalam fungsi akan menahan worker Supabase sampai batas waktu dindingnya.

**Satu kesalahan yang hampir terkirim:** rancangan pertama pesannya menyuruh *"matikan Hakim
Bayangan di Pengaturan"*. Tidak ada setelan itu di antarmuka — `HAKIM_BAYANGAN` adalah secret
Supabase. Itu persis kelas kesalahan yang sama dengan saran *"mulai percakapan BARU"* yang dicabut
4 Okt: menyuruh Owner melakukan hal yang tidak ada atau tidak berpengaruh. Diperbaiki sebelum
dikirim, dan diuji agar tidak kembali.

## 3. BRAIN 1 dikirim DUA KALI di mode Engineer

Bukan kemiripan — **string format yang sama huruf demi huruf**, dari sumber entri yang sama:

| | |
|---|---|
| `engineer_context.ts:91` | `` `[${e.entry_type}] ${e.title}: ${e.content}` `` → `konteks_engineer` |
| `context_builder.ts:528` | string yang **identik** → `brain1ContextText` → BLOK 4 |
| `context_builder.ts:420` | `ctx.brain1Entries = engineerCtx.brain1Entries` — satu sumber |

Model membaca isi yang sama dua kali dalam satu prompt.

**Yang dipertahankan: judulnya.** BLOK 6 menjadikan BLOK 4 rujukan label VERIFIED (*"Sumber: judul
dokumen persis seperti tertulis di BLOK 4"*), jadi judul harus tetap ada; yang dibuang hanya isi
yang sudah terbaca beberapa ribu huruf di atas. Dijaga **hanya mode ENGINEER** — di mode lain
`konteks_engineer` tidak ada sama sekali dan BLOK 4 adalah satu-satunya salinan.

Hemat ≈ 1.300 huruf per pesan. Kecil dibanding dua yang lain, tetapi ini **pemborosan murni**:
tidak ada aturan yang hilang.

## Yang TIDAK bisa saya kerjakan, dan kenapa

Owner meminta `konteks_engineer` (17.687 huruf) dipangkas. Setelah diukur, **tidak ada potongan
aman yang tersedia bagi saya**:

| Bagian | Huruf | Bisa dipangkas? |
|---|---|---|
| teks prosedur statis | **14.695** | ini **aturan**, bukan data |
| BRAIN 1 dari basis data | 1.328 | sudah ditangani di atas (kekembarannya) |
| BRAIN 2 + kepala blok | sisanya | sudah ringkas |

Dua pemeriksaan lagi, keduanya nihil:

- **narasi sejarah** (tanggal, "Until 2 Oct", "since 2 Oct"): hanya **634 huruf (3,6%)**, dan dua
  di antaranya adalah contoh kegagalan nyata yang justru membuat aturannya menempel
- **duplikasi dengan kontrak universal**: dicek dengan tumpang-tindih 6-gram pada 157 baris
  bermakna — **nol** dugaan duplikat

Peta repo bisa dipangkas karena ia **data yang bisa diambil saat perlu**. Aturan tidak: memangkasnya
mengubah perilaku Engineer, dan itu keputusan Owner, bukan keputusan saya. Pilihan yang tersedia —
mengirim aturan penuh hanya di giliran pertama lalu ringkasan di giliran lanjutan — hemat besar
tetapi berisiko aturan luntur di tengah percakapan. **Diserahkan ke Owner, tidak dikerjakan diam-diam.**

## Uji

`uji/uji-anggaran-keluaran.mjs` — modul aslinya dijalankan, bukan salinan logika.

| Mutasi | Asersi jatuh |
|---|---|
| M1 anggaran dilumpuhkan (tak pernah memotong) | 8 |
| M2 jadi potong-di-ujung (ekor dibuang) | 1 |
| M3 batas ukuran dilonggarkan | **0 — bukan cacat** |
| M3′ `split('\n')` dicabut (baris boleh terpenggal) | 1 |
| M4 larangan kesimpulan salah dihapus | 1 |
| M5 satu jalur merakit teksnya sendiri lagi | 2 |
| M6 pengenalan in-flight dilumpuhkan | 7 |
| M7 BRAIN 1 kembar lagi | 1 |
| M8 ringkasan dihitung lalu dibuang | 1 |

**M3 tidak menggigit, dan itu benar.** Keutuhan baris dijamin oleh `teks.split('\n')` — potongannya
selalu baris penuh — bukan oleh pemeriksaan ukuran. Alih-alih mengarang asersi supaya M3 jatuh,
dibuktikan asersinya **tidak hampa** lewat M3′ yang benar-benar mewakili cacatnya: mencabut
pemecahan baris menjatuhkannya. Memaksa M3 menggigit berarti menguji bentuk kode, bukan jaminannya.

### Satu asersi lama ikut diperbaiki

`uji-peta-repo.mjs` memaku **seluruh daftar impor** `ConversationEngine.jsx` beserta urutannya,
sehingga menambah satu nama yang sah menjatuhkannya tanpa ada yang rusak. Diganti dengan sifat yang
sebenarnya dijaga: `catatanPetaRepo` datang dari `ProsedurEngineer`. Asersi yang menguji **ejaan
baris** alih-alih sifatnya akan terus jatuh pada perubahan yang benar.

**82/82 berkas uji hijau.** Bundel esbuild bersih (524.830 bita), `ConversationEngine.jsx` lolos
pemeriksaan sintaks.

## PERLU DEPLOY **DAN** RILIS KLIEN

Pertama kali sejak beberapa hari keduanya diperlukan sekaligus:

| | Berkas |
|---|---|
| **deploy** | `adapters/reasoning_openrouter.ts`, `verification/universal_contract.ts` |
| **rilis klien** | `engineer/ProsedurEngineer.js`, `workbench/ConversationEngine.jsx` |

Anggaran keluaran ada di sisi klien — **deploy saja tidak akan mengaktifkannya.**
