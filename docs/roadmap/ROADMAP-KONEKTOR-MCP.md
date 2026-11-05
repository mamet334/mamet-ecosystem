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
**Tahap G 🟡 3 Nov** (G1 ✅ pipa proses utama — [log](../project-memory/changelog/2026-11-03-konektor-mcp-tahap-g1-pipa-umum.md); G2 ✅ Settings — [log](../project-memory/changelog/2026-11-03-konektor-mcp-tahap-g2-settings-umum.md); G3 ✅ protokol + gerbang K17, server v546 — [log](../project-memory/changelog/2026-11-03-konektor-mcp-tahap-g3-protokol-umum.md); G5 ✅ menu tombol + di chat — [log](../project-memory/changelog/2026-11-03-konektor-mcp-tahap-g5-menu-tambah.md)) — konektor umum ("banyak tangan"): server MCP apa saja lewat resep tanpa kode, alat ditinjau & dipaku, izin "selama percakapan ini", kredensial terenkripsi di perangkat; server pertama GitHub (K16–K19, §9).
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
(jawaban akhir 0 huruf — saldo tipis) dan uji yang sama di Engineer, sesudah saldo OpenRouter diisi. Temuan:
kata kunci "OKU" lolos di "Fokus" → **✅ diperbaiki 27 Okt** dua sisi — crawler: kata ≤ 4 huruf & akronim = kata utuh;
model: arahan menganalisis entitas & mendampingi akronim; server v532
([log](../project-memory/changelog/2026-10-27-crawler-kata-kunci-pendek.md)). Suite uji menulis misi uji ke data
crawler pengembangan Owner → **✅ diperbaiki 27 Okt** (akar data sementara khusus uji, penjaga dua arah; 29 misi uji
dibersihkan dengan cadangan — [log](../project-memory/changelog/2026-10-27-isolasi-data-uji-crawler.md)).
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
**28 Okt:** pemasangan bisa gagal karena antivirus masih memegang berkas baru saat folder paket dipindah (`EPERM`, 2
dari 6 jalan uji) — dulu melempar mentah & meninggalkan folder sementara; kini diulang sampai 10 s lalu gagal bersih
([log](../project-memory/changelog/2026-10-28-uji-stealth-dan-vite.md)), menunggu rilis berikutnya.
Sisa E2 yang belum dibuktikan: tombol Batal di dialog dilihat di layar, dan pemasangan sungguhan di aplikasi terpasang
(izin unduhan Owner). **E3 ✅ 26 Okt**
([log](../project-memory/changelog/2026-10-26-konektor-mcp-tahap-e3-transparansi.md)) — keputusan Owner: tetap satu
bundel (bukan unduh dari repo `ecosystem-crawler`), stealth tetap saat dibutuhkan, isi terpasang transparan di
Settings ⑦ (daftar dari `komponen.json` yang ditulis build). **Ditunda:** tombol "Hapus komponen stealth".
**Terbukti di 4.3.0 terpasang (laptop Owner):** konektor menyala dari runtime bawaan pemasang, ⑦ "Bawaan pemasang —
179 MB · 83 paket"; **PC lain tanpa Python** (laptop 4 GB Windows 10): menyala di percobaan kedua — percobaan
pertama melewati batas 30 s karena bundel tanpa bytecode → 4.3.1 membawa bytecode & batas 90 s
([log](../project-memory/changelog/2026-10-26-rilis-4.3.1-crawler-cepat-menyala.md)). **Sisa bukti ✅ 3 Nov:** di PC kedua
Owner (Windows 10, pemasang **4.4.1**), crawler menyala di **percobaan pertama**. Apakah PC itu laptop 4 GB yang sama dengan 26 Okt tidak dipastikan ([log](../project-memory/changelog/2026-11-03-rilis-4.4.1.md)). Rancangan semula: Skrip build menyiapkan Python 3.12 mandiri + dependensi crawler ke
`build/python/`, dibawa lewat `extraResources`. Saat jalan, server crawler dijalankan dari Python bawaan itu dengan
`CRAWLER_ROOT` = `%APPDATA%\Mamet AI\crawler\` (yang terwujud: `%APPDATA%\ai-agent-frontend\crawler\`) (folder program pemasang hanya-baca); `.env` ditempatkan di sana saat
pertama dipasang. Browser stealth sesuai K14.

**Tahap F — 📋 dirancang 3 Nov (§10):** server MCP jarak jauh dengan OAuth, dibuktikan dengan Notion. Google Drive (K6) tetap ditunda, karena Google Cloud meminta kartu kredit.

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
terkunci, Python 3.12.10; sejak 4.3.2 ber-hash + `--require-hashes`) — daftar itu wajib diperbarui bersama `.venv`
pengembangan lewat `scripts/kunci_bundel.py`, bukan disunting tangan
([log](../project-memory/changelog/2026-10-26-rilis-4.3.0-crawler-terbundel.md)).

---

## 9. Tahap G — Konektor umum ("banyak tangan") — 🟡 G1 ✅ G2 ✅ G3 ✅ G5 ✅ 3 Nov 2026 (G4 GitHub live menunggu unduhan, token, saldo)

**Permintaan Owner (3 Nov):** MCP adalah tangan Mamet dan harus optimal. Owner ingin bisa memasang **server MCP apa
saja**, bukan hanya crawler. Server pertama adalah **GitHub**. Pipanya disiapkan supaya server lain bisa digabungkan
**tanpa kode**, dan tiap berkas tetap memegang **satu tugas**.

Tahap ini fitur baru, bukan K1–K7. Menurut ADR-0022 ia boleh jalan selama uji penjaga K1–K7 tetap hijau.

### Keadaan sekarang (dibaca 3 Nov)

Konektor ditulis tangan di **tiga tempat**:
- `electron/konektorMcp.cjs` `KONEKTOR`: cara menjalankan dan aturan izin per alat;
- `shared/konektorAlat.js` `KONEKTOR_DIKENAL`: alat yang boleh diminta model;
- blok prompt khusus crawler (`blokPromptKonektor`) yang disusun server.

Protokolnya hanya melayani satu konektor aktif (`idAktif`), dan jalurnya hanya stdio. Akibatnya, menambah satu server
berarti mengubah kode di tiga tempat dan men-deploy server.

### Kenapa server umum mengubah siapa yang dipercaya

Deskripsi alat crawler ditulis Mamet sendiri, jadi tidak ada teks luar yang masuk ke prompt. Server umum berbeda:
Mamet hanya mengenal alatnya dari `tools/list`, yang berisi nama, deskripsi, dan skema argumen. Itu teks pihak lain.
Ada dua serangan MCP yang dikenal:
- **Tool poisoning:** deskripsi alat menyelipkan perintah untuk model.
- **Rug pull:** server mengganti alatnya diam-diam sesudah disetujui.

Keputusan di bawah menjawab keduanya.

### Keputusan Owner (3 Nov)

| # | Pertanyaan | Keputusan |
|---|---|---|
| ~~K16~~ | Deskripsi alat dari server luar | ✅ **Ditinjau & dipaku.** Saat menambah server, Owner melihat daftar alat beserta deskripsinya, memilih alat yang dipakai, lalu menyetujuinya. Mamet menyimpan **sidik** (SHA-256) definisi alat yang disetujui. Bila server mengubah alat itu, konektor tidak dipakai sampai Owner meninjaunya lagi. Alat baru yang belum disetujui diabaikan. Deskripsi masuk prompt sebagai DATA: dipotong dan tag alatnya dinetralkan |
| ~~K17~~ | Izin memakai alat | ✅ **Dialog untuk setiap alat**, ditambah pilihan **"izinkan alat ini selama percakapan ini"**. Ini mengikuti pola K8 crawler: Owner tidak dibanjiri dialog, dan izin tidak menyebar ke percakapan, workspace, atau alat lain |
| ~~K18~~ | Kredensial server (token GitHub, dsb.) | ✅ **Di perangkat, terenkripsi** oleh Windows (`safeStorage`/DPAPI), diisi Owner sendiri di Settings. Hanya diberikan ke server itu, sebagai variabel lingkungan (stdio) atau header (HTTP). Tidak ikut akun, tidak pernah ke layar, model, atau log |
| ~~K19~~ | Server pertama dan cara menambah yang lain | ✅ **GitHub**. Server lain ditambahkan **tanpa kode**: lewat **resep** (satu berkas JSON per server) atau isian Settings. Kode tetap **satu berkas satu tugas** |

### Cara GitHub dipasang (usulan, menunggu Owner)

- **Server lokal resmi** `github/github-mcp-server` **v2.0.3** (terbit 21 Okt 2026). Aset Windows-nya
  `github-mcp-server_Windows_x86_64.zip`, 9,6 MB. Dijalankan dengan `github-mcp-server stdio --read-only`, dan tokennya
  dibaca dari `GITHUB_PERSONAL_ACCESS_TOKEN`.
- **`--read-only`:** alat tulis (membuat issue, PR, mengubah berkas) tidak dimuat sama sekali. Membuka alat tulis
  adalah keputusan Owner berikutnya.
- **Kenapa bukan versi jarak jauh** (`https://api.githubcopilot.com/mcp/`): titiknya hidup (menjawab 401 tanpa token),
  tetapi dokumen GitHub masih menyebutnya *public preview*, dan apakah ia butuh langganan Copilot belum jelas. Versi
  lokal berstatus GA dan bekerja lewat jalur stdio yang sudah teruji.
- **Langkah Owner** (pengunduhan dan pembuatan kredensial tidak dikerjakan AI): unduh zip itu, lalu buat token
  **fine-grained** baca-saja hanya untuk repo yang ingin dibaca Mamet.

### Susunan berkas (satu berkas satu tugas)

| Berkas | Tugas tunggal |
|---|---|
| `electron/konektor/resep/<id>.json` (bawaan) + `%APPDATA%\ai-agent-frontend\konektor-resep\<id>.json` (buatan Owner) | **Resep** satu server: nama, jenis (`stdio`/`http`), program & argumen atau URL, kredensial yang diminta (nama variabel/header + label), petunjuk pasang, sumber resmi. Server baru = berkas resep baru, **tanpa kode** |
| `electron/konektor/resep.cjs` | Membaca dan memvalidasi resep (bentuk, id, jenis, tanpa shell) |
| `electron/konektor/daftarServer.cjs` | Server yang dipasang Owner (dari resep atau isian sendiri) di `userData/konektor-server.json`: tambah, ubah, hapus, validasi |
| `electron/konektor/brankas.cjs` | Kredensial per server, dienkripsi `safeStorage`. Layar hanya tahu "terisi" atau "kosong" |
| `electron/konektor/sidikAlat.cjs` | Sidik definisi alat dan perbandingannya dengan yang disetujui: sama, berubah, atau alat baru |
| `electron/konektor/transport.cjs` | Dari entri server ke transport SDK. **stdio:** program tanpa shell, lingkungan bersih, kredensial dari brankas. **HTTP:** Streamable HTTP + `Authorization: Bearer`. OAuth tetap Tahap F |
| `electron/konektor/gerbangUmum.cjs` | Izin K17: dialog per alat dan "selama percakapan ini" |
| `electron/konektorMcp.cjs` (ada) | Pengelola sesi: kini membaca konektor **bawaan** (crawler, tak berubah) **dan** daftar Owner |
| `shared/konektorUmum.js` | Definisi alat yang dipaku menjadi bentuk aman untuk prompt. Nama alat `^[A-Za-z0-9_.-]{1,64}$`, deskripsi ≤ 300 huruf dan dinetralkan, skema diringkas menjadi nama, tipe, dan wajib-tidaknya parameter. Ditambah blok prompt umum dan label HYPOTHESIS |
| `shared/konektorAlat.js` (ada) | Tag `<alat_konektor>` melayani **beberapa** konektor aktif sekaligus |
| Settings: `TambahServer.jsx`, `TinjauAlat.jsx` | Pilih resep atau isi sendiri; isi kredensial; tinjau, centang, lalu setujui alat (memaku) |

### Titik sambung (ditelusuri dari graf graphify, 3 Nov — 12.383 node, 0 berkas mati, tanpa siklus impor)

Graf dan kode menunjukkan beberapa titik yang **akan diam-diam salah** bila rancangan di atas diikuti apa adanya:

| # | Titik | Jebakan | Penanganan |
|---|---|---|---|
| S1 | Pemasang hanya membawa `dist/**` dan `electron/**` (`frontend/package.json` `build.files`) | resep di `capability/` **tidak ikut** ke aplikasi terpasang, dan tanpa galat | resep bawaan di `electron/konektor/resep/`. Resep buatan Owner di folder data (folder program pemasang hanya-baca) |
| S2 | `AssistantService._statusKonektor` menyaring `KONEKTOR_DIKENAL[x.konektor]` dan mengambil **satu** (`find`) | konektor umum yang menyala **dibuang tanpa suara**, sehingga model tak pernah melihatnya | daftar konektor aktif diambil dari status proses utama (bawaan + umum yang alatnya sudah dipaku) |
| S3 | Server `infoKonektorAman` menolak id yang tak dikenal (`null`), dan `blokPromptKonektor` hanya untuk crawler | blok prompt kosong untuk server umum | `shared/konektorUmum.js` menyaring dan menyusun blok umum. Crawler tetap memakai bloknya sendiri |
| S4 | **Aplikasi 4.4.1 terpasang** mengirim `konektor` sebagai **satu objek** | deploy server yang hanya menerima daftar akan merusak konektor crawler di aplikasi terpasang | server menerima **dua bentuk**: objek lama dan daftar baru. Dijaga uji |
| S5 | `lingkunganServer` membuang variabel yang namanya berbau rahasia (`TOKEN`, `KEY`, …) | token dari brankas ikut terbuang, dan GitHub menolak tanpa keterangan jelas | kredensial dari brankas ditambahkan **sesudah** penyaringan, hanya untuk server pemiliknya |
| S6 | `konektor:panggil` hanya membawa (workspace, konektor, alat, argumen) | izin "selama percakapan ini" (K17) tak punya kunci percakapan | IPC membawa id percakapan. Tanpa id, perilakunya kembali ke dialog setiap kali (aman ke arah tanya) |
| S7 | `uraiHasilKonektor` menulis "data mentah dari internet", dan `catatanHasilKonektor` khas crawler | keterangan salah untuk GitHub | keterangan umum "data dari layanan luar", catatan kaki umum `✓ alat` |
| S8 | Graf Home (`grafHome.js`, `HomeDashboard.jsx`) memakai `KONEKTOR_DIKENAL` | server umum tak tampil di lapisan MCP | lapisan MCP membaca status (bawaan + umum) |
| S9 | Brankas memakai `safeStorage` Electron, yang tidak ada di Node uji | uji tidak bisa menjalankan enkripsi asli | enkripsi **disuntikkan** (proses utama memberi `safeStorage`, uji memberi tiruan). Tanpa enkripsi yang tersedia, brankas **menolak menyimpan**, tidak jatuh ke teks biasa |
| S10 | Kredensial diketik Owner di layar (renderer) | nilainya harus lewat IPC sekali | layar hanya **mengirim**. `status` tak pernah mengembalikan nilai, hanya "terisi" atau "kosong" |

**Kerapian (dari graf):**
- Tidak ada siklus impor dan tidak ada node mati. Node yang "mati" hanya modul luar (`node:fs`, `xlsx`, …).
- Ada 26 berkas kode tanpa pemakai statis, dan semuanya beralasan:
  - `_knowledge_archive/` memang arsip;
  - `tools/*.js` dimuat dinamis oleh `ToolRegistryService`;
  - `IntentClassifier.js` sengaja disimpan dengan alasan tertulis (ADR-0017);
  - `backend/server.js` adalah T3.
- Tiga berkas gemuk: `ConversationEngine.jsx` (2.643 baris), `AssistantService.js` (2.054), dan `main.cjs` (1.465; kohesi 0,06). Karena itu Tahap G **tidak menambah isi** ketiganya: kabel IPC konektor umum dan putaran alat masing-masing tinggal di berkasnya sendiri.

**Data konektor umum = HYPOTHESIS.** Isinya datang dari layanan luar, bukan dari dokumen RAG Owner, sehingga pemeriksa
label server tidak menerimanya sebagai dasar VERIFIED. Aturan ini sama dengan crawler.

### Tahapan

- ✅ **G1 — Pipa proses utama** (3 Nov; mutasi 27/27, suite 149/149): resep, daftar server, brankas, sidik, transport, beserta resep `github.json`. Uji murni
  dibuktikan dengan mutasi pada salinan. Belum ada layar, server, maupun unduhan.
- ✅ **G2 — Settings** (3 Nov; mutasi 18/18, suite 150/150, tampil di aplikasi Owner): tambah server, kredensial, tinjau & paku alat, sakelar per workspace (K3). Dibuktikan di
  `npm run desktop`.
- ✅ **G3 — Protokol & server** (3 Nov; mutasi 31/32 + 1 setara, suite 151/151, agent-process v546 dibandingkan paketnya): banyak konektor aktif, blok prompt umum, gerbang K17. `agent-process` dibundel dengan
  esbuild, lalu **Owner men-deploy**. Rantainya dibuktikan tanpa model.
- **G4 — GitHub live:** Owner mengunduh biner dan membuat token. Rantai tanpa model dibuktikan dulu; jawaban model
  menyusul **sesudah saldo diisi**.
- ✅ **G5 — Konektor terlihat dari chat** (3 Nov, usul Owner): tombol + menjadi menu berisi "Percakapan baru" dan konektor workspace ini dengan sakelarnya. Titik di tombol + menandai konektor yang menyala atau bermasalah. "Atur di Settings ›" membuka tab Konektor. Mutasi 15/15, suite 152/152, tampil di aplikasi Owner.
- Server berikutnya (Notion, basis data, …) cukup **satu berkas resep**. Server jarak jauh ber-OAuth tetap di Tahap F.

---

## 10. Tahap F — OAuth: server MCP jarak jauh yang meminta login — 🟡 F1 ✅ F2 ✅ 3 Nov 2026 (jawaban model dengan alat Notion menunggu saldo)

**Permintaan Owner (3 Nov):** konektor dibuat lebih fleksibel. Akun yang terhubung harus **akun yang dipilih dan
disetujui pengguna Mamet sendiri**, seperti cara aplikasi Claude terhubung ke Google Workspace.

**Arah, setelah Owner memberi informasi baru:**
- Google Cloud meminta **kartu kredit** walaupun hanya untuk mendaftar. Karena itu jalur Google (klien OAuth buatan
  sendiri, server MCP resmi Google) **ditunda**.
- OAuth dibangun **umum**, dengan **pendaftaran klien otomatis** (*dynamic client registration*, DCR), dan
  dibuktikan dengan **Notion** (paket gratis). Owner memilih Notion untuk dicoba.

### Kenapa OAuth membuat konektor fleksibel

Sekarang server jarak jauh hanya bisa memakai kunci tetap. Sebagian besar server MCP jarak jauh modern memakai OAuth.
Dengan OAuth, resep cukup berisi **URL**, lalu pengguna menekan **"Hubungkan akun"**: login di browser dan memilih
akunnya sendiri. Di laptop lain tidak ada unduhan program, cukup menghubungkan ulang.

### Yang sudah diperiksa (3 Nov, metadata publik)

| Server | DCR | PKCE | Pencabutan token |
|---|---|---|---|
| **Notion** `https://mcp.notion.com/mcp` ("Notion MCP (Beta)") | ✅ `/register` | S256 | ✅ |
| Linear `mcp.linear.app` | ✅ | S256 | — |
| Atlassian `mcp.atlassian.com` | ✅ | plain, S256 | — |
| Sentry `mcp.sentry.dev` | ✅ | S256 | — |
| GitHub jarak jauh `api.githubcopilot.com` | ❌ metadata tak ditemukan di akar | — | — |

Notion mengikuti spesifikasi otorisasi MCP sepenuhnya:
- tanpa token, server menjawab **401** dengan `WWW-Authenticate: … resource_metadata=…/oauth-protected-resource/mcp`;
- metadata server otorisasinya memuat `authorize`, `token`, `register`, dan `revocation`;
- metode autentikasi klien `none` didukung, jadi klien publik dengan PKCE tanpa rahasia bisa dipakai;
- token pembaru (`refresh_token`) didukung.

SDK yang terpasang (`@modelcontextprotocol/sdk` 1.32.1, `client/auth.js`) sudah punya penemuan metadata, pendaftaran
klien, penukaran kode, dan pembaruan token.

### Alur

1. Resep `notion.json` berisi jenis `http`, URL, dan `oauth: true`. Tidak ada kredensial yang diketik.
2. Owner menekan **"Hubungkan akun"**:
   1. Mamet menemukan metadata, lalu **mendaftarkan dirinya** ke server itu (sekali, disimpan).
   2. Mamet membuka **browser sistem**, bukan jendela Electron, sehingga Mamet tidak pernah melihat password.
   3. Owner login dan memilih akun serta halaman Notion yang boleh diakses.
   4. Browser kembali ke `http://127.0.0.1:<port acak>/balikan`, yaitu penerima sekali pakai di proses utama
      (RFC 8252). Penerima ini memeriksa `state`, lalu Mamet menukar kode dengan token memakai PKCE.
   5. Token akses dan token pembaru disimpan di **brankas** (terenkripsi DPAPI).
3. Langkah berikutnya sama dengan GitHub: **Tinjau alat** → centang (Notion juga punya alat tulis, jadi Owner memilih)
   → sakelar per workspace → dialog izin per alat (K16, K17 tetap berlaku).
4. Token kedaluwarsa diperbarui otomatis. Kalau pembaruan gagal, statusnya **"perlu hubungkan ulang"**, tanpa
   percobaan berulang diam-diam.
5. **"Putuskan"** mencabut token lewat `revocation_endpoint` bila ada, lalu menghapus token dan data pendaftaran dari
   brankas.

### Susunan berkas (satu berkas satu tugas)

| Berkas | Tugas |
|---|---|
| `electron/konektor/oauthPenyedia.cjs` | Implementasi `OAuthClientProvider` SDK: metadata klien (nama "Mamet Ecosystem", alamat balikan loopback, `token_endpoint_auth_method: none`), simpan/baca informasi klien & token lewat brankas, simpan verifier PKCE di memori, buka URL otorisasi di browser sistem (hanya https) |
| `electron/konektor/penerimaBalikan.cjs` | Server HTTP sekali pakai di `127.0.0.1`, port acak, satu jalur `/balikan`, periksa `state`, batas waktu 5 menit, halaman "kembali ke Mamet", lalu tutup |
| `electron/konektor/alurOAuth.cjs` | Orkestrasi `hubungkan(id)` dan `putuskan(id)`, serta status (terhubung / perlu hubungkan ulang) |
| `resep.cjs`, `transport.cjs`, `sesiUmum.cjs`, `ipcUmum.cjs` (ada) | Bidang `oauth` di resep; transport HTTP memakai `authProvider`; IPC `hubungkan`/`putuskan` |
| `KartuServerUmum.jsx` (ada) | Untuk server OAuth: tombol "Hubungkan akun" / "Putuskan" menggantikan kolom token |
| `electron/konektor/resep/notion.json` | Resep Notion (data, bukan kode) |

### Batas keamanan

- Alamat balikan **hanya loopback**. `state` diperiksa. PKCE **S256 wajib**: server yang tidak mendukungnya ditolak.
- URL otorisasi dibuka hanya bila `https`. Pemeriksaan bahwa host-nya sama dengan host di metadata server otorisasi
  dilakukan **SDK** (rancangan ini belum memastikannya; diuji di F1).
- Token tidak pernah ke layar, model, atau log. Batas nilai brankas (4.096 huruf) perlu dinaikkan atau token disimpan
  sebagai entri tersendiri.
- Per perangkat dan per akun Windows (K7, K18). Laptop lain menghubungkan sendiri.
- T12: hasil alat Notion ikut terkirim ke penyedia model, sama seperti GitHub.

### Keputusan untuk Owner

| # | Pertanyaan | Usulan |
|---|---|---|
| K20 | Server OAuth pertama | ✅ **Notion** (dipilih Owner 3 Nov). Google ditunda (butuh kartu kredit) |
| K21 | Alat Notion yang boleh dipakai | ✅ Alat **baca** dulu (cari, ambil halaman), alat tulis menyusul. Dipilih Owner saat Tinjau alat |
| K22 | "Putuskan" | ✅ Cabut di Notion (`revocation_endpoint`) **dan** hapus dari brankas |
| K23 | Pembaruan token gagal | ✅ Status "perlu hubungkan ulang", sakelar tetap tercatat, server tidak dinyalakan |

K21–K23 disetujui Owner pada 3 Nov. Owner juga sudah mendaftar akun Notion untuk pemakaian pribadi.

### Tahapan

- ✅ **F1 — Pipa OAuth** (3 Nov; mutasi 23/23, suite 153/153 —
  [log](../project-memory/changelog/2026-11-03-konektor-mcp-tahap-f1-pipa-oauth.md)): penyedia, penerima balikan, dan
  alur, diuji dengan **server OAuth + MCP tiruan lokal** (DCR, PKCE, `state`, pembaruan, pencabutan). Uji menemukan
  satu cacat: token pembaru tak pernah dipakai di mode diam. Sudah diperbaiki.
- ✅ **F2 — Settings** (3 Nov; mutasi 13/13 + 8/8, suite 154/154, server v547 — [log](../project-memory/changelog/2026-11-03-konektor-mcp-tahap-f2-notion-oauth.md)): "Hubungkan akun" / "Putuskan", resep `notion.json`, dan Tinjau alat untuk server besar (Tandai semua / Tandai alat baca / perkiraan token). Batas dinaikkan menjadi 100 alat per konektor dan 40.000 huruf per blok. Notion terhubung di aplikasi Owner dengan 37 alat baca; log server memuat `[KonektorUmum] aktif github(27 alat), notion(37 alat)`.
- **F3 — Notion live:** Owner membuat akun Notion gratis, menghubungkan, meninjau alat, dan menyalakan. Rantai tanpa
  model dibuktikan dulu; jawaban model menyusul sesudah saldo ada.
- Server agent-process **tidak berubah** (protokol G3 sudah umum).
- Sampai ke aplikasi terpasang lewat **rilis berikutnya**, bersama G1–G5.

### GitHub lewat OAuth — tanpa `github-mcp-server.exe` (📋 diputuskan 3 Nov 2026)

**Alasan (Owner, 3 Nov):** pengguna lain sebaiknya bisa menghubungkan akun GitHub mereka **tanpa repot mengunduh
`github-mcp-server.exe`**, sama seperti Notion.

**Yang diperiksa (3 Nov, metadata publik):**
- Server MCP jarak jauh GitHub `https://api.githubcopilot.com/mcp/` mengikuti standar otorisasi MCP: menjawab 401
  dengan `resource_metadata`, dan nama sumber dayanya "GitHub MCP Server".
- Server otorisasinya `https://github.com/login/oauth`, dengan **PKCE S256**, `refresh_token`, dan **device code**.
  Metadata ini ada di `github.com/.well-known/oauth-authorization-server/login/oauth`.
- **Tidak ada pendaftaran klien otomatis** (`registration_endpoint` tidak ada). Mamet harus didaftarkan **sekali** sebagai
  GitHub App. Pendaftarannya gratis dan tanpa kartu kredit.
- Ada jalur **baca-saja** `…/mcp/readonly` dengan metadatanya sendiri (jalur sembarang menjawab 404).
- Metadata tidak mencantumkan cara autentikasi klien.

**Belum pasti, dan baru terjawab lewat percobaan:**
1. Apakah server jarak jauh mewajibkan **langganan Copilot**.
2. Apakah penukaran kode login mewajibkan **client secret**.
3. Apakah GitHub menerima alamat balikan `127.0.0.1` dengan **port yang berubah-ubah**.

**Keputusan Owner (3 Nov, mengikuti usulan):**

| # | Pertanyaan | Keputusan |
|---|---|---|
| ~~K24~~ | GitHub untuk banyak pengguna | ✅ **OAuth ke server jarak jauh GitHub**. Owner mendaftarkan **satu GitHub App "Mamet Ecosystem"** sebagai penerbit. `client_id`-nya ikut di resep bawaan. Setiap pengguna login dengan akunnya sendiri dan memilih repo di layar GitHub. Token disimpan di brankas laptop masing-masing |
| ~~K25~~ | Rahasia klien | ✅ **Tidak disimpan di aplikasi**, karena pemasang bisa dibongkar. Bila GitHub mewajibkannya, dipakai **device flow** (kode singkat dimasukkan di `github.com/login/device`; dirancang untuk aplikasi desktop, tanpa rahasia). Penukaran lewat server Mamet hanya cadangan terakhir |
| ~~K26~~ | Alat yang tersedia | ✅ **Sama dengan Notion:** jalur penuh `…/mcp/`, lalu Owner memilih lewat **Tinjau alat** (Tandai semua / Tandai alat baca / centang sendiri; label baca / bisa menghapus; perkiraan token). Izin GitHub App **mulai baca saja** (Contents, Issues, Pull requests, Metadata). Alat tulis akan ditolak GitHub sampai izin App diperluas, dan itu keputusan terpisah |
| ~~K27~~ | Bila server jarak jauh butuh Copilot | ✅ GitHub tetap memakai `.exe` (stdio, seperti sekarang). Apakah `.exe` dibundel di pemasang atau diunduh sendiri diputuskan sesudah percobaan |

**Tahapan:**
- **GH1 — Owner mendaftarkan GitHub App.** Isinya: nama "Mamet Ecosystem"; alamat balikan `http://127.0.0.1/balikan`;
  Device Flow aktif; webhook mati; izin Repository Contents/Issues/Pull requests/Metadata Read-only; bisa dipasang
  oleh akun mana pun.
- ✅ **GH1** (3 Nov): GitHub App "Mamet Ecosystem" didaftarkan Owner, Client ID `Iv23li3SbHZO7UlcxipI`, tanpa rahasia
  klien.
- ✅ **GH2 — Dukungan klien terdaftar** (3 Nov; mutasi 29/29 —
  [log](../project-memory/changelog/2026-11-03-konektor-mcp-gh2-klien-terdaftar.md)): resep menerima `oauthKlienId`
  (tanpa DCR) dan pipa F1 memakainya. Hasil percobaan dengan akun Owner:
  - port 127.0.0.1 acak **diterima**;
  - web flow **mewajibkan client secret** (`incorrect_client_credentials`);
  - device flow **jalan tanpa rahasia**;
  - kebutuhan Copilot belum terjawab.

  Lanjut ke GH3.
- ✅ **GH3 — Device flow** (5 Nov; mutasi 23/23, suite 155/155 —
  [log](../project-memory/changelog/2026-11-05-konektor-mcp-gh3-login-perangkat.md)): login perangkat tanpa rahasia,
  kode tampil di kartu, ada tombol Batal, dan galat 200 GitHub dibaca jujur.
  - **Di aplikasi Owner:** GitHub jarak jauh terhubung, 28 alat baca menyala di Assistant, tanpa `.exe`. Server
    jarak jauh bekerja untuk akun Owner; akun tanpa Copilot belum dibuktikan.
  - **Temuan:** transport HTTP MCP dan OAuth sejak G1/F1 memakai `fetch()` Node lewat SDK. Kini semuanya lewat
    `net.fetch` (`jaringanKonektor.cjs`).
- **GH4 — Resep bawaan:** `github` beralih ke OAuth, dan `.exe` menjadi resep cadangan (K27). GitHub `.exe` di laptop
  Owner tetap berjalan sampai GH4.
