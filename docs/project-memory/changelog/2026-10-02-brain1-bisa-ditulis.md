# 2 Oktober 2026 — Brain 1 dibersihkan, dan Engineer akhirnya bisa menambahnya

## Owner yang menunjuk ke sana

> *"ada yang lebih penting, yaitu engineer belum bisa menulis agar bisa semakin pintar terhadap
> pengetahuan mamet ecosystem, yaitu penulisan untuk project memory entries."*

Dan ia benar. Tetapi keadaannya lebih buruk daripada "belum bisa menulis".

## Yang diukur

Blok yang dikirim ke model dengan judul **"BRAIN 1 — STATIC ENGINEERING KNOWLEDGE … Source of truth
for architecture & rules"** ternyata:

| | |
|---|---|
| Total baris | **15** |
| Dibuat | **semuanya 27 Juni 2026** — satu hari, lalu berhenti |
| Sejak itu | tiga bulan kerja rekayasa, **nol tambahan** |
| Jalur tulis di seluruh repo | **tidak ada** — hanya dibaca `engineer_context.ts` & dicadangkan `cadanganData.js` |

Dan 8 slot yang dibacanya berisi:

- **Duplikat.** `ADR-0007` dua kali, `Engineer Dashboard Frontend Component` dua kali — keduanya
  `ACTIVE`, `is_current: true`.
- **Klaim yang sudah salah.** Satu `Solution` berbunyi *"Created EngineerDashboard.jsx in
  frontend/src/components"* — berkas itu **tidak ada**.

Akibatnya **3 dari 8 slot** terpakai duplikat/klaim basi, sehingga **2 entri yang sahih tidak pernah
sampai ke model** (`MametLite memory isolation` dan `Windows build pipeline fails via PowerShell
npm`).

Itu menjelaskan kenapa laporan Engineer selalu berbunyi `[✓] ADR` tanpa pernah menyebut satu pun
hal yang dikerjakan belakangan: memang tidak ada yang pernah masuk.

## Tahap 1 — dibersihkan (dinonaktifkan, bukan dihapus)

Tiga baris dipensiunkan: `is_current = false`, dan `governance_status` jadi `SUPERSEDED` (duplikat
ADR-0007 yang lebih tipis) atau `DEPRECATED` (dua baris Engineer Dashboard).

**Tidak dihapus** — riwayatnya tetap ada dan keputusannya bisa ditarik kembali. Pembaca sudah
menyaring keduanya, dan `engineer_context.ts` bahkan mencetak `[GOVERNANCE] Skipped …` sehingga
pensiunnya terlihat, bukan hilang diam-diam.

**Hasil: 7 entri unik, semuanya masih benar, dan ketujuhnya muat dalam batas 8.** Dua entri yang
dulu tersingkir kini sampai ke model.

### Satu koreksi atas ucapan saya sendiri

Saya sempat melaporkan entri *"Engineer capability boundary via appSource: engineer"* sebagai sudah
tidak berlaku. Diperiksa ulang terhadap `universal_contract.ts`: `canWriteMemory`, `canUseAutomation`,
dan `canUseDesktopTools` **memang masih tertutup** untuk Engineer. Entri itu benar, dan tidak jadi
disentuh.

## Tahap 2 — jalur tulis, dengan pola yang sudah terbukti hari ini

`PengetahuanBrain1.js` (baru). Engineer mengusulkan blok eksplisit; **Owner menekan tombol**; baru
tersimpan. Persis pola `<temuan>` yang kemarin membuktikan dirinya (1 temuan dalam seminggu → 3
dalam sehari).

```
<pengetahuan jenis="Lesson|RootCause|Solution|ADRLink" judul="pendek, bisa dicari, unik">
Apa dan KENAPA itu penting, beserta buktinya.
</pengetahuan>
```

Keputusan rancangannya:

| | Alasan |
|---|---|
| **Bentuk eksplisit, prosa tidak ditangkap** | sama seperti `<temuan>` & `<uji_klaim>`. Tiga kali sistem ini tertipu karena menebak maksud dari teks bebas. Lebih baik terlewat dan **terlihat** terlewat |
| **Blok cacat dilaporkan, bukan ditelan** | blok tanpa judul/isi muncul di Console dengan alasannya. Membuangnya diam-diam = cacat yang sama bentuknya dengan peta yang hilang tanpa tanda |
| **Jenis dinormalkan, bukan ditolak** | `lesson`/`ROOTCAUSE` → dikenali; jenis tak dikenal → `Lesson`. Menolak gara-gara satu atribut salah ketik berarti membuang isinya |
| **Judul dibaca ULANG dari database sebelum menulis** | Brain 1 bisa berubah dari perangkat lain. Duplikat bukan kerugian teoretis — ia terbukti memakan 3 dari 8 slot |
| **Ditandai `Hypothesis`, `created_by: 'engineer'`** | pengetahuan baru belum terbukti, dan harus bisa dibedakan dari 15 baris seed Juni yang bernilai `'system'` |
| **`approved_by` / `approved_at` diisi** | klik Owner itulah persetujuannya, dan persetujuan layak tercatat |

### Kenapa di database, padahal temuan di berkas repo

`IngatanTemuan.js` sengaja memilih berkas di dalam repo: Owner bisa mengoreksi, ikut ter-commit,
selamat walau database dibersihkan. Brain 1 **tidak bisa** begitu — ia dibaca edge function, dan edge
function tidak punya akses ke repo.

Jadi keduanya memang beda rumah. Dan rumah yang di database inilah yang baru saja terbukti bisa
**membusuk diam-diam selama tiga bulan** tanpa seorang pun tahu — karena itu bentuknya dibuat
sesempit mungkin dan selalu lewat persetujuan Owner.

## Model DIBERI TAHU kemampuannya

Pelajaran termahal 1 Oktober: **kemampuan yang tidak disebut di prompt tidak akan pernah dipakai.**
Engineer punya `git grep` berminggu-minggu sambil dilarang memakainya, dan diam saja.

Jadi `engineer_context.ts` kini mengajarkan langkah `[0.2d]` — bentuk bloknya, syarat judul unik,
dan dua larangan yang lahir dari kesalahan nyata:

- **jangan mencatat nomor sesi/patch** — persis yang dibuang 1 Oktober
- **jangan mencatat yang sudah dijawab `git`** ("apa yang berubah, kapan") — catat yang `git`
  **tidak bisa** jawab: kenapa

## Uji

`uji/uji-pengetahuan-brain1.mjs` (baru) — 38 pemeriksaan: blok benar terbaca, prosa **tidak**
ditangkap, blok cacat dilaporkan, jenis dinormalkan, duplikat disaring, kolom wajib database terisi,
terpasang di layar, dan model diberi tahu.

**71/71 berkas uji hijau.** Bundel esbuild `agent-process` bersih.

### Jebakan yang tertangkap, dua-duanya hari ini juga

**Backtick menggagalkan bundel.** Teks instruksi ditulis di dalam template literal raksasa; satu
backtick di dalamnya **menutup literal itu** dan esbuild menolak dengan
`Expected ";" but found "judul"`. Ditangkap **sebelum** meminta deploy — itulah gunanya aturan
"bundel dulu, baru minta deploy". Satu asersi baru menjaganya supaya tidak terulang.

**Jendela pencarian uji terlalu pendek.** Asersi ikon memakai batas 500 huruf, padahal atribut
`title` tombolnya panjang — merah palsu. Diganti memotong sampai `</button>`, bukan menebak panjang.
Jebakan yang sama persis dengan asersi "tiap putaran membawa signal" kemarin.

## Perlu DEPLOY

`engineer_context.ts` ada di `agent-process`. Sisi kliennya ikut rilis berikutnya.

**Cara memastikan live:** minta Engineer mempelajari sesuatu tentang repo ini, lalu lihat apakah
tombol **"Simpan N pengetahuan"** muncul. Sesudah disimpan, buka percakapan baru dan tanyakan hal
yang sama — ia harus sudah mengetahuinya dari Brain 1.
