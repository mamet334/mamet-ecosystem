# Temuan Engineer

<!-- Berkas ini ditulis mesin dari blok <temuan> dalam jawaban Engineer, lalu disimpan atas perintah Owner.
     Owner boleh menyunting, menggabungkan, atau menutup temuan dengan tangan — bentuk di bawah yang dibaca
     kembali oleh IngatanTemuan.js. Temuan berstatus DITUTUP tidak akan diangkat lagi oleh Engineer. -->

**4 terbuka · 5 ditutup**

## TMN-0001 — DITUTUP
- **Ditutup:** 2026-10-04 — (ternyata sudah benar sejak lahir)
- **Berkas:** `frontend/src/core/runtime/services/engineer.js`
- **Tingkat:** rendah
- **Ditemukan:** 2026-09-24
- **Ringkasan:** Komentar di baris 1035 menyatakan `_generateFallbackPatch` "diekstrak ke ./engineer/PatchGenerator.js", padahal fungsi tersebut sebenarnya dihapus total pada 2026-09-22 (T10), bukan diekstrak — komentar ini menyesatkan.
- **Bukti:** `git grep -n "generateFallbackPatch" -- frontend/src` hanya mengembalikan 2 baris komentar (engineer.js:1035 dan PatchGenerator.js:454), tidak ada definisi fungsi `generateFallbackPatch` yang tersisa di repo.
- **Penutupan:** tidak ada yang perlu dikerjakan — komentarnya **sudah benar**. `engineer.js:1024` kini berbunyi *"`_generateFallbackPatch` dihapus total (T10, …)"*, tepat seperti yang temuan ini minta.
- **Yang menarik:** diperbaiki di `d677e83` — **commit yang sama yang membuat berkas temuan ini**. Jadi TMN-0001 lahir sudah tertutup, lalu tercatat TERBUKA selama sepuluh hari karena tak ada yang memeriksanya ulang. Temuan yang berumur perlu diverifikasi sebelum dikerjakan, bukan sesudah.

## TMN-0002 — DITUTUP
- **Ditutup:** 2026-10-04 — (sempat BERTAMBAH salah lebih dulu)
- **Berkas:** `frontend/src/components/workbench/ConversationEngine.jsx`
- **Tingkat:** rendah
- **Ditemukan:** 2026-10-01
- **Ringkasan:** Komentar baris 63 mengklaim `supabase.from()` "tidak ada lagi" untuk logika bisnis, padahal `supabase.from('chats')` masih dipanggil langsung di baris 381 dan 451 pada berkas yang sama.
- **Bukti:** `git grep -n "supabase.from" -- frontend/src/components/workbench/ConversationEngine.jsx` mengembalikan baris 381 dan 451 yang memanggil `supabase.from('chats').select('*')...maybeSingle()`, sementara baris 63 menyatakan "Tidak ada lagi: fetch(), supabase.from(), kernel.serviceManager.get()".
- **Sempat bertambah salah:** saat ditutup, pemanggilannya bukan dua lagi melainkan **tiga**. Yang ketiga — `supabase.from('project_memory_entries').insert(…)` di baris 822 — ditambahkan 2 Okt oleh `bbfce3a` (Brain 1 bisa ditulis), **ditulis tepat di bawah komentar yang menyangkal keberadaannya**. Komentar yang salah tidak menghalangi apa pun, jadi ia malah menarik pelanggaran baru.
- **Penutupan:** `supabase.from()` dicabut dari daftar "tidak ada lagi", dan ketiga pemanggilannya **didaftar beserta nomor barisnya** supaya penambahan berikutnya terlihat sebagai penambahan, bukan sebagai kejutan.
- **Yang TIDAK dikerjakan, dan sengaja:** memindahkan ketiganya ke `AssistantService`. Ketiganya pembacaan/penulisan baris langsung tanpa logika keputusan; memindahkannya adalah pekerjaan tersendiri, bukan sesuatu yang diselundupkan lewat perbaikan komentar. Komentarnya kini pernyataan **keadaan**, bukan aturan yang dilanggar.

## TMN-0003 — DITUTUP
- **Ditutup:** 2026-10-04 — (keterangannya; fungsinya sengaja dibiarkan)
- **Berkas:** `frontend/src/core/runtime/services/AuditLogService.js`
- **Tingkat:** rendah
- **Ditemukan:** 2026-10-01
- **Ringkasan:** JSDoc `logCommand` di baris 92 menyebut "dari CommandRegistry" yang sudah dihapus, dan fungsi `logCommand` sendiri tidak pernah dipanggil di seluruh frontend/src (fungsi yatim).
- **Bukti:** `git grep -n "logCommand" -- frontend/src` hanya mengembalikan 1 hasil yaitu definisinya sendiri di AuditLogService.js:100, tidak ada pemanggil. Berkas `frontend/src/core/runtime/services/CommandRegistry.js` sudah tidak ada.
- **Diperiksa ulang 4 Okt:** keduanya **masih benar** — tetap satu kemunculan, tetap nol pemanggil, `CommandRegistry.js` tetap tidak ada.
- **Penutupan:** JSDoc-nya diperbaiki pada **dua** hal, bukan satu. Rujukan CommandRegistry dibuang, **dan** keyatiman method ini dinyatakan terang-terangan — tanpa itu pembaca berikutnya akan menyangka eksekusi command sudah tercatat lewat jalur ini, padahal tak satu pun tercatat.
- **Fungsinya SENGAJA dibiarkan hidup**, bukan terlewat: penghapusan permanen menunggu keputusan Owner, dan `this.log()` yang dipakainya tetap terpakai pemanggil lain. Keputusan hapus-atau-sambungkan masih terbuka.

## TMN-0004 — DITUTUP
- **Ditutup:** 2026-10-02 — ditutup dengan tangan
- **Berkas:** `frontend/src/core/runtime/services/engineer.js`
- **Tingkat:** sedang
- **Ditemukan:** 2026-10-01
- **Ringkasan:** Method `upgradeCapability()` (baris 1090) tidak pernah dipanggil dari mana pun di frontend/src, sehingga capability Engineer yang turun ke OBSERVER (akibat circuit breaker atau emergency lockdown) tidak punya jalur reset otomatis maupun manual dari UI.
- **Bukti:** `git grep -n "upgradeCapability" -- frontend/src` hanya mengembalikan satu baris — definisi method itu sendiri di engineer.js:1090 — tanpa satu pun pemanggil.
- **Ternyata lebih buruk daripada bunyi temuan ini.** "Nol pemanggil" adalah akibat, bukan cacatnya. Pencacah di `_handlePatchTask` adalah **pembatas laju** — jendelanya mereset tiap 60 detik, hukumannya tidak. Enam penerapan patch dalam semenit membuat Engineer berhenti menambal **sampai aplikasi ditutup**, tanpa satu pun `emit` yang memberi tahu.
- **Penutupan:** jendela habis → hukuman habis, pulih ke kapabilitas sebelumnya; keduanya bersuara. Tiap demosi mencatat `_sebabDemosi`, karena demosi keamanan (3 percobaan berkas inti) memakai `'OBSERVER'` yang sama dan **sengaja lengket** — pemulihan otomatis tanpa pembeda itu akan mengangkatnya semenit kemudian. Lihat [log](../changelog/2026-10-02-pemutus-arus-engineer.md) dan INDEX item 113.
- **Bukti penutupan:** `uji/uji-pemutus-arus-engineer.mjs` menjalankan kelas `Engineer` yang asli (27 asersi); uji mutasi M1–M4 semuanya menggigit; 74/74 hijau.

## TMN-0005 — DITUTUP
- **Ditutup:** 2026-10-06 — kebijakan DICABUT (bukan diganti), dan ditolaknya anon maupun authenticated dibuktikan bersama uji kendali bahwa service_role tetap bisa menulis
- **Berkas:** `supabase/migrations/ (kebijakan RLS verification_audit_logs)`
- **Tingkat:** tinggi
- **Ditemukan:** 2026-10-05
- **Ringkasan:** Kebijakan INSERT bernama "Service Role can insert verification logs" pada tabel verification_audit_logs menyasar PUBLIC dengan WITH CHECK true, sehingga peran anon (belum login) bisa menyisipkan baris audit palsu. Namanya menyebut service_role, perilakunya tidak. Ini kelas yang sama persis dengan lubang assistant_audit_log yang ditutup 2026-10-04 — kembarannya luput.
- **Bukti:** Simulasi peran di produksi: SET LOCAL ROLE anon lalu INSERT INTO verification_audit_logs (id, timestamp, decision, status, model, score, checks, failures) BERHASIL menyisipkan 1 baris berlabel status=VERIFIED. Penolakan awal hanya datang dari NOT NULL (timestamp, score), bukan dari RLS. pg_policies menunjukkan roles memuat public dan with_check = true.
- **"Belum diperiksa" itu terjawab 6 Okt, dan jawabannya MEMPERBERAT:** tidak ada lapisan di depannya. Repositori `mamet334/mamet-ecosystem` ternyata **PUBLIC**, dan kunci `anon` tertulis apa adanya di `.github/workflows/build.yml:37` bersama alamat proyek di baris 36. Itu normal untuk Supabase — kunci anon memang dirancang publik dan ikut di setiap bundel klien — tetapi justru karena itu **RLS adalah satu-satunya perlindungan**. Jadi lubang ini bukan risiko teoretis: siapa pun yang membuka repo bisa memakainya.
- **Dan separuh rantainya dipasang asisten.** TMN-0005 ditulis lengkap dengan cara memperagakannya lalu di-commit ke repo yang sama, tanpa memeriksa visibilitas repo lebih dulu. Pelajaran: sebelum menuliskan rincian lubang yang MASIH TERBUKA, periksa ke mana tulisan itu terbit.
- **Penutupan (6 Okt):** kebijakan **DICABUT tanpa pengganti**, lewat `supabase/migrations/20261006000000_tutup_insert_publik_verification_audit_logs.sql`. Penulis sahnya hanya `verification_service.ts:86` yang memakai `supabaseServiceKey`, dan service_role **melewati RLS sepenuhnya** — jadi tidak ada kebijakan INSERT yang dibutuhkan. Membuat kebijakan `TO service_role` justru menyesatkan: ia menyiratkan RLS berlaku bagi peran itu, padahal tidak, dan kebijakan yang tak pernah dievaluasi adalah yang akan dipercaya orang berikutnya — persis cara nama "Service Role can insert" menipu selama ini.
- **Bukti penutupan, tiga arah:** `anon` → *"new row violates row-level security policy"*; `authenticated` → ditolak sama; **kendali** `service_role` → BERHASIL 1 baris, jadi pencatatan yang sah tidak ikut mati. Seluruh uji di dalam transaksi yang dibatalkan; diperiksa sesudahnya, nol baris uji tertinggal.
- **Tidak ada bukti lubang ini pernah dipakai orang lain:** dari 713 baris, hanya **1** tanpa `user_id` — baris buatan asisten (TMN-0008) — dan cuma 2 model unik. Disebut "tidak ada bukti", bukan "pasti tidak": penyerang yang cermat akan mengisi `user_id`.
- **Kebijakan SELECT sengaja tidak disentuh** (`USING auth.uid() = user_id`): syaratnya benar, dan dasbor membacanya lewat jalur itu (`useDashboardData.js:116`).

## TMN-0006 — TERBUKA
- **Berkas:** `docs/project-memory/temuan-engineer/TEMUAN-ENGINEER.md`
- **Tingkat:** tinggi
- **Ditemukan:** 2026-10-05
- **Ringkasan:** Berkas temuan ini TIDAK TERBACA oleh kodenya sendiri. IngatanTemuan.js mengurai judul dengan /^## (TMN-\d{4}) — (TERBUKA|DITUTUP)[ \t]*$/gm yang menuntut bentuk persis, sedangkan judul yang tersimpan berbunyi "## TMN-0001 — ✅ DITUTUP 2026-10-04 (…)". Akibatnya nol temuan terbaca: janji "temuan berstatus DITUTUP tidak akan diangkat lagi" berlaku hampa, dan temuan yang benar-benar TERBUKA pun tak akan pernah sampai ke Engineer.
- **Bukti:** bacaBerkasTemuan() dari IngatanTemuan.js dijalankan terhadap berkas sungguhan: mengembalikan 0 temuan, sementara berkasnya memuat 4 judul TMN-. Kepala berkas sendiri menyatakan "bentuk di bawah yang dibaca kembali oleh IngatanTemuan.js".
- **Diperbaiki sebagian 5 Okt:** keempat judul dinormalkan kembali ke bentuk yang diurai, keterangannya dipindah ke ruas **Ditutup** yang memang dibaca.
- **SEBAB ASLINYA KETAHUAN, dan lebih buruk dari dugaan:** `uji/uji-komentar-tak-berbohong.mjs` ternyata MENEGAKKAN bentuk yang rusak — ia menuntut `/✅ DITUTUP/` di judul, persis bentuk yang tak bisa diurai. Jadi uji hijau menyatakan berkasnya benar sementara kodenya membaca nol. Uji dan pengurai berselisih berhari-hari, dan ujinya yang menang. Asersi keduanya lebih buruk lagi: `!/TERBUKA/` memaku "nol temuan terbuka" sebagai kebenaran abadi, sehingga MENCATAT temuan nyata selalu membuat uji merah — uji yang menghukum pencatatan temuan.
- **Diperbaiki 5 Okt:** asersi diganti menjadi *"semua judul bisa diurai IngatanTemuan.js"* (regex yang sama persis dengan penguraiannya), ditambah penjaga bahwa yang DITUTUP menyebut sebabnya dan penghitung kepala cocok dengan isinya. Tiga mutasi menggigit — Q1 (satu judul kembali ke bentuk lama) menjatuhkan 2 asersi, yakni cacat yang tadi ada.
- **Yang TERSISA:** `IngatanTemuan.js` sendiri masih **diam** ketika penguraian menghasilkan nol dari berkas yang jelas berisi. Uji kini menjaga berkasnya, tetapi kodenya tetap tidak bersuara bila bentuknya rusak lagi lewat jalan lain.

## TMN-0007 — TERBUKA
- **Berkas:** `supabase/functions/agent-process/lib/verification/verification_pipeline.ts`
- **Tingkat:** sedang
- **Ditemukan:** 2026-10-05
- **Ringkasan:** Empat berkas (368 baris) tidak diimpor di mana pun — verification_pipeline.ts (270 baris), post_processing.ts (88), citation_parser.ts (5), grounding_parser.ts (5). Semuanya ikut dibundel ke edge function tiap deploy. Yang 270 baris paling berbahaya: ia mengimpor tujuh modul nyata dan tidak punya penanda usang, sehingga TAMPAK sebagai jalur verifikasi yang aktif.
- **Bukti:** Pemindaian 245 berkas sumber + 90 berkas uji: nama berkasnya tidak disebut di satu pun berkas lain (0 pengimpor untuk keempatnya). citation_parser.ts menyebut dirinya "Stub for future extraction" dan mengembalikan [].
- **Preseden di repo ini:** TaskHandlers.js menghapus 219 baris kode mati SESUDAH dibuktikan mati, dan mencatat alasannya: "kode mati yang lengkap dan rapi TAMPAK hidup; 28 September ia menipu asisten sendiri."
- **Izin Owner belum diberikan.** Pilihan yang diajukan: hapus, atau beri penanda usang lebih dulu.

## TMN-0008 — TERBUKA
- **Berkas:** `public.verification_audit_logs (baris data, bukan kode)`
- **Tingkat:** sedang
- **Ditemukan:** 2026-10-05
- **Ringkasan:** Satu baris palsu tertinggal di tabel produksi akibat pembuktian TMN-0005. Blok DO dikira dibatalkan, padahal execute_sql meng-commit otomatis. Barisnya tidak merusak apa pun selain mengotori log audit, tetapi membiarkannya berarti meninggalkan bukti palsu di dalam log audit.
- **Bukti:** id = 240bc19f-8a65-438e-8861-8216761b0609, decision = PALSU-OLEH-ANON, status = VERIFIED, model = bukan-model-sungguhan, timestamp = 2026-10-05 06:12:35 UTC. Terbaca dengan SELECT pada tabel produksi.
- **Dibuat oleh asisten, bukan oleh sistem.** Penghapusannya menunggu izin Owner (penghapusan permanen di produksi adalah hak Owner).

## TMN-0009 — TERBUKA
- **Berkas:** `frontend/electron/main.cjs`
- **Tingkat:** sedang
- **Ditemukan:** 2026-10-05
- **Ringkasan:** Tiga kelonggaran pada cangkang Electron, yang satu berupa konfigurasi yang membantah dirinya sendiri. (1) `app.commandLine.appendSwitch('no-sandbox')` di baris 6 mematikan sandbox renderer secara global, sementara `sandbox: true` di webPreferences baris 148 menyatakan sebaliknya — sakelar baris perintah yang menang, jadi pembaca yang mengaudit webPreferences akan menyimpulkan renderer ber-sandbox padahal tidak. (2) `webSecurity: false` mematikan same-origin policy. (3) Tidak ada `will-navigate` maupun `setWindowOpenHandler`; tanpa yang kedua, jendela dari `window.open()` MEWARISI preload, berarti mewarisi `window.electronAPI.engineer.jalankan`.
- **Bukti:** `grep -n "contextIsolation\|nodeIntegration\|sandbox\|webSecurity" frontend/electron/main.cjs` menunjukkan baris 6 `no-sandbox`, baris 148 `sandbox: true`, baris 149 `webSecurity: false`. `grep -n "will-navigate\|setWindowOpenHandler"` pada berkas yang sama: nol hasil. `shell` diimpor di baris 1 tetapi `openExternal` tidak dipakai di mana pun.
- **BELUM jadi lubang hidup, dan sebabnya diperiksa bukan diasumsikan:** tidak ditemukan jalan masuk ke konten jauh dari dalam aplikasi. `react-markdown` ada di package.json tetapi TIDAK dipakai sama sekali di frontend Ecosystem (hanya di `mametlite`, aplikasi web terpisah tanpa preload), sehingga jawaban model dirender sebagai simpul teks React yang di-escape otomatis — tanpa `<a href>`, tanpa HTML. `dangerouslySetInnerHTML` di `FileExplorer.jsx:424` juga diperiksa dan AMAN: penyorotnya meng-escape tiap segmen dan hanya menerbitkan `<span>` untuk kata kunci dari himpunan tetap.
- **Kenapa tetap dicatat:** ketiganya pertahanan berlapis yang hilang, dan jaraknya ke "hidup" hanya satu fitur. Begitu jawaban model dirender sebagai markdown di Ecosystem, atau ada tautan yang bisa diklik, rantainya tersambung — dan saat itu ketiganya bekerja bersama.
- **Perbaikan yang TIDAK merugikan apa pun:** `disable-gpu-sandbox` di baris 7 sudah cukup untuk masalah GPU yang jadi alasan baris 6; `no-sandbox` adalah kelebihan tangkap. Menambah `setWindowOpenHandler` yang menolak semua, dan mengarahkan tautan luar ke `shell.openExternal`, keduanya murah.
- **Yang SEHAT dan jangan ikut diubah:** lapisan perintahnya sendiri kokoh — tanpa shell (dipecah per spasi, jadi `;`/`&&`/pipa tak bisa menyisip), daftar izin 21 program dengan `cmd`/`powershell`/`bash`/`sh`/`rm`/`curl`/`wget`/`ssh` ditolak mentah di `alatFolderJalan.cjs:306`, jalan-sendiri hanya untuk git baca-saja, batas keluaran 20 KB dan waktu 300 s, serta `tanpaInternet: true` pada profil engineer.
- **Catatan rancangan, bukan cacat:** `node`, `python`, dan `npm` SENGAJA ada di daftar izin, jadi sesudah Owner menekan izin, kode karangan model berjalan penuh. Dialog izin adalah SATU-SATUNYA yang berdiri antara kode karangan model dan eksekusi — bukan daftar program, bukan pagar folder. Itulah sebab uji `node -e` (lihat 4.2.13 butir 4) bukan formalitas, dan sebab daftar jalan-sendiri harus tetap sesempit sekarang.
