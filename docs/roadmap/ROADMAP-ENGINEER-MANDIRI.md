# ROADMAP — Engineer Mandiri (self-maintenance)

**Dibuat:** 23 September 2026 · **Status:** 🟡 Tahap 2 ✅ · Tahap 3a ✅ · Tahap 3b ✅ (ingatan temuan, live
24 September). Berikutnya **Tahap 5** — diusulkan naik mendahului Tahap 1, menunggu keputusan Owner

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

## Urutan yang disarankan

**Diperbarui 23 September 2026 (keputusan Owner):** Tahap 2 ✅ selesai lebih dulu. Urutan berikutnya **Tahap 3
(ingatan temuan) SEBELUM Tahap 1 (lingkaran mandiri)** — tanpa ingatan, Engineer yang berjalan otonom akan
melaporkan temuan yang sama setiap hari sampai Owner berhenti membacanya. Sesudah itu Tahap 1, 4, dan 5.

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
