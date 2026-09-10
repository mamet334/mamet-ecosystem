# Jalur Upload RAG yang Tak Pernah Memvektorkan, dan Satu Policy RLS `USING (true)`

**Tanggal:** 10 September 2026
**Roadmap:** Item 52

## Bermula dari satu pertanyaan

Owner menunjukkan Research App di aplikasi desktop dan bertanya: "apakah jalur upload RAG yang benar?"

Bukan.

## Dua jalur, satu yang benar

| | mametlite | Research App (desktop) |
|---|---|---|
| Tujuan | `functions.invoke('rag-process')` | `insert` langsung ke 2 tabel |
| Embedding | Per chunk, di server | **Tidak ada** |
| Pemotongan | `chunkText(text, 4500)` | `substring(0, 5000)` |
| Workspace | Ditentukan server dari `user_id` | **Di-hardcode** ke satu akun |

`rag-process` bisa dipercaya bukan karena keempat langkahnya, melainkan karena
perilakunya saat gagal: bila satu potongan saja gagal divektorkan, dokumen
induk **dihapus** dan galatnya dilempar ke pemanggil. Tidak ada dokumen
setengah jadi.

## Tiga cacat, semuanya diam

**Tanpa embedding.** Kolom `document_chunks.embedding` nullable, jadi Postgres
menerima baris itu tanpa protes sedikit pun. Dokumen muncul di daftar, tampak
berhasil, dan pengguna tidak punya alasan untuk curiga. Karena tak punya
vektor, ia tidak akan pernah muncul di pencarian RAG. Terlihat, tidak berguna.

**`text.substring(0, 5000)`.** Untuk berkas uji hari ini — 11.487 karakter —
kode lama akan membuang 6.487 karakter. Lima puluh enam persen isinya, lenyap
tanpa suara.

**`space_id` di-hardcode** ke `58dba6bd-…`, workspace "Observasi Pasar" milik
akun Owner. Untuk Owner kebetulan cocok, sehingga cacatnya tidak pernah
terasa. Untuk pengguna lain, dokumennya tercatat atas nama mereka sendiri
tetapi mendarat di workspace Owner. RLS tidak menangkap ini karena ia memeriksa
`user_id`, bukan `space_id`.

## Datanya yang menjawab, bukan pembacaan kode

Dari 512 chunk di produksi, **512 punya embedding**. Nol yang kosong. Kalau
tombol itu pernah berhasil dipakai sekali saja, pasti ada baris tanpa vektor.
Ditambah lagi: dokumen terbaru di seluruh basis data bertanggal **24 Juni
2026**.

Kesimpulannya, Research App selama ini hanya berfungsi sebagai pembaca data
yang ditulis jalur yang benar. Tombol unggahnya adalah ranjau yang belum
terinjak.

Ini penerapan langsung pelajaran Item 46: sebelum memperbaiki jalur tulis apa
pun, tanyakan dulu pada datanya siapa yang benar-benar menghasilkan baris di
produksi.

## Temuan sampingan yang lebih serius

Saat memeriksa RLS tabel `documents`, ditemukan policy bernama
`"Allow all read on documents"` dengan syarat `USING (true)`.

Yang membuatnya berbahaya adalah cara Postgres menggabungkan policy: beberapa
policy permissive untuk perintah yang sama digabung dengan **OR**, bukan AND.
Satu policy longgar cukup untuk mengalahkan semua policy ketat di sebelahnya.
Di tabel ini ada dua policy yang ditulis benar (`auth.uid() = user_id`), dan
keduanya menjadi hiasan selama policy `true` masih ada.

Akibatnya setiap pengguna terautentikasi dapat membaca daftar seluruh dokumen
milik semua orang — judul berkas beserta identitas pemiliknya. Isi dokumen
tidak ikut bocor karena `document_chunks` memeriksa kepemilikan dengan benar
lewat subkueri EXISTS. Yang bocor adalah metadatanya, dan di sistem ini judul
berkas bersifat mengungkap: contoh nyata di produksi mencakup `RSUD.txt` dan
`KELURAHAN SEKARJAYA.txt` milik akun lain.

**Pelajaran umum:** policy RLS yang longgar tidak pernah "tidak berbahaya
karena ada policy ketat lainnya". Justru sebaliknya. Ketika mengaudit RLS,
yang dicari bukan keberadaan policy yang benar, melainkan **ketiadaan policy
yang salah**.

## Yang dikerjakan

1. `handleUpload` di `ResearchApp.jsx` menyerahkan seluruh proses ke
   `rag-process`.
2. `DEFAULT_SPACE_ID` yang di-hardcode dihapus. `spaceId` hanya dikirim bila
   pengguna memang sedang memilih sebuah workspace; selebihnya server yang
   menentukan CORE milik pengguna sendiri.
3. Policy `"Allow all read on documents"` di-`DROP`
   (`20260910120000_drop_allow_all_read_on_documents.sql`). Dua policy yang
   benar sengaja dibiarkan utuh, jadi tidak ada perubahan yang dirasakan
   pengguna.

Tiga tambahan yang ikut dipasang:

- **`if (data?.error) throw`** — `rag-process` menjawab HTTP 500 berisi
  `{ error }` untuk kegagalan vektorisasi, dan `supabase-js` tidak selalu
  melemparnya. Tanpa baris ini, kegagalan vektorisasi akan tampak seperti
  sukses. Persis penyakit yang sedang diobati.
- **`x-byok-gemini` dari VaultService** bila pengguna punya key sendiri,
  konsisten dengan keputusan BYOK Item 51. Embedding adalah fungsi internal,
  bukan chat atas nama orang lain, sehingga kunci sistem tetap boleh dipakai
  sebagai cadangan di sini.
- **`e.target.value = ''`** agar berkas dengan nama sama bisa diunggah ulang;
  sebelumnya `onChange` tidak menyala untuk pilihan kedua yang identik.

## Bukti

Garis dasar dicatat lebih dulu, sebelum apa pun diuji:

| | Sebelum |
|---|---|
| Dokumen | 45 |
| Chunk | 512 |
| Bervektor | 512 |
| Dokumen terbaru | 24 Juni 2026 |

Policy sesudah `db push` — `pg_policies` untuk `documents`, cmd SELECT tinggal
dua baris, keduanya `auth.uid() = user_id`. `USING (true)` hilang.

Unggahan satu berkas 11.487 karakter lewat Research App:

- **Ujung klien:**
  `[ResearchApp] ✅ …: Berhasil memproses 3 dari 3 blok teks.`
- **Ujung basis data:** 3 chunk, **3 bervektor**, `vector_dims` **3072** untuk
  min maupun max, **11.452** karakter tersimpan, `source_type: user_upload`,
  `retrieved_at` terisi.

Dua angka yang paling berarti. **11.452 dari 11.487** — 35 karakter hilang
karena `trim` di batas potongan, bukan isi; bandingkan dengan 6.487 yang akan
dibuang kode lama. Dan **space tujuannya `My Core Knowledge (CORE)`** padahal
klien tidak mengirim `spaceId` sama sekali — server yang menentukannya dari
`user_id`. Itulah yang membuktikan cacat hardcode benar-benar mati, bukan
sekadar tidak terpakai.

Total menjadi 46 dokumen, 515 chunk, **nol tanpa vektor**.

## Catatan

Berkas yang dipakai menguji bukan teks pengisi. Isinya arsitektur RAG dan
disiplin verifikasi proyek ini, termasuk temuan-temuan di atas, sehingga ia
tetap berguna setelah ujinya selesai — kini ia bagian dari basis pengetahuan
yang bisa ditanyakan kembali lewat chat.
