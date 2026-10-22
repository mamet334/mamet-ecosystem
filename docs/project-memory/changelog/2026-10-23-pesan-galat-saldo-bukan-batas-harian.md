# 23 Oktober 2026 — Pesan galat: saldo OpenRouter tidak lagi dilaporkan sebagai "batas biaya harian"

Dilaporkan Owner (tangkapan layar, 23 Okt 01.30 WIB): *"kenapa ya? memang saldo openrouter belum saya isi, tapi
kemarin masih bisa chat"*. Lanjutan E8 [`ROADMAP-SIAP-PENGGUNA.md`](../../roadmap/ROADMAP-SIAP-PENGGUNA.md).

## Yang terjadi (log `function_logs` Supabase)

```
[Saldo] 402 tidak diulang — terkecil terjangkau: 133, plafon ulang: 119, diminta: 8192, lantai: 128
```

OpenRouter menolak (402) dan menyebut saldo hanya cukup untuk 133 token; ulangan memakai 90% (`MARGIN_SALDO`) = 119,
di bawah lantai 128 (Item 121) → tidak diulang. Perilaku itu benar. Saldo minus tetap melayani permintaan kecil,
tetapi angka "can only afford" mengecil tiap chat yang terlayani — itulah bedanya dengan kemarin.

**Yang salah adalah judulnya:** "Batas biaya harian Anda sudah tercapai. Naikkan batasnya di Settings" — batas
harian Owner $2,2 dan **belum** tercapai (log `[QUOTA]` yang sama). Server sudah menerjemahkan 402 menjadi
kalimat Indonesia ("Saldo OpenRouter hanya cukup untuk …"), jadi penerjemah galat aplikasi tak menemukan `402`
lagi; kalimat itu memuat kata **"plafon"** ("diulang dengan plafon sekecil itu") — kata kunci cabang batas harian.

## Perbaikan (`frontend/src/core/runtime/services/pesanGalat.js`, v2)

- Cabang saldo juga mengenali kalimat server: `saldo openrouter`, `saldo tidak cukup`, `saldo penyedia`.
- Cabang batas harian tidak lagi menerima kata "plafon" saja (server juga memakainya untuk plafon TOKEN jawaban);
  yang dikenali: `daily_cap`, `daily cap`, `daily limit`, `batas harian`, `batas biaya harian`, `plafon harian` —
  termasuk kalimat server yang sungguhan, `DAILY_CAP_EXCEEDED: … exceeded the daily limit` (`costTracker.ts`).

Kejadian yang sama kini berjudul "Saldo penyedia tidak cukup untuk permintaan ini." Tanpa deploy server.
Mametlite (`mametlite/src/lib/pesanGalat.js`) tidak punya cabang "plafon" sehingga tidak salah sebut, hanya jatuh
ke judul umum — dibiarkan, keputusan Owner.

## Uji

`uji-pesan-galat-ecosystem.mjs` v2 — kalimat saldo **dibangkitkan dari fungsi server yang asli**
(`pesanSaldoTakCukup` di `reasoning_openrouter.ts`, diimpor langsung oleh node), kelima variannya + teks persis log
23 Okt: semuanya berjudul saldo, tak satu pun menyebut batas harian. Batas harian sungguhan tetap dikenali;
"Plafon token jawaban habis" tidak dibaca sebagai batas harian. Tiga mutasi menggigit (termasuk keadaan sebelum
perbaikan). Suite 116/116.
