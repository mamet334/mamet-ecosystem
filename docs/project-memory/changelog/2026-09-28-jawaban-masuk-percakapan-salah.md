# 2026-09-28 — Jawaban mendarat di percakapan yang salah (dilaporkan Owner)

Owner bertanya di percakapan baru, lalu mengklik riwayat lain sambil menunggu. Jawabannya masuk ke
percakapan yang sedang dibuka — **tanpa pertanyaannya** — dan percakapan barunya hilang seluruhnya.

## Penyebab

Seluruh callback jawaban menulis ke **percakapan yang sedang terbuka**, bukan ke percakapan yang
mengirim pertanyaan:

```js
onChunk: (chunkText, allText, steps) => { setMessages(prev => { … }) }
```

`prev` adalah isi percakapan mana pun yang terbuka saat itu. Tidak ada satu pun pemeriksaan identitas.

Kerusakannya dua arah karena penyimpanan otomatis dilewati selama menunggu
(`if (… || isLoading) return;`):

1. Pertanyaan masuk ke `messages`, **belum tersimpan**.
2. `handleLoadChat` **mengganti** `messages` dan `currentChatId` → pertanyaan lenyap dari memori, dan
   memang tak pernah sempat ditulis ke basis data.
3. Jawaban tiba → ditambahkan ke `messages` milik percakapan lain.
4. `isLoading` jadi false → efek penyimpanan menulis gabungan itu ke `currentChatId` yang baru.

Deterministik, bukan sesekali: terjadi **setiap kali** Owner berpindah sebelum jawaban selesai.

Bug ini sudah ada sebelum hari ini. Tetapi hakim bayangan versi pertama menahan jawaban **108 detik**
(nalar menyala, lihat `2026-09-28-hakim-bayangan.md`), dan selama 108 detik berpindah-pindah melihat
riwayat adalah hal yang paling wajar dilakukan siapa pun — pintunya sempat dilebarkan, lalu ditutup
kembali ke ±3 detik.

## Perbaikan

Satu kalimat: **jawaban milik percakapan yang bertanya, bukan percakapan yang sedang dilihat.**

`pengirimanChat.js` (baru, fungsi murni):

- `buatPenandaKiriman({ seq, chatId, pesan })` — dipanggil saat mengirim; `pesan` **disalin**, karena
  `messages` di komponen akan diganti isinya begitu Owner berpindah.
- `tujuanTulis(penanda, seqSekarang)` → `'layar'` | `'terlantar'`.
- `pesanTerlantar` / `layakSimpanTerlantar` — menyusun pertanyaan + jawaban untuk disimpan ke
  percakapan asal; jawaban kosong tidak disimpan supaya tidak lahir percakapan setengah jadi.

**Kenapa nomor urut, bukan `chatId`:** percakapan BARU belum punya id (`currentChatId === null`) sampai
penyimpanan pertama — dan justru percakapan baru itulah kasus yang dilaporkan Owner. Dua chat baru
berturut-turut sama-sama ber-`chatId` null, jadi id tidak bisa membedakannya. `percakapanSeqRef` naik
setiap kali `handleNewChat` atau `handleLoadChat` dipanggil.

Di `ConversationEngine.jsx`: `onNalar`, `onChunk`, `onDone`, `onError`, dan blok `catch` semuanya
dijaga. Pada jalur terlantar, `onDone` menyimpan pertanyaan + jawaban langsung ke percakapan asalnya —
bila percakapan itu belum punya id, penyimpanan itulah yang melahirkannya. `onNewChatId: () => {}`
sengaja kosong: Owner **tidak** dipindahkan, ia sedang membaca percakapan lain.

`isLoading` tetap dilepas di jalur terlantar, supaya kotak kirim tidak terkunci selamanya.

## Uji

`uji/uji-kiriman-percakapan.mjs` — logikanya dikeluarkan dari React supaya bisa diimpor apa adanya
(pola `pemulihanChat.js` / `KonteksChat.js`), bukan cermin. Tiga lapis:

1. **Fungsi murni** — identitas, salinan pesan, penyusunan pesan terlantar.
2. **Peragaan ulang alur komponen** dengan **uji kendali**: tanpa penjaga, gejalanya harus muncul —
   jawaban tersimpan ke `chat-lama`, dan pertanyaan Owner **tidak ada** di sana. Persis laporan Owner.
   Dengan penjaga: tersimpan ke percakapan asal, lengkap dengan pertanyaannya, dan percakapan yang
   sedang dibuka **tidak tersentuh**.
3. **Terpasang** — memeriksa penjaga benar-benar ada di kelima titik di `ConversationEngine.jsx`.
   Modul benar tetapi tidak dipanggil = bug masih hidup; dua uji minggu ini lulus justru karena itu.

## Terbukti

- 47 berkas uji hijau; `vite build` lolos.
- **Belum diuji live.** Pembuktiannya: bertanya di percakapan baru, segera buka riwayat lain, tunggu,
  lalu kembali — pertanyaan dan jawabannya harus lengkap di percakapan baru itu, dan percakapan yang
  dibuka sementara harus tidak berubah sama sekali.
