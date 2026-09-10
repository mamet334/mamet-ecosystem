# Konversi Word → PDF dari Versi Web — Laptop sebagai Pekerja

**Tanggal:** 10 September 2026
**Roadmap:** Item 57

## Pertanyaan yang memulainya

Setelah tool Item 56 selesai, Owner bertanya: apakah tool itu mengambil mesin konversinya,
atau hanya menyuruh Word 2007 bekerja di latar belakang? Kalau yang kedua, berarti tidak
bisa dipakai dari HP.

Jawabannya memang yang kedua. Word dan printer PDF Windows tidak bisa disalin keluar dari
Windows. Tiga jalan dibandingkan:

| Jalan | Kualitas | Syarat |
|---|---|---|
| **1. Laptop sebagai pekerja** | Identik — mesinnya sama | Laptop menyala, aplikasi desktop terbuka |
| 2. Server LibreOffice sendiri | Baik, tapi bukan Word | Server berbayar |
| 3. Layanan pihak ketiga | Sangat baik | Berbayar, dokumen keluar ke server orang lain |

Owner memilih jalan 1.

## Cara kerjanya

```
Versi web (HP / browser)
  │  1. cek laptop online?  ── tidak ──► "Laptop Anda sedang offline"
  │  2. unggah .docx ke bucket `conversions`
  │  3. sisipkan baris `conversion_jobs` (pending)
  ▼
Aplikasi desktop di laptop (tiap 6 detik)
  │  4. klaim: pending → processing  (hanya satu pekerja yang menang)
  │  5. unduh → Word 2007 → Microsoft Print to PDF  (mesin Item 56)
  │  6. unggah hasil.pdf → done
  ▼
Versi web: tombol "Unduh PDF"
```

## Tiga keputusan kecil yang mencegah masalah besar

**Jam server, bukan jam perangkat.** Status "laptop online" dihitung database dengan `now()`.
Kalau laptop menulis waktunya sendiri lalu HP membandingkan dengan jam HP, selisih satu menit
saja cukup membuat laptop tampak mati padahal menyala.

**Tolak di depan, bukan menunggu di belakang.** Versi web memeriksa laptop sebelum mengunggah
apa pun. Ini terbukti tanpa disengaja: Owner sempat menjalankan `npm run dev` saja, tanpa
aplikasi desktop. Chat menjawab *"Laptop Anda sedang offline … terakhir terlihat 222 menit
lalu"*, dan basis data mencatat 0 pekerjaan dan 0 berkas.

**Klaim atomik.** Laptop mengambil pekerjaan dengan `update … where status = 'pending'`.
Kalau dua jendela aplikasi terbuka, hanya satu yang berhasil memindahkannya ke `processing`.

## Keamanan

- Setiap akun hanya bisa melihat baris dan folder `<user_id>/` miliknya sendiri — di dua tabel
  maupun di storage. Tidak ada satu pun policy `USING (true)`.
- Bucket privat, maksimal 25 MB, hanya menerima tipe Word dan PDF.
- Di laptop, berkas sementara dikurung di `%TEMP%\mamet-konversi\<jobId>\`. Uji penolakan:
  nama berisi `..\..\`, jobId palsu, `.exe`, membaca `C:\Windows\win.ini` — semua ditolak.

Migrasi divalidasi dulu dengan menjalankan seluruh isinya di dalam `BEGIN … ROLLBACK`, lalu
dipastikan basis data kembali kosong, sebelum Owner menjalankan `supabase db push`.

## Temuan sampingan: versi web tidak pernah punya tool

Tangkapan layar Owner dari Chrome menunjukkan panel Tools hanya berisi RAG.

Sejak 9 September, tool dibaca dari folder `tools/` di disk lewat Electron. Vercel tidak
punya disk repo — jadi versi web **tidak memuat satu tool pun**. Pencarian web masih jalan
hanya karena ada jalur cadangan yang memanggil servisnya langsung.

Sekarang di luar Electron tool diambil dari salinan yang ikut dibundel saat build. Log versi
web: `✅ Versi web: 5/5 tool dimuat dari bundel build`.

## Koreksi di tengah jalan

**Salah port.** Saya menyuruh Owner membuka `localhost:5173` untuk mametlite, padahal port
itu dipakai Mamet OS. Yang terbuka justru Mamet OS versi web, dan pesannya — *"tool belum
terdaftar, periksa berkasnya"* — menyuruh memeriksa hal yang salah. Pesannya diperbaiki.

**Salah lingkup.** Panel konversi sempat saya pasang di mametlite. Owner mengoreksi:
*"mametlite tidak usah memakai fitur ubah pdf, mametlite hanya pakai rag dan pencarian web
saja."* Semua perubahan mametlite dikembalikan.

**Janji palsu.** Pesan batas waktu semula berbunyi *"hasilnya bisa diunduh nanti"*, padahal
versi web tidak punya daftar riwayat konversi. Kini pesannya menyuruh memeriksa laptop dan
mengirim ulang.

## Bukti

Owner mengirim `DOKUMEN HCDP 2025-2026.docx` dari Mamet OS versi web di Chrome, dengan
aplikasi desktop terbuka sebagai pekerja, lalu mengunduh PDF-nya.

| Ujung | Bukti |
|---|---|
| Antrian | `done` — diambil laptop 2 detik setelah dikirim, selesai 74 detik |
| Hasil | 47 = 47 halaman, Word 12.0, Word ditutup normal, tanpa error |
| Storage | `sumber.docx` 977.276 byte — sama persis dengan aslinya; `hasil.pdf` 7.769.349 byte — sama dengan konversi lokal |

## Terbukti dari HP

Setelah push dan deploy Vercel, Owner mengonversi dokumen **lain** dari HP lewat
`mamet-ecosystem.vercel.app` dan berhasil mengunduhnya.

| | Dari HP (20:02) | Uji Chrome (19:51) |
|---|---|---|
| Dokumen | Lembar kerja UT (nama panjang, berspasi) | DOKUMEN HCDP 2025-2026 |
| Diambil laptop | 4 detik | 2 detik |
| Selesai | 22 detik | 74 detik |
| Halaman | 5 = 5 | 47 = 47 |

Basis data tidak mencatat perangkat pengirim, jadi "dari HP" bersandar pada laporan Owner.
Yang dibuktikan basis data: dokumen baru masuk lewat antrian, dikerjakan laptop, hasilnya utuh.

## Yang belum terbukti

- **Pemulihan pekerjaan macet** — aplikasi ditutup di tengah konversi, ditandai gagal setelah
  15 menit — belum pernah diuji.

## Yang belum dikerjakan

- **Berkas tidak pernah terhapus.** Tiap konversi meninggalkan sumber dan hasil di bucket
  (±9,2 MB setelah dua konversi). Perlu kebijakan retensi.
- **CSP versi web memblokir `api.github.com`.** Terlihat di log uji, sudah ada sebelumnya,
  tidak memengaruhi konversi.
