# ADR-0021: Kapan LLM Dipakai di Depan Alur — Mengusulkan, Bukan Memutuskan

**Status:** ACCEPTED — diputuskan Owner 2026-10-28 (keputusan atas pertanyaan terbuka di §8)
**Tanggal:** 2026-10-28
**Menafsirkan:** Design Philosophy #5 (`constitution/25`) — *"LLM is a capability provider. LLM bukan pusat sistem."*
**Tidak mengubah teks Constitution** — keputusan Owner: cukup sebagai ADR (§8.4). Bila kelak penafsiran ini ingin
dijadikan bunyi Constitution, itu amandemen terpisah yang diputuskan Owner (AGENTS.md: AI tidak boleh mengubah
Constitution).

> [!NOTE]
> **Nomor 0020 sengaja dilewati.** `ADR-015_Engineer_Self_Maintenance_Pipeline.md` sudah memesan "ADR-0020: Knowledge
> Synthesis to ADR (PROPOSED)" walau berkasnya tidak pernah ditulis. Memakai 0020 di sini mengulang tabrakan nomor
> yang pernah terjadi pada ADR-008 → ADR-0019.

## 1. Context

### 1.1 Prinsip awal

Gambaran awal Mamet: **sistem memegang alur** (Kernel First, Knowledge First, Verification Before Trust —
`constitution/00`), dan LLM dipanggil sebagai *capability* — kurang lebih "di akhir", merangkai jawaban dari bahan
yang sudah disiapkan sistem. Owner mengingatnya sebagai "LLM ada di paling akhir"; bunyi tertulisnya adalah
Design Philosophy #5.

### 1.2 Kenyataan pembangunan (diperiksa di kode, 28 Okt 2026)

LLM sudah bekerja **di depan** alur di beberapa tempat, masing-masing dengan alasan yang sah:

| Tempat | Peran LLM di depan | Penjaga yang sudah ada |
|---|---|---|
| `intent_router.ts` | mengklasifikasi pesan yang lolos daftar kata kunci: obrolan biasa atau butuh agen | — (gagal → jatuh ke jalur mahal; Item 126 temuan 4) |
| Coordinator (`intent_router.ts` fase ORCHESTRATION) | **merencanakan** sub-agent dan **menulis ulang tugas** (mis. `"Cari pemenang MotoGP 2026"`) | parser JSON + kontrak eksekusi; rencananya **tidak terlihat** Owner |
| Konektor MCP (Item 129) | **memutuskan** kapan memanggil crawler & **menyusun kata kunci** misi | dialog gerbang Owner (K8), `MAKS_PUTARAN` 6, catatan kaki dari gerbang (bukan dari teks model) |
| Engineer | lingkaran agen (baca → usulkan patch) | izin Owner untuk menulis, uji dijalankan sesudah patch (Tahap 6) |
| Hakim bayangan | menilai jawaban per kalimat | membayangi saja, tidak mengubah label (keputusan Owner 28 Sep) |
| Penulis ulang pertanyaan lanjutan RAG (`rag/query_rewrite.ts`, Item 67) | menulis ulang pesan yang merujuk percakapan ("lanjutkan, apa kendalanya?") menjadi pertanyaan mandiri | hanya bila pencarian pertama kosong; pesan mandiri dikembalikan apa adanya; **sudah tampil satu baris** "🔁 [RAG] Pertanyaan lanjutan ditulis ulang: …" |

Ditambah dua aturan **kode** (bukan LLM) yang sudah ada: `ringkasKueri()` (`web/pencarian_berita.ts`, 15 Sep) —
kalimat perintah → kata kunci untuk mesin berita, terukur 0 → 5–8 hasil Bing, tetapi **hanya** dipakai sub-agent
`researcher`/`deep_research`; dan `kataKunciPencarian()` (`KnowledgeService.js`, Item 90) — kata pengisi dibuang untuk
pencarian kata RAG. Peta ini diambil dari graf graphify 28 Okt (`graphify update .`, 0 node mati, kode 484/484) —
**ditemukan sesudah draf pertama ADR ini**, dan mengecilkan pekerjaan §7: yang tersisa mengirim pesan mentah ke mesin
pencari hanyalah web Tier 3 di klien.

Jadi "LLM hanya di akhir" sudah tidak bisa dipegang kaku. Pemicu ADR ini: **kualitas pencarian.** Pencarian web Tier 3
dan RAG memakai pesan Owner **mentah** sebagai kueri (`AssistantService.js:1340` `retrieve(userMsg)` →
`searchWeb(query)`); *"tolong carikan berita terbaru soal OKU dong"* dikirim ke Bing kata demi kata. Owner: tanpa
pemahaman maksud, pencarian "ngawur dan terlihat bodoh"; tetapi menyerahkan semuanya ke LLM terasa melanggar prinsip.

### 1.3 Pola pembanding (sistem Claude)

Model menerima daftar alat, **memutuskan sendiri** kapan mencari, **menulis kuerinya sendiri** (kata kunci, sering
beberapa), membaca hasil, dan mencari ulang bila kurang. Pola ini bekerja karena modelnya andal memakai alat. Di Mamet
model murah pernah **mengarang tindakan** (menulis seolah memanggil alat padahal tidak) — maka pola itu tidak bisa
diambil utuh tanpa penjaga kode (*Standar hanya bila cocok*; *Verification Before Trust*).

## 2. Decision

### 2.1 Pembagian peran

| LLM | Sistem (kode) | Owner |
|---|---|---|
| **Mengusulkan** — kueri, rencana, panggilan alat, kata kunci, klasifikasi | **Memvalidasi, menjalankan, mencatat, menampilkan** usulan itu | **Memutuskan** yang berdampak, lewat gerbang |

LLM boleh bekerja di mana pun dalam alur **selama ia mengusulkan**. LLM menjadi "pusat sistem" — dan itu yang
dilarang #5 — bila usulannya: dijalankan **tanpa diperiksa kode**, **tidak terlihat** Owner, atau **dipercaya karena
modelnya bilang begitu**.

### 2.2 Tangga keputusan: kapan LLM dipakai di depan

Dijawab berurutan untuk setiap titik di mana LLM ingin ditaruh di depan alur:

1. **Bisakah aturannya ditulis dan diuji dengan kode?** → **kode.** (pencocokan kata utuh, membuang kata pengisi,
   mengunci angka & singkatan, format, tanggal). Lebih cepat, gratis, hasilnya selalu sama.
2. **Butuh memahami makna yang tak bisa diaturkan?** (merujuk percakapan — "yang tadi", "dokumen itu"; sinonim;
   maksud tersirat) → **LLM mengusulkan.**
3. **Apa akibatnya bila usulan itu salah?**
   - ringan (mis. kueri pencarian) → kode memeriksa, menjalankan, dan **menampilkan** usulan;
   - berdampak (mengirim, menulis, membayar, menjalankan misi) → **gerbang Owner**.
   Gerbang harus **sebanding** (`constitution/28`): gerbang untuk hal yang sudah dijaga penjaga lain adalah cacat,
   bukan kehati-hatian.
4. **Manfaatnya terbukti sepadan dengan waktu & biayanya?** → **ukur dulu** (mode bayangan / uji mutu) sebelum
   menjadi aturan tetap.

### 2.3 Aturan wajib bila LLM mengusulkan

- **Pesan asli Owner tetap pegangan.** Hasil olahan LLM (kueri, rencana) adalah alat bantu; jawaban tetap menjawab
  pesan asli.
- **Selalu terlihat — satu baris** di langkah proses, mis. *"🔍 Dicari: `berita OKU Oktober 2026`"* (keputusan Owner
  §8.2); tidak diulang di dalam jawaban.
- **Token pasti dikunci** — nama, angka, NIP, singkatan, dan teks berkutip disalin persis (semangat Item 73 "kutip
  perintah persis").
- **Makna bercabang → tanya Owner, jangan menebak** (`constitution/24` pasal 7; keputusan Owner §8.3) — tidak
  menjalankan semua cabang diam-diam.
- **Memakai model pilihan Owner** (Design Philosophy #8) — seperti router & Coordinator sekarang.
- **Dicatat** — panggilan model ber-penanda pemilih (`cost_ledger.pemilih_model`, Item 126), supaya biaya &
  manfaatnya bisa diukur.
- **Bukti tindakan dari kode, bukan teks model.**

## 3. Alternatives

| Alternatif | Kenapa tidak dipilih |
|---|---|
| **A. "LLM hanya di akhir", kaku** | Sudah dilanggar oleh lima tempat di §1.2 yang semuanya beralasan; mempertahankannya berarti aturan yang tidak dipatuhi — atau pencarian yang tetap "ngawur" |
| **B. Pola agen penuh: model memutuskan semuanya** (seperti Claude) | Bergantung pada keandalan model memakai alat; model murah di Mamet terbukti mengarang tindakan; Owner kehilangan jejak keputusan |
| **C. Diputuskan kasus per kasus tanpa kriteria** | "Bila dibutuhkan" menjadi selera tiap sesi/asisten; tak bisa diaudit; melanggar *Deterministic Engineering* (keputusan harus bisa dijelaskan & ditelusuri) |
| **D. Tangga keputusan + peran mengusulkan/memutuskan (dipilih)** | Kode tetap yang utama; LLM masuk hanya ke bagian yang butuh makna; setiap usulan terlihat & terukur |

## 4. Consequences

**Positif**
- Pencarian bisa memahami maksud **tanpa** menyerahkan kendali: sebagian besar perbaikan ("tolong", "dong", konteks
  tanggal) dikerjakan kode; LLM hanya untuk pesan yang merujuk percakapan.
- Tempat yang sudah ada mendapat ukuran yang sama: Coordinator yang menulis ulang tugas **diam-diam** kini jelas perlu
  ditampilkan.
- Asisten/engineer berikutnya punya kriteria tertulis, bukan menebak.

**Negatif / biaya**
- Setiap titik LLM-di-depan menambah latensi & biaya → wajib diukur (tangga langkah 4).
- Menampilkan usulan menambah baris di langkah proses.

**Risiko**
- Kriteria langkah 2 ("butuh makna") tetap butuh penilaian — dimitigasi dengan langkah 4 (diukur) dan §2.3 (terlihat).
- Penulisan ulang kueri yang salah mengalihkan pencarian — dimitigasi: pesan asli tetap pegangan, kueri tampil,
  token pasti dikunci.

## 5. Impact Scope

- `supabase/functions/agent-process/lib/orchestration/handlers/intent_router.ts` (router & Coordinator)
- `frontend/src/core/runtime/services/RetrievalOrchestrator.js`, `WebComparisonService.js`, `AssistantService.js`
  (kueri RAG & web Tier 3)
- `shared/konektorAlat.js` (sudah sesuai — jadi contoh acuan; dipindah dari `frontend/src` 29 Okt, T15)
- Roadmap Item 126 Fase 1 (router berbasis bukti) dan Item 90 (pengambilan potongan RAG)

## 6. Related Components

MAEF Kernel (fase ORCHESTRATION/TOOL_EXECUTION) · Knowledge System (RAG) · Capability Port (konektor, web) ·
Owner Sovereignty (gerbang) · Verification Engine · Item 126 (penanda pemilih model, `cost_ledger`).

## 7. Penerapan pertama (bila diterima)

| Pekerjaan | Hasil tangga | Perlu saldo? |
|---|---|---|
| Router: kata kunci substring → kata utuh, buang kata tanya | kode | tidak |
| Kueri web Tier 3 di klien: **pakai ulang `ringkasKueri()`** lewat modul bersama (keputusan #6), bukan daftar kata pengisi baru — **✅ 28 Okt** `shared/kueri_pencarian.js` (dimuat Deno & Vite, terbukti; [log](../project-memory/changelog/2026-10-28-modul-bersama-kueri.md)) + baris "🔍 Dicari (web): …". Dua pendeteksi kata waktu yang kembar (`RetrievalOrchestrator.isTemporalQuery`, `RetrievalStrategyService.isTemporalOrRecencyQuery`) **✅ disatukan 29 Okt** jadi `adalahKueriWaktu()` di modul yang sama ([log](../project-memory/changelog/2026-10-29-satu-pendeteksi-kata-waktu.md)). Belum: konteks tanggal untuk "terbaru" | kode | tidak |
| Ukur dengan mode bayangan SQL atas pesan lama (hanya agregat; nol isi keluar — T12) — **✅ 28 Okt**, hasil di roadmap Item 126 | langkah 4 | tidak |
| Kueri web yang merujuk percakapan → pakai ulang penulis ulang Item 67 (sudah tampil satu baris), bukan membuat yang baru | langkah 2–3 | ya (uji) |
| Rencana Coordinator ditampilkan ke Owner | §2.3 terlihat | tidak |

## 8. Keputusan Owner (2026-10-28)

| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | Model untuk usulan di depan (mis. penulisan ulang kueri) | **Model pilihan Owner** — pola yang sama dengan router & Coordinator sekarang; tanpa model terpisah |
| 2 | Seberapa rinci "terlihat" | **Satu baris** di langkah proses |
| 3 | Makna bercabang | **Tanya Owner** |
| 4 | Status akhir | **ADR saja** — `constitution/25` #5 tidak diubah; ADR ini penafsirannya |
| 5 | Penulis ulang Item 67 memakai model tetap `deepseek/deepseek-v4-flash-0731`, bukan model pilihan Owner | **Pengecualian yang dicatat** — tugasnya sempit (satu pertanyaan mandiri), murah (±$0,00002–0,00004), sudah diukur (1,6–2,7 dtk), dibayar kunci pengguna, dan terlihat. Usulan LLM-di-depan **baru** tetap mengikuti keputusan #1 |
| 6 | Tempat aturan peringkas kueri (`ringkasKueri()`) agar dipakai juga web Tier 3 di klien | **Modul bersama di tempat netral**, diimpor server & klien — bukan disalin (arah T15). Prasyarat: dibuktikan dulu bahwa jalur impor itu dimuat Deno (edge function) **dan** Vite (klien) tanpa perkakas tambahan |

Latar tiap pertanyaan (dipertahankan sebagai jejak):

1. **Model mana untuk usulan di depan?** Design Philosophy #8: *"Owner memilih model."* Diperiksa di kode 28 Okt:
   router & Coordinator **memakai model pilihan Owner** (`runCoordinatorLLM` → OpenRouter, kunci & model pengguna,
   nalar dimatikan — `llm_orchestrator.ts:389`), jadi #8 sudah dipatuhi. Usul: penulisan ulang kueri ikut pola yang
   sama (tanpa model terpisah). *Catatan:* biayanya tercatat dengan penanda permintaan utama (`owner-settings` /
   `tier-auto`), **bukan** `sistem` seperti tertulis di komentar `runtime_context.ts:141` — komentar itu perlu
   dikoreksi (atau panggilan internal ini diberi penanda sendiri; Item 126).
2. **Seberapa rinci "terlihat"?** Cukup satu baris "🔍 Dicari: …" di langkah proses, atau juga tampil di jawaban?
3. **Makna bercabang:** selalu bertanya, atau boleh mencari semua cabang lalu menampilkannya terpisah?
4. **Status akhir:** diterima sebagai ADR saja, atau penafsiran ini juga ditulis ke `constitution/25` #5?
