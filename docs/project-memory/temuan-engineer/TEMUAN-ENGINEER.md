# Temuan Engineer

<!-- Berkas ini ditulis mesin dari blok <temuan> dalam jawaban Engineer, lalu disimpan atas perintah Owner.
     Owner boleh menyunting, menggabungkan, atau menutup temuan dengan tangan — bentuk di bawah yang dibaca
     kembali oleh IngatanTemuan.js. Temuan berstatus DITUTUP tidak akan diangkat lagi oleh Engineer. -->

**4 terbuka · 0 ditutup**

## TMN-0001 — TERBUKA
- **Berkas:** `frontend/src/core/runtime/services/engineer.js`
- **Tingkat:** rendah
- **Ditemukan:** 2026-09-24
- **Ringkasan:** Komentar di baris 1035 menyatakan `_generateFallbackPatch` "diekstrak ke ./engineer/PatchGenerator.js", padahal fungsi tersebut sebenarnya dihapus total pada 2026-09-22 (T10), bukan diekstrak — komentar ini menyesatkan.
- **Bukti:** `git grep -n "generateFallbackPatch" -- frontend/src` hanya mengembalikan 2 baris komentar (engineer.js:1035 dan PatchGenerator.js:454), tidak ada definisi fungsi `generateFallbackPatch` yang tersisa di repo.

## TMN-0002 — TERBUKA
- **Berkas:** `frontend/src/components/workbench/ConversationEngine.jsx`
- **Tingkat:** rendah
- **Ditemukan:** 2026-10-01
- **Ringkasan:** Komentar baris 63 mengklaim `supabase.from()` "tidak ada lagi" untuk logika bisnis, padahal `supabase.from('chats')` masih dipanggil langsung di baris 381 dan 451 pada berkas yang sama.
- **Bukti:** `git grep -n "supabase.from" -- frontend/src/components/workbench/ConversationEngine.jsx` mengembalikan baris 381 dan 451 yang memanggil `supabase.from('chats').select('*')...maybeSingle()`, sementara baris 63 menyatakan "Tidak ada lagi: fetch(), supabase.from(), kernel.serviceManager.get()".

## TMN-0003 — TERBUKA
- **Berkas:** `frontend/src/core/runtime/services/AuditLogService.js`
- **Tingkat:** rendah
- **Ditemukan:** 2026-10-01
- **Ringkasan:** JSDoc `logCommand` di baris 92 menyebut "dari CommandRegistry" yang sudah dihapus, dan fungsi `logCommand` sendiri tidak pernah dipanggil di seluruh frontend/src (fungsi yatim).
- **Bukti:** `git grep -n "logCommand" -- frontend/src` hanya mengembalikan 1 hasil yaitu definisinya sendiri di AuditLogService.js:100, tidak ada pemanggil. Berkas `frontend/src/core/runtime/services/CommandRegistry.js` sudah tidak ada.

## TMN-0004 — TERBUKA
- **Berkas:** `frontend/src/core/runtime/services/engineer.js`
- **Tingkat:** sedang
- **Ditemukan:** 2026-10-01
- **Ringkasan:** Method `upgradeCapability()` (baris 1090) tidak pernah dipanggil dari mana pun di frontend/src, sehingga capability Engineer yang turun ke OBSERVER (akibat circuit breaker atau emergency lockdown) tidak punya jalur reset otomatis maupun manual dari UI.
- **Bukti:** `git grep -n "upgradeCapability" -- frontend/src` hanya mengembalikan satu baris — definisi method itu sendiri di engineer.js:1090 — tanpa satu pun pemanggil.
