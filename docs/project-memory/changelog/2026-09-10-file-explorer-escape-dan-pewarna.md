# File Explorer Menampilkan Kode Apa Adanya

**Tanggal:** 10 September 2026
**Roadmap:** Item 60

## Berawal dari pertanyaan

File Explorer dibuat oleh DeepSeek, dan Owner bertanya apakah fitur ini sebenarnya berguna.

Aplikasinya ternyata penampil **hanya-baca untuk kode Mamet OS sendiri**: di desktop ia membaca
folder proyek, di web ia membaca repo GitHub. Ia bukan penjelajah dokumen seperti File Explorer
Windows. Isinya sudah tersedia lebih lengkap di VS Code dan github.com.

Yang bernilai adalah mesin di belakangnya, `RepositoryReaderService`. Mesin ini dibuat untuk
Engineer, supaya bisa membaca kode sebelum mengusulkan perbaikan. Owner memilih memperbaiki
aplikasinya.

## Bug 1: pengaman yang tidak mengamankan

Sebelum kode ditampilkan, tanda `<` dan `>` harus diubah menjadi `&lt;` dan `&gt;`, supaya
browser menampilkannya sebagai huruf, bukan membacanya sebagai tag HTML. Fungsi `escapeHtml`
mengubah `<` menjadi `<` — tidak mengubah apa pun. Akibatnya, saat membuka berkas `.jsx`,
baris seperti `<div className="…">` hilang atau merusak tampilan.

## Bug 2: pewarna yang tidak mengenal string

Pewarna kode menjalankan beberapa aturan berurutan, masing-masing di atas hasil aturan
sebelumnya. Aturan komentar ("semua sesudah `//` adalah komentar") tidak tahu bahwa `//` di
`"https://…"` berada di dalam string, jadi setiap URL berubah abu-abu miring. Aturan `#` berlaku
untuk semua berkas, sehingga warna `'#fff'` di CSS pun dianggap komentar.

Menambah satu aturan lagi tidak menyelesaikan akarnya. Pewarna ditulis ulang menjadi pembaca
**sekali jalan dari kiri ke kanan**: begitu masuk tanda kutip, ia tahu sedang di dalam string
sampai kutipnya ditutup. Tiap karakter hanya punya satu peran.

Aturan komentar kini mengikuti jenis berkas — `#` hanya untuk Python, shell, YAML, dan `.env`.
Berkas tulisan biasa (`.md`, `.txt`) tampil polos, karena prosa penuh kata seperti "if" dan
apostrof seperti "Don't" yang bukan kode.

## Bug 3: ditangkap oleh uji sendiri

Versi pertama pewarna baru menampilkan baris kosong ganda setelah setiap komentar. Berkas di
repo ini memakai akhir baris gaya Windows (`\r\n`); komentar dipotong sebelum `\n`, sehingga
`\r` tertinggal di dalam kotak warna dan browser membacanya sebagai baris baru kedua.

Uji menangkapnya karena ia menjalankan pewarna pada berkas nyata — termasuk `FileExplorer.jsx`
sendiri — dan membandingkan teks yang tampil dengan aslinya. Diperbaiki sebelum dilaporkan.

## Bukti

Fungsi diambil langsung dari berkas, versi lama dan baru, lalu dirender di browser sungguhan.
Tiap kasus diperiksa: teks tampil sama persis, tidak ada tag yang terbentuk, dan tiap potongan
berwarna sesuai perannya.

| Uji | Lama | Baru |
|---|---|---|
| Tag di dalam kode (JSX, `<script>`, `a < b`, …) | 5/5 rusak | 5/5 utuh |
| `//` dan `#` di dalam string | 0/4 benar | 4/4 benar |
| Kasus lain (kutip tak tertutup, CSS, YAML, `\r\n`, …) | — | 8/8 |
| Empat berkas nyata dari repo | — | utuh, ≤4 ms |

Owner mengonfirmasi di aplikasi desktop: tag JSX tampil sebagai teks, dan URL di
`package-lock.json` kuning utuh sampai akhir.

## Keterbatasan

Regex di kode JavaScript (misalnya `/\/\//g`) masih bisa salah warna. Membedakannya dari tanda
bagi butuh parser penuh.

## Dicatat, tidak dikerjakan

- GitHub hanya melayani sekitar 60 permintaan per jam tanpa token; setiap klik folder di versi
  web memakai satu.
- Pintu baca berkas desktop (`fs:readFile`) menerima path mana pun di laptop, bukan hanya folder
  proyek. Pintu ini dipakai bersama fitur lain.

## Yang belum terbukti

File Explorer versi web — perbaikannya berlaku sama, tapi versi web belum dibuka.
