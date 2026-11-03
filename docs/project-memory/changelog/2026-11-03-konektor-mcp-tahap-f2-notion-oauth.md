# 3 November 2026 — Konektor MCP Tahap F2: Notion lewat "Hubungkan akun" (OAuth), Tinjau alat untuk server besar, server v547

[Rancangan §10](../../roadmap/ROADMAP-KONEKTOR-MCP.md) · Item 129. Lanjutan
[F1](2026-11-03-konektor-mcp-tahap-f1-pipa-oauth.md). Tahap ini menyentuh desktop dan server.

## Yang dibangun

**Settings › Konektor:**
- **Resep `notion.json`** (data, bukan kode): server resmi `https://mcp.notion.com/mcp`, `oauth: true`, tanpa token
  yang diketik.
- **Bagian Akun** di kartu server OAuth, berisi tombol **Hubungkan akun** / **Hubungkan ulang** dan **Putuskan**.
  Tinjau alat dan sakelar baru aktif sesudah akun terhubung. Status "akun belum dihubungkan" dan "login kedaluwarsa"
  ditampilkan.
- **IPC** `konektor-umum:hubungkan` dan `konektor-umum:putuskan` (`ipcUmum.cjs`):
  - login dibuka di **browser sistem** (`shell.openExternal`);
  - sesudah terhubung, server yang sakelarnya menyala dinyalakan ulang;
  - **Putuskan** meminta konfirmasi lewat dialog, lalu mematikan server, mencabut izin di penyedia, dan menghapus
    token. Persetujuan alat tetap tersimpan;
  - **Hapus konektor** OAuth mencabut izin di penyedia lebih dulu, supaya tidak ada akses yang tertinggal di sana.
- Status untuk layar memuat `oauth` dan `terhubung`, tanpa token apa pun.
- **Menu +:** server OAuth yang belum terhubung dianggap belum siap, dan login yang kedaluwarsa ditandai titik merah.

**Tinjau alat untuk server besar** (permintaan Owner; Notion punya 68 alat):
- tombol **Tandai semua**, **Kosongkan**, dan **Tandai alat baca (N)**. Tombol terakhir memakai anotasi MCP
  `readOnlyHint` dari pembuat server; anotasi ini hanya bantuan dan tidak ikut sidik;
- label **baca** / **bisa menghapus** (`destructiveHint`);
- deskripsi panjang diringkas, dengan tombol "selengkapnya";
- **perkiraan token tambahan per pesan** untuk alat yang dicentang, dihitung oleh `perkiraanBlokKonektor` dengan
  baris yang sama dengan blok server.

**Batas alat dinaikkan** (`shared/konektorUmum.js`, dipakai desktop dan server):
- alat per konektor: **40 → 100**;
- blok prompt: **16.000 → 40.000 huruf**.

Protokol MCP sendiri tidak membatasi jumlah alat. Batas ini menjaga biaya per pesan dan ketepatan model memilih alat.

## Bukti

**Uji:**
- `uji-konektor-oauth-f2.mjs` v2 menguji **pintu IPC yang sebenarnya** dengan pengganti Electron, melawan server
  OAuth tiruan. Alur yang diuji: Pasang tanpa program → Hubungkan (browser sekali) → Tinjau (penanda baca / hapus) →
  Setujui → menyala → panggil lewat dialog izin → Putuskan (Batal / Ya) → hubungkan ulang (otomatis menyala) → Hapus
  (mencabut dulu).
- `uji-konektor-umum-g3.mjs` v2: Notion 68 alat masuk utuh ke blok, dan perkiraan beban sama dengan panjang baris di
  blok server.
- `uji-konektor-umum-g1.mjs` v2: contoh resep Owner diganti dari `notion` (kini bawaan) menjadi `catatan`.

**Mutasi pada salinan: 13/13 + 8/8 mati.**
- Satu mutan sempat lolos dan menunjukkan celah uji: setelah login ulang, server yang sakelarnya menyala harus otomatis
  menyala lagi. Ceknya sudah ditambahkan.
- Putaran pertama mutasi tambahan tidak sah, karena salinan G3-nya basi dan gagal walau tanpa mutasi. Salinan
  disegarkan dengan berkas lengkap, lalu diulang bersih.

**Lainnya:** penjaga `catch` tetap 91, `uji-ikon-subset` lulus, suite penuh **154/154**, bundel esbuild
`agent-process` 0 galat (batas baru ikut terbawa), dan `vite build` berhasil.

## Di aplikasi Owner (3 Nov)

- **Notion terhubung lewat OAuth.**
  - Halaman Notion menampilkan "Berikan akses **Mamet Ecosystem** ke Notion", ruang kerja "Ruang Andre Anastasya",
    dengan balikan ke `http://127.0.0.1:52897/balikan`.
  - Kartu Mamet menampilkan "Akun — terhubung", dan Tinjau alat membaca **68 alat**.
  - Di perangkat (diperiksa tanpa membuka token): brankas Notion hanya berisi `oauth-klien` dan `oauth-token` yang
    terenkripsi; teks `access_token`, `refresh_token`, maupun `client_id` tidak terbaca.
- **37 alat Notion disetujui lewat "Tandai alat baca".** Tidak ada satu pun alat tulis atau hapus (`create`, `update`,
  `delete`, `move`, dan sejenisnya), sesuai K21.
- Sakelar `ws-assistant` menyalakan github dan notion; `ws-engineer` kosong (K3). Menu + menampilkan Crawler (6),
  GitHub (27), dan Notion (37) menyala.

## Deploy (bukti platform)

- Owner men-deploy `agent-process`: versi **546 → 547**, `ACTIVE`, 08:26:26 UTC.
- Paket dibandingkan dengan repo: 100 dari 105 berkas sama persis. Lima sisanya berkas tipe yang memang kosong di
  paket. `shared/konektorUmum.js` di paket memuat batas 100 alat dan 40.000 huruf.
- **Pesan nyata dari Assistant** (08:31 UTC, saldo kosong):
  - log server memuat `[Konektor] aktif "ecosystem-crawler"` dan **`[KonektorUmum] aktif github(27 alat), notion(37
    alat)`**, sehingga alat yang disetujui Owner terbukti sampai ke server dan disusun menjadi blok prompt;
  - model berhenti di galat saldo (402, tidak diulang), sesuai dugaan.
- **Beban prompt terukur** dari `[PROMPT_KOMPOSISI]`:
  - bagian identitas dan panduan **3.790 huruf** tanpa konektor (uji K1, 02:50 UTC), menjadi **33.555 huruf** dengan
    crawler + GitHub 27 + Notion 37;
  - jadi tambahannya **±29.800 huruf ≈ 7,4 ribu token di setiap pesan Assistant**;
  - prompt sistem total 37.797 huruf.

**Yang belum terbukti (menunggu saldo):** model memakai alat Notion atau GitHub, dialog izin muncul di chat, dan token
diterima layanannya.
