# 2 Oktober 2026 — Pemutus arus yang hukumannya tak pernah habis (TMN-0004 ditutup)

## Kenapa ini yang dikerjakan

Owner meminta pekerjaan yang **bisa ditutup**, bukan yang menunggu rilis, menunggu uji live, atau
menunggu token diganti. Item 72 (Adaptive Shell) ditunda atas permintaan Owner karena murni tata
letak layar.

TMN-0004 memenuhi syarat itu: temuan yang sudah tercatat, satu berkas, tanpa deploy, dan **bisa
dibuktikan dengan menjalankan kodenya** — bukan menunggu Owner mencobanya.

## Cacatnya lebih buruk daripada bunyi temuannya

Temuan aslinya berbunyi: *"`upgradeCapability()` tidak pernah dipanggil dari mana pun."* Benar,
tetapi itu akibat, bukan cacatnya. Yang sebenarnya terjadi ada di `_handlePatchTask`:

```js
if (now - this._lastApiReset > 60000) { this._apiCallCount = 1; ... }  // jendela 1 menit
if (this._apiCallCount > 5) { this.capability = 'OBSERVER'; return; }   // hukuman PERMANEN
```

Pencacahnya **pembatas laju** — jendelanya mereset tiap 60 detik. Hukumannya tidak. Sesudah satu
menit lewat, pencacah kembali ke 1 sementara `capability` tetap `OBSERVER`, dan satu-satunya jalan
pulih adalah method yang nol pemanggil.

Jadi: **enam penerapan patch dalam satu menit = Engineer berhenti menambal sampai aplikasi
ditutup.** Enam bukan angka aneh saat sedang memperbaiki sesuatu berturut-turut.

Dan senyap. Hanya `console.warn`, tanpa satu pun `emit`. Yang Owner lihat sesudahnya adalah pesan
dari gerbang di bawahnya — *"Engineer belum memiliki kapabilitas IMPLEMENTER"* — benar, tetapi tak
bisa ditindaklanjuti: menunggu? memeriksa tugasnya? mengangkat kembali? Tak ada yang mengatakannya.

## Lubang yang hampir dibuat sambil memperbaikinya

Ada demosi **kedua** yang memakai `'OBSERVER'` yang sama: 3 percobaan menyentuh berkas inti
(`onImmutableFileBlocked`). Yang itu **sengaja lengket**.

Pemulihan otomatis yang tidak membedakan sebab akan mengangkat demosi keamanan satu menit
kemudian — menutup satu cacat sambil membuka yang jauh lebih buruk.

Karena itu tiap demosi sekarang mencatat **sebabnya** (`_sebabDemosi`: `'laju'` / `'keamanan'`),
dan penjagaannya **dua arah**:

| | |
|---|---|
| Pemulihan otomatis | menolak menyentuh demosi `'keamanan'` |
| Pemutus arus | tidak boleh **menimpa** sebab `'keamanan'` jadi `'laju'` |

Arah kedua mudah terlupakan: tanpa itu, demosi keamanan bisa "didegradasi" jadi pelanggaran laju
oleh satu patch berikutnya, lalu pulih sendiri semenit kemudian.

### Dan satu lagi yang nyaris lolos

`upgradeCapability()` menihilkan `suspiciousAttempts`. Kalau pemulihan otomatis memakainya apa
adanya, pulihnya pembatas laju ikut **menghapus hitungan percobaan berkas inti** — penjaga keamanan
bisa dinolkan oleh kejadian yang sama sekali tak berhubungan. Seseorang di 2 dari 3 percobaan
kembali ke 0.

Sekarang `opsi.otomatis` membedakan hak kedua pemanggil: hanya angkatan **sengaja** (Owner/kode)
yang menihilkannya.

## Yang berubah

- Jendela habis → hukuman habis, pulih ke kapabilitas **sebelumnya** (bukan dipaksa `IMPLEMENTER`)
- `Engineer:CircuitBreaker` dipancarkan dua arah (aktif & pulih), dan pesan ke Owner menyebut
  **ini penjaga saldo, bukan penolakan** beserta perkiraan detik sampai bisa dicoba lagi
- `upgradeCapability()` akhirnya punya pemanggil: jalur pemulihan otomatis
- Pesan "kapabilitas kurang" menyebut sebabnya — dan untuk demosi keamanan mengatakan terus terang
  bahwa **itu tidak pulih sendiri**
- `5` dan `60000` jadi `BATAS_PATCH_PER_MENIT` dan `JENDELA_PEMUTUS_MS`
- `_apiCallCount` diinisialisasi di constructor; penjaga malas `if (!this._apiCallCount)` dibuang

Tiga tempat saja yang mengubah `capability` (awal, keamanan, pemutus arus), dan **kedua demosi
mencatat sebab** — tidak ada jalur yatim yang bisa menurunkan kapabilitas tanpa jejak.

## Uji

`uji/uji-pemutus-arus-engineer.mjs` (baru) — 27 asersi. Ujinya **menjalankan kelas `Engineer` yang
asli**: berkasnya bisa diimpor di Node dengan `serviceManager` palsu, jadi perilakunya yang diuji,
bukan teks kodenya. Ini lebih kuat daripada pola uji statis yang biasa dipakai di repo ini, dan
layak dicoba lagi untuk temuan sejenis.

Lulus semua tidak membuktikan apa pun, jadi tiap penjaga dirusak satu per satu:

| Mutasi | Asersi jatuh |
|---|---|
| M1 buang pemulihan otomatis | 6 |
| M2 buang penjaga demosi keamanan | 1 |
| M3 pemulihan otomatis ikut menihilkan `suspiciousAttempts` | 1 |
| M4 pemutus arus menimpa sebab keamanan | 2 |

**M4 awalnya hanya menjatuhkan 1.** Asersi keduanya lolos karena kebetulan: mutasinya menyimpan
`'OBSERVER'` sebagai kapabilitas-sebelum-demosi, jadi "pulih" pun hasilnya tetap `OBSERVER`.
Ditutup dengan asersi yang memeriksa kapabilitas simpanannya langsung.

**74/74 berkas uji hijau** lewat `uji/jalankan-semua.mjs`. Ekspor `{ Engineer }` utuh; `Kernel.js`
satu-satunya pengimpor dan memakai named import.

## Tidak perlu deploy

Renderer saja (`frontend/src`). Ikut rilis klien berikutnya.

**Batas yang dibiarkan sadar:** UI menampilkan pesan ini di bawah judul **"⚠️ Patch Gagal"** —
judul yang agak salah untuk penahanan sementara. Isi pesannya melawan judul itu. Memperbaikinya
berarti menyentuh `ConversationEngine.jsx`; dibiarkan agar perubahan ini tetap satu berkas.

**Cara memastikan live:** terapkan patch enam kali dalam satu menit. Harus muncul pesan pemutus
arus yang menyebut perkiraan detik — bukan diam. Lalu tunggu satu menit dan terapkan sekali lagi:
harus jalan kembali **tanpa menutup aplikasi**.
