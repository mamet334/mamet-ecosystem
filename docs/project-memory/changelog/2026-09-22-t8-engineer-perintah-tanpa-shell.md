# T8 — Perintah Engineer Tanpa Shell, Profil Peran, dan Pesan Hasil Mesin Bukan Kueri

**Tanggal:** 22 September 2026
**Roadmap:** T8 di [`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md) — ✅ ditutup
**Status:** ✅ terbukti live di desktop (workspace Engineer) + `agent-process` ter-deploy.

## Temuan saat diperiksa ulang (hasil baca kode, lalu dibuktikan live)

- **Injeksi PowerShell di `CommandRegistry` ternyata tak tercapai**: satu-satunya pemakainya tombol `[MAMET_CMD]`
  Engineer memanggil `runCommand(cmd, fungsiCallback)` — `cmd` perintah mentah ("npm install") tak ada di daftar izin
  → selalu "tidak terdaftar"; `args` sebuah fungsi → `args.path` selalu `undefined`. Akibatnya **tombol perintah
  Engineer rusak diam-diam**; hanya sesaat saat boot kalimat mentah diteruskan ke `run-terminal-command` (shell bebas).
- IPC `run-terminal-command` (shell + blocklist) dan `edit-file-surgical` (tulis ke alamat absolut mana pun) diekspos ke
  layar walau hanya dipakai jalur rusak itu.
- **Aturan Engineer tak pernah sampai ke model sejak refactor Wave 5.4 (`c310141`)**: konteks lengkap dirakit, lalu
  `context_builder.ts` menyusun ulang prompt dasar kontrak TANPA `engineerContextPrompt` dan menimpanya. Live: "cek
  status git" → "saya tidak memiliki akses… [STATUS: INSUFFICIENT]"; prompt 14.451 huruf tanpa `ENGINEER IDENTITY`/RULE 1–6.
- **Kebocoran privasi**: pesan `[TERMINAL OUTPUT for: …]` dan `[HASIL ALAT FOLDER]` (isi berkas) dijadikan KUERI
  pencarian web (log: URL DuckDuckGo memuat daftar berkas `git status`), RAG, dan memori. `memory_audit_log` menyimpan
  30 pesan hasil folder utuh (s.d. 12.340 huruf isi berkas). `user_memories`/`raw_memory_content`: 0 baris tercemar.

## Yang dikerjakan

**A — jalur perintah-teks lama dihapus** (keputusan Owner):
- `CommandRegistry.js` (302 baris) + pendaftarannya di `Kernel.js`; `runCommand`/`confirmAndRunCommand`/
  `_executeAndLog`/`_runCommandLegacy` di `AssistantService`; dialog `Command:ConfirmationRequired` di `ConversationEngine`.
- `main.cjs`: IPC `run-terminal-command` + blocklist + `edit-file-surgical` (±170 baris); `preload.cjs`:
  `runTerminalCommand`, `editFileSurgical`. Layar tak lagi punya jalan menjalankan kalimat shell.

**B1 — tombol `[MAMET_CMD]` lewat mesin Tahap 3** (keputusan Owner):
- IPC baru `engineer:jalankan`: `pecahPerintah` (spasi memisah, kutip mengelompokkan; `& | ; < >`, backtick, baris baru
  ditolak — tanda model berharap shell; `% $ ^` sah karena tanpa shell hanya teks) → `jalankanAlatJalan` dengan akar
  **repo Mamet**. Dialog "Mamet Engineer — repo Mamet".
- **Profil peran** (`PROFIL` di `alatFolderJalan.cjs`) — MESIN satu, KUASA per peran:

  | | Assistant | Engineer |
  |---|---|---|
  | Folder asal | folder kerja | repo Mamet |
  | Batas waktu | 60 s | 180 s |
  | git | + init/add/commit | **baca saja** (commit di tangan Owner; kode berubah lewat jalur patch + rollback) |
  | pemasang paket (npm/pip install, npx, cargo build, go get) | boleh + peringatan 🌐 | **ditolak** — cukup diusulkan |

- Ditolak ATURAN → tombol 🔒 "Tidak diizinkan untuk Engineer — alasan…", **tidak dikirim balik ke model** (live
  sebelumnya: `npm install lodash` diusulkan ulang 3×). Ditolak Owner → "Dilewati" + dilaporkan ke model.
- Blok ```bash satu baris berprogram dikenal → `[MAMET_CMD: …]` (live: aturan sampai, model menulis blok kode).
- Peringatan klaim Engineer: "sudah saya jalankan…" tanpa keluaran terminal asli ("Kode keluar N") → ⚠️ peringatan
  sistem; usulan `[MAMET_CMD]` & usulan patch tidak dinilai.
- `context_builder.ts`: `engineerContextPrompt` ikut prompt dasar kontrak di mode ENGINEER. `engineer_context.ts`
  RULE 6: tanpa shell, daftar program, git baca saja, install sebagai teks biasa, tulis penanda (bukan blok kode),
  jangan "tunggu hasilnya".

**Privasi — pesan hasil mesin bukan kueri** (`AssistantService` + `memory_write_worker.ts`):
- `pesanHasilMesin` (putaran folder, `[TERMINAL OUTPUT for: …]`, `[HASIL ALAT FOLDER]`) → tanpa Web, tanpa RAG, tanpa
  memori (baca & tulis), tanpa tawaran "cari pembanding web". Pertanyaan Owner tetap dicari RAG & Web seperti biasa.
- Server: pekerja memori menolak pesan hasil mesin sebelum mencatat apa pun.
- Data: **31 baris `memory_audit_log` dihapus** atas izin Owner (30 pesan hasil folder + 1 pesan uji folder yang
  memuat `hitung_jumlah`), semuanya akun utama, status `SKIPPED`, tanpa data pegawai.

## Bukti live

| Uji | Log proses utama / server | Hasil |
|---|---|---|
| "cek status git repo ini" → Izinkan | `[ENGINEER] "git status" → OK (kode 0, 64–70 ms)` | rangkuman status benar |
| 5 commit → Tolak / Izinkan | `DITOLAK OWNER` / `git log -5 --oneline → OK (59 ms)` | jujur / 5 commit sesuai keluaran |
| `git log --pretty=format:"%h…"` | ditolak "%" (aturan lama) → diperbaiki; dibuktikan pada repo: kode 0, 3 commit | ✅ |
| "pasang paket lodash" | `DITOLAK: npm install … tidak diizinkan untuk repo Mamet` | 🔒, tanpa perulangan |
| RAG+Web nyala, Memory mati | pertanyaan: web dicari, RAG dicari · `[TERMINAL OUTPUT]`: tanpa `WebComparisonService`, tanpa `RAG TIER` | ✅ |

## Uji otomatis (di luar git, `frontend/node_modules/.uji-rag/`) — semua lulus

- `uji-engineer-jalankan.cjs` **v4**: pemecah perintah (kutip, `% $ ^` sah, 10 metakarakter ditolak), npm test & git
  NYATA di repo sementara, profil Engineer (10 perintah terlarang ditolak sebelum dialog) vs Assistant, peringatan
  klaim, blok bash → penanda, jalur lama benar-benar hilang.
- Uji folder kerja Tahap 1–3 tetap lulus; bundel `agent-process/index.ts` esbuild ✅; ESLint `no-undef` bersih
  (kontrol tertangkap).

## Catatan terbuka

- **Sumber pengetahuan Engineer** (T10 baru): RAG Engineer mencari di SEMUA space — pertanyaan seperti "5 commit
  terakhir" memasukkan 4–7 potongan dokumen kepegawaian (skor 0,56–0,66); Web berorientasi berita, bukan dokumentasi
  teknis.
- Model masih kadang membungkus perintah install dengan penanda dan menulis kalimat bertentangan ("jalankan di
  terminal Anda" + tombol) — dampaknya aman (🔒 tanpa perulangan).
- Rangkuman keluaran terminal Engineer berlabel HYPOTHESIS — pemeriksa label belum mengenal keluaran terminal sebagai
  sumber (seperti hasil alat folder).
- `eng:git-checkpoint` masih `exec` string dengan label dari `taskId` — dibuat kode, bukan model; periksa kelak.
