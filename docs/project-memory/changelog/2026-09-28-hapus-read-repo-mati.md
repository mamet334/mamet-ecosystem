# 2026-09-28 — Jalur READ_REPO dihapus (kode mati yang tampak hidup)

## Kenapa dihapus

Owner bertanya soal fitur Explorer. Telusur atas pertanyaan itu menemukan bahwa Engineer punya
keluarga fungsi baca-repo yang **lengkap, rapi, dan sepenuhnya mati** — dan satu jam sebelumnya ia
menipu asisten sendiri, yang sempat menyimpulkan jalurnya "tinggal disambungkan beberapa baris".

**Bukti kematiannya** (diperiksa di seluruh repo, bukan hanya `frontend/src`):

1. `Engineer:GeneratePatch` — satu-satunya pemicu tugas Engineer — dipancarkan dari **satu tempat**:
   tombol "Apply Patch" (`ConversationEngine.jsx:1991`).
2. Tugas dari tombol itu selalu membawa `dariTombolApply: true` (`UsulanPatch.js:53`).
3. `engineer.js`: `const intent = task?.dariTombolApply ? 'MODIFY_CODE' : detectIntent(task)`
   → **`detectIntent()` tidak pernah dipanggil**, jadi cabang `READ_REPO` tak terjangkau.
4. Pintu satunya, `Engineer:ReadRepo`, **hanya punya pendengar** — tidak ada pemancar di mana pun.
5. `Engineer:FileContent` (penampil isi berkas di UI) sama: pemancarnya cuma `handleReadFiles`.

## Yang dihapus

| Berkas | |
|---|---|
| `engineer/TaskHandlers.js` | `handleReadRepoTask`, `handleReadFiles`, `handleListDirectory`, `handleSearchFiles`, `extractPathsFromPrompt`, `extractDirectoryFromPrompt`, `extractSearchQueryFromPrompt` — **219 baris** |
| `engineer.js` | listener `Engineer:ReadRepo`, keempat `_handle*` pembungkusnya, `_taskHandlerDeps()`, `this.repositoryReader`, cabang READ_REPO di `_handlePatchTask` |
| `engineer/IntentClassifier.js` | `readRepoKeywords` (28 pola) + cabang `READ_REPO` |
| `ConversationEngine.jsx` | cabang penampil `READ_REPO_*` (7 jenis) + seluruh efek `Engineer:FileContent` |

**Yang TIDAK disentuh:** `RepositoryReaderService` tetap hidup dan tetap dipakai **FileExplorer**.
Yang dihapus hanya kabel mati dari Engineer ke sana.

Kemampuan membaca repo juga tidak hilang — dan tidak pernah lewat sini. Engineer membacanya lewat
`[MAMET_CMD: git grep -n -B2 -A4 …]` dan `git blame -L` (constitution/28 §3a, ditulis hari ini juga).

## Yang juga ketahuan, TIDAK dikerjakan

`Engineer:AnalyzeTask` dan `Engineer:ReviewChanges` **juga tidak punya pemancar**. `handleAnalysisTask`
dan `handleReviewTask` berada dalam kondisi yang sama dengan READ_REPO. Tidak disentuh karena Owner
meminta READ_REPO saja — dicatat di sini supaya keputusan berikutnya punya dasar.

`detectIntent()` sendiri tidak pernah dipanggil dari aplikasi; cabang ANALYSIS dan CLARIFICATION juga
tidak terjangkau. Membongkar seluruh sistem intent adalah keputusan tersendiri.

## Pelajaran akhir baris yang mahal

`sed -i` dan skrip Python mengubah **CRLF → LF** pada empat berkas salinan kerja, dan tiga uji langsung
merah. Sebabnya bukan sepele:

```
core.autocrlf = true, tanpa .gitattributes
→ git MENYIMPAN LF, tetapi MEMBERIKAN CRLF saat checkout
```

Jadi isi commit tidak berubah sama sekali — yang berubah **salinan kerja**, dan justru di situlah
`PatchGenerator` bekerja. Uji `uji-patch-crlf` dan `uji-laporan-patch-bertahan` memang menjaga sifat
itu, dan keduanya menangkapnya. Diperbaiki dengan menyamakan kembali akhir baris ke bentuk checkout.

Catatan penting untuk sesi berikutnya: **alat sunting menulis LF**, jadi setiap berkas yang disunting
di repo ini keluar dari bentuk checkout-nya sampai disamakan lagi.

## Uji

`uji-konteks-chat` → **v5**: jumlah langganan Engineer turun 6 → 5, ditambah penjaga bahwa langganan
`Engineer:FileContent` benar-benar hilang. Versi pertama penjaga itu **tertipu komentarnya sendiri**
(mencari nama peristiwanya, yang masih disebut di komentar penjelasan), lalu diperketat menjadi
mencari `eventBus.on('Engineer:FileContent'`.

49 berkas uji hijau; `vite build` lolos.
