# Tahap 3b — ingatan temuan Engineer, dan tujuh cacat jalur patch yang ditemukan satu tugas

**Tanggal:** 24 September 2026
**Roadmap:** [`ROADMAP-ENGINEER-MANDIRI.md`](../../roadmap/ROADMAP-ENGINEER-MANDIRI.md) Tahap 3b
**Status:** ✅ Tahap 3b selesai & terbukti live · ⚠️ tiga perbaikan terakhir **belum terbukti live**

Satu tugas kecil — *"perbaiki komentar di `engineer.js:1035` agar mencerminkan kenyataan"* — membuka **tujuh
cacat berbeda** di jalur patch Engineer, masing-masing menutupi yang berikutnya. Tugas itu akhirnya selesai.

---

## Bagian 1 — Tahap 3b: ingatan temuan

### Masalah

Setiap chat Engineer mulai dari nol. Memori percakapan sengaja dimatikan di Engineer dan itu benar — tapi
akibatnya Engineer tidak punya catatan **temuan**. Tanpa itu, Engineer otonom (Tahap 1) akan melaporkan
temuan yang sama setiap hari sampai Owner berhenti membacanya.

### Keputusan: berkas markdown di repo, bukan tabel database

Owner tidak menolak rekomendasi ini. Alasannya: Owner bisa membaca **dan mengoreksi** isinya, ia ikut
ter-commit bersama kode yang dibicarakan, dan tidak hilang kalau database dibersihkan. Ongkosnya —
penulisan butuh tindakan Owner — diterima: batas "menulis berkas selalu lewat persetujuan Owner"
(constitution `04_OWNER_SOVEREIGNTY.md`) tidak digeser demi kenyamanan.

### Yang dikerjakan

| Bagian | Berkas |
|---|---|
| Modul murni: ambil blok, kunci pembanding, gabung, tulis/baca markdown, laporan, ringkasan konteks | `engineer/IngatanTemuan.js` (baru) |
| Pemrosesan blok, tombol "Simpan N temuan", suntikan temuan terbuka ke konteks | `ConversationEngine.jsx` |
| RULE 0.2c — bentuk blok `<temuan>` diajarkan ke model | `rag/engineer_context.ts` |
| Catatan temuan | `docs/project-memory/temuan-engineer/TEMUAN-ENGINEER.md` (baru) |

### Empat keputusan rancangan, dengan alasannya

1. **Bentuk eksplisit, prosa tidak ditangkap sama sekali.** Sistem ini sudah tiga kali tertipu karena
   menebak maksud dari teks bebas (trace parser, penanda patch, pemilih profil verifikasi). Kalimat yang
   *terdengar* seperti temuan sengaja dilewatkan — lebih baik terlewat dan terlihat terlewat.
2. **ID diberi mesin, bukan model.** Model tidak melihat berkasnya dan akan mengulang "TMN-0001".
3. **Kunci pembanding sederhana dan bisa dijelaskan** — alamat berkas + ringkasan yang dinormalkan.
   Batasnya ditulis di kode: temuan sama yang ditulis ulang dengan kalimat berbeda **tidak** tertangkap.
   Pencocokan makna akan menangkap lebih banyak, tapi juga akan diam-diam membuang temuan yang berbeda.
   Owner bisa menggabungkan yang kembar; Owner tidak bisa memulihkan yang hilang tanpa jejak.
4. **Larangan mengarang temuan** di RULE 0.2c: *"sesi tanpa temuan adalah sesi yang normal dan baik."*
   Tanpa itu, blok wajib berubah jadi mesin temuan palsu dan daftarnya jadi sampah dalam seminggu.

### Bukti live

Engineer menulis blok `<temuan>` sendiri, mesin memberi nomor, laporan pembanding muncul, Owner menekan
tombol, berkas lahir di repo:

```
docs/project-memory/temuan-engineer/TEMUAN-ENGINEER.md   09:02
**1 terbuka · 0 ditutup**
## TMN-0001 — TERBUKA
- Berkas:  frontend/src/core/runtime/services/engineer.js
- Bukti:   git grep -n "generateFallbackPatch" → 2 baris komentar, tidak ada definisi
```

Yang meyakinkan bukan hanya temuan itu muncul, melainkan Engineer **memilah**: ia memeriksa
`PatchGenerator.js:454`, menilainya catatan riwayat yang sah, dan **menolak menjadikannya temuan**.

### Cacat saya sendiri di fitur ini

| Cacat | Sebab | Perbaikan |
|---|---|---|
| Tombol "Simpan temuan" tidak muncul di percakapan lanjutan | `temuanBelumSimpan` adalah `useState` yang hanya diisi bila pesan **terakhir** memuat blok; state juga hilang tiap muat ulang | diturunkan dengan `useMemo` dari **seluruh** pesan dibanding catatan di repo |
| Owner mencari tombolnya di dalam chat | petunjuk saya menyebut tindakan tanpa menyebut tempat | laporan kini menyebut **"di bilah atas, sebelah meteran konteks"**, dan ada uji yang mengikat namanya dengan tulisan di tombol |

Uji `uji-temuan-terpasang.mjs` v1 **lulus sementara fiturnya tidak bekerja di layar** — ia memeriksa
"tombol ada", bukan **dari mana daftarnya berasal**. Diganti v2 yang menjalankan perhitungannya sungguhan
terhadap percakapan tiruan berbentuk live.

---

## Bagian 2 — Tujuh cacat jalur patch

Urut sesuai ditemukannya. Tiap sebab hanya terlihat sesudah sebab sebelumnya diperbaiki.

### 1. `trace_parser` membelah patch JSON

Komentar yang hendak diperbaiki **berisi teks `[ADR-0017 Fase 7]`**. Potongan `ADR-0017` cocok dengan
`formatRegex` pengenal kutipan sumber, jadi pemotongan jatuh di tengah patch JSON: sisa 112 huruf dengan
`{`=3, `}`=0 → `CHECK_P02` gagal → HARD GATE memblokir patch yang isinya benar.

Penjaga 23 September hanya mencegah jawaban jadi **kosong**; jawaban **terpotong** lolos.

**Perbaikan:** dua penjaga. (a) baris di dalam pagar kode ``` tidak pernah dianggap trace; (b) pemotongan
yang meninggalkan kurung terbuka bukan pemotongan trace.

**Koreksi atas dugaan saya:** sesudah putaran pertama saya menyimpulkan sebabnya "ID di dalam pagar kode"
dan memasang aturan (a). Putaran kedua gagal dengan **angka yang sama persis**. Sebabnya bukan itu —
`PatchGenerator` meminta model menulis patch sebagai **JSON telanjang tanpa pagar**, jadi aturan (a)
tidak pernah menyentuh kasus ini. Aturan (b) yang menyelesaikannya. Aturan (a) tetap benar untuk kasusnya
sendiri. Terbukti live: `PATCH_ENGINEERING | Decision: PASS | Score: 100` (01:51:50).

### 2. Bentuk `files[]` dilewati diam-diam

Prompt meminta bentuk berkunci-alamat; model menjawab `{"files":[{path,changes}]}`. Isinya identik dan
sah, hanya bungkusnya beda. `Object.entries` melihat kunci `"files"` bernilai array, lalu melewatinya
tanpa bersuara. Pesan gagalnya jatuh ke `patch.description` — yang kebetulan berisi **kalimat perintah
Owner**, sehingga Owner melihat perintahnya sendiri sebagai "alasan".

**Perbaikan:** `bakukanBentukPatch()`. Bukan menebak maksud dari prosa — keduanya JSON eksplisit dengan
field yang sama. Bentuk yang tidak dikenali sengaja **tidak** diterka; dibiarkan gagal terang.
Terbukti live: kunci JSON berikutnya sudah `["frontend/src/…/engineer.js"]`.

### 3. CRLF melawan `\n` pada cari-ganti multi-baris

Berkas repo ini tersimpan **CRLF** (`file engineer.js` → "with CRLF line terminators"; git pun
memperingatkan "LF will be replaced by CRLF" pada commit `d548881`). Model menulis `search` sebagai string
JSON dengan `\n`, jadi `includes()` gagal untuk **setiap** cari-ganti lintas baris — selalu, di seluruh
repo ini.

Sulit terlihat karena **cari-ganti satu baris selalu bekerja**, bahkan sebelum perbaikan.

**Perbaikan:** pencocokan dalam LF, hasilnya **dikembalikan ke CRLF** bila berkas aslinya CRLF. Tanpa
pengembalian itu, satu perbaikan komentar akan menulis ulang akhir baris seluruh berkas.

### 4. Pemeriksa aturan diblokir oleh aturannya sendiri

`verifyPatchEngineering` memindai **seluruh isi berkas** hasil patch dengan `includes('eval(')`.
`engineer.js` memuat `eval(` dan `new Function(` di baris 928 — **di dalam pemeriksa aturan MAEF-nya
sendiri**, kode yang tugasnya mendeteksi keduanya. Jadi pemeriksa itu memblokir berkas yang memuat
dirinya. Dua "masalah kritis" yang dilaporkan **dua-duanya palsu**.

Akibatnya lebih luas dari satu tugas: berkas apa pun yang sekadar **menyebut** pola itu — termasuk di
komentar — tidak akan pernah bisa di-patch.

**Perbaikan:** yang dinilai **penambahan**, bukan keberadaan. Jumlah kemunculan di isi baru dibanding isi
asli. Pagar tidak melemah — tiga uji kendali membuktikan penambahan sungguhan tetap diblokir, dan tanpa
isi asli perilakunya kembali ketat.

**Ikut ketemu:** pemeriksa vendor API **tidak pernah menyala sama sekali** — polanya
`fetch(['"]https://…` tak pernah cocok karena isi berkas sudah dibungkus `JSON.stringify`, jadi tanda
kutipnya ber-backslash. Ditemukan oleh uji, bukan oleh pengamatan.

### 5–7. Laporan hasil patch tidak sampai

Patch **berhasil diterapkan** (terbukti di disk), spanduk checkpoint muncul, tetapi pesan
"✅ Patch diterapkan" tidak ada. `chats` tersimpan terakhir 09:19:21, checkpoint 09:19:47 — dan nol pesan
berpenanda `isPatchResult`. Owner hanya melihat "Melanjutkan ke pembuatan patch…" lalu sunyi, padahal
pekerjaannya selesai.

Tiga sebab bertumpuk:

| # | Sebab | Perbaikan |
|---|---|---|
| 5 | Penjaga memakai workspace yang sedang **tampil** (`activeWorkspaceId`), bernilai sama di ketiga instance chat — instance Assistant ikut berebut catatan patch dan yang menang **menghapusnya** | penjaga per-instance (`osState.workspaceId`), sama seperti perbaikan kebocoran peristiwa 23 September yang **melewatkan titik ini** |
| 6 | Laporan ditempel **sekali lalu dilupakan**; pemulihan berikutnya mengganti seluruh daftar pesan dengan salinan database yang belum memuatnya. Spanduk selamat karena ia state terpisah — itu sebabnya gejalanya tampak ganjil | laporan **dipastikan ada**; selama belum terlihat, dipasang lagi. Penandanya `patchId`, jadi tidak pernah dobel |
| 7 | Catatan patch dihapus di **baris pertama** `laporanSetelahMuatUlang` — sekali pakai. Begitu laporannya tertimpa, muat ulang berikutnya kehilangan pesan **dan** tombol Undo | catatan dibiarkan sampai laporannya terbukti ada di layar, baru dibuang. Pengaman tetap: usia maksimum 15 menit, catatan basi selalu dibuang |

**Yang harus saya akui:** tiga kali berturut-turut saya memperbaiki gejala di lapisan yang terlalu dangkal.
Pertanyaan yang seharusnya saya ajukan lebih awal bukan *"kenapa pesannya hilang"* melainkan *"apa yang
menjamin pesan itu sampai"*. Jawabannya waktu itu: tidak ada.

---

## Tugasnya selesai

Engineer menyelesaikan tugas perbaikan kode pertamanya lewat jalur penuh — analisis → konfirmasi → patch →
checkpoint → terapkan:

```diff
- // [ADR-0017 Fase 7] _generatePatch, _buildPatchPrompt, _extractCodeFromResponse,
- // _generateFallbackPatch diekstrak ke ./engineer/PatchGenerator.js. §2.1 (Scoped
+ // [ADR-0017 Fase 7] _generatePatch, _buildPatchPrompt, _extractCodeFromResponse
+ // diekstrak ke ./engineer/PatchGenerator.js; _generateFallbackPatch dihapus total (T10,
+ // 2026-09-22) karena tidak lagi diperlukan. §2.1 (Scoped Snippet Extraction)
```

Berkasnya **tetap CRLF** dan diff-nya hanya menyentuh baris komentar itu — dua bukti bahwa perbaikan
nomor 3 bekerja dengan benar. Perubahan ini ikut di-commit sebagai hasil kerja Engineer.

## Akar pemicu yang disadari: muat ulang di mode pengembangan

Vite memantau `frontend/src`. Saat Engineer mem-patch berkas **di dalamnya**, halaman dimuat ulang
sebelum laporannya sempat tampil. Tiga dari tujuh cacat di atas adalah **penyangga untuk masalah yang
tidak ada di aplikasi terpasang**.

Ini hanya terjadi saat Mamet mem-patch **dirinya sendiri**. Kesimpulannya dicatat sebagai alasan
menaikkan prioritas Tahap 5.

## Belum terbukti live

- perbaikan CRLF **terbukti** (patch diterapkan), tetapi perbaikan laporan (nomor 5–7) **belum**;
- dedup temuan di chat baru (TMN-0001 harus muncul sebagai "sudah pernah dilaporkan") **belum diuji**;
- perbaikan `judge_endpoint` kemarin masih menunggu konflik memori yang memicunya.

## Uji otomatis (di luar git)

| Berkas | Isi |
|---|---|
| `uji-ingatan-temuan.mjs` **47/47** | pembuktian dua janji Tahap 3b, bolak-balik markdown, kunci dedup bertahan melewati restart |
| `uji-temuan-terpasang-v2.mjs` **16/16** | menggantikan v1 yang lulus padahal fiturnya tak bekerja |
| `uji-petunjuk-tombol-temuan.mjs` **7/7** | nama tombol di petunjuk terikat dengan tulisan di tombolnya |
| `uji-trace-kurung-terbuka.mjs` **17/17** | kendalinya menghasilkan `{=3 }=0` — angka yang sama dengan log live |
| `uji-bentuk-patch.mjs` **20/20** | enam uji kendali; bentuk asing tidak diterka |
| `uji-patch-crlf.mjs` **21/21** | termasuk kendali "satu baris selalu bekerja" — sebab cacat ini lolos lama |
| `uji-verifikasi-penambahan.mjs` **17/17** | bukti langsung dari `engineer.js` |
| `uji-laporan-patch-bertahan.mjs` v2 **27/27** | menjalankan `CatatanPatch.js` sungguhan dengan penyimpanan tiruan |

`uji-pemulihan-chat` naik ke **v5** (dua asersi masih mengunci pola lama). Seluruh **48 berkas uji lulus**.
Karakter kendali: 0.
