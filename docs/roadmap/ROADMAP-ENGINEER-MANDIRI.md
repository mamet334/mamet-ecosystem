# ROADMAP — Engineer Mandiri (self-maintenance)

**Dibuat:** 23 September 2026 · **Status:** 🟡 Tahap 2 ✅ · Tahap 3a ✅ · Tahap 3b ✅ (ingatan temuan, live
24 September) · **Tahap 5 ✅ terbukti live 28 September** · **Tahap 6 ✅ terbukti live 1 Oktober**
(verifikasi patch yang dijalankan — terbukti dua arah: menolak yang merusak, meloloskan yang benar).
Sisa: Tahap 1 dan Tahap 4

Lanjutan dari T10 di [`ROADMAP-TEMUAN-TERBUKA.md`](./ROADMAP-TEMUAN-TERBUKA.md). Dasar rancangan ini adalah hasil uji
Engineer 22–23 September 2026 (TUGAS-01..04), bukan perkiraan.

**Hubungan dengan [`engineer-autonomous-mode.md`](./engineer-autonomous-mode.md) (Agustus 2026, ✅ selesai):** dokumen
itu membangun **markernya** — `[MAMET_CMD:]`, `[MAMET_CRITICAL:]`, `[MAMET_PATCH_READY]`, dan umpan balik keluaran
terminal ke model. Semua itu masih dipakai dan tidak dibangun ulang di sini. Yang belum ada di sana: satu tugas masih
butuh satu klik Owner **per perintah**, klaim Engineer tidak diuji mesin, dan tidak ada ingatan temuan antar sesi.
Tiga hal itulah isi rancangan ini.

---

## Tujuan

Engineer bekerja seperti pemelihara sistem yang sabar: **menemukan pembusukan diam-diam di Mamet, membuktikannya,
lalu mengusulkan perbaikan** — tanpa Owner harus menuntun tiap langkah, dan tanpa Owner kehilangan kendali atas
apa pun yang ditulis ke disk.

Bukan menulis fitur baru. Pekerjaan yang dituju adalah yang tidak pernah sempat dikerjakan manusia:

- komentar & dokumen yang menyebut hal yang sudah dihapus (terbukti nyata: TUGAS-01 `SkillGuardService`, TUGAS-02
  `AuditLogService` — keduanya menyebut `CommandRegistry` yang dihapus 22 September);
- kode yatim (`logCommand` terbukti hanya punya definisi, tanpa satu pun pemanggil);
- roadmap/ADR yang tidak lagi cocok dengan kode;
- berkas uji yang tidak pernah dijalankan siapa pun sejak ditulis;
- galat baru di `agent_logs`, label yang diturunkan, kuota database yang naik aneh.

## Apa yang sudah ada (jangan dibangun ulang)

| Sudah ada | Berkas |
|---|---|
| Perintah tanpa shell + daftar izin program + profil peran | `frontend/electron/alatFolderJalan.cjs` |
| Dialog izin Owner (bawaan Tolak) + pratinjau isi skrip | idem, `main.cjs` `engineer:jalankan` |
| Prosedur kerja 12 langkah + RULE 0 + 3 penjaga | `constitution/28_PROSEDUR_KERJA_ENGINEER.md`, `engineer_context.ts`, `engineer/ProsedurEngineer.js` |
| Jalur patch berpagar: checkpoint wajib, CORE IMMUTABLE diblokir | `engineer/PatchApplier.js`, `CapabilityGuard.js` |
| Label & bukti: keluaran perintah kini sumber sah | `label_sumber.ts`, `sumberDariKeluaranTerminal` |
| RAG khusus space "Pengetahuan Engineer" | `routing_decider.ts`, `context_builder.ts` |

## Batas yang tidak digeser

1. **Menulis berkas selalu lewat persetujuan Owner.** Otonomi berhenti di garis tulis, bukan di garis baca.
   (constitution `04_OWNER_SOVEREIGNTY.md`)
2. **CORE IMMUTABLE tidak pernah di-patch.**
3. **Tidak ada pemasangan paket, tidak ada `git` tulis, tidak ada push.**
4. **Klaim tanpa bukti mesin tidak dihitung.** Otonomi tanpa verifikasi lebih buruk daripada tidak ada otonomi.

---

## Tahap 1 — Lingkaran baca-saja dengan anggaran

**Masalah:** Engineer berhenti di setiap langkah menunggu klik. Live TUGAS-04 butuh 3 klik hanya untuk sampai ke
analisis; pekerjaan pemeliharaan harian bisa butuh puluhan.

**Rancangan:** satu tugas boleh menjalankan beberapa perintah **baca-saja** berturut-turut tanpa dialog, dalam
anggaran yang tegas:

- hanya program & sub-perintah baca (git status/log/diff/show/grep/ls-files, `node`/`python` skrip baca);
- **berhenti otomatis** saat perintah tampak menulis (penanda yang sudah dipakai dialog sekarang), memasang paket,
  menyentuh alamat di luar repo, atau melewati anggaran;
- anggaran: maksimal N perintah dan M detik per tugas (usul awal: 12 perintah, 180 detik total);
- seluruh perintah + keluarannya masuk ke jejak yang dilihat Owner, bukan hilang di balik layar;
- Owner tetap bisa menghentikan kapan saja.

**Cara uji:** tugas yang butuh 3 perintah selesai tanpa klik; perintah menulis dalam rangkaian itu **menghentikan**
lingkaran dan memunculkan dialog; anggaran habis → berhenti dengan laporan jujur, bukan diam.

## Tahap 2 — Mesin uji untuk klaim Engineer ✅ SELESAI (23 September 2026)

**Masalah:** klaim Engineer hari ini hanya terbukti karena **saya** menjalankan `detectIntent` pada tiap kalimatnya
(7/7 lalu 11/12). Tanpa itu, tidak ada yang tahu mana yang benar.

**Rancangan:** Engineer menulis klaimnya dalam bentuk yang bisa dijalankan — misalnya tabel "masukan → hasil yang
diklaim" — dan sistem menjalankannya sendiri terhadap kode nyata, lalu menempelkan hasilnya di bawah jawaban:
`9/12 klaim terbukti, 3 meleset (…)`. Klaim yang meleset tidak menghapus jawaban; ia ditandai.

**Kenapa ini sebelum otonomi penuh:** ini satu-satunya hal yang membuat pekerjaan tanpa pengawasan bisa dipercaya.

**Hasil live 23 September:** Engineer menulis blok klaimnya sendiri; mesin melaporkan **5/10 terbukti**,
dan kelima yang meleset saya verifikasi ulang — memang meleset. Saat klaim serupa ditulis sebagai prosa dan
diperiksa manual, ketepatannya tampak 14/16. Mesin ini mengubah gambarannya seluruhnya —
[log](../project-memory/changelog/2026-09-23-mesin-uji-klaim-engineer.md).

**Cara uji:** tanam sengaja satu klaim salah → sistem harus menandainya; klaim yang benar tidak boleh ditandai salah.

## Tahap 3a — Jendela konteks per percakapan ✅ SELESAI (23 September 2026)

**Masalah:** yang dikirim ke model hanya 10 pesan terakhir (`history.slice(-10)`), jadi konteks bukan percakapan
melainkan jendela geser — pada tugas panjang Engineer kehilangan benang merah.

**Hasil:** percakapan = konteks, dibatasi anggaran token dari batas biaya harian Owner (5% sisa per pesan);
meteran per percakapan di Assistant & Engineer; "Bersihkan konteks" menggeser batas TANPA menghapus pesan.
Sekalian: peristiwa Engineer tidak lagi bocor ke chat Assistant/Lite, dan 8 baris chat berlabel salah dipindah —
[log](../project-memory/changelog/2026-09-23-jendela-konteks-per-percakapan.md).

**Sisa Tahap 3a ✅ ditutup 24 September 2026** — [log](../project-memory/changelog/2026-09-24-batas-jendela-model-dan-padatkan.md):

- **Batas jendela model** kini ikut dihitung. Kolom `model_pricing.context_length` diisi dari katalog
  OpenRouter live; anggaran dipotong ke 60% jendela. Ini menutup cacat nyata, bukan pencegahan: pada
  batas $3/hari, `gpt-4o-mini` menghasilkan anggaran 1.000.000 token melawan jendela 128.000 dan
  `llama-3.1-8b` 3.000.000 melawan 131.072. Model yang jendelanya belum diketahui dibiarkan `NULL` dan
  jatuh ke perilaku lama — bukan diisi tebakan (Item 42).
- **Tombol "Padatkan"** selesai: pesan lama diringkas jadi satu pesan yang TETAP dikirim, batas konteks
  digeser ke ringkasan itu. Tiga putaran live, hemat 91–92%, pesan lama tetap utuh di layar dan di
  database. Peringkasannya berjalan di `agent-process` (bukan panggilan langsung dari klien) supaya
  biayanya tercatat.
- **Ikut ketemu & ditutup:** biaya panggilan model di endpoint samping (`padatkan`, `judge`) tidak
  masuk ke `api_usage` — tabel yang justru dipakai menghitung anggaran jendela konteks.

**Yang masih tersisa:** jumlah token di `api_usage` masih perkiraan `panjang/4` (biayanya sudah benar,
jadi batas harian tidak terpengaruh); perbaikan `judge_endpoint.ts` belum terbukti live karena belum ada
konflik memori yang memicunya sejak deploy.

## Tahap 3b — Ingatan kerja Engineer ✅ SELESAI (24 September 2026)

**Masalah:** setiap chat mulai dari nol. Memory sengaja dimatikan di Engineer, dan itu benar untuk memori percakapan
— tapi Engineer tidak punya catatan **temuan**.

**Hasil:** temuan ditulis Engineer dalam blok eksplisit `<temuan>` (prosa sengaja TIDAK ditangkap), dibandingkan
dengan catatan di repo, lalu ditulis ke `docs/project-memory/temuan-engineer/TEMUAN-ENGINEER.md` **atas klik Owner**
— batas "menulis berkas selalu lewat persetujuan Owner" tidak digeser. Temuan terbuka dibawa ke tiap kiriman
Engineer dengan instruksi tegas untuk tidak melaporkannya ulang. ID diberi mesin, bukan model.
Terbukti live: TMN-0001 lahir dari pemeriksaan nyata, dan Engineer **memilah** — ia menolak menjadikan komentar
`PatchGenerator.js:454` sebagai temuan karena menilainya catatan riwayat yang sah.
[log](../project-memory/changelog/2026-09-24-tahap3b-ingatan-temuan-dan-tujuh-cacat-jalur-patch.md).

**Batas yang disadari & ditulis di kode:** kunci pembanding memakai alamat berkas + ringkasan yang dinormalkan,
jadi temuan sama yang ditulis ulang dengan kalimat berbeda tidak tertangkap. Pencocokan makna akan menangkap lebih
banyak tapi juga membuang temuan berbeda secara senyap — Owner bisa menggabungkan yang kembar, tidak bisa
memulihkan yang hilang tanpa jejak.

**Belum diuji:** dedup di chat baru (TMN-0001 harus muncul sebagai "sudah pernah dilaporkan").

**Cara uji:** temuan yang sama tidak dilaporkan dua kali; setelah Owner menutup satu temuan, Engineer tidak
mengangkatnya lagi tanpa bukti baru.

## Tahap 4 — Antrean kerja & laporan berkala

**Rancangan:** temuan menjadi antrean yang bisa Owner baca sekali sehari — masing-masing dengan bukti (perintah apa
yang membuktikannya), berkas terdampak, dan tingkat risiko. Yang remeh dan terbukti → usulan patch kecil. Yang
menyangkut arsitektur → laporan, bukan patch.

**Cara uji:** satu putaran pemeliharaan menghasilkan antrean yang setiap barisnya bisa ditelusuri ke perintah nyata.

## Tahap 5 — Engineer bisa dipakai dari aplikasi terpasang

**Masalah (terbukti 23 September):** di build `npm run dist`, `PROJECT_ROOT` menunjuk folder instalasi — `git` gagal
"not a git repository", dan patch akan menulis ke folder instalasi. Setelan & riwayat juga terpisah antara
`mamet://app` dan `http://localhost:5173`, yang sempat membuat uji banding model tidak sah tanpa disadari.

**Rancangan:** akar repo dipilih Owner sekali lalu disimpan; bila belum dipilih, alat repo Engineer dimatikan dengan
pesan jelas — bukan gagal dengan galat git yang membingungkan.

**Cara uji:** di aplikasi terpasang, `git status` Engineer menunjuk repo yang Owner pilih; tanpa pilihan, alatnya
tidak aktif dan alasannya tertulis.

**Ditambahkan 24 September setelah pertanyaan Owner "apakah folder instalasi bisa jadi folder git?":**
TIDAK BOLEH, dan aplikasi harus **menolaknya**. Paketnya NSIS dengan `allowToChangeInstallationDirectory`;
uninstall menghapus folder instalasi — repo beserta seluruh riwayat git ikut terhapus. Update juga menimpa
berkas aplikasi sehingga git melihat ribuan perubahan yang bukan pekerjaan Owner. Maka tiga tempat dipisah tegas:

| Tempat | Isi | Nasib saat uninstall/update |
|---|---|---|
| Folder instalasi | kode aplikasi terbundel | dihapus / ditimpa |
| `%APPDATA%\Mamet AI` | setelan, kunci, checkpoint | selamat |
| Repo pilihan Owner | milik Owner; aplikasi hanya menyimpan ALAMATNYA | tidak tersentuh |

Dua penjaga wajib: akar repo yang berada **di dalam folder instalasi ditolak**, dan folder pilihan Owner harus
terbukti repo git (ada `.git`) sebelum diterima.

**Di laptop lain tanpa repo:** tidak ada yang bisa dipelihara, dan itu wajar — Engineer alat pemelihara, bukan
wadah yang membawa repo. Owner `git clone` dulu lalu menunjuk foldernya. Mamet meng-clone sendiri adalah
kemampuan baru yang menembus batas "tidak ada `git` tulis" dan butuh keputusan Owner tersendiri. Tanpa repo,
yang tersisa hanya mode baca-saja lewat GitHub API (`RepositoryReaderService`) — tanpa perintah, tanpa tulis,
tanpa checkpoint. Catatan tambahan: mem-patch di laptop lain pun tidak membuat Mamet di sana ikut berubah,
karena membangun ulang butuh Node + `node_modules`.

**Alasan menaikkan prioritas (24 September):** tiga dari tujuh cacat jalur patch hari itu adalah penyangga
untuk muat ulang Vite — masalah yang **tidak ada** di aplikasi terpasang. Menjalankan Tahap 1 (lingkaran otonom)
di mode yang memuat ulang tiap berkas tersentuh berarti menumpuk lapisan penyangga baru di atas yang sudah ada.

---

## Tahap 6 — Verifikasi patch yang DIJALANKAN, bukan dicocokkan ✅ TERBUKTI LIVE 1 Oktober 2026

> **Keadaan:** terbukti live **dua arah** di aplikasi terpasang v4.2.2.
>
> | Arah | Bukti (1 Oktober 2026) |
> |---|---|
> | **Menolak** patch yang merusak | patch perusak dikembalikan sendiri dalam 18,3 detik; laporan menyebut `uji-panel-pembaruan.mjs` beserta keluarannya; `git status` bersih kembali |
> | **Meloloskan** patch yang benar | 61/61 lulus dalam 21,7 detik; berkas **tetap berubah** di disk; checkpoint & tombol Undo tersedia |
>
> Arah kedua itu uji **kendali**: tanpa ia, penjaga yang menolak segalanya akan terlihat sama berhasilnya.
>
> Uji kendali itu sekaligus memunculkan cacat ketiga — dua spanduk untuk satu patch, yang kedua
> membantah laporan verifikasi yang pertama. Diperbaiki dan **terbukti live di 4.2.3** — satu patch
> kini menghasilkan satu spanduk, 62/62 lulus, berkas tetap berubah (uji kendali kedua); lihat
> [changelog 1 Okt](../project-memory/changelog/2026-10-01-spanduk-patch-tunggal.md).
>
> Rancangan di bawah adalah rancangan yang disetujui 24 September; **tiga hal berubah saat dikerjakan**,
> ditulis di bagian "Yang berubah saat dikerjakan" di akhir bab ini.


**Masalah.** Ada tiga lapis verifikasi, dan 24 September ketiganya menunjukkan wataknya sekaligus:

| Lapis | Cara kerja | Hasil hari itu |
|---|---|---|
| Verifikasi Supabase (CHECK_P01–P05) | cocokkan pola pada teks | memblokir patch yang **benar**, dua kali |
| Verifikasi lokal (`Kernel.js`) | cocokkan pola pada teks | **dua pelanggaran palsu** |
| Mesin uji klaim (`<uji_klaim>`, Tahap 2) | **menjalankan kode sungguhan** | tidak ikut berperan di jalur patch |

Dua lapis pertama salah dengan cara yang sama karena bekerja dengan cara yang sama: menebak dari **bentuk teks**,
bukan memeriksa dari **perilaku**. `includes('eval(')` menandai berkas yang sekadar menyebutnya; `formatRegex`
memotong patch JSON karena di dalamnya ada "ADR-0017". Lapis ketiga — satu-satunya yang menjalankan kode — justru
absen, padahal ia yang menghasilkan satu-satunya angka yang tak terbantahkan hari itu (5/10 klaim terbukti).

**Ongkosnya sudah diukur, bukan diperkirakan (24 September):**

```
43 berkas uji · total 26,7 detik · rata-rata 619 ms per berkas
```

Lebih murah daripada **satu** panggilan model (10–30 detik, berbayar), dan tidak memakai saldo Owner sama sekali.
Angka ini menghapus masalah rancangan yang paling sulit: **pemetaan berkas → berkas uji tidak perlu dibuat.**
Jalankan semuanya. Pemetaan yang salah justru berbahaya — ia melewatkan uji yang seharusnya menangkap.

**Rancangan — hampir seluruh bagiannya sudah terpasang:**

```
1. Checkpoint dibuat              ← SUDAH WAJIB hari ini (PatchApplier)
2. Patch diterapkan ke disk       ← sudah ada
3. Seluruh berkas uji dijalankan  ← mesinnya sudah ada (engineer:uji-klaim
                                     memanggil node di proses terpisah, env bersih)
4a. Semua lulus  → laporkan; tombol Undo tetap tersedia
4b. Ada yang gagal → PULIHKAN OTOMATIS dari checkpoint, lalu laporkan uji mana
                     yang gagal BESERTA keluarannya
```

Yang memungkinkannya: checkpoint sudah wajib sebelum menulis. Jadi patch bisa **diterapkan dulu lalu diputuskan**,
bukan ditebak sebelum diterapkan. Pertanyaannya berubah dari *"apakah patch ini tampak aman"* menjadi
*"apakah sistem ini masih benar sesudah patch"*.

Langkah 4b sekaligus menjalankan PRINSIP DASAR (a) di `constitution/28`: kegagalan yang **menyebut namanya
sendiri**. Bukan "2 masalah kritis", melainkan "`uji-patch-crlf.mjs` gagal, keluarannya begini".

**BERGANTUNG PADA TAHAP 5.** Di `npm run desktop`, langkah 2 menulis berkas → Vite memuat ulang halaman →
proses yang menjalankan uji kehilangan tempat bergantungnya, persis seperti laporan patch yang hilang
24 September. Mengerjakan Tahap 6 lebih dulu berarti membangun lapisan penyangga keempat untuk masalah yang
sama. Di aplikasi terpasang, langkah 1–4 berjalan tanpa gangguan.

**Batas yang jujur — harus tertulis supaya tidak dijanjikan berlebihan:**

- Berkas tanpa uji tetap tak terjaga. 43 berkas uji tidak menutupi seluruh repo.
- Yang dijanjikan hanya: **patch tidak merusak yang sudah terbukti.** Bukan: patch ini benar. Komentar yang
  diperbaiki Engineer 24 September tidak diuji berkas uji mana pun.
- **Uji kita sendiri bisa salah** — dua kali dalam satu hari uji lulus padahal fiturnya rusak
  (`uji-temuan-terpasang` v1, `uji-padatkan-biaya` v1). Verifikasi yang dijalankan hanya sekuat uji yang
  menjalankannya. Karena itu langkah 8 (uji harus bisa gagal + uji kendali) tetap berlaku penuh.

**Cara uji:** tanam sengaja satu patch yang merusak berkas beruji → uji gagal → berkas **kembali sendiri** ke isi
sebelum patch, dan laporannya menyebut berkas uji serta keluarannya. Kendali: patch yang benar tidak dipulihkan.

### PRASYARAT — uji yang MENIRU kode tidak boleh dihitung sebagai bukti keselamatan

Ditemukan saat mengukur suite, 24 September. Dari 676 asersi, hanya **7%** yang sekadar mencocokkan teks sumber —
jadi suite ini **tidak** didominasi uji struktural. Tetapi ada kategori ketiga yang lebih halus dan lebih berbahaya.

Bila logika berada di dalam komponen React atau di tengah fungsi panjang, ia tidak bisa diimpor. Jalan pintas yang
dipakai berulang kali hari itu: **menyalin logikanya ke dalam berkas uji**, lalu menguji salinannya.

```
uji-patch-crlf.mjs            → const jalankan = (…) => { … }        (tiruan jalur cari-ganti)
uji-temuan-terpasang-v2.mjs   → const hitungBelumSimpan = (…) => { … } ("tiruan useMemo")
uji-laporan-patch-bertahan.mjs→ const pasang = (…) => { … }           (tiruan effect penempelan)
```

Tiga berkas, semuanya ditulis 24 September, semuanya menguji **cermin** — bukan bendanya. Kalau kode aslinya
berubah dan cerminnya tidak, ujinya **tetap hijau**: ia hanya membuktikan cermin itu konsisten dengan dirinya
sendiri. Akarnya sama dengan dua uji yang gagal hari itu (`uji-temuan-terpasang` v1, `uji-padatkan-biaya` v1):
menguji "apakah kodenya tampak benar", bukan "apakah kodenya bekerja".

**Kenapa ini prasyarat, bukan catatan kecil:** Tahap 6 menjalankan suite untuk memutuskan patch selamat. Uji cermin
akan memberi rasa aman palsu **dengan wibawa mesin** — jauh lebih meyakinkan daripada rasa aman palsu hari ini,
karena angkanya terlihat objektif. Owner: *"ini berbahaya karena memberikan rasa aman palsu."*

**Yang harus dilakukan sebelum Tahap 6 dipercaya:**

1. Uji yang meniru logika **ditandai** dan tidak dihitung sebagai bukti keselamatan patch. Bukan dihapus — untuk
   kode di dalam komponen React ia kadang satu-satunya cara — tetapi jujur tentang apa yang ia buktikan.
2. Bila ada usahanya: **pindahkan logikanya keluar dari komponen** supaya bisa diimpor. Pola ini sudah terbukti di
   `pemulihanChat.js`, `KonteksChat.js`, `IngatanTemuan.js` — ketiganya diuji sungguhan, bukan ditiru. Masalahnya
   bukan polanya belum ada, melainkan ia ditinggalkan saat terburu-buru.

**Dikerjakan 28 September:** ketiga berkas diberi penanda `UJI-CERMIN:` yang menyebutkan apa yang ia buktikan dan
apa yang tidak. Penanda itu **dibaca mesin** — `uji/jalankan-semua.mjs` mengumpulkannya, dan angkanya masuk ke
laporan verifikasi **juga saat semuanya hijau**, sehingga "51/51 lulus" tidak pernah berarti lebih daripada yang
sungguh dibuktikan. Nomor 2 (memindahkan logikanya keluar dari komponen) **belum** dikerjakan; itu pekerjaan
tersendiri per berkas, dan penandanya membuat utang itu terlihat, bukan hilang.

---

### Yang berubah saat dikerjakan (28 September 2026)

Tiga hal, semuanya ditemukan dari kode atau dari menjalankannya — bukan dari memperkirakan.

**1. Rancangan langkah 4b akan memulihkan patch yang BENAR.** Bunyinya *"ada uji gagal → pulihkan"*. Tetapi suite
ini tidak selalu hijau sebelum patch: `uji-folder-label` merah diam-diam **empat hari** (24–28 September) karena
folder di luar repo berganti nama. Satu uji yang sudah merah akan memulihkan setiap patch yang benar, selamanya,
dengan alasan yang terdengar meyakinkan. Menjalankan suite dua kali (sebelum + sesudah) menggandakan ongkos jadi
±34 detik. Yang dipakai lebih murah dan lebih jujur:

```
ada yang gagal → pulihkan dari checkpoint
               → jalankan ULANG hanya berkas yang gagal tadi
                 masih gagal → sudah rusak SEBELUM patch. Dikatakan begitu.
                 kini lulus  → patch ini penyebabnya. Dikatakan begitu.
```

Ongkos tambahannya satu-dua berkas uji (±1 detik), bukan 17 detik.

**2. Seluruh langkah pindah ke proses utama.** Rancangan lama menaruh urutannya di layar. Tetapi di
`npm run desktop`, menulis berkas aplikasi memicu Vite memuat ulang halaman — layar yang menunggu hasil uji mati
di tengah jalan, persis laporan patch yang hilang 24 September. Yang tidak boleh ikut mati adalah
**pemulihannya**. Karena itu jalankan-uji → pulihkan → jalankan-ulang selesai dalam **satu** panggilan
`eng:verifikasi-patch` di proses utama, apa pun nasib layarnya.

Ini juga menuntut jalur pemulihan **tanpa dialog**: `eng:git-rollback` yang ada selalu bertanya dulu, dan itu
benar untuk tombol Undo Owner — tetapi pemulihan otomatis yang menunggu klik berarti berkas rusak tetap di disk
selama Owner tidak melihat layar. `pulihkanDariCheckpoint()` kini dipakai berdua: tombol Undo bertanya dulu lalu
memanggilnya, jalur otomatis memanggilnya langsung.

**3. Penjalan uji pertama memberi lima MERAH PALSU** — jenis cacat yang paling berbahaya di sini, karena merah
palsu memulihkan patch yang benar. Keduanya ketahuan pada jalan pertama, bukan dari membaca ulang kode:

| Cacat | Akibat | Perbaikan |
|---|---|---|
| stdout & stderr digabung | 5 berkas "gagal" karena peringatan node `MODULE_TYPELESS_PACKAGE_JSON` jadi baris terakhir | putusan dibaca dari **stdout saja**; stderr tetap dilaporkan, tidak pernah memutuskan |
| berkas `.js` ikut dijalankan | `uji-pengambilan*.js` adalah modul konsol DevTools, dijalankan node ia diam dan tampak gagal | hanya `.mjs`/`.cjs` dijalankan — tetapi yang `.js` **dilaporkan** di `takDijalankan`, tidak disembunyikan |

Pengecualian yang diam adalah cara `uji-folder-label` merah tanpa ketahuan selama empat hari. Karena itu tidak ada
berkas yang dikeluarkan dari suite tanpa namanya ikut tertulis di laporan.

**Angka sebenarnya, diukur 28 September:** `node uji/jalankan-semua.mjs` → **51 berkas, 16,9 detik**. Roadmap
menyebut 43 berkas/26,7 detik pada 24 September; suitenya bertambah dan tetap lebih cepat, karena penjalannya
tidak lagi lewat shell.

> **Diukur ulang 8 Oktober 2026: 93 berkas, 60,4 detik.** Angka 28 September di atas sengaja **tidak dihapus** —
> ia benar pada tanggalnya, dan dokumen audit menggambarkan kode pada tanggalnya sendiri.
>
> Yang perlu disadari: suitenya **naik 3,5×** sejak itu dan arahnya satu-arah. Anggaran Tahap 6 di
> `main.cjs:1058-1076` adalah **300 detik**, jadi sisa ruangnya masih 5× — tetapi kalau pertumbuhannya
> berlanjut dengan laju ini, angka itulah yang pertama menggigit, dan gigitannya berbentuk patch benar
> yang dipulihkan karena verifikasinya kehabisan waktu. Periksa ulang angkanya saat menambah berkas uji,
> jangan menunggu ia yang memberi tahu.

**Batas yang tetap terbuka:** di `npm run desktop`, laporan verifikasi bisa hilang dari layar karena Vite memuat
ulang halaman di tengah jalan. **Pemulihannya tetap terjadi** (itu di proses utama), hanya laporannya yang
lenyap. Ini tidak ditambal dengan lapisan penyangga keempat — justru itu yang diperingatkan bab ini sejak awal.
Di aplikasi terpasang, gangguan itu tidak ada.

---

## Urutan yang disarankan

**Diperbarui 23 September 2026 (keputusan Owner):** Tahap 2 ✅ selesai lebih dulu. Urutan berikutnya **Tahap 3
(ingatan temuan) SEBELUM Tahap 1 (lingkaran mandiri)** — tanpa ingatan, Engineer yang berjalan otonom akan
melaporkan temuan yang sama setiap hari sampai Owner berhenti membacanya. Sesudah itu Tahap 1, 4, dan 5.

**Tahap 6 ditambahkan 24 September (disetujui Owner)** dan **bergantung pada Tahap 5** — argumen kedua, dari
jalur yang sama sekali berbeda, untuk mendahulukan Tahap 5. Owner: *"memang uji itu butuh waktu dan harga;
itulah yang membuatnya stabil"*.

**Usul perubahan 24 September (menunggu keputusan Owner): Tahap 5 naik SEBELUM Tahap 1.** Urutan lama menaruh
Tahap 5 terakhir karena ia soal kenyamanan pemakaian, sementara tahap lain soal kemampuan dan kejujuran —
penilaian yang masuk akal 23 September dan sudah kedaluwarsa sekarang. Dari tujuh cacat jalur patch 24 September,
**tiga** berakar pada muat ulang Vite saat Engineer menyentuh kodenya sendiri: laporan tertimpa pemulihan,
catatan serah-terima habis sekali pakai, dan penjaga instance yang salah. Ketiganya penyangga untuk masalah yang
tidak ada di aplikasi terpasang. Menjalankan lingkaran otonom (Tahap 1) di mode itu berarti menumpuk penyangga
baru di atas tiga lapis yang sudah ada.

## Yang tidak dijanjikan rancangan ini

Engineer tidak akan menjadi sepintar model yang menggerakkannya. Terbukti 23 September: dengan `gpt-4o-mini` ia tiga
kali mengerjakan tugas yang salah; dengan `deepseek-v4-pro-0813` ia menolak tugas yang tidak ada di sumbernya dan
menemukan cacat yang tidak ada di kunci jawaban. Prosedur, pagar, dan mesin uji memperbaiki **ketertiban dan
kejujuran** — kecerdasan tetap dibeli lewat tingkat model (±$0,03 per sesi uji pada tarif `v4-pro`).

## Sampai mana "memelihara diri sendiri" itu benar (diskusi Owner, 24 September 2026)

Owner meragukan gagasan Mamet memelihara dirinya, dengan analogi: **manusia yang mengobati atau mengganti
jantungnya sendiri tanpa bantuan orang lain.** Analogi itu tepat — dan ketepatannya bergantung pada mode.

| Mode | Yang dibedah | Yang berjalan |
|---|---|---|
| `npm run desktop` | berkas sumber | **berkas sumber yang sama** — Vite memuat ulang, kode baru seketika hidup |
| `npm run dist` | berkas sumber | **salinan terbundel, tidak tersentuh** |

Di mode pengembangan analoginya **harfiah**: operasi pada jantung yang masih berdetak. Tiga dari tujuh cacat
24 September lahir dari sana. Di aplikasi terpasang, Mamet tidak menyentuh jantungnya — ia **menyunting cetak
birunya**; yang berjalan tetap versi lama dan utuh, dan perubahan baru hidup saat **Owner** membangun ulang.
Analogi yang pas untuk mode itu: dokter menulis resep untuk dirinya, yang baru berlaku setelah orang lain
menebusnya. (Alasan ketiga untuk mendahulukan Tahap 5.)

### Pemisahan itu tujuan, bukan keterlambatan (diskusi Owner, 2026-09-28)

Owner membayangkan bentuk akhirnya lewat perbandingan yang tepat: **aplikasi Claude Code sebagai Engineer**,
menyunting folder `mamet os ecosystem`, menjalankan uji dan `npm run desktop` — *"tetapi belum menerima efeknya
karena update otomatis belum terpicu."*

Perbandingannya sah, satu bagiannya perlu dibalik: **tidak ada jeda yang akan tersusul.**

- **Claude Code**: program yang **berbeda** dari Mamet. Ia menyunting sumber Mamet; binernya sendiri tidak
  tersentuh, sekarang maupun nanti. Tidak ada pembaruan apa pun yang akan membuatnya "merasakan" patch itu,
  karena efeknya memang bukan ditujukan kepadanya. Pemisahannya **permanen**.
- **Engineer sesudah Tahap 5**: pemisahannya lebih longgar tetapi tetap disengaja —
  `repo → commit → push → build/release → update → mamet.exe yang berjalan`. Empat langkah, masing-masing
  dengan keputusan manusia.

**Update otomatis menarik RILIS, bukan repo lokal Owner.** Walau pembaruan otomatis bekerja sempurna, menyunting
repo di laptop Owner tidak akan pernah memicunya. Kedua hal itu tidak tersambung — dan itu memang seharusnya.

**Karena itu "belum menerima efeknya" adalah keadaan yang dikejar, bukan kekurangan yang ditambal.** Mode yang
menerima efek seketika sudah ada — `npm run desktop`, dengan Vite memuat ulang saat berkas tersentuh — dan mode
itulah yang melahirkan tiga dari tujuh cacat 24 September.

**Yang menguji dan yang diuji menjadi dua proses.** Bila Mamet terpasang menjalankan `npm run desktop` pada repo,
yang lahir adalah **instans Mamet kedua** dari kode yang baru dipatch: efeknya terlihat di instans itu, bukan di
aplikasi yang sedang bekerja. Pola yang sama dipakai asisten mana pun yang menjalankan uji sebagai proses anak —
bila uji gagal atau macet, yang mati proses anaknya, pelapornya tetap berdiri. **Uji yang dijalankan di dalam diri
sendiri akan membungkam pelapornya saat paling dibutuhkan.**

Akibat yang paling berharga: **patch buruk tidak bisa melumpuhkan Engineer yang sedang berjalan.** Paling jauh ia
merusak build berikutnya, dan git membatalkannya.

**Koreksi kedua dari diskusi yang sama:** Owner sempat merumuskan Tahap 5 sebagai *"Engineer mengambil clone
kodenya"*. Engineer **tidak** meng-clone. Owner yang `git clone`, lalu **menunjuk** foldernya; aplikasi hanya
menyimpan **alamatnya**. Meng-clone sendiri berarti Mamet menarik kode dari internet ke disk Owner atas inisiatif
sendiri — kemampuan baru yang menembus batas "tidak ada `git` tulis" dan butuh keputusan Owner tersendiri.

**Rumusan Owner yang tepat, dan berguna:** Tahap 5 pada dasarnya **pola yang sama dengan tombol 📁 Assistant** —
Owner memilih folder sekali, aplikasi menyimpan alamatnya. Bedanya tiga: folder wajib repo git (`.git` ada),
folder di dalam direktori instalasi ditolak, dan yang dibuka bukan hanya berkas melainkan **riwayat** (checkpoint
& rollback). Assistant bekerja pada berkas; Engineer bekerja pada riwayat — dan riwayat itulah jaring pengamannya.
Konsekuensi praktisnya: mekanisme pemilihan folder Item 85 sudah hidup dan teruji, jadi **Tahap 5 sebagian besar
memakai ulang jalan yang sudah ada**, bukan membangun dari nol.

**Yang tetap benar dari keraguan Owner — dan sudah jadi batas sejak awal:** rantai yang membuat perubahan nyata
bagi orang lain (GitHub, Vercel, penerapan) tidak pernah bisa disentuh Mamet. Lihat "Batas yang tidak digeser"
nomor 3: *tidak ada pemasangan paket, tidak ada `git` tulis, tidak ada push.* Naluri Owner sudah tertulis di kode
sebelum pertanyaannya diajukan.

**Satu hal yang membuat komputasi berbeda dari jantung:** operasi jantung tidak bisa dibatalkan, patch bisa.
Checkpoint wajib sebelum menulis, `git checkout` mengembalikan, dan Tahap 6 memulihkan otomatis saat uji gagal.
Kesalahan tidak bisa dicegah seluruhnya, tetapi bisa dibuat **tidak permanen** — pilihan yang tidak dimiliki ahli bedah.

**Yang TIDAK berubah:** sistem tidak bisa memeriksa dirinya dengan bagian yang rusak. Buktinya hari itu —
pemeriksa `eval(` memblokir berkas yang memuat `eval(` di dalam pemeriksanya sendiri. Itu batas nyata, bukan bug.

Karena itu penilaian akhir tidak pernah berpindah ke mesin. Kata Owner, yang menutup diskusi ini:

> **"Hasil akhirnya penciptanyalah yang menentukan, yaitu saya."**

Itu bukan sekadar sikap — ia sudah jadi arsitektur: `constitution/04_OWNER_SOVEREIGNTY.md`, checkpoint wajib,
dialog izin, CORE IMMUTABLE, dan larangan `git` tulis. Seluruh roadmap ini menambah **kemampuan** Engineer;
tidak satu pun tahapnya memindahkan **keputusan**.

---

## Tahap 5 — SELESAI (2026-09-28), belum diuji di aplikasi terpasang

**Yang berubah.** `PROJECT_ROOT = path.resolve(__dirname, '..', '..')` dihapus. Akar repo kini ditentukan
`frontend/electron/akarRepo.cjs`:

| Mode | Akar repo |
|---|---|
| `npm run desktop` | folder induk `main.cjs` apa adanya — Owner tak perlu memilih yang sudah pasti |
| aplikasi terpasang | **hanya** pilihan Owner |
| terpasang & belum dipilih | **`null`** — alat repo mati dengan alasan |

Baris terakhir itu inti perbaikannya: dulu ia diam-diam jatuh ke folder instalasi.

**Dua penjaga.** (1) wajib ada `.git` — tanpa riwayat, checkpoint & rollback kehilangan artinya;
(2) folder di dalam direktori instalasi **ditolak**, karena uninstall menghapusnya beserta seluruh
riwayat git di dalamnya dan update menimpanya. Pagar dasarnya **dipakai ulang** dari `akarFolderSah`
(Item 85), bukan ditulis ulang — supaya tidak ada dua versi aturan yang bisa berbeda.

**Penyimpanan.** Alamatnya saja, di `%APPDATA%\Mamet AI\repo-engineer.json`, dan **disahkan ulang tiap
aplikasi dibuka** — folder yang sudah dihapus, dipindah, atau kehilangan `.git` tidak dipakai diam-diam.
Pola yang sama dengan `folder-kerja.json` (Item 85).

**Handler yang dijaga:** `eng:git-checkpoint`, `eng:git-rollback`, `engineer:uji-klaim`,
`engineer:jalankan`, dan seluruh `fs:*`. Yang terakhir dulu memanggil `path.resolve(PROJECT_ROOT, …)`
sehingga alamat relatif diam-diam menunjuk berkas aplikasi; kini `alamatRepoRelatif()` **melempar
dengan alasan**, bukan menebak.

**UI.** `AkarRepoTombol.jsx` — kembaran tombol 📁 Assistant, tampil hanya di workspace Engineer.
Kuning "Pilih repo" bila belum dipilih, hijau bernama folder bila sudah. Di mode pengembangan tampil
sebagai keterangan yang tidak bisa diklik: tidak ada yang perlu dipilih.

**Uji.** `uji/uji-akar-repo.cjs` (modul murni, folder uji sungguhan di temp) dan
`uji/uji-checkpoint-engineer.cjs` v2 — yang terakhir menjalankan **sumber handler yang asli** dan
membuktikan checkpoint & rollback menolak saat akar belum dipilih. 48 berkas uji hijau; `vite build` lolos.

**Belum terbukti.** Seluruhnya belum dijalankan di aplikasi terpasang. Pembuktiannya: `npm run dist`,
pasang, buka workspace Engineer — tombolnya kuning dan alat repo menolak dengan alasan; pilih folder
hasil clone → tombol hijau, `git status` Engineer menunjuk repo itu; coba pilih folder tanpa `.git` dan
folder di dalam direktori instalasi → keduanya ditolak dengan alasan yang terbaca.

**Yang TIDAK dikerjakan di sini:** penjaga baca `.env` (usul 2026-09-28, menempel pada T12) — perlu
persetujuan Owner tersendiri karena mengubah perilaku alat baca yang sudah hidup.

### Tahap 5 TERBUKTI LIVE di aplikasi terpasang (2026-09-28)

Diuji di `.exe` hasil `npm run dist`, bukan `npm run desktop`:

1. Sebelum memilih → tombol **kuning "Pilih repo"**, alat repo mati.
2. Owner menunjuk folder `mamet os ecosystem` → tombol **hijau** bernama folder itu.
3. `[MAMET_CMD: git status]` dijalankan:

```
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
Kode keluar 0 (0,5 s).
```

Bukan `not a git repository`. `git show HEAD:frontend/...` juga mengembalikan isi berkas yang sungguhan.
Kriteria penerimaan Tahap 5 terpenuhi; bug 23 September tertutup.

**Penjaga lain yang ikut terlihat bekerja:** perintah identik kedua ditolak dengan alasan prosedur
langkah 0.4 ("Mengulangi perintah yang identik tidak akan memberi hasil berbeda"), dan pemecah
perintah menolak `python -c "…"` berkutip bersarang ("tanda kutip tidak ditutup").

### Sisa pekerjaan yang ketahuan dari uji live itu

**1. ✅ SELESAI hari yang sama — Engineer sudah bisa membaca berkas besar, tanpa kode baru.**
Lihat [log](../project-memory/changelog/2026-09-28-baca-berkas-besar.md). Yang kurang ternyata bukan
kemampuan melainkan **pengetahuan**: `git grep` dan `git blame` sudah diizinkan profil Engineer sejak lama
(`alatFolderJalan.cjs:74`), hanya tidak pernah disebut di prosedur. Diukur: `git show` utuh 47.767 bita
(terpotong, baris yang dicari tak pernah sampai) vs `git grep -n -B2 -A4` **801 bita** yang justru
menjangkaunya — **59× lebih kecil**. `constitution/28` §3a kini mengajarkannya, dan
`petunjukKeluaranTerpotong()` menyodorkan jalan keluarnya saat pembacaan utuh terpotong. TMN-0001 ikut
ditutup. Uraian lama di bawah disimpan sebagai catatan bagaimana masalahnya dulu dirumuskan keliru:

~~**1. Engineer tidak bisa membaca berkas lebih dari 20 KB.**~~ `alatFolderJalan.cjs:27`
`keluaranByte: 20 * 1024` memotong keluaran perintah; `engineer.js` berukuran **47.767 byte**, jadi
`git show HEAD:<berkas>` hanya menyampaikan ±40% awalnya. **Baris 1035 — isi temuan TMN-0001 — tidak
terjangkau**, dan Engineer tidak punya cara lain: `git show` hanya bisa mengeluarkan berkas utuh.

Asimetri yang menunjuk arah perbaikannya: **Assistant sudah punya baca per rentang baris**
(`folder:alat` menerima `dari`/`sampai`), Engineer tidak punya padanannya untuk repo. Menaikkan batas
20 KB bukan jawabannya — berkas 47 KB akan menghabiskan jendela konteks. Yang dibutuhkan alat baca
repo berbasis rentang baris, sejajar dengan milik Assistant.

Selama ini belum ada, temuan yang letaknya di paruh kedua berkas besar **tidak bisa diverifikasi
Engineer sendiri** — termasuk temuannya sendiri.

**2. Model tidak diberi tahu akar repo-nya.** Uji live 28 Sep: model menulis *"Keduanya dijalankan dari
direktori kerja yang berbeda"* lalu mengarang perintah `python` untuk menelusuri filesystem mencari
berkas yang alamatnya sudah ia ketahui. Perintah memang dijalankan dengan `cwd = akarRepo()`, tetapi
modelnya tidak tahu itu. Sebelum Tahap 5 ini tak bisa diperbaiki karena akarnya sendiri tidak pasti;
sekarang akarnya eksplisit dan tinggal disebutkan di prompt. Menunggu keputusan Owner (perubahan prompt).

### Kode mati READ_REPO dihapus (2026-09-28)

219 baris di `TaskHandlers.js` + kabelnya di `engineer.js`, `IntentClassifier.js`, dan
`ConversationEngine.jsx`. [log](../project-memory/changelog/2026-09-28-hapus-read-repo-mati.md).

Kematiannya dibuktikan lebih dulu: `Engineer:GeneratePatch` hanya dipancarkan tombol "Apply Patch",
tugasnya selalu `dariTombolApply: true`, sehingga `detectIntent()` **tidak pernah dipanggil**; dan
`Engineer:ReadRepo` hanya punya pendengar tanpa pemancar di seluruh repo.

`RepositoryReaderService` **tetap hidup** — FileExplorer memakainya. Yang dihapus hanya kabel mati dari
Engineer ke sana.

**Sisa yang belum diputuskan:** `Engineer:AnalyzeTask` dan `Engineer:ReviewChanges` berada dalam kondisi
yang sama — tidak ada pemancarnya. Begitu pula seluruh `detectIntent()` beserta cabang ANALYSIS dan
CLARIFICATION-nya. Membongkarnya keputusan tersendiri; dicatat supaya tidak perlu ditelusuri ulang.

**KEPUTUSAN OWNER 2026-09-28 — bukan "hapus", melainkan "periksa dulu".** Asisten menyarankan menghapus
seperti READ_REPO; Owner mengoreksi arahnya: *"cari lagi agar bermanfaat; jika sudah dikerjakan oleh kode
lain yang lebih baik, tidak masalah dihapus."*

Urutannya karena itu terbalik dari READ_REPO, dan bedanya penting. READ_REPO dihapus **sesudah** terbukti
ada penggantinya yang lebih baik (`git grep`/`git blame`, `RepositoryReaderService`) — penghapusannya
adalah kesimpulan, bukan titik mulai. Untuk kedua jalur ini penggantinya **belum diperiksa**, jadi
menghapusnya sekarang berarti mengambil kesimpulan yang sama tanpa mengerjakan pembuktiannya.

Yang harus dijawab sebelum menghapus — **dengan kode, bukan pendapat**:

1. Apa yang sebenarnya dilakukan `_analyze` dan `_review`, dan apakah keluarannya masih masuk akal hari ini?
2. Adakah jalur lain yang sudah melakukannya lebih baik? Tersangka: mesin uji klaim (Tahap 2, menjalankan
   kode sungguhan) dan verifikasi patch yang dijalankan (Tahap 6, menjalankan seluruh berkas uji — 51 saat
   baris ini ditulis, 93 per 8 Okt 2026) — keduanya
   **membuktikan**, sedangkan `_review` hanya menilai dari bentuk teks, persis cara yang sudah terbukti
   salah 24 September.
3. Bila TIDAK ada penggantinya: apakah kemampuan itu masih bernilai bagi Owner — misalnya "tinjau perubahan
   ini tanpa mem-patch"? Bila ya, ia butuh **pemancar**, bukan penghapusan.

Hasil yang mungkin ada tiga, dan ketiganya sah: dihapus (sudah ada yang lebih baik), disambungkan (masih
berguna dan tak ada penggantinya), atau ditulis ulang untuk kebutuhan hari ini.

**Cara mengoreksi keputusan ini:** bila pemeriksaan itu sendiri berlarut-larut, keputusannya jatuh ke
menghapus — kode mati yang rapi **tampak hidup**, dan pada 28 September ia sempat menipu asistennya sendiri.
Biaya membiarkannya nyata; biaya menulis ulang bila ternyata dibutuhkan, kecil.

**✅ SELESAI 29 September 2026 — diperiksa dulu, lalu dihapus.** Ketiga pertanyaan di atas terjawab dengan
kode:

1. `_review()` **tidak menambah apa pun** di atas `_analyze()` — ia memetakan jumlah pelanggaran jadi
   APPROVE/REJECT, vonis dari **mencocokkan pola teks**.
2. Penggantinya ada dan lebih baik: **Tahap 6** menjalankan 54 berkas uji sesudah patch lalu memulihkan
   sendiri bila gagal. Untuk ANALYSIS, kemampuannya tidak hilang sama sekali — `_analyze()` tetap
   dipanggil jalur MODIFY_CODE dan hasilnya tetap sampai ke Owner lewat Reasoning Lock.
3. Karena itu yang dihapus **pembungkus tugasnya**, bukan kemampuannya.

Dihapus: kedua pendengar, kedua pembungkus, kedua fungsi di `TaskHandlers.js`, `_review()`, cabang
ANALYSIS & CLARIFICATION, impor `detectIntent`. **Bersih −46 baris.**

Cabang yang tak pernah tercapai diganti **penjaga yang bersuara**: tugas tanpa `dariTombolApply` kini
DITOLAK dengan sebab yang jelas, bukan jatuh diam-diam ke MODIFY_CODE. `IntentClassifier.js` sengaja
disimpan — dipakai lima berkas uji sebagai bahan uji nyata; peringatannya ditulis di kepala berkasnya.
[log](../project-memory/changelog/2026-09-29-analysis-review-dihapus.md)

### Model diberi tahu akar repo-nya (2026-09-28) — sisa Tahap 5 ditutup

`catatanAkarRepo()` disisipkan ke **tiap kiriman** Engineer, sejajar ringkasan temuan Tahap 3b:

```
[AKAR REPO ENGINEER]
Seluruh perintah [MAMET_CMD: …] dijalankan dengan direktori kerja: <akar>
Anda SUDAH berada di akar repo. Pakai alamat RELATIF …
JANGAN menelusuri filesystem — pakai git ls-files atau git grep -n.
```

Alasannya kejadian live 28 Sep: model menulis *"dijalankan dari direktori kerja yang berbeda"* lalu
mengarang perintah `python` untuk mencari berkas yang alamatnya sudah ia ketahui. Perintah memang
dijalankan dengan `cwd = akarRepo()`, hanya tidak pernah diberitahukan kepadanya.

Larangannya disertai **ganti cara** (`git ls-files` / `git grep -n`), sesuai prosedur langkah 0.4 —
melarang tanpa memberi jalan lain hanya memindahkan kemacetan.

Dibaca dari proses utama pada **tiap kiriman**, bukan sekali di awal: Owner bisa berganti repo lewat
tombol "Pilih repo", dan catatan sekali-di-awal hilang begitu "Bersihkan konteks" menggeser jendela.
Diam bila akar kosong (web/Mametlite, atau terpasang tapi belum dipilih) — catatan yang menyebut akar
kosong lebih buruk daripada tidak ada catatan.

Uji: `uji/uji-catatan-akar-repo.mjs` — isi catatan, kapan diam, dan **terpasang** (diimpor, dipanggil
di `handleSend`, ikut ke `historyKirim` yang benar-benar dikirim, hanya di workspace Engineer).
