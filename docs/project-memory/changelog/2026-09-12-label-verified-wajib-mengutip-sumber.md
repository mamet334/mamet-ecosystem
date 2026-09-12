# Label VERIFIED Harus Dibuktikan, Bukan Diberikan

**Tanggal:** 12 September 2026
**Roadmap:** Item 71

## Masalahnya

Label `[STATUS: VERIFIED]` di akhir jawaban terdengar seperti jaminan: "ini dari dokumen Anda".
Kenyataannya tidak. Di Item 70 terlihat satu chat menerima potongan dokumen yang **tidak memuat
jawabannya**, menjawab dari pengetahuan umum model, tapi tetap berlabel `VERIFIED`. Label itu
justru menghapus tanda bahaya yang seharusnya terlihat.

Penyebabnya dua perintah yang bertentangan di dalam prompt:

| Tempat | Isi |
|---|---|
| Panduan identitas | "**Jika didukung** oleh dokumen → VERIFIED" |
| Kontrak BLOK 6 | "Karena Evidence Gate PASSED, Anda **WAJIB** mencantumkan VERIFIED" |

Padahal "PASSED" hanya berarti **ada dokumen yang dilampirkan**, bukan bahwa dokumen itu memuat
jawabannya.

## Perbaikannya: dua lapis

**Prompt tidak lagi memaksa.** Model diberi pilihan: `VERIFIED` hanya bila jawabannya memang
berasal dari dokumen, dan wajib menyertakan `Sumber: "judul dokumen"`. Selain itu `HYPOTHESIS`
atau `INSUFFICIENT`. Ditutup satu kalimat tegas: dokumen terlampir tidak otomatis berarti VERIFIED.

**Kode yang memutuskan.** Judul atau kode dokumen yang disebut dicocokkan dengan dokumen yang
benar-benar dilampirkan ke prompt. Kalau tidak cocok, labelnya diturunkan menjadi `HYPOTHESIS`
disertai catatan untuk pembaca, dan dicatat di log. Di jalur streaming (mametlite), teks yang
sudah terkirim tidak bisa ditarik, jadi koreksinya ditambahkan di akhir jawaban.

## Uji produksi menemukan bug — pada perbaikan ini sendiri

Uji pertama sesudah deploy justru **menurunkan label yang sah**. Model sudah mengutip judul ebook
dengan benar, tapi menuliskannya di baris yang sama dengan label:

```
[STATUS: VERIFIED] — Sumber: "Operator handbook ... .pdf"
```

Pemeriksa hanya menerima baris yang **dimulai** dengan kata "Sumber". Log membuktikannya:
`[LABEL] LOOKUP: VERIFIED -> HYPOTHESIS (jawaban tidak menuliskan baris Sumber)`.

Diperbaiki: kutipan sumber kini dicari di mana saja dalam jawaban. Kekeliruan ini lolos karena
semua contoh uji saya menaruh "Sumber" di awal baris — kemungkinan penulisan lain tidak teruji.

## Bukti di produksi

| Pertanyaan | Hasil |
|---|---|
| "Bagaimana cara mereset status baterai Android lewat adb?" | `[STATUS: VERIFIED] — Sumber: "Operator handbook … .pdf" [Halaman 15]`, tanpa catatan koreksi |
| "Jelaskan singkat apa itu inflasi" | `[STATUS: HYPOTHESIS - Rekomendasi AI]`, tanpa catatan koreksi |
| Sebelum perbaikan | label diturunkan otomatis, tercatat di log |

Nomor halaman diuji silang: perintah itu memang ada di **halaman 15** ebook.

## Keterbatasan yang disadari

- **Nomor halaman belum dijamin.** Potongan yang memuat perintah itu ternyata tidak berisi penanda
  `[Halaman 15]`; penandanya ada 444 huruf sebelumnya, di potongan tetangga. Kali ini benar, tapi
  ketepatannya bergantung pada di mana potongan dipotong.
- **Yang diperiksa adalah kutipannya, bukan isinya.** Jawaban yang menyebut dokumen yang benar tapi
  isinya melenceng tetap lolos. Memeriksa isi butuh cara lain.
- **Di jalur streaming, label yang telanjur terkirim tidak bisa diganti**, hanya bisa dikoreksi
  dengan catatan tambahan di akhir.
