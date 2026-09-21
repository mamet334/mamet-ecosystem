# Folder Kerja Assistant — Tahap 0 Selesai: Pagar Alamat `folder:*` (Item 85)

**Tanggal:** 21 September 2026
**Roadmap:** Item 85 ([`ROADMAP-FOLDER-KERJA-ASSISTANT.md`](../../roadmap/ROADMAP-FOLDER-KERJA-ASSISTANT.md)), T8 ([`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md))
**Status:** ✅ Tahap 0 selesai — diuji Owner di `npm run desktop` (4/4). Tahap 1 menunggu aba-aba Owner.

## Pagar alamat (`frontend/electron/pagarFolder.cjs`, baru)

Modul murni (tanpa Electron, bisa diuji di Node) — satu-satunya pintu dari alamat relatif yang ditulis AI ke berkas
sebenarnya. Semua alat folder Tahap 1–3 wajib lewat sini.

- `akarFolderSah(dipilih)` — menolak akar drive (`C:\`, terlalu luas), folder Windows (`%SystemRoot%` & isinya),
  bukan-folder, dan yang tak bisa dibuka.
- `alamatDalamPagar(akar, relatif)` — menolak alamat absolut dalam bentuk apa pun (`C:\`, `C:x`, `\\server`, `\\?\`,
  `/…`, `\…`), `..` yang keluar, titik dua (aliran data tersembunyi Windows), nama perangkat (`CON`, `nul.txt`),
  nama berakhiran titik/spasi, karakter terlarang, NUL, alamat kosong. Pagar dinilai dari **alamat sebenarnya**
  (`realpathSync.native` pada induk terdekat yang ada) — junction/symlink di dalam folder yang menunjuk ke luar
  ditolak walau teksnya terlihat di dalam.

## IPC (`main.cjs`, `preload.cjs`)

`folder:pilih` (dialog → `akarFolderSah` → akar disimpan **di proses utama**), `folder:status`, `folder:lepas`.
Layar hanya menerima **nama** folder, tidak pernah alamat lengkapnya; akar tidak pernah diterima dari layar.
`window.electronAPI.folderKerja.{pilih,status,lepas}`. Belum ada alat baca/tulis (Tahap 1).
Paket installer ikut membawa modul baru (`build.files` memuat `electron/**/*`).

## Bukti

**Uji serangan Node: 33/33 benar** — folder sementara dengan dua junction nyata (`mklink /J`): satu ke folder
"rahasia" di luar, satu ke dalam.
- Diterima: berkas biasa, akar (`.`), garis miring terbalik, huruf besar, berkas yang belum ada, `..` yang tetap di
  dalam, junction yang menunjuk ke dalam.
- Ditolak: `..` keluar (1 & 2 tingkat), folder kembar berawalan sama (`Proyek Saya-lain`), 6 bentuk alamat
  absolut, **3 serangan junction ke luar** (baca berkas, junction itu sendiri, berkas baru lewat junction), aliran
  data, 2 nama perangkat, titik di akhir, karakter terlarang, NUL, kosong, spasi saja.
- Akar: folder biasa diterima; `C:\`, `%SystemRoot%`, `System32`, berkas, folder tak ada ditolak.
- Isi folder rahasia utuh sesudah uji.

**Uji Owner di aplikasi (`npm run desktop` dijalankan ulang): 4/4 sesuai** — `status` kosong → `pilih` folder
proyek (hanya nama) → `pilih` `C:\` ditolak dengan folder sebelumnya tetap aktif → `lepas`.

## Sisa butir Tahap 0

| Butir | Hasil |
|---|---|
| Hapus jalur lama | ✅ sejak `ed19ba1` (2026-09-15) |
| `edit-file-surgical` | **dipertahankan** — masih dipakai `CommandRegistry.writeFile` |
| `fs:writeFile` / `fs:deleteFile` tanpa pagar | **dibiarkan untuk Engineer** (`StorageManager`); folder kerja tidak memakainya |
| Mode `AI` di `execution_context.ts` | **diperiksa & dilaporkan, tidak diubah** — lihat di bawah |

**Mode `AI` tidak pernah aktif.** Tidak ada klien yang mengirim `mode: 'AI'`, dan `request_parser.ts` mengisi
`ASSISTANT` bila mode kosong, sehingga cabang `desktopOSMode ? "AI"` tak tercapai (akar yang sama dengan temuan
mode LITE, U8 Item 90). Akibat: `canUseAutomation` hanya benar di mode `AI` → **`cron_manager` selalu diblokir
untuk semua pengguna** (`policy_middleware.ts`); `subAgentEnabled` selalu salah. Memperbaikinya = menyalakan
penjadwalan untuk pengguna → keputusan Owner.

## Temuan T8 (dicatat, belum diperbaiki)

`CommandRegistry.js` menyusun perintah PowerShell dengan menyisipkan alamat mentah (`-Path '${args.path}'`); alamat
bertanda petik tunggal bisa menambah perintah lain. Dipicu tombol perintah Engineer sesudah klik pengguna. Rincian &
arah solusi di roadmap temuan.
