# Tahap 6 — verifikasi patch yang DIJALANKAN, bukan dicocokkan

**28 September 2026** · `ROADMAP-ENGINEER-MANDIRI.md` Tahap 6 · kode selesai, belum diuji live

## Yang berubah

Sesudah patch Engineer ditulis ke disk, **51 berkas uji dijalankan sungguhan** (16,9 detik). Bila ada yang
gagal, berkas **dikembalikan sendiri** ke isi sebelum patch, lalu berkas uji yang tadi gagal **dijalankan
ulang** terhadap kode yang sudah kembali — untuk memisahkan *rusak oleh patch ini* dari *sudah merah sebelum
patch*. Laporannya menyebut **nama berkas ujinya beserta keluarannya**, bukan "2 masalah kritis".

Pertanyaannya berubah dari *"apakah patch ini tampak aman"* menjadi *"apakah sistem ini masih benar sesudah
patch"*. Itu baru mungkin karena checkpoint sudah wajib sejak 22 September: patch boleh **diterapkan dulu, lalu
diputuskan**.

## Kenapa

Tiga lapis verifikasi yang ada sebelumnya menebak dari **bentuk teks**. Pada 24 September dua di antaranya salah
dengan cara yang sama, dan keduanya memblokir patch yang **benar**: `includes('eval(')` menandai berkas yang
sekadar menyebutnya, `formatRegex` memotong patch karena di dalamnya ada "ADR-0017". Lapis yang menjalankan kode
sungguhan justru absen dari jalur patch, padahal ia yang menghasilkan satu-satunya angka tak terbantahkan hari
itu (5/10 klaim terbukti).

## Berkas

| Berkas | |
|---|---|
| `uji/jalankan-semua.mjs` | **baru** — penjalan seluruh berkas uji, keluaran JSON untuk mesin |
| `frontend/src/core/runtime/services/engineer/VerifikasiPatch.js` | **baru** — putusan & laporan, murni |
| `frontend/electron/main.cjs` | `eng:verifikasi-patch`; `pulihkanDariCheckpoint()` dipisah dari dialog Undo |
| `frontend/electron/preload.cjs` | `verifikasiPatch` |
| `.../engineer/PatchApplier.js` | memanggil verifikasi sesudah menulis; status `DIPULIHKAN` |
| `.../workbench/ConversationEngine.jsx` | laporan ditempel; patch yang dipulihkan tak dilaporkan "Berhasil" |
| `uji/uji-patch-crlf.mjs`, `uji-temuan-terpasang-v2.mjs`, `uji-laporan-patch-bertahan.mjs` | penanda `UJI-CERMIN:` |
| `uji/uji-verifikasi-tahap6.mjs` | **baru** — 5 lapis, termasuk kendali yang sengaja merah |

## Tiga hal yang berubah dari rancangan 24 September

**1. Langkah 4b apa adanya akan memulihkan patch yang benar.** `uji-folder-label` merah diam-diam empat hari
karena folder di luar repo berganti nama. Satu uji merah lama akan memulihkan setiap patch yang benar,
selamanya. Karena itu ada langkah "jalankan ulang yang gagal sesudah pemulihan" — ongkosnya ±1 detik, bukan
menjalankan suite dua kali (±34 detik).

**2. Seluruh langkahnya pindah ke proses utama.** Di `npm run desktop`, menulis berkas aplikasi memicu Vite
memuat ulang halaman; layar yang menunggu hasil uji mati di tengah jalan. Yang tidak boleh ikut mati adalah
pemulihannya. Itu juga menuntut jalur pemulihan **tanpa dialog** — tombol Undo Owner tetap bertanya dulu.

**3. Penjalan uji versi pertama memberi lima MERAH PALSU**, jenis cacat paling berbahaya di sini: stdout dan
stderr digabung sehingga peringatan node jadi "kesimpulan", dan berkas `uji-*.js` (modul konsol DevTools) ikut
dijalankan lalu tampak gagal. Ketahuan pada jalan pertama, bukan dari membaca ulang kode. Kini putusan dibaca
dari stdout saja, dan berkas yang tidak dijalankan tetap **dilaporkan namanya** — pengecualian yang diam persis
cara `uji-folder-label` merah tanpa ketahuan.

## Prasyarat roadmap: uji cermin

Tiga berkas uji menyalin logika lalu menguji salinannya; kalau kode aslinya berubah dan salinannya tidak, ia
tetap hijau. Ketiganya kini bertanda `UJI-CERMIN:` yang dibaca mesin, dan jumlahnya masuk laporan **juga saat
semuanya hijau** — supaya "51/51 lulus" tidak pernah berarti lebih daripada yang dibuktikan. Memindahkan
logikanya keluar dari komponen React (nomor 2 prasyarat) belum dikerjakan; penandanya membuat utang itu
terlihat, bukan hilang.

## Yang TIDAK dijanjikan

- **Patch tidak merusak yang sudah terbukti.** Bukan: patch ini benar.
- Berkas tanpa berkas uji tetap tak terjaga.
- Uji kita sendiri bisa salah — dua kali dalam satu hari uji lulus padahal fiturnya rusak.
- Di `npm run desktop`, laporannya bisa hilang dari layar karena muat ulang Vite. **Pemulihannya tetap
  terjadi.** Ini sengaja tidak ditambal dengan lapisan penyangga keempat.

## Bukti

`51 berkas uji hijau` · `vite build` lolos · `node --check` pada main.cjs & preload.cjs lolos.

`uji-verifikasi-tahap6.mjs` menjalankan `executePatchApplication` yang **sungguhan** dengan Electron tiruan:
terbukti berkas ditulis lebih dulu, verifikasi dipanggil dengan checkpoint yang barusan dibuat, dan saat uji
merah status berkas berubah jadi `DIPULIHKAN`, `success` jadi `false`, `checkpointRef` jadi `null`, serta dialog
Undo **tidak** dipanggil. Uji kendali menanam berkas uji yang sengaja gagal dan membuktikan penjalannya bisa
merah.

**Uji live yang masih perlu:** `npm run dist` + pasang, lalu satu patch yang sengaja merusak berkas beruji —
berkasnya harus kembali sendiri dan laporannya menyebut berkas uji yang gagal. Kendalinya: patch yang benar
tidak dipulihkan.
