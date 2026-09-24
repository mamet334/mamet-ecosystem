# ROADMAP — Engineer Mandiri (self-maintenance)

**Dibuat:** 23 September 2026 · **Status:** 🟡 Tahap 2 ✅ · Tahap 3a ✅ · Tahap 3b ✅ (ingatan temuan, live
24 September). **Tahap 6 baru** (verifikasi patch yang dijalankan) — bergantung pada Tahap 5.
Berikutnya **Tahap 5**, diusulkan naik mendahului Tahap 1; menunggu keputusan Owner

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

## Tahap 6 — Verifikasi patch yang DIJALANKAN, bukan dicocokkan (disetujui Owner 24 September 2026)

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
