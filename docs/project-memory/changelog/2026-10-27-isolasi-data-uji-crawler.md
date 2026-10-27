# 27 Oktober 2026 — Uji konektor tidak lagi menulis ke data crawler Owner (Item 129)

Temuan sampingan uji live Tahap D ([log](./2026-10-27-konektor-mcp-tahap-d-uji-live.md)): gudang crawler pengembangan
Owner (`capability/ecosystem-crawler/data/gudang.db`) berisi misi "uji rantai" dari suite uji. Dikerjakan di sesi
cabang (worktree `trusting-allen-11dab0`), diperiksa & digabung di sesi ini atas izin Owner, bersama pembersihan data.

## Akar masalah (temuan sesi cabang)

`uji-konektor-protokol.mjs` bagian 5 menjalankan misi sungguhan lewat gerbang di **mode pengembangan**, dan mode itu
menjalankan crawler **tanpa `CRAWLER_ROOT`** — crawler memakai folder repo sebagai akar data. Setiap putaran suite =
satu misi di gudang Owner: **29 misi "uji rantai"** (22–27 Okt) dari 30 misi.

## Yang dibuat

- **`konektorMcp.cjs`** (sesi cabang): opsi **`folderDataPengembangan`** — khusus uji, **tidak pernah diisi `main.cjs`**:
  di mode pengembangan `CRAWLER_ROOT` ke folder itu. Sengaja bukan `folderData`: `main.cjs` selalu mengirim
  `folderData` (%APPDATA%), jadi menghormatinya di mode pengembangan akan memindahkan data `npm run desktop` Owner
  diam-diam.
- **`uji/gudangCrawler.mjs`** (sesi cabang, baru): potret misi di gudang repo sebelum uji (hanya-baca, `node:sqlite`);
  gudang yang ada tapi gagal dibaca → melempar, bukan "kosong".
- **`uji-konektor-protokol.mjs` v3** (sesi cabang): akar data sementara; penjaga **dua arah** — misi uji WAJIB ada di
  gudang sementara dan TIDAK BOLEH menambah misi di gudang repo.
- **`uji-konektor-mcp.mjs` v5** (sesi cabang): crawler sungguhan memakai akar sementara (`gudang.db`, `.env` garam,
  `inbox`); tanpa opsi itu perilaku Owner tetap.
- **Ditambah sesi ini — celah uji**: jaminan "data `npm run desktop` tidak pindah" hanya diuji pada `peluncuran`, tidak
  pada pengelola yang dibangun seperti `main.cjs`. Mutasi "pengelola meneruskan `folderData` ke mode pengembangan"
  **lolos**. Kini `pengelola.rencanaPeluncuran(id)` — rencana peluncuran tanpa menjalankan apa pun (program, folder
  kerja, akar data; lingkungan lain tidak dibuka) — dan uji pengelola seperti `main.cjs`: akar data tetap folder
  crawler repo. Mutasi yang tadi lolos kini **menggigit**.

## Bukti

- **Sesi cabang tidak bisa membuktikan bagian crawler sungguhan**: worktree-nya tidak punya `.venv` crawler maupun
  `node_modules` (tidak masuk git) — bagian itu dilewati di sana. Dibuktikan di checkout `main`: kedua uji lulus dengan
  crawler sungguhan; gudang Owner **30 → 30** selama uji.
- Mutasi: pembaca gudang "buta" (selalu kosong) → menggigit (penjaga dua arah); pengelola memakai `folderData` di mode
  pengembangan → menggigit sesudah uji tambahan. Mutasi yang akan menulis ke gudang Owner sengaja tidak dipakai.
- **Suite penuh 121/121, gudang Owner tetap 1 misi sesudahnya** — isolasi berlaku untuk seluruh suite.

## Pembersihan data Owner (atas izin Owner)

Uji kering dulu, lalu satu transaksi: **29 misi "uji rantai" + 58 baris peristiwanya** dihapus; misi itu tidak punya
tangkapan (sumber `inbox` kosong), jadi tak ada tangkapan atau berkas mentah yang disentuh. Misi "Ogan Komering Ulu" dan
30 tangkapannya utuh. Sesudah: misi 1, tangkapan 30, peristiwa 11, `integrity_check` ok.
**Cadangan** (API backup SQLite, konsisten walau server crawler sedang membuka gudang):
`capability/ecosystem-crawler/data/cadangan-sebelum-bersih-uji-20261027-100338/gudang.db` — 30 misi, integritas ok;
folder `data/` diabaikan git (tidak ter-commit ke repo publik).

## Sisa

- Worktree `trusting-allen-11dab0` (cabang `claude/trusting-allen-11dab0`) tidak lagi dibutuhkan — isinya sudah di
  `main`; boleh dibuang Owner.
