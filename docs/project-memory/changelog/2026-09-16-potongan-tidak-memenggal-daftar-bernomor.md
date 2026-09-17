# Potongan RAG Tidak Lagi Memenggal Daftar Bernomor

**Tanggal:** 16 September 2026
**Roadmap:** Item 87
**Status:** dikerjakan & diuji lokal dengan kontrol; **belum terbukti live** (menunggu deploy `rag-process` + unggah ulang).

## Latar

Uji satu jabatan dari buku Kepbup Standar Kompetensi Jabatan (OKU) — berkas percobaan
`UJI-Kepbup-Sekretaris-DPRD-hal4-9.pdf`, 6 halaman, 18 potongan, 12.637 huruf, 16 potongan di antaranya
sudah berupa tabel Markdown hasil mistral-ocr.

Pertanyaan **"Sebutkan pelatihan teknis yang dipersyaratkan."** dijawab:

> 1. Tata Naska Dinas  2. Sertifikasi Barang Dan Jasa — [STATUS: VERIFIED]

Dokumen memuat **tiga**: butir ketiga "Perencanaan dan Keuangan" tidak disebut. Label VERIFIED sendiri
tidak salah — dua butir itu memang ada di potongan yang dilihat model — tetapi jawabannya **kurang satu
syarat** tanpa tanda apa pun. Untuk dokumen peraturan, kekurangan seperti ini menyesatkan keputusan.

## Sebab (bukti dari metadata pesan & isi potongan)

1. Daftar terpenggal tepat di titik potong: satu potongan berakhir sesudah `2. Sertifikasi Barang Dan
   Jasa`; `3. Perencanaan dan Keuangan` jatuh ke potongan berikutnya bersama Pengalaman Kerja, Pangkat,
   dan Indikator Kinerja.
2. Potongan kedua itu **tidak ikut terambil**: `ragArray size=8`, konteks 12.979 huruf, memuat
   "Sertifikasi Barang" tetapi **tidak** memuat "Perencanaan dan" maupun "Pembina".
3. Tumpang tindih 100 huruf tidak menolong: tumpang tindih menarik teks **sebelum** titik potong ke
   potongan berikutnya, sedangkan yang hilang adalah butir **sesudahnya**.

## Perubahan

- **Baru `lib/daftar_bernomor.ts`** — `akhirTanpaDaftarTerpenggal()`: bila baris terakhir potongan memuat
  butir bernomor `N.`, titik potong **melar ke depan** selama baris berikutnya meneruskan urutan
  (`N+1`, `N+2`, …). Baris kosong tidak memutus urutan; daftar baru yang mulai lagi dari `1.` tidak
  ditarik. Batas keras **2× ukuran potongan** (1.600 huruf). Murni, tanpa impor, bisa diuji di Node.
- **`lib/vector_utils.ts`** — aturan itu dipasang di `chunkText` sesudah titik potong dihitung, sebelum
  `tambahJudulTabel` (Item 76) menempelkan judul kolom tabel.
- **Tumpang tindih tetap 100** (sengaja, alasan di §Sebab butir 3): memperbesarnya hanya menambah jumlah
  potongan dan biaya embedding tanpa menutup kasus ini.

## Uji (lokal, di luar git)

`uji-daftar.mjs`, bahan uji memakai baris asli Kepbup dengan panjang pengganjal **dihitung** agar batas
800 huruf jatuh tepat di antara butir 2 dan 3.

| Jalur | Hasil |
|---|---|
| **Kontrol** (`akhirTanpaDaftarTerpenggal` dimatikan) | **5 lolos, 2 gagal** — potongan berhenti di 798 huruf sesudah butir 2; butir 3 terlempar ke potongan kedua (122 huruf). Persis kegagalan produksi. |
| **Dengan perbaikan** | **7 lolos, 0 gagal** — ketiga pelatihan dalam satu potongan. |

Uji lain (keduanya lolos di dua jalur): batas keras 2× tidak dilewati; prosa biasa terpotong seperti
sebelumnya tanpa teks hilang; daftar baru tidak menempel ke daftar lama.

Bundel esbuild `agent-process` dan `rag-process`: lolos.

## Cara membuktikan live

1. Deploy **`rag-process`** (pemotongan terjadi di sana saat unggah); `agent-process` juga berubah
   karena berkasnya ada di sana.
2. Unggah ulang `UJI-Kepbup-Sekretaris-DPRD-hal4-9.pdf` dengan OCR (dokumen lama sudah dihapus Owner).
3. Tanya lagi: "Sebutkan pelatihan teknis yang dipersyaratkan." Benar = **tiga** butir.

## Batas yang disadari

- **Dokumen lama tidak ikut terbaiki** — potongan sudah tersimpan; perlu unggah ulang.
- Aturan ini menolong daftar yang **bernomor**. Daftar bertanda titik/strip tanpa nomor, atau tabel
  panjang tanpa penomoran, masih bisa terpenggal.
- Pengambilan potongan **tetangga** (butir 3 usulan ke Owner) belum ada: `document_chunks` tidak
  menyimpan nomor urut potongan. Itu perubahan skema + mode "dokumen peraturan", direncanakan terpisah.
