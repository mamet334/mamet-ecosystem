# 3 November 2026 — Item 130 Tahap F: graf Home menjadi tata surya

[Roadmap Item 130](../../roadmap/ROADMAP-GRAF-HOME-PETA-SISTEM.md). Klien saja (tanpa server, tanpa migrasi). Dicek
Owner di `npm run desktop`: sesuai.

## Mengapa

Tata letak gaya fisika (Tahap A–E) memantul. Percobaan menurunkan gaya tolak setengahnya justru menyisakan label yang
bertindih, dan konsep tata surya hilang: data menggumpal, planet tak terbaca sebagai planet. Keputusan Owner: graf dibuat
seperti tata surya, yaitu matahari, planet, dan bulan-bulannya. Tanpa garis orbit. Gaya tolak dikembalikan, lalu fisika
dipensiunkan seluruhnya.

## Tata letak (`grafHome.js` `tataSurya`)

Posisi **dihitung dan dipaku** (`fx`/`fy`); gaya tolak, pegas, dan pusat force-graph dimatikan. Graf diam.

- **Bintang ganda MAMET:** Desktop di −30, Server di +30, disambung jalur pesan.
- **Planet = kemampuan inti:** satu orbit, berselang 72°, mulai dari atas (Chat → Memori → RAG Dokumen → Tabel ASN →
  Engineer). Jari orbit = nilai terbesar dari dua syarat: ruang bintang + jari sistem, atau tali busur antar-sistem
  bertetangga + jeda 16. Dengan begitu sistem planet tak pernah bersentuhan.
- **Bulan = data milik planetnya** (`cincinBulan`): cincin konsentris, bulan terbesar paling dalam. Kapasitas tiap
  cincin ditentukan oleh bulan terbesarnya. **Pesan = bulan dari percakapannya**, muncul saat percakapan dibuka.
- **Fondasi = planet luar** di sela planet (−54°, 90°, −126°), di luar sistem planet terbesar + jeda 40.
- **Satelit = lapisan Kemampuan:** di luar sistem induknya, diputar 70° dari arah keluar. Pada 0° dan 50° label
  "Alat folder" tertimpa label "Engineer" (diukur). Konektor = satelit MCP, sub-agent = satelit Server.
- **Label** di sisi luar sistemnya (`labelGeser`/`labelAtas`, `jangkarLabel`). Nama data muncul setelah Owner
  memperbesar ±1,8× dari pandangan awal (`ambangLabelData`). Sebelumnya layar 2560 dibuka pada skala 2,36 dan
  langsung menampilkan 468 nama.

## Jaring & seretan (koreksi Owner sesudah pratinjau pertama)

- Versi pertama menyembunyikan garis relasi. Owner: "jalur hubungan itu fiturnya, buat seperti jaring laba-laba".
  Kini semua garis relasi **selalu tampil dan lurus**; hanya jalur pesan Desktop ⇄ Server yang melengkung. Simpul
  dipilih → garisnya menyala putih dan menebal, jaring lain meredup (`garisMenyala`).
- **Bulan ikut planetnya:** seretan menggeser seluruh sistem simpul (`keturunanSistem`, `mulaiSeret`/`ikutSeret`):
  bulan, satelit beserta alatnya, dan pesan bila ekornya terbuka. Bintang Server menyeret satelit Sub-agent. Geseran
  dicatat (`geserRef`) dan diterapkan ulang setiap graf disusun (`terapkanGeser`: data baru, ekor dibuka, lapisan
  dinyalakan). Saat Home dibuka ulang, tata surya kembali rapi.
- Kamera hanya dipaskan ulang bila isi dasar berubah, bukan saat ekor pesan dibuka.

Konstitusi 23 mendapat bagian **TATA SURYA** dan gambar tata letak baru.

## Hasil terukur (data tiruan setara Owner: 229 dokumen, 135 percakapan, 94 memori)

- Skala pas layar Owner 1366: **1,014** (sebelumnya 0,737). Layar 1920: 1,614. Layar 2560: 2,359.
- Jari orbit 148, orbit luar 263. Pada data 2×: 181 dan 330.
- 0 label tindih di tampilan dasar. Lapisan Kemampuan: **0 tindih & 0 label tersembunyi** di 18 skenario (2 urutan alat ×
  konektor mati/web/menyala dengan 7 alat × layar 1366/768/data 2×). Ekor 138 pesan: 0 tindih.

## Bukti

- `uji/uji-graf-home-tahap-f.mjs` (baru) **33/33**. Isinya:
  - 643 simpul dipaku; 458 bulan diperiksa berpasangan tanpa tindih; 15 badan (bintang, sistem planet, fondasi, sistem
    satelit) tanpa sentuhan;
  - skenario dua planet besar bertetangga (900 bulan) supaya syarat tali busur benar-benar mengikat;
  - seretan Chat (120, 75): ke-135 bulan, 138 pesan, dan satelit Alat chat ikut tepat sejauh itu; simpul lain diam;
    geseran bertahan sesudah disusun ulang;
  - kabel ActivityGraph/HomeDashboard dan Konstitusi 23.
- **Mutasi pada salinan repo** (bukan checkout yang dipakai desktop Owner): **48/48 mati**. Tiga sempat lolos dan
  semuanya celah uji, sudah ditutup:
  - dua mutan pada syarat tali busur, yang tak pernah mengikat pada data Owner → skenario planet besar;
  - satu mutan "awal seretan dari posisi kini", karena uji memulai seretan sebelum simpul bergerak, padahal force-graph
    baru memanggil `onNodeDrag` sesudah simpul melewati ambang geser.
- Uji Tahap A–E disesuaikan: pemeriksaan fisika diganti jarak eksak. Simulasi `uji/lib/simulasiGrafHome.mjs` kini
  memakai `tataSurya` tanpa d3.
- Seluruh suite **147/147**; bundel esbuild HomeDashboard, ActivityGraph, useDashboardData tanpa galat.

## Gratis & aman

Tanpa panggilan model atau Edge Function, tanpa polling. Seretan dan jaring dihitung di layar saja. Teks data tetap
di-escape.
