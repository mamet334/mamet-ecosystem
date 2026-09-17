# Roadmap: Adaptive Shell untuk Mamet Ecosystem (UI Multi-Device)

**Status:** 📋 **Rencana terdaftar, belum dikerjakan** (Item 72, telaah 2026-09-12 — lihat bagian Telaah di akhir dokumen)

## Konteks & Masalah

Mamet Ecosystem saat ini adalah aplikasi Electron (desktop) dengan frontend React + Vite, backend Express di Vercel, dan Supabase untuk persistensi. Saat diakses dari HP (browser/companion), UI berantakan karena layout tidak beradaptasi terhadap device.

Solusi yang disepakati: **companion app (bukan rewrite native)** dengan **adaptive shell** yang memilih tampilan sesuai device, memanfaatkan `DiscoveryManager.js` yang sudah ada di `frontend/src/core/runtime/DiscoveryManager.js`.

Native Android (Kotlin) **secara sadar ditunda** — arsitektur harus disiapkan sebagai "kran" (titik sambung) untuk itu, bukan dibangun sekarang. Lihat bagian "Prinsip Arsitektur" di bawah.

---

## Prinsip Arsitektur (WAJIB dipatuhi di semua tahap)

1. **State tidak boleh hidup di shell.** Shell (Desktop/Tablet/Phone) hanya bertugas menampilkan. Semua data kerja (draft, progress approval, filter aktif, dsb) hidup di Context/Store level aplikasi, bukan di komponen shell. Tes: "kalau device diputar sekarang, apakah data ini harus tetap ada?" — kalau ya, taruh di global state.
2. **Logic sensitif (Engineer, verifikasi patch) tetap terpusat di backend/kernel**, tidak boleh diduplikasi ke tiap shell. Shell hanya konsumen.
3. **Komunikasi antar modul lewat `EventBus`/`ServiceManager` yang sudah ada**, bukan koneksi langsung antar komponen.
4. **Jangan buat fitur tanpa masalah nyata** — setiap fitur di roadmap ini sudah melalui diskusi validasi; jangan menambah scope baru tanpa alasan konkret.
5. **Siapkan kran untuk native Android**: jangan taruh logic penting di frontend web yang tidak bisa diakses platform lain lewat backend API yang sama.

---

## FASE 1 — Device & Capability Detection (Fondasi)

### 1.1 Perluas `DiscoveryManager.js` dengan validasi silang

File: `frontend/src/core/runtime/DiscoveryManager.js`

**Tujuan:** deteksi `device` (`phone` | `tablet` | `desktop`) tidak boleh murni dari regex User-Agent — harus divalidasi silang dengan lebar layar aktual (`window.innerWidth`, BUKAN `screen.width`, karena `innerWidth` mencerminkan ruang viewport aktual termasuk saat split-screen).

**Aturan resolusi (urutan prioritas):**

```
1. Jika window.electronAPI atau process.versions.electron ada → 'desktop' (tidak perlu validasi lebar, langsung final)
2. Selain itu, deteksi awal dari UA (existing regex), lalu validasi:
   - UA = tablet DAN innerWidth >= 600  → 'tablet'
   - UA = tablet DAN innerWidth < 600   → override jadi 'phone'
   - UA = mobile/phone DAN innerWidth < 600  → 'phone'
   - UA = mobile/phone DAN innerWidth >= 600 → override jadi 'tablet'
   - UA tidak terdeteksi (desktop UA) → pakai innerWidth murni:
       innerWidth < 600        → 'phone'
       600 <= innerWidth < 1024 → 'tablet'
       innerWidth >= 1024      → 'desktop'
```

Threshold 600px dan 1024px adalah standar umum (Bootstrap/Material) — boleh disesuaikan kemudian, tapi definisikan sebagai konstanta bernama, jangan angka mati di tengah kode (misal `BREAKPOINT_PHONE_MAX = 599`, `BREAKPOINT_TABLET_MAX = 1023`).

### 1.2 Tambah deteksi orientasi sebagai bagian dari device classification

- `phone` dipecah jadi 2 sub-state: `phone-portrait` dan `phone-landscape` (dari `screen.orientation.type` atau fallback `innerWidth < innerHeight`).
- `tablet` dan `desktop` **tidak** dipecah orientasi — treatment sama di kedua orientasi (sudah disepakati, tablet punya ruang cukup di keduanya).

### 1.3 Buat deteksi reaktif (bukan cuma sekali di `initialize()`)

- Tambahkan listener untuk `resize` dan `orientationchange` yang memicu ulang kalkulasi device/orientasi.
- Setiap perubahan yang menghasilkan device/orientasi berbeda dari sebelumnya → emit event baru, misal `Discovery:DeviceChanged` dengan payload `{ device, orientation, previousDevice, previousOrientation }`.
- **Penting:** jangan emit event kalau hasil deteksi sama dengan sebelumnya (hindari event spam saat resize kecil-kecil).

### 1.4 Tambah override manual (mutlak, persisten)

- Tambah method `setManualOverride(device)` dan `clearManualOverride()` di `DiscoveryManager`.
- Simpan override di `localStorage` (key misal `mamet:device-override`), supaya bertahan lintas reload.
- **Aturan mutlak:** kalau override aktif, dia menang total atas hasil deteksi otomatis — deteksi otomatis tetap jalan di background (untuk data lain seperti network/storage), tapi field `device` dan `orientation` yang dipublikasikan ke luar (event, `getDiscoveryInfo()`) ikut override sampai `clearManualOverride()` dipanggil user secara eksplisit.
- Sediakan getter `isOverrideActive()` supaya UI bisa menampilkan indikator "mode dipaksa: Desktop" ke user.

### Kriteria Selesai Fase 1
- [ ] `DiscoveryManager` mengembalikan salah satu dari: `desktop`, `tablet`, `phone-portrait`, `phone-landscape`
- [ ] Perubahan orientasi/resize memicu event tanpa reload halaman
- [ ] Override manual tersimpan persisten dan menang mutlak atas auto-detect
- [ ] Ada unit test untuk tabel resolusi UA+lebar di atas (semua kombinasi)

---

## FASE 2 — State Layer (Sebelum Bikin Shell)

**Kenapa fase ini sebelum shell:** shell akan di-mount/unmount saat orientasi berubah (lihat Fase 3), jadi state harus sudah aman di level global SEBELUM shell dibangun, supaya tidak ada bug "data hilang saat rotate" dari awal.

### 2.1 Buat `DeviceContext` (React Context)

- Bungkus `DiscoveryManager` instance, expose lewat hook `useDevice()` yang mengembalikan `{ device, orientation, capabilities, isOverrideActive, setOverride, clearOverride }`.
- Context ini yang subscribe ke event `Discovery:DeviceChanged` dari `EventBus`, lalu re-render consumer yang relevan saja (bukan seluruh tree).

### 2.2 Audit state yang ada sekarang di komponen UI

- Untuk setiap komponen UI yang sudah ada dan akan terdampak shell baru (Engineer dashboard, approval dialog, dsb): identifikasi state lokal mana yang sebenarnya harus jadi state global.
- Pindahkan state kerja penting (draft, progress alur approval, filter/scroll yang perlu dipertahankan) ke store/context level app.
- State yang boleh tetap lokal: state UI murni yang tidak masalah hilang saat shell berganti (dropdown terbuka/tertutup, animasi, dsb).

### Kriteria Selesai Fase 2
- [ ] `useDevice()` hook tersedia dan dipakai minimal di satu komponen uji coba
- [ ] Daftar state yang dipindah ke global sudah didokumentasikan (state audit checklist)

---

## FASE 3 — Adaptive Shell (Komponen Terpisah per Device)

### 3.1 Struktur file

```
frontend/src/shells/
  DesktopShell.jsx
  TabletShell.jsx
  PhonePortraitShell.jsx
  PhoneLandscapeShell.jsx
  AppShell.jsx        <- router/selector, baca useDevice() lalu render shell yang sesuai
```

Pendekatan: **komponen terpisah total** (bukan satu komponen dengan banyak `if (variant === ...)`) — disepakati karena lebih mudah dirawat solo developer meski ada duplikasi.

### 3.2 `AppShell.jsx` sebagai selector

- Baca `device` dan `orientation` dari `useDevice()`.
- Render shell yang sesuai. Saat shell berganti (unmount lama, mount baru), pastikan tidak ada data hilang — validasi terhadap kerja Fase 2.
- Tampilkan indikator kecil kalau `isOverrideActive()` true (misal badge "Mode: Desktop (dipaksa)" dengan tombol untuk `clearOverride()`).

### 3.3 Feature-gating per shell berdasarkan `capabilities`

Untuk setiap fitur yang butuh capability tertentu, cek dulu lewat `useDevice().capabilities` sebelum render versi penuhnya:

| Fitur | Kondisi Desktop | Kondisi Phone/Tablet (tanpa `file-system`) |
|---|---|---|
| Browse/edit file repo | Full akses baca-tulis | Read-only via API backend |
| Terminal/Engineer live log | Full stream log real-time | Ringkasan status saja (bukan full log) |
| Approval dialog | Full (sudah prima) | **Harus tetap full/prima** — ini use-case utama companion, jangan didowngrade |

### Kriteria Selesai Fase 3
- [ ] 4 shell terpisah ter-render sesuai device+orientasi
- [ ] Approval dialog teruji penuh fungsional di PhonePortraitShell dan PhoneLandscapeShell
- [ ] Fitur berat (file browse, live log) terbukti ter-downgrade sesuai tabel di atas, tidak error saat capability tidak ada

---

## FASE 4 — Companion Delivery (PWA)

*(Detail teknis PWA — manifest, service worker — didiskusikan terpisah saat fase ini mulai dikerjakan; belum dirinci di sini karena keputusan platform akhir PWA vs Capacitor bisa menunggu hasil pemakaian Fase 1–3.)*

- Tambahkan `manifest.json` + service worker dasar (`vite-plugin-pwa`) supaya bisa "Add to Home Screen".
- Sambungkan approval dialog ke Supabase realtime untuk update status tanpa polling.

---

## Ditunda dengan Sengaja (Kran untuk Nanti, Bukan Dikerjakan Sekarang)

- **Native Android (Kotlin)** — ditunda sampai companion app terbukti tidak cukup lewat pemakaian nyata. Syarat agar mudah dibangun nanti tanpa rombak besar:
  - Semua logic penting (Engineer, verifikasi patch) tetap di backend Express/Supabase, bisa diakses platform apa pun lewat API yang sama.
  - `DiscoveryManager` diperlakukan sebagai kontrak/konsep (deteksi platform, device, capability), bukan kode yang harus dipindah — versi Kotlin nanti mengisi kontrak yang sama dengan API Android native (`PackageManager.hasSystemFeature()`, `smallestScreenWidthDp`, dsb).
  - `EventBus`/`ServiceManager` tetap jadi pola komunikasi standar — shell baru (native) tinggal jadi consumer baru.
- **NSD/mDNS untuk auto-discovery Electron di jaringan lokal** — disebut dalam diskusi sebagai kemungkinan, belum ada keputusan untuk dikerjakan; jangan dikerjakan tanpa konfirmasi ulang.
- **`LocalizationManager` (bahasa manusia/UI)** — disepakati sebagai service terpisah dari `DiscoveryManager`, tapi belum masuk prioritas kerja; catat sebagai modul terpisah kalau nanti dibutuhkan, jangan digabung ke `DiscoveryManager`.

---

## Catatan untuk AI Coding Tool yang Mengerjakan Ini

- Kerjakan berurutan per fase — jangan mulai Fase 3 sebelum Fase 1 & 2 selesai dan lulus kriteria.
- Jangan menambah dependency/library baru di luar yang sudah disebutkan tanpa memastikan sudah ada di `package.json` project.
- Jangan implementasikan bagian "Ditunda dengan Sengaja" kecuali diminta eksplisit oleh Mamet.
- Semua breakpoint dan angka ambang (600px, 1024px) harus jadi konstanta bernama di satu tempat, mudah diubah kalau ternyata tidak cocok setelah dites di device asli.

---

## Telaah terhadap Kode & Saran Urutan (2026-09-12, dipindah dari INDEX Item 72 pada 2026-09-17)

- **Asal:** `docs/roadmap/roadmap-adaptive-shell.md` (158 baris, ditulis di luar sesi ini). Owner meminta ditelaah dan didaftarkan. **Belum dikerjakan.**
- **Isi rencana:** Fase 1 deteksi device/orientasi di `DiscoveryManager` (validasi silang UA + `innerWidth`, event reaktif, override manual persisten); Fase 2 angkat state kerja ke Context sebelum shell dibangun; Fase 3 empat shell terpisah (`DesktopShell`, `TabletShell`, `PhonePortraitShell`, `PhoneLandscapeShell`) + `AppShell` sebagai selector, dengan feature-gating per capability; Fase 4 PWA (`vite-plugin-pwa`, manifest, service worker) + Supabase realtime untuk approval. Native Android, mDNS, dan `LocalizationManager` sengaja ditunda.
- **Diperiksa terhadap kode (2026-09-12):**
  - ✅ **Masalahnya nyata.** `DiscoveryManager.detectDevice()` memang murni regex User-Agent (baris 73–83); `innerWidth` sudah ikut dicatat di `getScreenInfo()` (baris 179) tapi tidak dipakai untuk klasifikasi. `AppShell.jsx` (162 baris) hanya memuat **1** kelas responsif Tailwind — jadi UI HP berantakan bukan dugaan.
  - ⚠️ **Nama `AppShell` sudah dipakai.** `frontend/src/components/workbench/AppShell.jsx` sudah ada (plus `components/os/OSDesktopShell.jsx`). Membuat `frontend/src/shells/AppShell.jsx` akan menimbulkan dua komponen bernama sama; sebaiknya yang ada dipakai/di-rename, bukan ditambah.
  - ⚠️ **Fase 4 melanggar aturan rencana itu sendiri.** Dokumen melarang menambah dependency di luar `package.json`, sedangkan `vite-plugin-pwa` (dan workbox) belum ada di `frontend/package.json`. Perlu keputusan eksplisit Owner.
  - ❔ Klaim "backend Express di Vercel" konsisten dengan adanya `backend/vercel.json`, tapi jalur mana yang benar-benar dipakai versi web belum diverifikasi (lihat Item 49). `EngineerApprovalDialog.jsx` memang ada, jadi use-case approval di HP masuk akal.
- **Catatan telaah (pendapat saya, keputusan tetap Owner):**
  1. **Empat shell terpisah mahal untuk pengembang tunggal.** Pemisahan `phone-portrait` vs `phone-landscape` sebagai dua komponen memberi manfaat paling kecil (HP landscape ≈ tablet kecil) dengan biaya rawat paling besar. Saran: **dua** komponen (yang ada untuk desktop/tablet + satu `PhoneShell`), orientasi ditangani CSS/Tailwind.
  2. **Sebagian Fase 2 muncul karena pilihan Fase 3.** "Data hilang saat rotate" adalah akibat shell di-unmount saat orientasi berubah. Kalau orientasi ditangani CSS, risiko itu hilang dan Fase 2 menyusut jadi sekadar higiene.
  3. **Ada jalan murah yang tidak tercantum:** rapikan dulu 3 layar yang benar-benar dipakai dari HP (chat Assistant, unggah Research App, dialog approval) dengan breakpoint Tailwind — tanpa perubahan arsitektur. Setelah dipakai nyata, baru dinilai apakah shell terpisah memang perlu.
  4. **Kenyataan HP dari Item 69 belum masuk rencana:** ekstraksi PDF di HP 3–5× lebih lambat, tab latar belakang bisa dihentikan browser saat unggah, dan batas 60 MB. Ini syarat nyata untuk "companion", layak ditulis sebagai batasan Fase 3/4.
  5. Ambang 600/1024 px sebagai konstanta bernama: setuju, dan sebaiknya satu sumber yang sama dipakai Tailwind maupun `DiscoveryManager`.
- **Status:** 📋 **Rencana terdaftar, belum dikerjakan.** Saran urutan: kerjakan poin 3 dulu (murah, langsung terasa), lalu Fase 1 (deteksi + override, berdiri sendiri dan berguna), lalu putuskan Fase 2–3 setelah ada bukti pemakaian.
