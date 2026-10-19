# 18 Oktober 2026 — penanda siapa yang memilih model, supaya metrik biaya berhenti mengukur selera

Item 126 Fase 0 ([`Roadmap Data Flywheel`](../../roadmap/Roadmap%20Data%20Flywheel%20%E2%80%94%20Mamet%20Ecosystem.md)).
Butir ini ditetapkan sebagai **yang terpenting di seluruh Fase 0** pada Revisi 1, dan Owner
memerintahkan mengerjakannya lebih dulu.

## Kenapa ia ada

North Star roda gila adalah *biaya per jawaban berhasil*. Diukur 18 Okt pada data nyata, angka itu
**tercemar**:

| | |
|---|---|
| `deepseek-v4-pro` — **Owner pilih sendiri** di Settings | **74,3%** seluruh biaya, **7×** per token dibanding `flash` |
| Seluruh jalur sub-agent (yang bisa diperbaiki sistem) | 2,6% |

Artinya bulan ketika Owner sedang memakai model mahal akan terlihat seperti **sistem yang
memburuk**, padahal sistem tidak melakukan apa pun yang salah — dan sebaliknya, sistem bisa terlihat
"membaik" hanya karena Owner sedang hemat. Tanpa memisahkan siapa yang memilih, roda gila akan
mengejar angka yang salah dengan rajin.

## Temuan yang membuat pekerjaannya murah

**Jawabannya sudah ada di klien, hanya tidak pernah dikirim.** `AssistantService` sudah membedakan
tiga cabang saat memilih model — Owner menekan pil tier, classifier memutuskan, atau tier dilewati —
tetapi hasilnya hanya dicetak ke `console.log` dan mati di situ. Server tidak punya cara menebaknya:
yang ia terima hanya nama model jadi.

Dan karena `request_pipeline.ts:194` **satu-satunya** tempat `RuntimeContext` dibuat, penandanya
cukup dipasang sekali di sana lalu dibaca di delapan titik `recordUsage`.

## Yang dikerjakan

**Basis data** — `supabase/migrations/20261018000000_pemilih_model.sql`: kolom `pemilih_model text`
pada `cost_ledger` + komentar kolom + indeks parsial (hanya baris non-NULL).

**Server** (7 berkas): `ModelConfig.pemilih` di `runtime_context.ts` · `request_parser` membaca
`pemilihModel` dari body · `request_pipeline` meneruskannya ke `rctx.model.pemilih` ·
`costTracker` menerima & menulis kolomnya · `ai_adapter` membawa penanda di **8 dari 8** titik
`recordUsage` · `judge_endpoint` dan `padatkan_endpoint` menandai dirinya `sistem`.

**Klien** — `AssistantService.js`: penanda dihitung **di blok tier**, tempat keputusannya benar-benar
diambil, lalu dikirim di tiga payload yang memanggil LLM.

| Jalur | Penanda | Alasan |
|---|---|---|
| Mode Engineer | `owner-settings` | Engineer sengaja dikecualikan dari tier — selalu model utama Settings |
| Pil tier ditekan Owner | `owner-override` | classifier dilewati sepenuhnya |
| TierClassifierService | `tier-auto` | deterministik, 0 token |
| Tier tak aktif / BrainService mati | `owner-settings` | jatuh ke model utama Settings, tetap pilihan Owner |
| Jalur LOOKUP | `tier-auto` | kodenya **memaku** `getActiveBrainContext('KECIL')` — sistem yang memutuskan murah |
| Jalur skill | `owner-settings` | `_resolveAIProvider()` memanggil `getActiveBrainContext()` **tanpa tier** |
| Hakim bayangan, pemadat konteks | `sistem` | Owner tidak memintanya dan tidak memilih modelnya |

## Tiga keputusan desain yang pantas dicatat

**1. Penanda ditaruh di `rctx`, bukan diulirkan sebagai argumen.** `recordUsage` dipanggil dari
delapan tempat yang semuanya sudah memegang `this.rctx`. Satu medan lebih sulit dilupakan daripada
delapan argumen — dan ujinya menghitung 8 dari 8, jadi yang kesembilan nanti tidak bisa lolos diam.

**2. Migrasi sengaja TANPA `CHECK` constraint.** `recordUsage` dipanggil lewat `rctx.tasks.fire()`
yang **tidak menunggu hasilnya**. Insert yang ditolak constraint akan hilang tanpa suara dan
diam-diam mematikan pencatatan biaya — persis bentuk kegagalan yang Prinsip 6 roadmap ini larang.
Nilai menyimpang lebih baik terlihat sebagai data aneh daripada menghilang bersama barisnya;
kedisiplinan nilainya dijaga uji, bukan oleh basis data.

**3. Tidak ada nilai bawaan di jalur mana pun.** Klien lama dan Mametlite tidak mengirim medan ini,
dan nilainya tercatat `NULL`. Menebak `owner-settings` untuk klien yang diam akan membuat metrik
"cakupan penanda pemilih" terlihat 100% padahal separuhnya karangan — kebohongan yang paling sulit
ketahuan karena ia berupa angka bagus. **949 baris lama** juga **tidak diisi tebakan**. (Angka 818
yang sempat dipakai berasal dari `pg_class.reltuples` — perkiraan, bukan hitungan; yang tepat
dihitung saat migrasi diterapkan.)

## Ikut ketahuan

**Kolom `caller_context` selama ini tidak mencatat pemanggil.** Namanya menjanjikan itu, tetapi
kedelapan titik panggilan mengisinya dengan `context.trace_id` — jadi isinya UUID yang menduplikasi
kolom `trace_id` di sebelahnya. Itu sebabnya ia tidak bisa dipakai untuk keperluan ini. Dicatat,
tidak diubah: mengubah kolom yang sudah berisi data bukan bagian dari butir ini.

**Server mengimpor kode klien lintas batas.** Ketahuan dari keluaran deploy: empat berkas
`frontend/` ikut terunggah **ke dalam** edge function. Penyebabnya **7 titik impor di 5 berkas
server** yang menjangkau `frontend/src/core/runtime/services/`:

| Berkas server | Baris | Modul frontend yang ditarik |
|---|---|---|
| `lib/data_tabel/data_tabel.ts` | 8 | `dataTabelAsnSaring.js` |
| `lib/orchestration/handlers/context_builder.ts` | 18, 19 | `KnowledgeService.js`, `RetrievalStrategyService.js` |
| `lib/orchestration/handlers/synthesis_handler.ts` | 8 | `folderKerjaAlat.js` |
| `lib/rag/document_search.ts` | 4 | `KnowledgeService.js` |
| `lib/request/request_pipeline.ts` | 15, 16 | `dataTabelAsnSaring.js`, `folderKerjaAlat.js` |

`git blame`: 2 dan 21 September 2026 — **bukan** dari pekerjaan ini.

Bahayanya bukan ukuran bundel. Mengubah berkas di `frontend/src/core/runtime/services/`
**diam-diam mengubah perilaku server**, dan perubahannya baru berlaku sesudah edge function
di-deploy ulang — padahal tak ada yang akan berpikir men-deploy fungsi sesudah menyentuh berkas
bernama "frontend". Bentuk kegagalannya sama dengan jebakan `config.toml` di atas: keadaan yang
benar di repo, tetapi tidak berlaku di platform sampai ada yang ingat men-deploy. Dicatat, tidak
diubah — di luar lingkup Item 126.

## Bukti

- `uji/uji-pemilih-model.mjs` (baru) — **SEMUA LULUS**, 6 bagian: kolom ada & tanpa CHECK · 8 dari 8
  titik pencatatan · tidak ada nilai bawaan di parser/pipeline · dua endpoint internal menandai
  `sistem` · tiga payload klien · **kosakata klien + server == kosakata migrasi**
- **Tiga mutasi menggigit**, dan ketiganya meniru cara cacat ini biasanya masuk:

| Mutasi | Yang memerah |
|---|---|
| satu titik `recordUsage` kehilangan penanda | *SEMUA 8 titik … (7)* |
| server diberi fallback `\|\| 'owner-settings'` | *TANPA fallback — klien yang diam tercatat NULL* |
| kosakata liar `'auto'` di klien | *jalur LOOKUP ditandai tier-auto* **dan** *tak ada nilai di luar kosakata resmi* |

- Sintaksis: klien + ketujuh berkas server lolos `esbuild`
- **Bundel `agent-process/index.ts` lolos** (514,9 kB) dan memuat 13 kemunculan penandanya — graf
  impor utuh sesudah tujuh berkas disentuh
- Suite **95/96**; satu merah `uji-alat-folder-jalan.cjs` adalah **flake J3b yang sudah terdaftar**
  (asersi waktu 3.232 ms melawan batas 3 detik) — dijalankan sendirian ia **LULUS**

## Migrasi SUDAH diterapkan — dan diperiksa, bukan dipercaya

Diterapkan ke basis data produksi 18 Okt atas izin Owner. Alat migrasinya menjawab
`{"success": true}`, dan itu **tidak dianggap cukup**; keadaannya diukur langsung sesudahnya:

| Yang diperiksa | Hasil |
|---|---|
| Kolom `pemilih_model` ada, bertipe | **ada**, `text` |
| Indeks parsial `cost_ledger_pemilih_model_idx` | **ada** |
| Jumlah CHECK constraint di `cost_ledger` | **0** — sesuai rancangan |
| Komentar kolom terpasang di basis data | **ya**, utuh |
| Baris total · yang sudah bertanda | 949 · **0** |

Nol baris bertanda adalah hasil yang **benar** pada titik ini: server dan klien belum membawa medan
itu, jadi kolomnya memang harus kosong. Kalau ia sudah terisi sekarang, justru ada yang salah.

## Deploy edge function SELESAI — dan diperiksa, bukan dipercaya

Owner menjalankan `supabase functions deploy agent-process` 18 Okt. CLI melaporkan sukses, dan itu
**tidak dianggap cukup**; keadaannya diukur lewat API Supabase sesudahnya:

| Yang diperiksa | Sebelum | Sesudah |
|---|---|---|
| `version` | 528 | **529** |
| `verify_jwt` | `false` | **`false`** — jebakan `config.toml` tidak menggigit |
| `status` | ACTIVE | ACTIVE |

Deploy ini membawa dua commit: `33623be` (penanda pemilih model) dan `b705e06` (empat berkas mati
dibuang dari fungsi live). `WARNING: Docker is not running` tidak relevan — Docker hanya untuk dev
lokal; bundelnya dikerjakan di sisi Supabase.

**Versi 529 membuktikan platform menerima kode baru. Ia TIDAK membuktikan penandanya sampai ke
kolom.** Diukur sesudah deploy: **949 baris, 0 bertanda**, baris terbaru masih 8 Okt. Itu hasil yang
benar pada titik ini — klien yang terpasang belum dirilis, jadi payload belum membawa medannya.

## Sisa satu langkah milik Owner

**Klien belum dirilis** — tanpa itu `.exe` yang terpasang mengirim payload tanpa penanda dan server
mencatat `NULL`.

Tetapi **rantai penuhnya bisa diuji sekarang, tanpa menunggu rilis**: `npm run desktop` memakai kode
repo, dan kode itu sudah membawa penandanya sejak `33623be`. Karena baris terakhir `cost_ledger`
tanggal 8 Okt, tidak ada lalu lintas yang perlu disaring — baris apa pun yang muncul berasal dari uji
itu. Yang diharapkan: satu baris `owner-settings`, atau `tier-auto` bila tier aktif dan classifier
yang memutuskan. `NULL` berarti ada sambungan putus antara klien dan kolom, dan di situlah nilai
ujinya.

## Rantai penuh TERBUKTI — 19 Okt 2026

Owner mengirim satu pesan "tes" dari `npm run desktop` (jendela dibuka 09:21:51 WIB, memuat kode repo
dari `localhost:5173`). Hasil di `cost_ledger`:

| `created_at` (UTC) | `model` | `pemilih_model` |
|---|---|---|
| 02:32:57 | `deepseek/deepseek-v4-flash-0731` | **`tier-auto`** |
| 02:33:21 | `deepseek/deepseek-v4-flash-0731` | **`tier-auto`** |

**Baris bertanda pertama dalam sejarah tabel itu** (sebelumnya 949 baris, 0 bertanda). Klien → payload →
`request_parser` → `rctx.model.pemilih` → `recordUsage` → kolom: tersambung ujung ke ujung. Nilainya
`tier-auto` karena tier aktif dan TierClassifierService yang memutuskan `flash` untuk pesan sependek itu —
persis cabang yang diharapkan, bukan `NULL`.

Sisa langkah tetap satu: **rilis klien**, supaya `.exe` yang terpasang ikut membawa penandanya.
