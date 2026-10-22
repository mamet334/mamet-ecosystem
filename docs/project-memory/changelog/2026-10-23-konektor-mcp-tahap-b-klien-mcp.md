# 23 Oktober 2026 — Konektor MCP Tahap B: klien MCP di proses utama (Item 129)

Item 129 ([`ROADMAP-KONEKTOR-MCP.md`](../../roadmap/ROADMAP-KONEKTOR-MCP.md)), Tahap B. Keputusan Owner K15: *"ya ikut
saran anda mengunduh"* — pustaka klien = SDK resmi.

## Yang dibuat

- **`@modelcontextprotocol/sdk` 1.32.1** (dependensi produksi, ikut pemasang; 69 paket diunduh dengan izin Owner).
- **`frontend/electron/konektorMcp.cjs`** — klien MCP, modul murni (tanpa `electron`, bisa diuji dengan node):
  - **per workspace (K3):** satu proses server per (`ws-assistant`/`ws-engineer`, konektor); kunci `${ws}::${id}`.
  - **lingkungan daftar putih:** server hanya menerima variabel aman dari SDK (`getDefaultEnvironment`: PATH, TEMP,
    USERPROFILE, …) + pengaturan Python; nama berbau rahasia dibuang lagi sebagai penjaga kedua. Kunci API di proses
    Electron tidak sampai ke server.
  - **Python milik konektor**, alamat absolut (`capability/ecosystem-crawler/.venv/Scripts/python.exe`), dijalankan
    `python -m crawler.wajah.mcp_server`; tanpa `.venv` → ditolak dengan alasan, tidak memakai Python di PATH.
  - batas: sambung 30 s, panggilan 60 s (maks 150 s — `jalankan_misi` menunggu ≤ 110 s), hasil 60.000 huruf
    (dipotong & ditandai), ekor log server 4.000 huruf untuk keterangan galat.
  - `matikan` menutup klien lalu `taskkill /T` (proses anak, mis. browser stealth, ikut mati).
- **`main.cjs`**: IPC `konektor:status|nyalakan|matikan`; semua sesi dimatikan pada `will-quit`. Akar repo = dua
  tingkat di atas berkas (`npm run desktop`); di aplikasi terpasang konektor "tidak tersedia" sampai Tahap E.
- **`preload.cjs`**: `electronAPI.konektor.{status, nyalakan, matikan}`.
- **Pemanggilan alat (`tools/call`) sengaja TIDAK punya jalur dari layar.** K2 mewajibkan persetujuan Owner untuk
  setiap alat, dan gerbang itu harus di proses utama — dibangun di Tahap D bersama jalurnya.

## Bukti

- Server crawler sungguhan lewat modul: nyala dengan 6 alat; Engineer tetap mati saat Assistant dinyalakan; Engineer
  dinyalakan → proses sendiri (pid berbeda); `tools/call katalog` → JSON berisi `akses`; alat tak dikenal & argumen
  bukan objek ditolak; mematikan Assistant tidak mematikan Engineer; proses benar-benar berhenti.
- Proses utama **Electron 42.3.3** (Node 24.15) tanpa jendela: nyala → `katalog.akses` terbaca → semua mati.
- Suite 116/116; build produksi tanpa peringatan.

## Uji

| Uji | Yang dijaga |
|---|---|
| `uji/uji-konektor-mcp.mjs` v1 (baru, 25 pengecekan) | peluncuran (alamat absolut, `python -m`, folder kerja, tanpa rahasia, tanpa `.venv` ditolak) · hasil berbatas · K3 dengan server sungguhan · K2: tak ada IPC `konektor:panggil` · dimatikan saat keluar. Tanpa `.venv` → DILEWATI |

Lima mutasi dibuktikan menggigit: kunci API bocor ke server, K3 dirusak (workspace diabaikan), `matikan` tak
menghentikan proses, jatuh ke Python di PATH, layar diberi jalur `tools/call`.
