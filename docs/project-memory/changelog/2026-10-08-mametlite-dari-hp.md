# 8 Oktober 2026 — Mametlite akhirnya bisa dipakai dari HP

Item 72, dikerjakan sebagai M3 blok M item 125
([`ROADMAP-SIAP-PENGGUNA.md`](../../roadmap/ROADMAP-SIAP-PENGGUNA.md)).

## Kenapa ini dikerjakan, dan siapa yang jadi ukurannya

Keputusan Owner **28 September**, saat mengoreksi usul asisten untuk menutup Item 72 dengan alasan
*"Owner memakai Mamet di laptop"*:

> *"itu tentang kerapian suatu aplikasi di berbagai perangkat agar tidak membingungkan pengguna."*

Usul itu salah menimbang **siapa yang diukur**. `mametlite.vercel.app` punya pengguna di luar Owner,
dan merekalah yang membukanya dari HP.

Lalu keputusan Owner **2 Oktober**: ditunda, **dan sasaran rencananya salah** — FASE 1–4 di
`roadmap-adaptive-shell.md` semuanya menunjuk `frontend/src` (Electron, hanya Owner), padahal yang
berantakan di HP adalah `mametlite/src`. *"Akarnya satu baris, bukan empat fase."*

**Catatan itu diikuti apa adanya.** Satu berkas, tanpa dependency baru, tanpa `DiscoveryManager`,
tanpa empat shell.

## Keadaan sebelum

| | Angka |
|---|---|
| `className` di `mametlite/src` | 102 |
| yang punya prefiks responsif | **0** |
| drawer / hamburger / `sidebarOpen` | **0** |

`App.jsx:525` baris flex dua kolom; `:528` bilah sisi `w-80` = **320px tanpa syarat**; `:654` kolom
chat `flex-1 … min-w-0`. Di layar 375px: bilah sisi memakan 320px, chat sisa **±55px** — dan
`min-w-0` membuatnya **menciut** alih-alih menggulir, jadi chatnya benar-benar jadi sliver.

Yang ikut berdesakan di ±55px itu: header `px-6` (48px padding), penukar tiga mode dengan label
penuh ≈**380px** tanpa `flex-wrap` maupun `overflow-x-auto`, daftar pesan `p-6`.

Dan **kodenya sudah tahu penggunanya di HP**. `labelRamah.js:17-18`: *"Pengguna Mametlite membuka
dari HP. Tidak ada kursor, jadi tidak ada tooltip."* Tetapi tiga kendali — hapus dokumen (`:609`),
hapus chat (`:631`), salin jawaban (`:686`) — memakai `opacity-0 group-hover:opacity-100`, yaitu
**tidak terjangkau tanpa penunjuk ber-hover**.

## Yang dikerjakan

| | |
|---|---|
| Bilah sisi | laci di bawah `md` (`-translate-x-full` → `translate-x-0`), **menetap** di `md` ke atas (`md:static md:translate-x-0`) |
| Jalan masuk | tombol hamburger `md:hidden` di header — tanpa ini lacinya tertutup selamanya di HP |
| Jalan keluar | tombol ✕ di laci, lapisan gelap yang bisa ditekan, **dan** menutup sendiri saat percakapan dipilih/dibuat |
| Tinggi | `h-screen` → `h-dvh` (3 tempat) — di iOS Safari `h-screen` tidak memotong chrome peramban, jadi bilah masukan duduk di bawahnya |
| Tiga mode | label hanya muncul di `lg`; di bawah itu ikon saja, dengan `aria-label` + `title` supaya fungsinya tetap bernama |
| Padding | `px-3 md:px-6` (header), `p-4 md:p-6` (daftar pesan) |
| Tiga kendali hover | `opacity-100 md:opacity-0 md:group-hover:opacity-100` — terlihat di layar sentuh, tetap rapi-saat-hover di desktop |

Lebar laci `w-80 max-w-[85vw]`: di 375px ia jadi 318,75px dan menyisakan tepi yang bisa ditekan
untuk menutup.

## Bukti

`uji/uji-tata-letak-hp.mjs` (baru) — **SEMUA LULUS**. Ia menjaga **sifat**, bukan ejaan kelasnya
(pelajaran `44d4f9d`): bukan "apakah ada `md:w-80`", melainkan apakah bilah sisinya bisa
disembunyikan, apakah ada jalan membukanya di layar kecil, dan apakah kendalinya terjangkau tanpa
hover.

**Dibuktikan menggigit** lewat dua mutasi yang lalu dipulihkan:

| Mutasi | Hasil |
|---|---|
| kendali dikembalikan ke `opacity-0 group-hover:` | **2 GAGAL** |
| `md:static md:translate-x-0` dicabut (laci ikut hilang di layar lebar) | **2 GAGAL** |

**Di peramban**, bundel produksi (`vite preview`). Layar chat ada di belakang login Supabase
produksi, jadi sesi disumbat **sementara** di build lokal — tanpa menyentuh akun mana pun — lalu
sumbatnya dicabut dan dibuktikan bersih (`grep __uji_tata_letak` → 0, `session.user.email` utuh).

| Lebar | Hasil |
|---|---|
| **375 × 812** | chat dapat **lebar penuh** (dulu ±55px); hamburger terlihat; tiga mode jadi ikon dan muat; tombol salin terlihat tanpa hover |
| 375, laci dibuka | laci `left: 0`, lebar **318,75px**, tombol ✕ ada, chat di belakangnya meredup |
| 375, percakapan dipilih | laci `left: −318,75` (keluar layar), lapisan gelap **hilang** |
| **1280 × 720** | bilah sisi `position: static`, 320px, `left: 0`; hamburger **tersembunyi**; label mode kembali muncul — **tidak ada yang berubah untuk Owner** |

Suite penuh: **90/90**.

## Berkas

| Berkas | |
|---|---|
| `uji/uji-tata-letak-hp.mjs` | **baru** — 4 bagian |
| `mametlite/src/App.jsx` | laci + hamburger + `h-dvh` + padding responsif + label mode + 3 kendali sentuh |

## Sisa blok M

**M4** pesan galat bahasa Indonesia (`:490` masih memulangkan teks server mentah ke gelembung chat),
**M8** kode mati (`App.css` 184 baris nol pengimpor, README template Vite, 4 dependency & 4 aset tak
terpakai), **M9** uji penjaga untuk tiga berkas salinan tangan di `mametlite/src/lib/`.
