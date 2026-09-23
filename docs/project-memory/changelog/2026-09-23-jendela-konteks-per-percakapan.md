# Jendela konteks per percakapan + peristiwa Engineer tak lagi bocor

**Tanggal:** 23 September 2026
**Roadmap:** [`ROADMAP-ENGINEER-MANDIRI.md`](../../roadmap/ROADMAP-ENGINEER-MANDIRI.md) Tahap 3a
**Status:** ✅ selesai & terbukti live

## Masalah

Yang dikirim ke model hanya `history.slice(isLiteMode ? -5 : -10)` — **sepuluh pesan terakhir**, tanpa memandang
panjangnya. Jadi "konteks" bukan percakapan, melainkan jendela geser: pada tugas panjang Engineer kehilangan benang
merah, dan keluaran perintah yang lebih lama lenyap dari pandangannya. Owner memintanya seperti jendela konteks yang
terlihat di Claude Code: satu jendela per percakapan, bisa dibersihkan, tanpa memenuhi database dengan sampah.

## Keputusan Owner (23 September 2026)

1. "Bersihkan konteks" **tidak menghapus pesan** — pesan lama tetap terlihat, hanya berhenti dikirim.
2. Anggaran **mengikuti kolom batas biaya** di Settings (`daily_budget_cap_usd`), porsi **5% sisa harian per pesan**.
3. Berlaku di **Assistant dan Engineer**, berdiri sendiri per percakapan.

## Yang dikerjakan

| Bagian | Berkas |
|---|---|
| Perkiraan token, anggaran dari biaya, pemilihan pesan, meteran, batas per chat | `core/runtime/services/KonteksChat.js` (baru, murni) |
| Jalur kirim memakai pilihan beranggaran; `bahanAnggaranKonteks` (batas harian + harga model + pemakaian hari ini, cache 2 menit) | `AssistantService.js` |
| Meteran di bilah atas + tombol bersihkan/pulihkan | `ConversationEngine.jsx` |

Anggaran mengecil sendiri saat saldo menipis (minimum 8 rb token) dan tidak pernah nol bila harga/batas tak terbaca
(jatuh ke 60 rb token) — chat tidak pernah kehilangan konteks sepenuhnya.

## Peristiwa Engineer tak lagi bocor ke chat lain

Enam langganan peristiwa Engineer (`Recommendation`, `ReasoningReport`, `RequestConfirmation`, `PatchApplied`,
`PatchPersisted`, `FileContent`) berjalan di **ketiga** instance chat yang hidup bersamaan. Akibatnya laporan
Engineer ikut menempel di chat Assistant/Lite — **8 baris chat** berlabel `ws-assistant`/`ws-lite` (9 Sep–23 Sep)
seluruhnya berisi laporan Engineer, nol pesan pengguna.

- Penjaga per penangan memakai **ref** (bukan nilai render): langganan didaftarkan dengan `deps []`, jadi nilai
  render akan beku dan penjaganya tak berguna.
- Kedelapan baris itu **dipindah labelnya** ke `ws-engineer` atas izin Owner — tidak ada yang dihapus.

## Tiga cacat yang terlihat live, semuanya kesalahan saya

| Cacat | Sebab | Perbaikan |
|---|---|---|
| `Error: chatId is not defined` — chat lumpuh | `chatId` ditambahkan di `processMessage`, tetapi payload dibangun di `_handleConversation` yang tidak menerimanya. Esbuild tidak menangkapnya: variabel tak terdefinisi baru meledak saat dijalankan | diteruskan di 3 titik (termasuk pemanggilan ulang web post-hoc) |
| Meteran selalu `19 / 1 (100%)` | `anggaranKonteks` mengembalikan `token`, `meteranKonteks` menunggu `anggaranToken`; disebar dengan `...ang` sehingga jatuh ke nilai pengaman 1 | dipetakan dengan nama yang benar |
| Ikon tampil sebagai tulisan `DATA_USAGE` | font ikon hanya memuat **subset** dari `daftar-ikon.txt` (dibuat `scripts/perbarui-ikon.mjs`); `data_usage` & `history_toggle_off` tidak ada di sana | memakai `token` & `history` yang sudah ada di subset |

Uji sekarang memeriksa ketiganya, termasuk **mencocokkan nama ikon dengan `daftar-ikon.txt`** — pemakaian ikon di
luar subset akan menggagalkan uji, bukan menunggu terlihat di layar.

## Bukti live

Layar Owner: meteran `0 / 150,2k (0%)` dengan ikon yang benar, tanpa galat, dan pesan
"🧹 Konteks dibersihkan. 4 pesan di atas tetap ada di layar dan tetap tersimpan" dengan pesan-pesan lama masih
terlihat di atasnya. Anggaran 150,2k berarti sisa batas harian ±$2,88 (±$0,14 per pesan bila konteks penuh).

## Uji otomatis (di luar git)

`uji-konteks-chat.mjs` **v4, 47/47** — perkiraan token, anggaran dari biaya (termasuk saldo tipis & tanpa data),
pemilihan pesan (terbaru mundur, minimal satu pesan, daftar asli tak diubah), meteran, batas per percakapan,
pemasangan di jalur kirim, penjaga kebocoran peristiwa, dan ketiga cacat live di atas.

## Sisa pekerjaan Tahap 3a

- Tombol **"Padatkan"**: meringkas pesan lama jadi satu ringkasan sesi (butuh satu panggilan model).
- **Batas jendela model** belum ikut dihitung — tidak ada tempat menyimpan panjang jendela tiap model, jadi yang
  membatasi sekarang murni biaya. Aman untuk model berjendela besar; berisiko bila pindah ke model berjendela kecil.
