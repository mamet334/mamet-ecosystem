# 19 Oktober 2026 — pemeriksaan "error tersembunyi": empat temuan diperbaiki (Item 127, Tahap 3)

Item 127 ([`ROADMAP-TAMPILAN-MENU-GAME.md`](../../roadmap/ROADMAP-TAMPILAN-MENU-GAME.md)). Owner, sesudah menilai
tampilan sesuai: *"saya rasa tahap ini sudah sesuai, tapi saya tidak tahu kalau ada error tersembunyi"*.

Pemeriksaan sengaja memakai cara yang **berbeda dari uji**: build produksi, log server dev, pemindaian kelas
komponen terhadap CSS produksi, pengukuran kecepatan, dan impor server dari kode klien (T15).

## Yang bersih

- Build produksi berhasil.
- Server `agent-process` tidak terdampak: empat berkas `frontend/src` yang diimpornya tak berubah hari ini dan tak
  mengimpor apa pun.
- Galat `MenuTeks.jsx` 13.31 di log Vite berasal dari keadaan setengah-sunting siang tadi, bukan berkas sekarang.

## Empat temuan — diperbaiki (Owner: "ya setuju, 1 A")

| # | Temuan | Asal | Perbaikan | Bukti |
|---|---|---|---|---|
| 1 | Label redup `slate-500` **3,62:1** di titik dinding paling terang (uji v1 bilang 4,55 — **salah**) | hari ini | bayangan samping ditulis nilai bebas `from-black/[.43] via-[78%] to-black/[.52]` sehingga benar-benar tergambar | gaya terhitung di peramban: lapisan aplikasi `linear-gradient(… 0.43, 0 78%, 0.52)`; lapisan LampLogin `none`; label kembali 4,55:1 |
| 2 | Chat panjang tersendat saat jawaban mengalir — Markdown semua jawaban lama diurai ulang tiap token | hari ini | `React.memo(TeksMarkdown)` + daftar plugin konstan | diukur di peramban, 30 jawaban lama: **225 ms → 0,4 ms** per token |
| 3 | Kalimat `` ` di posisi ekspresi dibaca sebagai literal objek — build gagal. */} `` tampil di panel Riwayat Konversi | 8 Okt (`7c71e3c`) | komentar ditulis ulang tanpa contoh pembuka-penutup komentar | keluaran kompilasi bersih; build tanpa peringatan |
| 4 | Pita gelap di atas kotak ketik — gradien `from-background` (warna latar lama) di atas dinding | hari ini | gradien dibuang; area kotak ketik ada di alur, tak perlu peredam | — |

**Temuan 1, akar masalahnya.** LampLogin menulis bayangan sampingnya `from-black/43 via-78% to-black/52`; 43, 52, dan
78% di luar skala Tailwind 3.4, jadi **ketiga kelas itu tak pernah dibuat** — di layar masuk bayangannya tidak pernah
tampil. Salinan di `LatarRuangan.jsx` mewarisinya, dan `uji-latar-ruangan` v1 menghitung kontras dengan bayangan yang
**ditulis**, bukan yang **dibuat**. Pilihan Owner A: bayangan dibuat tergambar di aplikasi (sesuai maksud desain
LampLogin); akibatnya sisi kiri-kanan dinding aplikasi sedikit lebih gelap dari layar masuk. `LampLogin.jsx` tidak
disentuh — bug bayangannya menunggu K5.

## Penjaga baru

| Uji | Yang dijaga |
|---|---|
| `uji-latar-ruangan.mjs` v2 | setiap kelas latar **dikompilasi Tailwind sungguhan** (konfigurasi proyek, fungsi pelolos Tailwind sendiri); lapisan hanya dihitung bila kelasnya dibuat; nilai bayangan = maksud LampLogin; tak ada gradien ke warna latar lama |
| `uji-komentar-jsx.mjs` v1 (baru) | **53 berkas .jsx** dikompilasi esbuild tanpa satu peringatan; tak ada komentar JSX yang memuat pembuka komentar lain — menangkap juga kebocoran **tanpa** peringatan (dibuktikan fixture) |
| `uji-markdown-chat.mjs` v3 | komponen yang diekspor adalah `React.memo`; plugin konstan; ConversationEngine hanya mengoper `teks` |
| `uji-ciri-tampilan.mjs` | `gradien` 6 → 5 |

Sembilan mutasi dibuktikan menggigit. Suite 110/110. Build produksi tanpa peringatan.

## Dicatat, tidak diperbaiki

**T18** di [`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md): 19 kelas Tailwind di komponen tak
pernah dibuat (animasi masuk tanpa plugin, `text-headline-sm`, `py-0.2`, dll.) — dampak kecil, tiap kelas butuh
keputusan sendiri.
