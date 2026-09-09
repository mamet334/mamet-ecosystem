# Changelog: Empat Cacat Sistem Memori — Payload EventBus, Konflik Salah Tuduh, Duplikat, Klaim Palsu

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai & Diverifikasi Live Berurutan (2026-09-09)
**Scope:** `ConversationEngine.jsx`, `AssistantService.js`, `MemoryGovernorService.js`
**Pemicu:** Owner melaporkan efek Live Thought Pulse (Knowledge Galaxy Pilar B) tidak menyala

---

## 1. Bagaimana Ini Ditemukan

Owner menutup kriteria terakhir Knowledge Galaxy dengan mengecek apakah bintang memori berdenyut di Home Dashboard, dan melaporkan "sepertinya tidak berdenyut". Penelusuran ke hulu membongkar satu rantai cacat yang saling menutupi — masing-masing baru terlihat setelah yang di depannya diperbaiki.

Perlu dicatat: changelog Knowledge Galaxy (2026-09-08) sudah jujur mencatat bahwa verifikasinya berhenti di level logika event karena dashboard ada di balik login. Denyutnya memang tidak pernah benar-benar dilihat — dan ternyata memang tidak pernah menyala.

## 2. Cacat #1 — `activeMemories` Selalu Kosong (Akar Semua Gejala)

`ConversationEngine.jsx` handler `Memory:Retrieved`:
```js
const data = payload?.result || payload;          // ← salah level
setActiveMemories(Array.isArray(data) ? data : []);
```

`EventBus.emit()` **selalu** membungkus payload asli di `payload.data` bersama `{source, timestamp}` (`EventBus.js:73-77`). Jadi `payload.result` selalu `undefined`, lalu jatuh ke wrapper-nya yang bukan array → `setActiveMemories([])` **setiap kali, tanpa kecuali**.

Ironisnya, changelog Galaxy sendiri sudah mendokumentasikan jebakan pembungkus ini (handler `ActivityGraph` sengaja membaca `payload?.data?.memoryIds` setelah sempat gagal) — tapi handler `Memory:Retrieved` yang lebih lama tidak ikut diperiksa.

**Dampak berantai yang semuanya berasal dari satu baris ini:**

| Gejala | Sebab |
|---|---|
| Live Thought Pulse tidak pernah menyala | `Brain:ActiveThoughts` selalu mengirim `memoryIds: []` |
| Badge jumlah memori di toolbar tidak pernah muncul | `activeMemories.length > 0` selalu false |
| Tombol refresh memori diam saja | `lastMemoryQuery` selalu `''` → `if (!lastMemoryQuery) return` |
| Panel Memory menampilkan daftar yang salah | Prop kosong → panel jatuh ke fallback `dbActiveMemories` (50 memori aktif terakhir dari DB), bukan memori yang benar-benar dipanggil untuk pertanyaan itu |

**Fallback panel itulah yang menyembunyikan bug ini selama ini** — panel tetap terlihat "berisi", jadi tidak ada yang curiga.

**Perbaikan:** baca `payload?.data` dulu (dengan toleransi ke payload mentah).

## 3. Cacat #2 — Konflik Memori Salah Tuduh

Setelah #1 diperbaiki, Owner mengamati sendiri kejanggalan di panel: sebuah "konflik" antara dua fakta yang sama sekali tidak berhubungan.

| | Isi |
|---|---|
| Versi lama | "Menyukai clean architecture dan micro-kernel." |
| Input baru "berbenturan" | "nama panggilan saya adalah pak slamet" |

**Root cause:** `AssistantService` menyimpan **semua** memori chat dengan `source_reference: 'assistant_chat_trigger'` (satu nilai konstan), sedangkan `detectAndMarkConflict()` memakai aturan: *source_reference sama + isi berbeda + versi tidak berurutan → konflik*.

Aturan itu masuk akal untuk memori turunan file (satu path = satu isi kanonik, versi baru menggantikan versi lama). Tapi untuk fakta chat yang saling independen, `source_reference` bukan identitas fakta — cuma label pemicu. Akibatnya **setiap fakta baru menendang fakta lama yang tidak berhubungan** ke `CONFLICT_PENDING_REVIEW`, yang berarti hilang dari memori aktif.

Ini juga menjelaskan mengapa AI menjawab "saya belum punya informasi tentang nama panggilan Anda" padahal Owner sudah pernah memberitahunya — memorinya tertendang, Owner memberitahu lagi, tertendang lagi.

**Perbaikan (opsi dipilih Owner):** `source_reference` memori chat kini `assistant_chat:<kategori>`, sehingga benturan hanya mungkin antar fakta sejenis. `verifyAssistantSession()` yang memfilter nilai persis diubah jadi pencocokan awalan (`like 'assistant_chat%'`) agar data lama tetap terjaring.

**Keterbatasan yang diakui:** dua preferensi berbeda topik dalam kategori sama masih bisa salah dianggap konflik. Deteksi kontradiksi berbasis makna tidak dikerjakan.

## 4. Cacat #3 — Tidak Ada Pencegah Duplikat

Setelah konflik diselesaikan Owner lewat panel, semua memori muncul — termasuk **tiga salinan identik** "nama panggilan saya adalah pak slamet" (jejak dari lingkaran lupa-beritahu-lagi di #2).

Ditelusuri: **tidak ada dedup sama sekali**. `_computeHash` hanya dipakai untuk menyimpan hash, deteksi drift, dan pembanding konflik — dan deteksi konflik justru **mensyaratkan isi berbeda** (`existingHash !== newHash`). Isi identik tidak pernah diperiksa siapa pun.

Biayanya nyata: tiap salinan ikut disuntikkan ke prompt di setiap permintaan.

**Perbaikan:** guard di awal `storeGoldenMemory()` — lewati penyimpanan bila sudah ada memori aktif dengan `summary` identik milik user yang sama.

**Catatan teknis penting:** percobaan pertama memakai embed PostgREST `raw_memory_content → user_memories!inner(...)`. Dicek ke `information_schema` sebelum dipakai: **tidak ada foreign key** antara kedua tabel (satu-satunya FK `user_memories` mengarah ke `knowledge_spaces`), jadi embed itu akan gagal — dan gagalnya senyap, karena kode hanya memeriksa `data && length > 0` sehingga error terbaca sebagai "tidak ada duplikat". Diganti kueri tunggal ke kolom `summary`, yang juga justru kolom yang benar-benar disuntikkan ke prompt.

## 5. Cacat #4 — Klaim Palsu Saat Duplikat Dilewati

Setelah guard aktif, Owner menguji dan melaporkan "belum ada peringatan duplikat". Benar: guard-nya bekerja (log `Duplikat dilewati` muncul), tapi AI **tetap menjawab "✅ Saya telah menyimpan..."** untuk sesuatu yang sebenarnya tidak disimpan.

Ini over-claiming yang dilarang [`24_ANTI_HALLUCINATION_PROTOCOL.md`](../../../constitution/24_ANTI_HALLUCINATION_PROTOCOL.md) — sistem mengklaim melakukan aksi yang tidak terjadi.

**Perbaikan:** kembalian `storeGoldenMemory()` untuk kasus duplikat tetap berbentuk baris memori (kontrak konsisten dengan jalur normal) plus penanda `_duplicateSkipped`. `AssistantService` menjawab jujur: *"Info itu sudah ada di memori saya, jadi tidak saya simpan lagi"*.

## 6. Verifikasi Live

Diverifikasi Owner secara berurutan, tiap perbaikan dites sebelum lanjut:

1. Badge `Memory 3` muncul di toolbar — sebelumnya tidak pernah.
2. Smoothing tier classifier ikut terpicu untuk pertama kalinya (efek samping `history` yang kini terisi benar): `Model tier: SEDANG (pesan pendek, tapi 2 pesan terakhir bertingkat SEDANG (smoothing))`.
3. Konflik lama diselesaikan Owner lewat panel → 7 aktif, 0 konflik; tidak ada konflik palsu baru.
4. Log `[MemoryGovernorService] Duplikat dilewati — memori aktif dengan isi identik sudah ada (id: ...)`.
5. Chat menampilkan pesan jujur: *"ℹ️ Info itu sudah ada di memori saya, jadi tidak saya simpan lagi"*.

## 7. Yang Belum Selesai

- **Efek denyut Live Thought Pulse belum dikonfirmasi visual.** Penghalang utamanya (`activeMemories` kosong) sudah hilang, tapi Owner belum melaporkan melihat denyutnya di Home Dashboard. Kriteria DoD Knowledge Galaxy yang bersangkutan masih dibiarkan terbuka.
- **Tiga salinan duplikat lama** tidak dihapus otomatis — guard hanya mencegah yang baru. Owner membereskannya sendiri lewat panel (keputusan Owner: tidak ada penulisan database dari sisi asisten).
- **Deteksi kontradiksi berbasis makna** (mis. "suka kopi" vs "tidak suka kopi") tidak ada. Dulu pun tidak pernah ada — yang ada cuma heuristik `source_reference` yang kini dipersempit.
