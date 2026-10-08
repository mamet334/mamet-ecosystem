# Mamet Lite

Aplikasi web untuk **pengguna di luar Owner** — chat + pencarian dokumen (RAG) + pencarian web,
tanpa Engineer dan tanpa memori pribadi. Di-deploy sendiri ke `mametlite.vercel.app`.

> Berkas ini sebelumnya template Vite bawaan (*"This template provides a minimal setup…"*) dan tidak
> memuat satu kata pun tentang Mamet Lite. Ditulis ulang 2026-10-08 (M8).

## Beda dengan Mamet Ecosystem

| | Mamet Lite (`mametlite/`) | Mamet Ecosystem (`frontend/`) |
|---|---|---|
| Penggunanya | pegawai ASN & orang awam, **dari HP** | Owner sendiri, di laptop |
| Bentuknya | web, di-deploy ke Vercel | aplikasi Electron (`.exe`) |
| Isinya | chat, RAG, unggah dokumen, OCR | + Engineer, memori, constitution, dasbor |
| Kuncinya | **kunci OpenRouter milik pengguna** (BYOK, di `localStorage`) | kunci milik Owner |

Keduanya proyek terpisah dengan `package.json` sendiri. **Jangan samakan versinya** — Lite masih
React 19 / Vite 8, Ecosystem React 18 / Vite 5.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run preview    # bundel produksi, lengkap dengan header keamanan
```

`npm run dev` dan `npm run preview` memakai **header keamanan yang sama dengan produksi** —
`vite.config.js` membacanya dari `vercel.json`. Jadi kalau CSP memblokir sesuatu, yang menemukannya
kita, bukan pengguna.

### Variabel lingkungan

Salin `.env.example` jadi `.env`, lalu isi:

| Nama | Isi |
|---|---|
| `VITE_SUPABASE_URL` | URL proyek Supabase |
| `VITE_SUPABASE_ANON_KEY` | kunci `anon` proyek itu |

Keduanya ber-awalan `VITE_`, jadi **disisipkan ke dalam bundel saat build** — itu benar untuk kunci
anon, tetapi berarti mengubahnya di Vercel menuntut build ulang.

Kunci OpenRouter **tidak** ada di sini: tiap pengguna memasangnya sendiri lewat ikon gerigi di
aplikasi, dan ia disimpan di `localStorage` perangkatnya.

## Uji

Uji Mamet Lite ada di `uji/` pada akar repo, bukan di folder ini:

```bash
node uji/uji-uraian-markdown.mjs     # penguraian Markdown tidak boleh menghasilkan HTML
node uji/uji-riwayat-lokal.mjs       # riwayat rusak tidak boleh jadi layar putih
node uji/uji-tata-letak-hp.mjs       # bisa dipakai dari HP
node uji/uji-pesan-galat.mjs         # galat memakai bahasa pengguna
node uji/uji-label-ramah.mjs         # label VERIFIED/PARTIAL dalam bahasa awam
node uji/uji-salinan-mametlite.mjs   # tiga berkas salinan tidak menyimpang
node uji/jalankan-semua.mjs          # semuanya
```

## Yang perlu diketahui sebelum menyunting

**Tiga berkas di `src/lib/` adalah salinan tangan** dari `frontend/src/core/runtime/services/`:
`documentTextExtractor.js`, `pdfOcrService.js`, `tabelCentang.js`. Headernya menyuruh *"Ubah keduanya
bersamaan"*, dan `uji/uji-salinan-mametlite.mjs` menjaganya: ekspor yang ada di **kedua** sisi wajib
sama isinya, sementara ekspor sepihak (fitur khusus Ecosystem) dicatat tetapi diizinkan.

Penyatuan ketiganya adalah perubahan arsitektur dan **menunggu keputusan Owner** — lihat M9 di
`docs/roadmap/ROADMAP-SIAP-PENGGUNA.md`.

**Teks dari model dirender sebagai elemen React, bukan string HTML.** `src/lib/markdown.js` mengurai
jadi data, `src/lib/TeksKaya.jsx` merender. Jangan kembalikan `dangerouslySetInnerHTML` — sampai
2026-10-07 berkas ini memakai daftar putih tag yang lubangnya meloloskan `<audio src=x onerror=…>`.

**Belum ada pendaftaran & reset kata sandi** dari UI. Akun dibuat di luar aplikasi. Ini keadaan yang
diketahui, menunggu keputusan Owner (M6).
