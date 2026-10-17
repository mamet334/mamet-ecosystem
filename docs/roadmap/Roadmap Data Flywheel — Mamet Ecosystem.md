# Roadmap Data Flywheel — Mamet Ecosystem

Oct 17, 2026 · @mamet · **Revisi 1: 18 Oktober 2026** (verifikasi terhadap kode & data nyata)

> **Goal yang ditetapkan Owner:** *sistem yang semakin pintar — bukan model AI-nya yang pintar.*
>
> Kalimat itu bukan hiasan, ia **penentu arah**. Model boleh diganti kapan saja, dan yang dibeli
> dari penyedia adalah kepintaran sewaan. Yang menjadi milik Mamet hanya yang tersimpan sebagai
> aturan, skill, statistik, dan memori — hal-hal yang tetap ada walau seluruh model ditukar besok.

## Apa yang berubah di Revisi 1

Rancangan versi pertama diuji terhadap kode pada commit `f279c49` dan terhadap **data nyata di
basis data produksi** (688 trace, 1.143 pesan, 465 pesan Owner). Tiga hal berubah, dan yang pertama
mengubah arah:

| | Versi 1 | Revisi 1 |
|---|---|---|
| **Tuas biaya utama** | Intent router mengirim pesan sederhana ke jalur mahal | **Salah sasaran.** Seluruh jalur sub-agent hanya **2,6%** biaya; **74,3%** biaya berasal dari **satu model yang Owner pilih sendiri** di Settings. Target "turun ≥20% lewat routing" **tidak mungkin tercapai secara aritmetika** |
| **North Star** | Biaya per jawaban berhasil | Sah **hanya** saat sistem yang memilih model. Saat Owner memilih sendiri, biaya mengukur selera Owner, bukan kepintaran sistem — jadi metriknya **wajib dipisah menurut siapa yang memilih** |
| **Kondisi awal** | "Belum ada mekanisme skill"; "pecah `engineer.js`" | Keduanya **sudah ada**: `SkillRegistry` + `SkillGuardService` + eksekutor skill berjalan, dan `engineer.js` sudah dipecah (ADR-0017, 14 modul). Yang belum ada: **distilasi**, **gerbang persetujuan**, dan **pengambilan skill lewat RAG** |

Ditambah satu temuan yang memangkas pekerjaan Fase 0: **keputusan router sudah terekam di riwayat
chat** — 92 keputusan tersimpan tanpa instrumentasi apa pun.

Catatan metode: seluruh angka di dokumen ini dihitung **di dalam basis data** dan hanya
mengembalikan agregat. Nol isi percakapan keluar dari server, sesuai T12.

## Ringkasan awam

Data flywheel membuat Mamet Ecosystem belajar dari pemakaian nyata Owner, sehingga makin tepat dan makin hemat dari bulan ke bulan. Yang berkembang adalah sistemnya (aturan routing, skill, memori), bukan model AI-nya, jadi semua pembelajaran tetap ada walau model diganti.

Perumpamaannya bengkel motor. Petugas di depan (intent router) memutuskan apakah sebuah motor cukup ditangani montir biasa atau harus ke montir senior. Saat ini bengkel tidak punya buku catatan dan tidak pernah bertanya apakah pelanggan puas, sehingga kesalahan petugas tidak pernah ketahuan.

**Revisi 1 menambahkan bagian yang hilang dari perumpamaan itu.** Setelah tagihannya benar-benar
dihitung, ternyata yang membuat mahal **bukan montir mana yang dipanggil** — melainkan **suku cadang
yang dipesan pemilik motor sendiri**. Pemilik berhak memilih onderdil mahal, dan itu bukan kesalahan
bengkel. Maka bengkel ini hanya boleh dinilai dari hal yang memang ia putuskan: berapa kali motor
bolak-balik masuk bengkel, berapa lama, dan apakah hasilnya memuaskan. Soal onderdil, tugas bengkel
bukan diam-diam menggantinya dengan yang murah — melainkan **menunjukkan selisih harganya** supaya
pemilik memutuskan dengan sadar.

Siklusnya ada lima langkah yang terus berulang:

1. **Catat**: setiap keputusan sistem direkam (jalur, biaya, durasi), tanpa isi percakapan.
2. **Nilai**: Owner memberi 👍/👎, dan hakim bayangan menilai secara otomatis di belakang layar.
3. **Pelajari**: pola yang berhasil diusulkan menjadi skill atau aturan baru.
4. **Setujui**: Owner memutuskan; tidak ada perubahan yang aktif diam-diam.
5. **Terapkan dan ukur**: perubahan dijalankan, lalu dibandingkan dengan kondisi sebelumnya.

## Tujuan dan goal terukur

North Star: **biaya per jawaban yang berhasil turun dari bulan ke bulan, tanpa menurunkan tingkat kepuasan Owner.** "Berhasil" berarti jawaban diberi 👍 atau tidak diulang, tidak diedit, dan tidak ditolak di confirmation gate.

Satu angka ini dipilih karena menggabungkan dua hal yang sering bertabrakan, yaitu kualitas dan biaya. Menekan biaya saja bisa merusak kualitas, sedangkan mengejar kualitas saja bisa membuat biaya meledak.

### Revisi 1 — North Star wajib dipisah menurut siapa yang memilih model

Angka biaya hanya sah menilai sistem bila **sistem** yang memutuskan. Diukur 18 Okt: **74,3%**
seluruh biaya berasal dari `deepseek-v4-pro`, model yang **Owner pilih sendiri** di Settings, dan
harganya **7× per token** dibanding `deepseek-v4-flash`. Kalau bulan depan Owner memilih model mahal
lebih sering, North Star memburuk tanpa sistem melakukan satu kesalahan pun — dan sebaliknya, sistem
bisa terlihat "membaik" hanya karena Owner sedang hemat. Itu metrik yang mengukur selera, bukan
kepintaran.

Maka North Star dibaca dalam dua kolom terpisah:

| Yang memilih model | Metrik yang sah | Alasan |
|---|---|---|
| **Sistem** (tier otomatis) | **biaya per jawaban berhasil** | sistem yang memutuskan, jadi sistem yang bertanggung jawab |
| **Owner** (pilih sendiri di Settings) | **jumlah panggilan model & token per jawaban berhasil** | harga per panggilan di luar kendali sistem; yang dikendalikan sistem adalah berapa kali dan sebanyak apa ia memanggil |

Konsekuensinya langsung ke Fase 0: **mencatat siapa yang memilih model lebih penting daripada
mencatat jalur router.** Tanpa kolom itu, setiap angka biaya di dokumen ini tercemar dan tidak bisa
dipakai mengambil keputusan.

Dan sejalan dengan goal Owner — *sistem yang pintar, bukan modelnya* — tugas sistem terhadap pilihan
model **bukan menggantinya diam-diam demi metrik**, melainkan **menunjukkan selisihnya**: "jawaban ini
$0,0040; dengan flash menjadi $0,0006". Owner memutuskan dengan angka di tangan. Itu Owner
Sovereignty, dan sekaligus menjaga catatan Owner sendiri bahwa kebenaran di atas biaya.

Tiga pagar pengaman (guardrail) wajib dijaga selama North Star dikejar:

- **Kepuasan**: tingkat 👍 tidak boleh turun lebih dari 5 poin persen dari baseline.
- **Kejujuran sumber**: kesepakatan label sumber antara sistem dan hakim bayangan tidak boleh memburuk.
- **Privasi**: nol isi percakapan tersimpan di tabel roda gila, dan nol kebocoran antar-tenant.

| Fase | Goal | Target (usulan) |
| --- | --- | --- |
| 0. Catat dan nilai | **Setiap panggilan model tahu siapa yang memilihnya**, dan setiap keputusan router terekam | ≥ 99% panggilan punya penanda pemilih; ≥ 99% request punya catatan; baseline terkumpul (**92 keputusan router sudah ada di riwayat**) |
| 1. Router berbasis bukti | **Pesan sederhana tidak lagi menempuh jalur berputar** | **Direvisi:** latensi jalur salah-rute turun ≥ 30% dan kegagalan router tidak lagi jatuh ke jalur mahal. Biaya: ~2,6% saja — **jangan dijanjikan sebagai penghematan** |
| 2. Evaluasi otomatis | Hakim bayangan cukup dipercaya untuk membantu menilai | Sepakat dengan penilaian Owner pada ≥ 80% sampel (**107 vonis hakim sudah tersedia**) |
| 3. Skill dari pengalaman | **Distilasi + gerbang persetujuan di atas mekanisme skill yang sudah berjalan** | Tugas berulang yang memakai skill: **panggilan model turun ≥ 30%**, tingkat 👍 tetap |
| 4. Tata kelola matang | Siklus berjalan rutin dan bisa diaudit | Tinjauan bulanan berjalan 3 bulan berturut-turut |

Semua angka target adalah usulan awal. Angka final baru ditetapkan setelah baseline Fase 0 terkumpul, karena target tanpa data awal hanyalah tebakan.

## Acuan standar internasional

Roadmap ini mengikuti empat acuan yang dipakai luas di industri. Targetnya setara **MLOps Level 1 versi Google** untuk lapisan sistem (routing, skill, memori), dengan tata kelola mengikuti **NIST AI RMF**.

| Acuan | Isi singkat | Yang diambil untuk Mamet |
| --- | --- | --- |
| [Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml) (Google, Martin Zinkevich) | 43 aturan praktik ML dari pengalaman produk Google | Rule #2: rancang dan pasang metrik sebelum mengubah sistem. Rule #4: model pertama sederhana, infrastruktur harus benar. Rule #10: waspadai kegagalan diam-diam. Rule #13: tujuan pertama harus sederhana, teramati, dan bisa dikaitkan ke aksi sistem. Rule #29: catat fitur saat keputusan dibuat, bukan direkonstruksi belakangan. |
| [MLOps Level 0–2](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning?hl=de) (Google Cloud Architecture Center) | Tingkat kematangan: Level 0 manual, Level 1 pipeline otomatis, Level 2 CI/CD penuh | Mamet kini di Level 0: belum ada pencatatan prediksi dan aksi untuk mendeteksi penurunan kinerja. Target Level 1: validasi otomatis, metadata tiap eksekusi, dan perbandingan dengan versi sebelumnya sebelum perubahan aktif. Level 2 belum diperlukan untuk satu Owner. |
| [NIST AI RMF 1.0](https://www.nist.gov/news-events/news/2023/01/nist-risk-management-framework-aims-improve-trustworthiness-artificial) (NIST, Januari 2023) | Kerangka risiko AI sukarela dengan empat fungsi: Govern, Map, Measure, Manage | Govern = Owner Gate dan konstitusi MAEF. Map = daftar keputusan sistem yang dicatat. Measure = metrik dan hakim bayangan. Manage = tinjauan bulanan dan rollback. |
| [OpenTelemetry GenAI Semantic Conventions](https://github.com/open-telemetry/semantic-conventions-genai) | Kosakata standar untuk telemetri panggilan model, agen, dan MCP | Nama kolom mengikuti konvensi seperti `gen_ai.request.model` dan `gen_ai.usage.input_tokens`, supaya data bisa diekspor ke alat observability mana pun tanpa diubah. Status konvensinya masih Development. |

Satu pelajaran lintas acuan: Google mencatat bahwa di sistem ML nyata, kode model hanya bagian kecil. Sisanya adalah pengumpulan data, validasi, monitoring, dan pengelolaan metadata, sebagaimana diadaptasi dari makalah [Hidden Technical Debt in Machine Learning Systems](https://papers.nips.cc/paper/5656-hidden-technical-debt-in-machine-learning-systems.pdf). Roadmap ini sengaja berfokus pada bagian "sisanya" itu.

## Kondisi saat ini

Sebagian besar organ roda gila sudah ada; yang belum ada adalah siklus yang menghubungkannya. Audit dilakukan pada commit `f279c49` (8 Oktober 2026).

| Tahap | Yang sudah ada | Celah |
| --- | --- | --- |
| Catat | `agent_logs` **15.030 baris** (disaring `saring_rahasia.ts`), `cost_ledger` **818**, `api_usage` **1.223**, `chats` **199** | Keputusan router tersimpan sebagai teks `processingSteps` — **ternyata cukup untuk baseline** (lihat temuan 1), tetapi tidak merekam **kata kunci mana** yang memicu, biaya, dan durasi. **Dan tidak satu pun tabel merekam siapa yang memilih model** |
| Nilai | `hakim_bayangan` **107 baris**: evaluator mode bayangan, ramping, aman di-DROP | Belum ada sinyal 👍/👎 dari Owner di frontend — **ini satu-satunya sisi yang benar-benar kosong di Fase 2** |
| Pelajari | `user_memories` (10), `project_memory_entries`, MemoryGovernor, **`SkillRegistry.js` + `SkillGuardService.js` + eksekutor skill di `AssistantService._handleSkill`** (jalankan `skill.steps` berurutan, mode tanya-jawab, event `Skill:Started/Completed/Error`) | **Koreksi Revisi 1:** mekanisme skill **sudah ada dan berjalan**. Yang belum: **distilasi** (mengusulkan skill dari pengalaman), **UI persetujuan**, dan **pengambilan skill lewat RAG** |
| Terapkan | `intent_router.ts`: daftar kata kunci + klasifikasi LLM | Statis; tidak belajar dari hasil. **Dan pencocokannya substring, bukan kata utuh** |
| Ukur | `ExecutionTraceService.js`, `ObservabilityPanel` | Belum menampilkan metrik keberhasilan |

Temuan yang memengaruhi roadmap — **seluruhnya diukur 18 Okt 2026, bukan diduga**:

**1. Baseline Fase 0 sebagian besar SUDAH ADA.** Keputusan router ikut tersimpan bersama tiap pesan
di tabel `chats` (medan `steps`), dan kalimatnya khas sehingga bisa dihitung:

| | |
|---|---|
| Chat · pesan · jawaban model | 208 · 1.143 · 575 |
| **Keputusan router terekam** | **92** |
| → kata kunci, langsung sub-agent | 43 (47%) |
| → klasifikasi LLM bilang **obrolan biasa** | 24 (26%) |
| → klasifikasi LLM bilang butuh agent | 19 (21%) |
| → **router gagal** | 6 |

Dari 43 pesan yang sempat sampai ke klasifikasi murah, **24 ternyata obrolan biasa**. Klasifikasi
murah itu bekerja; daftar kata kuncilah yang merampas pekerjaannya.

**2. Kebocoran router terbukti — dan cacatnya di cara mencocokkan, bukan hanya daftarnya.**
`actionKeywords.some(kw => lowerMsg.includes(kw))` memakai **substring**, bukan kata utuh. Akibatnya
`"harga"` cocok dengan peng**harga**an, `"api"` dengan r**api**/ter**api**/ke**rapi**an, `"sesi"`
dengan ob**sesi**, `"info"` dengan **info**rmasi. Diukur atas 465 pesan Owner: **279 (60%)**
tersangkut daftar, **39** tersangkut **hanya** karena kata tanya. Pemicu teratas: `kode` 83,
`dokumen` 77, `file` 63, `baca` 43, `api` 37, `cari` 33, `apakah` 30.

**3. TETAPI tuas biayanya bukan di sana — ini koreksi terpenting Revisi 1.** Dihitung dari
`cost_ledger` (688 trace, total **$1,75**):

| | |
|---|---|
| Rata-rata panggilan model per trace | **1,38** (maks 4) |
| Trace satu panggilan saja | 466 (68%) |
| Trace ≥3 panggilan (jalur sub-agent) | 35 (5%) |
| **Porsi biaya dari seluruh trace ≥3 panggilan** | **$0,046 — 2,6%** |
| **Porsi biaya `deepseek-v4-pro`** (pilihan Owner di Settings) | **$1,30 — 74,3%**, dan **7× per token** dibanding `flash` |

Memindahkan 267 panggilan `pro` ke `flash` pada volume token yang sama menghemat sekitar **$1,11 —
63% seluruh pengeluaran**. Satu keputusan Owner di Settings mengalahkan seluruh Fase 1. Karena itu
target "turun ≥20% lewat routing" dicabut: **tuasnya memang tidak ada di sana.**

**4. Router gagal = jatuh ke jalur mahal.** `isChatBiasa` diinisialisasi `false`, dan blok `catch`
tidak mengubahnya. Jadi setiap kegagalan klasifikasi otomatis menempuh jalur sub-agent. Sudah
terjadi **6 kali** dan tercatat. Ini gagal-mahal, dan belum ada di tabel risiko versi 1.

**5. Telemetri bisa mati tanpa ketahuan.** `persistTelemetryLog` (di
`verification/verification_service.ts`, dipanggil `audit_subscriber` & `lifecycle_subscriber` lewat
`rctx.tasks.fire`) tidak melaporkan kegagalannya ke mana pun yang Owner lihat. Melanggar Rule #10.

**6. Kuota database pernah habis karena log.** Dan `agent_logs` **sudah 15.030 baris sekarang** —
jadi prinsip "retensi sejak hari pertama" datang terlambat untuk tabel itu. Bacalah sebagai:
retensi untuk tabel baru, **plus retrofit** untuk `agent_logs`.

**7. `engineer.js` tepat 1226 baris** ✓ — tetapi **sudah dipecah**: ADR-0017 menghasilkan 14 modul di
`services/engineer/` dan 1226 baris itu **sisanya**. Jadi tugas Fase 3 bukan "pecah `engineer.js`",
melainkan membuktikan dulu apakah sisa itu benar-benar menghalangi penanaman titik distilasi.

**8. Laporan graphify jauh lebih basi dari yang tercatat — dan memindai ulang TIDAK
menyembuhkannya.** Versi 1 menyebut graf dibangun dari `bc81a0b2` (1 Okt); sebenarnya dari
`f279c491` (8 Okt) — yang 1 Okt itu folder lama. Diukur 16 Okt: **49% node menunjuk berkas yang
sudah tidak ada**, hanya **41%** berkas kode hidup terpetakan, dan **`AssistantService.js` tidak ada
di graf sama sekali**.

Pemindaian ulang dijalankan **18 Okt 00:50**, dan hasilnya **identik sampai digit terakhir**: 1950
node, 2794 edge, 951 node mati (49%), cakupan 147/359 (41%), `AssistantService.js` tetap absen.
Sebabnya tertulis di laporannya sendiri — **`cluster-only mode`**, yang hanya mengelompokkan ulang
graf lama tanpa membaca berkas dan tanpa memangkas yang hilang.

Jadi butir "segarkan graphify" **tidak selesai dengan memindai ulang**. Yang dibutuhkan `--update`
(memangkas 431 berkas terhapus dan mengekstrak ulang 370 berkas kode), dan karena hasilnya akan
**lebih kecil**, ia kemungkinan tertahan penjaga anti-menyusut dan butuh `--force`. Catatan ongkos:
di antara yang berubah ada **497 dokumen**, yang menuntut ekstraksi semantik (±23 subagent) — jadi
klaim "no API cost" pada laporan graphify hanya berlaku untuk perubahan **kode saja**.

**✅ DITUTUP 18 Okt**, dengan `graphify . --update --code-only` — AST lokal, nol kunci API, nol
token. Keluarannya menyebut *"Pruned 951 node(s) from 650 deleted or excluded source file(s)"*,
angka yang **cocok persis** dengan pengukuran di atas. Diukur ulang sesudahnya:

| | Sebelum | Sesudah |
|---|---|---|
| Node menunjuk berkas hilang | 951 (49%) | **0 (0%)** |
| Cakupan berkas kode hidup | 147 / 359 (41%) | **359 / 359 (100%)** |
| Total node · edge · komunitas | 1950 · 2794 · 237 | **3350 · 5305 · 261** |
| `AssistantService.js` | tidak ada | **ada** |

Sisa yang diketahui, dicatat supaya tidak disangka lengkap: **498 dokumen sengaja dilewati**
(butuh kunci API atau ±23 subagent), **29 berkas `.sql` tidak menyumbang node** karena
`tree_sitter_sql` belum terpasang (`pip install "graphifyy[sql]"`), dan 6 berkas `.json` menghasilkan
nol node.

**Akar kebasiannya ketemu, dan ia bukan kesalahan — melainkan kebiasaan perintah.** Pemindaian
selama ini dijalankan dengan:

```powershell
$env:GRAPHIFY_VIZ_NODE_LIMIT=6000
graphify cluster-only . --force
```

`cluster-only` memang hanya mengelompokkan ulang graf yang sudah ada; ia tidak pernah membaca satu
berkas pun. Dan `--force` membuatnya selalu berhasil menulis, sehingga tak pernah muncul penolakan
yang bisa jadi petunjuk. Hasilnya: sejak **31 Juli** grafnya dikelompokkan ulang berkali-kali dengan
isi yang sama persis.

**Urutan yang benar — dua perintah, bukan satu:**

```powershell
graphify . --update --code-only     # BACA berkas: ekstrak yang berubah, pangkas yang terhapus
graphify cluster-only .             # baru tulis ulang GRAPH_REPORT.md + graph.html
```

`GRAPHIFY_VIZ_NODE_LIMIT` hanya mengatur batas simpul visualisasi HTML; pada 3.350 node ia tidak lagi
diperlukan, tetapi tidak merugikan bila tetap dipasang.

**Pelajaran yang berlaku di luar graphify:** "sudah dipindai ulang" dan "sudah segar" adalah dua
klaim berbeda. Pemindaian 18 Okt 00:50 terlihat segar — tanggal hari ini, `Built from commit`
tercantum — padahal nol berkas dibaca. Yang membuktikan hanya pengukuran: hitung berapa
`source_file` yang masih ada di disk. Dan penanda paling jujur di folder itu ternyata
`manifest.json`, yang diam di 31 Juli sampai `--update` benar-benar berjalan.

## Prinsip desain

Tujuh prinsip berikut mengikat semua fase; perubahan yang melanggar salah satunya ditolak, sebagus apa pun hasilnya.

1. **Yang belajar adalah sistem, bukan model.** Pembelajaran disimpan sebagai aturan, skill, dan statistik yang bisa dibaca manusia. Mengganti LLM tidak menghapus apa pun.
2. **Owner Sovereignty.** Tidak ada skill, aturan routing, atau ambang batas baru yang aktif tanpa persetujuan Owner (No Silent State Transition).
3. **Mode bayangan dulu.** Setiap komponen baru berjalan di belakang layar dan hanya mencatat, meniru pola `hakim_bayangan`. Ia baru boleh memengaruhi jawaban setelah datanya terbukti.
4. **Minimisasi data.** Tabel roda gila tidak menyimpan isi percakapan, hanya metadata dan potongan pengenal yang sangat pendek. Setiap baris wajib punya `user_id` dan dilindungi RLS.
5. **Retensi sejak hari pertama.** Setiap tabel punya batas umur. Event mentah diringkas berkala menjadi statistik agregat, lalu dihapus.
6. **Tidak ada kegagalan diam-diam.** Telemetri boleh gagal tanpa mematikan jawaban, tetapi setiap kegagalan dihitung dan dilaporkan ke SystemGovernorService.
7. **Satu file, satu tugas.** Setiap tahap roda gila (catat, nilai, distilasi, terapkan, ukur) adalah modul terpisah dengan kontrak yang jelas.

## Roadmap per fase

&#91;embedded content: roadmap data flywheel · 5 fase, 4 gerbang\]

Fase berjalan berurutan, dan setiap gerbang adalah keputusan Owner berdasarkan angka, bukan tanggal. Tanggal tiap fase baru ditetapkan setelah baseline Fase 0 terkumpul.

### Fase 0: Catat dan nilai

Urutan diubah di Revisi 1: **yang paling menentukan ditaruh pertama**, dan yang riwayat sudah jawab
tidak dikerjakan dua kali.

- [ ] **Penanda pemilih model** pada tiap panggilan: `owner` (pilih di Settings), `tier-auto`
      (sistem), atau `override`. **Ini butir paling penting di seluruh Fase 0** — tanpa ia, setiap
      angka biaya tercemar dan North Star tak bisa dibaca
- [ ] **Hitung baseline dari riwayat yang sudah ada** (92 keputusan router, 465 pesan Owner) sebelum
      menulis instrumentasi baru — ini sudah sebagian dikerjakan di bagian Kondisi di atas
- [ ] Tabel ramping `keputusan_router` **hanya untuk yang riwayat TIDAK bisa jawab**: kata kunci
      **mana** yang memicu, durasi, dan biaya per keputusan. Tanpa isi pesan
- [ ] Nama kolom mengikuti konvensi OpenTelemetry GenAI
- [ ] Tombol 👍/👎 di frontend, terhubung ke `trace_id`
- [ ] Retensi otomatis dan ringkasan agregat — **termasuk retrofit untuk `agent_logs` yang sudah
      15.030 baris**
- [ ] Kegagalan telemetri dihitung dan dilaporkan ke SystemGovernorService
- [x] ~~Segarkan graphify~~ — **✅ SELESAI 18 Okt** dengan `graphify . --update --code-only`
      (nol kunci API, nol token). Terbukti dengan angka, bukan dengan "sudah dijalankan": node mati
      **951 → 0**, cakupan kode hidup **41% → 100%**, `AssistantService.js` akhirnya masuk.
      `cluster-only` saja **tidak cukup** — sempat dicoba hari yang sama dan hasilnya identik.
      Sisa diketahui: 498 dokumen dilewati, 29 `.sql` butuh `graphifyy[sql]`

Gerbang 1: **≥ 99% panggilan model punya penanda pemilih**, minimal 100 pesan tercatat, cakupan
pencatatan ≥ 99%, dan nol isi percakapan tersimpan.

### Fase 1: Router berbasis bukti

**Tujuan fase ini diubah di Revisi 1: latensi dan keandalan, bukan biaya.** Biayanya memang hanya
2,6%; menjanjikan penghematan di sini berarti menjanjikan sesuatu yang datanya sudah membantah.

- [x] ~~Analisis baseline: persentase jalur mahal dan kata kunci pemicu terbanyak~~ — **sudah
      dikerjakan 18 Okt dari riwayat** (lihat Kondisi saat ini, temuan 1 & 2)
- [ ] **Ganti pencocokan substring menjadi kata utuh**, dan buang kata tanya dari daftar
- [ ] **Uji di mode bayangan terhadap 465 pesan lama lewat SQL** — tanpa deploy, tanpa menunggu:
      hitung berapa pesan berpindah jalur. Mode bayangan yang gratis dan instan
- [ ] **Kegagalan router berhenti jatuh ke jalur mahal** — tentukan default yang aman saat
      klasifikasi gagal (temuan 4)
- [ ] Sebagian kecil pesan disisihkan sebagai pembanding (held-out)
- [ ] Owner menyetujui aturan baru sebelum aktif

Gerbang 2: **latensi pesan salah-rute turun ≥ 30%**, kegagalan router tidak lagi menempuh jalur
mahal, dan tidak ada guardrail yang memburuk. **Biaya tidak dipakai sebagai gerbang di fase ini.**

### Fase 2: Evaluasi otomatis

- [ ] Bandingkan vonis `hakim_bayangan` dengan penilaian 👍/👎 Owner
- [ ] Tetapkan batas kapan hakim cukup dipercaya untuk membantu menilai

Gerbang 3: hakim sepakat dengan Owner pada ≥ 80% sampel.

### Fase 3: Skill dari pengalaman

**Koreksi Revisi 1: mekanisme skill sudah ada.** `SkillRegistry.js`, `SkillGuardService.js`, dan
eksekutor di `AssistantService._handleSkill` sudah berjalan (menjalankan `skill.steps` berurutan,
bisa bertanya di tengah jalan, memancarkan `Skill:Started/Completed/Error`). Fase ini **menambah
distilasi dan gerbang di atasnya**, bukan membangun dari nol.

- [ ] **Periksa dulu** apakah sisa 1226 baris `engineer.js` benar-benar menghalangi titik distilasi —
      ADR-0017 sudah memecahnya jadi 14 modul; memecah lagi tanpa bukti adalah kerja dua kali
- [ ] Modul distilasi mengusulkan skill berstatus PENDING, lengkap dengan sesi asal dan versi
- [ ] UI persetujuan Owner: setuju, tolak, atau hapus dengan tombstone
- [ ] Skill aktif diambil lewat RAG

Gerbang 4: pada tugas berulang yang memakai skill, **jumlah panggilan model turun ≥ 30%** dengan
tingkat 👍 tetap. (Dipakai jumlah panggilan, bukan biaya — lihat North Star Revisi 1.)

### Fase 4: Tata kelola matang

- [ ] Tinjauan bulanan North Star dan guardrail
- [ ] Mekanisme rollback untuk aturan routing dan skill
- [ ] Pemetaan kontrol ke empat fungsi NIST AI RMF

Selesai bila tinjauan bulanan berjalan 3 bulan berturut-turut.

## Metrik dan cara mengukur

North Star dihitung per bulan dari tabel yang sudah ada (`cost_ledger`) ditambah tabel keputusan dan umpan balik baru:

```latex
\text{Biaya per jawaban berhasil} = \frac{\text{Total biaya API sebulan}}{\text{Jumlah jawaban berhasil sebulan}}
```

| Metrik | Jenis | Sumber data | Kapan dibaca |
| --- | --- | --- | --- |
| Biaya per jawaban berhasil **saat sistem yang memilih model** | North Star | `cost_ledger` + penanda pemilih + tabel umpan balik | Bulanan |
| **Panggilan model & token per jawaban berhasil** (semua kondisi) | North Star pendamping | `cost_ledger` per `trace_id` | Bulanan |
| **Cakupan penanda pemilih model** | Kesehatan pipeline | `cost_ledger` | Harian, otomatis |
| **Selisih biaya seandainya memakai tier murah** | Informasi untuk Owner | `cost_ledger` + `model_pricing` | Per jawaban, di layar |
| Tingkat 👍 dari jawaban yang dinilai | Guardrail | Tabel umpan balik | Mingguan |
| Persentase pesan ke jalur sub-agent | Diagnostik | Tabel keputusan router | Mingguan |
| Persentase keputusan oleh kata kunci vs LLM | Diagnostik | Tabel keputusan router | Mingguan |
| Tingkat pengulangan (regenerate/retry) | Sinyal implisit | Event frontend | Mingguan |
| Kesepakatan hakim bayangan dengan Owner | Guardrail | `hakim_bayangan` + umpan balik | Bulanan |
| Cakupan pencatatan (request tercatat ÷ total request) | Kesehatan pipeline | Tabel keputusan router vs `api_usage` | Harian, otomatis |
| Jumlah kegagalan telemetri | Kesehatan pipeline | Penghitung di SystemGovernorService | Harian, otomatis |

Aturan membaca angka, mengikuti Rule #39 Google: perubahan hanya dipertahankan jika North Star membaik **dan** tidak ada guardrail yang memburuk. Jika North Star naik tetapi tingkat 👍 turun, perubahan dibatalkan.

Karena pengguna hanya satu Owner, jumlah sampel kecil. Keputusan baru diambil setelah minimal 100 pesan per periode pembanding, dan perbandingan dilakukan sebelum-sesudah pada jenis pesan yang sama.

## Risiko dan mitigasi

Risiko terbesar bukan teknis, melainkan roda gila yang memperkuat kesalahan tanpa ada yang menyadarinya.

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Skill poisoning: konten web dari Tier 3 menyisipkan instruksi jahat yang ikut "dipelajari" | Sistem menjalankan perilaku berbahaya secara permanen | Owner Gate untuk setiap skill; catat sesi asal, versi, dan tombstone saat dihapus; skill dari sesi yang memakai Tier 3 ditandai khusus |
| Lingkaran umpan balik (feedback loop) | Router hanya belajar dari jalur yang pernah dipilihnya sendiri, sehingga kesalahan awal makin kuat | Sisihkan sebagian kecil pesan ke jalur alternatif sebagai pembanding, mengikuti praktik held-out Rule #34 Google |
| Sampel terlalu sedikit (cold start) | Keputusan diambil dari kebetulan, bukan pola | Minimal 100 pesan per periode pembanding; utamakan sinyal eksplisit 👍/👎 |
| Hukum Goodhart: metrik menjadi target | Biaya turun tetapi kualitas rusak | North Star selalu dibaca bersama guardrail kepuasan dan kejujuran sumber |
| Database penuh lagi | Sistem melambat atau berhenti | Retensi otomatis, ringkasan agregat, dan pemantauan ukuran tabel |
| Telemetri mati diam-diam | Roda gila berhenti tanpa diketahui | Metrik cakupan pencatatan harian dengan peringatan Kritikal di SystemGovernorService |
| **Metrik tercemar pilihan Owner** (Revisi 1) | North Star naik-turun mengikuti selera model Owner, bukan kepintaran sistem; keputusan diambil dari angka yang salah | Penanda pemilih model wajib; biaya hanya dipakai menilai sistem saat sistem yang memilih; selain itu pakai panggilan & token |
| **Gagal-mahal** (Revisi 1) | Setiap kegagalan klasifikasi menempuh jalur sub-agent — 6 kejadian sudah tercatat | Tentukan default aman saat router gagal, dan hitung kegagalannya sebagai metrik, bukan hanya `console.warn` |
| **Mengejar penghematan di tempat yang salah** (Revisi 1) | Usaha besar di routing menghasilkan ≤ 2,6%, lalu roda gila dianggap gagal padahal salah sasaran | Setiap target penghematan wajib disertai hitungan porsi biayanya lebih dulu, dari `cost_ledger` |
| Kebocoran data antar-tenant | Pelanggaran privasi | `user_id` wajib, RLS menyala, dan cabut hak bawaan `anon`/`authenticated` seperti pada `hakim_bayangan` |

## Glosarium

| Istilah | Arti sederhana |
| --- | --- |
| Data flywheel | Siklus: lebih banyak pemakaian menghasilkan data, data memperbaiki sistem, sistem yang lebih baik dipakai lebih banyak |
| North Star | Satu angka utama yang menjadi arah semua perbaikan |
| Guardrail | Angka pengaman yang tidak boleh memburuk saat North Star dikejar |
| Baseline | Kondisi awal sebelum perubahan, dipakai sebagai pembanding |
| Mode bayangan (shadow mode) | Komponen berjalan dan mencatat, tetapi tidak memengaruhi jawaban |
| Intent router | Bagian yang memutuskan apakah pesan dijawab langsung atau dikirim ke sub-agent |
| Skill | Prosedur tertulis hasil pengalaman yang bisa dipakai ulang untuk tugas serupa |
| Owner Gate | Titik persetujuan wajib oleh Owner sebelum perubahan aktif |
| Retensi | Batas umur data sebelum diringkas atau dihapus |
| Feedback loop | Sistem belajar dari keputusannya sendiri sehingga kesalahan bisa makin kuat |
| Held-out | Sebagian kecil data yang sengaja disisihkan sebagai pembanding yang jujur |
| Telemetri | Catatan otomatis tentang apa yang dilakukan sistem |

### Sumber

- [Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml), Google for Developers
- [MLOps: Continuous Delivery und Pipelines zur Automatisierung im maschinellen Lernen](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning?hl=de), Google Cloud Architecture Center
- [NIST Risk Management Framework Aims to Improve Trustworthiness of Artificial Intelligence](https://www.nist.gov/news-events/news/2023/01/nist-risk-management-framework-aims-improve-trustworthiness-artificial), NIST
- [OpenTelemetry GenAI Semantic Conventions](https://github.com/open-telemetry/semantic-conventions-genai), OpenTelemetry
- Repo `mamet334/mamet-ecosystem`, commit `f279c49`
