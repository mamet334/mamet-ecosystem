# 3 November 2026 — Konektor MCP Tahap G5: konektor terlihat dari chat lewat menu tombol +

[Rancangan §9](../../roadmap/ROADMAP-KONEKTOR-MCP.md) · Item 129. Desktop dan web (layar saja); server tidak berubah.

## Kenapa

Owner bertanya: *"apakah di tampilan asisten tidak ditampilkan konektornya?"* Jawabannya tidak. Konektor hanya
terlihat di tiga tempat: Settings, dialog izin, dan catatan kaki sesudah alat dipakai. Akibatnya, dari chat tidak
terlihat bahwa GitHub menyala, dan tidak terlihat pula bahwa daftar 27 alatnya ikut terkirim di setiap pesan
Assistant (perkiraan ±2–3 ribu token, belum diukur).

**Usul dan keputusan Owner:** konektor dipindahkan ke **tombol +**, yang sebelumnya hanya untuk percakapan baru.
Bilah chat di layar 1366×768 sudah sempit, jadi tidak perlu tombol baru. Untung-ruginya dicatat: percakapan baru
dari tombol + kini butuh 2 klik, tetapi tetap 1 klik lewat laci riwayat (☰).

## Yang dibangun — `components/konektor/`, satu berkas satu tugas

- `menuKonektor.js` (murni) menggabungkan dua sumber status, yaitu crawler bawaan dan server umum, menjadi satu
  daftar untuk **workspace yang sedang dibuka** (K3).
  - Sebuah konektor dianggap **siap** bila kredensialnya lengkap **dan** alatnya sudah ditinjau.
  - Keterangannya bisa berupa: menyala, mati, kredensial belum diisi, alat belum ditinjau, alat berubah, gagal, atau
    berhenti.
  - **Penanda tombol +** memakai urutan: masalah (merah) didahulukan, lalu menyala, lalu tidak ada penanda.
- `arahSettings.js`: "Atur di Settings ›" membuka **tab Konektor**, baik saat Settings belum terpasang (permintaan
  sekali pakai) maupun sudah terpasang (lewat peristiwa).
- `MenuTambah.jsx`: tombol + dengan titik penanda. Isi menunya:
  - **"Percakapan baru"** di baris pertama;
  - daftar konektor dengan sakelar per workspace, lewat jalur `atur` yang sama dengan Settings. Konektor yang belum
    siap tidak bisa dinyalakan, sedangkan yang menyala selalu bisa dimatikan;
  - "Atur di Settings ›".

  Status diperbarui tiap 5 detik. Menu **hanya** menyalakan atau mematikan: tidak memasang, tidak menyimpan
  kredensial, tidak meninjau, dan tidak memanggil alat. Di web, menu menampilkan "Konektor hanya tersedia di
  aplikasi desktop".
- `ConversationEngine.jsx`: tombol + lama diganti dengan satu baris `<MenuTambah …/>`.
- `Settings.jsx`: tab awal dibaca dari permintaan, dengan bawaan tetap "model".

## Bukti

- `uji-konektor-umum-g5.mjs` lulus. **Mutasi pada salinan: 15/15 mati.** Satu mutan sempat lolos dan menunjukkan
  celah uji: kasus "alat sudah disetujui tetapi token dihapus" belum diuji, karena kasus Notion kebetulan tanpa token
  dan belum ditinjau sekaligus. Kasus itu sudah ditambahkan.
- Dua penjaga lama menangkap perubahan ini dan sudah disesuaikan polanya, sementara aturannya tetap:
  - `uji-inventaris-fungsi` v3: "Percakapan baru" wajib ada, kini di `MenuTambah`;
  - `uji-settings-bertab` v4: tab bawaan tetap "model".
- Kelas Tailwind dikompilasi sungguhan. `uji-ikon-subset` lulus. `vite build` berhasil. Suite penuh **152/152**.
- **Di aplikasi Owner** (`npm run desktop` dijalankan ulang, 3 Nov): menu + muncul (laporan Owner).
