# ROADMAP: TAMPILAN MENU GAME — MAMET ECOSYSTEM

**Tipe Dokumen:** Rancangan (blueprint) perubahan UI — memenuhi syarat tata kelola MUS §20 (tujuan,
ruang lingkup, dokumentasi, analisis, alasan, persetujuan Owner)
**Item:** 127
**Status:** 🟡 **Tahap 0 ✅ · Tahap 1 langkah 1–4 ✅ (langkah 5 diparkir) · Tahap 2a ✅ · 2b ✅ — 19 Okt.**
**Berikutnya: 2c uji inventaris.** K1 dan K3 diputuskan Owner 19 Okt (graf terbuka di panel; fondasi dulu);
K2, K4, K5, K6 baru dibutuhkan di Tahap 3.
**Tanggal:** 2026-10-19
**Aplikasi:** **Mamet Ecosystem** (`frontend/`) — **bukan** Mametlite.
**Batas tegas:** **`LampLogin.jsx` tidak diubah** dalam pekerjaan ini (arahan Owner 19 Okt). **Face Mamet
tidak dipakai** — desain berbeda (arahan Owner 19 Okt).

> **Revisi 2 menggantikan seluruh revisi 1.** Revisi 1 merancang lobi dengan ruangan hidup dan tokoh yang
> berjalan — itu **salah tafsir**: konsepnya ternyata meniru Face Mamet. Arah yang benar diperoleh lewat
> diskusi dengan gambar referensi Owner (§1).

---

## 1. Permintaan Owner — dan bagaimana tafsirnya dikunci

| Urutan | Kata Owner | Yang dipelajari |
|---|---|---|
| 1 | *"mengubah tampilan mamet ecosystem tidak seperti hasil generet ai. buat seperti tampilan game kecuali tampilan login"* | tujuan: berhenti terasa generik |
| 2 | *"maksudnya seperti tampilan home sebuah game"* | layar menu, bukan dasbor |
| 3 | *"bukan karakter game yang berjalan. ini lebih ke lobi game yang belum mulai"* | **tanpa tokoh, tanpa dunia yang hidup** |
| 4 | *"main menu game lost in darkness tapi lebih samakan konsepnya ke lamplogin.jsx yang pakai ruangan"* | suasana menu horor; **ruangannya ruangan LampLogin** |
| 5 | gambar referensi: *Unity — Horror Game Menu* (ArtStation) | susunan yang tepat (di bawah) |
| 6 | *"apakah harusnya mempunyai halaman sendiri, bukan saat ini yang masih menumpuk?"* | **satu halaman pada satu waktu** — ini yang membuat item ini menyentuh arsitektur, bukan hanya kulit |
| 7 | *"standart internasional aplikasi asisten … tanpa kehilangan suatu fungsi"* | kerangka standar + **inventaris fungsi** sebagai uji penerimaan |

**Susunan gambar referensi (nomor 5):** ruangan gelap; **satu bola lampu filamen** menyala sebagai
satu-satunya sumber cahaya; **LOGO** kiri atas; **menu teks polos di kiri** (VIDEO · AUDIO · CONTROLS ·
BACK); **panel gelap tembus pandang di kanan** berisi isi menu yang dipilih (baris pengaturan + kotak
pilihan, lalu **Reset · Apply**); lampu tetap menyala **di belakang** panel.

**Kecocokannya dengan `LampLogin.jsx` hari ini:** ruangan kayu gelap · lampu gantung di tengah atas ·
"MAMET / OS / ECOSYSTEM" bercahaya krem di kiri · formulir di kanan yang diterangi lampu. **Susunannya
sudah sama.** Menu utama = ruangan yang sama sesudah masuk: formulir di kanan berganti menjadi panel isi
menu, dan di bawah judul di kiri muncul daftar menu.

### Layar masuk yang tampil adalah `LampLogin.jsx`, bukan `Login.jsx`

`App.jsx:46` merender `LampLogin`. `Login.jsx` (152 baris) **tidak diimpor di mana pun** sejak 14 Juli
(`3e5aaab`) — kode mati, dicatat di K6; tidak disentuh item ini.

---

## 2. Masalahnya ada dua lapis

### 2.1 Lapis kulit — kenapa terasa "hasil generate AI"

Diukur 19 Okt pada 46 berkas `.jsx`:

| Ciri | Kemunculan · berkas |
|---|---|
| Token warna gaya Material 3 (**47 token** di `tailwind.config.js`, mis. `surface-container-lowest`) | 568 · 16 |
| Warna mentah `slate-*` yang melewati token itu | 615 · 29 |
| Aksen pelangi `emerald/cyan/violet/indigo/purple` | 250 · 31 |
| Dua set ikon: `lucide-react` + Material Symbols | 27 + 8 berkas |
| Gerak dekoratif `animate-pulse/ping/spin` | 52 · 22 |
| Kaca & cahaya: `backdrop-blur` · bayangan glow · gradien | 15 · 37 · 19 |

Akar masalahnya bukan kurang hiasan, tetapi **tidak ada satu dunia**: tiap layar lahir sendiri lalu
ditempeli resep visual paling umum. `LampLogin.jsx` memakai nol dari semua itu — ia punya tempat (ruangan)
dan bahan (kayu, cahaya lampu) — dan ia satu-satunya layar yang tidak terasa generik.

*Catatan jujur:* `LampLogin` sendiri memakai huruf mono kapital bercahaya untuk judulnya. Yang generik
bukan hurufnya, tetapi pemakaiannya sebagai hiasan di mana-mana tanpa dunia. Angka di atas hanya wakil;
hakim terakhirnya mata Owner.

### 2.2 Lapis susunan — kenapa terasa "menumpuk"

**Tumpukan tak terlihat — 11 aplikasi hidup bersamaan.** `Kernel.js:611-622` mendaftarkan 11 aplikasi
dari `public/metadata/system.json`, dan `ApplicationContainer.jsx` **merender semuanya sekaligus**; yang
tidak aktif hanya diberi `hidden` (komentar di kodenya: *"We do NOT unmount"*). Tiga di antaranya adalah
**tiga salinan `ConversationEngine.jsx` (2.506 baris)** — Assistant, Mametlite, Engineer — berjalan
bersamaan walau hanya satu yang dipakai. **Diukur di Tahap 0:** 86% simpul DOM milik layar yang tidak
dilihat, pendengar event berlipat tiga — tetapi kerja latar saat diam praktis nol (§7 Tahap 0 butir 7).

**Kenapa ditumpuk:** keadaan chat disimpan **di dalam layar** — 27 `useState` di `ConversationEngine.jsx`,
termasuk `messages` (`:166`). Jawaban yang mengalir ditulis langsung ke layar oleh `onChunk` · `onDone` ·
`onError` (`:1332`, `:1346`, `:1398`). Menutup layar = jawaban yang sedang mengalir, ketikan yang belum
terkirim, dan posisi gulir hilang (riwayatnya sendiri aman di tabel `chats`). **Tumpukan itu tambalan**
supaya keadaan tidak hilang. Tidak ada layanan penyimpan sesi chat di mana pun — yang ada hanya fungsi
pembantu murni (`pemulihanChat.js`, `pengirimanChat.js`, `KonteksChat.js`).

**Pelajaran yang sudah dibayar mahal — `pengirimanChat.js` (28 Sep):** Owner bertanya di percakapan baru,
lalu mengklik riwayat lain sambil menunggu; jawabannya masuk ke percakapan yang sedang dibuka dan
percakapan barunya hilang. Perbaikannya: **jawaban milik percakapan yang BERTANYA, bukan yang sedang
dilihat** — lewat penanda kiriman (`buatPenandaKiriman`, `tujuanTulis`, `pesanTerlantar`). Tahap 1
menyentuh wilayah yang persis sama, jadi ia **dibangun di atas penanda itu**, bukan menggantinya.

**Tumpukan terlihat — panel samping yang terbuka permanen.** Zona kiri/kanan/bawah `AppShell` **kosong**
secara bawaan di keempat workspace (`workspace.json`) — jadi bukan dari sana. Yang memakan lebar adalah
layar chat sendiri:

| Bagian | Lebar | Bawaan |
|---|---:|---|
| Bilah ikon aplikasi (`OSDesktopShell` `ml-16`) | 64px | selalu |
| Riwayat chat (`ConversationEngine.jsx:1596` `w-64`) | 256px | tertutup (`:178`) |
| **Memory Context** (`MemoryContextPanel.jsx:281` `w-80`) | **320px** | **TERBUKA** (`:184` `useState(true)`) |
| Zona kanan `AppShell` — **Monitor MAEF** dibuka ke sini | 350px | tertutup; dibuka tombol chat (`:245`) dan "Buka nalar di Right Workbench" (`:221`) |

Di layar Owner (1366px): kolom chat **±982px** dalam keadaan bawaan, **±726px** bila riwayat dibuka,
**±632px** bila Monitor MAEF dibuka bersama Memory Context.
Owner sudah menyatakan (16 Okt): *"ui mamet ecosystem saja dengan layar penuh saya masih cukup sulit untuk
berinteraksi."*

---

## 3. Standar internasional — dipakai hanya bila cocok

### 3.1 Pola bersama aplikasi asisten (ChatGPT, Claude, Gemini, Copilot)

| Bagian | Pola |
|---|---|
| Riwayat | bilah kiri yang bisa dilipat; akun & pengaturan di bawah |
| Percakapan | **satu kolom baca di tengah**, lebar dibatasi (±700–770px), **tidak pernah dibelah** |
| Kotak ketik | di bawah; model, lampiran, alat **di dalamnya** |
| Panel samping | **muncul saat dibutuhkan**, lalu ditutup — tidak ada kolom permanen |
| Aksi pesan | salin, ulangi, 👍/👎 saat kursor di atas pesan |
| Pengaturan | **halaman bertab: daftar kiri, isi kanan** — susunan yang sama dengan gambar referensi Owner |
| Jawaban berjalan | **terus berjalan saat pindah halaman**, karena keadaannya di luar layar |

### 3.2 Pedoman resmi di baliknya

- **ISO 9241-110** — sesuai tugas, menjelaskan diri, sesuai harapan, mudah dipelajari, bisa dikendalikan,
  tahan salah pakai.
- **Microsoft HAX (18 pedoman interaksi manusia-AI)** — jelaskan apa yang bisa dilakukan sistem *dan
  seberapa baik*; informasi sesuai konteks; mudah dikoreksi; jelaskan kenapa. Label `[STATUS: …]` Mamet
  sudah menerapkan "seberapa baik".
- **WCAG 2.2** — kontras teks ≥ **4,5:1**, semua bisa dengan keyboard, fokus terlihat, hormati
  pengurangan gerak. **Wajib diukur** pada tema gelap ini: panel tembus pandang di depan cahaya lampu
  menurunkan kontras.

### 3.3 Penilaian kecocokan

| Diambil | Tidak diikuti — dan alasannya |
|---|---|
| kolom baca tunggal; riwayat yang bisa dilipat; panel saat dibutuhkan; pengaturan bertab; keadaan di luar layar; WCAG | **melipat nalar model** — Owner memutuskan nalar `<think>` **tetap tampil terbuka** gaya DeepSeek (`ConversationEngine.jsx:1972`) |
| | **kulit standar** — justru sumber rasa "hasil AI" (token Material 3 dipakai mentah) |

**Rumusnya: standar untuk kerangka dan perilaku; ruangan LampLogin untuk kulitnya.**

---

## 4. Batasan konstitusi

| Sumber | Akibat bagi rancangan |
|---|---|
| **MUS §4.2** State Driven | tidak ada informasi karangan; "Lanjutkan" hanya muncul bila memang ada percakapan terakhir |
| **MUS §4.5–4.6, §19** sederhana, minim distraksi | **tanpa gerak dekoratif**; gerak hanya sebagai umpan balik (sorotan pilihan, transisi masuk) |
| **MUS §11** Shared Sidebar — struktur utama tetap | menu kiri **adalah** bilah samping itu; strukturnya diambil dari metadata, tidak disusun ulang |
| **MUS §20** UI Governance | dokumen ini; tidak ada kode sebelum §9 diputuskan |
| **MUS §21** Metadata Driven | menu **dibangkitkan dari** `public/metadata/navigation.json` + `NavigationService` (`isAvailable`) |
| **25 Design Philosophy #1, #10, #11** | akar masalah (keadaan di dalam layar) diperbaiki, bukan ditutupi dengan menyembunyikan layar |
| **23_HOME_DASHBOARD_SPEC** — Home = graf pengetahuan | **dipatuhi tanpa amandemen** — graf adalah halaman pertama sesudah masuk (K1 = B, diputuskan Owner 19 Okt) |

---

## 5. Rancangan

### 5.1 Ruangan sebagai kerangka tetap

Sesudah masuk, Owner tetap di **ruangan yang sama dengan layar masuk**: dinding kayu gelap, lampu gantung
menyala. Ruangan ini **latar seluruh aplikasi**, bukan satu layar. Palet diambil **dari `LampLogin.jsx`**,
bukan dikarang: kayu `#3a2113`/`#63391d`, hampir-hitam `#0b0806`, cahaya lampu `rgba(255,191,88,…)`, teks
krem `#fff8ec`. Satu warna untuk "perlu perhatian", satu untuk galat — tidak lebih.

**Tanpa aset luar.** Ruangan dan lampu digambar SVG seperti `LampLogin`. Tidak ada sprite, foto, atau
paket aset yang perlu diperiksa lisensinya.

**Utang yang disengaja:** karena `LampLogin.jsx` tidak boleh diubah, ruangan aplikasi digambar sebagai
**komponen baru** yang meniru geometri dan paletnya — bukan diambil dari `LampLogin`. Ini **dua sumber
untuk satu ruangan**. Dicatat sebagai sisa pekerjaan: menyatukannya sesudah Owner mengizinkan `LampLogin`
disentuh. Sampai itu, uji penjaga membandingkan konstanta palet keduanya.

### 5.2 Menu teks di kiri — bertingkat seperti menu game

```
            💡

 MAMET
 OS
 ECOSYSTEM

 ▸ Lanjutkan                 ← percakapan terakhir (hanya bila ada)
   Beranda
   Workspace       ▸         → Assistant · Mametlite · Engineer · ‹ Kembali
   Data & Kapabilitas ▸      → Knowledge · Memory · Agent Forge · File · ‹ Kembali
   Observabilitas  ▸         → Kernel · Billing · ‹ Kembali
   Pengaturan      ▸         → 9 bagian pengaturan · ‹ Kembali
   Keluar
```

- **Struktur diambil dari `navigation.json`** (Beranda · Workspace · Data & Capability · System
  Observability · Settings) — MUS §11 dan §21 terpenuhi tanpa menyusun ulang apa pun.
- **Sub-menu menggantikan menu utama** di tempat yang sama, dengan "‹ Kembali" di bawah — persis gambar
  referensi (VIDEO · AUDIO · CONTROLS · **BACK**). Ini tumpukan halaman yang diterapkan pada menu.
- **"Lanjutkan"** memakai keadaan nyata: `currentChatId` per workspace sudah disimpan di `localStorage`
  (`mamet_v4_${wsId}_current_chat_id`, `ConversationEngine.jsx:340`).
- Sorotan pada pilihan yang ditunjuk = **umpan balik**, bukan hiasan.

### 5.3 Panel isi di kanan — satu halaman pada satu waktu

Memilih menu = membuka **satu halaman** di panel kanan. Panelnya gelap dan sedikit tembus pandang, seperti
referensi, **tanpa efek kaca-blur**. Tingkat tembusnya ditentukan oleh **uji kontras WCAG**, bukan selera.

**Lebar mengikuti pekerjaan:**

- **Halaman pengaturan dan daftar** (Settings, Billing, Kernel): panel selebar referensi, menu tetap
  terlihat penuh.
- **Halaman kerja** (chat, Knowledge, Memory, File): menu kiri **menyusut menjadi deretan ikon tipis**,
  panel **melebar**. Ruangan dan lampunya tetap terlihat di tepi. **Kolom baca chat dibatasi ±768px
  (`max-w-3xl`, sudah dipakai kotak ketik `:2390`) dan ditengahkan — tidak ada kolom permanen di
  sebelahnya.**

**Pengaturan menjadi halaman bertab**, persis gambar referensi: 9 bagian `Settings.jsx` hari ini (AI Model
Management · API Key · Adaptive Model Tiering · Batas Biaya Harian · Pembaruan Aplikasi · Aplikasi Desktop
· Tools & Capabilities · Tool Registry · User Identity) menjadi sub-menu kiri; isi bagian di panel kanan,
**Reset · Terapkan** di bawah bila bagian itu punya perubahan yang bisa dibatalkan.

---

## 6. Inventaris fungsi — uji penerimaan

**Aturannya:** setiap fungsi yang tampil hari ini punya satu baris dan **tempat baru**. **Baris tanpa
tempat baru = desain belum selesai.** Disusun dari kode 19 Okt dan **dilengkapi di Tahap 0** (semua halaman
yang terjangkau).

### 6.0 Yang TIDAK masuk inventaris — tidak terjangkau dari layar

Inventaris hanya mendaftar yang benar-benar tampil; kode mati yang ikut didaftar akan menjadi uji
penerimaan yang salah sasaran. Diperiksa 19 Okt (impor di seluruh `src/`):

| Komponen | Baris | Keadaan | Terakhir disentuh |
|---|---:|---|---|
| `components/Login.jsx` | 152 | **tak diimpor** — layar masuk yang tampil adalah `LampLogin` | `3e5aaab` 14 Jul |
| `components/EngineerChat.jsx` | 227 | **tak diimpor** — sisa jalur desktop lama | `ed19ba1` 15 Sep |
| `components/os/ActivityBar.jsx` | 91 | **tak diimpor** | `5289d28` 30 Jul |
| 5 dari 6 widget `widgets.json` (Engineering Tasks · Architecture Gaps · Verification Log · Workspace Nav · Disaster Recovery) | — | **tak dibuka dari kode mana pun**; zona workbench kosong bawaan. Hanya Monitor MAEF yang dibuka. **Tetapi** tata letak workbench dipulihkan dari `localStorage` (`WorkspaceManager.js:150`), jadi apakah salah satunya masih tampil di mesin Owner hanya bisa dipastikan dari pengukuran Tahap 0 butir 2 | — |

Ketiga komponen mati itu (470 baris) dicatat, **tidak dihapus** — penghapusan butuh izin Owner (K6
diperluas).

**Tingkat:** **1** selalu terlihat (dipakai tiap giliran) · **2** satu klik (dipakai sesekali) · **3** di
menu (jarang) · **K** kondisional (muncul sendiri saat keadaannya terjadi).

### 6.1 Kerangka & lapisan global

| Fungsi | Hari ini | Tingkat | Tempat baru |
|---|---|:-:|---|
| Navigasi 11 aplikasi | bilah ikon `Sidebar.jsx` | 1 | menu teks kiri (§5.2); ikon tipis di halaman kerja |
| Navigasi seluler | `MobileBottomNav.jsx` | 1 | menu jadi daftar layar penuh; panel jadi halaman penuh |
| Notifikasi sistem | `SystemNotificationCenter.jsx` | K | tetap, digayakan ulang |
| Persetujuan patch Engineer | `EngineerApprovalDialog.jsx` (`Engineer:RequestApproval`) | K | tetap dialog modal |
| Graf pengetahuan (Home) | `HomeDashboard.jsx` | 1 | **halaman pertama panel kanan** sesudah masuk, tanpa diubah; "Beranda" di menu membukanya kembali (K1 = B) |
| **Keluar (logout)** | **hanya** di dasar halaman Settings (`Settings.jsx:768`) | 3 → menu | **pilihan menu utama "Keluar"** — naik dari dasar halaman panjang ke menu |
| Unduh aplikasi desktop | `TombolUnduhDesktop.jsx` (juga di layar masuk) | 3 | bagian Pengaturan "Aplikasi Desktop" |

### 6.2 Halaman chat (`ConversationEngine.jsx`)

| Fungsi | Baris hari ini | Tingkat | Tempat baru |
|---|---|:-:|---|
| Daftar pesan + jawaban mengalir | `:166`, `:1332` | 1 | kolom baca tengah |
| Nalar `<think>` terbuka gaya DeepSeek | `:1972` | 1 | **tetap terbuka** (keputusan Owner) |
| Label `[STATUS: …]` dari server | teks jawaban (`label_sumber.ts`) | 1 | tetap di dalam jawaban |
| Lencana alat · chip sumber grounding | `:2093`, `:2178` | 1 | ringkas di bawah jawaban |
| Akordeon eksekusi alat · detail nalar | `:2211`, `:2261` | 2 | tetap lipat di bawah jawaban |
| Konfirmasi alat · terapkan patch | `:2231`, `:2277` | K | tetap di dalam pesan |
| Hasil `word_to_pdf` — buka berkas | `:2113` | K | tetap di dalam pesan |
| Salin pesan | `:2297` | 2 | saat kursor di atas pesan |
| Kotak ketik · Kirim ↔ Berhenti | `:2390`, `:2432` | 1 | bawah kolom baca |
| Lampiran | `:2414` | 1 | di dalam kotak ketik |
| 📁 Folder kerja (Assistant) · Akar repo (Engineer) | `:2391`, `:2398` | 1 | di dalam kotak ketik |
| Pil tier model (Assistant) | `:1813` | 1 | di dalam kotak ketik |
| Kartu konfirmasi pencarian web | `:2340` | K | di atas kotak ketik |
| Percakapan baru | `:1629` | 1 | bilah atas halaman |
| Riwayat chat | `:1596` (256px, tertutup) | 2 | laci yang menutupi, **tidak** membelah kolom |
| Panel Tools (RAG + registry) | `:1634` | 2 | dari kotak ketik |
| Meteran jendela konteks · Padatkan | `:1699`, `:1723` | 1 · 2 | angka kecil di bilah atas; Padatkan di dalamnya |
| Simpan temuan · Simpan pengetahuan | `:1779`, `:1792` | K | bilah atas, hanya bila ada |
| Riwayat konversi Word → PDF | `:1807` | 2 | bilah atas |
| Banner rollback Engineer | `:1864` | K | tetap |
| **Memory Context** (konflik, sampah, query terakhir) | `:2459`, **320px terbuka bawaan** | **2** | **laci kanan, TERTUTUP bawaan** — mengembalikan 320px ke kolom baca |
| Monitor MAEF | `:1926` | 2 | laci, bukan kolom |
| "Luaskan kolom chat" | `:1941` | — | **tidak diperlukan lagi**: tak ada kolom permanen untuk diluaskan |
| Cahaya atmosfer (dua lingkaran blur) | `:2452-2454` | — | **dibuang** — hiasan tanpa keadaan |

### 6.3 Halaman lain

| Halaman · fungsi di dalamnya | Tingkat | Tempat baru |
|---|:-:|---|
| **Settings** — AI Model Management (grid status) · API Key + Test Connection · Adaptive Model Tiering (3 slot + sakelar nalar) · Batas Biaya Harian · Pembaruan Aplikasi · Aplikasi Desktop · Tools & Capabilities (bawaan global + per workspace) · Tool Registry · User Identity | 3 | halaman bertab: 9 bagian = sub-menu kiri, isi di panel (§5.3); Keluar pindah ke menu utama |
| **Knowledge** (`ResearchApp`) — unggah dokumen · unduh cadangan (Item 93) · Data Tabel: pratinjau, daftar, laporan kejanggalan (Item 92) · cari dokumen · Knowledge Spaces (`DaftarWorkspace`) · daftar & hapus dokumen · statistik | 3 | halaman kerja lebar; Data Tabel jadi tab di dalamnya |
| **Memory** (`MemoryApp`) — cari · daftar memori + metadata Golden Source · hapus · statistik | 3 | halaman kerja lebar |
| **File Explorer** — cari berkas · ke akar · muat ulang · breadcrumb · pohon kiri + pratinjau kanan · salin path | 3 | halaman kerja lebar; pohon & pratinjau **di dalam** panel |
| **Agent Forge** — statistik · daftar agen · daftar alat · dialog tambah/ubah agen & alat | 3 | halaman daftar; dialog tetap modal |
| **Kernel** (`SystemLogsApp`) — saring ERROR/WARN/semua · muat ulang · daftar entri | 3 | halaman daftar |
| **Billing** — pemakaian hari ini (kedua batas) · tabel log | 3 | halaman daftar |

---

## 7. Tahapan

Tiap tahap berdiri sendiri dan dapat dihentikan tanpa merusak aplikasi.

### Tahap 0 — Ukur & lengkapi (tanpa mengubah tampilan)

1. ~~Owner memutuskan K1–K5 (§9).~~ ✅ K1 dan K3 diputuskan 19 Okt; sisanya baru dibutuhkan di Tahap 3.
2. **Ukur biaya tumpukan hari ini**: memori & prosesor dengan 11 aplikasi hidup, sebagai pembanding
   Tahap 1. Kalau ternyata kecil, alasan Tahap 1 tinggal kenyamanan & kebenaran keadaan — dan itu dicatat
   apa adanya.
3. ✅ **Inventaris §6 dilengkapi** (19 Okt) — semua halaman terjangkau; §6.0 memisahkan 3 komponen mati
   (470 baris) dan 5 widget yang tak dibuka kode mana pun. Temuan: **Keluar hanya ada di dasar Settings**.
4. ✅ **`uji/uji-ciri-tampilan.mjs`** — gigi searah atas 9 penanda (tanpa `LampLogin`, komentar dibuang):
   token Material 568 · slate 615 · pelangi 250 · gerak 51 · blur 15 · glow 26 · gradien 6 · berkas lucide
   26 · berkas Material Symbols 8. Penghitungnya diuji dengan fixture; **mutasi** satu `bg-slate-900`
   tambahan → merah (616 ≤ 615). Selisih dengan tabel §2.1 hanya milik `LampLogin` (cahaya lampunya
   memang dibuat dari gradien & glow).
5. ✅ **`uji/uji-penjaga-lamplogin.mjs`** — sidik jari SHA-256 dengan akhir baris dinormalkan (berkas di disk
   ber-CRLF), plus memastikan `App.jsx` masih merender `<LampLogin>`. **Mutasi** satu spasi → merah;
   berkasnya dipulihkan dan `git diff` bersih.
6. ✅ Suite **98/98** (96 + 2 uji baru).
7. ✅ **Butir 2 — diukur 19 Okt** dengan `uji/uji-ukur-tumpukan.js` (hanya membaca; ditempel di konsol
   DevTools karena `vite.config` tidak mengizinkan `/@fs/` ke `uji/`). Server dev di panel browser, Owner
   login sendiri, viewport **1366×720 tetap dari awal sampai akhir** (sampel 2; sampel 1 dibuang untuk angka
   simpul karena lebar panel berubah di tengah pengukuran). Aplikasi yang terlihat: Engineer.

   | Ukuran | Hasil | Arti |
   |---|---|---|
   | Aplikasi terpasang · terlihat · tersembunyi tetap hidup | **11 · 1 · 10** | tumpukan terbukti di runtime, bukan hanya di kode |
   | Kotak ketik terpasang | **3** | tiga `ConversationEngine` hidup bersamaan |
   | Simpul DOM: seluruh halaman · milik aplikasi tersembunyi | 3.333 · **2.868 (86%)** | 86% halaman adalah layar yang tidak dilihat; angka tersembunyi **sama persis** di kedua sampel |
   | Pendengar EventBus | 81–90 di 47 jenis event | banyak event didengar **tepat 3 kali** (`Chat:Updated`, tujuh `MemoryGovernor:*`, `Engineer:Recommendation`) — sidik jari tiga mesin chat |
   | Tugas panjang selama 15 detik diam | sampel 1: 2 (139 ms) · sampel 2: **0** | **kerja latar saat diam praktis nol** |
   | Heap JS | 39–56 MB, naik-turun antar sampel | **tidak bisa** diatribusikan ke aplikasi tersembunyi dari satu keadaan — baru terukur sebagai selisih sesudah Tahap 1 |
   | Kanal realtime terbuka | 1 (`activity-tracing`) | — |

   **Kesimpulan yang jujur:** biaya tumpukan **bukan prosesor** — saat diam aplikasi hampir tidak bekerja.
   Biayanya adalah **struktur**: 86% DOM dan pendengar yang berlipat tiga untuk layar yang tidak dilihat, dan
   keadaan chat yang hanya bisa selamat dengan cara itu. Jadi alasan Tahap 1 adalah **kebenaran keadaan**
   (jawaban milik percakapan yang bertanya, selamat saat pindah halaman) dan **satu halaman pada satu waktu**,
   bukan "aplikasi jadi lebih cepat". Klaim kecepatan **tidak** boleh dibuat sebelum diukur ulang.

   **Tata letak tersimpan** di profil yang diukur: Monitor MAEF tersimpan **terbuka** di zona kanan untuk
   **Assistant dan Engineer** (kunci `v4`) — jadi di profil itu kolom chat Assistant/Engineer dimulai dari
   **±632px**, bukan ±982px. Lima widget lain **tidak ada** di tata letak mana pun → tak terjangkau,
   terkonfirmasi. Juga tersisa kunci lama `mamet_v3_*` yang tidak dibaca lagi.
   *Batasnya:* ini `localStorage` panel browser di `localhost:5173`, **bukan** aplikasi `.exe` Owner (yang
   menyimpan setelannya sendiri). Tata letak di `.exe` belum diperiksa.

### Tahap 1 — Fondasi: keadaan di luar layar, satu halaman pada satu waktu

1. **Layanan sesi chat** terdaftar di `ServiceManager`, berkunci per aplikasi (Assistant · Mametlite ·
   Engineer punya sesi sendiri). Pola langganannya **sudah ada** — `ApplicationManager.subscribe`
   (`ApplicationManager.js:13`) + `useService`.
2. `onChunk` · `onDone` · `onError` menulis ke **layanan**, bukan ke `useState` layar → **jawaban terus
   mengalir walau halamannya ditutup**. Tujuan tulisnya tetap ditentukan **penanda kiriman**
   `pengirimanChat.js` — `uji/uji-kiriman-percakapan.mjs` dan `uji/uji-pemulihan-chat-v6.mjs` wajib
   tetap hijau **tanpa diubah**.
3. Dipindah lebih dulu yang hilangnya merugikan: pesan, jawaban yang mengalir, ketikan yang belum
   terkirim, chat aktif. Keadaan tampilan murni (popover terbuka, dsb.) boleh kembali ke bawaan.
4. Sesudah itu **`ApplicationContainer` hanya merender aplikasi aktif.**

**Uji wajib:** (a) hanya satu aplikasi terpasang di DOM; (b) **pindah halaman saat jawaban mengalir →
kembali → jawabannya utuh**, diuji live di `npm run desktop`; (c) **skenario bug 28 Sep diulang**: bertanya
di percakapan baru, pindah ke riwayat lain *dan* ke halaman lain sambil menunggu — jawaban harus mendarat di
percakapan yang bertanya; (d) suite penuh hijau. `ConversationEngine.jsx`
2.506 baris: dipindah sedikit demi sedikit, satu keadaan per langkah.

#### Keadaan 19 Okt — langkah 1–4 ✅, langkah 5 DIPARKIR (keputusan Owner)

Dikerjakan sebagai lima langkah; empat pertama selesai, semua layar **masih terpasang** sehingga perilaku
aplikasi tidak berubah:

| Langkah | Isi | Bukti |
|---|---|---|
| 1 | `PenyimpanKeadaan.js` (tanpa React) + `useKeadaanTersimpan`/`useRefTersimpan`; Kernel mendaftarkannya; **`App.jsx` mengosongkannya saat pengguna berganti** — keadaan di luar layar tidak hilang sendiri saat logout | `uji-penyimpan-keadaan.mjs` 25 asersi, 4 mutasi menggigit |
| 2 | 5 keadaan inti (`messages`, `input`, `isLoading`, `currentChatId`, `initialRestoreDone`) + 5 ref (kendali kiriman, nomor urut percakapan, kunci simpan terakhir, sedang-menyimpan, pemulihan-gagal) | pemulihan riwayat diuji di browser: 2 pesan terpulihkan, **`updated_at` tidak berubah** |
| 3 | **Penyimpanan otomatis menjadi pengamat** di penyimpan — jalan walau layarnya dilepas. Badan logikanya tidak diubah satu penjaga pun | `uji-pemulihan-chat-v6` (dulu v5) — 2 mutasi menggigit |
| 4 | 11 keadaan lagi + 3 penjaga duplikat (perintah otomatis, uji klaim, temuan); reset pil tier hanya saat chat benar-benar berganti. **11 `useState` sengaja tetap lokal**, tiap satunya beralasan | `uji-keadaan-chat-di-luar-layar.mjs`, 5 mutasi menggigit |

Suite **100/100**. Tiga uji lama yang mencocokkan teks harfiah (`useRef(…)`) diubah agar menjaga NIATNYA —
`uji-hentikan-kiriman` v2, `uji-pemulihan-chat-v6`, `uji-perintah-tanpa-persetujuan` v2 — masing-masing
dibuktikan dengan mutasi.

**Langkah 5 (melepas layar yang tidak aktif) diparkir — Owner, 19 Okt.** Dua alasan, keduanya terukur:

1. **Manfaatnya bagi Owner kecil.** Tahap 0 mengukur kerja latar saat diam ≈ 0; di mata Owner aplikasi sudah
   "satu halaman pada satu waktu" karena yang lain tersembunyi. Menu & ruangan (Tahap 3) dan kolom chat yang
   tidak dijepit (Tahap 2) **tidak membutuhkan** langkah 5.
2. **Lingkupnya ternyata lebih besar.** Layar chat Engineer bukan hanya tampilan — ia juga **pengendali** yang
   bekerja walau tersembunyi: mendengarkan `Engineer:PatchApplied` (mencatat checkpoint = **tombol Undo**),
   `Engineer:PatchPersisted`, `Engineer:ReasoningReport`, `Engineer:RequestConfirmation`,
   `Engineer:Recommendation`, `Memory:Retrieved`; dan menjalankan **perintah aman secara otomatis** (keputusan
   Owner 1 Okt) — yang pembatalannya (`batal`) dipicu cleanup efek, sehingga melepas layar di tengah perintah
   akan membuang hasilnya padahal perintah itu sudah tercatat "dijalankan". Melepas layar tanpa memindahkan
   pengendali itu = Owner menyetujui patch, membuka Settings, dan tombol Undo tak pernah muncul.

**Syarat bila kelak dilanjutkan:** pengendali di atas pindah keluar layar seperti penyimpanan otomatis
(langkah 3) — **sebelum** `ApplicationContainer` hanya merender aplikasi aktif.

### Tahap 2 — Kerangka standar + inventaris

Kolom baca tunggal di tengah; riwayat & Memory Context menjadi laci (Memory Context **tertutup bawaan**);
Settings menjadi halaman bertab. Tampilan masih kulit lama — perubahan susunan diuji terpisah dari
perubahan warna. **Uji penerimaan: setiap baris §6 punya tempat baru dan bisa dicapai.**

**Rincian (dibaca dari kode 19 Okt).** Tiga hal yang menjepit kolom baca di layar 1366px, semuanya susunan,
bukan logika:

| Penjepit | Hari ini | Jadi |
|---|---|---|
| Memory Context | kolom `w-80` di samping pesan (`ConversationEngine.jsx` "Chat + Memory Context Panel"), **terbuka bawaan** | **laci kanan yang menutupi**, tertutup bawaan; isi `MemoryContextPanel.jsx` tidak disentuh |
| Riwayat chat | `md:relative` — di desktop ia **mendorong** kolom pesan | laci yang menutupi di semua lebar, dengan latar penutup yang menutupnya bila diklik di luar |
| Monitor MAEF | kolom grid 350px zona kanan `AppShell.jsx` | laci yang menutupi; ia satu-satunya widget yang memang dibuka (§6.0) |

Plus **kolom baca**: daftar pesan dibatasi `max-w-3xl` dan ditengahkan — lebar yang SAMA dengan kotak ketik
yang sudah ada, jadi pesan dan kotak ketik akhirnya sejajar.

Langkah:

- **2a** ✅ **19 Okt** — tiga laci + kolom baca di layar chat; ditambah atas permintaan Owner ("kurang cakep"):
  bilah tombol jadi satu baris, tiga ikon kembar bilah samping diganti. Jawaban model **524 → 768px**; kolom
  baca tidak bergeser saat laci mana pun dibuka. `uji-kerangka-chat.mjs` v2, 12 mutasi menggigit —
  [log](../project-memory/changelog/2026-10-19-menu-game-tahap2a-kerangka-chat.md).
- **2b** ✅ **19 Okt** — Settings bertab: 9 bagian jadi daftar kiri, isi di kanan (8 tampil; Pembaruan/Unduh Desktop saling meniadakan); Keluar tetap di bagian identitas sampai
  menu utama ada (Tahap 3). `uji-settings-bertab.mjs`, 6 mutasi menggigit — [log](../project-memory/changelog/2026-10-19-menu-game-tahap2b-settings-bertab.md).
- **2c** — **uji inventaris**: tiap baris §6 dipetakan ke jangkar kodenya (tombol, `title`, penangan); baris
  yang jangkarnya hilang = merah. Inilah yang membuat "tidak ada fungsi yang hilang" menjadi uji, bukan janji.

**Satu efek yang perlu diketahui Owner:** tata letak tersimpan menyimpan Monitor MAEF **terbuka** untuk
Assistant & Engineer (diukur Tahap 0). Sesudah 2a ia muncul sebagai laci terbuka yang menutupi tepi kanan
chat pada pembukaan pertama — ditutup sekali, tata letaknya menyimpan keadaan tertutup.

### Tahap 3 — Kulit ruangan

Komponen ruangan + lampu; menu teks kiri bertingkat dari `navigation.json`; panel kanan; palet LampLogin
menggantikan 47 token Material; satu set ikon; gerak dekoratif dibuang, `prefers-reduced-motion` dihormati
(hari ini **nol** pemakaian di `src/`). Berurutan per halaman, dimulai dari yang paling sering dipakai
Owner. **Uji kontras WCAG** di tiap panel.

**Di luar lingkup:** `LampLogin.jsx`; `Login.jsx`; Mametlite; Face Mamet; server dan skema; perubahan
konstitusi (milik Owner).

---

## 8. Ukuran berhasil

1. **Inventaris §6 lengkap**: setiap fungsi hari ini punya tempat baru — tidak ada yang hilang.
2. **Satu aplikasi** terpasang pada satu waktu.
3. **Jawaban yang sedang mengalir selamat** saat Owner berpindah halaman.
4. Di 1366×720: **tidak ada kolom permanen** di samping kolom baca chat.
5. Kontras teks ≥ 4,5:1 di setiap panel — diukur.
6. Angka ciri generik §2.1 turun dari garis dasar.
7. `LampLogin.jsx` tidak berubah satu bait pun.
8. **Owner sendiri** menemukan tiap fungsi yang ia pakai tanpa bertanya.

---

## 9. Keputusan Owner

**Diputuskan 19 Okt 2026:**

- **K1 = B** — sesudah masuk: ruangan + menu, dan **graf pengetahuan terbuka di panel sebagai halaman
  pertama**. Konstitusi 23 (Home = graf) **tetap dipatuhi**; tidak ada amandemen. Akibatnya bagi
  rancangan: halaman pertama panel kanan = `HomeDashboard` yang sekarang, tanpa diubah; "Beranda" di menu
  membukanya kembali.
- **K3 = A** — **fondasi dulu**: Tahap 0 → 1 → 2 → 3. Kulit tidak dirintis sebelum susunannya berhenti
  menumpuk.

**Masih terbuka** — tidak menghalangi Tahap 0–2, baru dibutuhkan di Tahap 3 (kecuali K6, di luar item ini):

| # | Pertanyaan | Pilihan | Rekomendasi & alasannya |
|---|---|---|---|
| ~~K1~~ | ~~Apa yang tampil sesudah masuk?~~ | — | ✅ **B, diputuskan 19 Okt** (di atas) |
| **K2** | Isi menu | struktur `navigation.json` bertingkat (§5.2), dengan atau tanpa **"Lanjutkan"** | dengan "Lanjutkan" — keadaannya nyata dan itu idiom menu game yang paling dikenal |
| ~~K3~~ | ~~Urutan~~ | — | ✅ **A — fondasi dulu, diputuskan 19 Okt** (di atas) |
| **K4** | Huruf menu | **A.** gaya judul LampLogin (mono krem bercahaya) · **B.** huruf tampilan baru berlisensi OFL, disimpan sendiri | **A.** Kontinu dengan layar masuk, tanpa unduhan huruf. Teks bacaan tetap Inter |
| **K5** | Utang "dua ruangan" (§5.1) | disatukan nanti dengan izin menyentuh `LampLogin` · dibiarkan | disatukan nanti — dicatat sebagai sisa pekerjaan |
| **K6** | Kode mati §6.0: `Login.jsx` · `EngineerChat.jsx` · `ActivityBar.jsx` (470 baris) | hapus · biarkan | di luar item ini; dicatat agar tidak terlupa |

---

## 10. Risiko

| Risiko | Peredam |
|---|---|
| Tahap 1 merusak chat (2.506 baris, 27 keadaan) | satu keadaan per langkah; suite penuh tiap langkah; uji live "pindah saat mengalir" |
| Fungsi hilang dalam penyusunan ulang | inventaris §6 sebagai uji penerimaan |
| Tema gelap sulit dibaca | uji kontras WCAG per panel; panel tanpa blur |
| Dua sumber ruangan menyimpang | uji penjaga konstanta palet; disatukan di K5 |
| Distraksi (MUS §19) | tanpa gerak dekoratif; `prefers-reduced-motion` |
| Manfaat Tahap 1 ternyata kecil secara angka | diukur di Tahap 0 dan dilaporkan apa adanya |
