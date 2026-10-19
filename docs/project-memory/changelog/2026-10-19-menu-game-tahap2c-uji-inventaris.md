# 19 Oktober 2026 — "tidak ada fungsi yang hilang" kini diuji, bukan dijanjikan (Item 127 Tahap 2, langkah 2c)

Item 127 ([`ROADMAP-TAMPILAN-MENU-GAME.md`](../../roadmap/ROADMAP-TAMPILAN-MENU-GAME.md)). Langkah terakhir
Tahap 2 — **Tahap 2 selesai**. Tidak ada perubahan tampilan.

## Kenapa

Owner bertanya bagaimana meniru standar aplikasi asisten *"tanpa kehilangan suatu fungsi yang sebenarnya harus
ditampilkan"*. Jawabannya inventaris fungsi di roadmap §6: setiap fungsi yang tampil hari ini, satu baris,
dengan tempat barunya. Tahap 3 akan mengganti seluruh kulit — saat itulah fungsi paling mudah hilang tanpa suara.
Uji ini membuat inventarisnya mengikat sebelum kulit disentuh.

## Yang dibuat — `uji/uji-inventaris-fungsi.mjs`

1. **Dokumen = uji.** Uji membaca tabel §6 langsung dari roadmap. Setiap baris di sana wajib punya entri di uji,
   dan sebaliknya: fungsi ditambahkan ke inventaris tanpa jangkar = merah; entri uji untuk fungsi yang sudah
   dicoret dari dokumen = merah. Inventaris dan uji tidak bisa menyimpang diam-diam.
2. **Jangkar ada.** 36 fungsi wajib dibuktikan oleh jangkar di kodenya — nama penangan, judul tombol, komponen
   yang dirender, nama event. **Sengaja bukan kelas CSS**: Tahap 3 mengganti kulit, dan uji ini harus tetap
   hijau selama fungsinya tetap ada.
3. **Terjangkau.** Kode yang ada tetapi tak bisa dicapai sama dengan hilang: 11 aplikasi terdaftar dan semuanya
   ada di navigasi; komponen tiap aplikasi dimuat `AppRegistry`; pintu masuknya `app:home` — graf pengetahuan
   halaman pertama, **keputusan Owner K1 = B**.

Dua baris §6 berstatus *boleh hilang* — "Luaskan kolom chat" dan "Cahaya atmosfer" — karena Owner sudah
menyetujui keduanya dihapus. Jangkarnya tidak diwajibkan, tetapi barisnya tetap harus tercatat.

Dua keputusan Owner kini dikunci uji: **nalar `<think>` terbuka bawaan** (`<details open`) dan **graf sebagai
halaman pertama**. Tahap 3 tidak bisa membaliknya tanpa ketahuan.

## Bukti

Lulus pada percobaan pertama — jadi dibuktikan dengan **8 mutasi, semuanya menggigit**:

| Mutasi | Yang memerah |
|---|---|
| fungsi baru di inventaris tanpa jangkar | baris inventaris tanpa jangkar |
| baris dicoret dari dokumen | entri uji yang basi |
| tombol Keluar hilang | Keluar (logout) |
| nalar tertutup bawaan | Nalar `<think>` terbuka gaya DeepSeek |
| aplikasi hilang dari navigasi | 11 aplikasi di navigasi |
| pintu masuk bukan Home | K1 = B |
| navigasi seluler tak dirender | Navigasi seluler |
| hapus dokumen di Knowledge hilang | Knowledge |

Satu mutasi (pintu masuk) sempat tak berjalan karena pola teksnya tak cocok dengan format `system.json`; diulang
dengan format aslinya dan menggigit. Suite **103/103**.

## Tahap 2 selesai

| Langkah | Commit |
|---|---|
| 2a — kolom baca, laci, satu baris tombol, ikon | `e7c7ac0` |
| 2b — Settings bertab | `49ceb4d` |
| 2c — uji inventaris | commit ini |

Berikutnya Tahap 3 (kulit ruangan) — butuh keputusan Owner K2, K4, K5.
