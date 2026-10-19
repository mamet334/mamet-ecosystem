# 19 Oktober 2026 — menu utama bergaya menu game: kotak melayang + tombol MENU (Item 127, K2)

Item 127 ([`ROADMAP-TAMPILAN-MENU-GAME.md`](../../roadmap/ROADMAP-TAMPILAN-MENU-GAME.md)), keputusan **K2** dan
bagian pertama Tahap 3. Dikerjakan sebagai **percobaan** atas permintaan Owner (*"coba k2 nanti saya lihat"*),
dinilai di layarnya sendiri dalam empat putaran, lalu disetujui: *"sudah bisa dan benar"*.

## Hasil

Bilah ikon kiri di desktop diganti **menu teks** bergaya menu game — meniru gambar referensi Owner (Unity Horror
Game Menu): judul **MAMET / OS / ECOSYSTEM** di atas, lalu daftar menu **teks polos tanpa ikon**.

```
 MAMET
 OS
 ECOSYSTEM

 ▸ LANJUTKAN        ← hanya bila ada percakapan terakhir sungguhan
     Assistant
   HOME
   WORKSPACE ›      → Assistant · Lite · Engineer · ‹ Kembali
   DATA & CAPABILITY ›
   SYSTEM OBSERVABILITY ›
   SETTINGS

   KELUAR           ← bertanya dulu
```

- **Bentuk:** kotak melayang, dibuka tombol **MENU** — kotak kecil yang **bisa digeser** ke mana saja (bawaan kiri
  bawah), posisinya diingat dan selalu dijepit ke dalam jendela. Klik di bawah 5px = membuka menu; di atasnya =
  menggeser. **Menu tak mengambil kolom sama sekali.**
- **Di Home** kotaknya terbuka sendiri — lobi game sebelum mulai. Di halaman lain tertutup; memilih aplikasi atau
  klik di luar menutupnya; **Esc**: sub-menu → menu → tutup.
- Kotak terbuka **ke arah yang lapang** mengikuti posisi tombol, setinggi isinya; bila tak muat ia bisa digulir,
  **tanpa bilah gulir** yang terlihat.
- Isinya **dari metadata** (`NavigationService` = `navigation.json`, MUS §21) — tak ada daftar aplikasi yang
  ditulis tangan. "Lanjutkan" hanya muncul bila aplikasi chat terakhir punya chat aktif di `PenyimpanKeadaan`
  (MUS §4.2).
- **Seluler tidak berubah** — laci `Sidebar` + bilah bawah.

## Empat putaran penilaian Owner

| Putaran | Yang dinilai Owner | Yang dibuang |
|---|---|---|
| 1 | *"menunya terlalu lebar… terlalu banyak memotong layar"*, *"kaku jika buka riwayat"* | kolom 224px setinggi layar |
| 2 | *"☰… masih terlalu panjang ke bawah… seperti tidak menyatu dengan temanya"* | jalur 48px |
| 3 | *"bisakah tombolnya digeser… simbolnya jangan ☰, ganti menu saja, karena sama dengan riwayat"* | ☰ dan posisi tetap |
| 4 | *"jangan tampilkan garis scrolling-nya… tapi tetap bisa di-scroll"* | bilah gulir putih bawaan Chromium |

Satu pertanyaan Owner (putaran 1) dijawab lewat pilihan, bukan tebakan — kotak melayang + tombol dipilih dari dua
bentuk yang ditawarkan dengan pratinjau.

## Huruf — usul K4 dipakai SEMENTARA

Gaya judul LampLogin (mono krem bercahaya), warna dari palet LampLogin (`#fff8ec` di atas `#0b0806`) — **bukan**
token Material, jadi angka ciri tampilan generik tidak naik. K4 belum diputuskan; diusulkan menjadi **skala huruf**
utuh (teks 16px, menu 14px, label ≥12px, angka tabular, format id-ID).

**Kontras diukur, bukan dikira** (WCAG 2.2 AA ≥ 4,5:1). Pengukuran pertama menemukan keterangan "Lanjutkan"
**3,89:1 — gagal**; dinaikkan menjadi **6,16:1**. Terendah sekarang 5,99:1.

## Berkas

| Berkas | Perubahan |
|---|---|
| `frontend/src/components/os/MenuTeks.jsx` (baru) | menu, tombol MENU yang bisa digeser, kotak melayang |
| `frontend/src/components/os/OSDesktopShell.jsx` | desktop → `MenuTeks`, seluler → `Sidebar`; jarak `ml-16` untuk bilah lama dibuang |
| `uji/uji-menu-teks.mjs` (baru) | mengunci hasil keempat putaran + kontras dihitung dari warna di kode |
| `uji/uji-inventaris-fungsi.mjs` → v2 | navigasi desktop kini juga berjangkar pada `MenuTeks` |
| roadmap §5.2 | catatan "diganti sebagian oleh" — rancangan kolom kiri tidak dipakai |

## Bukti

- **Owner menilai di `npm run desktop`** keempat putaran, dengan tangkapan layar Home, Assistant, Knowledge, dan
  laci riwayat.
- **Mutasi — 8, semuanya menggigit:** ☰ kembali · bilah gulir kembali · guliran ikut hilang · klik sesudah geser
  membuka menu · kontras keterangan turun (3,01:1) · "Lanjutkan" tanpa chat aktif · menu kembali jadi kolom ·
  token Material masuk.
- **Penjaga lama menangkap kesalahan baru:** `uji-catch-diam` (sejak 7 Okt) menemukan satu `catch` diam tanpa
  keterangan di `MenuTeks.jsx`; diberi keterangan (localStorage diblokir → "Lanjutkan" sekadar tak tampil).
- Suite **104/104**; angka ciri tampilan generik tidak naik.

## Catatan yang ikut ketahuan

Server dev saya di port 5173 mati saat sesi terputus. Jendela `npm run desktop` Owner memuat `localhost:5173`
(`main.cjs:220`), **bukan** Vite miliknya sendiri yang berpindah ke 5174 karena portnya terpakai — jadi jendela itu
bergantung pada server yang tidak ia jalankan sendiri. Dinyalakan ulang; tidak diubah.

## Sisa

- `Sidebar.jsx` cabang desktop kini tak terpakai (seluler masih memakainya) — dibersihkan bila K2 bertahan.
- Nama menu masih dari metadata apa adanya (campuran Inggris) — bila diterjemahkan, metadatanya yang diubah.
- Sisa Tahap 3: ruangan & lampu sebagai latar, palet LampLogin menggantikan token Material, satu set ikon,
  skala huruf (K4), dan K5.
