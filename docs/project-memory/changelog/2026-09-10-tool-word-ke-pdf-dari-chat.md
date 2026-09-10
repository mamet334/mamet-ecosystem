# Tool Word ke PDF — Dua Word di Satu Mesin, dan Berkas yang "Sudah Ada" Padahal Belum Selesai

**Tanggal:** 10 September 2026
**Roadmap:** Item 56

## Permintaan

Owner ingin asisten bisa dipanggil dengan kalimat seperti **"ubah word ke pdf dokumen
ini"**, dan hasilnya tidak mengubah foto, susunan huruf, maupun tata letak.

Dokumen ujinya berat: `DOKUMEN HCDP 2025-2026.docx`, 47 halaman A4, 15 grafik Word asli
(termasuk 3D), lingkaran-lingkaran bertumpuk di sampul, dan 596 tab stop kustom.

## Kenapa mesinnya harus Word sendiri

Berkas `.docx` tidak menyimpan tampilan halaman. Isinya resep: font apa, rata ke mana,
gambar mengapung di mana. Yang memasak resep itu menjadi halaman adalah **mesin tata
letak** — Word, LibreOffice — hasil puluhan tahun kerja.

| Pilihan | Untuk dokumen ini |
|---|---|
| `mammoth` (sudah ada di repo) | Sengaja membuang format — tidak cocok |
| Chromium / `docx-preview` | Tidak menggambar grafik Word — 15 grafik akan hilang |
| LibreOffice | Tidak terpasang; mesinnya berbeda |
| **Word + printer PDF** | Tata letak dibuat program yang sama dengan pembuat dokumen |

Tiga repo open source di `asisten-repo/external` juga diperiksa. Tidak ada yang punya
konverter. Khoj bahkan memasang LibreOffice di kontainernya alih-alih menulis sendiri.

Word di mesin Owner tidak bisa "Save as PDF", tapi bisa **mencetak** ke printer virtual
`Microsoft Print to PDF` bawaan Windows.

## Jebakan 0 KB

Cetak manual pertama Owner dilaporkan "hasilnya 0kb". Antrian printer dipantau langsung:

| Waktu | Ukuran berkas | Status |
|---|---|---|
| 14:32:39 | 0 byte | Word masih mengirim halaman |
| 14:35:00 | 5,2 MB | 20 halaman tercetak |
| 14:35:14 | 7,88 MB | Selesai |

Printer PDF membuat berkasnya seketika dalam keadaan kosong, lalu mengisinya belakangan.
Maka skrip tidak menganggap "berkas sudah ada" sebagai berhasil. Ia menunggu penanda
`%%EOF`, ukuran yang berhenti bertambah, dan antrian yang kosong — lalu membandingkan
jumlah halaman PDF dengan jumlah halaman menurut Word.

## Dua Word, dan klaim saya yang keliru

Pemeriksaan pertama hanya menemukan folder `Office12`, dan saya melapor "hanya ada Word
2007". Uji skrip pertama membuktikan sebaliknya: prosesnya berjendela tersembunyi berjudul
**"Word (Unlicensed Product)"** dengan dialog **"Save to OneDrive to enable editing"**.

| Word | Versi | Status |
|---|---|---|
| `Office12\WINWORD.EXE` | 12.0 (2007) | Berlisensi, tanpa fitur PDF |
| `Office16\WINWORD.EXE` | 16.0 (365) | Tanpa lisensi, mode baca saja |

COM `Word.Application` terdaftar dua kali. Dari proses 64-bit ia membuka Word 365; dari
32-bit ia membuka Word 2007. Tool sengaja memakai PowerShell 32-bit: berlisensi, tanpa
dialog penahan, dan hasilnya sama dengan cetak manual yang sudah Owner nyatakan benar.

## Jumlah halaman saja nyaris menipu

PDF dari Word 365 lolos pemeriksaan **47 = 47**. Tapi teks terbacanya hanya separuh versi
manual, dan halaman 18 kehilangan hampir semua potongan grafiknya.

Diselidiki sampai tuntas: tata letak kedua PDF identik — setiap bab di halaman yang sama.
Bedanya cara pengkodean. Word 2007 memecah grafik 3D menjadi ribuan ubin gambar (7,8 MB),
Word 365 menggambarnya sebagai vektor (2,1 MB). Halaman-halaman berisiko dirender lewat
`pdfjs-dist` dan dilihat langsung: utuh.

Pelajarannya tetap: satu angka yang cocok belum berarti isinya benar.

## Word yang tidak pernah tertutup

Setiap konversi meninggalkan `WINWORD.EXE` tersembunyi. Penyebabnya satu baris:

```powershell
try { $word.Quit(0) } catch {}
```

Word 2007 lewat COM menolak angka biasa — ia minta `[ref]`. Error-nya tertelan `catch {}`
kosong, jadi Word tidak pernah menerima perintah tutup. Pola yang sama dengan yang sudah
berkali-kali ditemukan di repo ini: sesuatu yang tampak berjalan tanpa pernah diperiksa.

Sekarang `Quit([ref]0)`, error penutupan dilaporkan di hasil, dan proses milik skrip yang
masih hidup 15 detik kemudian dihentikan. Word yang dibuka Owner sendiri tidak disentuh —
hanya proses yang **baru muncul** saat skrip berjalan yang dianggap miliknya.

## Tombol yang tidak ada di layar Owner

Instruksi uji pertama saya menyuruh Owner memakai tombol 📎. Owner bertanya apakah maksudnya
tombol folder. Ternyata 📎 hanya muncul di workspace **Lite**, sementara Owner di
**Assistant**. Saya menemukan tombolnya lewat grep tanpa memeriksa kondisi kapan ia
ditampilkan. Kini 📎 juga ada di Assistant.

## Tombol yang tampak mati

Setelah tombol **Buka PDF** dan **Tampilkan di folder** ditambahkan, Owner melaporkan
keduanya tidak berfungsi. Konsolnya menunjukkan
`No handler registered for 'doc:open-result'`.

| | Waktu |
|---|---|
| Proses utama Electron dimulai | 15:09:50 |
| `main.cjs` diubah | 15:17:49 |
| Owner hard refresh | 15:19 |

Hard refresh memperbarui tampilan dan preload, tidak memperbarui proses utama. Kodenya
benar; prosesnya basi. Yang memang salah adalah tombolnya diam — error hanya tampil di
konsol. Sekarang setiap kegagalan tombol muncul di chat, dan kasus ini memberi tahu bahwa
aplikasi perlu dijalankan ulang sepenuhnya.

## Bukti

- Owner mengetik *"ubah dokumen tersebut menjadi pdf"* dengan lampiran. Log:
  `DOC_CONVERT` → `Executing tool: word_to_pdf` → PDF **47 = 47 halaman**, 7,4 MB,
  57 detik, `word_versi 12.0`, `word_ditutup normal`.
- Konversi kedua menjadi `DOKUMEN HCDP 2025-2026 (2).pdf` — yang pertama tidak tertimpa.
- Tombol Buka PDF dan Tampilkan di folder dikonfirmasi berfungsi setelah aplikasi
  dijalankan ulang.
- Handler IPC diuji dengan `electron` tiruan: berkas bukan Word, path relatif, nama
  berisi `&` dan `'`, dua perintah bersamaan, `calc.exe` lewat tombol buka, PDF yang
  sudah hilang. Semua memberi jawaban yang tepat.
- Pengenal perintah lulus 12 kalimat uji, termasuk pertanyaan yang sengaja **tidak**
  dieksekusi ("bisakah ubah word ke pdf?").

## Yang belum terbukti

- **Pengembalian printer default.** Printer default Owner memang sudah "Microsoft Print to
  PDF", jadi logikanya tidak teruji. Sengaja tidak diuji dengan mengubah pengaturan Owner.
- **Build terpaket.** `asarUnpack` untuk skrip PowerShell sudah dipasang, tapi installer
  belum pernah dibuat.
- **Lampiran Word bersama pertanyaan biasa** di workspace Assistant kini diteruskan ke LLM
  seperti di Lite. Jalur itu belum pernah diuji untuk `.docx`.

## Tidak dikerjakan

**PDF → Word.** PDF tidak menyimpan paragraf atau tabel — isinya hanya "huruf X di
koordinat sekian" — jadi setiap konverter harus menebak. Word 2007 tidak bisa membuka PDF,
dan `pdf2docx` butuh Python yang ternyata tidak terpasang. Perintah ke arah itu dikenali
dan dijawab jujur, tidak diserahkan ke LLM yang bisa mengaku sudah mengonversi.
