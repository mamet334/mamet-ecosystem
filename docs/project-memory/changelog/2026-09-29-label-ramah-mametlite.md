# Label verifikasi Mametlite dalam bahasa penggunanya

**29 September 2026** · `mametlite/src/lib/labelRamah.js` · terbukti terpasang & terbangun, belum diuji live

## Yang berubah

Label verifikasi di Mametlite tidak lagi tampil sebagai teks mentah berbahasa Inggris di dalam jawaban.
Ia kini menjadi kotak di **atas** jawaban, dengan kalimat yang bisa dibaca pegawai ASN:

| Label server | Yang dilihat pengguna | Nada |
|---|---|---|
| `[STATUS: VERIFIED]` | **Dari dokumen** — bersandar pada dokumen yang tersimpan di Mamet | hijau |
| `[STATUS: PARTIAL - …]` | **Sebagian dari dokumen** — periksa dulu bagian yang penting | kuning |
| `[STATUS: HYPOTHESIS - …]` | **Perkiraan AI** — periksa dulu sebelum dipakai untuk pekerjaan | kuning |
| `[STATUS: INSUFFICIENT]` | **Jawabannya tidak ditemukan** — belum tentu tidak ada, mungkin dokumennya belum diunggah | netral |
| `[Pengetahuan umum AI — …]` | **Pengetahuan umum AI** — bukan dari dokumen Anda | kuning |

Baris `_Catatan sistem: …_` dipisahkan dari badan jawaban dan tampil sebagai catatan kecil.

## Kenapa — dan kenapa baru sekarang

Keterangan Owner 29 September yang menjadi dasar seluruh pekerjaan ini:

> **Mametlite** untuk chat dengan hasil pencarian lengkap dan RAG saja, **buat orang awam**.
> **Mamet Ecosystem** untuk tujuan yang berbeda — sistem kecerdasan pribadi Owner.
> Keduanya dipisah justru untuk memisahkan tujuannya.

Dari situ satu hal jadi terlihat: **di Mametlite tidak ada siapa pun yang memeriksa jawaban.** Di Mamet
Ecosystem, Owner sendiri pemeriksanya — ia paham RAG dan bisa membuka dokumennya. Di Mametlite, label
adalah satu-satunya yang berdiri antara pengguna dan jawaban yang keliru.

Dan justru di sanalah labelnya paling lemah. Pencarian di `mametlite/src` menunjukkan **tidak ada satu pun
kode yang menangani label**; yang ada hanya `<label>` formulir masuk. `[STATUS: VERIFIED]` sampai ke
pengguna sebagai teks mentah — kosakata Inggris berhuruf besar, istilah teknik, pada layar HP. Label yang
tidak dimengerti sama nilainya dengan tidak ada label.

Seluruh pekerjaan beratnya sudah selesai sejak lama di server (`label_sumber.ts`, Item 71/77/80/81). Yang
hilang cuma lapisan paling tipis di ujungnya.

## Empat keputusan di dalamnya

**1. Label di ATAS jawaban, bukan di bawah.** Server menulisnya di akhir. Pembaca perlu tahu cara membaca
jawaban **sebelum** membacanya, bukan sesudah terlanjur mempercayainya.

**2. Penjelasan selalu terlihat, bukan tooltip.** Pengguna Mametlite membuka dari HP. Di layar sentuh tidak
ada kursor, jadi tooltip tidak pernah muncul. Diuji: komponennya tidak boleh memuat `group-hover`/`title=`.

**3. Tidak pernah mengarang label.** Jawaban tanpa label dikenali → tidak ada kotak yang ditampilkan.
Termasuk saat jawaban masih mengalir: label ditulis server di akhir, dan potongan seperti `[STATUS: VERI`
tidak dianggap label. Lebih baik belum ada label daripada label yang berubah di tengah jalan.

**4. Bila dua label muncul, yang LEBIH HATI-HATI menang.** Server biasanya menyisakan satu, tetapi bila
model sempat menulis dua, menampilkan yang paling menenangkan adalah kesalahan termahal di sini —
pembacanya tidak punya cara memeriksa sendiri.

## Cacat kecil yang ikut ketahuan

`parseMarkdown` di Mametlite mengenal `*miring*` tetapi **tidak** `_miring_`, sementara server menulis
catatan sistem dengan garis bawah. Akibatnya catatan itu tampil beserta garis bawahnya. Karena catatan kini
dipisah dan dirender sendiri, gejalanya hilang tanpa menyentuh `parseMarkdown` — sengaja tidak diubah,
karena menambah aturan `_…_` berisiko merusak kata ber-garis-bawah lain.

## Bukti

- `uji/uji-label-ramah.mjs` — 3 lapis: penerjemahan, **selaras dengan server**, dan **terpasang**.
- **Penjaga anti-lepas:** uji membaca `LABEL_VERIFIED`/`LABEL_HIPOTESIS`/`LABEL_PARSIAL`/`CATATAN_*`
  langsung dari `label_sumber.ts`. Bila tulisan label di server berubah dan di sini tidak, uji **merah** —
  bukan diam, sementara pengguna kembali melihat teks mentah.
- `mametlite` `vite build` lolos; kelas warna Tailwind terbukti ada di CSS hasil build (`emerald-500/40`,
  `amber-500/10`, dst.) — risiko nyata karena kelasnya ditulis di berkas `.js`.
- Pratinjau dirender dari modul yang sungguhan: kelima keadaan benar di lebar desktop **dan 375 px**.

**Uji live yang masih perlu:** satu chat di `mametlite.vercel.app` untuk tiap jenis label.

---

## Uji live 29 September: lulus sebagian, satu cacat ketahuan

**Yang terbukti bekerja** (chat Owner di `mametlite.vercel.app`, pertanyaan pangkat Camat Kecamatan
Lengkiti): kotak label muncul **di atas** jawaban, bertuliskan **"Dari dokumen"** beserta kalimat
penjelasannya, dengan bingkai hijau. Jawabannya sendiri VERIFIED dan menyebut sumbernya.

**Yang gagal, dan tidak terlihat di layar:** tombol **Salin** masih menyalin teks MENTAH dari server —
`[STATUS: VERIFIED]` ikut menempel. `CopyButton` memakai `msg.content` apa adanya, jadi yang dibaca di
layar sudah bersih sementara yang menempel di dokumen belum.

Untuk VERIFIED itu sekadar janggal. Untuk **"Perkiraan AI" itu berbahaya**: peringatannya hilang justru
pada saat jawaban dipindahkan ke dokumen kerja — tempat ia paling mungkin dibaca dan dipercaya orang
lain. Kebalikan dari maksud pekerjaan ini.

**Ditutup dengan `teksSalinan()`:** yang disalin kini = label dalam bahasa manusia + jawaban + catatan
sistem. Peringatannya ikut pindah, kosakata tekniknya tidak.

```
[Perkiraan AI] Tidak diambil dari dokumen Anda. Periksa dulu sebelum dipakai untuk pekerjaan.

Kira-kira tiga bulan sebelum periode berjalan.
```

Jawaban tanpa label tetap disalin apa adanya — tidak pernah ditambahi label karangan.

**Pelajaran yang layak diingat:** uji "terpasang" saya memeriksa jalur **tampil**, dan berhenti di situ.
Jawaban yang sama punya dua jalan keluar — layar dan papan klip — dan hanya satu yang dijaga. Kini
keduanya diuji.

52 berkas uji hijau; `mametlite` `vite build` lolos.
