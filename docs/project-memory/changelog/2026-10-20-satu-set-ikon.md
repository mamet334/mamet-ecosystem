# 20 Oktober 2026 — satu set ikon; cabang desktop Sidebar dihapus (sisa Item 127, di Item 128)

Sisa Item 127 yang dibawa ke [`ROADMAP-TEMA-APLIKASI.md`](../../roadmap/ROADMAP-TEMA-APLIKASI.md) §7. Keputusan Owner:

> *"satu set ikon pakai yang terbaru / nama menu biarkan bahasa inggris / cabang hapus / login jangan di gabungkan"*

## Satu set ikon — Material Symbols

- **`components/Ikon.jsx`** (baru): `<Ikon nama="close" ukuran={16} />` — satu komponen untuk semua ikon. Kotaknya
  meniru ikon lucide yang digantikan (`block`, `ukuran × ukuran`, warna dari `text-*`), jadi tata letak tidak bergeser.
- **162 tag lucide di 24 berkas** → `<Ikon>`; pemetaan diperiksa Owner lewat pratinjau berdampingan sebelum kode diubah.
  Ikon yang dipilih lewat variabel/prop (jenis berkas di File Explorer, kartu System Logs, Workspace Nav, kartu sheet)
  kini membawa **nama** ikon, bukan komponen.
- **Akar dua set ikon:** metadata `system.json` menyimpan nama gaya lucide ("Home", "Zap") dan Kernel memuat **seluruh**
  paket lucide (`import('lucide-react')`) untuk mencocokkannya — sementara laci & bilah bawah seluler **menebak** ikon
  dari nama aplikasi di dua tempat. Kini metadata berisi nama Material, Kernel meneruskan `icon`, dan keduanya membaca
  `app.icon`. Ikon aplikasi baru = satu kata di metadata.
- **Agent Forge** = `smart_toy` — tak lagi sama dengan logo Mamet (`architecture`).
- **LampLogin: 4 ikon** (galat, memproses, mata, mata tercoret) — diizinkan Owner sesudah analisis keamanan (roadmap §9);
  tak ada baris lain yang berubah.
- **Subset font** diunduh ulang (`npm run ikon`, izin Owner): **102 ikon, 28,5 KB**. Pemindai `perbarui-ikon.mjs`
  belajar membaca `<Ikon nama=…>`, `ikon = '…'`, dan metadata; kata yang dulu ikut tertangkap padahal bukan ikon
  (`blocked`, `nama`, `ganti`, …) dibuang.
- Hasil build produksi: **tak ada kode lucide**. `lucide-react` masih di `package.json` hanya karena kode mati K6.

## Lain-lain

- **Cabang desktop `Sidebar.jsx` dihapus** — tak terpakai sejak menu teks (K2); berkas itu kini laci seluler saja.
- **Nama menu** tetap berbahasa Inggris; **K5 ditolak** — LampLogin dan LatarRuangan tetap terpisah.

## Bukti

- Peramban: Home, laci menu, Agent Forge, File Explorer, Memory, System Logs, Billing — setiap ikon tampil sebagai
  gambar (lebar = ukurannya), 0 ikon lucide, 0 galat konsol.
- Setiap nama di subset diuji membentuk gambar di font yang diunduh (102/102) — Google diam saja bila nama salah.
- Build produksi tanpa peringatan.

## Uji

| Uji | Yang dijaga |
|---|---|
| `uji-ikon-subset.mjs` v2 | nama lewat `<Ikon>`, cabang `nama={a ? … : …}`, `ikon = '…'`, `icon="…"` & metadata ada di subset; ikon aplikasi bernama Material, tak kembar, Agent Forge ≠ logo; tak ada berkas hidup memakai lucide (termasuk `import()` Kernel); menu tak menebak ikon |
| `uji-penjaga-lamplogin.mjs` v2 | sidik jari 19 Okt **tidak diganti**: 4 ikon yang diizinkan dibalik, sisanya wajib sama persis |
| `uji-kerangka-chat.mjs` v8 | ikon laci dibaca dari metadata, tak kembar, tak jatuh ke cadangan |
| `uji-ciri-tampilan.mjs` | lucide **26 → 3** (kode mati K6); berkas ligatur langsung 9 → 10 (`Ikon.jsx`); gerak 51 → 50; glow 26 → 18 |

Sembilan mutasi dibuktikan menggigit. Suite 114/114.
