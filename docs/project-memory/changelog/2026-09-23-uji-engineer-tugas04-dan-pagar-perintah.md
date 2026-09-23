# TUGAS-04 selesai + pagar perintah dilonggarkan tepat sasaran

**Tanggal:** 23 September 2026
**Roadmap:** T10 di [`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md)
**Status:** ✅ empat tugas uji Engineer selesai; tiga perbaikan menyertainya

## Perbaikan kode

### 1. Peringatan palsu "tugas tidak diumumkan" (`ProsedurEngineer.js`)
Menolak karena tugasnya tidak ada di sumber adalah langkah 0.1 yang DIJALANKAN, bukan dilanggar. Peringatan kini
dilewati bila jawaban berlabel `[STATUS: INSUFFICIENT]` atau menyatakan tugasnya tidak ditemukan.
Live 2026-09-23: TUGAS-04 belum terunggah, Engineer mendaftar dokumen yang ia punya, menolak mengerjakan tugas
terdekat — lalu tetap kena peringatan. Risiko yang diterima sadar (model bisa "kabur" dengan mengaku tak menemukan
tugasnya) ditulis di kode: klaim itu terlihat Owner dan label INSUFFICIENT diperiksa sistem label server.

### 2. Penyambung shell diperiksa hanya DI LUAR tanda kutip (`alatFolderJalan.cjs`)
`node -e "const fs=require('fs');…"` ditolak karena ";" — padahal titik-koma itu isi argumen, dan program dijalankan
langsung **tanpa shell** sehingga tidak bisa menyambung apa pun. Pemeriksaan kini per huruf, hanya di luar kutip;
`&&`, pipa, `<`, `>`, backtick di luar kutip dan baris baru di mana pun tetap ditolak. Pesan penolakan memberi jalan
keluar (bungkus argumen dengan tanda kutip).

### 3. Dialog izin membedah skrip sebaris (keputusan Owner: JANGAN dibatasi)
Melarang `node -e`/`python -c` akan memblokir pekerjaan sah (membaca berkas dengan nomor baris) dan mudah dilewati
(tulis skrip ke berkas lalu jalankan berkasnya). Pengamanannya dipindah ke tempat yang efektif:
- isi skrip **ditampilkan utuh** di dialog (Owner tidak bisa menilai yang tidak ia lihat);
- bila skrip memuat tanda menulis/menghapus/memindah/membuat folder/menjalankan program lain/menghubungi jaringan →
  baris peringatan tersendiri, menyebut bahwa skrip berjalan dengan hak penuh Owner dan di luar repo tidak terlihat
  di git;
- skrip yang hanya membaca tidak diberi peringatan, supaya tandanya tetap berarti.

Daftar tanda itu ditulis tegas di kode sebagai **penanda, bukan larangan**.

## Hasil uji Engineer TUGAS-04 (analisis, tanpa patch)

Dengan `openai/gpt-4o-mini`: penjelasan umum cara kerja fungsi, tanpa nomor baris, tanpa daftar kalimat yang salah
digolongkan, tanpa usulan perbaikan.

Dengan `deepseek/deepseek-v4-pro-0813`: **11 dari 12 klaimnya terbukti** saat saya jalankan `detectIntent` yang asli
pada tiap kalimat contoh. Menemukan cacat terpenting (force-check `patch`/`perbaiki`/`perubahan` di baris 41 menimpa
READ_REPO dan pemeriksaan ambigu), plus dua kelas yang TIDAK ada di kunci jawaban saya: negasi tidak dipahami
("jangan ubah apa pun, cukup analisis saja" → CLARIFICATION) dan sub-string nyangkut ("buat fungsi `checkout`" →
`check` terbaca kata analisis). Usulannya bukan sekadar menambah kata: prioritaskan kata kerja pertama, pencocokan
batas kata, kurangi force-check.

Yang meleset: "Perbaiki `checklist.md`" diklaim CLARIFICATION, nyatanya MODIFY_CODE — force-check yang ia jelaskan
sendiri tidak ia terapkan pada contohnya. Yang kurang: nomor baris tidak pernah disebut; premis keliru di dokumen
tugas (soal "cek lalu perbaiki") tidak disanggah.

## Temuan yang belum diperbaiki

| Temuan | Akibat |
|---|---|
| `PROJECT_ROOT = path.resolve(__dirname,'..','..')` | di aplikasi hasil `npm run dist`, akar Engineer menunjuk folder instalasi: `git` gagal ("not a git repository") dan patch akan menulis ke folder instalasi, bukan repo |
| Setelan terpisah antara `.exe` dan mode pengembangan | localStorage `mamet://app` vs `http://localhost:5173` — model yang diganti di satu sisi tidak berlaku di sisi lain; sempat membuat dua putaran uji memakai model yang sama tanpa disadari |
| Pemeriksa label menolak keluaran terminal sebagai sumber | jawaban paling berbukti (dari isi berkas nyata) diturunkan ke HYPOTHESIS dengan alasan "tidak mengutip dokumen" |
| Jawaban panjang terpotong batas waktu server (±150 s) | analisis panjang perlu dua giliran ("lanjutkan"); mekanismenya bekerja, tapi perlu diketahui |

## Uji otomatis (di luar git)

`uji-peringatan-skrip.mjs` **12/12** (blok IPC nyata + dialog tiruan; penolakan dialog terbukti tidak menulis apa pun),
`uji-pecah-perintah-kutip.mjs` **15/15**, `uji-prosedur-engineer.mjs` v4 **35/35**, `uji-engineer-jalankan.cjs` ✅.
