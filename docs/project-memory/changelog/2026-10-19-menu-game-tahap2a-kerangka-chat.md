# 19 Oktober 2026 — kolom baca chat tidak lagi dijepit (Item 127 Tahap 2, langkah 2a)

Item 127 ([`ROADMAP-TAMPILAN-MENU-GAME.md`](../../roadmap/ROADMAP-TAMPILAN-MENU-GAME.md)), Tahap 2 "kerangka
standar". Langkah pertama yang **terasa** di layar Owner — kulit (warna, huruf, ruangan) belum disentuh; itu
Tahap 3.

## Yang berubah — diukur di 1366×720, layar Owner

| | Sebelum | Sesudah |
|---|---|---|
| Lebar jawaban model | 524px | **768px (+47%)** |
| Memory Context | kolom 320px, terbuka bawaan | laci kanan, **tertutup bawaan** |
| Monitor MAEF | kolom grid 350px di `AppShell` | laci kanan yang menutupi |
| Riwayat chat | `md:relative` — mendorong kolom pesan di desktop | laci di semua lebar; klik di luar = tutup |
| Bilah tombol atas | `absolute` — melayang dan **menutupi awal pesan pertama** | baris sendiri; pesan mulai di bawahnya |
| Pil Memory / Monitor | melayang di baris KEDUA, terpisah | ujung kanan bilah yang sama — satu baris |
| Ikon bilah samping | tiga aplikasi **kembar** kotak-titik | 11 aplikasi, 11 ikon berbeda |
| Kolom baca saat laci dibuka | menyempit | **tidak bergeser satu piksel pun** |

Pesan kini dikolomkan `max-w-3xl` dan ditengahkan — sejajar dengan kotak ketik yang memang sudah selebar
itu. Pesan pengguna tetap gelembung ≤75%; jawaban model selebar kolom baca (pola standar aplikasi asisten).

## Berkas

| Berkas | Perubahan |
|---|---|
| `ConversationEngine.jsx` | Memory Context jadi laci + tertutup bawaan · riwayat tanpa `md:relative` · latar penutup di semua lebar · bilah sesi jadi baris · pil kanan pindah ke bilah · kolom baca · jawaban model `w-full` · lapisan bilah z-50 < latar z-[55] < laci z-[60] |
| `AppShell.jsx` | zona kanan keluar dari grid; di desktop dibungkus laci (`right_size`, bawaan 350px); seluler tetap bertumpuk |
| `Sidebar.jsx` | `getIcon`: File Explorer → `folder_open`, System Logs → `description`, Billing → `savings` — semuanya sudah ada di subset font, tanpa `npm run ikon` |
| `uji/uji-kerangka-chat.mjs` (baru, v2) | menjaga semua keputusan di atas |

## Bukti

- **Browser, 1366×720:** tangkapan layar sebelum/sesudah; ketiga laci dibuka-tutup lewat tombol aslinya, dan
  kolom baca diukur tetap 768px di x=329 untuk ketiganya; laci riwayat ditutup lewat klik di latar.
- **Seluler 375px:** bilah melipat rapi jadi dua baris; pesan selebar layar.
- **Ikon:** fungsi `getIcon` yang ASLI dijalankan pada 11 nama di metadata — tak kembar, tak jatuh ke ikon
  cadangan, semuanya ada di subset.
- **Mutasi — 12, semuanya menggigit:** Memory terbuka bawaan lagi · riwayat `md:relative` lagi · latar hanya
  seluler · laci sama lapis dengan bilah · bilah melayang lagi · kolom baca dibuang · jawaban model 75% lagi ·
  zona kanan jadi kolom grid lagi · pil melayang lagi · celah 56px di banner kembali · Billing jatuh ke ikon
  cadangan · ikon di luar subset.
- Suite **101/101**; angka ciri tampilan generik tidak naik.

## Dua cacat buatan sendiri, ketahuan sebelum commit

1. **Tombol bilah menembus kepala laci riwayat** — laci dan bilah sama-sama `z-50`. Terlihat di tangkapan
   layar; lapisannya kini diuji.
2. **Banner Undo Engineer menyisakan celah 56px** (`mt-14`) yang dulu dibuat untuk bilah yang melayang —
   efek samping langsung dari mengubah bilah jadi baris. Ketahuan saat memeriksa sambungan pemindahan pil.

Dan satu asersi saya **hijau palsu**: "ikon tidak kembar" tidak menangkap SATU aplikasi yang jatuh ke ikon
cadangan (ia tidak kembar dengan siapa pun). Ketahuan karena mutasinya lolos; kini dijaga asersi "tak ada yang
jatuh ke ikon cadangan".

## Untuk Owner

Monitor MAEF tersimpan **terbuka** di tata letak Assistant & Engineer (diukur Tahap 0). Sesudah pembaruan ia
muncul sebagai laci terbuka di kanan pada pembukaan pertama; ditutup sekali, keadaan tertutup ikut tersimpan.

## Sisa, untuk Tahap 3

- Jawaban model masih dibungkus kotak bertepi — setengah kerangka, setengah kulit; dikerjakan bersama warnanya.
- Ikon Agent Forge sama dengan logo pojok kiri atas (`architecture`).
- Di seluler, pil kanan berdekatan dengan sudut pesan pertama.
- Akar masalah ikon: bilah samping menebak dari NAMA padahal metadata menyimpan ikonnya — dituntaskan saat ikon
  disatukan menjadi satu set.
