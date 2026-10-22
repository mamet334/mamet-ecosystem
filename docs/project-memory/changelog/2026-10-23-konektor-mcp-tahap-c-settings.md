# 23 Oktober 2026 — Konektor MCP Tahap C: Settings › Konektor, setelan di perangkat (Item 129)

Item 129 ([`ROADMAP-KONEKTOR-MCP.md`](../../roadmap/ROADMAP-KONEKTOR-MCP.md)), Tahap C. Susunan tampilan disetujui
Owner dari pratinjau ①–⑤ (*"ya sesuai"*) sebelum kode diubah.

## Yang dibuat

- **`frontend/src/components/BagianKonektor.jsx`** — tab ke-11 Settings ("Konektor", ikon `lan`):
  ① tab sendiri · ② sakelar **terpisah** Assistant / Engineer (K3) dengan status (menyalakan… / menyala / mati /
  berhenti) · ③ cara crawler mengakses halaman — robots.txt & stealth, **hanya ditampilkan** (sakelarnya di `.env`
  crawler) · ④ konektor yang tak bisa dijalankan: alasan ditampilkan · ⑤ versi web: "hanya di aplikasi desktop".
  Warna = token palet (`primary`, `error`, `tertiary`) sehingga ikut keempat tema; ikon lewat `<Ikon>`.
- **`konektorMcp.cjs`**:
  - setelan sakelar **di perangkat** (K7) — `%APPDATA%\Mamet AI\konektor.json`; hanya workspace & konektor yang
    dikenal dengan nilai `true` yang diterima; berkas rusak → semua mati (aman ke arah mati);
  - `pulihkan()` saat aplikasi siap: yang dinyalakan Owner menyala lagi;
  - `katalog` dibaca **Mamet sendiri** saat konektor menyala → ringkasan (`akses`, jumlah sumber, yang siap) untuk
    Settings — tanpa membuka jalur `tools/call` dari layar;
  - penjaga tekan-ganda: dua permintaan menyala bersamaan → satu proses.
- **Satu jalur dari layar:** `electronAPI.konektor.{status, atur}`; `nyalakan`/`matikan` langsung dicabut — setelan
  selalu sama dengan yang berjalan. `tools/call` tetap tanpa jalur dari layar (K2, Tahap D).

## Bukti

- **Aplikasi desktop Owner** (tangkapan layar 23 Okt 01.30 WIB): tab Konektor tampil — Assistant menyala, Engineer
  mati, "16 sumber (14 siap)", robots.txt tidak dipatuhi · stealth nyala.
- Pane: komponen asli dirender dengan status sungguhan; menekan sakelar Engineer → "menyalakan…" lalu "● menyala",
  hanya `atur('ws-engineer', …, true)` yang terpanggil, Assistant tak berubah; keadaan ④ & ⑤ benar; 0 galat konsol.
- Ke-51 kelas Tailwind yang dipakai komponen ada di CSS hasil build. Suite 116/116; build tanpa peringatan.

## Uji

| Uji | Yang dijaga |
|---|---|
| `uji-konektor-mcp.mjs` v2 (36 pengecekan) | + setelan tersimpan per workspace · dipulihkan saat "aplikasi dibuka lagi" (Assistant nyala, Engineer mati) · berkas rusak / nilai asing ditolak · tekan-ganda = satu proses · ringkasan `katalog` · hanya `status`/`atur` di preload |
| `uji-settings-bertab.mjs` v3 | 11 bagian; tab Konektor terdaftar dengan ikon dari subset font |

Tiga mutasi baru menggigit: penjaga tekan-ganda dicabut, sakelar satu workspace tersimpan untuk semua, setelan tak
dipulihkan. Dua cacat ditangkap gerbang lama sebelum selesai: ikon ditulis langsung (bukan `<Ikon>`) + warna hijau
mentah (`uji-ciri-tampilan`), dan dua `catch` diam tanpa keterangan (`uji-catch-diam`) — keduanya dibetulkan.
