# 8 Oktober 2026 — Mametlite bicara dalam bahasa penggunanya saat gagal

M4 blok M item 125 ([`ROADMAP-SIAP-PENGGUNA.md`](../../roadmap/ROADMAP-SIAP-PENGGUNA.md)).

## Yang dibaca pengguna sebelum ini

```js
// App.jsx
updateMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}` }]);

// callAgentSimple.js:100 — sumber err.message
throw new Error(errorData.error || `Server error: ${response.status}`);
```

Teks server **apa adanya**, ke pegawai ASN yang membuka dari HP:
`❌ Error: ENGINEER_NO_API_KEY` · `❌ Error: Server error: 500` · `❌ Error: Failed to fetch`.
Satu di antaranya bahkan string Inggris yang **kita tulis sendiri**: `Unexpected response format`.

Jalur masuk lebih buruk: `alert(error.message)` — kotak sistem berisi *"Invalid login credentials"*.

## Yang dikerjakan

`mametlite/src/lib/pesanGalat.js` (baru) menerjemahkan tanda galat jadi **judul + tindakan + teks
teknis**. Tiga aturan yang dipakai:

**1. Sebutkan TINDAKAN, bukan hanya keadaan.** "Kuota habis" tidak membantu; "isi ulang saldo di
openrouter.ai" membantu.

**2. Jangan menebak lebih dari yang diketahui.** Tanda yang tidak dikenali menghasilkan pesan
**umum** — bukan tebakan yang terdengar yakin. Pesan yakin yang salah lebih merugikan daripada pesan
umum, dan ini diuji: galat `QWERTY_ZZZ` tidak boleh menyebut koneksi, saldo, atau kunci.

**3. Teks teknisnya tidak dibuang,** hanya dikecilkan. Pengguna HP tak punya DevTools; kalau
sebabnya hilang, satu-satunya cara melapor adalah *"errornya merah"*. Aturan yang sama dengan
`BatasGalat.jsx`.

Satu pesan yang pantas disebut sendiri — **402 saldo**. Catatan Owner: saldo minus **tidak** berarti
layanan mati; permintaan kecil kadang masih dilayani. Jadi pesannya berbunyi *"Isi ulang saldo di
openrouter.ai, atau coba pertanyaan yang lebih pendek — permintaan kecil kadang masih bisa
dilayani"*, bukan "tidak bisa dipakai". Diuji terpisah supaya tidak hilang saat orang menyederhanakan
pesannya.

### Tiga perbaikan yang ikut, karena ada di jalur yang sama

| | |
|---|---|
| **Gelembung kosong** | arus yang gagal dulu meninggalkan gelembung asisten **kosong** (`:463`) *dan* gelembung galat — dua gelembung untuk satu kegagalan, terbaca seperti jawaban yang hilang. Kini penampung kosong itu **diganti**, bukan ditinggalkan |
| **Mutasi di tempat** | `newArr[len-1].content = fullContent` menulis ke objek yang **masih dibagi** dengan state sebelumnya (`[...prev]` hanya menyalin array). Tidak aman di `StrictMode`. Kini objeknya diganti |
| **Hapus percakapan** | dulu **tanpa konfirmasi** — satu salah-sentuh di HP menghapus permanen, padahal hapus *dokumen* sudah bertanya sejak dulu. Kini bertanya, dan menyebutkan bahwa riwayatnya hanya ada di perangkat itu |

Sapaan percakapan awal juga diambil dari satu sumber (`riwayatBaru()`); salinan di `handleDeleteChat`
ternyata **sudah menyimpang** — kalimatnya terpotong jadi `'Halo! Saya **Mamet Lite**.'`.

## Bukti

`uji/uji-pesan-galat.mjs` (baru) — **SEMUA LULUS**. 10 tanda galat chat + 4 tanda galat masuk, tiap
satu diperiksa tiga hal: dikenali, judul & sarannya **tanpa istilah teknis bocor** (daftar larangan:
`error|failed|fetch|invalid|credentials|undefined|exception|API_KEY|NetworkError`), dan teks
teknisnya **utuh**.

Bagian 4 memeriksa bahwa jalur lamanya benar-benar hilang: `❌ Error: ${err.message}` tidak ada,
`alert(error.message)` tidak ada, penampung kosong diganti, mutasi di tempat hilang, hapus percakapan
bertanya.

**Di peramban**, bundel produksi. `window.fetch` **disumbat lebih dulu** supaya tidak ada satu pun
permintaan keluar ke Supabase produksi — diperiksa sesudahnya: `read_network_requests` dengan pola
`supabase` → **nol permintaan**. Nilai formulirnya nilai uji (`uji@contoh.invalid`), bukan kredensial
siapa pun.

Hasilnya, dalam satu kotak di formulirnya sendiri (bukan kotak sistem):

> **Tidak bisa menghubungi server.**
> Periksa koneksi internet Anda, lalu coba lagi.
> Pesan teknis: Failed to fetch

dengan `role="alert"`.

Suite penuh: **91/91**.

## Berkas

| Berkas | |
|---|---|
| `mametlite/src/lib/pesanGalat.js` | **baru** — penerjemah, dua jalur (chat & masuk) |
| `uji/uji-pesan-galat.mjs` | **baru** — 4 bagian |
| `mametlite/src/App.jsx` | memakai penerjemah; gelembung kosong diganti; mutasi di tempat dihapus; hapus percakapan bertanya; galat masuk dirender di formulir |

## Sisa blok M

**M8** kode mati — **menunggu izin Owner** (Constitution: *hapus lunak sebelum hapus permanen*).
**M9** uji penjaga untuk tiga berkas salinan tangan di `mametlite/src/lib/`.
