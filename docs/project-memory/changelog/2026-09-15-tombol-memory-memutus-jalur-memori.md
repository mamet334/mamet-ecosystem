# Tombol Memory Memutus Lima Jalur Memori

**Tanggal:** 15 September 2026
**Roadmap:** Item 84
**Status:** dideploy (sesudah v445), terbukti live (lihat "Bukti live").

## Latar

Item 83 menemukan bahwa tombol **Memory** di menu Tools desktop hanya tampilan: pilihannya disimpan
(`ToolPreferencesService`, kunci `memory_manager`) tetapi tidak dibaca kode mana pun. Memori tetap diambil dan ditulis
apa pun posisi tombolnya.

Penelusuran menemukan **lima jalur memori**, dua di desktop dan tiga di `agent-process`. Keputusan Owner: tombol
memutus kelimanya sekaligus, **nyala bawaan** agar perilaku sekarang tidak berubah, dan blok kesadaran memori di prompt
ikut menyesuaikan.

## Jalur yang diputus bila Memory mati

| # | Jalur | Letak | Saat mati |
|---|---|---|---|
| 1 | Ambil memori desktop (`MemoryService.getMemory` → `globalMemory`) | `AssistantService.buildContextInjection` | Tidak diambil |
| 2 | Simpan eksplisit ("ingat bahwa…", MEMORY_STORE) | `AssistantService.processMessage` | Tidak disimpan; balasan "ℹ️ Memory sedang dimatikan… Tools → Memory" |
| 3 | Pencarian vektor `match_memories` | `request_pipeline.ts` | Dilewati (log `[RAG] Tombol Memory mati`) |
| 4 | `loadProjectMemory` → `retrieveMemories` → blok USER MEMORY | `canReadMemory` | Tidak dibaca |
| 5 | Tulis fakta otomatis sesudah menjawab (`Memory.WriteRequested`) | `canWriteMemory` | Tidak jalan |

## Perubahan

- **Desktop (`AssistantService.js`):**
  - Membaca `getEffective(workspaceId, 'memory_manager')`. Tanpa pilihan tersimpan nilainya `true`.
  - `buildContextInjection` menerima tombol dan melewati `MemoryService` bila mati.
  - MEMORY_STORE ditolak dengan penjelasan.
  - Payload CONVERSATION **dan** LOOKUP mengirim `memoryEnabled`, karena LOOKUP juga memicu baca/tulis memori di server.
- **Server:**
  - `request_parser.ts`: `memoryEnabled: memoryEnabled !== false`. Hanya `false` yang mematikan; mametlite dan klien
    lama tidak berubah.
  - `execution_context.ts`: `canReadMemory` & `canWriteMemory` = tombol **dan** aturan mode sebelumnya. Semua pemakai
    policy ikut, termasuk mode Engineer.
  - `request_pipeline.ts`: `match_memories` dilewati. Vektor pertanyaan tetap dibuat bila RAG nyala karena pencarian
    dokumen memakainya.
  - `request_pipeline.ts`: **blok kesadaran dua versi**. Nyala = teks lama persis. Mati = "MEMORI SEDANG DIMATIKAN": tidak
    membaca memori lama, tidak menyimpan yang baru, hanya riwayat sesi yang terlihat; bila diminta mengingat atau
    ditanya hal pribadi, jelaskan jujur dan tunjuk Tools → Memory; jangan mengaku menyimpan atau mengarang memori.
  - `types.ts`: `memoryEnabled?` di `ctx.request`.

Plugin server `memory_manager.ts` tidak disentuh: tidak terdaftar di `plugins/registry.ts`.

## Yang tetap ada saat Memory mati

Identitas Mamet, waktu lokal, riwayat obrolan sesi yang sama, dokumen RAG dan hasil web (bila tombolnya nyala), hasil
sub-agent, kontrak label, format, dan nalar. Jadi hasilnya **bukan** "AI murni tanpa prompt pelengkap"; yang hilang
hanya bagian memori pribadi.

## Uji (lokal, di luar git)

`uji-tombol-memory.mjs` 17/17:
- Policy: tanpa tombol nyala; mati memutus baca & tulis; RAG tidak ikut; Engineer ikut; Lite tetap tanpa memori.
- Parser hanya mematikan pada `false`; payload CONVERSATION & LOOKUP; penolakan MEMORY_STORE; kedua versi blok kesadaran.
- Sintaks kelima berkas lolos esbuild.

## Bukti live (15 Sep, WIB)

| Waktu | Chat | Memory | Bukti server/metadata | Jawaban |
|---|---|---|---|---|
| 12.26.18 | 693f… | mati | tanpa `memoryFetchCount`, `memoryArray size=0`, blok mati, tanpa `MEMORY_AUDIT_LOG` | "tidak memiliki informasi tentang nama panggilan Anda" |
| 12.26.38 | f537… #2 | nyala | `memoryFetchCount: 1`, `size=5`, blok lama, audit fakta jalan | "Nama panggilan kamu adalah Pak Slamet" |
| 12.26.59 | f537… #4 | mati | `size=0`, blok mati, tanpa audit; `riwayat=2 pesan/110 huruf` | "Pak Slamet" (dari riwayat sesi) |
| 12.27.11 | 66e1… #2 | mati | `size=0`, blok mati, tanpa audit | "tidak memiliki informasi" |
| — | 66e1… #4 | mati | tidak sampai server | "ℹ️ Memory sedang dimatikan…" |

Tidak ada baris baru di `user_memories`. Prompt sistem untuk pertanyaan yang sama: 6.888 huruf (nyala) → 5.236 (mati).

## Batas yang disadari

- Uji mati-nyala di **chat yang sama** tetap bisa menyebut info pribadi dari riwayat sesi (baris 12.26.59). Ini sesuai
  rancangan, bukan kebocoran; uji bersih memakai chat baru.
- Bila RAG nyala, embedding pertanyaan tetap dibuat; penghematan embedding hanya saat RAG juga mati.
- gpt-4o-mini dengan memori mati menjawab jujur tetapi belum menyebut "Tools → Memory" seperti diminta blok kesadaran.
- `SemanticContextService` (grafik entitas lokal di perangkat) tidak ikut diputus; bukan tabel memori.
- Tombol **File Reader** masih hanya tampilan.
