# 23 Oktober 2026 — Konektor MCP Tahap A: Ecosystem Crawler disalin ke `capability/ecosystem-crawler/` (Item 129)

Item 129 ([`ROADMAP-KONEKTOR-MCP.md`](../../roadmap/ROADMAP-KONEKTOR-MCP.md)), Tahap A. Keputusan Owner:

> *"tinggal di kembangkan di folder mamet ecosystem sesuai saran anda capability/ecosystem-crawler/. repo ecosystem
> crawler di biarkan saja. kita hanya ambil kode aslinya saja bersama dokumen .envnya"* · *"apakah dependensi Python
> tidak bisa di copy juga, karena sudah ada?"*

## Yang disalin

- **Kode & dokumen** (61 berkas): `crawler/`, `tests/`, `pyproject.toml`, `misi/`, `docs/adr/` (ADR-CRW-0001…0010),
  `README.md`, `LICENSE`, `.gitignore`, `.gitattributes`, `.env.example`, `.mcp.json.example`,
  `inbox/_CARA_PAKAI.txt`. Cache Python dibuang.
- **`.env`** (garam pseudonim) — **ter-ignore**, tidak masuk repo (repo Mamet publik): pola `.env*` di `.gitignore`
  akar + `.gitignore` crawler. Dibuktikan dengan `git check-ignore` sebelum commit.
- **`.venv`** (415 MB) — disalin, tidak diunduh ulang; ter-ignore.
- **Tidak disalin:** `data/`, `hasil/` (data tangkapan tetap di folder asal — gudang di sini mulai baru), `.git/`,
  `.mcp.json` (alamat mesin), `.claude/`. Repo `ecosystem-crawler` asal tidak disentuh.

## Jebakan penyalinan `.venv`

Crawler terpasang di `.venv` asal dalam mode *editable*: finder-nya berisi
`MAPPING = {'crawler': 'D:\\SLAMET\\other\\ecosystem crawler\\crawler'}`, dan 33 program `Scripts\*.exe` serta
`activate*` menyimpan alamat `.venv` asal. Disalin apa adanya, `crawler-mcp.exe`/`pip.exe` menjalankan Python dan kode
di folder **asal**, tanpa satu pun galat. Pemindai menemukan alamat lama di 38 berkas.

Dibersihkan: penunjuk *editable* (`.pth`, finder, `dist-info`), semua `Scripts\*` selain `python.exe`/`pythonw.exe`,
dan baris `command` di `pyvenv.cfg`. Crawler kini dijalankan lewat `.venv\Scripts\python -m …` dari folder ini —
Python memuat paket `crawler` dari folder kerja, jadi pemasangan *editable* tak diperlukan. README salinan diberi
catatan cara menjalankan dan larangan `pip install -e .` / `pip install .`.

## Bukti

- `python -m crawler katalog` dari folder baru: membaca `.env` & sakelar dengan benar (robots.txt tidak dipatuhi,
  stealth nyala).
- Server MCP dari folder baru (`python -m crawler.wajah.mcp_server`): jabat tangan `initialize` (protokol
  `2025-06-18`) → `tools/list` mengembalikan 6 alat → keluar bersih (kode 0).
- Pytest crawler 34/34; suite Mamet 115/115.

## Uji

| Uji | Yang dijaga |
|---|---|
| `capability/ecosystem-crawler/tests/test_letak_paket.py` (baru) | paket `crawler` yang termuat berada di folder ini — dijalankan dari folder asal, ia merah ("crawler dimuat dari …\ecosystem crawler") |
| `uji/uji-crawler.mjs` v1 (baru) | tak ada alamat folder asal di `pyvenv.cfg`, `Scripts\`, `.pth`, finder, `direct_url.json`; editable dicabut; pytest crawler lulus. **Merah sebelum pembersihan** (38 berkas), hijau sesudahnya. `.venv` tak ada → DILEWATI |
