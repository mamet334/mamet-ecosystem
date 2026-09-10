# Versi Web Kembali Ber-CSP

**Tanggal:** 10 September 2026
**Roadmap:** Item 59

## Berawal dari satu baris log

Saat menguji konversi dari versi web, log mencatat File Explorer gagal membaca repo:
permintaan ke `api.github.com` diblokir oleh Content Security Policy. Owner meminta
penjelasan dulu sebelum ada kode yang diubah.

## Apa itu CSP

CSP adalah daftar alamat yang boleh dihubungi sebuah halaman web. Browser menjadi satpam:
alamat di luar daftar diblokir, siapa pun yang memintanya. Gunanya pertahanan — kalau suatu
saat ada kode jahat yang tersisip ke halaman, ia tidak bisa mengirim data ke server penyerang.

## Yang ternyata terjadi

Situs live `mamet-ecosystem.vercel.app` diperiksa langsung: **tidak memakai CSP sama sekali**.

Penyebabnya satu nama skrip. Di `frontend/package.json` ada skrip yang menghapus CSP dari
hasil build — memang dibutuhkan aplikasi desktop, karena CSP mengganggu Electron saat membuka
berkas lokal. Skrip itu bernama `postbuild`, dan npm **otomatis** menjalankan skrip bernama
itu setiap kali `npm run build`. Vercel memakai perintah yang sama.

| Tempat | CSP | Akibat |
|---|---|---|
| Mode dev (`localhost:5173`) | Aktif | GitHub diblokir — error yang terlihat di log |
| Situs live (dipakai dari HP) | **Tidak ada** | Tidak ada perlindungan |

Terbalik dari yang seharusnya: yang terlindungi justru lingkungan uji.

## Pilihan Owner

| Pilihan | Hasil |
|---|---|
| 1. Tambahkan GitHub ke daftar | Error di mode dev hilang; produksi tetap tanpa perlindungan |
| **2. Hentikan penghapusan untuk web** | Produksi terlindungi kembali; desktop tetap seperti sebelumnya |

Owner memilih pilihan 2.

## Audit dulu, ubah kemudian

Memulihkan CSP di produksi berisiko: fitur yang selama ini jalan *karena* tidak ada CSP bisa
tiba-tiba terblokir. Maka setiap alamat luar yang dihubungi kode diperiksa terhadap daftar
izin — termasuk alamat dari `.env`, iframe, dan worker.

- Supabase, Wikipedia, font Google, backend lokal: sudah diizinkan.
- Bing, Google News, Antara, DuckDuckGo: tidak dihubungi langsung dari browser, melainkan
  lewat proxy di Supabase.
- **Yang kurang hanya dua:** `api.github.com` dan `raw.githubusercontent.com`.

## Perubahan

- Skrip diganti nama menjadi `desktop:postbuild` — isinya tidak berubah, tapi npm tidak lagi
  menjalankannya otomatis. Skrip build desktop memanggilnya secara eksplisit.
- Dua alamat GitHub ditambahkan ke daftar izin, dengan komentar di `index.html` yang
  menjelaskan asal-usul masalah ini dan kapan daftar harus diperbarui.

## Bukti

| Uji | Hasil |
|---|---|
| `npm run build`, persis seperti Vercel | Penghapus tidak jalan; CSP ada |
| Build desktop | CSP dan `crossorigin` terhapus; font dan aset utuh |
| Halaman ber-CSP di browser | GitHub, Supabase, Wikipedia lolos; **`example.com` diblokir** |

Baris terakhir adalah kontrolnya: alamat yang tidak ada di daftar benar-benar ditolak.

Bukti tambahan: mode dev memakai CSP ini sepanjang hari, dan semua uji versi web untuk
konversi, cache, dan panel Riwayat berjalan di bawahnya tanpa terblokir.

## Yang belum terbukti

- Situs live benar-benar memuat CSP setelah deploy.
- File Explorer versi web saat login.
- Build installer desktop penuh.
