# ROADMAP: Siap Disajikan ke Pengguna

**Status:** 📝 Rancangan + sisa pekerjaan — **belum ada yang dikerjakan**
**Lahir:** 2026-10-07, dari permintaan Owner: *"upgrade dan stabilkan untuk mamet ecosystem ini.
lihat kode yang ada dari awal hingga akhir siap di sajikan untuk user."*

> Dokumen ini **rancangan**, bukan changelog. Tidak ada satu baris kode yang berubah saat ia ditulis.
> Hasil pekerjaan nanti ditulis di `docs/project-memory/changelog/`, status & sisanya di sini, dan
> INDEX cukup satu baris.

---

## 0. Apa yang sebenarnya ditemukan

Repo ini **tidak butuh penyelamatan.** 124 item terdokumentasi, 19 ADR, 29 dokumen Constitution, 9
TMN tertutup, 87 berkas uji yang **semuanya** keluar non-zero saat gagal, penjaga `catch`-diam hijau
94/94, tree bersih, `main` sinkron. Hanya 7 penanda TODO di ±55.000 baris.

Sapuan penuh menemukan **dua hal yang tidak terlihat dari dokumen mana pun**:

1. **Aplikasi yang dipakai orang luar belum pernah digarap untuk mereka.** Di dalam `mametlite/` ada
   lubang XSS yang terbukti dan layar putih permanen yang bisa dipicu satu nilai `localStorage` rusak.
2. **Jaring keselamatannya tidak terpasang.** 69 dari 87 berkas uji memaku path absolut laptop Owner,
   dan **nol uji berjalan di CI** — `build.yml` melompat dari `npm ci` ke `electron-builder --publish
   always`.

Nomor 2 yang membuat kata "upgrade" berisiko hari ini: **tidak ada apa pun yang akan memberi tahu
kalau sebuah bump merusak sesuatu.** Karena itu bump dependency ditaruh paling akhir, bukan karena
hati-hati berlebihan.

### Satu catatan metode, karena ia hampir menyesatkan dokumen ini sendiri

Analisis hak tabel di §4 awalnya memakai `git grep "'nama_tabel'"`. Hasil pertamanya **salah** — ada
kode yang memanggil tabel lewat **variabel**, dan grep itu melewatkannya:

- `cadanganData.js:37` → `supabase.from(nama)`, nama dari `TABEL_CADANGAN`
- `AuditLogService.js:83` → `supabase.from(this._tableName).insert(...)`, dan `:24` menetapkan
  `this._tableName = 'assistant_audit_log'`

Tanpa memeriksa itu, kesimpulannya akan menyebut `assistant_audit_log` "tidak ditulis klien", dan
pencabutan `INSERT` akan **mematikan jejak audit yang baru dipasang di 4.2.11**. Pelajarannya sama
dengan T11: periksa metodenya, bukan cuma hasilnya.

---

## 1. Mametlite — yang menyentuh pengguna di luar Owner

Konteks: `mametlite.vercel.app` punya pengguna eksternal. Seluruh aplikasi adalah **satu berkas 733
baris** (`mametlite/src/App.jsx`) — login, bilah sisi, unggah, OCR, chat, parser Markdown tangan, dan
seluruh penanganan galat.

### M1 — ✅ SELESAI 7 Okt — lubang XSS, dan hadiahnya kunci berbayar pengguna

> **✅ DITUTUP 2026-10-07** — [log](../project-memory/changelog/2026-10-07-mametlite-berhenti-menyuntikkan-html.md)
>
> **Arahan Owner mengubah bentuk pekerjaannya:** *"jangan hanya di tambal. tapi digunakan logikanya
> dengan semestinya."* Jadi daftar putihnya **tidak** ditambal — penyuntikan HTML-nya dihapus.
> Penguraian pindah ke `lib/markdown.js` (menghasilkan data), perenderan ke `lib/TeksKaya.jsx`
> (elemen React), dan `dangerouslySetInnerHTML` hilang dari `mametlite/src`. Tanpa penyuntikan, tak
> ada daftar putih yang perlu dijaga benar — sekarang maupun nanti.
>
> Dibuktikan `uji/uji-uraian-markdown.mjs` (5 bagian, termasuk **keluaran render sebenarnya** lewat
> `react-dom/server`), dan ujinya **dibuktikan menggigit** lewat 2 mutasi. CSP terpasang di
> `vercel.json` **dan dibaca `vite.config.js`**, supaya ia teruji sebelum produksi, bukan sesudah.
> Suite penuh 88/88.
>
> Catatan terbuka: dua asersi `uji-label-ramah.mjs` ikut diperbaiki karena memaku ejaan mekanisme —
> keduanya dibuktikan masih menggigit, jadi bukan pelemahan. Rinciannya di log.

#### (uraian temuan, sebagaimana ditulis sebelum ditutup)

`App.jsx:52` menjaga dengan daftar putih:

```
.replace(/<(?!div|\/div|img|a|\/a|strong|\/strong|em|\/em|br\/?)([^>]+)>/g, '&lt;$1&gt;')
```

Alternatif `a` panjangnya **satu huruf**, jadi bukan hanya `<a>` yang lolos — **setiap tag yang
namanya mulai dengan "a"** lolos tanpa di-escape: `<audio src=x onerror=…>`, `<animate>`. Dan karena
polanya `([^>]+)`, **atributnya ikut lolos utuh**. Hasilnya dirender `dangerouslySetInnerHTML` di
`:105` dan `:692`.

`:56` juga menyisipkan `$2` ke `href` **tanpa pemeriksaan skema** → `javascript:` lolos.

Di origin yang sama, `localStorage` menyimpan **kunci OpenRouter pengguna** (`:387`) dan sesi
Supabase. Tidak ada CSP (`mametlite/` tidak punya `vercel.json` sama sekali).

**Bobotnya, apa adanya — jangan dibesar-besarkan:** pemicunya **keluaran model** atau **isi dokumen
yang diunggah pengguna sendiri**. Ini **bukan** jalur lintas-pengguna; RAG terisolasi per pengguna.
Jadi: lubang nyata yang hadiahnya kredensial berbayar milik pengguna itu sendiri, bukan pembajakan
akun orang lain.

**Arah perbaikan:** escape **seluruh** HTML lebih dulu, lalu bangun tag yang kita mau dari token
Markdown. Kelas cacatnya hilang karena kelasnya hilang — bukan karena daftar putihnya ditambal.
Terbatas pada `http:`/`https:`/`mailto:` untuk `href`/`src`.

**Pembuktian:** berkas uji **bernama baru** di `uji/` yang memberi `parseMarkdown` muatan
`<img onerror>`, `<audio onerror>`, `<a href="javascript:">`, `<animate>` dan menuntut keluarannya
ter-escape. (Nama baru, bukan ubah nama lama — Vite tak memantau `node_modules`, dan patokan lama
harus tetap bisa dibandingkan.)

### M2 — ✅ SELESAI 8 Okt — layar putih permanen dari satu nilai `localStorage`

> **✅ DITUTUP 2026-10-08** — [log](../project-memory/changelog/2026-10-08-mametlite-tidak-lagi-layar-putih.md)
>
> Bukan satu `try` yang ditambahkan. Akarnya tiga, dan ketiganya ditutup: `lib/riwayatLokal.js`
> (satu pintu, **memeriksa bentuk** bukan hanya JSON — `'{}'` itu JSON sah yang tetap menjatuhkan
> `.find()` beberapa baris kemudian), `lib/BatasGalat.jsx` (error boundary, jalan keluar yang
> menghapus **hanya** riwayat — kunci OpenRouter pengguna tetap), dan penyimpanan yang ditunda
> 500 ms + `pagehide` (dulu seluruh array ditulis tiap token SSE).
>
> "Tidak bisa dibaca" dibedakan dari "tidak ada" (aturan TMN-0006): rusak → pemberitahuan di layar;
> **kosong → `masalah: null`**, karena kosong itu wajar.
>
> Dibuktikan `uji/uji-riwayat-lokal.mjs` (6 bagian) **dan di peramban**: nilai rusak → halaman
> merender; galat render dipaksa → layar "Mamet Lite tersendat"; tombolnya menghapus riwayat dan
> **menyisakan** `x-byok-openrouter`. Suite 89/89.

#### (uraian temuan, sebagaimana ditulis sebelum ditutup)

`App.jsx:134`, di dalam inisialisator `useState`:

```
if (saved) return JSON.parse(saved);
```

Tanpa `try`. Nilai rusak → throw saat render → **layar putih**, dan karena nilai buruknya masih di
`localStorage`, ia **kembali setiap muat ulang**. Orang awam tidak punya jalan keluar.

`:144` `localStorage.setItem(...)` juga tanpa `try` (`QuotaExceededError`), dan ia menyerialkan
**seluruh** array percakapan **setiap token SSE** (`:470-476`) — jadi jawaban RAG panjang mengembang
cepat ke arah batas ±5 MB.

Nol error boundary di seluruh `mametlite/` (`grep errorboundary|componentDidCatch|
getDerivedStateFromError` → 0).

### M3 — ✅ SELESAI 8 Okt — tata letak di HP (Item 72)

> **✅ DITUTUP 2026-10-08** — [log](../project-memory/changelog/2026-10-08-mametlite-dari-hp.md)
>
> Dikerjakan persis seperti catatan Owner 2 Okt: **satu berkas, tanpa dependency baru, tanpa
> `DiscoveryManager`, tanpa empat shell.** Bilah sisi jadi laci di bawah `md` dan tetap menetap di
> atasnya; hamburger + ✕ + lapisan gelap + menutup sendiri saat percakapan dipilih; `h-screen` →
> `h-dvh`; label tiga mode hanya di `lg`; tiga kendali hover jadi terjangkau sentuhan.
>
> Terbukti di peramban **dua arah**: di 375px chat dapat lebar penuh (dulu ±55px) dan laci
> buka-tutup; di 1280px bilah sisi `position: static` 320px dan hamburger tersembunyi — **tidak ada
> yang berubah untuk Owner**. `uji/uji-tata-letak-hp.mjs` dibuktikan menggigit lewat 2 mutasi.
> Suite 90/90.

#### (uraian temuan, sebagaimana ditulis sebelum ditutup)

| | Angka |
|---|---|
| `className` di `mametlite/src` | **102** |
| yang punya prefiks responsif (`sm:`/`md:`/`lg:`/`xl:`) | **0** |

`:525` membuka baris flex dua kolom; `:528` bilah sisi `w-80` = **320px tanpa prefiks apa pun**;
`:654` kolom chat `flex-1 … min-w-0`. Di HP 375px: bilah sisi memakan 320px, chat sisa **±55px**, dan
`min-w-0` membuatnya **menciut** alih-alih memaksa gulir — jadi chatnya benar-benar jadi sliver.

Yang ikut menyempit di ruang ±55px itu: header `px-6` (`:656`, 48px padding), penukar tiga mode
(`:664`) dengan label penuh "Database RAG"/"Web Search"/"Deep Research" ≈ **380px** tanpa `flex-wrap`
maupun `overflow-x-auto`, daftar pesan `p-6` (`:678`).

**Nol drawer** — tak ada satu pun `drawer`/`hamburger`/`sidebarOpen` di berkas itu.

`:496`, `:500`, `:525` memakai `h-screen`, bukan `h-dvh` → di iOS Safari bilah masukan duduk di bawah
chrome peramban.

**Dan kodenya sudah tahu penggunanya di HP.** `labelRamah.js:17-18`: *"Pengguna Mametlite membuka dari
HP. Tidak ada kursor, jadi tidak ada tooltip."* Tetapi `:609` (hapus dokumen), `:631` (hapus chat),
dan `:686` (Salin) memakai `opacity-0 group-hover:opacity-100` — **tiga kendali yang tidak terjangkau
tanpa penunjuk ber-hover.**

### M4 — ✅ SELESAI 8 Okt — bahasa yang tidak dimengerti orang awam

> **✅ DITUTUP 2026-10-08** — [log](../project-memory/changelog/2026-10-08-mametlite-bicara-bahasa-penggunanya.md)
>
> `lib/pesanGalat.js` menerjemahkan tanda galat jadi **judul + tindakan + teks teknis**. Tiga aturan:
> sebutkan tindakan (bukan hanya keadaan); **jangan menebak** bila tandanya tak dikenali (diuji —
> `QWERTY_ZZZ` tidak boleh menyebut koneksi/saldo/kunci); dan teks teknisnya tidak dibuang, karena
> pengguna HP tak punya DevTools.
>
> Pesan 402 ditulis mengikuti catatan Owner bahwa saldo minus **bukan** layanan mati: ia menyarankan
> pertanyaan lebih pendek, bukan menyatakan tidak bisa dipakai.
>
> Ikut ditutup di jalur yang sama: gelembung asisten **kosong** yang tertinggal saat arus gagal,
> mutasi di tempat pada objek pesan (tak aman di `StrictMode`), dan hapus percakapan **tanpa
> konfirmasi**.
>
> Terbukti di peramban dengan `fetch` **disumbat lebih dulu** — nol permintaan keluar ke Supabase
> produksi, diperiksa. Suite 91/91.

#### (uraian temuan, sebagaimana ditulis sebelum ditutup)

- `:490` → `❌ Error: ${err.message}`, teks **apa adanya dari server**. Yang terbaca pengguna:
  `❌ Error: ENGINEER_NO_API_KEY`, `❌ Error: Server error: 500`, `❌ Error: Failed to fetch`.
  `:487` bahkan melempar string Inggris `Unexpected response format` ke gelembung yang sama.
- Stream gagal menyisakan gelembung asisten **kosong** (`:463`) *dan* gelembung galat.
- `:237` → `alert(error.message)` galat Supabase bahasa Inggris (`Invalid login credentials`).
- 14 `window.alert`/`confirm` (`:206, 215, 218, 237, 259, 269, 298, 305, 322, 336, 374, 386, 394, 404`)
  adalah **seluruh** UX galat & konfirmasi. Dua di antaranya (`:298`, `:305`) prompt biaya
  multi-paragraf di modal sistem.
- `:631` hapus chat **tanpa konfirmasi**, padahal hapus *dokumen* (`:206`) pakai konfirmasi. Satu
  salah-sentuh di HP = satu percakapan hilang permanen.

**Yang sudah bagus dan jangan dirusak:** pesan di `documentTextExtractor.js` (`:241`, `:361-362`,
`:365`, `:368`, `:383`, `:389`) sudah Indonesia, spesifik, dan menyebut tindakan. Itu patokan mutunya
— tinggal disamakan untuk jalur lain, dan dikeluarkan dari `alert()`.

### M5 — Riwayat bisa hilang, dan tidak ada yang memberi tahu

Chat hanya di `localStorage`; **nol** rujukan tabel `chats` di seluruh `mametlite/`. Konsekuensi:
bersih-data peramban atau eviction 7 hari iOS Safari menghapus semuanya; nol persistensi lintas
perangkat (masuk dari HP setelah pakai laptop = riwayat kosong, padahal akunnya sama); mode privat
menuntut kunci dipasang ulang tiap sesi.

### M6 — Tanpa pendaftaran & reset sandi ⏳ **butuh keputusan Owner**

`grep signUp|resetPassword|signInWithOtp|signInWithOAuth|verifyOtp` di `mametlite/src` → **0**.

Di URL publik, **pengguna baru tak bisa membuat akun, dan yang lupa sandi tak bisa pulih dari UI.**
Label formulirnya `:507` "Email ASN / Admin" dan header `:658` "Pusat Riset ASN" — pembingkaian
internal di alamat publik.

**Tidak dikerjakan tanpa keputusan Owner:** ini mengubah **siapa yang boleh masuk**, bukan perbaikan
cacat. Bisa jadi keadaan sekarang memang disengaja (akun dibuat Owner secara manual). Yang perlu
Owner putuskan: apakah pendaftaran terbuka, atau tetap undangan — dan kalau tetap undangan, apakah
pesan di layar login perlu mengatakannya, supaya pengunjung tidak menebak.

### M7 — Cacat kebenaran yang lebih halus

- **Stream bisa salah alamat.** `updateMessages` menutup atas `currentConvId` (`:148`) → ganti
  percakapan saat stream berjalan, sisa tokennya masuk ke percakapan yang **ditinggalkan**.
- **Mutasi di tempat.** `:471-475` menyalin array (`[...prev]`) tetapi lalu menulis
  `newArr[len-1].content = …` — objek pesannya **masih dibagi** dengan state sebelumnya. Tidak aman
  di `StrictMode` (`main.jsx:7`).
- `callAgentSimple.js:39` memuat `'deep_research'` **dua kali**, dan menerima `'researcher'` yang
  tidak pernah dihasilkan `App.jsx:414-435`.
- `App.jsx:367` → kegagalan menghapus versi lama dokumen hanya `console.warn`; **pengguna tidak
  diberi tahu**, jadi duplikat basi diam-diam tetap ada di RAG.
- `callAgentSimple.js:149` → kegagalan parse per-chunk SSE hanya `console.error`; jawabannya
  berlubang tanpa tanda.

### M8 — ✅ SELESAI 8 Okt — kode mati yang **menyesatkan pembaca berikutnya**

> **✅ DITUTUP 2026-10-08** — [log](../project-memory/changelog/2026-10-08-mametlite-sisa-perancah-vite.md)
>
> Owner menyerahkan keputusannya, jadi keempat kelompok dikerjakan. `App.css`, 4 aset, 4 dependency
> dihapus; `README.md`, `lang`, judul halaman, dan `.custom-scrollbar` diperbaiki (didefinisikan,
> bukan dicabut — daftar dokumennya memang bergulir).
>
> **Dua celah ketahuan saat mengerjakannya:** nama variabel lingkungan tidak tercatat di mana pun
> (ditambahkan `.env.example`), dan `.gitignore:45` pola `.env*` **menelan contohnya sendiri** —
> `backend/.env.example` selamat hanya karena sudah terlacak sebelum pola itu ada. Ditambahkan
> pengecualian, diperiksa dengan `git add --dry-run`.
>
> Build lulus, suite 92/92.

#### (uraian temuan, sebagaimana ditulis sebelum ditutup)

| Berkas | Bukti |
|---|---|
| `mametlite/src/App.css` | 184 baris, **0 pengimpor** (`grep "App.css"` → 0; `main.jsx:3` hanya `./index.css`). Dan **satu-satunya** `@media` di seluruh proyek ada di sini — 6 blok `max-width: 1024px`. Siapa pun yang membacanya akan **menyangka Mametlite sudah responsif.** |
| `mametlite/README.md` | masih template Vite verbatim ("This template provides a minimal setup…"), nol kata tentang Mametlite |
| `index.html:2` | `lang="en"` pada UI yang seluruhnya bahasa Indonesia |
| dependency terpasang tak pernah diimpor | `react-markdown`, `remark-gfm` (sengaja diganti parser tangan `:18-65`), `autoprefixer`, `postcss` (tak ada `postcss.config.js`) |
| aset tak terpakai | `src/assets/hero.png`, `react.svg`, `vite.svg`, `public/icons.svg` |
| kelas hantu | `custom-scrollbar` (`:602`) tidak didefinisikan di mana pun |
| `CHANGELOG.md` | berhenti 2026-09-08, padahal ±12 commit mendarat sesudahnya |

**Menunggu izin Owner** (Constitution: *hapus lunak sebelum hapus permanen*).

### M9 — ✅ SELESAI 8 Okt (penjaganya) — utang arsitektur: tiga salinan tangan tanpa penegak

> **✅ PENJAGANYA DITUTUP 2026-10-08** — [log](../project-memory/changelog/2026-10-08-salinan-mametlite-bersuara.md)
> · **penyatuannya tetap ⏳ usul ADR**, bukan pekerjaan tertunda.
>
> Aturannya **bukan** "harus identik" — itu diputuskan dari pengukuran: ketiganya sudah berbeda hari
> ini, dan `pdfOcrService` menyimpang sungguhan (`hitungHalamanPdf` hanya di frontend). Diperiksa:
> fungsi itu hanya dipakai `bacaPdfAsn.js`, jalur ASN **khusus Ecosystem** — jadi perbedaannya sah.
> "Harus identik" akan merah sejak lahir, lalu dicabut dalam sepekan (perangkap yang sama dengan
> J3b/J3c). Aturannya: **GAGAL** bila nama yang ada di kedua sisi isinya beda; **LAPOR** bila
> sepihak.
>
> **Satu bug di uji ini sendiri ikut tercatat:** bentuk pertamanya melaporkan 8 ekspor menyimpang
> pada berkas yang `diff` nyatakan hanya beda 4 baris header. Sebabnya salinan Mametlite CRLF dan
> frontend LF, dan di JavaScript `.` tidak cocok dengan `\r`. Yang salah ujinya, bukan kodenya.
>
> 26 ekspor bersama diperiksa; dibuktikan menggigit lewat 2 mutasi. Suite 92/92.

#### (uraian temuan, sebagaimana ditulis sebelum ditutup)

`mametlite/src/lib/` memuat tiga berkas yang **menyatakan dirinya salinan**:

| Berkas | Baris | Header |
|---|---|---|
| `documentTextExtractor.js` | 420 | `:14` "SALINAN dari frontend/src/core/runtime/services/documentTextExtractor.js" |
| `pdfOcrService.js` | 216 | `:26` "SALINAN dari frontend/… **Ubah keduanya bersamaan.**" |
| `tabelCentang.js` | 377 | `:21` "SALINAN dari frontend/…" |

±1.000 baris, dan **tidak ada apa pun yang menegakkan perintah "ubah keduanya bersamaan"**.
Constitution: *satu berkas satu tanggung jawab*.

**Yang dikerjakan sekarang:** uji penjaga yang **gagal** bila pasangannya menyimpang — supaya
penyimpangannya bersuara. **Yang TIDAK dikerjakan tanpa keputusan Owner:** menyatukannya. Itu
perubahan arsitektur dan pantas jadi ADR sendiri, bukan diselipkan ke pekerjaan stabilisasi.

---

## 2. Jaring keselamatan — temuan paling berdampak

### J1 — Suite uji terkunci di satu mesin

**69 dari 87** berkas uji memaku `D:/SLAMET/other/mamet os ecosystem` **di kode yang dijalankan**,
bukan di komentar. Contoh: `uji-analysis-review-dihapus.mjs:15`, `uji-data-tabel-asn-tahap5.mjs:9`,
`uji-catatan-akar-repo.mjs:23`.

Di clone mana pun dengan path berbeda — termasuk setiap runner CI — mereka **GAGAL keras**, bukan
DILEWATI. Subset yang benar-benar portabel ≈ **13 berkas**.

**Polanya yang benar sudah ada di repo, dan hanya 2 berkas memakainya.** `uji-cari-judul.mjs:21-23`
menuliskan masalahnya sendiri:

> *"AKAR diturunkan dari letak berkas ini. Bentuk lama memakunya sebagai jalur absolut
> ('D:/SLAMET/...'), jadi ujinya hanya bisa jalan di satu mesin dengan satu nama folder."*

Jadi ini **menerapkan pola repo sendiri secara merata** — nol dependency baru, nol logika baru, nol
penemuan.

### J2 — 5 uji ASN tanpa penjaga (GAGAL keras, bukan DILEWATI)

`uji-data-tabel-asn.mjs` dan `-tahap2..5` membaca `D:/REKONSIALISASI 2026/...` tanpa `existsSync` →
GAGAL di mesin yang tidak punya datanya. `uji/README.md:66-67` mengklaim uji itu hanya "bisa
dijalankan" di mesin yang punya data — **kodenya tidak mewujudkan klaim itu.**

Polanya juga sudah ada dan benar di dua tempat: `uji-chimera-verifier-nyata.mjs:17-22` dan
`uji-folder-label.mjs:24-29` mencetak `DILEWATI` lalu `process.exit(0)`.

### J3 — Nol uji di CI, dan rilis bisa terbit dengan semuanya merah

`grep jalankan-semua` di `.github/` → **nol**. `build.yml` berjalan: checkout → setup-node →
`npm ci` → suntik env → `npm run dist:publish`. **Tanpa uji, tanpa lint, tanpa typecheck.**

Satu-satunya pemanggil otomatis suite adalah `main.cjs:1046-1099` (Tahap 6), yang hanya hidup saat
aplikasi desktop terbuka dan sebuah patch sedang diverifikasi.

Bahan untuk gerbangnya **sudah siap pakai**: `uji/jalankan-semua.mjs:155` sudah
`process.exit(gagal ? 1 : 0)`, dan `scripts/samakan-crlf.mjs --periksa` sudah keluar 1 dan
**ditawarkan sebagai penjaga** di `uji/README.md:104-119`. Keduanya hanya belum disambungkan.

Taruhan CRLF nyata, bukan teoretis: berkas LF membuat `PatchGenerator` cari-ganti cocok **nol** baris
(kegagalan live 24 Sep, kini dijaga `uji-patch-crlf.mjs`).

### J3b — ⚠️ Prasyarat J3 yang baru ketahuan: ada satu uji yang GOYAH, dan ia akan meracuni CI

Ditemukan saat menjalankan suite untuk memverifikasi perubahan dokumen roadmap ini sendiri
(2026-10-07). **86/87 lulus; `uji-alat-folder-jalan.cjs` GAGAL.**

Perubahan yang sedang diverifikasi hanya **dua berkas markdown**, yang tidak mungkin memengaruhi uji
yang mematikan pohon proses Python. Jadi dipisahkan dulu — "rusak oleh perubahan" lawan "sudah merah":

| Percobaan | Hasil |
|---|---|
| suite penuh (87 berkas) | **GAGAL** — `habis waktu 3 s → pohon proses dimatikan (3661 ms)` |
| sendirian, 3× | **LULUS** (3153, 3175, 3156 ms) |
| sendirian + 6 pembebani CPU | **LULUS** (3182 ms) |
| proses python yatim sesudahnya | **nol** — pematian pohonnya benar bekerja |

**Dan penyebabnya BUKAN yang tertulis di nama asersinya.** `uji-alat-folder-jalan.cjs:100`:

```
cek(h.ok && h.habisWaktu && h.keluaran.includes('mulai') && Date.now() - t0 < 15000, …)
```

Toleransi waktunya **15.000 ms** dan ia gagal pada **3.661 ms** — jadi batas waktunya tidak pernah
dilanggar. Yang runtuh adalah `h.habisWaktu` atau `h.keluaran.includes('mulai')`: keluaran anak
(`print('mulai', flush=True)`) tampaknya **hilang dalam perlombaan dengan pematian pohon** saat
berjalan di dalam suite. Pesan gagalnya menyebut angka milidetik, sehingga pembaca pertama — termasuk
saya — akan menyangka ini soal lambat. Bukan.

**Kenapa ini prasyarat, bukan sekadar temuan:** rencana J3 menyambungkan suite ini jadi gerbang CI.
Gerbang yang kadang merah tanpa sebab akan dimatikan orang dalam sepekan — dan itu **persis** yang
`uji-catch-diam.mjs:16-21` sudah peringatkan: *"uji yang merah dari lahir akan dinonaktifkan dalam
sepekan, lalu tidak menjaga apa pun."* Menyambungkan suite ke CI **sebelum** flake ini dipatok akan
membangun gerbang yang dijamin dicabut.

**Arah perbaikan (belum dikerjakan):** pisahkan asersi majemuk `:100` jadi tiga asersi terpisah
supaya pesan gagalnya menunjuk penyebabnya, lalu tunggu `'mulai'` terbaca **sebelum** batas waktu
dipicu alih-alih berlomba dengannya. **Jangan** melebarkan toleransi 15.000 ms — ia bukan yang gagal,
dan melebarkannya hanya menyembunyikan perlombaannya.

**Catatan kejujuran:** flake ini **tidak tereproduksi** dalam 4 percobaan terkendali di atas, jadi
pemicu persisnya belum dipatok — hanya tersingkirkan: bukan beban CPU, bukan proses yatim, bukan
toleransi waktu. Yang belum diuji: interaksi dengan berkas uji lain yang berjalan sebelumnya di suite
(ada empat uji folder bersaudara + `uji-engineer-jalankan.cjs`).

### J3c — ⚠️ Prasyarat J3 yang kedua: penjaga CRLF juga akan merah sejak lahir

Ditemukan 2026-10-07, dan ini **cacat di rencana J3 di atas** — bukan temuan di kode. J3 mengusulkan
menyambungkan `scripts/samakan-crlf.mjs --periksa` ke CI karena *"sudah keluar 1 dan ditawarkan
sebagai penjaga"*. Diperiksa sebelum dikerjakan:

```
node scripts/samakan-crlf.mjs --semua --periksa   → 785 berkas perlu disamakan, keluar 1
node scripts/samakan-crlf.mjs --periksa           → keluar 1
```

**785 berkas terlacak** berbeda dari hasil checkout-nya — termasuk berkas uji yang sudah lama ada.
Jadi menyambungkannya ke CI apa adanya akan membuat gerbang yang merah pada commit pertama, lalu
dicabut orang dalam sepekan. **Persis perangkap yang J3b di atas peringatkan — dan saya hampir
mengulanginya di rencana yang sama.** Dicatat begini supaya kesalahan menimbangnya tidak terulang.

Yang sebenarnya terjadi: standar yang **dideklarasikan** repo (CRLF, `uji/README.md:104-119`) dan
**keadaan nyata** di disk bertentangan. `uji-samakan-crlf.mjs` hijau — tetapi ia menguji **logika
alatnya**, bukan kepatuhan repo. Jadi klaim "bisa dipakai sebagai penjaga" benar tentang alatnya dan
salah tentang kesiapannya.

**Keputusan Owner, bukan keputusan asisten:**

| Pilihan | Konsekuensi |
|---|---|
| Samakan 785 berkas sekali jalan | satu commit mekanis besar; sesudahnya gerbangnya sah dan murah |
| Gerbang hanya untuk berkas yang berubah | lebih kecil, tetapi utang 785 berkas tetap ada dan bisa menggigit `PatchGenerator` kapan saja |
| Cabut klaimnya dari `uji/README.md` | paling murah, dan paling jujur bila CRLF memang bukan standar lagi |

Taruhannya nyata, bukan kerapian: berkas LF membuat `PatchGenerator` cari-ganti cocok **nol** baris
(kegagalan live 24 Sep, kini dijaga `uji-patch-crlf.mjs`).

**Yang sudah dikerjakan 7 Okt:** berkas yang disentuh pekerjaan M1 disamakan dengan alatnya sendiri
(`node scripts/samakan-crlf.mjs`, mode berkas-berubah) → `--periksa` keluar **0** untuk berkas itu.
785 berkas lain **tidak** disentuh: mereformatnya tanpa keputusan Owner akan membuat satu diff
raksasa yang mengubur pekerjaan nyata.

### J4 — Penjaga rahasia yang secara konstruksi tidak bisa melihat

`production-pipeline.yml:13-24` memindai kebocoran kunci — **hanya di `./supabase/functions`**:

```
! grep -r -i "GEMINI_API_KEY=" ./supabase/functions || exit 1
! grep -r -i "SUPABASE_SERVICE_ROLE_KEY=" ./supabase/functions || exit 1
```

Logika negasinya benar. Tetapi cakupannya membuatnya **tidak mungkin** menangkap kunci yang duduk di
`build.yml:37`, dua folder darinya. Pola yang dicarinya pun tidak memuat `VITE_SUPABASE_ANON_KEY=`.

Sebuah penjaga yang tidak bisa melihat benda yang dijaganya adalah bentuk lain dari cacat yang
`uji-catch-diam.mjs` dibuat untuk melawan: sesuatu yang gagal **tanpa bersuara**.

### J5 — Kunci anon di repo publik, berlaku sampai 2036

`build.yml:37` menulis JWT `role: anon` **apa adanya** ke `frontend/.env`, bukan dari `secrets`.
Payload-nya: `role: anon`, `ref: uuyzdjifhdfyyvpxsofu`, `exp 2095239285` ≈ **2036**.

**Bobotnya sedang, dan alasannya penting:** kunci anon memang **dirancang** terlihat klien, dan
keduanya `VITE_`-prefixed sehingga toh masuk bundel. Yang hilang bukan kerahasiaan — yang hilang
adalah **kemampuan merotasinya**, karena ia ada di riwayat git publik dengan masa 10 tahun.

Catatan bersebelahan: `GH_RELEASE_TOKEN` adalah PAT **lintas-repo** dengan `contents: write`, karena
target publish adalah repo lain (`mamet334/mamet-ai-releases`, `frontend/package.json:97-101`).

### J6 — Pemicu rilis lebih lebar dari klaim komentarnya

`build.yml:7-8` menyaring `paths: ['frontend/package.json']`, dengan komentar yang mengklaim *"hanya
build kalau ada perubahan versi di package.json"*. Saringannya berbasis **path, bukan isi** —
menambah satu dependency atau mengubah satu skrip **juga** memicu publish-ke-release penuh.

### J7 — Job deploy yang tidak men-deploy

`production-pipeline.yml:48-64` memasang Supabase CLI lalu `echo "Simulating Edge Function Deployment
Validation..."`; perintah sebenarnya dikomentari di `:64`.

### J8 — Versi yang berbohong

| | Nilai | Catatan |
|---|---|---|
| `frontend/package.json:2` | **4.2.14** | otoritatif; memberi `electron-builder` & `app.getVersion()` |
| `frontend/src/core/runtime/Kernel.js:63` | **3.0.0** | `identity.version` — **satu major tertinggal** |
| `VITE_APP_VERSION` | **tak pernah didefinisikan** | dirujuk `lazyLoadWithRetry.js:18` |

`Kernel.js` adalah satu dari **6 berkas yang dikecualikan dari obfuscator** (`vite.config.js:17`),
jadi string `3.0.0` itu terkirim **terbaca** di bundel.

Dan `VITE_APP_VERSION` tidak ada di `vite.config.js` (nol blok `define`) maupun di `build.yml:36-37`
(yang hanya menyuntik dua var Supabase). Akibatnya **setiap diagnostik gagal-muat-chunk di produksi
mencatat versi sebagai `"unknown"`** — persis di tempat versi paling dibutuhkan untuk melacak rilis
yang buruk.

**Yang sudah benar dan jadi polanya:** `Settings.jsx:173` membacanya saat jalan lewat
`window.electronAPI.getAppVersion()` → `preload.cjs:89` → `main.cjs:1135-1137` → `app.getVersion()`.
Nol versi dipaku di string UI.

### J9 — Nol lint & typecheck di aplikasi yang dikirim

Satu-satunya konfigurasi ESLint di seluruh repo ada di `mametlite/eslint.config.js`, dan skrip
`lint`-nya **tidak tersambung ke apa pun**. Nol `tsconfig` meski ada TS nyata di
`supabase/functions/**` dan `types/memory.ts` — jadi **edge function Deno tidak pernah
type-check** di CI (job yang seharusnya hanya `echo`, lihat J7).

---

## 3. Permukaan serangan platform — diperiksa di platform, bukan di repo

> Pelajaran T11, dicatat di `ROADMAP-TEMUAN-TERBUKA.md`: *"dihapus dari repo" dan "dihapus dari
> platform" adalah dua klaim berbeda, dan hanya yang pertama bisa dibuktikan dari kode.* Bagian ini
> menerapkannya **ke arah sebaliknya** — memeriksa apa yang hidup di platform tetapi tak terlihat
> dari repo.

Diperiksa 2026-10-07 lewat API Supabase, proyek `uuyzdjifhdfyyvpxsofu`.

**Repo punya 7 folder fungsi; platform menjalankan 6.**

| Fungsi | Platform | `verify_jwt` | Pemanggil di repo |
|---|---|---|---|
| `agent-process` | ACTIVE v528 | false | **banyak** |
| `rag-process` | ACTIVE v76 | false | `ResearchApp.jsx:279` |
| `health-check` | ACTIVE v54 | false | `DisasterRecoveryWidget.jsx:22` |
| `ping` | ACTIVE v41 | false | `useDashboardData.js:320` |
| **`cron-agent`** | **ACTIVE v72** | true | **NOL** |
| **`knowledge-health`** | **ACTIVE v43** | true | **NOL** |
| `test-suite` | **tidak ter-deploy** | — | NOL |

`check-keys` **benar-benar tidak ada lagi** — klaim penutupan T11 terkonfirmasi di platform, bukan
hanya di repo.

### P1 — `cron-agent`: ter-deploy, nol pemanggil, memegang token kirim-pesan Owner ⏳ **keputusan Owner**

`supabase/functions/cron-agent/index.ts` — `serve()` di baris 9, dan **tidak ada pemeriksaan pemanggil
sama sekali**. Ia memakai `SUPABASE_SERVICE_ROLE_KEY` (`:16`), membaca `scheduled_tasks`, dan
menjalankan tugas milik **siapa pun** (`task.user_id`, `:46`, `:63`, `:76`). Lalu ia mengirim lewat:

`RESEND_API_KEY` (`:91`) · `TELEGRAM_BOT_TOKEN` (`:221`) · `TWITTER_BEARER_TOKEN` (`:233`) ·
`FACEBOOK_PAGE_TOKEN` (`:246`) — **token Owner**.

Jadwal pg_cron pendorongnya **sudah dihapus 31 Agustus** (dicatat di migrasi
`20260910144900_cleanup_cron_history_weekly.sql:5`).

**Ini pola `check-keys` yang persis** — ter-deploy, nol pemanggil, tanpa pemeriksaan pengguna,
memegang kredensial, dan pertanyaan yang melahirkannya sudah berlalu. Dengan satu perbedaan:
`check-keys` hanya **membaca** kunci; yang ini **mengirim pesan**.

**Bobotnya, apa adanya:** `scheduled_tasks` **kosong — 0 baris** (dikueri 2026-10-07). Jadi hari ini
memanggilnya **tidak melakukan apa pun**. Ia **tuas tanpa muatan**, dan `verify_jwt: true` berarti
pemanggilnya butuh JWT yang sah (bukan anonim). Alasan menutupnya **bukan** kerusakan yang sedang
berjalan — melainkan bahwa ia **menunggu data**: satu tugas terjadwal dibuat, tuasnya hidup, dan yang
bisa menariknya adalah setiap pemegang JWT, termasuk pengguna Mametlite eksternal.

**Cara mengoreksi bila kenyataan berbeda:** bila Owner masih berencana menghidupkan tugas terjadwal,
yang dibutuhkan bukan penghapusan melainkan **pemeriksaan pemanggil** (hanya service_role / hanya
pemilik tugas). Yang tidak sah sebagai alasan mempertahankannya apa adanya: bahwa tabelnya sedang
kosong.

### P2 — `knowledge-health`: ter-deploy, nol pemanggil

262 baris, memegang `SUPABASE_SERVICE_ROLE_KEY` (`:57`). Nol pemanggil di `frontend/`, `backend/`,
`scripts/`, `uji/`; dan **tidak ada di `config.toml`** — hanya dirujuk dokumen
(`docs/architecture/phase2-knowledge-governance.md:232,290,315`). Bobotnya lebih rendah dari P1: ia
membaca & melapor, tidak mengirim.

### P3 — `test-suite` masih terdaftar di `config.toml` meski tak ter-deploy

`supabase/config.toml:16-25` masih mendeklarasikannya. Isinya menulis ke `user_memories` dengan
service_role (`index.ts:60`). Belum ter-deploy adalah **kebetulan yang baik**, bukan perlindungan —
satu perintah `supabase functions deploy` tanpa argumen bisa mengubahnya.

### P4 — Advisor Supabase (5 kelas)

| Lint | Tingkat | Keadaan |
|---|---|---|
| `auth_leaked_password_protection` | WARN | **MATI** — langsung menyentuh pengguna Mametlite yang mendaftar |
| `anon_security_definer_function_executable` | WARN | `check_daily_quota` bisa dipanggil **anon** lewat `/rest/v1/rpc/` |
| `authenticated_security_definer_function_executable` | WARN | `check_daily_quota`, `get_active_knowledge`, `match_memories` |
| `extension_in_public` | WARN | `vector`, `pg_net` di skema `public` |
| `rls_enabled_no_policy` | INFO | `hakim_bayangan` — RLS aktif, 0 policy |

**Diperiksa sebelum ditulis, dan hasilnya menenangkan:** ketiga fungsi `SECURITY DEFINER` itu
**menyebut `auth.uid`** di definisinya (dikueri `pg_get_functiondef`). Jadi perbaikan **Item 45**
(kebocoran `match_memories` lintas pengguna) **masih berdiri**. Ini **pertahanan berlapis yang belum
rapat, bukan pintu terbuka** — ditulis begini supaya bobotnya tidak dibesar-besarkan.

`hakim_bayangan` dengan 0 policy **disengaja** (hanya service_role, tanpa pembaca klien). Yang kurang
hanya **komentar di migrasinya**, supaya pembaca berikutnya membacanya sebagai keputusan, bukan
kelalaian — dan supaya baris advisor itu tidak dikejar berulang kali.

---

## 4. Hak 39 tabel — artefak prasyarat T11, sekarang lengkap

> `ROADMAP-TEMUAN-TERBUKA.md` T11 menyisakan ini sebagai ⏳ dengan syarat eksplisit: *"Perlu daftar
> pemakai per tabel lebih dulu — jangan dicabut buta."* **Bagian ini memenuhi syarat itu.**

**Keadaan platform (2026-10-07):** 40 tabel, **RLS aktif di semuanya**. **39 tabel** masih memberi
`anon` **dan** `authenticated` ketujuh hak: `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES,
TRIGGER`. Hanya `hakim_bayangan` yang sudah dicabut (migrasi `20260928061500`).

### ⚠️ Arah yang tertulis di T11 TIDAK bisa dijalankan apa adanya

T11 mengusulkan: *"yang hanya ditulis service role (`api_usage`, `checks`, `incidents`,
`service_heartbeat`, `agent_logs`, …) dicabut seluruhnya."*

**Kelima tabel itu dibaca klien.** Diperiksa satu per satu, bukan didugaan:

| Tabel | Lokasi baca di klien |
|---|---|
| `api_usage` | `BillingDashboard.jsx:67` `.select('*')` · `useDashboardData.js:118` · kuota harian `AssistantService.js:1629` `.select('cost_usd')` · **`cadanganData.js:25`** |
| `agent_logs` | `useDashboardData.js:117` `.select('*')` · `ExecutionTraceService.js:593` `.select('id, event_type, …')` |
| `checks` | `useDashboardData.js:114` `.select('status_code,response_time_ms,checked_at')` |
| `incidents` | `useDashboardData.js:115` `.select('status,started_at,resolved_at')` |
| `service_heartbeat` | `useDashboardData.js:313` `.select('status, last_heartbeat_at')` |

Mencabut haknya seluruhnya akan **mematikan dasbor penagihan, dasbor observability, pemeriksaan kuota
harian, dan fitur "Cadangkan data"** sekaligus — persis *"mematikan fitur"* yang T11 sendiri
takutkan. Semua lokasi di atas `.select()`; **nol tulis klien** di kelimanya.

### 13 tabel yang WAJIB punya SELECT, atau cadangan 13/13 patah

`cadanganData.js:16-30` `TABEL_CADANGAN` — Item 93 Tahap 1, terbukti 13/13 oleh Owner. Ia mengambil
tiap tabel lewat **variabel** (`from(nama)`, `:37`), jadi daftar ini **satu-satunya** sumber yang
menyebutnya:

`knowledge_spaces` · `documents` · `document_chunks` · `workspace_summaries` · `asn_berkas` ·
`asn_pegawai` · `chats` · `user_memories` · `api_usage` · `project_memory_entries` ·
`engineering_tasks` · `architecture_gaps` · `verification_runs`

Berkas itu juga mencatat yang **sengaja dikecualikan**: `agent_logs`, `evidence_audit_logs`,
`verification_audit_logs` (log, bukan data — `agent_logs` pernah menyimpan kunci API, T7), dan tabel
pemantauan (`checks`, `incidents`, `monitors`, `service_heartbeat`).

### 10 tabel yang DITULIS klien

`asn_berkas` · **`assistant_audit_log`** · `chats` · `conversion_jobs` · `document_chunks` ·
`documents` · `knowledge_spaces` · `project_memory_entries` · `raw_memory_content` · `user_memories`

`assistant_audit_log` hanya ketemu karena pemeriksaan metode di §0 — klien menulisnya lewat
`AuditLogService.js:83` `supabase.from(this._tableName).insert(...)` dengan `:24`
`this._tableName = 'assistant_audit_log'`. **Mencabut `INSERT` di sini akan mematikan jejak audit
perintah yang baru dipasang di 4.2.11.**

### 14 tabel tanpa SATU PUN rujukan klien

`chats_backup` · `conversion_workers` · `cost_ledger` · `entity_locks` · `evidence_audit_logs` ·
`knowledge_conflicts` · `knowledge_relationships` · `lifecycle_audit_log` · `mamet_memory` ·
`memory_audit_log` · `memory_audit_logs` · `memory_relations` · `monitors` · `scheduled_tasks`

**Dua peringatan sebelum ini dipakai sebagai daftar cabut-penuh:**

1. **`scheduled_tasks` punya 4 policy** — angka itu menandakan akses klien pernah dirancang. Nol
   rujukan hari ini bisa berarti UI-nya dihapus, bukan bahwa ia memang server-saja. Periksa sendiri
   sebelum mencabut.
2. **`memory_audit_log` dan `memory_audit_logs`** — dua tabel bernama nyaris sama, keduanya nol
   rujukan. Salah satunya kemungkinan sisa. Itu temuan terpisah, bukan bagian pencabutan hak.

### Aturan pencabutan yang sah, karena itu

| Hak | Tindakan | Alasan |
|---|---|---|
| `TRUNCATE`, `REFERENCES`, `TRIGGER` | **cabut di 39 tabel** | nol jalur klien memakainya, dan **ketiganya tidak tunduk RLS** — jadi inilah satu-satunya lapisan yang pernah bisa menahannya. Bagian yang murni untung. |
| `SELECT` | **pertahankan** di tabel yang dibaca klien (termasuk 13 tabel cadangan) | RLS tetap menyaring per baris; mencabutnya mematikan fitur |
| `INSERT`/`UPDATE`/`DELETE` | cabut **hanya** di tabel yang terbukti tak ditulis klien, **per tabel** | daftar 10 penulis di atas yang menentukan |
| semua hak | cabut di tabel nol-rujukan, **sesudah dua peringatan di atas diperiksa** | |

**Catatan proporsi, supaya bobotnya tidak dibesar-besarkan:** `TRUNCATE` **tidak** bisa dijangkau
lewat kunci anon. Kunci anon adalah JWT untuk PostgREST, dan PostgREST hanya memaparkan
SELECT/INSERT/UPDATE/DELETE — keempatnya tetap dijaga RLS. `TRUNCATE` menuntut SQL langsung sebagai
peran `anon`, yang butuh kredensial koneksi Postgres. Jadi ini **merapatkan pertahanan berlapis**,
bukan menutup pintu yang sedang terbuka. Penilaian ini mengikuti yang sudah tertulis di T11 dan
diperiksa ulang, bukan diwarisi.

---

## 5. Ecosystem — sisa temuan

### E1 — CSP dicabut di rilis produksi, dan penjaga navigasi satu-satunya lapisan

`frontend/package.json:14` `desktop:postbuild` membuang meta `Content-Security-Policy` dari
`dist/index.html`, dan **ketiga** jalur paket (`dist`, `dist:portable`, `dist:publish`) memanggilnya.

Yang berlapis di atasnya: `webSecurity: false` (`main.cjs:181`), `allow-file-access-from-files`
(`:247`), dan `preload.cjs` yang memaparkan `fs:readFile`/`fs:writeFile`/`fs:deleteFile`,
`engineer.jalankan`, `eng:git-rollback`, `net:fetchWeb` — ±35 kanal IPC tanpa pemeriksaan origin
per-kanal. Penjaga `setWindowOpenHandler` (`:223`) dan `will-navigate` (`:232`) adalah **satu-satunya**
lapisan yang memisahkan itu dari isi asing, **dan komentar di `:199-214` menyatakannya sendiri.**

**Akarnya tunggal, dan jalan keluarnya sudah ada di repo.** Komentar `:163-180` menyebut satu sebab:
`WebComparisonService.js:405` memanggil `fetch()` RSS pihak ketiga **dari renderer**. Dan
`preload.cjs` **sudah** memaparkan `net:fetchWeb` — jadi pekerjaannya memindahkan pemanggilnya ke
proses utama, bukan menambal.

**Tidak dikerjakan di roadmap ini.** Owner **sengaja mempertahankan** `webSecurity: false` sebagai
load-bearing (TMN-0009, 2026-10-06), dengan komentar bertanggal dan alasan bernama. Mencabut yang
load-bearing tanpa keputusan Owner melanggar aturannya sendiri. **Diusulkan sebagai ADR** — karena
kalau akarnya pindah, `webSecurity: false` berhenti load-bearing dan bisa dicabut **tanpa**
mematikan apa pun. Itu Root Cause, bukan patch.

### E2 — Seluruh log renderer ditulis ke disk tanpa saringan

`main.cjs:243-248` meneruskan **setiap** pesan konsol renderer ke `os.tmpdir()/mamet-renderer.log`
lewat `appendFileSync`, tanpa filter. Dua penangan crash (`:28-32`, `:34-38`) juga menulis ke
`os.tmpdir()` dan **menelan kegagalannya sendiri** (`catch (e) {}`).

Konteksnya: `agent_logs` pernah menyimpan kunci API dari payload (T7), dan penyaringnya
(`saring_rahasia.ts`) menjaga **sisi server** — bukan sisi ini.

**Dilaporkan, belum diusulkan perbaikannya:** jalur ini dipakai Owner untuk diagnosis, dan menyaringnya
bisa menghilangkan baris yang justru dicari. Perlu arahan Owner tentang apa yang boleh hilang.

### E3 — Tiga berkas React yatim, dan satu ADR yang namanya melenceng (bukan keputusannya)

Nol pengimpor untuk ketiganya, diperiksa dengan pola impor sebenarnya —
`git grep -E "from ['\"].*/(Login|EngineerChat|ActivityBar)['\"]"` → **nol**. Sisa kemunculannya
hanya `graphify-out/` (hasil pindaian, bukan kode).

| Berkas | Byte | Bukti |
|---|---|---|
| `components/EngineerChat.jsx` | 227 baris | hanya deklarasinya sendiri (`:5`). Masih memuat endpoint `agent-process` (`:84`) dan membaca `VITE_SUPABASE_ANON_KEY` |
| `components/os/ActivityBar.jsx` | 3.209 | hanya deklarasinya sendiri (`:21`). `OSDesktopShell.jsx:1-5` mengimpor `Sidebar`, bukan ini |
| `components/Login.jsx` | 152 baris | hanya deklarasinya sendiri (`:5`). `App.jsx:5` memakai `LampLogin` — komponen **lain** |

#### Koreksi atas cara temuan ini hampir dilaporkan

Versi pertama catatan ini berbunyi *"dokumennya berbohong"*, karena `ActivityBar` masih disebut di
`ADR-0019:12,38,64`, `MAMET_OS_PROJECT_HANDOFF_v3.0.0.md:85`, dan `changelog/2026-07-05.md:11`.

**Diperiksa, dan itu salah menimbang.** ADR-0019 memberi `ActivityBar.jsx` peran *"UI Sidebar yang
murni pasif, merender hierarki dari `NavigationService`"* (`:38`). Dan `Sidebar.jsx` (9.342 byte)
**mengerjakan persis itu** — `:13-14` mengambil `ApplicationManager` + `NavigationService`, `:28`
memanggil `navigationService.getTree()`.

Jadi **keputusan ADR-0019 terlaksana dan benar.** Yang berubah hanya **nama komponennya**:
`ActivityBar.jsx` (3.209 byte, 30 Juli) adalah pendahulu yang digantikan `Sidebar.jsx` (9.342 byte,
tanggal sama) — dan penggantinya lebih besar justru karena ia memikul peran yang ADR berikan.

**Konsekuensinya untuk pekerjaan:** yang diperbaiki di dokumen adalah **nama berkasnya**, dengan
catatan "digantikan `Sidebar.jsx`" — **bukan** keputusannya. Sebuah commit pembersihan tidak boleh
terbaca seolah ia membatalkan ADR yang justru sudah dipenuhi. Menghapus berkasnya tanpa memperbarui
namanya hanya memindahkan kebingungannya dari kode ke dokumen.

**Bukan yatim, sengaja dipertahankan:** `services/engineer/IntentClassifier.js` (76 baris) — tak
diimpor kode produksi, dan itu **tercatat** di `engineer.js:1034-1036` serta **dijaga uji**
(`uji-analysis-review-dihapus.mjs:81-82`: *"IntentClassifier ditandai, bukan dihapus"*). Ia bahan uji
nyata bagi 5 berkas uji. **Jangan dihapus.**

### E4 — `backend/` 978 baris praktis tak terjangkau dari `.exe`

Satu-satunya pemanggil: `BrainService.js:248` `const localEndpoint = 'http://localhost:3000/api/chat'`
sebagai jalur "coba backend lokal dulu". Tetapi `frontend/package.json` `build.files` hanya mengirim
`["dist/**/*", "electron/**/*"]`, dan **nol skrip** menjalankan backend bersama aplikasi desktop. Jadi
di `.exe`, jalur itu **selalu** gagal.

`backend/` juga **di luar** cakupan pemindai `catch`-diam (`uji-catch-diam.mjs:59` `DIR` memuat
`frontend/src`, `supabase/functions`, `frontend/electron` — bukan `backend`).

**Dilaporkan, tidak dihapus.** Ia bisa jadi memang jalur pengembangan yang disengaja.

### E5 — Penjaga `catch`-diam: hijau, tetapi cakupannya berlubang dan prosanya melenceng

Dijalankan baca-saja: **LULUS**, `94` lawan patokan `94`.

| Area | Berkas | blok `catch` | bersuara | diam-berkomentar | **DIAM** |
|---|---|---|---|---|---|
| `frontend/src` | 133 | 191 | 114 | 16 | **61** |
| `frontend/electron` | 10 | 49 | 15 | 14 | **20** |
| `supabase/functions` | 98 | 55 | 35 | 7 | **13** |
| `backend` | 3 | 4 | 4 | 0 | **0** — *di luar cakupan* |

Dua hal yang perlu dikerjakan, dan keduanya **bukan** menurunkan angkanya:

1. **`backend/` masuk `DIR`.** Kebetulan ia 0 hari ini — jadi memasukkannya **gratis sekarang** dan
   menutup lubang sebelum ada isinya. Menambahkannya nanti akan berarti menaikkan patokan.
2. **Prosa vs kode.** `uji-catch-diam.mjs:13-14` menulis *"95 menelan galat"* dan *"38 lagi"*;
   pemindainya mengukur **94** dan **37**, dan patokannya 94. Angkanya kecil, tetapi berkas ini
   **justru** yang menegakkan aturan "patokan tidak boleh berbohong" (asersi ke-2, `:133-148`) —
   prosanya pantas memenuhi standar yang ia tuntut dari orang lain.

**Batas yang diakui pemindainya sendiri, dan jangan dilupakan** (`:35-38`): regexnya
`/catch\s*(?:\([^)]*\))?\s*\{([^{}]*)\}/g` hanya cocok pada badan `catch` **tanpa kurung kurawal
bersarang**. `catch` yang memuat `if {}` **tidak terhitung sama sekali**. Jadi **94 itu indikator,
bukan sensus** — dan `:40-41` sudah menyatakannya: *"95 bukan 95 bug."*

### E6 — Divergensi dependency

| Paket | root | `frontend` | `backend` | `mametlite` |
|---|---|---|---|---|
| `react` / `react-dom` | — | **^18.2.0** | — | **^19.2.6** |
| `vite` | — | **^5.0.0** | — | **^8.0.12** |
| `tailwindcss` | — | ^3.4.0 | — | ^4.3.0 |
| `@supabase/supabase-js` | ^2.108.2 | ^2.106.2 | ^2.110.7 | ^2.107.0 |
| `lucide-react` | — | ^0.383.0 | — | ^1.17.0 |
| `pdfjs-dist` | ^5.7.284 | ^5.7.284 | — | ^6.0.227 |

Yang perlu dicatat terpisah:

- **`electron-builder ^25.1.8` lawan `electron ^42.3.3`** — jarak **17 major** antara pembangun dan
  runtime-nya.
- **`xlsx` dari URL tarball CDN**, bukan rentang registry → `npm ci` bergantung pada
  `cdn.sheetjs.com` tetap terjangkau. Ini risiko build, bukan risiko kode.
- `deno-bin`, `puppeteer` + 3 plugin, `ghost-cursor` sebagai dependency **runtime** paket renderer
  React. Terkait `airdropEngine.cjs`, yang **Owner sengaja nonaktifkan** — jadi **bukan temuan baru
  dan tidak diusulkan hapus**; hanya bobotnya dicatat.

### E7 — Satu-satunya TODO nyata

`services/AgentOrchestratorService.js:74` — `// TODO: Implement actual execution logic/API Call`.
Jalur eksekusi orchestrator masih rintisan. Dari 8 hasil grep penanda di seluruh repo, hanya ini dan
satu di `airdropEngine.cjs:211` yang **benar-benar** utang; enam sisanya placeholder atau catatan yang
*menyebut* kata itu sambil mendokumentasikan penghapusan masa lalu.

---

## 6. Penghalang yang bukan kode, dan pengaruhnya ke rencana

`INDEX-ROADMAP.md` §5b **⛔ BERHENTI MENUNGGU SALDO**: prompt Engineer ±10.430 token lawan jatah saldo
1.048. Dihitung di sana, bukan dikira-kira — buang **seluruh** konteks Engineer, RAG, dan peta repo,
prompt-nya masih ±3.300 token.

**Pengaruhnya ke dokumen ini:** tidak ada satu pun pembuktian di bawah yang menuntut model menjawab
lewat jalur Engineer. Semuanya offline (`uji/`, `git grep`, SQL, devtools) atau lewat Mametlite yang
memakai **kunci pengguna**, bukan saldo Owner. Satu-satunya yang terhalang adalah uji live rilis
4.2.14 — dan itu **menunggu Owner, bukan menunggu pekerjaan**.

---

## 7. Sisa pekerjaan — urutan yang diusulkan

Gerbang izin Owner di antara fase. Tiap langkah satu commit sendiri.

| | Pekerjaan | Bukti penutupnya | Butuh Owner? |
|---|---|---|---|
| ~~**M1**~~ | ✅ **SELESAI 7 Okt** — penyuntikan HTML dihapus (bukan ditambal) + CSP | ✅ `uji-uraian-markdown.mjs` 5 bagian; render sebenarnya; 2 mutasi menggigit; suite 88/88 | — |
| ~~**M2**~~ | ✅ **SELESAI 8 Okt** — satu pintu riwayat + error boundary + simpan ditunda | ✅ 6 bagian uji; di peramban: nilai rusak → merender; tombol galat sisakan kunci pengguna; suite 89/89 | — |
| ~~**M3**~~ | ✅ **SELESAI 8 Okt** — laci, `h-dvh`, label mode, 3 kendali sentuh | ✅ 375px: chat lebar penuh, laci buka-tutup · 1280px: tak berubah · 2 mutasi menggigit · suite 90/90 | — |
| ~~**M4**~~ | ✅ **SELESAI 8 Okt** — penerjemah galat + gelembung kosong + konfirmasi hapus | ✅ 10+4 tanda diuji; di peramban dengan `fetch` disumbat (nol permintaan keluar); suite 91/91 | — |
| ~~**M9**~~ | ✅ **SELESAI 8 Okt** — penjaga tiga salinan (bukan "harus identik": GAGAL bila ekspor bersama beda, LAPOR bila sepihak) | ✅ 26 ekspor bersama diperiksa; 2 mutasi menggigit; suite 92/92 | — |
| **J1** | 69 berkas uji pakai pola `uji-cari-judul.mjs:21-23` | **salin repo ke path lain → hasil sama** (mustahil lulus hari ini) | — |
| **J2** | 5 uji ASN diberi penjaga `existsSync` → DILEWATI | jalankan di mesin tanpa `D:/REKONSIALISASI 2026` | — |
| **J3b** | Patok flake `uji-alat-folder-jalan.cjs:100` — **prasyarat J3** | asersi dipisah tiga; suite penuh hijau berulang kali | — |
| **J3c** | Putuskan nasib 785 berkas CRLF — **prasyarat J3** | `samakan-crlf --semua --periksa` keluar 0, atau klaimnya dicabut | ⏳ **keputusan** |
| **J3** | Suite + CRLF + lint jadi gerbang CI sebelum `dist:publish` | **PR dengan satu uji sengaja merah → CI menolak** | — |
| **J4** | Pindaian rahasia diperluas ke `.github/` | masukkan ulang kunci ke `build.yml` → CI menangkap | — |
| **J5** | Kunci anon → `secrets` | `git grep` di `.github/` → nol JWT literal | — |
| **J6** | Pemicu rilis berbasis isi, bukan path | ubah satu dependency → **tidak** memicu publish | — |
| **J8** | `Kernel.js:63`; `VITE_APP_VERSION` didefinisikan atau dicabut | `Kernel.js` = `app.getVersion()`; diagnostik tak lagi `"unknown"` | — |
| **E5** | `backend/` masuk `DIR`; prosa diselaraskan | `jalankan-semua.mjs` hijau, nol asersi dilemahkan | — |
| **E3** | 3 berkas yatim; **nama** berkas di 3 dokumen diperbarui, keputusan ADR-0019 **tidak** disentuh | `git grep` pola impor → nol, **di pesan commit** | ✅ izin hapus |
| ~~**M8**~~ | ✅ **SELESAI 8 Okt** — `App.css` + 4 aset + 4 dependency dihapus; README, `lang`, judul, `.custom-scrollbar`, `.env.example`, `.gitignore` diperbaiki | ✅ bukti nol-rujukan per berkas; build lulus; suite 92/92 | — |
| **C10a** | ⚠️ **BARU** — `pdfjs-dist` GHSA-hq66-cqwq-w95j: eksekusi JS sewenang-wenang saat membuka PDF jahat. Rentang rentan `>=5.6.83 <6.2.108`; **mametlite `^6.0.227`, frontend `^5.7.284`** — keduanya di dalamnya | bump dalam major yang sama; build + suite | — |
| **P4** | Nyalakan leaked-password; komentari `hakim_bayangan` | `get_advisors` diulang: barisnya hilang | — |
| **§4** | Migrasi hak tabel, bisa dibalik | SQL diulang: 39 → 0 `TRUNCATE` bagi anon; lalu **buka kedua aplikasi**, termasuk "Cadangkan data" 13/13 | — |
| **P1/P2/P3** | `cron-agent`, `knowledge-health`, `config.toml` | `list_edge_functions` diulang: hilang dari **platform** | ⏳ **keputusan** |
| **M6** | Pendaftaran & reset sandi | — | ⏳ **keputusan** |
| **E1** | `webSecurity:false` → akar pindah ke proses utama | — | ⏳ **ADR** |
| **M9** | Penyatuan tiga salinan | — | ⏳ **ADR** |
| **E2** | Saringan log renderer | — | ⏳ **arahan** |
| **4.2.14** | build + Publish | tiga uji §5b | ⏳ **terhalang saldo** |
| **E6** | Dependency, **paling akhir** | CI dari J3 yang menilainya | — |

### Yang sengaja TIDAK masuk dokumen ini

- **Item 92** (koreksi pemetaan ASN), **93 Tahap 3–4** (embedding lokal & offline penuh),
  **88** (BUKU-10), **90** (utang U4/U6/U7/U8b) — pekerjaan terdaftar dengan dokumennya sendiri.
- **T1** (daftar izin sub-agent di server) — arah **sudah disetujui** Owner, tetapi urutannya
  **dikunci**: sesudah Owner mengganti token Apify (sisa T7). **Catatan penting:** T1 sebentuk dengan
  **P1** di atas — `plugins/registry.ts:39` menyaring sub-agent dari `tools` kiriman **klien**, dan
  `plugins/youtube_analyst.ts:34` memakai token Apify **Owner**. Keduanya kelas yang sama: sesuatu
  milik Owner yang bisa dipicu pengguna lain. Bila P1 dikerjakan, pertimbangkan keduanya bersama.
- **`airdropEngine.cjs`** — Owner sengaja menonaktifkannya. Bukan temuan.
- **`IntentClassifier.js`** — sengaja dipertahankan sebagai bahan uji, dan dijaga uji. Jangan dihapus.

---

## 8. Dua keberatan atas urutan di atas, dicatat supaya bisa dikoreksi

1. **Mametlite ditaruh di depan rilis 4.2.14**, padahal 4.2.14 sudah selesai kodenya. Alasannya:
   4.2.14 terhalang saldo untuk **dibuktikan**, sementara M1–M4 tidak terhalang apa pun dan menyentuh
   orang yang bukan Owner.

2. **J1+J3 (suite portabel & gerbang CI) bisa dibilang lebih mendesak dari seluruh blok M.** Argumen
   yang mendukungnya: tanpa keduanya, perbaikan M sendiri dikerjakan tanpa jaring, dan setiap
   pekerjaan sesudahnya ikut. Argumen yang menahannya: M1 adalah lubang yang **sedang** terbuka bagi
   pengguna nyata, dan menundanya di belakang pekerjaan infrastruktur sulit dibenarkan.

   **Usul kompromi:** M1+M2 (paling kecil, paling berbahaya) lebih dulu, lalu J1+J3, lalu sisanya.
