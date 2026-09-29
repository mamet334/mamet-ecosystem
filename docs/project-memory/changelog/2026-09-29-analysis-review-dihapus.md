# Jalur ANALYSIS & REVIEW Engineer — diperiksa dulu, lalu dihapus

**29 September 2026** · keputusan Owner 28 September

## Perintah Owner, dan kenapa urutannya penting

Asisten mengusulkan menghapus seperti READ_REPO. Owner mengoreksi arahnya:

> *"cari lagi agar bermanfaat; jika sudah dikerjakan oleh kode lain yang lebih baik, tidak masalah
> dihapus."*

READ_REPO dihapus **sesudah** penggantinya terbukti — penghapusannya adalah **kesimpulan**, bukan titik
mulai. Untuk jalur ini penggantinya belum diperiksa, jadi menghapus lebih dulu berarti mengambil
kesimpulan yang sama tanpa mengerjakan pembuktiannya. Dokumen ini mencatat pembuktiannya.

## Hasil pemeriksaan

| Yang diperiksa | Temuan |
|---|---|
| `Engineer:AnalyzeTask`, `Engineer:ReviewChanges` | punya pendengar, **tidak ada satu pun pemancar** di seluruh repo |
| cabang `ANALYSIS` & `CLARIFICATION` | **tak pernah tercapai** — `UsulanPatch.js:53` (satu-satunya pembuat tugas) selalu menyetel `dariTombolApply: true`, jadi `detectIntent()` tak pernah dipanggil |
| `_review()` | **tidak menambah apa pun** di atas `_analyze()`: memanggilnya, lalu memetakan `violations.length > 0` jadi APPROVE/REJECT |
| `_analyze()` | **HIDUP** — dipanggil jalur MODIFY_CODE |
| `_buildDynamicContext()` | **HIDUP** — dipanggil jalur MODIFY_CODE |
| `_calculateConfidence()`, `_checkCompliance()` | **HIDUP** — dipakai beberapa tempat |

## Apakah ada yang mengerjakannya lebih baik? Ya.

**Untuk REVIEW:** vonis `_review` lahir dari **mencocokkan pola teks** — cara yang pada 24 September
menghasilkan dua pelanggaran palsu dan memblokir patch yang benar. Penggantinya sudah jalan sejak
28 September: **Tahap 6** menerapkan patch lalu **menjalankan 54 berkas uji**, dan memulihkan berkas
sendiri bila ada yang gagal. Pertanyaannya berubah dari *"apakah ini tampak patuh"* menjadi *"apakah
sistem ini masih benar sesudah patch"*.

**Untuk ANALYSIS:** kemampuannya **tidak hilang**. `_analyze()` tetap dipanggil jalur MODIFY_CODE yang
hidup, dan hasilnya tetap sampai ke Owner lewat Reasoning Lock (`emitReasoningReport`). Yang dihapus
**pembungkus tugasnya**, bukan kemampuannya.

Jadi syarat Owner terpenuhi, dan penghapusan ini adalah kesimpulan dari pemeriksaan.

## Yang dihapus

`Engineer:AnalyzeTask` + `Engineer:ReviewChanges` (pendengar) · `_handleAnalysisTask` +
`_handleReviewTask` (pembungkus) · `handleAnalysisTask` + `handleReviewTask` (TaskHandlers) ·
`_review()` · cabang `ANALYSIS` & `CLARIFICATION` · impor `detectIntent`.

**122 baris dibuang, 76 masuk** (sebagian besar catatan alasan) — bersih **−46 baris**.

## Menebak diam-diam diganti penolakan yang bersuara

Dulu: tugas tanpa `dariTombolApply` ditebak `detectIntent()`. Sesudah cabangnya hilang, membiarkannya
jatuh ke MODIFY_CODE berarti **menebak dalam diam** — tugas yang entah dari mana akan diperlakukan
sebagai permintaan mengubah kode.

Sekarang tugas semacam itu **ditolak dengan sebab yang jelas**, sampai ke layar Owner dan ke log:

> Tugas ini tidak datang dari tombol **Apply Patch**, jadi Engineer tidak memprosesnya. Hanya patch
> yang Anda setujui sendiri yang dikerjakan.

Bila suatu saat ada pemancar tugas baru yang lupa menyetel penandanya, ia berhenti di sini — bukan
menulis berkas.

## `IntentClassifier.js` disimpan, dengan alasan tertulis

Ia tidak lagi tersambung ke jalur hidup, tetapi dipakai **lima berkas uji** sebagai **bahan uji nyata**
(`uji-klaim-engineer`, `uji-prosedur-engineer`, `uji-sumber-terminal`, `uji-trace-parser-kendali-tetap`,
`uji-pecah-perintah-kutip`) — uji klaim Engineer harus menunjuk kode yang benar-benar ada. Peringatan itu
ditulis di kepala berkasnya, termasuk larangan menyambungkannya kembali tanpa memeriksa ulang.

## Bukti

`uji/uji-analysis-review-dihapus.mjs` · 55 berkas uji hijau · `vite build` lolos.

Bagian terpenting ujinya bukan "yang mati sudah hilang", melainkan **"yang hidup tidak ikut terbawa"**:
`_analyze`, `_buildDynamicContext`, `_calculateConfidence`, `_checkCompliance`, dan Reasoning Lock
semuanya bertetangga dengan kode mati itu dan gampang ikut terhapus. Uji menjaga keempatnya tetap ada
**dan tetap dipanggil**.

Ujinya juga memeriksa **pemakaian**, bukan penyebutan — komentar sejarah tetap menyebut nama kedua
penangan itu, dan versi pertama asersinya merah justru karena tidak bisa membedakan komentar dari
panggilan. Bentuk kegagalan yang sama pernah menipu `uji-konteks-chat` 28 September.
