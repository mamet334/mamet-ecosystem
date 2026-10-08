# 8 Oktober 2026 — jendela putih 4.2.15: renderer mati, dan aplikasi tak punya mulut untuk mengatakannya

Item 125 **E9** ([`ROADMAP-SIAP-PENGGUNA.md`](../../roadmap/ROADMAP-SIAP-PENGGUNA.md)). Lahir dari
pertanyaan Owner: *"coba periksa kenapa aplikasi mamet ai yang terinstall kok blank putih? apakah
karena ngeleg saja?"*

**Jawabannya: bukan ngeleg, dan bukan dari kode repo ini.** Tetapi penyelidikannya menemukan satu
cacat yang memang milik repo ini, dan itulah yang diperbaiki di sini.

---

## 1. Apa yang sebenarnya terjadi

Yang terpasang **4.2.15** (diperiksa dari `package.json` di dalam `app.asar`), jadi dugaan pertama —
dan dugaan yang benar untuk dicurigai — adalah build yang baru saja saya dorong.

Satu-satunya jejak di log:

```
[FATAL] loadURL mamet:// gagal: ERR_FAILED (-2) loading 'mamet://app/index.html'
```

Nol baris renderer. Jejak itu menyebut **akibat** (navigasi gagal) dan menyembunyikan **sebab** —
dan karena itu arah pertama diagnosisnya salah: ia menunjuk ke "berkas tidak ada di asar".

Yang membalikkannya adalah DevTools Protocol, dijalankan pada aplikasi terpasang itu sendiri:

| | Yang terlihat |
|---|---|
| 1 | penangan `mamet://` mengembalikan **`200 text/html`** — berkasnya ADA dan terkirim |
| 2 | target halamannya menjawab **`Target crashed`** — proses renderer-nya MATI |
| 3 | dokumennya lalu `net::ERR_ABORTED (canceled)`, dan `loadURL` menolak `ERR_FAILED` |
| 4 | satu `Page.reload` memulihkannya sampai `Kernel Boot Complete — SYSTEM READY` |

## 2. Yang disingkirkan dengan uji, bukan dengan dugaan

Berurutan, karena tiap langkah mempersempit dan beberapa di antaranya terasa "pasti ini":

- **isi asar** — header dibaca langsung; `dist/index.html` ada (2.544 byte) dan isinya sah;
- **integritas asar** — exe mengharapkan `9e93f7e6…`, header asar menghasilkan tepat itu; fuse-nya
  bahkan **mematikan** validasi itu;
- **versi Electron** — 42.3.3 / chrome 148 di keduanya (dibaca lewat `ELECTRON_RUN_AS_NODE`);
- **`main.cjs`** — hash isi asar == hash di repo;
- **logika penangan protokol** — ditiru apa adanya dan diarahkan ke dist DI DALAM asar terpasang:
  melayani 200 untuk semua berkas, halaman boot normal;
- **preload + sandbox** — ditiru juga, tetap normal;
- **instance ganda & cache terkunci** — tiga proses yang terlihat ternyata satu instance Electron;
  sesudah semuanya ditutup, tetap gagal;
- **folder data** — `--user-data-dir` baru, tetap gagal;
- **GPU** — `--disable-gpu`, tetap gagal;
- **17 berkas runtime Electron** — dibandingkan dengan build segar: **identik byte-per-byte**;
- **antivirus / suntikan DLL** — hanya Defender, `AppInit_DLLs` kosong, nol catatan di Event Log.

Lalu matriks exe × asar, yang menunjuk arah sesungguhnya:

| exe | asar | hasil |
|---|---|---|
| CI | CI — **salinan terpasang** | **GAGAL berulang** (6×) |
| CI | lokal | muatan pertama menolak, lalu boot |
| lokal | CI | **boot bersih** |
| lokal | lokal | **boot bersih** |

Bukan exe-nya, bukan asar-nya. Yang gagal **khusus salinan di folder instalasi**.

## 3. Akarnya, dan ia di luar repo

Penentunya satu uji yang tidak menyentuh setelan apa pun: aplikasi terpasang disalin **apa adanya**
ke folder berizin normal, lalu dijalankan. **Boot sempurna** — 182 baris renderer, `SYSTEM READY`.
Satu-satunya variabel yang berubah adalah izin folder.

`%LOCALAPPDATA%\Programs` sudah dikeraskan oleh **sandbox Codex** (grup `CodexSandboxUsers`,
*"Codex sandbox internal group (managed)"*, + satu SID AppContainer miliknya). ACL-nya **tidak lagi
memuat `BUILTIN\Users` mau pun `ALL APPLICATION PACKAGES`**, dan seluruh ACE di folder Mamet AI
**diwariskan** dari situ (`IsInherited: True`) — jadi bukan installer Mamet yang memasangnya.

Renderer Chromium berjalan dengan token terbatas yang SID penggunanya dijadikan *deny-only*. Tanpa
ACE untuk `Users`/`ALL APPLICATION PACKAGES`, ia tak bisa membaca binernya sendiri → mati sebelum
satu baris JS jalan → jendela putih. Itu juga sebabnya `--no-sandbox` melolosan muatan pertama
(token penuh).

**Konsekuensinya:** 4.2.15 sendiri sehat (terbukti boot dengan chunk CI `index-Bt2HthB4.js`), dan
kondisi ini menimpa **setiap** aplikasi berbasis Chromium yang terpasang di folder itu. Perbaikannya
memberi izin baca pada folder instalasi (`icacls … *S-1-5-32-545`, `*S-1-15-2-1`) — **setelan
keamanan, jadi keputusan Owner**, bukan dikerjakan asisten atas inisiatif sendiri.

`--no-sandbox` **ditolak** sebagai jalan keluar: ia menambal gejala dengan membatalkan TMN-0009 yang
baru dipasang 6 Okt.

## 4. Yang diperbaiki di repo ini

Cacatnya bukan sebab layar putih, melainkan **kebutaannya**: `main.cjs` tidak punya
`render-process-gone` mau pun `did-fail-load`. Satu kematian renderer = satu baris `[FATAL]` yang
menyesatkan, lalu diam. Diagnosis di atas memakan belasan langkah karena itu.

- **`render-process-gone`** → `[RENDERER MATI] alasan=… exitCode=… (0x…)`. Heksadesimal karena itu
  bentuk yang bisa dicari (`0xC0000005` pelanggaran akses, `0xC0000428` DLL asing ditolak).
- **`did-fail-load`** → `[MUAT GAGAL] …`, hanya untuk bingkai utama, dan `-3` (ERR_ABORTED) tidak
  dihitung kegagalan karena ia navigasi yang disela.
- **Pemulihan muat-ulang berbatas 3**, dengan penjaga `sedangPulih` karena satu kematian menyalakan
  **dua** penangan sekaligus.

**Batas kejujurannya, dan ini penting:** pemulihan itu **TIDAK menolong kasus ACL di atas** —
ketiga percobaan ikut mati. Yang menolong adalah baris yang **menamai** sebabnya. Pemulihan ada
untuk kematian sesaat; batas 3 ada supaya kerusakan nyata tidak diputar tanpa henti.

## 5. Bukti

- **Dijalankan di build TERPAKET** (`electron-builder --win --dir`), bukan hanya `electron.exe`,
  karena justru pengemasan yang membedakan: `[RENDERER MATI] alasan=crashed exitCode=143 (0x8F)` →
  `[PULIH] renderer mati (crashed) — memuat ulang (percobaan 1/3)`. (143 = SIGTERM dari `timeout`
  uji; penangannya memang menyala pada kematian apa pun.)
- `uji-cangkang-electron.mjs` **v1 → v2**, 11 asersi baru; penanda versi dinaikkan supaya log tak
  bisa berbohong soal versi mana yang jalan.
- **Tiga mutasi menggigit** — dan yang kedua memperbaiki ujinya sendiri:

| Mutasi | Hasil |
|---|---|
| `BATAS_MUAT_ULANG = 99` | GAGAL *"pemulihan BERBATAS"* |
| penjaga `sedangPulih` dicabut, deklarasinya ditinggal | **HIJAU PALSU** pada bentuk pertama asersi (`/sedangPulih/` tetap cocok dengan deklarasinya) → asersi diperketat ke bentuk penjaganya, lalu GAGAL sebagaimana mestinya |
| `render-process-gone` diganti nama peristiwa | GAGAL *"kematian renderer bersuara"* |

- Suite penuh **95/95**, nol dilewati.

**Tidak memicu rilis:** `build.yml` memicu build dari perubahan path `frontend/package.json`;
perubahan ini hanya `frontend/electron/main.cjs` + `uji/`. Jadi saat ditulis, muatan ini **belum ada
di .exe mana pun**. *(Beberapa jam kemudian ia dikirim lewat 4.2.16 dan terbukti live — lihat §6.)*

> **Catatan pengiriman (8 Okt, sesudah dua koreksi):** muatan ini dikirim lewat **4.2.16** — versi
> dinaikkan atas perintah Owner. Dua hal menahan sesuatu sampai ke mesin: belum ada build, **dan**
> rilisnya belum diterbitkan. Saya sempat menulis bahwa yang kedua bukan penahan; klaim itu
> **dicabut** — pengukurannya diambil sesudah 4.2.15 terbit (rinciannya di
> [log E8+C10b](./2026-10-08-pengerasan-ws-assistant.md), "Koreksi kedua … dan KETIGA"). Yang
> terbukti: sesudah Publish, aplikasi menarik sendiri dalam hitungan menit — termasuk saat jendelanya
> putih, karena pembaru hidup di proses utama, bukan di renderer yang mati.

---

## 6. Penutupan ujung ke ujung — sore 8 Okt

### Sebabnya dicabut: `icacls` dijalankan atas izin Owner

Owner menjawab *"jalankan"*, dengan cakupan yang saya usulkan: **folder Mamet AI saja**, bukan
`%LOCALAPPDATA%\Programs`.

```
icacls "…\Programs\Mamet AI" /grant "*S-1-5-32-545:(OI)(CI)(RX)" "*S-1-15-2-1:(OI)(CI)(RX)" /T /C
→ Successfully processed 160 files; Failed processing 0 files
```

| | ACL folder instalasi |
|---|---|
| **sebelum** | `CodexSandboxUsers` (RX) · SID AppContainer Codex (F) · SYSTEM · Administrators · HP — **semuanya `IsInherited: True`** |
| **sesudah** | **+ `BUILTIN\Users` (RX)** dan **+ `ALL APPLICATION PACKAGES` (RX)**, keduanya `IsInherited: False` |

ACE barunya **eksplisit, bukan warisan** — itu disengaja: ia menempel pada folder Mamet saja,
pengerasan Codex di folder induk tidak disentuh, dan mencabutnya kembali cukup satu perintah.

### Bukti aplikasinya hidup

Aplikasi **terpasang** dijalankan sesudah itu:

```
232 baris renderer · MAEF Kernel Bootstrap Complete — SYSTEM READY · Mounting UI
FATAL: 14 → 14   (nol tambahan)
```

Bandingkan dengan sebelum perbaikan: **nol** baris renderer dan satu `[FATAL]` tiap kali dijalankan,
enam kali berturut-turut.

### Dan E9 sendiri terbukti LIVE di jalan yang sama

Log jalan itu memuat baris dari penangan yang baru dipasang:

```
[RENDERER MATI] alasan=crashed exitCode=143 (0x8F)
```

(143 = SIGTERM, dari `timeout` uji saya — bukan kerusakan.) Diperiksa: versi di dalam `app.asar`
terpasang **4.2.16**, dan rilisnya `published_at = 2026-10-08T15:38:13Z` — Owner menekan Publish
sendiri, aplikasi menariknya **2 menit** kemudian (cache pembaru: installer 189.544.694 byte, persis
ukuran aset rilisnya).

Jadi tujuan E9 tercapai bukan di atas kertas: **kalau renderer mati lagi, Owner mendapat sebabnya
dalam satu baris**, bukan dua belas langkah penyelidikan.

### Yang tetap terbuka

Pengerasan itu milik sandbox Codex. **Bila alat itu memasang ulang aturannya, ACE ini bisa tercabut
dan layar putih kembali.** Obat yang tahan lama bukan mengulang `icacls`, melainkan mengecualikan
folder tersebut di sandbox Codex-nya. Dicatat juga di `INDEX-ROADMAP.md` §5b dan di memori
`project-acl-programs-sandbox-codex`.
