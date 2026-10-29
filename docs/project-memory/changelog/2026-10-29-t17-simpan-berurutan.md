# 29 Oktober 2026 — T17: penyimpanan otomatis chat tak lagi melewatkan perubahan

Temuan T17 (19 Okt, Item 127 Tahap 1 — [roadmap](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md)): di pengamat `simpanOtomatis`
(`ConversationEngine.jsx`), timer yang berbunyi saat penyimpanan sebelumnya masih berjalan langsung keluar —
`if (isSavingRef.current) return;` — **tanpa menjadwal ulang**. Perubahan itu baru tersimpan pada perubahan BERIKUTNYA;
jawaban terakhir percakapan bisa tak pernah sampai ke tabel `chats` bila aplikasi ditutup lebih dulu.

Ikut ketahuan saat memperbaikinya: tanda "sedang menyimpan" baru dipasang **sesudah** `await supabase.auth.getSession()`,
jadi timer yang berbunyi di sela itu bisa menjalankan penyimpanan kedua **bersamaan** — yang lebih lama bisa selesai
belakangan dan menimpa yang baru.

## Yang dibuat (klien saja)

- **`components/workbench/simpanBerurutan.js`** (baru) `simpanBerurutan(sedangRef, tertundaRef, simpan, ulangi)`:
  tanda dipasang SEKETIKA; permintaan yang datang selama penyimpanan berjalan **dicatat**; sesudahnya `ulangi()` (pengamat)
  dijalankan sekali — ia sendiri yang membandingkan `kunciSimpan` keadaan SEKARANG dengan yang baru disimpan. Penyimpanan
  yang gagal TANPA permintaan baru **tidak** diulang (tak ada lingkaran coba-ulang tiap detik saat jaringan putus).
- **`ConversationEngine.jsx`**: pengamat jadi fungsi bernama `simpanOtomatis` (didaftarkan dan dijalankan ulang oleh fungsi
  yang sama); `simpanTertundaRef` lewat `useRefTersimpan` (bertahan saat layar dilepas). Penjaga lain tak berubah.

## Bukti

- **`uji/uji-simpan-berurutan.mjs`** (baru): kode asli + penyimpanan lambat buatan — jawaban yang datang di tengah
  penyimpanan tersimpan tanpa perubahan ketiga; tak pernah dua penyimpanan bersamaan; beberapa permintaan tertunda → SATU
  penyimpanan lanjutan dengan keadaan terbaru; gagal tanpa perubahan → tak diulang; gagal + perubahan → perubahan tetap
  disimpan. **Mutasi 5/5 menggigit.**
- Uji lama disesuaikan: `uji-keadaan-chat-di-luar-layar` (ref baru terdaftar); `uji-pemulihan-chat-v6` membaca badan
  autosave sampai akhir efek pendaftarnya (pendaftaran kini jatuh di huruf ke-4857, di luar jendela tetap 4500 lama) —
  pola yang diperiksa tidak dilonggarkan.
- Suite penuh **129/129**; `vite build` berhasil; nol karakter kendali.

Berlaku di `npm run desktop`; aplikasi terpasang lewat rilis berikutnya.
