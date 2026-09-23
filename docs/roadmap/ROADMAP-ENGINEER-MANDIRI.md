# ROADMAP — Engineer Mandiri (self-maintenance)

**Dibuat:** 23 September 2026 · **Status:** 📝 rancangan, menunggu koreksi Owner · belum ada kode

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

## Tahap 2 — Mesin uji untuk klaim Engineer

**Masalah:** klaim Engineer hari ini hanya terbukti karena **saya** menjalankan `detectIntent` pada tiap kalimatnya
(7/7 lalu 11/12). Tanpa itu, tidak ada yang tahu mana yang benar.

**Rancangan:** Engineer menulis klaimnya dalam bentuk yang bisa dijalankan — misalnya tabel "masukan → hasil yang
diklaim" — dan sistem menjalankannya sendiri terhadap kode nyata, lalu menempelkan hasilnya di bawah jawaban:
`9/12 klaim terbukti, 3 meleset (…)`. Klaim yang meleset tidak menghapus jawaban; ia ditandai.

**Kenapa ini sebelum otonomi penuh:** ini satu-satunya hal yang membuat pekerjaan tanpa pengawasan bisa dipercaya.

**Cara uji:** tanam sengaja satu klaim salah → sistem harus menandainya; klaim yang benar tidak boleh ditandai salah.

## Tahap 3 — Ingatan kerja Engineer

**Masalah:** setiap chat mulai dari nol. Memory sengaja dimatikan di Engineer, dan itu benar untuk memori percakapan
— tapi Engineer tidak punya catatan **temuan**.

**Rancangan:** penyimpanan terpisah berisi: apa yang sudah diperiksa dan kapan, temuan yang masih terbuka, temuan
yang sudah ditutup beserta buktinya, dan pelajaran (mis. "`git show <alamat>` tanpa `HEAD:` menghasilkan kosong").
Bukan obrolan, bukan memori pengguna.

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

---

## Urutan yang disarankan

**Tahap 1 dan 2 dikerjakan bersamaan** — yang satu tanpa yang lain berbahaya: otonomi tanpa mesin uji hanya
memperbanyak tebakan yang rapi. Lalu Tahap 3, 4, dan 5.

## Yang tidak dijanjikan rancangan ini

Engineer tidak akan menjadi sepintar model yang menggerakkannya. Terbukti 23 September: dengan `gpt-4o-mini` ia tiga
kali mengerjakan tugas yang salah; dengan `deepseek-v4-pro-0813` ia menolak tugas yang tidak ada di sumbernya dan
menemukan cacat yang tidak ada di kunci jawaban. Prosedur, pagar, dan mesin uji memperbaiki **ketertiban dan
kejujuran** — kecerdasan tetap dibeli lewat tingkat model (±$0,03 per sesi uji pada tarif `v4-pro`).
