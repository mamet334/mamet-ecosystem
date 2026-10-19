# 19 Oktober 2026 — huruf & angka nyaman dibaca lama, kolom chat diperlebar (Item 127, K4)

Item 127 ([`ROADMAP-TAMPILAN-MENU-GAME.md`](../../roadmap/ROADMAP-TAMPILAN-MENU-GAME.md)), keputusan **K4**.
Permintaan Owner: *"sesuaikan huruf dan angkanya agar nyaman di baca secara lama"*.

## Hasil

| Bagian | Sebelum | Sesudah |
|---|---|---|
| Huruf terkecil di layar | 9–11px (273 tempat di 33 berkas) | **12px** — batas bawah; ikon `material-symbols` dan `LampLogin.jsx` tidak disentuh |
| Menu teks | 13px | **14px** |
| Angka | campuran `toFixed`, `toLocaleString()` tanpa lokal, satuan acak | satu pintu **`formatAngka.js`** — `angka()`, `ukuranMB()`, `waktuLokal()` berlokal **id-ID** (koma desimal, titik ribuan) |
| Lebar digit | proporsional — angka yang berubah "menari" | **tabular** di seluruh aplikasi (`font-variant-numeric: tabular-nums` di `body`) |
| Kolom baca chat | `max-w-3xl` (768px) | **`max-w-[68rem]` (1088px)** — kolom pesan, kotak ketik, dan dua kartu sama lebar |
| Gelembung pesan | rapat | `rounded-2xl px-4 py-3` — isi dipadatkan, bukan panelnya |

Pemakai `formatAngka`: `BillingDashboard`, `FileExplorer`, `ResearchApp`, `RiwayatKonversi`, `Settings`.
Placeholder isian di Settings sengaja tetap `toFixed` (isian menerima titik desimal).

## Keputusan Owner yang membalik pedoman

Pedoman tipografi (45–75 karakter per baris) diukur: Inter 16px ≈ 7,85 px/karakter, jadi 768px = 93 karakter
dan 608px = 72 karakter. Percobaan pertama **menyempitkan** kolom ke 608px. Owner menolaknya:
*"justru harus di perlebar… panel jangan di lebarkan, tetapi isinya yang di padatkan. tujuannya saya mendapatkan
layar interaksi yang luas pada chat."* Kolom jadi 1088px (≈134 karakter). Alasan Owner dicatat di komentar
`ConversationEngine.jsx` dan dijaga uji — bukan pedoman yang dilupakan, melainkan pedoman yang **tidak cocok**
dengan cara Owner bekerja.

Satuan ringkas meteran konteks tetap **`k`/`jt`** (`723,8k / 1,0jt (72%)`) — contoh Owner sendiri; percobaan
"rb" dibatalkan karena dua uji yang menyandikan contoh itu merah.

## Uji

| Uji | Yang dijaga |
|---|---|
| `uji-ukuran-huruf.mjs` v1 (baru) | tak ada teks < 12px di komponen (ikon & LampLogin dikecualikan) |
| `uji-format-angka.mjs` v2 (baru) | angka tampil lewat `formatAngka`; `$${…}` mentah juga tertangkap |
| `uji-kerangka-chat.mjs` v4 | kolom ≥ 1024px (keputusan Owner), empat tempat sama lebar, padding gelembung |
| `uji-menu-teks.mjs` v2 | menu ≥ 14px, minimum 12px, pola opasitas tak bergantung ukuran |

Tiap asersi baru dibuktikan menggigit dengan mutasi. Suite 106/106 lulus pada commit ini.
