# Temuan Engineer

<!-- Berkas ini ditulis mesin dari blok <temuan> dalam jawaban Engineer, lalu disimpan atas perintah Owner.
     Owner boleh menyunting, menggabungkan, atau menutup temuan dengan tangan — bentuk di bawah yang dibaca
     kembali oleh IngatanTemuan.js. Temuan berstatus DITUTUP tidak akan diangkat lagi oleh Engineer. -->

**4 terbuka · 0 ditutup**

## TMN-0001 — ✅ DITUTUP 2026-10-04 (ternyata sudah benar sejak lahir)
- **Berkas:** `frontend/src/core/runtime/services/engineer.js`
- **Tingkat:** rendah
- **Ditemukan:** 2026-09-24
- **Ringkasan:** Komentar di baris 1035 menyatakan `_generateFallbackPatch` "diekstrak ke ./engineer/PatchGenerator.js", padahal fungsi tersebut sebenarnya dihapus total pada 2026-09-22 (T10), bukan diekstrak — komentar ini menyesatkan.
- **Bukti:** `git grep -n "generateFallbackPatch" -- frontend/src` hanya mengembalikan 2 baris komentar (engineer.js:1035 dan PatchGenerator.js:454), tidak ada definisi fungsi `generateFallbackPatch` yang tersisa di repo.
- **Penutupan:** tidak ada yang perlu dikerjakan — komentarnya **sudah benar**. `engineer.js:1024` kini berbunyi *"`_generateFallbackPatch` dihapus total (T10, …)"*, tepat seperti yang temuan ini minta.
- **Yang menarik:** diperbaiki di `d677e83` — **commit yang sama yang membuat berkas temuan ini**. Jadi TMN-0001 lahir sudah tertutup, lalu tercatat TERBUKA selama sepuluh hari karena tak ada yang memeriksanya ulang. Temuan yang berumur perlu diverifikasi sebelum dikerjakan, bukan sesudah.

## TMN-0002 — ✅ DITUTUP 2026-10-04 (sempat BERTAMBAH salah lebih dulu)
- **Berkas:** `frontend/src/components/workbench/ConversationEngine.jsx`
- **Tingkat:** rendah
- **Ditemukan:** 2026-10-01
- **Ringkasan:** Komentar baris 63 mengklaim `supabase.from()` "tidak ada lagi" untuk logika bisnis, padahal `supabase.from('chats')` masih dipanggil langsung di baris 381 dan 451 pada berkas yang sama.
- **Bukti:** `git grep -n "supabase.from" -- frontend/src/components/workbench/ConversationEngine.jsx` mengembalikan baris 381 dan 451 yang memanggil `supabase.from('chats').select('*')...maybeSingle()`, sementara baris 63 menyatakan "Tidak ada lagi: fetch(), supabase.from(), kernel.serviceManager.get()".
- **Sempat bertambah salah:** saat ditutup, pemanggilannya bukan dua lagi melainkan **tiga**. Yang ketiga — `supabase.from('project_memory_entries').insert(…)` di baris 822 — ditambahkan 2 Okt oleh `bbfce3a` (Brain 1 bisa ditulis), **ditulis tepat di bawah komentar yang menyangkal keberadaannya**. Komentar yang salah tidak menghalangi apa pun, jadi ia malah menarik pelanggaran baru.
- **Penutupan:** `supabase.from()` dicabut dari daftar "tidak ada lagi", dan ketiga pemanggilannya **didaftar beserta nomor barisnya** supaya penambahan berikutnya terlihat sebagai penambahan, bukan sebagai kejutan.
- **Yang TIDAK dikerjakan, dan sengaja:** memindahkan ketiganya ke `AssistantService`. Ketiganya pembacaan/penulisan baris langsung tanpa logika keputusan; memindahkannya adalah pekerjaan tersendiri, bukan sesuatu yang diselundupkan lewat perbaikan komentar. Komentarnya kini pernyataan **keadaan**, bukan aturan yang dilanggar.

## TMN-0003 — ✅ DITUTUP 2026-10-04 (keterangannya; fungsinya sengaja dibiarkan)
- **Berkas:** `frontend/src/core/runtime/services/AuditLogService.js`
- **Tingkat:** rendah
- **Ditemukan:** 2026-10-01
- **Ringkasan:** JSDoc `logCommand` di baris 92 menyebut "dari CommandRegistry" yang sudah dihapus, dan fungsi `logCommand` sendiri tidak pernah dipanggil di seluruh frontend/src (fungsi yatim).
- **Bukti:** `git grep -n "logCommand" -- frontend/src` hanya mengembalikan 1 hasil yaitu definisinya sendiri di AuditLogService.js:100, tidak ada pemanggil. Berkas `frontend/src/core/runtime/services/CommandRegistry.js` sudah tidak ada.
- **Diperiksa ulang 4 Okt:** keduanya **masih benar** — tetap satu kemunculan, tetap nol pemanggil, `CommandRegistry.js` tetap tidak ada.
- **Penutupan:** JSDoc-nya diperbaiki pada **dua** hal, bukan satu. Rujukan CommandRegistry dibuang, **dan** keyatiman method ini dinyatakan terang-terangan — tanpa itu pembaca berikutnya akan menyangka eksekusi command sudah tercatat lewat jalur ini, padahal tak satu pun tercatat.
- **Fungsinya SENGAJA dibiarkan hidup**, bukan terlewat: penghapusan permanen menunggu keputusan Owner, dan `this.log()` yang dipakainya tetap terpakai pemanggil lain. Keputusan hapus-atau-sambungkan masih terbuka.

## TMN-0004 — ✅ DITUTUP 2026-10-02
- **Berkas:** `frontend/src/core/runtime/services/engineer.js`
- **Tingkat:** sedang
- **Ditemukan:** 2026-10-01
- **Ringkasan:** Method `upgradeCapability()` (baris 1090) tidak pernah dipanggil dari mana pun di frontend/src, sehingga capability Engineer yang turun ke OBSERVER (akibat circuit breaker atau emergency lockdown) tidak punya jalur reset otomatis maupun manual dari UI.
- **Bukti:** `git grep -n "upgradeCapability" -- frontend/src` hanya mengembalikan satu baris — definisi method itu sendiri di engineer.js:1090 — tanpa satu pun pemanggil.
- **Ternyata lebih buruk daripada bunyi temuan ini.** "Nol pemanggil" adalah akibat, bukan cacatnya. Pencacah di `_handlePatchTask` adalah **pembatas laju** — jendelanya mereset tiap 60 detik, hukumannya tidak. Enam penerapan patch dalam semenit membuat Engineer berhenti menambal **sampai aplikasi ditutup**, tanpa satu pun `emit` yang memberi tahu.
- **Penutupan:** jendela habis → hukuman habis, pulih ke kapabilitas sebelumnya; keduanya bersuara. Tiap demosi mencatat `_sebabDemosi`, karena demosi keamanan (3 percobaan berkas inti) memakai `'OBSERVER'` yang sama dan **sengaja lengket** — pemulihan otomatis tanpa pembeda itu akan mengangkatnya semenit kemudian. Lihat [log](../changelog/2026-10-02-pemutus-arus-engineer.md) dan INDEX item 113.
- **Bukti penutupan:** `uji/uji-pemutus-arus-engineer.mjs` menjalankan kelas `Engineer` yang asli (27 asersi); uji mutasi M1–M4 semuanya menggigit; 74/74 hijau.
