# ROADMAP: KONEKTOR MCP — MAMET ECOSYSTEM

**Item:** 129
**Status:** 📋 **Terdaftar 22 Okt 2026** — K1–K10 diputuskan Owner (konektor pertama = Ecosystem Crawler ·
semua alat menunggu persetujuan · per workspace · lokal & jarak jauh · diatur di Settings · desktop dulu · persetujuan sekali
per misi · kode crawler disalin ke repo dulu · Python dibundel di pemasang; Google Drive ditunda); rancangan
lengkap menyusul.
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

## 5. Langkah berikutnya

Rancangan lengkap bertahap di dokumen ini (kode terkait dibaca lebih dulu: proses utama Electron, Settings, alur
persetujuan, pemasang) → dikoreksi Owner → baru dikerjakan. Yang perlu dirancang, menurut keputusan K1–K10: letak
kode crawler di repo · bundel Python + dependensi crawler di pemasang · klien MCP stdio di proses utama · Settings per
workspace · persetujuan sekali per misi.
