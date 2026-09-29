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

## Uji live 29 September — satu jalur terbukti, satu belum

Owner deploy lalu chat sekali di Mametlite dan sekali di Mamet Ecosystem.

| Waktu | `appSource` | Jalur | Penyedia (log) | Tersimpan di pesan |
|---|---|---|---|---|
| 01:49 | `mametlite` | stream | `Google` | — Mametlite menyimpan chat di **localStorage**, bukan tabel `chats` |
| 01:50 | `assistant` | non-stream | `Azure` | ✅ `metadata.penyedia = "Azure"` (01:50:53) |

**Jalur non-stream: TERBUKTI ujung ke ujung.** Log `[PR#6 TOKEN METRICS] … penyedia=Azure` pukul 01:50:51
dan pesan tersimpan pukul 01:50:53 menyebut nama yang sama. Nama itu tidak muncul di teks jawaban.

**Jalur stream: baru terbukti setengah.** Sisi server benar (`penyedia=Google` tercatat dan dikirim),
tetapi chat yang memakainya kebetulan Mametlite — yang memang tidak pernah menyimpan metadata. Bagian
"tersimpan" untuk jalur stream **belum dibuktikan** dan tidak diklaim.

**Yang masih perlu:** satu chat di **Mamet Ecosystem** yang jawabannya mengalir (streaming), lalu periksa
`metadata.penyedia` pada pesan itu.

## Batas yang jujur: "penyedia terakhir sebelum jawaban dirakit"

`rctx.penyediaHulu` ditimpa setiap panggilan OpenRouter dalam satu permintaan. Yang tersimpan karena itu
bukan "penyedia yang pasti menulis kalimat ini", melainkan **penyedia panggilan OpenRouter terakhir
sebelum jawaban dirakit**:

- jalur stream — bingkai penyedia dikirim tepat sesudah aliran selesai, jadi panggilan latar sesudahnya
  tidak bisa lagi mengubah yang sudah terkirim;
- jalur non-stream — objek jawaban dirakit di `synthesis_handler` tepat sesudah sintesis.

Di kedua jalur itu panggilan terakhir memang sintesis, karena seluruh jalur model lewat OpenRouter sejak
kunci server Gemini & Groq dihapus (15 September). Bila suatu saat ada adapter non-OpenRouter yang dipakai
untuk sintesis, nilai ini bisa salah menunjuk — dan itu harus diperiksa ulang saat itu terjadi, bukan
diasumsikan tetap benar.
