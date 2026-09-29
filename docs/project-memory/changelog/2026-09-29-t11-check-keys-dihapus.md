# T11 — `check-keys` dihapus

**29 September 2026** · `supabase/functions/check-keys/` · keputusan Owner 28 September

## Yang berubah

Fungsi Edge `check-keys` dihapus dari repo. Satu berkas, `index.ts`.

## Kenapa

Tiga hal sekaligus, dan ketiganya diperiksa dari kode sebelum diputuskan:

1. **Tidak ada pemeriksaan pengguna sama sekali** di dalamnya — bukan sekadar "kunci anon lolos". Siapa pun
   yang punya kunci anon bisa memanggilnya, dan kunci itu tertulis di repositori **publik**.
2. **Tidak ada satu pun pemanggil** di `frontend/src` maupun `mametlite/`.
3. Tiap panggilan melakukan **panggilan API berbayar** ke Gemini, Groq, dan dua model embedding OpenRouter.

Ia alat diagnosis sekali pakai (10 September) untuk satu pertanyaan: berapa dimensi vektor bila embedding
lewat OpenRouter. Pertanyaan itu sudah terjawab dan jawabannya sudah menjadi kode. Sebagian probenya bahkan
masih menguji kunci server Gemini & Groq yang dihapus 15 September — jadi ia mengukur sesuatu yang tidak
ada lagi.

## Pemeriksaan sebelum menghapus

Dicari di seluruh berkas `.js .jsx .ts .tsx .json .toml .sh .ps1 .cjs .mjs .yml .yaml`. Yang ditemukan:

- `graphify-out/**` — hasil pindaian grafik pengetahuan, bukan kode yang berjalan.
- `ai_adapter.ts:91` — satu komentar yang menyebut `check-keys` sebagai salah satu tempat pemakai
  `gemini-2.5-flash`. **Ikut diperbarui**, karena komentar yang menyebut berkas yang sudah tidak ada akan
  menyesatkan pembaca berikutnya persis seperti `NORTH_STAR.md` berlabel ACTIVE menyesatkan saya.

Tidak ada pemanggil di kode maupun konfigurasi.

## Yang TIDAK ikut diputuskan

Bagian lain T11 — **40 tabel dengan hak bawaan berlebih** bagi `anon`/`authenticated` — tetap terbuka. Itu
perkara terpisah: mencabut hak pada tabel yang memang dibaca aplikasi bisa mematikan fitur, jadi perlu
daftar pemakai per tabel lebih dulu. Jangan dicabut buta.

## Langkah kedua — ✅ selesai hari yang sama

**Fungsinya juga dihapus dari Supabase oleh Owner.** Menghapus berkas di repo tidak mencabut penerapan yang
sudah jalan — selama masih terpasang, ia tetap bisa dipanggil siapa pun dan tetap membakar panggilan
berbayar. Dengan langkah kedua ini, jalan masuk tanpa pemeriksaan pengguna itu benar-benar sudah tidak ada.

## Bukti

52 berkas uji hijau. Isi berkas yang dihapus tetap tertelusuri lewat `git show`.

**Cara mengoreksi keputusan ini bila kenyataan berbeda** (dicatat 28 September): bila ternyata ada pemanggil
di luar repo — skrip Owner, bookmark, alat luar — ia akan gagal dengan 404. Itu tandanya keputusan ini perlu
ditinjau, dan fungsinya **ditulis ulang untuk pertanyaan hari itu**, bukan dipulihkan apa adanya.
