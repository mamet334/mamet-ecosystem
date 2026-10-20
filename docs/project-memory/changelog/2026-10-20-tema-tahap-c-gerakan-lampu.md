# 20 Oktober 2026 — tema aplikasi Tahap C: "Kurangi gerakan" & lampu ruangan (Item 128)

Item 128 ([`ROADMAP-TEMA-APLIKASI.md`](../../roadmap/ROADMAP-TEMA-APLIKASI.md)), Tahap C. Dua pekerjaan Item 127 yang
ditunda Owner (gerak dekoratif, lampu) kini menjadi **pilihan pengguna** di Settings › Tampilan.

## Kurangi gerakan

| Pilihan | Artinya |
|---|---|
| **Ikuti Windows** (bawaan) | mengikuti setelan efek animasi Windows (`prefers-reduced-motion`) — tanpa mengubah apa pun, aplikasi tampil seperti sebelumnya |
| **Kurangi** | semua animasi & transisi berhenti di keadaan akhirnya |
| **Normal** | animasi tetap berjalan, apa pun setelan Windows |

- `TemaService` menulis `data-gerak` di `<html>` dan mendengarkan perubahan setelan Windows saat aplikasi terbuka.
- `index.css`: `html[data-gerak="kurangi"] *` → durasi animasi & transisi 0,01ms, sekali jalan (WCAG 2.2 — 2.2.2,
  2.3.3). Durasi sangat kecil, bukan `animation: none`, supaya `animationend` tetap terjadi.
- Settings: tiga pilihan sebagai `radiogroup`, keadaan saat ini diberitahukan.
- **Diukur di peramban:** `animate-spin` 1s tak terbatas → 0,00001s sekali; `animate-pulse` 2s tak terbatas → berhenti;
  transisi 0,3s → seketika.

## Lampu ruangan

Keputusan Owner 20 Okt: wujud **A — pendar saja** (tanpa benda lampu), **25%** kekuatan layar masuk, **mati
bawaannya**, tampil hanya bila latar ruangan nyala, bisa dinyalakan/dimatikan.

- Dua lapisan pendar **disalin** dari medan cahaya `LampLogin.jsx` ke `LatarRuangan.jsx` (dijaga uji agar sama persis
  — utang K5), di wadah `opacity-25`, di atas bayangan samping dan di bawah vinyet.
- **Kenapa 25%:** pada kekuatan penuh, teks yang langsung berada di atas latar di area terang turun ke ±3,58:1;
  pada 25% semua teks ≥ 4,5:1 (paling rendah label redup 4,64:1 — perkiraan tanpa blur, jadi batas atas yang aman).
- `index.css`: `.lampu-ruangan` tersembunyi; tampil hanya bila `html[data-lampu="nyala"]`. Pendar berada di dalam
  `.latar-ruangan`, jadi ikut tersembunyi bila latar mati.
- Settings: saklar "Lampu ruangan" di bawah saklar dinding; bila lampu nyala tetapi latar mati, dijelaskan kenapa
  pendar belum tampil.
- **Diperiksa di peramban** (lapisan dinding dirender di halaman, sesi pane sudah keluar): mati bawaannya
  (`display: none`), dinyalakan → tampil dengan opasitas 0,25.

## Uji

| Uji | Yang dijaga |
|---|---|
| `uji-tema-tahap-c.mjs` v2 (baru) | logika kurangi gerakan (bawaan ikut sistem), aturan CSS, penerapan & pendengar setelan Windows, radiogroup; logika lampu (mati bawaannya, butuh latar nyala), penerapan `data-lampu`, saklar |
| `uji-latar-ruangan.mjs` v6 | pendar = salinan medan cahaya LampLogin, wadah 75% & 25%, kelasnya dibuat Tailwind; titik paling terang dihitung DENGAN pendar; teks di atas latar & di dalam kartu ≥ 4,5:1 untuk **setiap** tema; urutan lapisan |

Tiga belas mutasi dibuktikan menggigit. Suite 113/113. Build produksi tanpa peringatan.

## Juga dicatat

**T19** di [`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md): fitur lupa & ganti kata sandi belum
ada (tautan "Lupa kata sandi?" di layar masuk kosong) — ditunda Owner ke **fase hardening**.
