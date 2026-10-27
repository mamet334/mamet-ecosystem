# ROADMAP: KONEKTOR MCP — MAMET ECOSYSTEM

**Item:** 129
**Status:** 📋 **Terdaftar 22 Okt 2026** — K1–K10 diputuskan Owner (konektor pertama = Ecosystem Crawler ·
semua alat menunggu persetujuan · per workspace · lokal & jarak jauh · diatur di Settings · desktop dulu · persetujuan sekali
per misi · kode crawler disalin ke repo dulu · Python dibundel di pemasang; Google Drive ditunda). **Rancangan bertahap §6 ditulis & dikoreksi Owner 23 Okt
(K11–K13 diputuskan).** **Tahap A ✅ 23 Okt** — crawler disalin ke `capability/ecosystem-crawler/` beserta `.env`
& `.venv`, alamat lama dibersihkan ([log](../project-memory/changelog/2026-10-23-konektor-mcp-tahap-a-salin-crawler.md)).
**Tahap B ✅ 23 Okt** — klien MCP di proses utama, per workspace, SDK resmi (K15)
([log](../project-memory/changelog/2026-10-23-konektor-mcp-tahap-b-klien-mcp.md)). **Tahap C ✅ 23 Okt** — Settings ›
Konektor, setelan di perangkat, terbukti di aplikasi desktop Owner
([log](../project-memory/changelog/2026-10-23-konektor-mcp-tahap-c-settings.md)). **Tahap D 🟡 26 Okt** — gerbang
persetujuan + protokol alat di chat; server ter-deploy (v530); terbukti tanpa model
([log](../project-memory/changelog/2026-10-26-konektor-mcp-tahap-d-gerbang-protokol.md)); server kini v531. **Uji
live 27 Okt** (Assistant): dialog sekali per misi ✅, tag ✅ (4 putaran), catatan kaki gerbang ✅, 30 tangkapan nyata;
label Hypothesis **belum bisa dinilai** — jawaban akhir 0 huruf karena saldo OpenRouter tipis
([log](../project-memory/changelog/2026-10-27-konektor-mcp-tahap-d-uji-live.md)).
**Tahap E ✅ 26 Okt** (bagian utama) — pemasang membawa Python + crawler (runtime 147 MB, terbukti dari hasil build),
data di %APPDATA%; K14: stealth tidak dibundel ([log](../project-memory/changelog/2026-10-26-konektor-mcp-tahap-e-pemasang.md)).
**E2 ✅ 26 Okt** — tombol pasang komponen stealth (Patchright terkunci + Chromium, atas izin Owner), terbukti tanpa
unduhan ([log](../project-memory/changelog/2026-10-26-konektor-mcp-tahap-e2-stealth.md)). **E3 ✅ 26 Okt** —
"Yang terpasang di perangkat ini" + Buka folder; crawler tetap satu bundel, bukan diunduh dari repo crawler
([log](../project-memory/changelog/2026-10-26-konektor-mcp-tahap-e3-transparansi.md)).
**Aplikasi:** **Mamet Ecosystem** (`frontend/`, desktop Electron + web) — **bukan** Mametlite.
**Arah:** Mamet sebagai **klien** MCP — memakai alat dari server MCP luar. Mamet **tidak** dibuka sebagai server MCP
(arah itu tidak termasuk item ini).

---

## 1. Tujuan

Engineer dan Assistant bisa terhubung ke server MCP (Model Context Protocol) dan memakai alat yang disediakannya —
mis. GitHub, Google Drive, Notion, basis data — tanpa Mamet harus menulis integrasi sendiri untuk setiap layanan.

MCP adalah protokol terbuka: satu cara baku bagi aplikasi AI untuk menemukan dan memanggil alat milik pihak lain.
Satu klien MCP di Mamet berarti setiap server MCP yang mengikuti protokol bisa dipasang, alih-alih satu adaptor per
layanan.

## 2. Yang sudah ada dan bersinggungan

| Yang ada | Letak | Kaitannya |
|---|---|---|
| Alat folder kerja Assistant (baca, cari, jalankan) — maks. 4 putaran, 5 alat per putaran | `folderKerjaAlat.js`, `AssistantService.js` | pola putaran alat yang sudah teruji; alat MCP kemungkinan memakai jalur serupa |
| Perintah `[MAMET_CMD]` Engineer — perintah baca jalan sendiri, yang krusial menunggu Owner | `ConversationEngine.jsx`, `alatFolderJalan.cjs` | garis "aman / krusial" yang sudah diputuskan Owner (1 Okt) |
| Proses utama Electron menjalankan program tanpa shell, dengan daftar izin & batas waktu | `frontend/electron/` | server MCP lokal (stdio) adalah program yang dijalankan proses ini |
| Kunci BYOK pengguna | Settings › vault | kredensial server MCP (token GitHub, dsb.) |

## 3. Batas dari konstitusi yang wajib dihormati

- **"Tetap di laptop ini vs keluar dari laptop ini"** (`constitution/28_PROSEDUR_KERJA_ENGINEER.md`, T12): hasil
  alat MCP masuk prompt lalu dikirim ke penyedia model. Alat MCP juga bisa **menulis ke layanan luar** (membuat
  issue, mengubah dokumen) — itu tindakan yang keluar dari laptop dan sulit ditarik kembali.
- **Kendali Owner:** setiap alat MCP — termasuk yang hanya membaca — menunggu persetujuan Owner (K2, 22 Okt).
  Berbeda dari garis 1 Okt untuk `git` baca: data dari layanan luar bukan berkas lokal Owner.
- **Vendor-independen (MAEF):** klien MCP tidak boleh mengikat Mamet ke satu penyedia model; alat MCP harus bisa
  dipakai model apa pun yang dipilih di Settings.

## 4. Keputusan Owner

**Diputuskan 22 Okt 2026:** arah = klien MCP · aplikasi = Mamet Ecosystem · catatan singkat dulu.

| # | Pertanyaan | Keputusan Owner (22 Okt) |
|---|---|---|
| ~~K1~~ | Server MCP pertama | ✅ **Ecosystem Crawler** (`D:\SLAMET\other\ecosystem crawler`) — diubah Owner 22 Okt; semula Google Drive (lihat bawah) |
| ~~K2~~ | Alat yang hanya membaca: jalan sendiri atau menunggu persetujuan? | ✅ **menunggu persetujuan** — semua alat MCP, baca maupun tulis |
| ~~K3~~ | Dipakai Engineer, Assistant, atau keduanya | ✅ **keduanya, tetapi PER WORKSPACE** — konektor tidak dipakai bersama. Menyalakan konektor di Assistant tidak menghubungkan Engineer; Owner menyambungkannya sendiri di workspace Engineer |
| ~~K4~~ | Server lokal (stdio), jarak jauh (HTTP), atau keduanya | ✅ **keduanya** |
| ~~K5~~ | Tempat mengatur server MCP | ✅ **Settings** |
| ~~K6~~ | Jalur Google Drive pertama (resmi jarak jauh / komunitas lokal) | ⏸️ **ditunda** — Google Drive menyusul sesudah konektor pertama |
| ~~K7~~ | Tempat setelan & kredensial konektor | ✅ **di desktop dulu** — tersimpan di perangkat, tidak ikut akun |

### Konektor pertama: Ecosystem Crawler (dibaca 22 Okt 2026)

Proyek Python terpisah milik Owner (ADR `CRW-0001…0010`, disetujui 21 Okt): "indra dan tangan" Mamet — mencari,
mengambil, dan menyimpan data mentah dari 16 sumber; **tidak** menganalisis. Sudah punya wajah MCP:

- **Jalur:** server lokal **stdio**, dijalankan dari `<folder crawler>\.venv\Scripts\crawler-mcp.exe` — cocok dengan
  K7 (desktop dulu); proses utama Electron yang menjalankannya. Tanpa kunci OAuth; kunci sumber (YouTube, Reddit)
  tetap di `.env` crawler sendiri.
- **Alat:** `katalog` · `jalankan_misi` (menunggu ≤ 110 detik, lalu mengembalikan `misi_id`) · `status_misi` ·
  `daftar_misi` · `baca_tangkapan` (berhalaman, penulis berupa pseudonim) · `ekspor_misi` (menulis berkas ke
  `hasil/`).
- **Pembagian peran sudah cocok dengan konstitusi Mamet:** crawler = Search Port / pengumpulan Research Port; perencana
  & analisis = Mamet (ADR-CRW-0003); data masuk sebagai *Hypothesis* (ADR-CRW-0002, `05_KNOWLEDGE_SYSTEM.md`).
- **Tujuan Owner di balik crawler (22 Okt):** Ecosystem Crawler sejak awal diciptakan **agar kodenya bisa disalin dan
  disatukan ke Mamet Ecosystem**. Agent yang membangunnya sengaja tidak diberi tahu, supaya fokus membangun dan tidak
  langsung menyambungkannya ke Mamet. Karena itu rencana integrasi di repo crawler (ADR-CRW-0006 M4: HTTP API +
  adapter) **bukan acuan** — arah integrasi ditetapkan di dokumen ini.

**Teks penjelasan crawler yang tertinggal dari sakelarnya — ✅ diperbaiki 23 Okt di repo crawler** (belum di-commit
di sana): sakelar `robots.txt` **sudah ada dan bekerja** — `CRAWLER_PATUHI_ROBOTS` di `.env` (`konfig.py`, bawaan =
tidak dipatuhi, ADR-CRW-0010). Yang tertinggal hanya **teks yang dibaca AI**: `INSTRUKSI` di `mcp_server.py` ("hanya
memakai jalur yang diizinkan robots.txt … tidak menyamar"), catatan sumber `web` di `katalog`, dan `batas_laju`
sumber `web`/`rss_media`/`mediakonsumen` ("robots.txt dipatuhi") masih menulis aturan lama ADR-CRW-0009 — Mamet akan
menjawab "ya, dipatuhi" padahal sakelarnya mati. Kini: instruksi menyuruh AI membaca **`akses`** di hasil `katalog`,
yang diisi dari keadaan sakelar saat server mulai (`patuhi_robots`, `stealth`, dan satu kalimat keterangan); teks
tetap tak lagi menyebut keadaan sakelar. Dijaga `tests/test_teks_akses.py` (5 kasus; 2 mutasi menggigit); uji crawler
33/33.

**Catatan untuk rancangan lengkap:**
- **T12:** hasil tangkapan (data orang lain, sudah berpseudonim) ikut terkirim ke penyedia model saat dibaca Mamet.

| # | Pertanyaan | Keputusan Owner (22 Okt) |
|---|---|---|
| ~~K8~~ | Satuan persetujuan K2 untuk alur bertahap | ✅ **sekali per misi** — mencakup `status_misi` dan `baca_tangkapan` **misi itu saja**, supaya Owner tidak dibanjiri permintaan persetujuan. Misi baru = persetujuan baru |
| ~~K9~~ | Urutan "disatukan" | ✅ **kode crawler disalin ke repo Mamet lebih dulu, baru disambungkan** (23 Okt). Antarmukanya tetap MCP lokal: crawler = Python, Mamet = Electron/JS — tetap dua proses meski satu repo |
| ~~K10~~ | Python untuk crawler di desktop | ✅ **Python ikut dibundel ke pemasang Mamet** (23 Okt) — crawler jalan tanpa Python terpasang di laptop; pemasang membesar |

Semua pertanyaan terbuka sudah diputuskan Owner.

### Google Drive — ditunda (catatan untuk nanti, diperiksa 22 Okt 2026)

- **Resmi Google — jarak jauh:** `https://drivemcp.googleapis.com/mcp/v1`, Streamable HTTP, OAuth 2.0, cakupan
  `drive.readonly` + `drive.file`. Alat baca: `search_files`, `get_file_metadata`, `get_file_permissions`,
  `list_recent_files`, `read_file_content`; alat bertindak: `create_file`, `copy_file`, `download_file_content`.
  **Status: Developer Preview** — syaratnya keanggotaan Google Workspace Developer Preview Program, proyek Google
  Cloud, Drive API + Drive MCP API diaktifkan, dan klien OAuth ([panduan Google](https://developers.google.com/workspace/drive/api/guides/configure-mcp-server)).
- **Komunitas — lokal (stdio) atau jarak jauh:** mis. `taylorwilsdon/google_workspace_mcp` (MIT, aktif) — kode
  pihak ketiga yang berjalan di laptop dengan akses token Drive Owner.
- **Server rujukan lama** `@modelcontextprotocol/server-gdrive` **sudah diarsipkan** (Mei 2025) — tidak dipakai.
- Jalur mana pun butuh **proyek Google Cloud + klien OAuth milik Owner**. Membuatnya adalah langkah Owner sendiri
  (pembuatan akun dan kredensial tidak dikerjakan AI).

## 5. Keadaan kode hari ini (dibaca 23 Okt 2026)

| Yang ada | Letak | Dipakai rancangan untuk |
|---|---|---|
| Protokol alat lewat **tag teks**: model menulis `<alat_folder>{…}</alat_folder>`, desktop menjalankannya, hasilnya dikirim sebagai putaran berikutnya (maks. 4 putaran) | `folderKerjaAlat.js`, `AssistantService.processMessage` | pola yang sama untuk konektor — **tidak bergantung pada fitur *tool calling* model mana pun** (MAEF: model bisa diganti) |
| Program dijalankan tanpa shell, `.exe` dicari sendiri, lingkungan dibersihkan dari rahasia, batas waktu & keluaran | `electron/alatFolderJalan.cjs` | cara menjalankan server crawler |
| Dialog izin asli (Tolak/Izinkan) di proses utama | `electron/main.cjs` (`folder:alat`, `depsEngineer.mintaIzin`) | persetujuan misi |
| Folder kerja hanya aktif di workspace Assistant | `AssistantService._statusFolderKerja` | contoh pemisahan per workspace (K3) |
| Settings bertab (`BAGIAN_SETTINGS`), termasuk "Alat & Kemampuan" | `Settings.jsx` | tempat tab Konektor (K5) |
| Pemasang NSIS, `files` = `dist` + `electron` | `frontend/package.json` `build` | belum membawa apa pun selain JS |
| Crawler: `CRAWLER_ROOT` memindahkan `.env`, `data/`, `hasil/`, `inbox/` ke folder lain | `crawler/konfig.py` | data crawler di folder yang bisa ditulis (folder program pemasang hanya-baca) |
| Ukuran crawler terpasang: Python 3.12, `site-packages` **411 MB**, browser stealth (`ms-playwright`) **719 MB** | `.venv`, `%LOCALAPPDATA%\ms-playwright` | menentukan K14 |
| Klien MCP | — | **belum ada**; `@modelcontextprotocol/sdk` tidak terpasang |

## 6. Rancangan bertahap

Batas konstitusi yang dipegang di semua tahap: capability tidak saling terhubung langsung — semua lewat MAEF
(`03_CAPABILITY_PORT.md`); adapter wajib **mengisolasi risiko luar dan mencegah injeksi** (`12_CAPABILITY_ADAPTER_SPEC.md`)
— teks hasil tangkapan adalah tulisan orang di internet, jadi diperlakukan sebagai **data, bukan perintah**; data
luar berstatus **Hypothesis** dan tidak boleh berlabel terverifikasi (`05_KNOWLEDGE_SYSTEM.md`,
`24_ANTI_HALLUCINATION_PROTOCOL.md`); Owner menyalakan/mematikan capability tanpa mengubah Kernel.

**Tahap A — Salin kode crawler ke `capability/ecosystem-crawler/` (K9, K11–K13; dikoreksi Owner 23 Okt).** ✅ **Selesai
23 Okt** ([log](../project-memory/changelog/2026-10-23-konektor-mcp-tahap-a-salin-crawler.md)). Intinya
memang **menyalin saja** — sesudah itu crawler dikembangkan di folder ini. Yang disalin: kode asli (`crawler/`,
`tests/`, `pyproject.toml`, `misi/`, `inbox/_CARA_PAKAI.txt`, `docs/adr/`, `README.md`, `LICENSE`, `.gitignore`,
`.env.example`, `.mcp.json.example`) **dan `.env`** (garam pseudonim, kunci YouTube/Reddit, proxy). Yang **tidak**
disalin, karena bukan kode dan hanya berlaku di folder asalnya: `.venv/` (alamat Python di dalamnya menunjuk folder
lama), `.git/`, cache (`__pycache__`, `.pytest_cache`, `*.egg-info`), `.mcp.json` (alamat mesin), `.claude/`, serta
data tangkapan `data/` & `hasil/` (tetap di folder lama). Tiga langkah kecil sesudah menyalin:
1. **`.env` tidak boleh ter-commit** — repo Mamet **publik** di GitHub. Pola `.env*` di `.gitignore` akar repo
   sudah menutupnya, dan `.gitignore` bawaan crawler (ikut disalin) menutup `data/`, `hasil/`, `inbox/*`, `.venv/`.
   Dibuktikan dengan `git status` / `git check-ignore` sebelum commit.
2. **`.venv` disalin juga — tanpa mengunduh apa pun** (koreksi Owner 23 Okt: dependensi sudah ada, 411 MB). Python
   dasarnya ada di laptop yang sama (`pyvenv.cfg` → `C:\Users\HP\AppData\Local\Programs\Python\Python312`), dan
   pustaka pihak ketiga di `site-packages` tidak terikat alamat folder. **Jebakan yang wajib dibersihkan:** crawler
   terpasang mode *editable* — `__editable___ecosystem_crawler_0_1_0_finder.py` berisi
   `MAPPING = {'crawler': 'D:\\SLAMET\\other\\ecosystem crawler\\crawler'}`. Disalin apa adanya, `import crawler`
   di folder baru **diam-diam memuat kode di folder lama**, tanpa galat. Begitu pula `Scripts\*.exe` (`pip.exe`,
   `pytest.exe`, `crawler-mcp.exe`, …) dan `activate*` yang menyimpan alamat `.venv` lama. Maka sesudah menyalin:
   - dihapus dari salinan: `__editable__.ecosystem_crawler-0.1.0.pth`, `__editable___ecosystem_crawler_0_1_0_finder.py`,
     `ecosystem_crawler-0.1.0.dist-info`, `Scripts\*.exe` selain `python.exe`/`pythonw.exe`, dan `Scripts\activate*`;
   - crawler selalu dijalankan sebagai `.venv\Scripts\python.exe -m crawler.wajah.mcp_server` (dan `-m pytest`,
     `-m pip`) dengan folder kerja = `capability/ecosystem-crawler/` — Python memuat paket `crawler` dari folder
     kerja itu, jadi pemasangan *editable* tidak dibutuhkan;
   - uji penjaga: `crawler.__file__` wajib berada di bawah `capability/ecosystem-crawler/`, dan tak ada berkas di
     `.venv` salinan yang masih memuat alamat folder lama.
   `.venv` (411 MB) ikut ter-ignore oleh `.gitignore` crawler — tidak masuk repo publik.
3. Uji crawler (pytest, 33 kasus) dijalankan di folder baru dan dimasukkan ke suite `uji/` lewat pembungkus.

Catatan untuk Tahap E: `.venv` tidak bisa dibawa pemasang sendirian karena bergantung pada Python dasar di laptop.
Pemasang perlu Python dasar + `site-packages` — keduanya juga bisa **disalin** dari laptop ini, tidak harus diunduh.
Tampilan aplikasi belum berubah di tahap ini.

**Tahap B — Klien MCP di proses utama.** ✅ **Selesai 23 Okt**
([log](../project-memory/changelog/2026-10-23-konektor-mcp-tahap-b-klien-mcp.md)) — `panggil()` belum punya jalur dari
layar; jalurnya datang bersama gerbang persetujuan di Tahap D. Modul baru `electron/konektorMcp.cjs`: menjalankan server MCP lokal (stdio)
dengan aturan `alatFolderJalan` (tanpa shell, lingkungan bersih, folder kerja tetap), lalu `initialize` →
`tools/list` → `tools/call`. Satu proses server per workspace yang menyalakannya (K3); dimatikan saat konektor
dimatikan atau aplikasi ditutup. Batas waktu per panggilan (misi crawler menunggu ≤ 110 s) dan batas ukuran hasil.
Jembatan ke layar lewat `preload.cjs`. Pustaka: K15.

**Tahap C — Settings › Konektor (K5, K7).** ✅ **Selesai 23 Okt**
([log](../project-memory/changelog/2026-10-23-konektor-mcp-tahap-c-settings.md)) — susunan ①–⑤ disetujui Owner dari
pratinjau; dari layar hanya `status` & `atur` (sakelar tersimpan). Tab baru: daftar konektor (crawler sebagai konektor bawaan), sakelar
**terpisah** untuk Assistant dan Engineer (K3), status kesehatan, dan keadaan akses crawler (`akses` dari `katalog`:
robots.txt & stealth). Setelan disimpan **di perangkat** lewat proses utama — tidak ikut akun (K7). Versi web
menampilkan "hanya tersedia di desktop".

**Tahap D — Protokol ke model + persetujuan sekali per misi (K2, K8).** 🟡 **Kode & deploy selesai 26 Okt**
([log](../project-memory/changelog/2026-10-26-konektor-mcp-tahap-d-gerbang-protokol.md)) — rantai penuh terbukti
tanpa model; batas putaran ditetapkan 6 (3 alat/putaran). Uji live pertama 26 Okt: blok prompt sampai ke model
(log `[Konektor] aktif … 14 sumber siap`); dua koreksi menyusul (keterangan sumber — `arctic_shift` = arsip Reddit;
pesan saldo menyebut plafon ulang) — sudah ter-deploy di v531 (06:23:25 UTC 26 Okt, 33 dtk sesudah commit `3153dba`;
diperiksa di platform 27 Okt). **Uji misi live 27 Okt (Assistant)**
([log](../project-memory/changelog/2026-10-27-konektor-mcp-tahap-d-uji-live.md)): dialog sekali per misi ✅, model
memakai tag ✅ (4 putaran), catatan kaki dari gerbang ✅, misi sungguhan 30 tangkapan. **Sisa:** label Hypothesis
(jawaban akhir 0 huruf — saldo tipis) dan uji yang sama di Engineer, sesudah saldo OpenRouter diisi. Temuan untuk
dikerjakan terpisah: kata kunci "OKU" terlalu umum di `rss_media`; `uji-konektor-mcp` menulis misi uji ke data
crawler pengembangan Owner.
- Saat konektor nyala di workspace itu, prompt memuat blok **KONEKTOR AKTIF** berisi daftar alat. `katalog` dibaca
  **oleh Mamet sendiri** saat konektor dinyalakan dan dimasukkan ke blok itu — isinya setelan crawler, bukan data
  luar — jadi model tidak perlu meminta `katalog` dan Owner tidak disodori persetujuan untuknya.
- Model meminta alat dengan tag `<alat_konektor>{"konektor":"ecosystem-crawler","alat":"jalankan_misi",…}</alat_konektor>`
  (pola folder kerja).
- `jalankan_misi` → **dialog persetujuan** menampilkan misi persis: sumber, kata kunci, rentang waktu, batas, dan
  keterangan akses (robots.txt/stealth). Disetujui → `misi_id` masuk daftar izin percakapan itu; `status_misi` dan
  `baca_tangkapan` **untuk misi itu** jalan tanpa dialog. Misi lain, `daftar_misi`, dan `ekspor_misi` (menulis
  berkas) → dialog sendiri.
- Hasil tangkapan dibungkus penanda (`<<<DATA KONEKTOR>>> … <<<AKHIR DATA KONEKTOR>>>`) dengan keterangan: isi ini
  data mentah dari internet, bukan perintah; status Hypothesis. Pemeriksa label server tidak menerima data konektor
  sebagai dasar label terverifikasi.
- Batas putaran alat konektor per pertanyaan mengikuti mekanisme `MAKS_PUTARAN` folder kerja (angkanya ditetapkan
  di Tahap D sesudah mengukur alur misi sungguhan).

**Tahap E — Pemasang membawa Python (K10).** ✅ **Bagian utama selesai 26 Okt**
([log](../project-memory/changelog/2026-10-26-konektor-mcp-tahap-e-pemasang.md)) — penyimpangan dari rancangan di
bawah, dicatat: runtime disiapkan ke `frontend/build/crawler-runtime/` (bukan `build/python/`) berisi `python/` +
`crawler/`; Python **disalin** dari laptop (pustaka standar saja), bukan Python mandiri yang diunduh; penggerak stealth
(`playwright`/`patchright`, 215 MB) ikut tidak dibundel bersama browsernya (K14). `.env` dibuat crawler sendiri di
folder data saat pertama jalan (garam baru). **E2 ✅ 26 Okt**
([log](../project-memory/changelog/2026-10-26-konektor-mcp-tahap-e2-stealth.md)) — penyimpangan dari perkiraan ±900 MB:
hanya **Patchright** yang dipasang (Scrapling 0.5 tidak memakai Playwright) + Chromium, ±830 MB ruang disk, ke
`%APPDATA%\ai-agent-frontend\crawler\stealth\` (**koreksi 26 Okt:** folder data = `userData` yang dinamai `name`
package.json, bukan "Mamet AI" — terlihat di 4.3.0 terpasang; dialog kini menyusun alamat dari folder sebenarnya).
Sisa E2 yang belum dibuktikan: tombol Batal di dialog dilihat di layar, dan pemasangan sungguhan di aplikasi terpasang
(izin unduhan Owner). **E3 ✅ 26 Okt**
([log](../project-memory/changelog/2026-10-26-konektor-mcp-tahap-e3-transparansi.md)) — keputusan Owner: tetap satu
bundel (bukan unduh dari repo `ecosystem-crawler`), stealth tetap saat dibutuhkan, isi terpasang transparan di
Settings ⑦ (daftar dari `komponen.json` yang ditulis build). **Ditunda:** tombol "Hapus komponen stealth".
**Terbukti di 4.3.0 terpasang (laptop Owner):** konektor menyala dari runtime bawaan pemasang, ⑦ "Bawaan pemasang —
179 MB · 83 paket"; **PC lain tanpa Python** (laptop 4 GB Windows 10): menyala di percobaan kedua — percobaan
pertama melewati batas 30 s karena bundel tanpa bytecode → 4.3.1 membawa bytecode & batas 90 s
([log](../project-memory/changelog/2026-10-26-rilis-4.3.1-crawler-cepat-menyala.md)). **Sisa bukti:** laptop itu
menyala di percobaan pertama dengan 4.3.1. Rancangan semula: Skrip build menyiapkan Python 3.12 mandiri + dependensi crawler ke
`build/python/`, dibawa lewat `extraResources`. Saat jalan, server crawler dijalankan dari Python bawaan itu dengan
`CRAWLER_ROOT` = `%APPDATA%\Mamet AI\crawler\` (yang terwujud: `%APPDATA%\ai-agent-frontend\crawler\`) (folder program pemasang hanya-baca); `.env` ditempatkan di sana saat
pertama dipasang. Browser stealth sesuai K14.

**Tahap F — menyusul:** server MCP jarak jauh (K4 bagian HTTP) dan Google Drive (K6).

**Uji tiap tahap:** setiap tahap punya uji di `uji/` yang dibuktikan bisa merah (mutasi), mengikuti kebiasaan repo;
Tahap B–D juga dibuktikan di aplikasi desktop sungguhan (`npm run desktop`) — misi kecil dijalankan dari chat
Assistant, dialog muncul sekali, hasil terbaca, Engineer tetap tak terhubung (K3).

## 7. Keputusan

| # | Pertanyaan | Keputusan Owner (23 Okt) |
|---|---|---|
| ~~K11~~ | Letak kode crawler di repo Mamet | ✅ **`capability/ecosystem-crawler/`** di akar repo — sejajar `frontend/`, `backend/`, `mametlite/`; "capability" mengikuti istilah konstitusi |
| ~~K12~~ | Sesudah disalin, di mana crawler dikembangkan | ✅ **di folder Mamet**; repo `ecosystem-crawler` **dibiarkan apa adanya** (tidak diarsipkan, tidak disentuh). Perubahan di Mamet tidak mengalir balik ke sana |
| ~~K13~~ | Yang ikut disalin | ✅ **kode asli + `.env`** (garam pseudonim & kunci); data tangkapan tidak — gudang di Mamet mulai baru |
| ~~K15~~ | Pustaka klien MCP | ✅ **SDK resmi `@modelcontextprotocol/sdk`** — diunduh dengan izin Owner 23 Okt (1.32.1) |
| ~~K14~~ | Browser stealth | ✅ **tidak dibundel** (keputusan Owner 26 Okt, sesuai usul) — termasuk penggeraknya (`playwright`/`patchright`); diunduh dengan izin saat pertama dibutuhkan (E2). Tanpanya halaman yang memblokir dilewati & dicatat |

## 8. Langkah berikutnya

Tahap A ✅ → B ✅ → C ✅ → D 🟡 (uji live 27 Okt: 3 dari 4 kriteria ✅; **label Hypothesis + bagian Engineer** sesudah
saldo OpenRouter diisi) → E ✅ + E2 ✅ + E3 ✅ (pemasangan
stealth sungguhan & PC bersih dibuktikan sesudah rilis berikutnya / Windows Sandbox) → F menyusul. Rilis **4.3.0** (versi dinaikkan 26 Okt) membawa konektor ke aplikasi terpasang; build GitHub
(`build.yml`) membangun `.venv` crawler sendiri dari `capability/ecosystem-crawler/requirements-bundel.txt` (86 paket
terkunci, Python 3.12.10) — daftar itu wajib diperbarui bersama `.venv` pengembangan
([log](../project-memory/changelog/2026-10-26-rilis-4.3.0-crawler-terbundel.md)).
