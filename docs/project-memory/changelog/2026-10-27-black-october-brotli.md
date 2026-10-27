# 27 Oktober 2026 — "Black October": pengambil web pindah ke jaringan Chromium, CI naik ke Node 24 (T20)

Owner meminta berita "black oktober". Isinya: sekumpulan pengumuman celah keamanan 17–22 Okt 2026 — LiteLLM (versi palsu
1.107.0 di PyPI/Docker), PHP2Shell, GitLab, eMudhra, dan **Brotli CVE-2026-111497 ("Node2Shell")**. Diperiksa terhadap
repo: hanya Brotli yang mengenai Mamet. LiteLLM tidak ada di repo maupun di 86 paket crawler; PHP & GitLab tidak dipakai.

## Yang terkena

Dekoder Brotli yang rentan bisa menulis di luar buffer → eksekusi kode, cukup dengan respons ber-`Content-Encoding: br`
yang dirancang. Tertambal di Node 22.23.4 / 24.22.1 / 26.12.1 (21 Okt); Node 20 sudah habis dukungan, tidak ditambal.

| Tempat | Versi (diukur) | Keadaan |
|---|---|---|
| Electron 42.3.3 — Node bawaan | 24.15.0 | **rentan** |
| Electron 42.3.3 — Chromium bawaan | 148.0.7778.218 | **tertambal** (lihat bukti di bawah) |
| `net:fetchWeb` (`main.cjs`) | `fetch()` Node di PROSES UTAMA ke situs/RSS pihak ketiga | **jalur yang terbuka** |
| GitHub Actions (`build.yml`, `production-pipeline.yml`) | Node 20 | tak akan ditambal |
| Laptop Owner | Node 24.15.0 | rentan — dinaikkan Owner sendiri |

Per 27 Okt **belum ada Electron stabil** yang membawa Node ≥ 24.22.1 (42.11.18 → 24.19.0; 43.8.3, 44.9.3, 45.0.0 →
24.22.0; indeks `releases.electronjs.org`). Menaikkan Electron belum menyelesaikannya.

**Bukti Chromium 148 tertambal** (dari GitHub, bukan dari artikel): `third_party/brotli/README.chromium` di tag
148.0.7778.218 = brotli `cfa184a` (2026-03-18). API compare `0ed4268...cfa184a` → `ahead`, `behind_by: 0`, jadi
`0ed4268` "Detect and report invalid stream earlier" (2026-02-27) ada di dalamnya. Rilis brotli v1.2.1 (catatan:
"CVE-2026-111497") hanya berisi `b418fa8` — commit berjudul sama, tanggal sama, berkas sama (`decode.c` +59/−30 vs
+58/−29, `decode.h` +1/−3) — dan satu commit persiapan rilis.

## Yang dibuat

- **`frontend/electron/ambilWeb.cjs`** (baru): pengambil Tier 3 dipindah dari `main.cjs`; `fetch` disuntikkan.
  `main.cjs`: `ipcMain.handle('net:fetchWeb', (event, permintaan) => ambilWeb(net.fetch, permintaan))`.
- **Dua celah yang dibawa `net.fetch` ikut ditutup** — `net.fetch` lebih luas dari `fetch()` Node:
  - **hanya http/https**: `net.fetch` melayani `file:` dan `mamet://` (dokumentasi Electron sendiri) — tanpa penjaga,
    saluran pencarian web bisa membaca berkas lokal;
  - **`credentials: 'omit'`**: tanpa opsi ini `net.fetch` di Electron 42 **mengirim cookie sesi** — dokumentasi tipenya
    menyiratkan sebaliknya; ketahuan dari uji di Electron sungguhan (mutasi), bukan dari dokumen.
- Batas waktu kini menjangkau pembacaan badan (versi lama membersihkannya begitu header tiba).
- Proksi sistem Windows kini dihormati (Chromium membacanya; `fetch()` Node tidak).
- Komentar "Node.js Network Bridge" di `preload.cjs` & `WebComparisonService.js` diperbarui.
- **CI → Node 24 + `check-latest: true`** di kedua workflow: tanpa `check-latest`, `setup-node` boleh memakai Node 24
  yang tersimpan di runner — bisa lebih tua dari 24.22.1.

## Bukti

- **`uji/uji-ambil-web.mjs`** (baru): (1) logika dengan tiruan — `file:`/`mamet:`/`data:`/`javascript:`/`ftp:` ditolak
  tanpa menyentuh jaringan, kredensial, header, batas waktu termasuk badan macet; (2) kabel `main.cjs` + **tak ada
  `fetch()` Node di 14 berkas proses utama**; (3) **Electron 42.3.3 sungguhan** + server lokal: respons `br` diurai
  utuh (Chromium meminta `gzip, deflate, br, zstd`), `file://` ditolak & cookie tidak terkirim — masing-masing dengan
  **kontrol positif** (`net.fetch` mentah memang membaca `file://` dan mengirim cookie), server macet dibatalkan ±0,4 s.
- **Mutasi 6/6 menggigit**: main memakai `fetch` Node; penjaga skema dibuang; `credentials` dibuang; timeout dibersihkan
  sebelum badan; suntikan diabaikan; `fetch()` disisipkan ke berkas proses utama lain. Satu mutasi awalnya membuat uji
  **menggantung** alih-alih melapor GAGAL — kasus itu kini diberi batas sendiri.
- Electron tidak menjalankan `main.js` uji bila diberi argumen tambahan (URL & jalur): keluar −1 tanpa satu baris pun;
  aplikasi yang sama tanpa argumen berjalan. Parameter kini lewat `parameter.json`.
- **Suite penuh 122/122.**
- **Live di `npm run desktop`** (Owner, 15:06; proses Electron mulai 15:04:29 — sesudah berkas diubah 14:18–14:19):
  "berita terbaru" → `_safeFetch` → IPC → Bing News RSS **5 hasil, 2.312 ms**; tak ada "IPC fetchWeb non-ok/exception"
  dan tak jatuh ke `proxy_fetch`. Jawaban terpotong `max_tokens=133` = saldo OpenRouter tipis, tak terkait.
- **CI sesudah push** (`07b6dc8`, run 40477534855 Production Pipeline): validate-environment, build-frontend
  (`npm ci` + build Vite), deploy-edge-functions (simulasi) — semua ✅. Log setup-node: `Resolved as '24.22.1'`,
  `node: v24.22.1` — versi tertambal, bukan Node 24 lama dari cache runner.

## Batas yang diketahui

- Aplikasi terpasang baru menerima ini lewat rilis berikutnya (4.3.2).
- `build.yml` di Node 24 baru terbukti pada rilis berikutnya — sengaja tidak dipicu manual (memicunya = menerbitkan
  rilis). `production-pipeline.yml` sudah terbukti (lihat Bukti).
- Renderer sudah memakai jaringan Chromium sejak dulu (`webSecurity: false`, lihat `uji-cangkang-electron`) — tidak
  diubah.
