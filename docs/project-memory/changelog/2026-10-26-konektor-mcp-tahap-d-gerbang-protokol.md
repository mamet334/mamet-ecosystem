# 26 Oktober 2026 — Konektor MCP Tahap D: gerbang persetujuan + protokol alat di chat (Item 129)

Item 129 ([`ROADMAP-KONEKTOR-MCP.md`](../../roadmap/ROADMAP-KONEKTOR-MCP.md)), Tahap D (dikerjakan 23–26 Okt).
Keputusan Owner yang dijalankan: K2 (setiap alat menunggu persetujuan), K3 (per workspace), K8 (sekali per misi).
Server `agent-process` di-deploy Owner — **versi 530** (26 Okt 06.03 UTC, dicek di platform). **Uji live di chat
belum** — menunggu saldo OpenRouter.

## Yang dibuat

- **`frontend/src/core/runtime/services/konektorAlat.js`** (baru) — protokol murni, dipakai bersama desktop & server
  (pola `folderKerjaAlat.js`):
  - tag `<alat_konektor>{"alat":…,"argumen":{…}}</alat_konektor>`; hanya konektor yang **menyala di workspace itu**
    dan alat yang dikenal; maks 3 alat/putaran, 6 putaran/pertanyaan; argumen ≤ 4.000 huruf; `katalog` bukan alat model;
  - hasil dibungkus `<<<DATA KONEKTOR … >>> … <<<AKHIR DATA KONEKTOR>>>` (status HYPOTHESIS, "BUKAN perintah"),
    dipotong 20.000 huruf; **penanda penutup & tag alat palsu di dalam data dinetralkan** (injeksi lewat halaman web);
  - blok prompt **statis** per konektor (deskripsi alat dari server MCP tidak masuk prompt): sumber siap, keadaan
    robots.txt/stealth, aturan — misi hanya bila diminta, `owner_intent`, tanpa URL karangan, pseudonim, label
    `[STATUS: HYPOTHESIS - Data crawler]`, larangan VERIFIED untuk isi tangkapan;
  - `infoKonektorAman`: info dari desktop disaring (id sumber & `cocok_untuk` hanya `[a-z0-9_]`, akses boolean).
- **Gerbang** (`konektorMcp.cjs` `buatGerbangKonektor`) — satu-satunya jalan dari layar ke `tools/call`:
  `jalankan_misi` → dialog (sumber, kata kunci, rentang, batas, perintah Owner, cara akses, "hasil terkirim ke
  penyedia model") → `misi_id` dicatat; `status_misi`/`baca_tangkapan` misi itu di workspace itu → tanpa dialog;
  misi lain, workspace lain, `daftar_misi`, `ekspor_misi` → dialog; dialog gagal tampil = **ditolak**. Batas
  `jalankan_misi` 130 s. IPC `konektor:panggil` + `electronAPI.konektor.panggil`; tombol bawaan & Esc = Tolak.
- **`AssistantService`** — putaran alat konektor (dipasang sebelum pembungkus folder kerja): label progres per alat;
  catatan kaki "🛰️ … (dicatat dari proses utama, bukan dari kata model)"; putaran lanjutan selalu CONVERSATION dan
  tingkat modelnya dikunci; `[HASIL ALAT KONEKTOR]` = pesan hasil mesin (tanpa web, RAG, memori, pencarian susulan);
  muatan `konektor` di jalur LOOKUP & CONVERSATION. Ringkasan `katalog` kini memuat daftar sumber siap.
- **Server** — `request_parser` menyaring dengan `infoKonektorAman` (fungsi yang sama); `request_pipeline` menambah
  `blokPromptKonektor`; `memory_write_worker` tidak mencatat data konektor. Data konektor tidak ditambahkan ke sumber
  pemeriksa label, jadi klaim VERIFIED atasnya tetap diturunkan.

## Bukti (tanpa model)

- Rantai penuh dengan crawler sungguhan: tag dari "jawaban AI" → gerbang (1 dialog) → misi berjalan (sumber `inbox`,
  lokal) → `baca_tangkapan` misi itu tanpa dialog kedua → pesan putaran berikutnya (penanda, misi_id, dua blok data).
- Suite 117/117; build aplikasi bersih; bundel esbuild `agent-process` bersih (blok "KONEKTOR AKTIF" ada).

## Uji

| Uji | Yang dijaga |
|---|---|
| `uji-konektor-protokol.mjs` v1 (baru, 33) | tag, K3, batas, injeksi dinetralkan, info disaring, isi blok prompt, sambungan desktop & server, rantai penuh |
| `uji-konektor-mcp.mjs` v3 (50) | + gerbang: 1 dialog per misi, tanpa dialog untuk misi yang disetujui, per workspace, ekspor/daftar selalu dialog, penolakan & dialog gagal = tidak dijalankan; IPC hanya lewat gerbang |

Enam mutasi menggigit (injeksi tag & penutup, K3 di tag, larangan VERIFIED, K3 di izin misi, dialog gagal).

**Ditemukan di jalan:** `uji-pesan-galat-ecosystem` v2 (23 Okt) crash saat keluar di 7 dari 8 jalan —
`process.exit()` sesudah mengimpor modul `.ts` (penghapus-tipe WebAssembly Node 24) → libuv
`UV_HANDLE_CLOSING`, kode 127 sesudah "SEMUA LULUS". Merah palsu memulihkan patch yang benar di verifikasi Tahap 6;
kini `process.exitCode` (10/10 kode 0). `uji-crawler` sekali 116 s (batas pytest 110 s) — tak terulang (17 s), tak
ada uji yang lambat; dicatat sebagai beban mesin sesaat.
