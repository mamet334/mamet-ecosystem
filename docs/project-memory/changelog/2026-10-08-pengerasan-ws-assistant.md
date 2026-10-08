# 8 Oktober 2026 — galat ws-assistant berbicara bahasa Owner, dan pdf.js Ecosystem keluar dari rentang rentan

Item 125 ([`ROADMAP-SIAP-PENGGUNA.md`](../../roadmap/ROADMAP-SIAP-PENGGUNA.md)) — **E8** (baru) dan
**C10b**. Lahir dari pertanyaan Owner *"bagaimana dengan ws asisten?"*, lalu arahan
*"Pengerasan ws-assistant. kerjakan, push, naik versi bila perlu."*

Sebabnya pertanyaan itu tepat: blok M (7–8 Okt) **seluruhnya** bertarget `mametlite/`, dan §5
Ecosystem (E1–E7) semuanya tentang cangkang Electron — CSP, log renderer, berkas yatim, `backend/`,
penjaga `catch`. **Tak satu pun menyentuh permukaan chat ws-assistant**, yaitu layar yang Owner
pakai setiap hari.

---

## Bagian 1 — E8: sebelas tempat mengarang teks galatnya sendiri

### Keadaan sebelum

| Tempat | Yang ditulis ke layar |
|---|---|
| `AssistantService:381` | `'Pesan atau token tidak tersedia.'` |
| `AssistantService:871`, `:1348` | `` `Gagal menghubungi server: ${fetchErr.message}` `` |
| `AssistantService:880`, `:1359` | `` `⚠️ Error: ${errorText}` `` |
| `AssistantService:1015` | `` `Gagal menghubungi server saat eksekusi skill: ${fetchErr.message}` `` |
| `AssistantService:1021` | `` `⚠️ Skill error HTTP ${response.status}` `` |
| `AssistantService:1410-1412`, `:1471` | `'⚠️ Error: Aliran jawaban terputus…'`, `` `⚠️ Error: ${hasil.galat}` ``, … |
| `ConversationEngine:1424` | `` `⚠️ Error: ${err.message}` `` |
| `ConversationEngine:2127` | `` `⚠️ PDF tidak bisa diunduh: ${err.message}` `` |
| `RiwayatKonversi:41, 76, 86` | `err.message` **apa adanya** |

Akarnya **bukan** "bahasanya kurang ramah". Akarnya: tak ada satu tempat pun yang bertanggung jawab
atas teks yang dibaca manusia, jadi setiap jalur galat baru mengarang lagi dari nol. Menambal
kata-katanya di sebelas tempat akan membuat tempat kedua belas mengarang juga.

### Temuan yang mengubah bentuk pekerjaannya

`request_pipeline.ts:140-158` **sudah** mengirim kalimat Indonesia yang menyebut tindakan:

```json
{ "error": "NO_API_KEY",
  "message": "Aplikasi ini memerlukan API Key Anda sendiri. Buka Settings → AI Provider dan …" }
```

Dan `AssistantService:878` menulis `errorText = errorData.error || errorText` — mengambil **kode
mesinnya**, membuang **kalimat manusianya**. Yang terbaca Owner selama ini: `⚠️ Error: NO_API_KEY`.

Jadi sebagian keterangan yang hilang **tidak pernah perlu ditulis** — ia sudah dikirim, lalu dibuang
satu baris sebelum sampai ke mata. Pola yang sama dengan T11 dan dengan `assistant_audit_log`:
periksa metodenya, bukan cuma hasilnya.

### Yang dikerjakan

Tanggung jawabnya yang dipindah, bukan kata-katanya:

> **LAYANAN** melaporkan APA yang gagal (`{kode, pesan, status, teknis}`) → **LAYAR** memutuskan APA
> yang dibaca manusia.

- **Baru:** `frontend/src/core/runtime/services/pesanGalat.js` — tabel kode (server + internal),
  pencocokan tanda untuk sisanya, dan `blokGalat()` yang menyusun teks gelembung.
- `AssistantService.js`: **11 dari 11** panggilan `onError` kini memancarkan tanda terstruktur. Nol
  yang masih menyusun teks tampilan. Dua jalur `!response.ok` membaca `error` **dan** `message`.
- `ConversationEngine.jsx`: `onError` dan `catch handleSend` menerjemahkan di layar; unduh PDF ikut.
- `RiwayatKonversi.jsx`: tiga jalur galat memakai penerjemah, dan wadahnya diberi
  `whitespace-pre-line` supaya baris `(teknis: …)` benar-benar turun ke bawah.

Empat aturan yang dipakai (ditulis di kepala modul, bukan hanya di sini): sebutkan **tindakan**;
**jangan menebak** bila tandanya tak dikenali; **teks teknis tidak dibuang**; dan **kalimat manusia
dari server dipakai**, bukan kode mesinnya.

Teks gelembungnya **teks biasa, bukan Markdown** — `ConversationEngine:2080` merender isi pesan lewat
`<span className="whitespace-pre-wrap">`, jadi `**tebal**` akan tampil apa adanya. Diuji.

### Kenapa BUKAN salinan dari Mametlite

`mametlite/src/lib/pesanGalat.js` memakai empat aturan yang sama, dan godaan menyalinnya besar.
Tidak dilakukan: kosakata tandanya **berbeda secara sah** — hanya Ecosystem yang punya sesi Supabase,
mode Engineer, aliran hybrid, eksekusi skill, plafon biaya harian, dan pekerjaan konversi; hanya
Mametlite yang punya formulir masuk. Menjadikannya salinan berarti dua berkas yang **harus**
menyimpang dijaga uji yang menuntut sama — aturan yang dicabut orang dalam sepekan
(`uji-catch-diam.mjs:16-21`). Penyatuannya adalah keputusan arsitektur, sebentuk dengan usul ADR M9.

### Bukti

`uji/uji-pesan-galat-ecosystem.mjs` — **LULUS**, 5 bagian: 21 tanda dikenali (bahasa + tindakan +
teknis utuh), aturan 4 dengan kalimat server, empat tanda tak dikenali yang **tidak boleh** menuduh
koneksi/saldo/kunci, bentuk blok gelembung, dan pemeriksaan **kode** bahwa tak ada lagi yang
mengarang teks tampilan.

**Tiga mutasi menggigit** (dipulihkan sesudahnya):

| Mutasi | Yang memerah |
|---|---|
| aturan 4 dicabut (`if (false)`) | *kalimat `message` dipakai apa adanya* |
| pemotongan teks teknis dicabut | *badan galat raksasa dipotong* + *potongannya ditandai* |
| satu panggilan dikembalikan mengarang teks | *SEMUA 11 panggilan onError memakai tanda terstruktur (10)* |

Satu merah pada jalan pertama **bukan temuan**: pola `e.error || errorText` cocok dengan **komentar
saya sendiri** yang menjelaskan cacat lamanya. Kembaran cermin dari `uji-komentar-tak-berbohong`,
yang pernah hijau secara keliru karena kalimat sejarah memuat kata yang dicarinya. Asersinya soal
kode, jadi ujinya kini membuang komentar lebih dulu — `\r` dibuang **sebelum** `//`, karena di
JavaScript `.` tidak cocok dengan `\r` dan berkas repo ini campur CRLF/LF.

---

## Bagian 2 — C10b: pdf.js Ecosystem

### Koreksi atas roadmap, dari kode

§7 menyebut permukaan pdfjs Ecosystem "lebih luas (`tabelCentang.js` pada koordinat pdf.js,
`bacaPdfAsn.js` pada `hitungHalamanPdf`)". Diperiksa:

- `hitungHalamanPdf` memakai **pdf-lib**, bukan pdfjs (`pdfOcrService.js`: `import('pdf-lib')`).
- `tabelCentang.js` **menerima** `getTextContent().items`, tidak memanggil pdfjs sendiri.

Jadi permukaannya lebih **sempit** daripada yang tercatat: **satu** berkas memanggil pdfjs
(`documentTextExtractor.js:411-416`), sisanya hanya menerima hasilnya. Keduanya kini **dijaga uji**,
supaya kalau seseorang memindahkannya ke pdfjs, pelebarannya bersuara — bukan ditemukan lewat audit
berikutnya.

### Yang dikerjakan

`frontend/package.json`: `pdfjs-dist ^5.7.284` → **`^6.4.299`** (terpasang 6.4.299, sama dengan
Mametlite sesudah C10a). **Nol baris kode aplikasi berubah** — `documentTextExtractor.js:233-234`
sudah ditulis untuk v6 saat C10a (`loadingTask.destroy()`, bukan `doc.destroy()` yang hilang di 6).

`package.json` akar: `^5.7.284` → `^6.4.299`. Di sana ia **tak punya pengimpor dan tak terpasang** —
hanya deklarasi yang memunculkan rentang rentan di `npm audit` akar. **Menghapusnya** keputusan
Owner, jadi hanya dinaikkan.

### Bukti

`uji/uji-baca-pdf-ecosystem.mjs`, dijalankan **dua kali** — sebelum bump dan sesudahnya:

| | pdfjs 5.7.284 | pdfjs 6.4.299 |
|---|---|---|
| versi di luar rentang GHSA-hq66-cqwq-w95j | **GAGAL** | LULUS |
| 23 asersi lainnya | LULUS | LULUS |

Satu merah, tepat yang seharusnya. Itu yang membuat hijau sesudahnya berarti sesuatu.

Yang ikut diuji, karena ini bagian yang **tidak akan melempar galat** bila berubah bentuk — kolom
centang hanya mulai salah petak, diam-diam:

- kontrak item pdf.js: `str`, `transform` array 6 angka, `transform[4]/[5]` = x/y yang benar-benar
  digambar (380, 700), `width` angka positif;
- `bacaTabelCentang()` memetakan centang `Ö` (U+00D6 — tanda centang nyata dari buku Kepbup OKU
  jabatan 177, dan satu-satunya yang bisa digambar font standar) ke kolom **Penting**, bukan ke
  kolom sebelahnya.

Ditambah: berkas yang benar-benar diimpor aplikasi ada di tata letak paket 6.x
(`legacy/build/pdf.mjs`, `legacy/build/pdf.worker.min.mjs`), `npm run build` **lulus** dan
`dist/assets/pdf.worker.min-Dkey6ZUl.mjs` (1,3 MB) benar-benar ikut, dan `npm audit --omit=dev`
tidak lagi mendaftarkan `pdfjs-dist`.

Satu merah build pada jalan pertama **cacat saya sendiri, bukan pdfjs**: komentar JSX
`{/* … */}` saya taruh di posisi **ekspresi** di dalam `{pesan && ( … )}`, tempat `{…}` dibaca sebagai
literal objek. Build yang menangkapnya — bukan uji, bukan lint.

### Sisa yang jujur

`npm audit --omit=dev` di `frontend/` masih **17 high** (`electron-updater`, `axios`, `tailwindcss`,
`adm-zip`, …). Itu **E6**, dan urutannya memang paling akhir: tanpa gerbang CI (J3) tak ada yang akan
memberi tahu kalau bump merusak sesuatu. C10b dikerjakan sekarang karena ia **satu paket, satu
pengimpor, dengan uji sebelum-sesudah** — bukan karena batas "dependency paling akhir" dicabut.

---

## Dua merah di suite, keduanya sah, keduanya diperbaiki tanpa dilemahkan

1. **`uji-catch-diam.mjs`** — `catch` diam **94 → 92**: dua blok yang saya tulis ulang kini
   berkomentar, jadi pindah golongan dari DIAM ke diam-berkomentar. Penjaganya menuntut patokan
   **diturunkan** agar tidak berbohong, dan itu memang alurnya
   (`node uji/uji-catch-diam.mjs --perbarui`). Patokan baru: 92 di 47 berkas.

2. **`uji-kiriman-percakapan.mjs:128`** — jendela `slice(onError, +420)` tak lagi memuat
   `simpanTerlantar(` karena penerjemah + komentarnya menggesernya. **Nol penjagaan hilang**;
   jendela seukuran-huruf mengukur **jarak**, bukan keselamatan. Jendela 900, dan ditambah satu
   asersi baru: galatnya **harus** diterjemahkan dulu (`blokGalat(galat)`).

**Suite penuh: 95/95 LULUS**, nol dilewati (93 sebelumnya + 2 berkas uji baru).

---

## Yang TIDAK dikerjakan, dan kenapa

| | Alasan |
|---|---|
| **E1** CSP dicabut di rilis + `webSecurity:false` | Owner **sengaja** mempertahankannya (TMN-0009, load-bearing). Mencabut yang load-bearing tanpa keputusan Owner melanggar aturannya sendiri — tetap diusulkan sebagai ADR |
| `EngineerChat.jsx:152` masih `⚠️ Error: ${err.message}` | **nol pengimpor** (E3). Menyentuhnya hanya menambah kode mati yang rapi. Dijaga uji: bila berkas itu dipakai lagi, ujinya memerah dan menagih penerjemah |
| `Settings.jsx:234` `error:${err.message}` | itu **uji koneksi**, tempat teks penyedia apa adanya justru yang dicari |
| Menghapus `pdfjs-dist` dari `package.json` akar | keputusan Owner, bukan asisten — hanya dinaikkan |
| 17 high lain di `frontend` | **E6**, menunggu gerbang CI (J3) |
| `Kernel.js:63` `identity.version` masih `3.0.0` | **J8**, satu major tertinggal; bukan pengerasan |

---

## Versi & rilis

`frontend/package.json` **4.2.14 → 4.2.15**.

### Koreksi, dan ini kegagalan metode saya sendiri — pelajaran T11 lagi

Saat memutuskan naik versi, saya menulis *"4.2.14 belum pernah dibangun"*. **Salah.** Diperiksa
sesudahnya lewat API GitHub:

| Rilis | `isDraft` | Terbit |
|---|---|---|
| **v4.2.14** | `false` | **2026-10-06 22:36 UTC**, dengan `Mamet-AI-Setup-4.2.14.exe` |
| **v4.2.15** | `true` | `null` — draf, menunggu Owner menekan Publish |

Sumber kesalahannya: `INDEX-ROADMAP.md` §5b berbunyi *"Tiga muatan menunggu build"*, dan saya
memercayainya tanpa memeriksa platform. Klaim itu sendiri sudah basi sejak 6 Okt 22:36 — **dua hari
sebelum saya membacanya**. Persis bentuk T11: *"dihapus dari repo"* dan *"dihapus dari platform"*
adalah dua klaim berbeda, dan di sini *"versi dinaikkan di `package.json`"* dan *"rilisnya terbit"*
juga dua klaim berbeda. Hanya yang pertama bisa dibuktikan dari repo.

**Akibatnya kecil, dan itu kebetulan, bukan karena hati-hati:** naik versi tetap keputusan yang
benar — justru *lebih* benar, karena 4.2.14 sudah terbit dan menimpanya akan mengubah rilis yang
sudah dipegang orang. Kalau arah salahnya kebalikannya (mengira sudah terbit padahal draf), saya
bisa menimpa draf Owner tanpa menyadarinya.

§5b sudah dikoreksi beserta sebab basinya. Yang menunggu sekarang: **draf 4.2.15**. Catatan Owner
menyebut mesinnya menjalankan 4.2.13 — bila masih benar, muatan 4.2.14 pun belum ia lihat meski
rilisnya terbit. **Terbit ≠ terpasang.**

**Peringatan, dan ini J6 yang terbukti:** `build.yml:7-8` memicu build+publish dari **perubahan path
`frontend/package.json`**, bukan dari perubahan versi. Bump `pdfjs-dist` saja sudah cukup
memicunya — persis kasus yang J6 tulis sebagai syarat penutupnya (*"ubah satu dependency → tidak
memicu publish"*). Push ini akan memicu satu build; **Publish tetap manual** (item 96). Daftar draf
tak bisa diperiksa saat ini (`api.github.com` TLS timeout), dan naik versi membuat itu tak perlu
dijawab: draf 4.2.15 baru, tanpa menimpa apa pun.

### Koreksi kedua — dan koreksi KETIGA atas koreksi kedua, karena yang kedua saya ambil terlalu cepat

Owner mengoreksi: *"kan aplikasi mamet ecosystem update otomatis dari github action, dan akan
diterapkan di rilis terbaru."* **Soal pengirimannya otomatis, Owner benar.**

Mula-mula saya menyimpulkan lebih jauh dari itu: bahwa **draf pun terkirim**, jadi tombol Publish
bukan gerbang distribusi. Saya mengukurnya — feed atom publik memuat `4.2.15`, `latest.yml`-nya
terbaca, `.exe`-nya 200 — lalu menulisnya ke item 96, §5b, J6, dan memori.

**Pengukuran itu tak sah, dan saya menemukannya sendiri setengah jam kemudian** saat memeriksa
keadaan 4.2.16 lewat API:

```
v4.2.15  draft=false  published_at=2026-10-08T14:04:59Z
v4.2.16  draft=true   published_at=null
```

4.2.15 **sudah diterbitkan Owner** pukul 14:04:59Z — dua menit sesudah build-nya selesai, dan
**sebelum** saya mengukur. Jadi yang saya ukur adalah rilis **TERBIT**, bukan draf. Saya mengukur
platformnya (benar) tetapi tidak memeriksa keadaannya **pada saat yang sama** (salah) — bentuk yang
sama dengan kekeliruan 4.2.14 di atas, satu lapis lebih dalam, pada hari yang sama.

Yang **benar-benar terbukti**, dan ini pun dari platform: cache pembaru memuat
`ai-agent-frontend-updater/installer.exe` **189.543.735 byte** bertanggal 21:09 WIB — persis ukuran
`Mamet-AI-Setup-4.2.15.exe`, yaitu **4 menit sesudah Publish**. Jadi 4.2.15 memang datang lewat
pembaruan otomatis, **sesudah** diterbitkan. Pembarunya juga terlihat bekerja di log Chromium pada
jalan yang jendelanya putih — ia hidup di proses utama, bukan di renderer yang mati.

Yang **masih menggantung** dan sengaja dibiarkan terbuka: draf 4.2.16 MUNCUL di feed atom publik dan
`latest.yml`-nya 200, tetapi draf lama 4.1.2 (3 aset) tetap 404, dan updater juga menanyakan
`/releases/latest` yang menyingkirkan draf. Satu menit pertama 4.2.16 bahkan 404 — penyebaran, bukan
kebijakan. **Belum terukur bersih**, jadi premis item 96 ditandai *dipertanyakan*, bukan *terbantah*,
dan praktik yang dipakai: **tekan Publish**.

Untuk J6: bobotnya tetap naik, tetapi kalimatnya dikoreksi — satu bump dependency bukan "langsung
terkirim", melainkan **satu tombol dari terkirim**. Diperbaiki di item 96, §5b (tabel platform + dua
catatan), tabel §7 (J6 + baris 4.2.15/4.2.16), dan memori `project-rilis-draf-manual`.

**Belum teruji live** — bukti di atas dari Node, build, dan audit. Yang menunggu `.exe`: gelembung
galat sesungguhnya di ws-assistant, dan satu PDF nyata dibuka di aplikasi terpasang.
