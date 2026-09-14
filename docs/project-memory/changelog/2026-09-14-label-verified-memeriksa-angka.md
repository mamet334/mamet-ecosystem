# Label VERIFIED Ikut Memeriksa Angka dan Pasangan Label–Angka

**Tanggal:** 14 September 2026
**Roadmap:** Item 77 (lanjutan Item 71 — label VERIFIED wajib mengutip sumber)
**Berkas kode:** `supabase/functions/agent-process/lib/verification/label_sumber.ts`,
`lib/orchestration/handlers/synthesis_handler.ts`, `lib/stream_handler.ts`
**Status:** di-commit; belum di-deploy — uji pertama direncanakan dari `npm run desktop` sesudah
`agent-process` di-deploy, lalu web

## Masalah

Item 76 (c) mencatat keterbatasan: label `VERIFIED` lolos pada jawaban angka yang salah. Chat HCDP
(`b10bf774…`, 14 September 03.01 UTC) bertanya target rasio jabatan fungsional bersertifikat kompetensi
tahun 3. Model menjawab **35,0%** (seharusnya 20,0%) dengan `Sumber: "DOKUMEN HCDP 2025-2026.docx"` dan
`[STATUS: VERIFIED]`.

Kode Item 71 hanya memeriksa satu hal: judul di dekat kata "Sumber" ada di antara dokumen yang
dilampirkan. Judulnya cocok, maka label bertahan.

Konteks yang dibaca model (`processingSteps`, `[SYSTEM CONTEXT FINAL]`) memperlihatkan inti kesalahannya:
**semua angka jawaban ada di dokumen — yang salah pasangannya.** Potongan DOC-0002 memuat

```
| 5 | Rasio Jabatan Fungsional Bersertifikat Kompetensi / (…) | % | 5,93% | 12,0% | 20,0% | 35,0% | 47,6% | 47,60% |
```

tanpa baris judul kolom, lalu model menebak `Tahun 1 = 12,0%`, `Tahun 3 = 35,0%`. Pada chat `b1b7cf3f…`
(03.18 UTC, sesudah `4022546` mengulang judul kolom) potongan yang sama diawali
`| No | … | Tahun 1 | Tahun 2 | Tahun 3 | … | Target Akhir |` dan jawabannya benar (20,0%).

Karena itu pemeriksaan sederhana "angka jawaban ada di dokumen" tidak cukup: kasus produksi ini akan
tetap lolos.

## Perbaikan

Bila isi potongan yang dilampirkan diberikan, `periksaLabelSumber` — sesudah pemeriksaan Sumber lolos —
menjalankan `periksaAngkaSumber`:

1. **Angka berdesimal/berpemisah/berpersen di jawaban harus ada di dokumen.** Pembanding `kunciAngka`
   menyamakan `47,60%` = `47,6%`, `12,0%` = `12%`, titik = koma. Nomor urut, "tahun 3", dan "2025-2026"
   tidak dihitung; baris `Sumber:` dilewati.
2. **Pasangan label–angka dicocokkan ke tabel Markdown sumber.** Label diambil dari baris tabel jawaban
   (semua sel teks sebaris + judul kolom tabel jawaban) dan baris `Label: angka`. Untuk tiap tempat angka
   itu muncul sebagai sel tabel sumber:
   - label yang sama dengan judul kolom **lain** di tabel itu → **bentrok** ("berada di kolom lain");
   - tabel sumber **tanpa** judul kolom, dan label berangka (`Tahun 1`, `2025`, `Semester 2`) tidak
     disebut di baris itu → **tidak bisa dibuktikan** — walau label lain (mis. judul kolom tabel jawaban
     "Target Rasio …") cocok dengan nama baris;
   - label = judul kolom sel itu, atau ≥60% katanya disebut di baris yang sama → sah.
3. Gagal → label diganti `[STATUS: HYPOTHESIS - Rekomendasi AI]` dan catatan menyebut alasannya, mis.
   `_Catatan sistem: label VERIFIED diturunkan — pasangan "Tahun 1" = 12,0% tidak bisa dibuktikan — judul
   kolom tabel sumbernya tidak ada di dokumen yang dibaca. Periksa angka ini langsung di dokumen._`

Pembaca tabel sumber menerima baris berawalan pembungkus pendek (`: "| No |`) dan berakhiran kutip,
seperti tampilan konteks.

**Jalur data.** `synthesis_handler.ts` membentuk `isiDokumen` dari `ragArray` (`contentWithId`), memakainya
di `koreksiLabel` (non-stream) dan menaruhnya di payload stream. `stream_handler.ts` **mengeluarkan**
`isiDokumen` dari metadata sebelum `X-Agent-Metadata` dibentuk — isi potongan bisa puluhan KB dan tidak
boleh ikut ke header — lalu meneruskannya ke `periksaLabelSumber`. Pemanggil tanpa `isiDokumen` tetap
memakai perilaku Item 71.

## Uji

`uji-label-angka.mjs` (scratchpad sesi 16a2ce18) memuat `label_sumber.ts` asli lewat Node 24. Data utama
= jawaban dan potongan **produksi** kedua chat di atas, ditambah variasi penulisan model. **33/33 lolos.**
Sintaks ketiga berkas diperiksa dengan `esbuild`.

| Kasus | Hasil |
|---|---|
| Jawaban produksi 35,0%, potongan tanpa judul kolom | turun — "Tahun 1" = 12,0% tidak bisa dibuktikan |
| Jawaban produksi 20,0%, potongan berjudul kolom | VERIFIED bertahan |
| Jawaban 35,0% bila judul kolom ada di konteks | turun — kolom lain |
| Isi berbungkus `: "…"` (bentuk tampilan konteks) | 20,0% bertahan, 35,0% turun |
| `- **Tahun ke-3**: 20,0%` / `- Tahun 1: 12,0%` | bertahan / turun |
| Desimal titik `Tahun 3 \| 20.0%` | bertahan |
| Angka karangan 22,5% | turun — tidak ada di dokumen |
| `\| Rasio JF bersertifikat \| Tahun 1 \| 12,0% \|` (nama baris benar, tahun salah) | turun |
| Judul kolom tabel jawaban `Tahun 3` vs `Tahun 2` untuk 20,0% | bertahan / turun |
| `100%` di banyak kolom; `47,60%` = `47,6%` di dua kolom | bertahan |
| Jam data sistem "pukul 10.18" | turun — bukan dokumen |
| Sumber tanpa judul: `TOTAL: 4.828` / `Jumlah PNS: 4.828` | bertahan / turun |
| Sumber tanpa judul, label deskriptif `\| Rasio JF bersertifikat \| 12,0% \|` | bertahan |
| Tanpa `isiDokumen`; tanpa label; Sumber salah; label + Sumber satu baris | perilaku Item 71 tidak berubah |

## Keterbatasan

- Pasangan di kalimat bebas ("tahun ke-3 adalah 20,0%") belum diperiksa — hanya tabel dan `Label: angka`.
- Label tanpa angka yang menunjuk kolom (mis. "Target Akhir") dari tabel sumber tanpa judul bisa lolos.
- Lebih ketat: pasangan yang benar tapi labelnya tidak tertulis di baris sumber tanpa judul (mis.
  "Jumlah PNS: 4.828") ikut diturunkan. Sejalan dengan keputusan Owner: kebenaran data RAG di atas
  kenyamanan.
- `isiDokumen` = seluruh `ragArray`; bila konteks dipangkas sebelum dikirim ke model, pemeriksa bisa
  melihat potongan yang tidak dibaca model (lebih longgar, bukan lebih ketat).
- Di jalur stream teks yang sudah terkirim tidak bisa ditarik; label pengganti + catatan ditambahkan di
  akhir (sama seperti Item 71).
