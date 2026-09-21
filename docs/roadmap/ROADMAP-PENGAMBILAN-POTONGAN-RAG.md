# ROADMAP: PENGAMBILAN POTONGAN RAG — DIUKUR DULU, POLA STANDAR HANYA BILA COCOK

**Tipe Dokumen:** Engineering Roadmap
**Area:** Pencarian dokumen (`agent-process` `lib/rag/document_search.ts`, RPC `match_documents`), pemotongan (`vector_utils.ts`), alat uji (`frontend/node_modules/.uji-rag/`, di luar git)
**Status:** ✅ **Tahap A–C selesai (2026-09-17)**: recall@8 13/14 → 14/14 (B), bukti Kepbup #1 semua (C); live
**Tanggal:** 2026-09-17
**Roadmap Index:** Item 90 (payung Item 89)

---

## 1. Latar

Perjalanan RAG di INDEX (Item 52–89) dikerjakan **reaktif**: tiap gejala ditambal di tempatnya, masing-masing
berbukti tetapi lokal. Tidak pernah ada peta pembanding jalur RAG kita terhadap pola yang umum dipakai, dan
pengukuran **pengambilan potongan** (bukan jawaban) baru dilakukan 2026-09-17 lewat skrip penyelidikan
Item 89 — yang langsung membuktikan potongan benar berada di peringkat #15–16 sementara hanya 8 yang diambil.

**Prinsip Owner (2026-09-17):** pola standar dipakai **hanya bila cocok** dengan sistem Mamet; bila tidak
cocok, tidak dipakai — sistem punya jalannya sendiri. Kecocokan dinilai dengan **bukti di sistem ini**, dan
alasan menolak dicatat supaya tidak dibahas ulang.

---

## 2. Peta Jalur RAG Mamet terhadap Pola Umum

Keterangan: **Jalan sendiri** = sengaja berbeda karena kebutuhan/arsitektur Mamet · **Belum** = pola umum
cocok tetapi belum dipakai · **Ditolak** = tidak cocok.

| Tahap | Pola umum | Mamet sekarang | Penilaian |
|---|---|---|---|
| Membaca dokumen | Parser tata letak di server (Docling, Unstructured, LlamaParse) | pdf.js/mammoth di browser (69), tabel DOCX→Markdown (76), OCR tabel PDF (76b/86), centang dari koordinat (88) | **Jalan sendiri** — ekstraksi di browser, tanpa server Python; parser server = perubahan arsitektur, belum diperlukan sebelum ada angka |
| Memotong | Potong menurut struktur + konteks dokumen di tiap potongan | 800 huruf (70) + judul tabel diulang (76) + daftar bernomor utuh (87) | **Belum** (sebagian): konteks bagian/identitas berbasis aturan → **Item 89** |
| Konteks potongan buatan model | Contextual Retrieval: model menulis konteks tiap potongan | — | **Ditolak** — dibayar saldo pengguna per potongan (Kepbup ±2.500 potongan), butuh pemrosesan latar tanpa kunci sistem (BYOK) |
| Mencari | Hybrid: kata kunci (full-text/BM25) + vektor, digabung | Vektor saja, 8 teratas, ambang 0,55 (65); penulisan ulang pertanyaan (67) | ✅ **Dipakai (Tahap B, 2026-09-17)** — `match_documents_hybrid`: RRF vektor + kata persis di database, live v455 |
| Mengurutkan ulang | Reranker (model/API) | — | **Ditunda** — butuh panggilan model berbayar per pertanyaan; dinilai hanya bila Tahap B + Item 89 belum cukup |
| Potongan tetangga / induk | Parent–child, tetangga | Tidak ada (`document_chunks` tanpa nomor urut — Item 87) | **Ditunda** (U6) — perubahan skema + unggah ulang; dinilai sesudah angka Tahap A–C |
| Menjawab & mengutip | Kutipan ID potongan | Label VERIFIED dijaga kode: sumber (71), kutipan (73), angka (77/81), rujukan (79), centang (88) | **Jalan sendiri** — tuntutan "kebenaran di atas biaya"; **dibekukan**: tidak ditambah aturan baru sampai pengambilan dibenahi |
| Evaluasi | Retrieval recall@k + mutu jawaban sejak awal | Uji mutu jawaban 13 pertanyaan (78) — **dasar datanya sudah tidak ada** (§3) | **Belum** (retrieval) → **Tahap A** |

---

## 3. Utang Lama RAG (diperiksa ulang 2026-09-17 terhadap kode & database)

Sisa pekerjaan yang dulu tercatat tersebar di bullet "Dicatat, belum dikerjakan" berbagai item. Dikumpulkan di
sini supaya tidak ada lagi sisa yang tercecer; bullet lama diberi rujukan ke bagian ini (kini di `INDEX-ROADMAP-ARSIP-2026-09-17.md`).

| # | Asal | Temuan (bukti hari ini) | Keputusan |
|---|---|---|---|
| U1 | Item 78–81 | "Uji mutu RAG dinyatakan cukup" diukur pada HCDP + KATALOG-PENDAS. **KATALOG-PENDAS (813 potongan) & Operator Handbook (827) sudah tidak ada di database** — akun Owner kini 11 dokumen / 288 potongan; KAT-01..03 tak bisa dijalankan. Set tidak memuat PDF-OCR maupun dokumen peraturan. | **Dikerjakan di Tahap A** — set dibangun ulang dari dokumen yang ada. |
| U2 | Item 76 (riset PDF) vs Item 89 | Awalan judul bagian per potongan pernah **dibuang** (rata skor 0,7476 → 0,7021/0,7139; semua pertanyaan kata kuncinya ada di potongan). Item 89 mengukur **naik** +0,08–0,12 untuk pertanyaan yang menyebut nama jabatan yang tak ada di potongan. Belum pernah didamaikan. | ✅ **Didamaikan (Tahap C, 2026-09-17)** — konteks hanya untuk dokumen beridentitas: HCDP (kata kunci ada di potongan) identik & peringkat sama; Kepbup (nama jabatan tak ada di potongan) naik +0,07–0,12. [log](../project-memory/changelog/2026-09-17-konteks-potongan-bagian-dan-identitas.md) |
| U3 | Item 70 | 9 dokumen lama (Mei–September) masih berpotongan **1.000–4.500 huruf** (183 potongan: C++, Matematika Dasar, `2026-06-24_AI.txt`, `20260910_ArsitekturRAG…`, dll.) dan ikut bersaing peringkat (`2026-06-24_AI.txt` #10 untuk Q2). | ✅ **Selesai 2026-09-17** — Owner menghapus kesembilannya sendiri (ringkasan/Wikipedia, pemotongan lama). Diperiksa di database: tersisa 2 dokumen / 105 potongan (HCDP DOCX 87, UJI-Kepbup 18), potongan yatim 0. |
| U4 | Item 67 | Ambang 0,55 dekat dasar derau (dokumen tak berhubungan 0,544–0,547); Q1 Item 89: skor #1–#16 rapat 0,702–0,648. | **Diukur 2026-09-17:** skor ke-1 NEG 0,558–0,776 vs skor bukti 0,636–0,770 — bertumpuk penuh; ambang **tidak** dinaikkan (tidak memisahkan). |
| U5 | Item 76 keterbatasan, 76b, 86 | Uji mutu jawaban jalur PDF, cek salah baca OCR, dan OCR massal buku penuh belum pernah dijalankan; detektor menandai 939/1.004 halaman Kepbup → OCR menggabungkan tabel (akar Item 88–89). | **Tahap A** memuat pertanyaan berkas uji Kepbup; OCR massal tetap menunggu keputusan 3 Item 88. |
| U6 | Item 65, 87 | `document_chunks` tanpa nomor urut → potongan tetangga mustahil. | **Ditunda** (§5) — dinilai sesudah angka Tahap A–C. |
| U7 | Item 70 | Pertanyaan bahasa Indonesia ke dokumen berbahasa Inggris ±0,05–0,10 lebih rendah; terjemahan saat pencarian kosong belum dibuat. | **Ditunda** — tidak ada dokumen berbahasa Inggris di akun saat ini (Operator Handbook terhapus). |
| U8 | Item 65 | RAG Mametlite (mode LITE) & jalur tanpa kunci OpenRouter (cadangan pencocokan kata) belum terbukti live. | **U8a ✅ 2026-09-21** — RAG Mametlite terbukti live (7 potongan, VERIFIED + Sumber benar) sesudah dua perbaikan: layar Pengaturan kunci (Mametlite buntu di `NO_API_KEY`) dan `judulDokumen`/`isiDokumen` di dua jalur streaming `synthesis_handler.ts` (VERIFIED sah selalu diturunkan). [log](../project-memory/changelog/2026-09-21-mametlite-pengaturan-kunci-dan-label-stream.md). **U8b terbuka, rumusan dikoreksi:** "tanpa kunci" tak tercapai (gerbang BYOK menolak lebih dulu); yang perlu dibuktikan = cadangan pencocokan kata saat **kunci ada tetapi embedding gagal**. **Temuan baru:** mode LITE tak pernah aktif — `request_parser.ts` memberi bawaan `ASSISTANT`, Mametlite dapat 8 potongan bukan 10 (memori tetap benar lewat `appSource`); keputusan Owner sesudah diukur. |
| U9 | Item 73 | Aturan kutipan persis hanya prompt, tidak ditegakkan kode. | **Tidak dikerjakan** — label dibekukan (§2). |
| U10 | Item 88 Tahap 3 (konteks chat 2026-09-17) | Prompt mode LOOKUP memuat **dua instruksi label yang bertentangan**: `request_pipeline.ts` "Untuk mode LOOKUP: [Pengetahuan umum AI …]" dan BLOK 6 (Evidence Gate PASSED) "VERIFIED / HYPOTHESIS / INSUFFICIENT". Tidak memengaruhi pengambilan potongan (vektor & batas 8 sama dengan ASSISTANT). | ✅ **Selesai 2026-09-21** — `request_pipeline.ts` menunjuk ke BLOK 6 (satu-satunya yang tahu ada/tidaknya dokumen). Bukti live: LOOKUP + dokumen → VERIFIED + Sumber; LOOKUP tanpa dokumen → label ringkas. [log](../project-memory/changelog/2026-09-21-label-lookup-satu-sumber-aturan.md) |

**Kode mati yang dibersihkan (2026-09-17, diperiksa pemanggilnya lebih dulu):**
- `RetrievalOrchestrator` Tier 1 (dokumen lewat pencocokan kata di browser) — satu-satunya pemanggil
  `retrieve()` (`AssistantService.js`) selalu mengirim `skipLocalKnowledge: true` sejak Item 65.
- Pendaftaran `KnowledgeService` & `RetrievalStrategyService` di `Kernel.js` — tak ada pemakai lain di browser.
  **Berkasnya tetap:** dipakai server `context_builder.ts` sebagai cadangan pencocokan kata.
- `KnowledgeService.indexDocument()` — tanpa pemanggil di web, server, Mametlite; event `Knowledge:Indexed`,
  `Retrieval:Completed/Failed` tak punya pendengar.
- Bobot strategi `case_a_full_read` / `case_a_neighbor_expansion` — tak lagi dihasilkan sejak Item 65.

---

## 4. Urutan Kerja (disetujui Owner 2026-09-17)

### Tahap A — Set Uji Pengambilan Potongan (alat ukur)

**Tujuan:** setiap perubahan pencarian/pemotongan diukur dengan angka yang sama, sebelum deploy.

- **Set dibangun ulang dari dokumen yang ADA di database** (U1): HCDP-01..08 dan NEG-01..02 dari set uji mutu
  lama (KAT-01..03 dikeluarkan — KATALOG-PENDAS sudah terhapus) + pertanyaan berkas uji Kepbup (Q1 tingkat
  kepentingan pelatihan teknis, Q2 pengalaman mutlak, pendidikan/pangkat). Dokumen yang ditambahkan kelak
  masuk set dengan minimal 3 pertanyaan. Per 2026-09-17 (sesudah U3) akun Owner berisi 2 dokumen / 105 potongan — set Tahap A memakai keduanya.
  Potongan yang **seharusnya** terambil ditandai dengan **teks bukti** (bukan ID — ID berubah tiap unggah
  ulang). Kunci jawaban tetap dikonfirmasi Owner (catatan draf-1 set uji mutu).
- **Skrip** (di luar git, pola `selidiki-potongan-persyaratan.js`): embedding pertanyaan lewat jalur aplikasi
  (BYOK), `match_documents` tanpa ambang → untuk tiap pertanyaan: peringkat potongan bukti pertama, skor,
  skor ke-8, **recall@8** (bukti masuk 8 teratas), dan untuk NEG: skor teratas (tidak boleh ada potongan
  "meyakinkan" yang salah).
- **Keluaran:** berkas JSON + ringkasan; hasil baseline dicatat di changelog sebagai angka acuan.
- **Biaya:** ±16 embedding pertanyaan per putaran (< $0,001).
- **Selesai bila:** baseline tercatat; skrip bisa diulang dengan hasil identik (kontrol: skor = database).
- ✅ **Selesai 2026-09-17** — set 17 pertanyaan (HCDP-01..08, KEP-01..06, NEG-01..03; kunci diperiksa ke DOCX/PDF
  asli 17/17), skrip `uji-pengambilan.js`. **Acuan: recall@8 13/14** — gagal KEP-01 (#15), KEP-05 di batas (#8);
  skor ke-1 NEG 0,558–0,776 bertumpuk dengan skor bukti 0,636–0,770 (U4: ambang bukan jalan keluar). Rincian:
  [changelog](../project-memory/changelog/2026-09-17-uji-pengambilan-potongan-baseline.md).

### Tahap B — Pencarian Hybrid (kata kunci + vektor)

**Tujuan:** pertanyaan yang memuat istilah persis ("Sekretaris DPRD", "MKWN4110", "IP-ASN") tidak kalah oleh
potongan yang hanya mirip makna.

- **Nilai kecocokan dulu (lokal/SQL, $0):** full-text Postgres pada `document_chunks.content`. Konfigurasi
  `simple` + daftar kata umum yang dibuang — mulai dari
  `DEFAULT_STOPWORDS` yang sudah ada di `KnowledgeService.js` (cadangan pencocokan kata server), bukan daftar baru. Ukur di set Tahap A **sebelum** mengubah server: dengan SQL langsung, apakah potongan bukti naik
  peringkat bila skor kata kunci digabung.
- **Penggabungan:** Reciprocal Rank Fusion (peringkat vektor + peringkat kata kunci) — tanpa menyetel bobot
  skor yang berbeda skala. Ambang 0,55 & batas 8 potongan **tidak diubah** di tahap ini.
- **Perubahan skema** (kolom `tsvector` + indeks GIN, RPC baru) diajukan ke Owner sebagai migrasi terpisah
  sebelum diterapkan; RPC lama tetap ada sampai hybrid terbukti.
- **Ditolak bila:** recall@8 tidak naik, atau NEG-01/02 mulai mengambil potongan yang menyesatkan.
- **Selesai bila:** recall@8 set Tahap A naik tanpa penurunan pertanyaan yang sudah benar; live terbukti.
- ✅ **Selesai 2026-09-17** — migrasi `20260917073305_match_documents_hybrid` (kolom `fts` + GIN, RPC
  `match_documents_hybrid`, anon tanpa hak), `document_search.ts` memakai RPC gabungan + cadangan
  `match_documents`, kata kunci dari `kataKunciPencarian` (`KnowledgeService.js`, dipakai server & skrip uji).
  **recall@8 13/14 → 14/14** (KEP-01 #15 → #3, KEP-05 #8 → #5), stabil pada k 10–100. Live v455: Q1 dijawab
  "Penting" VERIFIED (sebelumnya pengetahuan umum/HYPOTHESIS). Rincian:
  [changelog](../project-memory/changelog/2026-09-17-pencarian-gabungan-vektor-kata.md).
- **Penyimpangan dari rancangan:** catatan "Postgres tidak punya kamus bahasa Indonesia" **keliru** — PostgreSQL
  17 membawa konfigurasi `indonesian`. Diukur: sama 14/14 pada k=60, tetapi KEP-04/05 & HCDP-04 turun peringkat
  dan KEP-05 gagal pada k=10 (pemotong imbuhan kebablasan: "berapa"→apa, "pengalaman"→alam, "jabatan"→jabat).
  **Tetap `simple`; kamus = opsi terukur**, diukur ulang bila set uji memuat pertanyaan berbentuk kata berbeda
  dari dokumen (mis. "seberapa penting" vs "Tingkat Pentingnya") yang gagal.
- **Tidak berubah:** skor ke-1 pertanyaan NEG tetap bertumpuk dengan skor bukti (U4); potongan halaman 1 Kepbup
  (satu-satunya yang memuat nama jabatan) masih di #1 untuk KEP-03/04/06 → Tahap C.

### Tahap C — Konteks Potongan (Item 89)

Dikerjakan sesuai [`ROADMAP-KONTEKS-POTONGAN-RAG.md`](./ROADMAP-KONTEKS-POTONGAN-RAG.md) (keputusan 1–3
sudah diambil), **diukur dengan set Tahap A** bersama hasil Tahap B — bukan berdiri sendiri. Tahap 2 Item 89
("ukur skor keluaran kode") memakai skrip Tahap A dan mengukur **kedua** jenis pertanyaan (U2).

- ✅ **Selesai 2026-09-17** — `rag-process` + `agent-process` di-deploy, berkas uji diunggah ulang (`b604d31b…`,
  19 potongan, korpus 106). Set uji hybrid: recall@8 **14/14**; KEP-01 #3 → **#1**, KEP-03/04 #2 → #1, KEP-05 #5 → #1,
  KEP-06 #3 → #1 (skor bukti +0,07–0,17); HCDP sama. Web live: Q1 menyebut ketiga pelatihan "Penting", Q2 eselon III,
  keduanya VERIFIED. Rincian: [changelog](../project-memory/changelog/2026-09-17-konteks-potongan-bagian-dan-identitas.md).
- **Diluruskan:** catatan "wajib ukur ulang acuan sebelum Tahap C" (Item 91) — unggahan ulang `b604d31b…` sudah
  **hasil pemotong Tahap C**, jadi pengukurannya adalah hasil Tahap C, bukan acuan baru. Hapus ganda:
  [changelog Item 91](../project-memory/changelog/2026-09-17-hapus-dokumen-cek-baris-terhapus.md).
- **Sisa:** pertanyaan NEG tetap membawa potongan ke konteks (U4, penjaga = label); buku Kepbup penuh menunggu
  keputusan 3 Item 88; U6, U7, U8b tetap ditunda (§3); U8a & U10 ✅ selesai 2026-09-21.

**Urutan A → B → C** dipilih karena A adalah alat ukur keduanya; B tidak mengubah potongan (tanpa unggah
ulang) sehingga efeknya terukur bersih; C mengubah potongan dan butuh unggah ulang (keputusan 3 Item 89).

---

## 5. Hal yang Sengaja Tidak Dikerjakan Sekarang

- Parser tata letak di server, reranker, konteks buatan model, penyimpanan berkas asli, skema potongan
  berurut (U6), terjemahan pertanyaan (U7), pembuktian LITE/tanpa kunci (U8) — dinilai ulang **hanya bila**
  angka sesudah Tahap A–C masih menunjukkan potongan benar tidak terambil.
- Aturan label baru (Item 71–88) — dibekukan sampai Tahap C selesai.

---

## 6. Risiko

- **Set uji kecil** (17 pertanyaan, 2 dokumen) — angka bisa menyesatkan untuk dokumen lain; diperluas
  bertahap, tiap dokumen baru minimal 3 pertanyaan.
- **Kata kunci bahasa Indonesia** tanpa pemotong imbuhan (`simple`): "pelatihan" ≠ "latih" — hybrid membantu
  istilah persis, bukan variasi kata. Kamus `indonesian` sudah diukur (lebih buruk di set sekarang, Tahap B).
- **Skrip uji di `node_modules/.uji-rag`** tidak dipantau Vite — skrip yang diubah wajib nama berkas baru
  (`uji-pengambilan-v3.js` sekarang).
- **Kunci jawaban set uji** — diperiksa ke dokumen asli 2026-09-17 (17/17); pertanyaan baru wajib diperiksa sama.
- **Dokumen di akun berubah** (terhapus/diunggah ulang) mengubah angka. Setiap hasil Tahap A mencatat daftar
  dokumen & jumlah potongan saat diukur — pelajaran U1.
