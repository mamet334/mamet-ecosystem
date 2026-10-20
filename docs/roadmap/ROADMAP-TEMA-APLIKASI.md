# ROADMAP: TEMA APLIKASI — MAMET ECOSYSTEM

**Tipe Dokumen:** Rancangan (blueprint) perubahan UI — memenuhi syarat tata kelola MUS §20 (tujuan,
ruang lingkup, dokumentasi, analisis, alasan, persetujuan Owner)
**Item:** 128 — **menggabungkan sisa Item 127** ([`ROADMAP-TAMPILAN-MENU-GAME.md`](./ROADMAP-TAMPILAN-MENU-GAME.md))
**Status:** 🟡 **Tahap A ✅ (20 Okt)** — token palet menjadi variabel CSS, tampilan tidak berubah ([log](../project-memory/changelog/2026-10-20-tema-tahap-a-variabel-css.md)). · **Tahap B ✅ (20 Okt)** — Settings › Tampilan, Ruangan kayu & Gelap netral, per akun ([log](../project-memory/changelog/2026-10-20-tema-tahap-b-settings-tampilan.md)); simpan-ke-akun menunggu dicoba Owner. **Berikutnya: Tahap C** (lampu, kurangi gerakan).
**Tanggal:** 2026-10-20
**Aplikasi:** **Mamet Ecosystem** (`frontend/`) — **bukan** Mametlite.
**Batas tegas:** **`LampLogin.jsx` tidak diubah** (arahan Owner 19 Okt, tetap berlaku). Layar masuk tetap memakai
ruangannya sendiri, apa pun tema yang dipilih sesudah masuk.

---

## 1. Kenapa dokumen ini dibuat

Item 127 mencari **satu** tampilan yang pas — menu game berlatar ruangan `LampLogin`. Pada 19–20 Okt tampilan itu
dinilai Owner di layarnya sendiri berkali-kali, dan hampir tiap putaran berakhir dengan "kurang nyaman":

| Tanggal | Yang dicoba | Penilaian Owner |
|---|---|---|
| 19 Okt | palet LampLogin di seluruh aplikasi | *"sama sih tapi kurang nyaman di mata"* |
| 19 Okt | jawaban tanpa kotak, Markdown dirender, teks 13:1 | *"sudah cukup nyaman"* — lalu: *"penyebabnya warna hijau kayu yang mendominasi"* |
| 19 Okt | latar terdalam = dinding LampLogin | disetujui |
| 20 Okt | — | *"warna terlalu hangat"* |
| 20 Okt | bingkai jawaban hampir hitam 80% | *"tapi saya salah, ternyata kurang nyaman untuk saya"* |
| 20 Okt | kartu jawaban = kartu Settings | disetujui |
| 20 Okt | lampu di ruangan (tiga pilihan) | *"ini juga tidak terlalu penting"* |

Lalu Owner sampai pada kesimpulan sendiri:

> *"saya malah berpikir membuat setelan di kolom setting berupa tema aplikasi, karena di sana bisa menyesuaikan
> keinginan pengguna"*

Inilah tujuan dokumen ini. Rasa nyaman di mata **berbeda tiap orang, dan berbeda pada orang yang sama di waktu
berbeda** — mencari satu tampilan yang cocok untuk semua akan terus berputar. Aplikasi besar menyelesaikannya dengan
**pilihan tema**, bukan dengan satu tampilan tetap. Pekerjaan Item 127 yang ditunda Owner (lampu, gerak dekoratif)
tidak dibuang — mereka **menjadi pilihan pengguna** di dalam tema.

---

## 2. Hubungan dengan Item 127

**Tetap berlaku dan menjadi fondasi** (sudah selesai, tidak diulang):

- Tahap 0–2: keadaan chat di luar layar, kerangka standar, Settings bertab, uji inventaris fungsi.
- Menu teks (K2), skala huruf & angka (K4), Markdown & kotak kode, kartu jawaban = kartu Settings.
- **Palet LampLogin di satu sumber** (`tailwind.config.js`) — inilah yang membuat tema mungkin: sebagian besar warna
  aplikasi sudah lewat satu pintu.
- Dinding ruangan `LatarRuangan.jsx` sebagai lapisan terdalam.

**Dipindah ke dokumen ini** (sisa Tahap 3 Item 127):

| Sisa Item 127 | Di Item 128 menjadi |
|---|---|
| Lampu di ruangan (ditunda Owner 20 Okt) | pilihan **Lampu** nyala/mati (Tahap C) |
| Gerak dekoratif + `prefers-reduced-motion` (ditunda Owner 20 Okt; peta 51 animasi sudah dibuat) | pilihan **Kurangi gerakan** (Tahap C) |
| Latar ruangan | pilihan **Latar ruangan** nyala/mati (Tahap B) |
| Satu set ikon · ikon Agent Forge = logo · nama menu berbahasa Inggris · cabang desktop `Sidebar.jsx` | §7 "Sisa yang dibawa" — tidak bergantung tema |
| K5 (dua sumber ruangan) · K6 (kode mati) · Tahap 1 langkah 5 (diparkir) | §9 keputusan terbuka |

---

## 3. Standar — dipakai hanya bila cocok

| Pola | Dari mana | Cocok untuk Mamet? |
|---|---|---|
| Pilihan tema di setelan, termasuk **"Ikuti sistem"** | Windows, macOS, VS Code, aplikasi asisten AI | **Ya** — Owner memakai Windows; "Ikuti sistem" membaca `prefers-color-scheme` |
| Tema disimpan **per akun**, bukan per perangkat | aplikasi lintas perangkat | **Ya** — Owner memakai desktop dan web |
| Tema diterapkan **sebelum** tampilan pertama | praktik umum (menghindari kedipan tema lama → baru) | **Ya** — wajib, lihat §5.3 |
| Kontras teks ≥ 4,5:1 **di setiap tema** | WCAG 2.2 AA (1.4.3) | **Ya** — diuji per tema |
| Pengguna bisa menghentikan gerakan | WCAG 2.2 (2.2.2, 2.3.3) | **Ya** — pilihan "Kurangi gerakan" |
| Pengguna menyusun warna sendiri bebas | sebagian aplikasi | **Belum** — tema bebas sulit dijamin kontrasnya; tema jadi lebih dulu |

---

## 4. Batasan konstitusi

- **MUS §20 (UI Governance):** dokumen ini = tujuan, ruang lingkup, analisis, alasan; persetujuan Owner ditunggu.
- **MUS §21 (Metadata Driven UI):** daftar tema **dibaca dari metadata** (mis. `public/metadata/themes.json`), bukan
  ditulis tangan di komponen — menambah tema Terang atau Biru nanti = menambah satu entri metadata, tanpa mengubah
  logika UI.
- **MUS §4.2 (State Driven UI):** tema adalah keadaan; komponen membaca token, tidak memeriksa nama tema.
- **Konstitusi 23 (Home):** **warna simpul graf ditetapkan konstitusi** — hijau Memory, ungu RAG, biru Workspace,
  kuning Conversation, putih Infrastruktur, merah Error. Warna ini **tidak ikut tema**. Tema boleh mengubah latar di
  belakang graf, bukan arti warnanya.
- **MUS §19:** sederhana, konsisten, minim distraksi — jumlah tema dan pilihan dijaga sedikit.

---

## 5. Rancangan

### 5.1 Lapisan

```
 Pilihan pengguna  ── Settings › Tampilan ──▶ disimpan per akun (user_metadata.tema)
        │                                         + salinan lokal (localStorage) untuk saat membuka
        ▼
 Daftar tema       ── public/metadata/themes.json (MUS §21) — nilai warna tiap tema
        │
        ▼
 Atribut halaman   ── <html data-tema="ruangan-kayu"> + data-latar / data-lampu / data-gerak
        │
        ▼
 Variabel CSS      ── --warna-surface, --warna-on-surface, … (satu set per tema)
        │
        ▼
 Token Tailwind    ── bg-surface, text-on-surface, slate-*, … membaca variabel, bukan hex tetap
        │
        ▼
 Komponen          ── tidak berubah; ikut tema karena tokennya ikut
```

### 5.2 Token menjadi variabel CSS (Tahap A — fondasi)

Hari ini nilai token **dibakukan saat build** (`"surface": "#0b0806"`). Supaya bisa berganti saat aplikasi berjalan,
token menunjuk variabel: `surface: "rgb(var(--warna-surface) / <alpha-value>)"` — bentuk ini menjaga pengubah
opasitas yang sudah dipakai di mana-mana (`bg-primary/30`, `border-primary/35`). Nilai Ruangan kayu = nilai hari ini,
jadi **tampilan tidak berubah sedikit pun** di tahap ini; dibuktikan dengan uji yang membandingkan warna terhitung
sebelum dan sesudah.

### 5.3 Penyimpanan — per akun (keputusan Owner 20 Okt)

- Disimpan di `user_metadata` akun Supabase — **pola yang sudah dipakai** batas biaya harian di Settings
  (`daily_budget_cap_usd`). **Tanpa tabel baru, tanpa migrasi.**
- Salinan di `localStorage` dibaca di `main.jsx` **sebelum** React merender, supaya aplikasi tidak berkedip dari tema
  lama ke tema pilihan; setelah masuk, nilai akun menjadi sumber kebenaran dan salinan lokal diperbarui.
- Perkiraan: ±50–70 baris (per perangkat ±20–30 — selisihnya kecil, keuntungannya tema ikut ke desktop dan web).

### 5.4 Settings › Tampilan

Satu bagian baru di Settings bertab (Item 127 Tahap 2b):

| Pilihan | Isi | Tahap |
|---|---|---|
| **Tema** | Ruangan kayu (hari ini) · Gelap netral · Ikuti sistem | B |
| **Latar ruangan** | dinding kayu nyala / mati | B |
| **Lampu** | nyala / mati | C |
| **Kurangi gerakan** | ikuti Windows / nyala / mati | C |

Pratinjau tiap tema tampil di bagian itu sebelum dipilih — pelajaran Item 127: Owner menilai dari **melihat**, bukan
dari deskripsi.

### 5.5 Tema

| Tema | Watak | Tahap |
|---|---|---|
| **Ruangan kayu** | palet LampLogin hari ini — hangat, dinding kayu | B (bawaan) |
| **Gelap netral** | abu-abu gelap tanpa nuansa hangat — jawaban untuk "warna terlalu hangat" | B |
| **Terang** | latar terang, teks gelap | D — diminta Owner, menyusul |
| **Biru dominan** | aksen dan nuansa biru | D — diminta Owner, menyusul |

---

## 6. Keadaan kode hari ini (diukur 20 Okt)

| Yang diukur | Jumlah | Ikut tema setelah Tahap A? |
|---|---|---|
| Token palet di `tailwind.config.js` | 48 + skala slate 11 tingkat | **ya** — inilah yang diubah ke variabel |
| Warna hex ditulis langsung di kelas komponen (`bg-[#…]`) | 40, di 6 komponen | tidak — dipindah ke token bila perlu |
| Warna di gaya inline (`style={{ color: '#…' }}`) | 2 | tidak |
| Kelas putih/hitam mentah (`text-white`, `bg-black/40`, …) | 133 | tidak — **aman untuk tema gelap**, menjadi pekerjaan utama tema **Terang** |
| Aksen pelangi (`emerald`, `cyan`, `violet`, …) | 250 | tidak — sebagian adalah warna makna (status, graf); dinilai per tema |
| Dinding `LatarRuangan.jsx` | 1 komponen, gradien tetap | diatur pilihan "Latar ruangan" |
| `LampLogin.jsx` | — | **tidak** — di luar lingkup |

Karena itu tema gelap (Gelap netral) jauh lebih murah dari tema Terang: 133 kelas putih/hitam dan komponen yang
mengandaikan latar gelap baru perlu dibereskan untuk Terang.

---

## 7. Tahapan

**Tahap A — Fondasi: token menjadi variabel CSS.** ✅ 20 Okt — nilai di `frontend/src/tema/ruangan-kayu.css`; diukur di peramban (2.608 elemen) dan dijaga `uji-tema-tahap-a`. Tampilan tidak berubah. Uji: warna terhitung tiap token sama
sebelum/sesudah; semua kelas tetap dibuat Tailwind (pelajaran Item 127: kelas yang ditulis ≠ kelas yang dibuat).

**Tahap B — Settings › Tampilan + dua tema gelap.** ✅ 20 Okt — T1–T3 sesuai usul; menu teks ikut tema; 150 warna tetap tersisa (dibereskan bersama Tahap D). Ruangan kayu & Gelap netral, Ikuti sistem, Latar ruangan,
penyimpanan per akun, diterapkan sebelum tampilan pertama. Uji kontras **per tema** — `uji-palet-lamplogin` menjadi
uji per tema (Ruangan kayu tetap wajib hangat; tema lain punya aturannya sendiri; semua wajib ≥ 4,5:1).

**Tahap C — Lampu & Kurangi gerakan.** Peta 51 animasi dari Item 127 dipakai: penanda proses dipertahankan,
peringatan berhenti berkedip, hiasan dibuang, animasi masuk yang mati dibersihkan; "Kurangi gerakan" menghentikan
semuanya. Lampu: gambar lampu disalin dari LampLogin (menambah utang K5, dijaga uji salinan).

**Tahap D — Tema Terang & Biru dominan.** Masing-masing diputuskan dan dinilai Owner terpisah; Terang didahului
pembersihan kelas putih/hitam mentah.

**Sisa yang dibawa dari Item 127** (tidak bergantung tema, dikerjakan bila Owner memintanya):
- satu set ikon (Lucide 26 berkas + Material 8 berkas → satu); ikon Agent Forge = logo Mamet;
- nama menu berbahasa Inggris (dari `navigation.json`) — keputusan istilah oleh Owner;
- cabang desktop `Sidebar.jsx` yang tak terpakai sejak menu teks;
- bilah gulir mendatar panel kanan Home — penyebab belum ditemukan;
- T18: kelas Tailwind yang tak pernah dibuat (catatan: dua entri `SystemNotificationCenter` ternyata **bukan** kelas
  mati — animasinya didefinisikan di komponen sendiri; T18 perlu dikoreksi).

---

## 8. Ukuran berhasil

1. Owner memilih tema di Settings, dan pilihannya **ikut** saat masuk dari desktop maupun web.
2. Membuka aplikasi **tidak berkedip** dari tema lama ke tema pilihan.
3. Setiap tema lulus kontras ≥ 4,5:1 — diukur, termasuk di atas dinding bila latar ruangan nyala.
4. Warna simpul graf Home tetap sesuai konstitusi 23 di semua tema.
5. Menambah tema baru = menambah satu entri metadata, tanpa mengubah komponen.
6. `LampLogin.jsx` tidak berubah satu bait pun.
7. Ruangan kayu sesudah Tahap A tampil **persis** seperti sebelum Tahap A.

---

## 9. Keputusan Owner

**Diputuskan 20 Okt 2026:**

- Tema dibuat sebagai **setelan di Settings** — gagasan Owner sendiri (§1).
- Penyimpanan **per akun**.
- Tema awal: **Ruangan kayu** dan **Gelap netral**; menyusul **Terang** dan **Biru dominan**.
- Lampu dan gerak dekoratif **ditunda** sebagai pekerjaan tetap, dan dibawa ke sini sebagai pilihan pengguna.
- Item 127 digabung dan disesuaikan ke dokumen ini; **dokumen ini dikoreksi Owner** sebelum dikerjakan.

**Masih terbuka:**

| # | Pertanyaan | Catatan |
|---|---|---|
| ~~T1~~ | ~~Nama tema berbahasa Indonesia?~~ | ✅ ya — diputuskan 20 Okt |
| ~~T2~~ | ~~"Ikuti sistem" saat Windows terang~~ | ✅ Gelap netral sampai tema Terang ada — diputuskan 20 Okt |
| ~~T3~~ | ~~Tema bawaan pengguna baru~~ | ✅ Ruangan kayu — diputuskan 20 Okt |
| K5 | Menyatukan dua sumber ruangan (perlu izin menyentuh `LampLogin.jsx`) | dari Item 127 |
| K6 | Kode mati `Login.jsx` · `EngineerChat.jsx` · `ActivityBar.jsx` | dari Item 127, di luar item ini |
| L5 | Tahap 1 langkah 5 Item 127 (melepas layar tak aktif) | diparkir |

---

## 10. Risiko

| Risiko | Penangkal |
|---|---|
| Tahap A diam-diam mengubah warna | uji perbandingan warna terhitung sebelum/sesudah |
| Kelas opasitas (`/30`, `/35`) rusak saat token jadi variabel | bentuk `rgb(var(--…) / <alpha-value>)` + uji kompilasi Tailwind |
| Tema berkedip saat aplikasi dibuka | salinan lokal dibaca di `main.jsx` sebelum render |
| Tema baru lolos tanpa uji kontras | uji palet per tema — tema tanpa uji = merah |
| Warna makna (graf, status, galat) ikut berubah arti | warna konstitusi 23 & galat dikunci di luar tema |
| Tema Terang membesar tak terkendali | dipisah ke Tahap D, didahului pembersihan kelas mentah |
