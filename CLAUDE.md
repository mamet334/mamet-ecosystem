# CLAUDE.md — Aturan Kerja Praktis AI Coding

**Untuk siapa:** AI coding dari luar (Claude Code, Codex, dan sejenisnya). **Bukan untuk Engineer internal Mamet** —
Engineer memakai `INIT.md` dan prosedurnya sendiri (`constitution/28`); ia tidak commit, push, atau meminta deploy.
Jangan masukkan berkas ini ke indeks konstitusi Engineer (`frontend/electron/indeksKonstitusi.cjs`, `BERKAS_AKAR`).

Berkas ini **pelengkap**, bukan pengganti: `AGENTS.md` dan urutan baca Konstitusi tetap berlaku lebih dulu.
Titik masuk status pekerjaan: `docs/roadmap/INDEX-ROADMAP.md`.

## Komunikasi & Git

- Berkomunikasi dengan Owner dalam **bahasa Indonesia**.
- **Jangan menambahkan trailer `Co-Authored-By` atau atribusi AI apa pun** di pesan commit maupun deskripsi PR.
- Commit & push hanya atas izin Owner. Repo ini **publik**: jangan pernah meng-commit `.env`, `.venv`, folder `data/`
  atau `hasil/`.

## Urutan selesai kerja

1. Verifikasi dengan bukti nyata (uji, log, keluaran platform) → lapor ke Owner → minta izin.
2. Changelog di `docs/project-memory/changelog/` (hasil) → dokumen roadmap (status & sisa) → **satu baris** di
   `docs/roadmap/INDEX-ROADMAP.md` → commit & push.
3. **Perubahan server** (`supabase/functions/agent-process`, `shared/`): Owner men-deploy **dulu** dari working tree;
   isi paket diperiksa di platform dan dibandingkan dengan berkas repo; **baru** changelog ditulis sekali (berisi bukti
   deploy) lalu satu commit & push. Jangan ubah berkas server di antara deploy dan commit. Sebelum meminta deploy,
   bundel `supabase/functions/agent-process/index.ts` dengan esbuild untuk memastikan tidak ada galat sintaks.
4. Klaim tentang platform (fungsi ter-deploy, rilis terbit, fungsi terhapus) dibuktikan **di platformnya**, bukan dari
   repo.
5. **Fase hardening (ADR-0022):** temuan baru yang tidak menyentuh K1–K7, keamanan, atau kehilangan data masuk
   **Parkir** di `docs/roadmap/ROADMAP-HARDENING.md` — bukan utang, jangan ditawarkan sebagai "sisa". Laporan ditutup
   dengan **status K1–K7**, bukan "sisa roadmap".

## Struktur kode

- Aturan yang dipakai **klien** (`frontend/`, Vite) dan **server** (`agent-process`, Deno) tinggal di `shared/`: murni,
  hanya boleh mengimpor sesama `shared/`. Server **tidak boleh** mengimpor `frontend/src` (dijaga
  `uji/uji-shared-t15.mjs`).
- `mametlite/` adalah aplikasi **live** untuk pengguna eksternal — jangan disentuh kecuali diminta.
- Mengubah `frontend/electron/main.cjs` → `npm run desktop` wajib dijalankan ulang; muat ulang halaman hanya memuat
  ulang renderer.

## Uji

- Seluruh uji: `node uji/jalankan-semua.mjs`.
- Setiap uji baru dibuktikan dengan **mutasi**: rusak kodenya dengan sengaja, uji harus gagal. Uji yang tetap lulus saat
  kode dirusak bukan uji.
- Ukur kebenaran isi, bukan hanya angka yang mudah dihitung (jumlah hasil, umur, lolos satu halaman). Aturan tata letak
  & heuristik diuji pada dokumen/korpus penuh dengan pembanding independen.
- Uji tampilan wajib mengompilasi Tailwind sungguhan; kelas di luar skala dibuang diam-diam.
- Kode ber-regex ditulis dengan alat tulis berkas, **bukan heredoc shell** — backslash bisa rusak tanpa suara.
- Jangan menjalankan `npx` untuk paket yang belum terpasang (itu unduhan diam-diam); periksa `node_modules/.bin` dulu.

## Privasi

- Data pribadi pengguna hanya dibaca sebagai **hitungan/agregat**; isi pesan tidak dikeluarkan dari basis data.
- Jangan mencatat objek runtime/payload ke log — kunci API pernah bocor ke `agent_logs` lewat cara itu.
