# T14 — nama penyedia hulu disimpan per pesan

**29 September 2026** · keputusan Owner 28 September · belum diuji live

## Yang berubah

Nama penyedia hulu yang benar-benar melayani sebuah jawaban kini ikut tersimpan di **metadata pesan**,
tidak lagi hanya lewat di log.

```
rctx.penyediaHulu (ai_adapter)
   → stream: bingkai SSE {"penyedia":"…"} sesudah jawaban, sebelum [DONE]
   → non-stream: field `penyedia` di JSON jawaban
   → AssistantService → metadata pesan → chats.messages[].metadata
```

**Penyedianya TIDAK dikunci.** Keputusan Owner: mengunci (`provider.order`/`provider.only`) menaikkan
biaya dan membuat jawaban gagal saat penyedia itu sibuk atau mati, sementara yang benar-benar perlu
dihentikan adalah kesalahan penafsiran — bukan keragaman penyedianya.

## Kenapa

Terukur 28 September: satu nama model, `deepseek-v4-flash`, dilayani **8 penyedia berbeda dalam 4 jam**
(Sail Research 11 · OpenInference 6 · Inceptron 3 · Wafer 2 · StreamLake 2 · Reka 1 · Together 1 ·
Relace 1). Gaya jawaban, biaya, dan latensi berayun **tanpa satu baris kode pun berubah** — panggilan
hakim pertama $0,002213/108 detik, sesudahnya $0,000033–0,000121/1,8–7,2 detik di penyedia lain.

Namanya selama ini hanya masuk log. **Log berumur pendek; pesan tersimpan selamanya.** Akibatnya
pertanyaan "apakah penyedia X terasa lebih buruk" tidak pernah bisa dijawab data, dan perubahan mutu yang
dirasakan gampang ditimpakan ke perubahan kode yang sebenarnya tidak berpengaruh — persis yang hampir
terjadi 28 September, saat jawaban terasa "lebih natural" dan hakim bayangan nyaris dikira sebabnya.

Ini **tidak memperbaiki** mutu jawaban. Ia membuat pertanyaannya bisa diperiksa.

## Empat hal yang dijaga

**1. Bingkainya tidak boleh muncul sebagai teks.** Bingkai penyedia dikirim lewat `enqueueData()` yang
sengaja TIDAK memakai bentuk `choices[].delta.content`. Layar hanya menambah teks bila bingkainya memang
berisi teks, jadi bingkai ini lewat tanpa jejak di jawaban.

**2. Dikirim sesudah jawaban, sebelum `[DONE]`.** Sesudah teks dan sesudah koreksi label; kalau dikirim
setelah `[DONE]`, layar sudah berhenti membaca.

**3. Kegagalannya tidak menggagalkan jawaban.** Dibungkus `try/catch` — jawaban yang sudah benar tidak
boleh batal karena keterangan tambahan.

**4. Tidak mengarang field kosong.** Bila penyedianya tidak dilaporkan, metadata tetap `null` seperti
sebelumnya, bukan objek berisi nilai kosong.

## Cacat yang paling mungkin, dan penjaganya

Bukan salah hitung, melainkan **dua sisi memakai nama field berbeda** — server mengirim satu nama, layar
membaca nama lain, dan yang tersimpan kosong **selamanya tanpa gejala apa pun**.

Karena itu ujinya membaca nama field itu dari ketiga tempat (`stream_handler.ts`, `synthesis_handler.ts`,
`AssistantService.js`) dan membandingkannya. Kalau salah satu berubah sendiri, ujinya merah.

## Catatan: jalur stream dulu tidak pernah membawa metadata

`onDone` jalur streaming selalu dipanggil dengan `metadata = null`, jadi tidak ada satu pun keterangan
jawaban yang ikut tersimpan di sana. Kini metadata dikirim **hanya bila ada isinya**; `null` dipertahankan
saat kosong supaya pemeriksaan `metadata?.` yang sudah ada tidak berubah perilakunya.

## Yang TIDAK dikerjakan

Penyedianya **tidak ditampilkan** di layar — Owner memutuskan "simpan", bukan "tampilkan". Menampilkannya
kemudian tinggal membaca `metadata.penyedia`, tanpa perubahan server.

## Bukti

53 berkas uji hijau · `agent-process` lolos esbuild · `vite build` lolos.

**Uji live yang masih perlu:** deploy `agent-process`, lalu satu chat. Yang dibuktikan: log
`[PR#6 TOKEN METRICS] … penyedia=X` dan `chats.messages[].metadata.penyedia` menyebut **nama yang sama**,
dan nama itu tidak muncul di teks jawaban.
