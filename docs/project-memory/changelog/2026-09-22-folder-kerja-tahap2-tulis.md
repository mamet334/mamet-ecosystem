# Folder Kerja Assistant — Tahap 2: Tulis & Perbarui (Item 85)

**Tanggal:** 22 September 2026
**Roadmap:** Item 85 ([`ROADMAP-FOLDER-KERJA-ASSISTANT.md`](../../roadmap/ROADMAP-FOLDER-KERJA-ASSISTANT.md))
**Status:** ✅ selesai — terbukti live di desktop (folder uji `D:\SLAMET\other\uji-folder-kerja`).

## Penyimpangan dari roadmap (keputusan Owner)

Roadmap menulis alat tulis "lewat `CommandRegistry`". Diperiksa: semua perintah tulisnya dirakit sebagai teks
PowerShell dari alamat mentah (`Remove-Item -Force -Path '${args.path}'` — tanda petik di alamat bisa menyisipkan
perintah, hapus permanen, pagar dinilai di layar) = temuan **T8**. Maka alat tulis dibangun seperti alat baca Tahap 1:
modul murni di proses utama, `fs` langsung, setiap alamat lewat `alamatDalamPagar`. `CommandRegistry` tidak disentuh.

## Yang dibuat

- `frontend/electron/alatFolderTulis.cjs` (baru, murni; izin & tempat sampah disuntikkan):
  - `folder_write` — buat/timpa teks ≤200 KB, lewat berkas sementara lalu ganti nama; berkas biner tak ditimpa.
  - `folder_edit` — ganti SATU potongan; potongan harus muncul **tepat sekali** (0 atau >1 → ditolak); akhir baris
    CRLF berkas & LF dari model disamakan.
  - `folder_mkdir`, `folder_rename` (tujuan tak boleh ada, folder tak bisa masuk ke dirinya), `folder_delete` →
    **Recycle Bin** (`shell.trashItem`), bukan permanen.
  - Akar folder kerja tak bisa ditimpa/diganti nama/dihapus; **ekstensi yang bisa dijalankan** (`.exe .dll .bat .cmd
    .ps1 .vbs .js .lnk .scr .msi .reg …`) tak bisa ditulis, diedit, atau dijadikan tujuan ganti nama.
- `main.cjs`: **dialog izin asli proses utama** (`dialog.showMessageBox`, tombol bawaan **Tolak**) dengan pratinjau —
  isi (tulis), **sebelum → sesudah** (edit), peringatan Recycle Bin (hapus); layar & model tak bisa melewatinya. Log
  `[FOLDER] … → OK / DITOLAK OWNER / DITOLAK: alasan`.
- `folderKerjaAlat.js`: tag alat tulis (isi/cari/ganti tidak dipotong diam-diam — proses utama menolak dengan alasan),
  hasil "BERHASIL (disetujui Owner)" / "DITOLAK OWNER … jangan mengulang"; blok prompt: ubah **hanya yang diminta**,
  baca dulu sebelum edit, **jangan mengaku sudah menyimpan** tanpa hasil BERHASIL. Berkas yang ditulis bukan "sumber"
  label (hanya yang dibaca).
- `AssistantService.js`: langkah "✍️ menunggu izin Anda … (lihat dialog)"; catatan kaki **perubahan yang dicatat dari
  proses utama** (✅ / 🚫 ditolak / ⚠️ gagal), bukan dari kata model.
- `FolderKerjaTombol.jsx`: tooltip menyebut ubah-dengan-izin & Recycle Bin.

## Bukti live

| Chat | Folder (dicek langsung di disk) | Jawaban |
|---|---|---|
| Buat `laporan.md` → Izinkan | berkas 1.004 B tercipta, isi benar | "✅ `laporan.md`" |
| Ganti `hitung_total` → `hitung_jumlah` → Izinkan | hanya 2 nama berubah (baris 1 & 10), 211 → 213 byte | "⚠️ gagal, ✅, ✅" — edit pertama **ditolak** (potongan muncul 2×), model memecah jadi 2 edit |
| Hapus `catatan.txt` → **Tolak** | berkas utuh | "Anda menekan Tolak… tidak akan mengulang" · "🚫 ditolak" |
| Tulis `..\bocor.txt` | tak ada berkas, tak ada dialog | ditolak model |

DevTools (langsung ke proses utama, tanpa model): `folder_write` `..\\bocor.txt` → `ok:false` "alamat keluar dari
folder kerja", tanpa dialog; tidak ada `bocor.txt` di disk. Biaya: tingkat model terkunci (`flash`), ±$0,001–0,003
per permintaan.

## Uji otomatis (di luar git, `frontend/node_modules/.uji-rag/`) — semua lulus

- `uji-alat-folder-tulis.cjs` **46/46** — folder & junction nyata; tulis/timpa/edit (CRLF, multi-baris, ganda, tak
  ada)/mkdir/rename/hapus-ke-sampah; tolak Owner = tak berubah; 5 ekstensi terlarang; 10 serangan (`..`, absolut,
  `C:\Windows`, perangkat, aliran data, junction) ditolak **sebelum dialog muncul**; berkas di luar tetap utuh.
- `uji-folder-tulis-protokol.mjs` **15/15**; `uji-folder-kerja-protokol.mjs` v3 (Tahap 1, 2 butir diperbarui karena
  `folder_write` kini sah); `uji-folder-label.mjs` & `uji-alat-folder.cjs` tetap lulus.

## Catatan

- Laporan tindakan ("penghapusan ditolak") diberi label HYPOTHESIS oleh sistem karena model tak menulis label — label
  "dokumen" kurang cocok untuk laporan tindakan; dirapikan kelak.
- Model sesekali menulis kalimat bergaya catatan kaki sendiri; catatan kaki sistem tetap yang berlaku.
