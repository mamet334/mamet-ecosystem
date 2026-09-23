# Mesin uji klaim Engineer (Tahap 2) + tiga bug jalur Engineer

**Tanggal:** 23 September 2026
**Roadmap:** [`ROADMAP-ENGINEER-MANDIRI.md`](../../roadmap/ROADMAP-ENGINEER-MANDIRI.md) Tahap 2
**Status:** ✅ selesai & terbukti live

## Mesin uji klaim

Engineer menulis klaim perilaku dalam blok yang bisa dijalankan; sistem menjalankannya terhadap kode NYATA di repo
lalu menempelkan hasilnya sebagai pesan tersendiri (jawaban model tidak diubah):

```
<uji_klaim berkas="frontend/src/…/IntentClassifier.js" fungsi="detectIntent">
{"title":"Perbaiki laporan analisis"} => MODIFY_CODE
</uji_klaim>
```

| Bagian | Berkas |
|---|---|
| Urai blok, susun skrip, susun laporan, peringatan klaim tak teruji | `engineer/UjiKlaim.js` (murni, bisa diuji tanpa merender) |
| Pelaksana: proses **node terpisah**, batas 20 detik, lingkungan tanpa rahasia | `electron/main.cjs` IPC `engineer:uji-klaim` (+ `engineer:akar-repo`) |
| Pemanggil & penempel laporan | `ConversationEngine.jsx` |
| Aturan wajib bagi model (RULE 0.2b) | `engineer_context.ts` |

**Pagarnya:** tidak ada teks model yang menjadi kode — argumen ditanam lewat `JSON.stringify`, nama fungsi disaring
pola, alamat berkas wajib relatif di dalam `frontend/src` berakhiran `.js`/`.mjs` (lalu dicek lagi pagar repo di
proses utama). Efek samping modul yang diuji mati bersama proses terpisah itu.

**Peringatan pendamping:** jawaban yang memuat ≥2 klaim perilaku ("masukan → HASIL") tanpa blok uji diberi peringatan
sistem — live 2026-09-23 aturan 0.2b sudah sampai ke model (terbukti di jejak) tetapi model tetap menulis prosa.

## Tiga bug jalur Engineer yang ditemukan lewat uji ini

Ketiganya memblokir jawaban yang BENAR, dan ketiganya berakar sama: heuristik yang menebak maksud dari teks, dibuat
saat Engineer hanya menghasilkan patch pendek, lalu salah begitu ia menulis analisis panjang.

| Bug | Akibat live | Perbaikan |
|---|---|---|
| `trace_parser.ts` memotong trace dari baris pertama bila ada pola ID | seluruh jawaban jadi kosong → HARD GATE `CHECK_001` | pemotongan yang mengosongkan jawaban dianggap bukan trace (commit sebelumnya) |
| Penanda patch dicari dengan `includes()` di mana saja | kalimat "saya **tidak** menandai `[MAMET_PATCH_READY]`" memulai pipeline patch pada tugas ANALISIS, lalu gagal ("Provider returned empty response"), dan kalimatnya rusak jadi "saya tidak menandai ``" | `ProsedurEngineer.adaPenandaPatch/buangPenandaPatch`: penanda hanya dihitung bila berdiri sendiri di satu baris, di luar blok kode & `<think>`; sebutan dibiarkan utuh |
| Pemilih profil verifikasi memakai pola longgar `/"\s*:\s*"/` | laporan analisis **6.237 huruf** diperiksa sebagai patch JSON → `CHECK_P02 Invalid JSON patch` → Owner hanya menerima "Verification Failed" | pola itu dihapus; patch dikenali dari JSON utuh (boleh berpagar ```json) atau field khas (`"files"`, `"newContent"`, `"patches"`, `"__mode"`, `"search_replace"`) |

## Bukti live (TUGAS-04, `deepseek/deepseek-v4-pro-0813`)

Chat 08:31 UTC: Engineer menulis blok `<uji_klaim>` sendiri, jawabannya tampil utuh (3.624 huruf) dengan
`[STATUS: VERIFIED]` dan `Sumber:` berisi perintah `git show HEAD:…` — **ketiga perbaikan terbukti sekaligus**.

Lalu mesin menempelkan: **🧪 Uji klaim: 5/10 terbukti — 5 meleset**. Saya jalankan sendiri kelima klaim yang meleset
terhadap `detectIntent`: kelimanya memang meleset, persis seperti laporan mesin.

**Angka ini penting.** Saat klaim ditulis sebagai prosa dan diperiksa manual, ketepatan Engineer terlihat 14/16.
Begitu klaim harus berbentuk yang bisa dijalankan — dan contohnya dipilih sendiri oleh Engineer, lebih menantang —
ketepatannya **50%**. Bukan karena Engineer memburuk, tetapi karena tidak ada lagi tempat bersembunyi. Kelima
kesalahannya berhubungan dengan cacat yang ia temukan sendiri (jalan pintas `patch`/`perbaiki`/`perubahan` di baris
41, dan kata "jelaskan" yang tidak ada di daftar mana pun): ia tahu aturannya, tetapi salah menelusurinya.

## Uji otomatis (di luar git)

`uji-klaim-engineer.mjs` v2 **28/28** (proses node nyata + `IntentClassifier.js` nyata; bahan uji = klaim asli
Engineer), `uji-profil-verifikasi.mjs` **10/10** (menjalankan blok kondisi yang benar-benar ada di berkas server),
`uji-prosedur-engineer.mjs` v5 **43/43**, `uji-sumber-terminal.mjs` **14/14**. Bundel `agent-process` ✅.

## Berikutnya

Urutan rancangan ditukar atas keputusan Owner: **Tahap 3 (ingatan temuan) sebelum Tahap 1 (lingkaran mandiri)** —
tanpa ingatan, Engineer otonom akan melaporkan temuan yang sama setiap hari sampai Owner berhenti membacanya.
