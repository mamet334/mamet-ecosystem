# Perintah dari Dokumen Harus Dikutip Persis

**Tanggal:** 12 September 2026
**Roadmap:** Item 73 (sisa Item 70)

## Masalahnya

Ebook di RAG berbahasa Inggris, pertanyaannya bahasa Indonesia. Penjelasan boleh diterjemahkan —
perintah tidak. `adb shell dumpsys battery reset` yang "dirapikan" atau diterjemahkan bukan lagi
perintah, melainkan teks yang gagal dijalankan.

Uji Item 70 menunjukkan model **sudah** menyalin perintah apa adanya. Tapi itu kebetulan yang
berjalan baik, bukan sesuatu yang diminta. Tidak ada satu kalimat pun di prompt yang menyuruhnya.

## Perbaikannya

`[BLOK 4]` di `universal_contract.ts` menambahkan empat butir, **hanya bila ada dokumen**:

1. Perintah, kode, jalur file, flag, nama fungsi, kunci konfigurasi, pesan error, dan URL ditulis
   ulang persis huruf demi huruf — tidak diterjemahkan, tidak dirapikan ejaannya, tanda kutip dan
   tanda hubungnya tidak diganti, spasinya tidak ditambah atau dikurangi.
2. Bahasa penjelasan mengikuti bahasa pertanyaan; bagian yang dikutip tetap bahasa aslinya.
3. Perintah ditulis di blok kode tersendiri, bukan diselipkan ke tengah kalimat.
4. Bila dokumen tidak memuat perintah yang diminta, katakan apa adanya — jangan menyusun perintah
   dari ingatan lalu menyebutnya berasal dari dokumen.

Biaya **763 huruf** per permintaan yang ada dokumennya, **0** saat RAG kosong.

Letaknya penting: tepat **sesudah** `</RAG>`, bukan di dalamnya. Pemisah cache di
`llm_orchestrator.ts:35` dan `ai_adapter.ts:619` memindahkan seluruh blok `<RAG>…</RAG>` ke pesan
user; aturan yang ditaruh di dalamnya akan ikut terbuang dari `systemInstruction` dan tidak
ter-cache. Uji lokal memeriksa hal ini secara khusus.

## Uji sebelum deploy

12 pemeriksaan lulus (`scratchpad/uji_kutipan.mjs`), memakai potongan asli ebook yang sudah
diunggah: aturan muncul saat ada dokumen dan hilang saat kosong; keempat butirnya utuh; urutannya
sesudah dokumen dan sebelum BLOK 5; BLOK 6 (label) tidak tergeser; dan setelah pemisahan cache
disimulasikan, aturan tetap berada di prompt statis sedangkan dokumen pindah ke pesan user.

## Bukti di produksi

Pertanyaan: *"Dari ebook Operator Handbook, tuliskan perintah adb untuk mengubah level baterai,
mengubah status baterai, dan mereset baterai — persis seperti di buku."*

| Yang tertulis di buku | Yang ditulis Mamet |
|---|---|
| `adb shell dumpsys battery set level <n>` | sama |
| `adb shell dumpsys battery set status<n>` | **sama — tanpa spasi sebelum `<n>`** |
| `adb shell dumpsys battery reset` | sama |

Baris kedua adalah buktinya: buku itu salah ketik, tidak memberi spasi sebelum `<n>`, padahal baris
di atasnya memberi spasi. Salah ketik seperti itu tidak mungkin berasal dari ingatan model — hanya
bisa dari dokumen. Keterangan bahasa Inggris (`change the level from 0 to 100`) juga dikutip apa
adanya sementara penjelasannya berbahasa Indonesia, dan model menambahkan sendiri bahwa keterangan
`set status` di buku memang janggal "tapi saya tuliskan apa adanya sesuai dokumen" — butir keempat
yang bekerja.

Label: `Sumber: "…"` + `[STATUS: VERIFIED]`, tanpa baris `[LABEL]` di log — pemeriksa Item 71
memeriksa dan tidak menurunkannya.

## Keterbatasan yang disadari

**Ini aturan prompt, bukan penegak kode.** Berbeda dengan Item 71 yang labelnya diperiksa dan
diturunkan otomatis, di sini tidak ada yang memaksa. Buktinya datang dari satu jawaban produksi,
bukan dari jaminan.

Di sesi yang sama, pertanyaan yang **sama persis** dijawab dua kali dengan hasil berbeda. Log
server memperlihatkan kedua permintaan identik — 8 potongan, skor teratas 0,764, Evidence Gate
PASSED, prompt 13.772 + 861 huruf, model `deepseek-v4-flash-0731` — tetapi yang pertama (11:04 UTC)
menjawab "belum ada pertanyaan spesifik yang masuk" dan berlabel `INSUFFICIENT`, sedangkan yang
kedua (11:06 UTC) menjawab benar. Yang berbeda hanya di sisi OpenRouter: token prompt 4.139 (cache
227) berbanding 4.217 (cache 0), dan biaya $0,000143 berbanding $0,000410 — pola yang biasa muncul
bila OpenRouter mengarahkan model yang sama ke penyedia hulu yang berbeda.

Itu masih **dugaan**, karena `data.provider` yang dikirim OpenRouter di setiap respons dibuang oleh
`ai_adapter.ts:361` dan tidak pernah dicatat. Mencatatnya akan membuat kejadian seperti ini bisa
dibuktikan, bukan diduga.
