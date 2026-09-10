# Groq 404 Terbukti — Provider Ketiga yang Modelnya Dipensiunkan Diam-Diam

**Tanggal:** 10 September 2026
**Roadmap:** Item 53 (menutup sisa Item 51)

## Yang ditutup

Item 51 mencatat dugaan bahwa `llama-3.1-8b-instant` sudah dipensiunkan Groq,
dengan penanda tegas **"belum dipastikan"**. Dugaan itu tidak diklaim sebagai
kesimpulan karena belum ada bukti. Sekarang ada.

## Bukti dari server, bukan dari ingatan

`check-keys` ditambahi satu panggilan: `GET /openai/v1/models` memakai key
sistem. Dua hal langsung terjawab sekaligus.

**Status 200.** Key Groq **sehat**. Selama ini ia sempat dicurigai bermasalah,
dan kecurigaan itu keliru.

**Daftar 14 model yang dikembalikan tidak memuat satu pun** dari tiga model
yang dirujuk kode kita:

| Model di kode | Ada di server? |
|---|---|
| `llama-3.1-8b-instant` | tidak |
| `llama-3.3-70b-versatile` | tidak |
| `llama3-8b-8192` | tidak |

Pesan Groq sendiri: *"The model `llama-3.1-8b-instant` does not exist or you do
not have access to it."* Halaman deprecations Groq mencocokkan — kedua model
llama diumumkan 17 Juni 2026 dan dimatikan **16 Agustus 2026**.

### Kenapa 404 dan bukan 401 itu menentukan

Key yang salah menghasilkan **401**. **404** berarti key diterima tetapi
modelnya tak dikenal. Perbedaan satu digit itulah yang memisahkan "key Groq
bermasalah" dari "model Groq sudah tidak ada". Menuduh key adalah kesimpulan
yang salah, dan hanya daftar model dari server yang bisa membedakannya dengan
pasti.

## Provider ketiga pada pola yang sama

Setelah Gemini dan DeepSeek, ini yang ketiga. Polanya identik: penyedia
memensiunkan model, kode terus memanggil nama lama, kegagalannya tertelan
`catch`, dan tidak ada yang tahu.

Tiga kali dalam pola yang sama berhenti menjadi kebetulan. Itu **celah
pemeliharaan**: tidak ada mekanisme apa pun di sistem ini yang memberi tahu
ketika model yang dipakai menghilang dari penyedianya. Sejak hari ini
`check-keys` menjadi mekanisme itu untuk Groq — ia mencocokkan model yang
dirujuk kode terhadap daftar hidup dari server, bukan terhadap dokumentasi.

## Penggantinya

Diambil dari rekomendasi resmi Groq, lalu keberadaannya dipastikan ada di
daftar server:

| Lama (mati 16 Agu 2026) | Baru | Dipakai di |
|---|---|---|
| `llama-3.1-8b-instant` | `openai/gpt-oss-20b` | `ai_adapter` (execute + stream), `tool_subscriber` (2×), `knowledge_quality_filter`, `context_compressor` |
| `llama-3.3-70b-versatile` | `openai/gpt-oss-120b` | `backend/server.js` (kode mati) |
| `llama3-8b-8192` | `openai/gpt-oss-20b` | `self_healing.ts` (kode mati, Item 49) |

Alias `groq-llama-3.3` dan `groq-llama-3.1` **sengaja dipertahankan**, supaya
preferensi model yang sudah tersimpan di `user_metadata` tidak mendadak tak
dikenali. Yang berubah hanya model yang ditunjuknya.

Rujukan di `backend/server.js` dan `self_healing.ts` ada di kode mati.
Keduanya tetap diperbaiki agar tidak menjadi ranjau bila kelak dihidupkan, dan
diberi komentar yang menyatakan statusnya — perbaikan di sana bukan bukti
bahwa kodenya hidup.

## Tarif, dan kenapa itu bukan pelengkap

Tabel `MODEL_PRICING` punya baris `{ match: 'llama' }`. Begitu nama modelnya
berganti ke `gpt-oss`, baris itu tidak lagi cocok dan biaya Groq jatuh ke
`FALLBACK_PRICING` — kelas kesalahan yang sama persis dengan Item 41 dan
Item 42, di mana tarif yang salah membuat circuit breaker memblokir biaya yang
tidak nyata atau justru buta terhadap biaya yang nyata.

Dua baris ditambahkan, angkanya dari halaman model GroqCloud dan bukan dari
ingatan:

| Model | Masuk | Keluar |
|---|---|---|
| `openai/gpt-oss-20b` | $0,075 / 1M | $0,30 / 1M |
| `openai/gpt-oss-120b` | $0,15 / 1M | $0,60 / 1M |

`'gpt-oss-120b'` **wajib** ditaruh sebelum `'gpt-oss-20b'` — pencocokannya
`includes()`, jebakan yang sama dengan `gpt-4o-mini` versus `gpt-4o`. Baris
`'llama'` tetap dipertahankan karena masih dipakai model llama lewat
OpenRouter, bukan sisa Groq.

## Temuan sampingan yang nyaris lolos

Probe pertama memakai `max_tokens: 5` dan menjawab:

```
"groq_status": 200,
"groq_ok": true,
"groq_jawaban": ""
```

Status sukses, keluaran kosong. Kalau berhenti di situ, ini akan tercatat
sebagai bukti keberhasilan.

Sebabnya: gpt-oss adalah model *reasoning*. Jatah token pertamanya habis untuk
penalaran sebelum sempat mengeluarkan satu huruf pun. Terukur pada probe
kedua — **46 dari 56** token keluaran adalah `reasoning_tokens`.

Artinya pemanggil dengan `max_tokens` kecil akan menerima balasan kosong
**tanpa galat apa pun**. Seluruh pemanggil Groq diperiksa: `ai_adapter` memakai
`max_tokens: 8192`, sisanya tidak menyetel `max_tokens` sama sekali sehingga
memakai batas model. Aman.

Probe `check-keys` sendiri diperbaiki: ia kini melaporkan
`groq_benar_menjawab`, `finish_reason`, dan `usage`. Status 200 saja tidak lagi
diperlakukan sebagai bukti.

## Bukti akhir

```
"groq_status": 200
"groq_ok": true
"groq_model_diuji": "openai/gpt-oss-20b"
"groq_jawaban": "OK"
"groq_finish_reason": "stop"
```

Deploy `agent-process` diverifikasi `[MATCH]`. `check-keys` di versi 48.

## Yang belum terbukti, dan sengaja tidak diklaim

Jalur Groq di dalam `agent-process` **belum dipanggil pengguna sungguhan**
sejak perbaikan ini, karena Owner memakai OpenRouter sebagai provider. Yang
terbukti adalah modelnya hidup dan bisa menjawab. Yang belum terbukti adalah
`GroqAdapter` bekerja end-to-end. Bukti itu baru bisa muncul kalau ada
permintaan yang benar-benar memilih Groq.
