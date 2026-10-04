# 4 Oktober 2026 — TEMUAN-ENGINEER bersih: tiga komentar yang berbohong

## Apa yang ditutup

Owner bertanya mana kasus yang sudah bisa ditutup. Jawabannya ternyata **lebih banyak dari yang
tercatat**, dan satu di antaranya lebih buruk.

| | Keadaan sebenarnya saat diperiksa |
|---|---|
| **TMN-0001** | **sudah benar di kode** — tak ada yang perlu dikerjakan |
| **TMN-0002** | masih benar, dan **bertambah** salah oleh pekerjaan saya sendiri |
| **TMN-0003** | masih benar, dua hal salah sekaligus |

Ketiganya sekelas: bukan kode yang salah, melainkan **komentar yang berbohong**. Dengan TMN-0004
yang ditutup 2 Okt, `TEMUAN-ENGINEER.md` kini **tak punya satu pun temuan TERBUKA**.

## TMN-0001 — lahir sudah tertutup

Catatannya menuntut komentar `engineer.js` diperbaiki soal `_generateFallbackPatch`. Kodenya hari
ini sudah berbunyi *"dihapus total (T10, …)"* — tepat seperti yang diminta.

Diperbaiki di **`d677e83`: commit yang sama yang MEMBUAT berkas temuan itu.** Jadi ia lahir sudah
tertutup, lalu tercatat TERBUKA sepuluh hari karena tak ada yang memeriksanya ulang.

**Pelajarannya:** temuan yang berumur diverifikasi **sebelum** dikerjakan, bukan sesudah.

## TMN-0002 — saya sendiri yang memperburuknya

Komentar `ConversationEngine.jsx` berbunyi *"Tidak ada lagi: fetch(), supabase.from(), …"*.
Temuannya mencatat **dua** pelanggaran. Saat ditutup ada **tiga**: yang ketiga,
`supabase.from('project_memory_entries').insert(…)`, saya tambahkan 2 Okt (`bbfce3a`, Brain 1 bisa
ditulis) — **ditulis tepat di bawah komentar yang menyangkal keberadaannya.**

Komentar yang salah tidak menghalangi apa pun, jadi ia tidak cuma membusuk: ia **menarik
pelanggaran baru**.

`supabase.from()` dicabut dari daftar "tidak ada lagi", dan ketiga pemanggilnya didaftar.
Yang **tidak** dikerjakan, dan sengaja: memindahkan ketiganya ke `AssistantService`. Ketiganya
pembacaan/penulisan baris langsung tanpa logika keputusan; memindahkannya pekerjaan tersendiri,
bukan sesuatu yang diselundupkan lewat perbaikan komentar. Komentarnya kini pernyataan
**keadaan**, bukan aturan yang dilanggar.

## TMN-0003 — dua hal salah, bukan satu

JSDoc `logCommand` menyebut `commandName` berasal "dari CommandRegistry" — berkas itu sudah tidak
ada. Tetapi yang lebih penting tidak tercatat di temuannya: method ini **yatim**, nol pemanggil,
jadi **tak satu pun eksekusi command benar-benar tercatat lewat jalan ini**. Memperbaiki rujukannya
saja akan meninggalkan pembaca berikutnya menyangka jalur ini aktif.

Keduanya diperbaiki. **Fungsinya sengaja dibiarkan hidup** — penghapusan permanen menunggu
keputusan Owner, dan `this.log()` yang dipakainya tetap terpakai pemanggil lain.

## Uji: komentar yang membuat klaim faktual harus TETAP benar

`uji/uji-komentar-tak-berbohong.mjs` (baru) — 22 asersi.

Memeriksa "kalimatnya sudah diganti" tidak menutup kelas ini: kalimat baru pun akan membusuk, dan
TMN-0002 membuktikan pembusukannya bahkan **mengundang** pelanggaran. Jadi yang diuji adalah
apakah klaim di komentar masih **cocok dengan kodenya**:

- tabel & jumlah yang didaftar komentar harus sama dengan yang benar-benar dipanggil
- tabel yang dipanggil tanpa didaftar → jatuh
- `logCommand` masih yatim; begitu disambungkan, komentar "YATIM" jadi bohong dan uji jatuh lebih
  dulu, menuntut komentarnya ikut diperbarui

### Ujinya menangkap dua kesalahan saya sendiri

**Pertama, kelas pembusukan yang justru ia dibuat untuk menjaga.** Percobaan pertama perbaikan
TMN-0002 mencantumkan **nomor baris** (`:382`, `:452`, `:822`) — dan komentar perbaikan itu
sendiri menggeser ketiganya ~11 baris. Uji jatuh seketika. Nomor baris di komentar **pasti**
membusuk pada suntingan berikutnya, jadi rujukannya diganti ke tabel + jumlah, yang tidak bergeser
tetapi tetap jatuh begitu ada pemanggilan baru. Satu asersi kini **melarang** nomor baris kembali.

**Kedua, jebakan lama repo ini:** asersi hitungan `logCommand` jatuh karena JSDoc perbaikan di
atasnya menyebut `logCommand` untuk menjelaskan keyatimannya — uji tertipu komentar penjelasnya
sendiri, kesalahan yang sudah berulang kali menggigit di sini. Diukur pada kode tanpa komentar.

### Mutasi

| Mutasi | Asersi jatuh |
|---|---|
| M1 **cara TMN-0002 membusuk**: tabel keempat dipanggil tanpa didaftar | 1 |
| M2 jumlah bergeser (`chats` 3x, komentar tetap bilang 2x) | 1 |
| M3 klaim lama dikembalikan (`supabase.from` diaku tiada) | 1 |
| M4 nomor baris dipakai lagi | 3 |
| M5 `logCommand` disambungkan → komentar "YATIM" jadi bohong | 1 |
| M6 rujukan CommandRegistry dikembalikan | 1 |

M1 dan M2 yang terpenting: keduanya meniru **persis** cara TMN-0002 dulu membusuk.

**78/78 berkas uji hijau.** Kedua berkas lolos parser esbuild.

## Tidak perlu deploy, tidak perlu rilis

Hanya komentar dan dokumen. Tak ada perilaku yang berubah — dan itu bisa diperiksa: `git diff`
pada kedua berkas kode hanya memuat baris komentar.

## Yang masih terbuka sesudah ini

`logCommand` yatim: **hapus atau sambungkan** — keputusan Owner. Sampai itu diputuskan, komentarnya
sudah mengatakan keadaannya apa adanya, dan ujinya menjaga agar tetap begitu.
