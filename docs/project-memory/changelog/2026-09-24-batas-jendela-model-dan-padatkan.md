# Batas jendela model, tombol "Padatkan", dan biaya endpoint samping yang tidak tercatat

**Tanggal:** 24 September 2026
**Roadmap:** [`ROADMAP-ENGINEER-MANDIRI.md`](../../roadmap/ROADMAP-ENGINEER-MANDIRI.md) — sisa pekerjaan Tahap 3a
**Status:** ✅ selesai & terbukti live (kecuali satu bagian yang disebut jujur di bawah)

Menutup dua sisa yang ditinggalkan Tahap 3a: **batas jendela model belum ikut dihitung** dan **tombol
"Padatkan" belum ada**. Di tengah jalan, uji live membuka cacat ketiga yang tidak ada di rencana.

---

## 1. Batas jendela model

### Masalah

`anggaranKonteks` sudah menerima `batasModel` dan memotongnya ke 60% sejak Tahap 3a, tetapi tidak ada
tempat menyimpan panjang jendela tiap model — `AssistantService` mengisinya `undefined`. Jadi yang
membatasi konteks murni **biaya**.

Diukur dengan harga asli di `model_pricing`:

```
gpt-4o-mini      batas $3/hari -> anggaran 1.000.000 token | jendela nyata   128.000  MELEBIHI
llama-3.1-8b     batas $3/hari -> anggaran 3.000.000 token | jendela nyata   131.072  MELEBIHI
deepseek-v4-pro  batas $3/hari -> anggaran   258.843 token | jendela nyata 1.048.576  aman
```

Bukan risiko teoretis: begitu Owner pindah ke model murah, permintaannya ditolak OpenRouter. Yang
menyelamatkan selama ini hanyalah kebetulan bahwa model Engineer berjendela sejuta.

### Sumber angkanya

Owner menunjuk dokumen ringkasan katalog OpenRouter sebagai acuan. Dokumen itu **sahih** — delapan
angka yang diperiksa ulang ke `openrouter.ai/api/v1/models` cocok persis. Tetapi **tidak bisa dipakai**
sebagai sumber data: tak satu pun dari tujuh model di `model_pricing` ada di sana. Angkanya diambil
langsung dari katalog live.

### Yang dikerjakan

| Bagian | Berkas |
|---|---|
| Kolom `context_length` + isi 5 model hidup | `supabase/migrations/20260924004428_model_pricing_context_length.sql` |
| `context_length` → `batasModel` | `AssistantService.bahanAnggaranKonteks` |
| `PORSI_JENDELA_MODEL`, urutan pemotongan, `dibatasiJendelaModel` | `KonteksChat.js` |
| Meteran menyebut angka jendela & alasannya | `KonteksChat.meteranKonteks`, `ConversationEngine.jsx` |

Dua model yang **sudah hilang dari katalog** (`claude-3.5-sonnet:beta`, `gemini-2.0-flash-exp:free`)
sengaja dibiarkan `NULL`, bukan diisi tebakan dan bukan dihapus. `NULL` berarti "belum diketahui" dan
jatuh ke perilaku lama. Pelajaran Item 42: baris bernilai salah yang senyap lebih berbahaya daripada
baris kosong.

**Cacat yang ikut ketemu:** urutan pemotongannya salah. `Math.max(ANGGARAN_MIN, …)` dijalankan
*sesudah* jendela model, jadi model berjendela sangat sempit (katalog memuat entri **4.095 token**)
tetap akan dikirimi 8.000 token. Sekarang jendela memotong terakhir.

Meteran juga mengatakan terus terang bila jendela model **belum diketahui** — supaya anggaran yang
mengecil setelah ganti model tidak terlihat seperti kerusakan.

---

## 2. Tombol "Padatkan"

### Rancangan

Pesan lama diringkas jadi **satu pesan yang tetap dikirim**, lalu batas konteks digeser ke ringkasan
itu. Beda dengan "Bersihkan" yang membuang ingatannya sama sekali.

Caranya sengaja memakai mekanisme yang sudah ada: ringkasan ditempel sebagai **pesan biasa** di ujung
daftar, lalu `mulaiDari` disetel ke **indeksnya**. Tidak ada jalur konteks kedua yang harus dirawat,
ringkasan ikut tersimpan di `chats.messages`, dan Owner bisa membacanya — ringkasan yang buruk akan
terlihat, bukan tersembunyi.

Meteran konteks menjadi menu tiga pilihan (Padatkan / Bersihkan / Pulihkan), masing-masing dengan
untung-ruginya, dan satu baris tetap di kakinya: *tidak ada pilihan di sini yang menghapus pesan.*

### Kenapa peringkasan berjalan di server

Ini panggilan model berbayar, dan biayanya harus terlihat. Klien tidak boleh menulis tabel biaya mana
pun (RLS hanya `SELECT`), jadi panggilan langsung dari klien — pola `pdfOcrService` — akan jadi
pengeluaran yang tak tercatat sama sekali.

### Penolakan yang dipasang di server

- ringkasan di bawah 40 huruf;
- ringkasan yang **tidak lebih pendek** dari bahannya — peringkasan yang gagal memadatkan tapi tetap
  dipakai akan membuang percakapan tanpa menghemat apa pun.

### Yang dibatalkan di tengah jalan

Sempat mengirim `maxTokens` ke adapter untuk membatasi panjang ringkasan. `ai_adapter.ts` ternyata
**mengunci `max_tokens: 8192` sendiri** dan tidak membaca field apa pun dari input — parameter itu akan
diabaikan diam-diam. Kelihatan berpagar padahal tidak. Dibuang; panjangnya dibatasi lewat prompt dan
pemotongan di server. Ada uji yang menjaga agar tidak dipasang lagi.

### Ikon

`compress` tidak ada di subset font ikon, jadi akan tampil sebagai **tulisan** persis seperti cacat
`DATA_USAGE` sehari sebelumnya. `npm run ikon` dijalankan; subset naik 21,1 → 22,4 KB.

### Bukti live

Tiga putaran di Assistant:

| Waktu | Pesan | Ringkasan | Jendela |
|---|---|---|---|
| 01:04 | 12 | 2.021 huruf | 6,6k → 510 token (hemat 92%) |
| 01:11 | 24 | 3.015 huruf | 8,9k → 758 token (hemat 91%) |
| 01:20 | 12 | 2.352 huruf | — |

Baris chat bertambah satu pesan bertanda `isRingkasanKonteks: true`; pesan lama tetap ada.

Mutu ringkasannya diperiksa pada hal-hal yang paling mudah dirusak peringkas, dan semuanya bertahan:
hasil yang **VERIFIED dipisahkan dari HYPOTHESIS**, angka dan rujukan baris data ditulis apa adanya,
jawaban "dokumen tidak ditemukan" **tidak dihaluskan** menjadi seolah ditemukan, dan pertanyaan yang
belum dijawab Owner tetap berdiri sebagai pertanyaan.

---

## 3. Biaya endpoint samping tidak tercatat — dan koreksi atas dugaan saya sendiri

### Apa yang terjadi

Putaran live pertama (01:04) berhasil, tetapi **`api_usage` tidak menerima apa pun**; yang menerima
hanya `cost_ledger`. Proyek ini punya dua pencatat biaya dengan pembaca berbeda:

| Tabel | Ditulis oleh | Dibaca oleh |
|---|---|---|
| `cost_ledger` | `recordUsage`, **di dalam adapter** | circuit breaker (`checkGuardrails`) |
| `api_usage` | `logger.logApiUsage`, dipanggil pemanggil | RPC pemakaian **dan `bahanAnggaranKonteks`** |

Anggaran jendela konteks dihitung dari `api_usage`. Jadi biaya memadatkan tidak terlihat oleh anggaran
yang dipakai fitur itu sendiri.

### Dugaan yang keliru, dan bagaimana terbantah

Sesudah `logApiUsage` dipasang, putaran 01:11 mencatat **$0,006647** di `api_usage` untuk panggilan yang
oleh penyedia ditagih **$0,017196** di `cost_ledger` — meleset 2,6×. Saya melaporkannya sebagai temuan
sistemik: *"`api_usage` meremehkan biaya, batas harian jadi lebih longgar daripada yang Anda kira."*

**Itu salah.** Baris chat biasa 23 September mencatat $0,0047669376 di `api_usage` dan $0,004767 di
`cost_ledger` — cocok. `llm_orchestrator.ts` selalu meneruskan biaya asli penyedia sebagai argumen
kelima `logApiUsage`, dan logger memakainya mengalahkan tabel tarif.

Selisih 2,6× itu **bug di endpoint baru**, bukan sifat `api_usage`: adapter sudah mengembalikan
`usageCostUsd` dan `modelUsed`, dan saya membuang keduanya.

### Yang dikerjakan

Kedua endpoint samping (`padatkan_endpoint.ts`, `judge_endpoint.ts`) sekarang meniru pola
`llm_orchestrator`:

- meneruskan **biaya asli penyedia** (`usageCostUsd`);
- mencatat **model yang benar-benar dipakai** (`modelUsed`) — kalau penyedia tidak melaporkan biaya,
  logger mencocokkan nama model ke tabel tarif, dan nama yang salah berarti tarif yang salah (Item 41);
- mencatat **sebelum** pemeriksaan mutu yang bisa menolak hasilnya: begitu model menjawab, uangnya sudah
  keluar, entah hasilnya diterima atau ditolak;
- `await tasks.awaitAll()` di jalur **berhasil dan gagal**. Proyek ini tidak memakai
  `EdgeRuntime.waitUntil`, jadi hanya `awaitAll` yang menahan proses; tanpa itu barisnya bisa hilang
  bersama prosesnya.

`judge_endpoint.ts` punya celah yang sama sejak dibuat (Item 55) dan ikut ditutup.

### Bukti live sesudah perbaikan — 01:20:26

```
[Padatkan] 12 pesan → ringkasan 2352 huruf          01:20:26.378
cost_ledger  2519/721 t   $0,003064                 01:20:26.818
api_usage    2102/588 t   $0,0030644935             01:20:26.823
[BACKGROUND_TASK_SUCCESS] LogAPIUsage (513 ms)      01:20:26.892
```

Biayanya **identik**; bedanya hanya pembulatan 6 desimal di `cost_ledger`. Jumlah token memang tetap
berbeda — `api_usage` memakai perkiraan `panjang/4`, `cost_ledger` memakai angka penyedia — dan yang
menentukan batas harian adalah kolom biayanya. Baris `LogAPIUsage selesai (513 ms)` membuktikan
`awaitAll` benar-benar menahan prosesnya.

---

## Yang belum terbukti live

Perbaikan `judge_endpoint.ts` **baru terbukti lewat uji terhadap kodenya**. Belum ada konflik memori
yang memicunya sejak deploy, jadi belum ada baris `api_usage` untuk membuktikannya.

---

## Uji otomatis (di luar git)

| Berkas | Isi |
|---|---|
| `uji-jendela-model.mjs` v1, **42/42** | 5 model × 5 batas harian, jendela 4.095, urutan pemotongan, 4 uji kendali (jendela lebar, tanpa data, NULL, 0), meteran, pemasangan di jalur nyata |
| `uji-padatkan-konteks.mjs` v1, **50/50** | bahan ringkasan, syarat tombol, pesan ringkasan, pengecilan jendela, pembantu sisi server lewat esbuild, pemasangan, nama ikon vs subset font |
| `uji-biaya-endpoint.mjs` v1, **21/21** | 5 syarat pencatatan × 2 endpoint, + 2 uji kendali yang membuktikan jalur chat biasa memang sudah benar |

`uji-biaya-endpoint.mjs` menggantikan `uji-padatkan-biaya.mjs` yang **terlalu lemah**: ia hanya memeriksa
"`logApiUsage` dipanggil", dan pada putaran 01:11 syarat itu terpenuhi sementara angkanya tetap salah.

**Pelajaran terpisah untuk uji kendali:** `uji-trace-parser.mjs` gagal hari ini tanpa ada yang rusak —
kendalinya mengambil versi lama lewat `git show HEAD:…`, yang benar hanya selama perbaikannya masih di
working tree. Begitu perbaikan itu ikut di-commit, `HEAD` sudah memuatnya dan gejalanya tidak muncul.
**Uji kendali tidak boleh menunjuk `HEAD`.** Diganti `uji-trace-parser-kendali-tetap.mjs` yang memaku
revisi `abcdced`.

Seluruh **35 berkas uji lulus**. Karakter kendali: 0. `index.ts` dibundel esbuild: 478,6 KB.

---

## Sisa pekerjaan

- **Jumlah token di `api_usage` masih perkiraan** (`panjang/4`), bukan angka penyedia. Biayanya sudah
  benar, jadi batas harian tidak terpengaruh — tetapi kolom tokennya tidak bisa dipakai untuk analisis.
  Angka sesungguhnya ada di `cost_ledger`.
- Tahap 3b (ingatan temuan Engineer) belum dimulai; pertanyaan penyimpanannya (repo vs database) masih
  menunggu keputusan Owner.
