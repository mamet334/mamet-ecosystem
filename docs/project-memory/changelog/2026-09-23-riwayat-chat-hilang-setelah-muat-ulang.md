# Riwayat chat hilang setiap muat ulang + chat siluman dari pesan sistem

**Tanggal:** 23 September 2026
**Roadmap:** T10 di [`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md) (temuan muncul saat uji Engineer TUGAS-01)
**Status:** ✅ selesai & terbukti live

## Gejala

Setelah Engineer menulis patch, Vite memuat ulang halaman dan chat Engineer tampak **kosong** — laporan hasil patch
tidak muncul, tombol Undo hilang. Satu tugas Engineer juga terpecah jadi **empat baris** di tabel `chats`, dua di
antaranya chat baru yang judulnya isi laporan penalaran. Terpisah dari itu: membuka chat lama dari riwayat membuat
chat itu melompat ke puncak daftar, mendorong turun chat yang sedang dikerjakan.

## Sebab (bukti, bukan dugaan)

Jejak localStorage Chromium (`Local Storage\leveldb\001230.log`) diurai per batch tulis. Pada dua kali muat ulang:

```
seq 5433  HAPUS mamet_v4_ws-{assistant,engineer,lite}_current_chat_id
seq 5473  SET   mamet_v3_app:*_layout_*            ← halaman baru dimuat
          HAPUS mamet:patchBerjalan
          HAPUS mamet_v4_ws-{assistant,engineer,lite}_current_chat_id
```

Ketiga penunjuk chat terhapus bersamaan, padahal keempat baris chat masih ada di database. Sebabnya urutan effect di
`ConversationEngine.jsx`: effect **sinkronisasi** (`currentChatId` → localStorage) dideklarasikan sebelum effect
**pemulihan**, jadi pada commit yang sama ia jalan lebih dulu. Sesudah muat ulang `currentChatId` selalu `null`,
sehingga kunci DIHAPUS tepat sebelum effect pemulihan membacanya. Pemulihan chat karena itu **tidak pernah** berhasil
setelah muat ulang, dan pesan berikutnya lahir sebagai chat baru.

Dua sebab pendamping:
- `AssistantService.loadChat` memakai `.single()` dan mengembalikan `null` untuk SEMUA kegagalan — "baris tidak ada"
  dan "gagal membaca" tak terbedakan, lalu pemanggilnya menghapus penunjuk chat yang isinya masih utuh di database;
- pesan yang dibuat sistem sendiri (laporan penalaran Engineer, dialog konfirmasi, laporan patch) ikut memicu
  penyimpanan otomatis saat belum ada chat aktif → lahir baris `chats` baru berjudul isi laporan. Ketiga instance chat
  (assistant/engineer/lite) menerima pesan itu, jadi satu laporan bisa melahirkan beberapa chat.

## Perbaikan

| Berkas | Perubahan |
|---|---|
| `ConversationEngine.jsx` | effect sinkronisasi menunggu `initialRestoreDone` — kunci tak disentuh sebelum pemulihan selesai; saat pemulihan gagal karena gangguan, penunjuk dipertahankan (`pemulihanGagalRef`) dan layar memberi tahu bahwa chat lama tidak hilang |
| `AssistantService.loadChat` | `.maybeSingle()` + kembalian `{ messages, hilang, error }` — "gagal baca" tidak lagi sama dengan "chat hilang"; membuka chat yang gagal dibaca dibatalkan, bukan membuka layar kosong yang bisa tertimpa |
| `pemulihanChat.js` (baru) | `putusanPemulihan` (pakai/lepas/pertahankan), `bolehSimpanChat` (chat baru hanya lahir dari pesan pengguna), `kunciSimpan` (sidik jari isi) — dipisah supaya keputusannya bisa diuji sebagai kode yang dipakai |
| membaca ≠ mengubah | isi yang baru dibaca dari database ditandai "sudah tersimpan" sebelum dipasang, baik saat pemulihan maupun saat membuka chat dari riwayat → `updated_at` tidak naik, urutan riwayat tidak melompat |

## Bukti live (23 September 2026)

- Muat ulang biasa (Ctrl+R) tanpa tindakan lain: **tidak ada satu pun operasi pada kunci chat** (hanya `lswt-`/`test`
  milik uji tulis Supabase), kunci Engineer tetap berisi chatnya, dan isi chat kembali utuh (2 pesan, tidak berubah).
  Dengan kode lama, muat ulang selalu menghapus ketiga kunci.
- Tidak ada lagi baris `chats` yang lahir dari pesan sistem; satu-satunya chat baru adalah chat yang benar-benar
  dimulai Owner.
- Owner menguji urutan riwayat: membuka chat lama untuk menyalin pertanyaan **tidak lagi** mengubah urutan.

## Uji otomatis (di luar git)

`node node_modules/.uji-rag/uji-pemulihan-chat.mjs` → **v3, 19/19 LULUS**, termasuk penjaga regresi statis: urutan
deklarasi kedua effect, penjaga `initialRestoreDone`, tidak ada `.single()` lagi, dan penandaan "sudah tersimpan"
terjadi sebelum isi dipasang.

## Catatan

Muat ulang otomatis itu sendiri **bawaan Vite** (`npm run desktop` menjalankan `vite` + Electron yang memuat
`localhost:5173`), bukan kode Mamet: berkas non-komponen seperti service tidak punya penangan HMR sehingga halaman
dimuat ulang penuh. Di aplikasi hasil `npm run dist` hal ini tidak terjadi.
