# 20 Oktober 2026 — kartu jawaban chat = kartu Settings (Item 127, Tahap 3)

Item 127 ([`ROADMAP-TAMPILAN-MENU-GAME.md`](../../roadmap/ROADMAP-TAMPILAN-MENU-GAME.md)). Owner menilai jawaban model tanpa
kotak *"warna terlalu hangat"* dan meminta jawaban diberi bingkai.

## Jalan menuju keputusan

Owner meminta: *"coba jangan ubah kode sebelum anda tanyakan yang bagian mana… kalau bisa berikan layer-layernya agar
tepat perubahannya"*. Karena itu tiap langkah diajukan sebagai **pratinjau** dulu, bukan kode.

| Putaran | Yang diajukan | Penilaian Owner |
|---|---|---|
| 1 | peta lapisan layar chat (0 dinding … 6 tombol MENU) dengan warnanya | — |
| 2 | bingkai hampir hitam, tiga varian garis (A kayu gelap · B kayu terang · C emas tipis) | *"c dulu visualkan"* |
| 3 | varian C di layar utuh, lalu dibuat 80% pekat agar siluet dinding terlihat | *"terapkan"* — dipasang, belum di-commit |
| 4 | Owner menunjuk halaman Settings: *"kolom jawaban sama seperti kolom untuk tulisan AI Model Management. kolom code sama dengan kolom bertulisan gemini"* | bingkai 80% ternyata salah tangkap |
| 5 | pratinjau dengan nilai yang **diukur** dari halaman Settings di aplikasi | *"terapkan"* |

Pelajaran: Owner tidak meminta warna baru, melainkan **memakai ulang komponen yang sudah ada**. Menunjuk komponen yang
ada lebih tepat daripada menerjemahkan kata "bingkai hitam transparan".

## Hasil

| Di chat | Sama dengan | Nilai terukur |
|---|---|---|
| Kartu jawaban model | kartu "AI Model Management" | `glass-panel rim-light p-4 md:p-gutter rounded-xl border border-outline-variant` — latar `rgba(26,18,12,0.72)`, kaca buram 20px, sudut 48px |
| Kolom kode (`KotakKode`) | isian Provider/Model ID ("gemini") | `bg-surface-container-lowest border border-outline-variant px-5 py-4 rounded-lg` — `#080605`, sudut 32px |
| Label kode | label "MODEL ID" | **KODE · SALIN** di atas kolom, `text-label-mono` kapital |

- Teks tebal & judul jawaban memakai token baru **`on-surface-strong`** `#e8dcc8` (satu langkah lebih terang dari teks
  biasa, tak setajam krem lama).
- Keluaran terminal Engineer memakai kolom yang sama; label jenis kapital, tetapi **perintahnya tetap huruf aslinya**.
- Gelembung pesan Owner, dinding, tombol atas, kotak ketik, dan tombol MENU tidak berubah.
- Diperiksa di peramban dengan komponen sungguhan: gaya terhitung sama dengan kartu & isian Settings.

## Uji

| Uji | Yang dijaga |
|---|---|
| `uji-kerangka-chat.mjs` v7 | kelas tampilan kartu jawaban = kelas kartu "AI Model Management" **dibaca dari Settings.jsx**; tak ada latar/garis tambahan; semua kelas benar-benar ada (Tailwind dikompilasi atau `index.css`) |
| `uji-markdown-chat.mjs` v4 | kelas kolom kode = kelas isian Provider **dibaca dari Settings.jsx**; label di atas kolom; perintah terminal tidak dikapitalkan |
| `uji-latar-ruangan.mjs` v4 | kontras di dalam kartu (latar `.glass-panel` dari `index.css` + dinding) di titik dinding paling terang: teks 11,07:1, tebal 12,45:1, label "TOOLS:" 6,23:1 |
| `uji-palet-lamplogin.mjs` v3 | `on-surface-strong` lebih terang dari teks biasa, ≤ 15:1 |
| `uji-ciri-tampilan.mjs` v4 | `tokenMaterial` 576 → 581 (garis kartu +1, token teks tebal +4) |

Mutasi bingkai 80% (putaran 3) dibuktikan menggigit sebelum diganti; penjaga v7/v4 menggantikannya. Suite 110/110.
