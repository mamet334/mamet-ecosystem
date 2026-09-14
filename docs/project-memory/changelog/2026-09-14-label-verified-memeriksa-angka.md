# Label VERIFIED Ikut Memeriksa Angka dan Pasangan Label–Angka

**Tanggal:** 14 September 2026
**Roadmap:** Item 77 (lanjutan Item 71 — label VERIFIED wajib mengutip sumber)
**Berkas kode:** `supabase/functions/agent-process/lib/verification/label_sumber.ts`,
`lib/orchestration/handlers/synthesis_handler.ts`, `lib/stream_handler.ts`
**Status:** dideploy seluruhnya (`agent-process` v426) dan terbukti live di web 14 September 2026 —
pemeriksaan angka (v424, desktop + web), nomor halaman (v425), penjaga jawaban tanpa label + BLOK 6
diperlunak (v426: model kembali menulis label sendiri). Jalur penurunan label belum pernah terjadi live.

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

## Bukti live — `npm run desktop` dan web (2026-09-14)

Owner men-deploy `agent-process`. Kode aktif **v424** (`updated_at` 07.16.48 UTC) diperiksa lewat
`get_edge_function`: memuat `periksaAngkaSumber`, `kunciAngka`, `isiDokumen` dikeluarkan dari metadata
(`metaTanpaIsi`), dan `koreksiLabel(replyMessage, judulDokumen, requestMode, isiDokumen)`.

| Uji | Chat | Jawaban | Konteks yang dibaca | Hasil |
|---|---|---|---|---|
| `npm run desktop` 07.18 UTC | `b2fa16dd…` | 20,0%; menyalin baris sumber lengkap dengan judul kolom | DOC-0001 diawali `\| No \| … \| Tahun 3 \| …` | VERIFIED bertahan, tanpa catatan; log fungsi tanpa `[LABEL]` |
| Web 07.24 UTC | `92c6408c…` | 20,0% dalam kalimat; `Sumber: "…docx" [Halaman 1]` | judul kolom ada, 20,0% ada | VERIFIED bertahan, tanpa catatan |

Label yang lolos tidak menulis log, jadi keputusan pemeriksa dibuktikan ulang dengan menjalankan
`label_sumber.ts` pada teks produksi desktop yang sama (`uji-label-desktop-b2fa16dd.mjs`): jawaban asli
bertahan; kontrol dengan data yang sama — 5,93% dan 12,0% ditukar kolom → turun ("berada di kolom lain"),
angka kalimat diganti 22,0% → turun ("tidak ada di dokumen"). 3/3.

Penurunan label belum pernah terjadi live — kedua jawaban memang benar; jalur penurunan baru terbukti lewat uji.

## Nomor halaman karangan (temuan uji web)

Jawaban web menulis `[Halaman 1]` untuk berkas `.docx`. Potongan RAG yang dibaca (5.061 huruf) **tidak
memuat penanda `[Halaman …]`**; satu-satunya "[Halaman" di konteks adalah instruksi kontrak "sebut nomor
halaman bila ada penanda [Halaman N]". Nomor itu dikarang, dan pemeriksa angka tidak menangkapnya (bukan
angka berdesimal/persen; judul Sumber benar).

**Perbaikan.**

- `periksaHalamanSumber` (`label_sumber.ts`), dijalankan sesudah Sumber lolos dan sebelum pemeriksaan
  angka: kutipan `[Halaman N]`, `Halaman N`, `Halaman N–M`, `hlm. N`, `hal. N`, `page N` di jawaban harus ada
  sebagai penanda `[Halaman N]` di potongan yang dilampirkan, atau tertulis "halaman N" di teks dokumen itu
  sendiri. Untuk rentang, kedua ujungnya diperiksa. "hal ini" tidak terbaca sebagai kutipan (butuh titik + angka).
- Gagal → turun, dengan alasan yang membedakan "dokumen tidak memuat penanda halaman" dan "halaman N tidak
  ada (penanda yang ada: …)".
- `universal_contract.ts` BLOK 6: instruksi diperjelas — sebut nomor halaman HANYA bila potongan memuat
  penanda; bila tidak ada, jangan menulisnya, karena label akan diturunkan otomatis.

**Uji.** `uji-label-angka.mjs` kini **44/44** (33 lama + 11 halaman):

| Kasus | Hasil |
|---|---|
| Jawaban web produksi `[Halaman 1]`, potongan tanpa penanda | turun — dokumen tidak memuat penanda halaman |
| Jawaban web yang sama tanpa nomor halaman | bertahan |
| PDF berpenanda 195–196: `[Halaman 195]`, `Halaman 195–196`, `hal. 195` | bertahan |
| `hlm. 200`, `page 5`, `Halaman 195-199` (ujung 199 tak ada) | turun |
| "halaman 12" tertulis di teks dokumen; "Hal ini …" | bertahan |
| Tanpa `isiDokumen` | tidak diperiksa (kompatibel) |

Jawaban desktop produksi tetap 3/3. Sintaks `label_sumber.ts` dan `universal_contract.ts` OK (esbuild).

**Batas.** Penanda halaman hanya ada di awal halaman PDF; potongan dari tengah halaman tidak membawa
penandanya, sehingga nomor halaman yang benar tetapi tidak tertulis di potongan itu ikut diturunkan.
Kontrak kini melarang menyebut halaman tanpa penanda, jadi kasus ini seharusnya jarang.

## Jawaban tanpa label (uji live web sesudah v425)

`be1f425` dideploy sebagai `agent-process` **v425** (07.30.24 UTC; isi kode aktif memuat
`periksaHalamanSumber` dan instruksi halaman baru). Pertanyaan HCDP yang sama di web, chat `090baab3…`
07.33 UTC:

```
Target rasio jabatan fungsional bersertifikat kompetensi pada tahun 3 adalah 20,0%.

Sumber: "DOKUMEN HCDP 2025-2026.docx"
```

Jawaban benar dan **tanpa nomor halaman** (instruksi dipatuhi), tetapi tersimpan **tanpa label status sama
sekali**. Diperiksa:

- Konteks yang dibaca model memuat aturan wajib label, BLOK 6, instruksi halaman baru, dan judul kolom
  "Tahun 3".
- Tidak ada kode yang membuang label (dicari di `agent-process`, frontend, mametlite) — model memang tidak
  menulisnya.
- Jawaban ber-RAG (Evidence Gate PASSED) 5 hari: sebelum v425, 44/54 berlabel — 10 yang tanpa label
  semuanya tanggal 9 September (sebelum Item 71); sesudah v425, 1/1 tanpa label. Dugaan: kalimat baru
  "nomor halaman karangan membuat label diturunkan otomatis" mendorong model menghindari label — satu
  sampel, belum terbukti.

**Celah yang lebih penting:** semua pemeriksaan hanya bekerja bila model menulis `[STATUS: VERIFIED]`;
**tidak menulis label** adalah jalan lolos, dan pengguna kehilangan tanda percaya.

**Perbaikan.**

- `label_sumber.ts` — **penjaga label hilang:** bila dokumen dilampirkan dan jawaban tidak memuat label apa
  pun (`[STATUS: …]` atau label ringkas LOOKUP), sistem menambahkan `[STATUS: HYPOTHESIS - Rekomendasi AI]` +
  `_Catatan sistem: model tidak menulis label status — jawaban ini belum diverifikasi sistem terhadap dokumen
  yang tersedia._` VERIFIED tidak pernah ditambahkan otomatis. Kontrak BLOK 6 dipasang untuk semua mode
  (`context_builder.ts`), jadi penjaga berlaku merata. Tanpa dokumen, `[STATUS: INSUFFICIENT]`, dan label
  LOOKUP tidak disentuh.
- `label_sumber.ts` — varian `[Status: Verified]` (huruf/spasi) disamakan menjadi `[STATUS: VERIFIED]` sebelum
  diperiksa; tanpa ini varian itu lolos dari pemeriksaan Sumber, halaman, dan angka.
- `universal_contract.ts` BLOK 6 — instruksi halaman tetap, ancaman "membuat label diturunkan otomatis"
  dihapus.
- `stream_handler.ts` — log `[LABEL]` kini "label dikoreksi -> HYPOTHESIS (alasan)", tidak lagi selalu
  "VERIFIED tidak sah".

**Uji.** `uji-label-angka.mjs` **53/53**:

| Kasus | Hasil |
|---|---|
| Jawaban web produksi 07.33 tanpa label, dokumen dilampirkan | HYPOTHESIS + catatan ditambahkan, tanpa VERIFIED |
| Tanpa label, tanpa dokumen | tidak disentuh |
| `[STATUS: INSUFFICIENT]`; label ringkas LOOKUP | tidak disentuh |
| `[Status: Verified]` + `[Halaman 1]` karangan | disamakan lalu turun (halaman) |
| `**[STATUS: VERIFIED]**` sah | bertahan |
| `koreksiLabel` non-stream tanpa label | tepat satu HYPOTHESIS + catatan |

Uji lama (angka, pasangan tabel, halaman, perilaku Item 71) tetap lolos; jawaban desktop produksi tetap
3/3. Sintaks `label_sumber.ts`, `universal_contract.ts`, `stream_handler.ts` OK (esbuild).

**Belum terbukti (saat commit `2dfd0c6`):** penjaga belum berjalan live, dan belum pasti kalimat yang
diperlunak membuat model kembali menulis label.

## Bukti live v426 (web, 2026-09-14 07.46 UTC)

`2dfd0c6` di-push dan dideploy sebagai `agent-process` **v426** (07.43.49 UTC). Isi kode aktif diperiksa lewat
`get_edge_function`: memuat `CATATAN_TANPA_LABEL`, "model tidak menulis label status", log
`label dikoreksi -> HYPOTHESIS`, `periksaHalamanSumber`, `periksaAngkaSumber`; kalimat "nomor halaman karangan
membuat label …" sudah tidak ada.

Pertanyaan HCDP yang sama di web, chat `bc5ec398…` (dicari lewat `created_at` — chat lama bisa tersimpan ulang
dengan `updated_at` baru):

```
Target rasio jabatan fungsional bersertifikat kompetensi pada tahun 3 adalah 20,0%.

Sumber: "DOKUMEN HCDP 2025-2026.docx"

[STATUS: VERIFIED]
```

Label ditulis **model sendiri**, tanpa catatan sistem. Konteks yang dibaca: Evidence Gate PASSED (7 potongan),
judul kolom "Tahun 3" ada, instruksi halaman yang diperlunak ada, kalimat ancaman tidak ada. Pemeriksa benar
tidak menurunkan: Sumber cocok, tanpa nomor halaman, 20,0% ada di dokumen.

**Riwayat uji web pertanyaan yang sama:**

| Versi | Jam (UTC) | Jawaban | Label |
|---|---|---|---|
| v424 | 07.24 | 20,0% + `[Halaman 1]` karangan | VERIFIED (halaman belum diperiksa) |
| v425 | 07.33 | 20,0%, tanpa halaman | **tanpa label** |
| v426 | 07.46 | 20,0%, tanpa halaman | VERIFIED, ditulis model |

**Belum terbukti live:**

- Penjaga label hilang belum pernah terpakai — model menulis label; jalurnya terbukti lewat uji lokal (53/53).
- Kaitan pelunakan BLOK 6 dengan kembalinya label baru satu sampel sebelum dan sesudah.
- Penurunan label karena angka, pasangan tabel, atau halaman belum pernah terjadi live — semua jawaban uji benar.
