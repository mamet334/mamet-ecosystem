# Folder Kerja Assistant — Tahap 3: Jalankan Perintah + Kejujuran Laporan Tindakan (Item 85)

**Tanggal:** 22 September 2026
**Roadmap:** Item 85 ([`ROADMAP-FOLDER-KERJA-ASSISTANT.md`](../../roadmap/ROADMAP-FOLDER-KERJA-ASSISTANT.md)) — **selesai tiga tahap**
**Status:** ✅ terbukti live di desktop (folder uji `D:\SLAMET\other\uji-folder-kerja`) + `agent-process` ter-deploy.

Satu kelompok kerja: `folder_run`, larangan tulis `.git`, kejujuran laporan tindakan (catatan kaki tiruan, klaim tanpa
alat, putaran koreksi, blok ```json), label untuk hasil alat, dan pembersihan dua fungsi uji server yang bocor.

## Kenyataan yang menentukan rancangan

Pagar folder menjaga alamat yang disentuh **alat** Mamet. Program yang dijalankan (`python app.py`, `npm run build`)
**tidak terpagar** — ia bisa menyentuh apa pun di laptop. Maka penjaga utama Tahap 3 adalah **dialog izin** yang
menampilkan perintah persis beserta isi skrip/script npm; pemeriksaan lain penahan kecerobohan, bukan pengaman mutlak.
Blocklist dari roadmap diganti daftar izin + tanpa shell (blocklist perintah shell selalu bisa diakali).

## 1. `folder_run` — `frontend/electron/alatFolderJalan.cjs` (baru)

- **Tanpa shell:** program + argumen sebagai daftar (`spawn`, `shell:false`) — `&`, `|`, `>` hanya teks.
- **Daftar izin:** python, py, pip, node, npm, npx, git, go, cargo, rustc, deno, bun, php, ruby, java, javac, dotnet,
  gcc, g++, make, cmake. Yang tak terpasang ditolak dengan alasan "tidak terpasang".
- **Program dicari sendiri di PATH sebagai alamat `.exe` lengkap**, folder kerja & isinya dilewati, begitu pula stub
  Microsoft Store: Windows mencari folder asal lebih dulu, jadi `python.exe` palsu di folder kerja akan terjalankan
  bila nama pendek diserahkan ke `spawn`. npm/npx (`.cmd`) dijalankan lewat `node` + `npm-cli.js`/`npx-cli.js`.
- **Sub-perintah:** git hanya status/log/diff/show/blame/grep/ls-files/branch (lihat)/init/add/commit — push, reset,
  opsi global `-c` ditolak; publish/login/config npm·pip·cargo·deno·bun·dotnet ditolak; install/unduh diberi
  peringatan 🌐 di dialog.
- **Argumen:** alamat absolut, UNC, `..` keluar folder, `--output`/`--exec`/…, dan baris baru ditolak.
- **Dialog izin** (proses utama, bawaan **Tolak**): perintah persis, program asli, peringatan "tidak dibatasi pagar",
  cuplikan skrip yang dijalankan, atau script `package.json` untuk `npm run`/`install`.
- **Lingkungan dibersihkan** dari variabel KEY/TOKEN/SECRET/SUPABASE/OPENROUTER/… dan `NODE_OPTIONS`; keluaran UTF-8,
  `GIT_EDITOR=:` (commit tanpa `-m` gagal cepat, tidak menggantung).
- **Batas:** waktu 60 s (maks 300) → seluruh pohon proses dimatikan (`taskkill /T /F`); keluaran 20 KB; stdin
  ditutup; satu perintah sekaligus (kunci dipasang sebelum dialog); satu `folder_run` per putaran.
- `main.cjs`: IPC `folder:alat` merutekan `folder_run`; log `[FOLDER] folder_run "python app.py" → OK (kode keluar 0, … ms, … B)`.

## 2. `.git` tak bisa diubah alat tulis (`alatFolderTulis.cjs`)

Menulis `.git/hooks/pre-commit` atau `.git/config` membuat perintah yang tampak aman di dialog (`git commit`,
`git status`) diam-diam menjalankan kode. Tulis/edit/rename-ke/hapus di `.git` kini ditolak.

## 3. Kejujuran laporan tindakan (`folderKerjaAlat.js`, `AssistantService.js`)

Diperbaiki bertahap dari live:

| Temuan live | Perbaikan |
|---|---|
| Model menulis sendiri `✍️ _… (dicatat dari proses utama, bukan dari kata model): …_` — sekali tanpa satu alat pun | `buangKakiTiruan`: baris berklaim "dicatat dari proses utama" selalu dibuang; bagian setelah `---` yang hanya berisi baris bergaya catatan kaki dibuang (catatan pemeriksa label server dipertahankan) |
| "jalankan app.py lagi" → **tanpa tag, tanpa dialog**, model menulis "saya jalankan lagi… Jumlah 27" disalin dari riwayat (3×, aturan prompt kalah) | `peringatanKlaimTanpaAlat`: klaim menjalankan/mengubah tanpa catatan proses utama → **⚠️ Peringatan sistem** (kalimatnya selalu benar bila dipasang) + **putaran koreksi** sekali per pertanyaan: jawaban karangan tidak ditampilkan, model diminta menulis alatnya |
| Setelah dikoreksi model menulis permintaan benar tetapi di **blok ```json**, bukan tag → sistem diam | Blok ```json berisi permintaan alat folder yang sah diterima (tetap lewat dialog izin); blok JSON lain diabaikan; tag + blok sama = satu permintaan |
| Catatan kaki "(1 putaran)" padahal hanya putaran koreksi | "(N putaran alat + 1 koreksi sistem)" / "🔁 Koreksi sistem: … tidak ada alat yang dijalankan" |

## 4. Label laporan tindakan

Penyebab HYPOTHESIS pada laporan tindakan (catatan Tahap 2): **dipilih model sendiri**, karena BLOK 6 kontrak server
hanya mengakui dokumen BLOK 4/RAG — bukan karena RAG/memory menyala (cabang PASSED maupun WARNING sama-sama tak
mengenal hasil alat).

- `universal_contract.ts` + `context_builder.ts` + `types.ts`: putaran lanjutan folder mendapat blok
  **[LABEL UNTUK HASIL ALAT FOLDER KERJA]** — laporan isi berkas/perubahan/penolakan/keluaran → VERIFIED dengan
  `Sumber:` alamat/perintah; saran/tafsiran → HYPOTHESIS. Kontrak biasa tak berubah.
- `sumberDariHasilAlat`: perintah yang dijalankan & berkas yang diubah/ditolak kini judul sumber; isi = keluaran /
  baris hasil (untuk tulis: baris hasil saja, bukan isi karangan model). Baris hasil palsu di dalam isi berkas atau
  keluaran program tidak dihitung.

## 5. Keamanan server — dua fungsi uji dihapus

`test-audit` (tanpa login) dan `debug-cron` (lolos dengan kunci anon publik) memakai **service role** tanpa
pengecekan pengguna: mengembalikan semua `knowledge_spaces` semua akun, email semua pengguna, dan semua tugas
terjadwal. Tidak ada pemanggil di kode. Dihapus Owner dari server (`supabase functions delete`, terverifikasi: tinggal
7 fungsi) dan dari repo. `ping` dibiarkan (dipakai dashboard, tanpa data).

## Bukti live (percakapan `11ba4762…`)

| Chat | Bukti proses utama / disk | Jawaban |
|---|---|---|
| Tambah cetak di app.py lalu jalankan | disk 213 → 311 B (3 baris di akhir); `✅ app.py, ▶️ kode 0` | Jumlah 27, Rata-rata 9.0 |
| `git status` | `⚠️ kode 128`, `.git` tak dibuat | "not a git repository" apa adanya |
| jalankan lagi → **Tolak** | `🚫 ditolak`; app.py tak tersentuh | "tidak dijalankan" |
| dir lewat cmd | tanpa `folder_run` | menjelaskan tanpa shell |
| jalankan app.py (setelah perbaikan label) | `▶️ kode 0` | **VERIFIED**, `Sumber: python app.py` |
| saran daftar kosong | — | **HYPOTHESIS** (saran) |
| "lagi" sebelum perbaikan klaim | tak ada alat | karangan → ⚠️ Peringatan sistem terpasang |
| "lagi" setelah koreksi, sebelum blok json | tak ada alat | model menulis permintaan benar dalam ```json → peringatan |
| "lagi" setelah blok json diterima → **Tolak** | dialog muncul; `🚫 ditolak` | jujur, catatan kaki asli saja |
| "lagi" → **Izinkan** | dialog muncul; `▶️ kode 0` | **VERIFIED**, `Sumber: python app.py` |

## Uji otomatis (di luar git, `frontend/node_modules/.uji-rag/`) — semua lulus

- `uji-alat-folder-jalan.cjs` **43/43** — python/npm/git NYATA: 18 serangan ditolak **sebelum dialog**; metakarakter
  shell = teks; `python.exe` palsu di folder dilewati; `OPENROUTER_API_KEY` tak terbaca skrip; UTF-8; potong 20 KB;
  cucu `sleep(60)` mati dalam 3,3 s (dicek: tak ada proses tersisa); kunci satu-perintah; `npm run` + script di
  dialog; `npm install` ditolak → tanpa `node_modules`; `git init/status/commit`; tulis ke `.git` ditolak.
- `uji-folder-jalan-protokol.mjs` v3, `uji-folder-klaim-palsu.mjs` v2 **17/17** (teks persis dari database),
  `uji-folder-kaki-tiruan.mjs` 9/9, `uji-folder-label-tindakan.mjs` 15/15 (pemeriksa label & kontrak SERVER asli
  dibundel esbuild: angka karangan 9.5, tanpa Sumber, perintah yang tak dijalankan → diturunkan).
- Uji lama diperbarui: `uji-folder-tulis-protokol.mjs` v3 (berkas yang ditulis kini sumber label — baris hasil saja),
  `uji-folder-kerja-protokol.mjs` v4; `uji-folder-label.mjs`, `uji-alat-folder*.cjs` tetap lulus.
- ESLint `no-undef` bersih (kontrol: variabel palsu yang sengaja ditanam tertangkap).

## Catatan terbuka

- `check-keys` bisa dipanggil dengan kunci anon (menguji kunci OpenRouter server, menampilkan 8 huruf awal) — rapikan kelak.
- Model kadang tetap memilih HYPOTHESIS untuk laporan tindakan yang boleh VERIFIED (lebih rendah, tidak menyesatkan).
- Pola regex klaim ("saya jalankan", "sudah saya simpan", …) adalah daftar; klaim berbentuk lain bisa lolos — koreksi
  & peringatan hanya lapis tambahan, bukti tetap catatan kaki proses utama.
- Pemeriksa angka hanya menilai angka berdesimal/berpemisah/persen: "9.0" dan "0,1 detik" di jawaban VERIFIED
  terbukti ada di hasil alat (keluaran & kepala hasil "… 0,1 s"), bilangan bulat seperti "27" tidak ikut dicek.
