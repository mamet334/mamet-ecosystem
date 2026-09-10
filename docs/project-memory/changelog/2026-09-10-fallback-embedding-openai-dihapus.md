# Fallback Embedding OpenAI Dihapus

**Tanggal:** 10 September 2026
**Roadmap:** Item 62

## Yang diminta

Item 61 mencatat bahwa cadangan embedding OpenAI menghasilkan vektor 768 angka, sementara
kolom vektor di database berukuran 3.072. Owner meminta ini dikerjakan.

## Kenapa tidak "dinaikkan ke 3.072"

Angka 768 hanya gejala. Masalah sebenarnya: cadangan itu memakai **model yang berbeda**.

Setiap model embedding punya "ruang makna" sendiri. Semua vektor di database dibuat oleh
Gemini. Kalau pertanyaan pengguna divektorkan oleh OpenAI lalu dibandingkan dengan vektor
Gemini, skor kemiripannya tidak berarti apa-apa — seperti membandingkan koordinat dua peta yang
skalanya berbeda. Menyamakan panjang vektornya hanya membuat error yang jujur berubah menjadi
hasil pencarian ngawur yang diam.

Mengganti model embedding berarti memvektorkan ulang semua data. Cadangan dari model lain
tidak pernah bisa benar, jadi cadangan itu dihapus.

## Yang ditemukan saat menelusuri

- **Ada dua jalur embedding.** Satu punya penjaga yang menolak vektor berukuran salah. Satu lagi
  — dipakai untuk pencarian memori di setiap chat — punya salinan sendiri tanpa penjaga.
- **Cadangan itu memakai kunci pengguna.** Kunci OpenAI milik sistem tidak ada, jadi cadangan
  hanya bisa hidup saat pengguna chat memakai kunci OpenAI miliknya sendiri (BYOK). Artinya
  pekerjaan internal sistem ditagihkan ke kunci pengguna, lalu hasilnya tetap ditolak database.

## Perubahan

- Cadangan OpenAI dihapus dari daftar adapter embedding.
- Kedua jalur kini lewat satu pintu yang sama, dengan satu penjaga ukuran vektor.
- Kalau Gemini gagal, pencarian memori dilewati dengan jujur; chat tetap berjalan.

## Bukti

Kode yang asli dijalankan dengan jaringan palsu, versi lama dibandingkan dengan versi baru:

| Kasus | Lama | Baru |
|---|---|---|
| Gemini sehat | vektor 3.072 | vektor 3.072 |
| Gemini gagal, pengguna memakai kunci OpenAI sendiri | kunci pengguna dipanggil | tidak ada panggilan |

Database memang menolak vektor 768 (`different vector dimensions 3072 and 768`).

Setelah deploy, dua chat dengan RAG menyala berjalan lewat jalur baru di produksi: vektor
dibuat, pencarian memori jalan tanpa error, chat selesai normal.

## Diamati, belum dikerjakan

- **Pencarian memori vektor di server belum pernah menemukan hasil.** *"minuman apa yang saya
  suka?"* tidak cukup mirip dengan *"saya suka kopi"* untuk melewati ambang 0,70. Ambang itu
  diukur dengan pernyataan lawan pernyataan, padahal pengguna biasanya bertanya. Jawabannya
  tetap benar karena memori juga dimuat lewat jalur lain.
- Saat pencarian server kosong, konteks memori kiriman frontend ditimpa kalimat "Tidak ada
  memori yang relevan."
- Wadah adapter di server dipakai bersama oleh semua permintaan. Dua pengguna yang chat pada
  saat bersamaan mungkin saling memakai kunci. Baru dibaca dari kode — perlu diselidiki.
- Log audit memori gagal ditulis di setiap chat (`rctx.tasks.add is not a function`).
