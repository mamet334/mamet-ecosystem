# 2 November 2026 — Bersih-bersih Parkir: kode mati, sampah uji di basis data, `.gitignore` folder terlarang

Tiga butir Parkir (ADR-0022) yang tak butuh saldo maupun deploy, dikerjakan atas permintaan Owner.

## 1. Kode mati dihapus

| Berkas | Kenapa mati (diukur) |
|---|---|
| `supabase/functions/test-suite/` (`index.ts`, `deno.json`, `.npmrc`) | Tak pernah ter-deploy (daftar fungsi platform 30 Okt); rusak sintaks (`catch` tanpa `try`, baris 140 — esbuild & graphify); memakai service role dan ID uji palsu yang menulis ke basis data |
| `agent-process/lib/maef/engineering_lifecycle.ts` | Satu baris `// MOVED to lib/orchestration/lifecycle/…`; tak terjangkau dari `index.ts` (graphify) |
| `agent-process/plugins/memory_manager.ts` | Tak terdaftar di `plugins/registry.ts`; memori ditangani `memory_write_worker` & `memory_manager_v1` |

- Seksi `[functions.test-suite]` di `supabase/config.toml` ikut dibuang (diganti catatan alasannya).
- `git grep`: tak ada rujukan di luar dokumen. **Bundel esbuild `agent-process` IDENTIK byte demi byte** sebelum &
  sesudah (543.175 bita) → isi paket tak berubah, **tak perlu deploy**.

## 2. Sampah uji di `api_usage` dihapus

- 12 baris milik ID uji palsu Juni (`99999999-…` 10 baris 18 Jun, `11111111-2222-3333-4444-555555555555` 2 baris
  20 Jun — ID fungsi `test-suite` di atas); pemiliknya tak ada di `auth.users`. Bukan data pribadi.
- Dihapus hanya baris dengan kedua ID itu DAN pemiliknya tak ada → **12 terhapus**. Sesudahnya pemeriksaan data tanpa
  pemilik di SEMUA tabel public ber-`user_id`: **NOL**; `api_usage` tetap 1.255 baris milik akun yang ada.

## 3. `.gitignore`: `.venv/`, `/data/`, `hasil/`

- CLAUDE.md melarang meng-commit `.env`, `.venv`, `data/`, `hasil/`, tetapi di akar hanya `.env` yang diabaikan git
  (ketahuan 31 Okt saat laporan model ancaman nyaris tersimpan di `hasil/`). Tak ada berkas terlacak di folder itu.
- `data/` dipatok ke akar (`/data/`) supaya folder kode bernama `data` di bawah `src` tetap terlacak.
- `uji-gerbang-uji` + 3 pemeriksaan (ikut berjalan di gerbang GitHub): folder terlarang diabaikan; `frontend/src/data`
  tetap terlacak; tak ada berkas terlacak di folder terlarang. **Mutasi 2/2 menggigit** (`hasil/` dibuang; `data/` tak
  dipatok akar).

## Bukti

Suite **140/140**.
