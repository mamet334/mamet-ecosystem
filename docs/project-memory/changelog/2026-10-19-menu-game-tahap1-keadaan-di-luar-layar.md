# 19 Oktober 2026 — keadaan chat hidup di luar layarnya (Item 127 Tahap 1, langkah 1–4)

Item 127 ([`ROADMAP-TAMPILAN-MENU-GAME.md`](../../roadmap/ROADMAP-TAMPILAN-MENU-GAME.md)), Tahap 1 "fondasi".
Langkah 1–4 selesai; **langkah 5 diparkir atas keputusan Owner** (lihat di bawah). **Perilaku aplikasi tidak
berubah** — semua layar masih terpasang; yang berubah adalah TEMPAT keadaan chat disimpan.

## Kenapa

Tahap 0 mengukur bahwa 11 aplikasi dirender sekaligus dan disembunyikan, termasuk tiga mesin chat. Itu
tambalan: keadaan chat tinggal di `useState` layarnya, jadi layar tidak boleh dilepas tanpa kehilangan jawaban
yang sedang mengalir, ketikan yang belum terkirim, dan chat aktif. Akar masalahnya "keadaan tinggal di
layar" — langkah 1–4 memindahkannya keluar.

## Yang dibuat

| Berkas | Isi |
|---|---|
| `frontend/src/core/runtime/PenyimpanKeadaan.js` (baru) | keadaan per aplikasi (`app:assistant` · `app:mametlite` · `app:engineer`): nilai (pengganti `useState`), ref (pengganti `useRef`), **pengamat** (pengganti `useEffect` yang harus jalan walau layarnya dilepas). Tanpa React — diuji dengan node |
| `frontend/src/core/runtime/hooks/useKeadaanTersimpan.js` (baru) | `useKeadaanTersimpan` / `useRefTersimpan` — bentuk kembaliannya sama persis dengan `useState`/`useRef`, jadi tak satu baris pemakai berubah |
| `uji/uji-penyimpan-keadaan.mjs` (baru) | 25 asersi |
| `uji/uji-keadaan-chat-di-luar-layar.mjs` (baru) | mana yang wajib di luar layar, mana yang sengaja lokal |

## Yang berubah

| Langkah | Perubahan |
|---|---|
| 1 | Kernel mendaftarkan `PenyimpanKeadaan`. **`App.jsx` mengosongkannya saat pengguna berganti** — keadaan di luar layar tidak hilang sendiri saat logout; tanpa ini orang berikutnya di aplikasi yang sama melihat percakapan orang sebelumnya. Menunggu pemeriksaan sesi selesai (`session` null saat memuat ≠ keluar) |
| 2 | `ConversationEngine.jsx`: `messages`, `input`, `isLoading`, `currentChatId`, `initialRestoreDone` + ref kendali kiriman, nomor urut percakapan, kunci simpan terakhir, sedang-menyimpan, pemulihan-gagal |
| 3 | **Penyimpanan otomatis menjadi pengamat** — dulu `useEffect` layar yang hanya jalan selama layarnya terpasang. Badan logikanya tidak diubah satu penjaga pun |
| 4 | 11 keadaan lagi (pil tier, lampiran, Memory Context, perintah Engineer, checkpoint & rollback, konfirmasi web, pemadatan) + 3 penjaga duplikat (perintah otomatis, uji klaim, temuan). Reset pil tier kini hanya saat chat **benar-benar** berganti — efek lama mereset setiap layar dipasang |

**11 `useState` sengaja tetap lokal**, tiap satunya beralasan dan dicatat di uji: popover, tanda "tersalin",
laci riwayat, pemicu render, meteran yang dihitung ulang dari `messages`, catatan temuan yang **sengaja**
dibaca ulang dari disk, laporan patch yang duplikatnya dicegah `patchId`.

## Bukti

**Uji live** — Owner mengirim "tes" dari `npm run desktop`. Jendela itu dibuka **09:21:51 WIB, sesudah**
perubahan kode terakhir (09:06:19), dan memuat kode dari server dev yang menyajikan pohon kerja ini:

| | |
|---|---|
| dikirim | 09:32:57 WIB (`cost_ledger`) |
| tersimpan ke `chats` oleh pengamat di luar layar | 09:33:20 — **4 pesan** ("tes" + jawaban), `ws-assistant` |

**Pemulihan riwayat** diuji di browser tanpa mengirim apa pun: penunjuk chat dipasang, aplikasi dimuat ulang —
2 pesan terpulihkan ke penyimpan dan tampil di layar, **`updated_at` tidak berubah** (tidak ada penulisan
ulang). Penunjuk ujinya dibersihkan sesudahnya.

**Mutasi** — setiap uji baru dibuktikan menggigit:

| Uji | Mutasi yang memerahkannya |
|---|---|
| `uji-penyimpan-keadaan` | nilai identik tetap memberi tahu · pengamat jalan sesudah logout · daftar ulang menambah bukan mengganti · logout tidak mengosongkan |
| `uji-keadaan-chat-di-luar-layar` | keadaan baru sebagai `useState` biasa · `attachedFile` kembali lokal · dua keadaan berbagi nama penyimpan · penjaga temuan kembali ke ref lokal · reset tier tanpa penjaga |
| `uji-pemulihan-chat-v6` | `initialRestoreDone` dibuang dari daftar amati · pengamat dilepas bersama layar (`return p.amati` / `const lepas = p.amati`) |

Tiga uji lama mencocokkan teks harfiah `useRef(…)` dan memerah; masing-masing diubah agar menjaga **niatnya**,
lalu dibuktikan dengan mutasi: `uji-hentikan-kiriman` v2, `uji-pemulihan-chat-v5` → **`-v6`** (nama berkas
membawa versi, jadi diganti), `uji-perintah-tanpa-persetujuan` v2.

**Satu asersi saya sendiri sempat hijau palsu** — dua syarat digabung "atau", salah satunya selalu benar.
Ketahuan karena mutasinya lolos; ditulis ulang sebelum dipakai.

Suite **100/100**.

## Langkah 5 diparkir — dan kenapa

Melepas layar yang tidak aktif ternyata lebih besar dari "memindahkan keadaan": layar chat Engineer juga
**pengendali** yang bekerja walau tersembunyi — mendengarkan `Engineer:PatchApplied` (checkpoint = **tombol
Undo**), `PatchPersisted`, `ReasoningReport`, `RequestConfirmation`, `Recommendation`, `Memory:Retrieved`, dan
menjalankan perintah aman secara otomatis. Sementara itu manfaatnya bagi Owner kecil: Tahap 0 mengukur kerja
latar saat diam ≈ 0, dan menu & ruangan tidak membutuhkannya. Owner memutuskan: parkir, lanjut ke Tahap 2.
Syarat bila kelak dilanjutkan tercatat di roadmap.

## Ikut ketahuan

- **T17** — penyimpanan otomatis melewatkan perubahan yang datang saat penyimpanan sebelumnya masih berjalan
  (tak dijadwal ulang). Perilaku lama, sengaja dipertahankan saat dipindah; didaftarkan di
  `ROADMAP-TEMUAN-TERBUKA.md`.
- **Rantai penuh Item 126 terbukti** oleh pesan uji yang sama: dua baris `cost_ledger` bertanda `tier-auto` —
  yang pertama dalam sejarah tabel itu. Dicatat di changelog Item 126.
- Galat `ERR_NAME_NOT_RESOLVED` dan WebSocket Supabase yang sempat memenuhi konsol adalah gangguan DNS sesaat
  di jaringan, bukan kode — dibuktikan: soket `open`, kanal `joined`, DNS menjawab 5–13 ms sesudahnya.
