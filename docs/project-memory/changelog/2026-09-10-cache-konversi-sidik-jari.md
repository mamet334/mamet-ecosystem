# Cache Hasil Konversi — Tidak Memproses Hal yang Sama Dua Kali

**Tanggal:** 10 September 2026
**Roadmap:** Item 58

## Masalahnya

Setiap konversi lewat laptop (Item 57) meninggalkan dua berkas di penyimpanan untuk
selamanya: dokumen Word yang dikirim dan PDF hasilnya. Versi web juga tidak punya daftar
riwayat, jadi PDF hanya bisa diunduh dari tombol di pesan chat tempat konversi dilakukan.

## Rancangan yang berganti di tengah jalan

Rancangan pertama saya adalah batas waktu: hapus semuanya setelah 24 jam. Sebelum sempat
di-commit, Owner bertanya: *bagaimana kalau memakai sistem cache atau sampah?*

| Sistem | Cocok untuk |
|---|---|
| Sampah (Recycle Bin) | Data yang tidak tergantikan — perlu masa tunggu untuk dipulihkan |
| Cache berkuota | Data yang bisa dibuat ulang — disimpan selama ruang cukup |

Hasil konversi selalu bisa dibuat ulang, karena dokumen aslinya ada di perangkat Owner.
Maka cache. Owner menambahkan poin yang kemudian menjadi inti rancangan:

> cache bisa lebih baik karena tidak berulang kali memproses sesuatu yang sama

## Cara kerjanya

```
Kirim dokumen ─► hitung sidik jari ISI-nya (SHA-256) di browser
                   │
       pernah dikonversi & PDF masih ada?
         ├─ ya    ─► PDF langsung diberikan — tanpa laptop, bahkan saat laptop mati
         └─ tidak ─► kirim ke laptop ─► PDF disimpan di cache
Cache > 200 MB ─► buang yang paling lama TIDAK DIPAKAI
```

**Dikenali dari isi, bukan nama.** Dokumen yang sama dengan nama berbeda tetap dikenali.
Dokumen yang diedit satu huruf saja dianggap dokumen baru, sehingga tidak ada PDF basi.

**Per akun, sengaja tidak dibagi.** Kalau dibagi antar pengguna, orang lain bisa mengetahui
bahwa suatu dokumen pernah dikonversi di sistem ini.

**"Paling lama tidak dipakai", bukan "paling lama dibuat".** PDF yang sering diunduh
bertahan, walau dibuat paling awal.

**Siap untuk ke depan.** Kunci cache adalah jenis pemrosesan + sidik jari isi. Jenis lain —
misalnya ringkasan dokumen — bisa memakai mekanisme pencarian dan pembuangan yang sama.

## Kenapa yang membersihkan adalah laptop

Jadwal di database (pg_cron) tidak bisa: trigger `storage.protect_delete` memblokir
penghapusan berkas lewat SQL. Berkas hanya bisa dihapus lewat Storage API. Laptop-pekerja
sudah login, hanya berhak atas folder akunnya sendiri, dan satu-satunya pihak yang menambah
isi cache — jadi kuota ditegakkan di sana, setelah setiap konversi dan tiap jam.

Aturan lainnya:

- dokumen Word yang dikirim dihapus segera setelah konversi selesai atau gagal;
- pekerjaan yang tidak diambil 15 menit ditandai kedaluwarsa;
- riwayat gagal lebih dari 7 hari dihapus;
- riwayat dihapus hanya kalau berkasnya berhasil dihapus — kalau tidak, riwayat tetap ada
  sebagai penunjuk untuk dicoba lagi, bukan berkas yatim yang tak tercatat.

## Panel Riwayat

Tombol **Riwayat** di atas chat workspace Assistant: pemakaian "X MB dari 200 MB", daftar
konversi dengan status, jumlah halaman, ukuran, tanggal, serta tombol Unduh dan Hapus.

## Bukti

**Pembersihan saat laptop mulai:** bucket turun dari 4 berkas menjadi 2 — hanya PDF yang
tersisa.

**Cache, dengan laptop mati:**

| WIB | Kejadian |
|---|---|
| 20:39:45 | lembar kerja UT dikirim → satu pekerjaan baru bersidik jari |
| 20:40:52 | laptop selesai, dokumen Word langsung dihapus |
| 20:41:12 | detak terakhir laptop — aplikasi desktop ditutup |
| 20:41:52 | dokumen yang sama dikirim lagi → ⚡ diambil dari cache |

Hanya satu pekerjaan baru yang tercatat, bukan dua. Kiriman kedua tidak pernah masuk antrian.

**Logika kuota** diuji dengan kode pekerja yang asli dan database tiruan: 300 MB PDF turun
menjadi 180 MB; PDF yang dibuat paling awal tapi baru dipakai bertahan; akun lain tidak
tersentuh. 10 dari 10 pemeriksaan lulus.

## Yang belum terbukti

Pembuangan saat kuota benar-benar penuh di penyimpanan sungguhan — butuh ratusan MB PDF,
jadi baru diuji dengan database tiruan.

## Keterbatasan

Dua konversi sebelum sistem cache tidak punya sidik jari, jadi tidak pernah dikenali. Di
Riwayat kini ada dua entri lembar kerja UT: yang lama dan yang baru.
