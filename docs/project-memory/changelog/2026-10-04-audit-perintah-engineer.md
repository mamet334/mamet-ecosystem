# 4 Oktober 2026 — Perintah yang jalan tanpa izin akhirnya punya saksi

## Pertanyaan Owner

> *"logCommand apakah bisa dimanfaatkan?"*

Bisa — dan ia jelas ditulis untuk **satu tempat tertentu** yang sampai hari ini kosong.

## Celahnya baru saja membesar

`runCommand` ([AssistantService.js](../../../frontend/src/core/runtime/services/AssistantService.js)) adalah
**satu-satunya pintu** semua perintah Engineer. Ia tidak mencatat apa pun yang bertahan: yang ada
hanya event `Engineer:CommandExecuted` dalam memori dan state React — dua-duanya hilang saat
jendela dimuat ulang.

Yang membuatnya mendesak: **sejak 4.2.5 subperintah `git`-baca jalan tanpa dialog izin.** Sebelum
itu tiap eksekusi punya gerbang manusia, dan **dialognya sendiri adalah catatannya**. Kini sebagian
jalan tanpa saksi **dan** tanpa jejak.

Seluruh rantainya sudah ada sejak PR#1 — `AuditLogService` terdaftar di Kernel, tabel
`assistant_audit_log` ada di Supabase — dan **belum pernah mencatat satu baris pun** (0 baris),
karena satu-satunya pemanggil `log()` adalah `SKILL_EXECUTED`, bukan perintah.

## Jebakan yang akan membuatnya tersambung tetapi BUTA

Di dalam `log()`:

```js
const mustLog = logEntry.is_destructive || !logEntry.in_workspace;
if (!mustLog) return;
```

Perintah Engineer justru **read-only di dalam workspace**. Jadi `is_destructive === false &&
in_workspace === true`, dan fungsinya **pulang sebelum insert**. Menyambungkan `logCommand` begitu
saja menghasilkan fitur yang terlihat tersambung tetapi tidak mencatat apa pun — pola yang sama
dengan cacat `mimeType` pada lampiran gambar.

Diperbaiki dengan bendera eksplisit `wajibSimpan`, bukan dengan menebak-nebak keberbahayaan
perintah. Pemanggil lain (`SKILL_EXECUTED`) tidak mengirimnya, jadi perilakunya tidak berubah.
Logika aslinya pun terbalik dari yang dibutuhkan sekarang: **yang pantas disimpan justru yang
terjadi tanpa persetujuan Owner.** Perintah yang disetujui di dialog sudah punya saksi.

## Keluarannya TIDAK disimpan — hanya panjangnya

Nilai audit di sini adalah *"apa yang dijalankan atas nama saya, dan apakah saya sempat
melihatnya"*. Isi keluaran tidak menjawab itu, sudah ada di chat, dan menyalinnya ke basis data
hanya menambah tempat kebocoran:

- ia **isi berkas repo mentah**
- jalur ini di sisi **klien**, yang tak punya penyaring rahasia sama sekali (`saring_rahasia.ts`
  hanya ada di server)
- `agent_logs` **pernah benar-benar** menyimpan kunci API karena kelalaian yang sama

`.env`/`*.key` memang ditolak dibaca (T12), tetapi keluaran `git grep` masih bisa memuat token dari
berkas lain. Yang disimpan: perintah, berhasil/gagal, alasan, **panjang** keluaran, dan apakah ia
jalan tanpa izin.

## `tanpaIzin` datang dari proses utama, tidak ditebak ulang

Hanya `alatFolderJalan.cjs` yang tahu dialognya ditampilkan atau dilewati. Benderanya diteruskan
lewat hasil IPC, dan ditaruh **sesudah** `...h` supaya tidak bisa tertimpa hasil proses — ia
pernyataan tentang **gerbangnya**, bukan tentang eksekusinya.

Renderer **membaca** bendera itu. Menyimpulkannya dari teks perintah berarti menebak ulang aturan
yang justru ingin diaudit, dan tebakan itu akan menyimpang begitu daftar izinnya berubah.

Dicatat **di dalam `runCommand`**, bukan di pemanggilnya: kedua pemanggil UI (tombol manual &
jalan-sendiri) ikut tercakup, begitu pula pemanggil baru nanti, tanpa masing-masing perlu ingat.

## Lubang RLS — komentar yang berbohong, ketiga hari ini

Owner meminta RLS diperiksa lebih dulu. Hasilnya: kebijakan insert **bernama** "Service role can
insert audit logs", tetapi isinya:

| | |
|---|---|
| Peran | `{-}` = **PUBLIC**, bukan service_role |
| `WITH CHECK` | **`TRUE`** — tanpa syarat |

Akarnya ada di komentar migrasi `20260826000000`:

```sql
-- Service role boleh insert (AuditLogService memakai service role key)
```

**Asumsi itu salah.** `AuditLogService` mengimpor klien peramban bersama yang memakai **kunci
anon**. Karena penulisnya disangka service role, kebijakannya ditulis tanpa batasan peran — dan
kebijakan tanpa `TO` berlaku PUBLIC.

Akibat nyatanya: siapa pun yang punya kunci anon (ia ada di repo publik) bisa menyisipkan baris
audit apa pun, **termasuk baris ber-`user_id` Owner**. Dan karena kebijakan BACA menyaring
`auth.uid() = user_id`, baris palsu beralamat Owner akan tampil di matanya **sebagai asli**.

Jejak audit yang bisa ditulis siapa saja **lebih buruk daripada tidak ada jejak**: yang tidak ada
tidak menipu siapa pun. Ditutup sebelum baris pertama ditulis — tabelnya masih 0 baris, jadi tak
ada data yang perlu dipercaya atau dibuang.

Migrasi `20261004000000`: kolom `tanpa_persetujuan` (aditif, indeks parsial), kebijakan lama
dibuang, diganti `TO authenticated WITH CHECK (auth.uid() = user_id)`. `service_role` melewati RLS
sepenuhnya, jadi penulis sisi server (hari ini tidak ada) tetap bisa menulis. **Sudah diterapkan
dan diverifikasi** lewat `pg_policy`. Cara membalikkannya ikut dicatat di migrasinya.

## Uji

`uji/uji-audit-perintah.mjs` (baru) — 26 asersi. Ekspresi `mustLog` **diambil dari berkas sumber
lalu dijalankan**, dan aturan lamanya dijalankan berdampingan untuk membuktikan celahnya nyata
alih-alih diklaim.

| Mutasi | Asersi jatuh |
|---|---|
| M1 **jebakan**: `mustLog` dikembalikan ke aturan lama | 2 |
| M2 keluaran ikut disimpan apa adanya | 1 |
| M3 renderer menebak `tanpaIzin` alih-alih membacanya | 1 |
| M4 `tanpaIzin` bisa tertimpa hasil proses | 1 |
| M5 jalur tanpa dialog tidak menandai dirinya | 1 |
| M6 audit dicabut dari `runCommand` | 1 |

### Uji anti-busuk kemarin menyala tepat sebagaimana dirancang

`uji-komentar-tak-berbohong.mjs` **jatuh** begitu `logCommand` disambungkan: JSDoc-nya masih
berbunyi "YATIM", dan itu seketika jadi bohong. Ia menolak membiarkan komentarnya menyimpang
diam-diam — persis tugasnya.

Ikut ketahuan: asersi lama `/YATIM/.test(isi)` tetap **hijau secara keliru** sesudah penyambungan,
karena JSDoc baru memuat kata itu di kalimat sejarahnya (*"sebelumnya YATIM"*). **Pencocokan kata
telanjang tidak cukup untuk klaim yang berubah arah.** Arah asersinya dibalik: kini yang dijaga
adalah klaim "DIPAKAI", dan klaim itu pun diperiksa terhadap kodenya — jumlah pemanggil harus 2,
dan salah satunya harus benar `AssistantService`.

**79/79 berkas uji hijau.** Ketiga berkas kode lolos parser esbuild.

## Perlu RILIS KLIEN, tanpa deploy

`alatFolderJalan.cjs` ada di `frontend/electron/`, jadi **wajib build baru** — muat ulang renderer
tidak cukup. Tak ada perubahan edge function, jadi tidak perlu deploy. Migrasinya sudah diterapkan.

**Cara memastikan live:** jalankan `git status` lewat Engineer (jalan sendiri tanpa dialog), lalu:

```sql
select command, tanpa_persetujuan, result_reason, logged_at
from assistant_audit_log order by logged_at desc limit 5;
```

Harus muncul barisnya dengan `tanpa_persetujuan = true` dan `result_reason` memuat *"keluaran N
huruf (tidak disimpan)"*. Tabel yang tetap 0 baris berarti insert-nya ditolak — kemungkinan
besarnya sesi tidak terautentikasi saat itu.
