# Changelog — Mamet Lite

Riwayat perubahan khusus untuk deployment `mametlite.vercel.app`. Untuk perubahan di sisi backend bersama (`agent-process`), lihat juga `docs/project-memory/changelog/` di root repo — entri di sana yang menyentuh Mamet Lite akan disebut silang di sini.

---

## 0.1.0 — 2026-10-07/08 — Mamet Lite digarap untuk penggunanya

**Versi pertama yang benar-benar diberi nomor.** Sebelum ini `package.json` berisi `0.0.0` bawaan
perancah Vite sejak hari pertama, jadi tidak ada cara menunjuk *"build yang mana yang sudah berisi
perbaikan ini"*. Nomornya tidak dibaca kode mana pun — ia untuk manusia, dan untuk memberi entri
changelog ini sesuatu untuk dijangkarkan.

> **Changelog ini sendiri sudah tertinggal 22 commit** saat entri ini ditulis — berhenti di 8
> September padahal `mametlite/` terus berubah. Itu bagian dari apa yang diperbaiki di sini: aplikasi
> yang punya pengguna di luar Owner tidak boleh riwayatnya hanya ada di `git log`.

Lahir dari permintaan Owner: *"upgrade dan stabilkan untuk mamet ecosystem ini. lihat kode yang ada
dari awal hingga akhir siap di sajikan untuk user."* Rancangan & sisa pekerjaannya di
[`docs/roadmap/ROADMAP-SIAP-PENGGUNA.md`](../docs/roadmap/ROADMAP-SIAP-PENGGUNA.md) (item 125).

### 🔒 Keamanan

**Penyuntikan HTML dihapus — bukan ditambal** ([log](../docs/project-memory/changelog/2026-10-07-mametlite-berhenti-menyuntikkan-html.md))
Parser Markdown membangun string HTML lalu menyuntikkannya dengan `dangerouslySetInnerHTML`, dan
pelolosannya memakai daftar putih tag yang alternatif `a`-nya panjangnya **satu huruf** — jadi setiap
tag yang namanya mulai "a" lolos **beserta atributnya**: `<audio src=x onerror=…>`, `<animate>`.
Di origin ini `localStorage` menyimpan kunci OpenRouter Anda.
Arahan Owner: *"jangan hanya di tambal. tapi digunakan logikanya dengan semestinya."* Jadi
penguraiannya kini menghasilkan **data** (`lib/markdown.js`) dan React yang merender
(`lib/TeksKaya.jsx`). Tanpa penyuntikan, tak ada daftar putih yang perlu dijaga benar.

**CSP + 4 header keamanan** — `mametlite/vercel.json` **baru**; sebelumnya nol header. Dan
`vite.config.js` membacanya dari berkas yang sama, jadi `npm run dev`/`preview` memakai CSP yang
**sama dengan produksi** — pelanggaran muncul di konsol kita, bukan di peramban pengguna.

**pdf.js bisa menjalankan JavaScript dari PDF yang diunggah** ([log](../docs/project-memory/changelog/2026-10-08-pdfjs-eksekusi-js-dari-pdf.md))
`pdfjs-dist` GHSA-hq66-cqwq-w95j, rentang rentan `>=5.6.83 <6.2.108`; terpasang `^6.0.227`.
Membuka PDF adalah fungsi utama aplikasi ini. Dinaikkan ke `^6.4.299`.

### 💥 Tidak lagi bisa jadi layar putih

([log](../docs/project-memory/changelog/2026-10-08-mametlite-tidak-lagi-layar-putih.md))
Satu nilai `localStorage` rusak → `JSON.parse` melempar saat render → **layar putih yang kembali
setiap muat ulang**, tanpa jalan keluar. Kini riwayat lewat satu pintu (`lib/riwayatLokal.js`) yang
memeriksa **bentuknya** (bukan hanya JSON-nya) dan tidak pernah melempar, ditambah error boundary
dengan tombol yang menghapus **hanya riwayat** — kunci OpenRouter Anda tidak disentuh.
Penyimpanan juga tidak lagi menulis seluruh riwayat **tiap token** jawaban.

### 📱 Bisa dipakai dari HP

([log](../docs/project-memory/changelog/2026-10-08-mametlite-dari-hp.md)) — menutup Item 72.
Sebelumnya **0 dari 102** `className` punya prefiks responsif, dan bilah sisi `w-80` menyisakan
**±55px** untuk chat di layar 375px. Kini bilah sisi jadi laci di layar kecil (tombol ☰, ✕, lapisan
gelap, dan menutup sendiri saat percakapan dipilih), `h-screen` → `h-dvh` supaya bilah masukan tidak
tertimpa chrome iOS, label tiga mode mengalah jadi ikon, dan **tiga kendali yang dulu hanya muncul
saat hover** (hapus dokumen, hapus chat, salin) kini terjangkau sentuhan.
Di layar lebar tidak ada yang berubah.

### 💬 Pesan galat memakai bahasa Anda

([log](../docs/project-memory/changelog/2026-10-08-mametlite-bicara-bahasa-penggunanya.md))
Dulu yang muncul adalah teks server apa adanya — `❌ Error: ENGINEER_NO_API_KEY`,
`❌ Error: Failed to fetch` — dan galat masuk berupa kotak sistem berbahasa Inggris.
Kini judul + **tindakan** + pesan teknis kecil untuk pelaporan. Galat yang tandanya tidak dikenali
diberi pesan **umum**, bukan tebakan yang terdengar yakin.
Ikut diperbaiki: gelembung jawaban kosong yang tertinggal saat jawaban gagal di tengah jalan, dan
**hapus percakapan kini bertanya dulu** (hapus dokumen sudah bertanya sejak dulu).

### 🧹 Kerapian

([log](../docs/project-memory/changelog/2026-10-08-mametlite-sisa-perancah-vite.md))
`src/App.css` (184 baris, nol pengimpor) dihapus — dan ia memuat **satu-satunya** `@media` di proyek
ini, jadi pembacanya akan menyangka aplikasi ini sudah responsif. Ikut dibersihkan: 4 aset dan 4
dependency tak terpakai. README template Vite diganti dengan README sungguhan, `lang="en"` → `"id"`,
judul tab → "Mamet Lite", kelas `custom-scrollbar` akhirnya **didefinisikan**, dan `.env.example`
ditambahkan — nama variabel lingkungannya dulu tidak tercatat di mana pun.

### ✅ Penjaga baru

Enam berkas uji baru di `uji/` (penguraian Markdown, riwayat lokal, tata letak HP, pesan galat,
penjaga tiga berkas salinan, dan jalur baca PDF). Tiap satu **dibuktikan menggigit** dengan mutasi
sengaja — bukan sekadar lulus.

### Diketahui, belum dikerjakan

- **Belum ada pendaftaran & reset kata sandi** dari UI; akun dibuat di luar aplikasi (M6).
- Riwayat chat masih hanya di peramban ini — bersih-data menghapusnya, dan tidak ada salinan lintas
  perangkat.

---

## 2026-09-08 — Fix: Request Mamet Lite Ditolak dengan `ENGINEER_NO_API_KEY`

**Status:** ✅ Diperbaiki & Diverifikasi via log Supabase live

### Gejala
User Mamet Lite (`slametbro798@gmail.com`) mengirim pertanyaan biasa ("siapa nama panggilan saya?") dan mendapat:
```
Error: ENGINEER_NO_API_KEY
POST .../functions/v1/agent-process → 403 (Forbidden)
```
Sudah dicoba logout–login ulang (memastikan sesi fresh), error tetap muncul secara konsisten.

### Investigasi
1. Bundle production (`index-B4sM2kNV.js`) dicek langsung — dikonfirmasi frontend mengirim payload benar: `appSource: "mametlite"`, tanpa field `mode`. Tidak ada jejak string "ENGINEER" di frontend sama sekali.
2. Deployment drift Edge Function dicek (`deploy_commit_sha` vs git HEAD) — tidak ada drift kode yang relevan.
3. Log Supabase (`function_logs`) untuk request yang gagal dibaca langsung. Ditemukan bukti definitif:
   ```json
   "user_metadata": { "app_source": "engineer", ... }
   ```
   Akun ini (dan bahkan akun Owner sendiri, `andreanastasya798@gmail.com`) tersimpan tag `app_source: "engineer"` di level Supabase Auth — kemungkinan tersisa dari sesi testing lama, tidak pernah dibersihkan.

### Root Cause
`supabase/functions/agent-process/lib/request/request_parser.ts` (kode bersama, dipakai semua aplikasi — Assistant, Engineer, Mamet Lite) punya urutan prioritas terbalik:
```ts
// SEBELUM (bug):
const resolvedAppSource = jwtAppSource ?? (ALLOWED_CLIENT_SOURCES.includes(clientAppSource) ? clientAppSource : 'assistant');
```
`user_metadata.app_source` (tag di akun) **selalu menang** dibanding `appSource` yang dikirim aplikasi pemanggil. Ini aman selama satu akun cuma dipakai satu aplikasi — tapi rusak begitu satu akun Supabase dipakai lintas-aplikasi (Owner pernah pakai akun ini untuk tes Engineer, tag itu menempel permanen, lalu akun yang sama dipakai login ke Mamet Lite → backend memaksa `appSource: "engineer"` walau Mamet Lite sudah benar mengirim `"mametlite"`).

Ditemukan juga masalah kedua saat investigasi (belum tentu penyebab error ini, tapi berisiko biaya): payload Mamet Lite tidak pernah mengirim field `provider`, sehingga `request_pipeline.ts` default ke `'openrouter'` — user Mamet Lite tanpa BYOK key diam-diam memakai `OPENROUTER_API_KEY` milik Owner di server, bukan kuota gratis Gemini yang dimaksud (`model: 'gemini-2.5-flash'`).

### Perbaikan
1. **`request_parser.ts`** — balik urutan prioritas: `appSource` yang dikirim client (divalidasi terhadap allow-list, kini termasuk `'engineer'`) selalu menang; `user_metadata.app_source` cuma fallback kalau client tidak kirim nilai yang dikenali.
2. **`mametlite/src/lib/callAgentSimple.js`** — tambah `provider: 'gemini'` eksplisit di payload, sesuai `model: 'gemini-2.5-flash'` yang sudah diminta.

### Verifikasi
- Log Supabase real digunakan untuk konfirmasi root cause (bukan tebakan) — lihat detail investigasi di atas.
- Build `mametlite` diverifikasi bersih pasca-perbaikan.
- Edge Function `agent-process` di-deploy ulang; retest live oleh Owner setelah deploy.

### Catatan untuk ke Depan
Bug ini adalah **cross-app metadata pollution** — risiko struktural selama arsitektur mengizinkan satu akun Supabase dipakai untuk >1 aplikasi bermakna berbeda (Owner main app vs Mamet Lite publik). Kalau ada akun lain yang pernah dipakai "coba-coba" fitur Engineer sebelumnya, akun itu punya risiko sama sampai fix ini di-deploy. Pertimbangkan jangka panjang: pisahkan sepenuhnya user pool antara Mamet OS (Owner) dan Mamet Lite (publik), atau tambahkan mekanisme pembersihan `user_metadata.app_source` yang stale.
