# 1 Oktober 2026 — Tombol Berhenti: kiriman akhirnya bisa dibatalkan

## Bagaimana ketahuan

Bukan dari audit. Owner sedang menguji peta repo, Engineer menggantung lama, lalu ia menulis:

> *"saat ini engineer masih proses, tidak ada tombol berhenti atau menggagalkan"*

Diperiksa: **tidak ada `AbortController` di mana pun** di jalur kirim. Bukan tombolnya yang lupa
dipasang — pembatalannya memang belum pernah dibuat. Satu-satunya jalan keluar adalah memuat ulang
jendela, dan itu yang terpaksa Owner lakukan.

Paling berat di Engineer: permintaannya panjang dan mahal, dan salah arah baru ketahuan setelah
menunggu lama.

## Yang dikerjakan

### Satu signal, menembus seluruh jalur

`processMessage({ signal })` diteruskan ke `_handleConversation`, `_handleLookup`, dan `_handleSkill`
lewat `handlerParams` yang sudah ada, lalu masuk ke **ketiga** `fetch`. Tombol yang memutus dua dari
tiga jalur akan tampak bekerja sampai suatu hari tidak.

### Putaran alat ikut berhenti

`processMessage` memanggil **dirinya sendiri** untuk putaran folder kerja (hasil alat → pertanyaan
lanjutan). Tanpa `signal` di kedua panggilan itu, Berhenti hanya memutus satu putaran lalu putaran
berikutnya berangkat lagi — justru kasus Engineer yang panjang dan mahal.

Ditambah penjaga di pintu masuk:

```js
if (signal?.aborted) return;
```

Letaknya **sebelum** klasifikasi, embedding, dan RAG — ketiganya berbayar dan berjalan sebelum
`fetch`. Jadi Berhenti menutup putaran berikutnya tanpa biaya.

### Pemutusan di tengah aliran

Memutus saat jawaban sedang mengalir melempar dari `reader.read()`, bukan dari `fetch`. Tanpa
tangkapan khusus, tombol Berhenti akan memunculkan *"Aliran jawaban terputus sebelum selesai"* —
kalimat yang benar secara harfiah tetapi menuduh sambungan atas sesuatu yang diperintahkan pemakai.
Galat aliran yang **bukan** pembatalan tetap dilempar; tidak ada yang ditelan diam-diam.

### Satu tempat, dua watak

Tombol Kirim **berganti** jadi Berhenti selama menunggu, bukan tombol baru di sebelahnya. Tombol
terpisah berarti satu sasaran klik yang mati 99% waktu, dan pada saat dibutuhkan justru tertukar
dengan Kirim yang sedang mati.

Ikonnya **`cancel`**, bukan `stop` — `stop` tidak ada di subset font, dan nama di luar subset tampil
sebagai tulisan mentah. Sudah tiga kali terjadi di proyek ini; `uji-ikon-subset.mjs` menjaganya, dan
uji baru ini memeriksanya sekali lagi khusus untuk tombol ini.

### Yang TIDAK dijanjikan, dan ditulis di layar

> *Permintaan yang sudah sampai ke server tetap diselesaikan di sana dan tetap terhitung biayanya —
> yang berhenti adalah menunggunya.*

Kalimat itu muncul di pesannya sendiri, bukan hanya di dokumen ini, dan uji menjaganya tetap ada.
Tombol yang diam-diam dianggap "membatalkan tagihan" akan jadi kekecewaan yang lebih buruk daripada
tidak ada tombol sama sekali.

## Uji

`uji/uji-hentikan-kiriman.mjs` (baru) — 22 pemeriksaan. **63/63 berkas uji hijau**, ketiga berkas
yang disunting lolos parser esbuild.

`dibatalkanPemakai()` diletakkan di **`pembatalan.js`** tersendiri, bukan di dalam `AssistantService`:
service itu menarik modul yang hanya hidup di peramban, jadi tak bisa dimuat di baris perintah. Pola
yang sama dipakai `KonteksChat.js` dan `statusPembaruan.js`. Uji juga memastikan modulnya benar-benar
diimpor — modul terpisah yang tak dipakai bisa jadi yatim tanpa ada yang merah.

### Jebakan yang tertangkap saat membuat ujinya

Asersi "tiap putaran alat membawa signal" **hijau secara hampa**: regexnya memakai batas panjang
tebakan (`[\s\S]{0,400}?`), bloknya lebih panjang, jadi ia cocok **nol** kali — dan `every` pada
daftar kosong bernilai `true`. Yang membongkarnya adalah pemeriksaan **jumlah** di sebelahnya. Tanpa
itu, uji ini akan menjaga udara kosong.

## ✅ TERBUKTI LIVE — 1 Oktober 2026, 15.11

Owner mengirim pertanyaan lalu menekan tombol merah:

| | Hasil |
|---|---|
| Pesan | **"Dihentikan"** muncul |
| Kotak kirim | terbuka kembali |
| **"⚠️ Error"** | **tidak ada** — tidak satu pun |
| Kiriman berikutnya | **berhasil dijawab** |

Yang terakhir itu membuktikan hal yang mudah terlewat: kendalinya benar-benar **dilepas**, bukan
tertinggal menggantung. Kalau `kendaliKirimRef` tidak dibersihkan dengan benar, pembatalan akan
meracuni kiriman sesudahnya — dan itu baru ketahuan berhari-hari kemudian.

Log server menunjukkan permintaan yang dibatalkan **tetap diproses sampai selesai**. Jadi kalimat
jujur di pesan tombolnya — *"Permintaan yang sudah sampai ke server tetap diselesaikan di sana dan
tetap terhitung biayanya"* — terbukti **harfiah**, bukan sekadar kehati-hatian.

## Catatan: dua temuan lain dari sesi yang sama

1. **Peta repo tidak pernah sampai ke model** — terukur dari `[PROMPT_KOMPOSISI]`: riwayat yang
   benar-benar terkirim 3.844–4.555 huruf, sedangkan petanya 15.494 huruf. Sebabnya belum pasti;
   lihat INDEX §5b.
2. **Penanda konteks dihitung pada daftar yang salah** — `simpanMulaiDari` menyimpan indeks daftar
   *tampilan*, tetapi `pilihPesanKonteks` memakainya pada `sisipan + tampilan` yang lebih panjang.
   Karena sisipan ada di depan, merekalah yang pertama terpotong setiap kali "Bersihkan konteks"
   atau "Padatkan" dipakai.

Keduanya sengaja **belum** disentuh: menambal dua-duanya bersamaan dengan pekerjaan ini akan membuat
kita tak pernah tahu mana yang sebenarnya rusak.
