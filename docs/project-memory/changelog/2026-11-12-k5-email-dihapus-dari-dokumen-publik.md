# 12 November 2026 — K5: alamat email akun dihapus dari dokumen publik

Keputusan Owner 12 Nov: *"no 2 hapus, saya izinkan juga untuk mametlite"* — alamat email dihapus (bukan disamarkan),
termasuk `mametlite/CHANGELOG.md`.

## Temuan

Roadmap mencatat "email akun di 3 dokumen publik". Pemindaian ulang (pola alamat Gmail/Yahoo/Outlook/Hotmail/Proton di
seluruh berkas yang dilacak git) menemukan lebih banyak: **7 dokumen, 20 kemunculan, 4 alamat berbeda** (3 akun uji
isolasi + 1 alamat contoh uji gerbang UUID), ditambah `graphify-out/graph.json` & `GRAPH_REPORT.md` yang menyalin judul
dokumen tersebut.

## Yang diubah

| Berkas | Pengganti |
|---|---|
| `docs/tasks/SECURITY-AUDIT-2026-06-27.md` | Akun 1 (Owner) / Akun 2 / Akun 3 |
| `docs/roadmap/ZERO-LEAKAGE-RAG-TENANT-ISOLATION.md` | Akun 1 (Owner) / Akun 2 / Akun 3 |
| `docs/project-memory/changelog/2026-09-04-rag-multi-account-audit-…` | Akun 1 (Owner) / Akun 2 / Akun 3 |
| `docs/project-memory/changelog/2026-09-08-fix-cross-app-appsource-…` | "akun Owner sendiri" tanpa alamat |
| `docs/project-memory/changelog/2026-06-23-execution-engine-…` | "sebuah alamat email" |
| `docs/roadmap/INDEX-ROADMAP-ARSIP-2026-09-17.md` | akun Owner / akun kedua |
| `mametlite/CHANGELOG.md` | alamat dibuang dari kalimat (dokumen saja, aplikasi tidak tersentuh) |
| `graphify-out/` (graph.json, GRAPH_REPORT.md, graph.html) | dibangun ulang `graphify update .` (nol token) |

## Bukti

- `git grep` pola alamat email di seluruh berkas yang dilacak: **0** (kode keluar 1); nama lokal ketiga akun juga 0,
  termasuk bentuk id simpul graf (`…_gmail_com`).
- Kode tidak berubah; tidak ada deploy.

## Batas yang diketahui

- **Riwayat git tetap memuat alamat lama.** Owner memilih menghapus dari berkas sekarang, bukan menulis ulang riwayat
  (push paksa). Siapa pun yang meng-clone repo masih bisa menemukannya di commit lama.
- Salinan cadangan graf (`graphify-out/2026-11-09/`, `2026-11-12/`) dan cache AST graphify masih memuat alamat lama; keduanya
  tidak dilacak git (hanya di laptop Owner).
