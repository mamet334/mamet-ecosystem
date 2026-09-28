# 2026-09-28 — Label dinilai per pernyataan, bukan per gumpalan (T13)

Gagasan yang layak dari CHIMERA diserap sebagai TypeScript yang bisa dibaca dan ditambal, bukan
disalin sebagai biner. Keputusan Owner sesudah T13.

## Celah yang ditutup

`periksaLabelSumber` menilai jawaban sebagai **satu gumpalan**: lolos semua atau turun semua. Jawaban
yang menyebut Sumber dengan benar, angka dan halamannya sah, tetapi menyelipkan satu-dua kalimat dari
pengetahuan umum model, tetap berlabel `VERIFIED` utuh — bentuk Item 70 pada tingkat kalimat.

Dibuktikan oleh uji kendali dengan **revisi dipaku `8dd5e3b`**: pemeriksa di revisi itu meloloskan
jawaban contoh sebagai VERIFIED; lapisan baru menangkapnya pada masukan yang sama persis.

## Rancangan

`lib/verification/klaim_sumber.ts` (baru) dipanggil sebagai **lapisan terakhir**, sesudah seluruh
pemeriksaan lama lolos — yaitu tepat di jalur yang hari ini dilepas apa adanya. Karena itu ia hanya bisa
**memperketat**; tak ada jawaban yang hari ini diturunkan bisa jadi lebih longgar karenanya.

Tiga pagar, ditulis di kepala berkas, masing-masing dari kegagalan CHIMERA yang terukur di T13:

1. **Tidak ada vonis "bertentangan".** Kecocokan kata tidak bisa membuktikan sesuatu SALAH, hanya bahwa
   sandarannya tidak ditemukan. CHIMERA mencap jawaban benar sebagai kontradiksi 0,95 karena satu kata
   "dilarang" ada di potongan yang sama.
2. **Angka bukan urusan lapisan ini** — sudah ada `periksaAngkaSumber`, `periksaHalamanSumber`,
   `periksaRujukanSumber` yang jauh lebih teliti. Di sini angka justru dibuang dari perbandingan.
3. **Ambangnya rendah, bukan tinggi.** Pertanyaannya "punya pijakan sama sekali?", bukan "seberapa mirip".

### Akar kata Indonesia

Tumpang-tindih token mentah tidak cocok untuk bahasa Indonesia — di situlah CHIMERA jatuh pada kasus F.
Tiap kata dipecah jadi beberapa calon akar lalu dianggap cocok bila ada calon yang sama:
`pembayaran` → {…, bayar}, `dibayarkan` → {…, bayar}. Huruf yang luruh dikembalikan sebagai calon
tambahan, jadi `menerima` bertemu `terima`.

### Dua ambang — hasil pengukuran, bukan pilihan rasa

Rancangan pertama memakai satu ambang 0,34. **Dibatalkan** setelah porsi tiap kalimat diukur:

| Kelas kalimat | Porsi |
|---|---|
| kutipan langsung yang benar | 0,75 – 1,00 |
| **simpulan yang sah** | **0,25 – 0,57** ← beririsan |
| ekstrapolasi (asing) | 0,00 – 0,13 |

Kalimat simpulan ("Dengan demikian, pegawai memperoleh haknya secara rutin…") memang miskin kata
dokumen: ia merujuk balik ke kalimat sebelumnya, bukan membawa fakta baru. **Tiga dari lima** kalimat
semacam itu akan dituduh keliru oleh ambang tunggal 0,34; menggesernya hanya memindahkan korban.

Maka ambangnya dipisah, dengan **zona diam** di tengah: ≥0,34 bersandar · ≤0,15 tak bersandar ·
di antaranya **tidak diputuskan** dan tidak dihitung ke mana pun. Zona diam itu penerapan pagar ke-3:
lebih baik melewatkan ekstrapolasi daripada menuduh simpulan yang benar.

### Label ketiga

`[STATUS: PARTIAL - Sebagian Bersandar Dokumen]`, **ditambahkan sistem** seperti HYPOTHESIS — tidak ada
perubahan prompt, BLOK 6 tetap hanya mengenal VERIFIED dan HYPOTHESIS. Catatannya menyebut kalimat mana
yang belum ditemukan sandarannya, supaya Owner bisa memeriksa bagian itu saja.

`HasilLabel` kini membawa `label`. `stream_handler.ts` dulu memaku HYPOTHESIS saat menambahkan koreksi di
akhir aliran; sejak ada PARTIAL, label itu wajib dibaca dari hasil agar jalur stream dan non-stream tidak
memberi vonis berbeda untuk jawaban yang sama.

## Berkas

| Berkas | |
|---|---|
| `lib/verification/klaim_sumber.ts` | **baru** — pemecah klaim, akar kata, dua ambang, putusan |
| `lib/verification/label_sumber.ts` | lapisan terakhir + `LABEL_PARSIAL` + `label` pada `HasilLabel` |
| `lib/stream_handler.ts` | label dibaca dari hasil, tidak lagi dipaku |
| `uji/uji-klaim-sumber.mjs` | **baru** — 28 pemeriksaan |
| `uji/uji-sumber-terminal.mjs` | v2 — `bundle: true` (label_sumber kini punya impor) |
| `uji/uji-folder-label.mjs` | v2 — perbaikan terpisah, lihat di bawah |

## Temuan sampingan: satu berkas uji diam-diam merah empat hari

Saat menjalankan seluruh berkas uji, `uji-folder-label.mjs` gagal 3. **Bukan** akibat perubahan ini:
folder `D:/SLAMET/other/gabut/engine` **diganti nama** menjadi `engine-vector` pada 24 Sep, dan ujinya
memaku alamat lama. Uji itu membaca folder **di luar repo**, jadi ia bisa patah tanpa satu pun commit di
sini — dan tak ada yang tahu selama empat hari.

Diperbaiki: alamatnya dicari di antara dua kandidat; bila tak ada, uji **DILEWATI** (keluar 0) alih-alih
gagal, seperti aturan `uji/data-lokal/`. Satu harapannya juga dilepaskan dari nomor baris
(`core/engine.go:177` → `core/engine.go:<baris>`) karena baris itu bergeser ke 258 saat engine-nya
dikembangkan, padahal yang hendak dibuktikan cuma "hasil pencarian ikut masuk sebagai isi".

## Yang terbukti, dan yang belum

- ✅ 45 berkas uji hijau; bundel `agent-process` lolos esbuild.
- ✅ Uji **terpasang** lewat `periksaLabelSumber` asli, bukan lewat modul klaim saja — dua uji minggu lalu
  lulus justru karena kekeliruan itu.
- ✅ Uji kendali dengan revisi dipaku; sempat kedaluwarsa saat memakai modul yang sudah tersambung, lalu
  diperbaiki. Pelajaran `uji/README.md` butir 1 terulang dan tertangkap.
- ⏳ **Belum terbukti live.** Perlu deploy, lalu satu jawaban RAG panjang yang menyelipkan kalimat
  pengetahuan umum: harus keluar PARTIAL dengan kalimat itu disebut di catatan.
