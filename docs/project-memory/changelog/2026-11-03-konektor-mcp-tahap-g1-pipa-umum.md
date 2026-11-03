# 3 November 2026 — Konektor MCP Tahap G1: pipa konektor umum ("banyak tangan") di proses utama

[Rancangan §9](../../roadmap/ROADMAP-KONEKTOR-MCP.md) · Item 129. Desktop saja, dan belum tersambung ke aplikasi:
`main.cjs`, layar, dan server tidak disentuh. Ini fitur baru di luar K1–K7 (ADR-0022), dan uji penjaganya tetap hijau.

## Keputusan Owner (3 Nov)

Owner ingin MCP menjadi "tangan" yang optimal: server MCP **apa saja**, dengan GitHub sebagai yang pertama. Server
lain harus bisa digabungkan **tanpa kode**, dan tiap berkas memegang **satu tugas**. Empat keputusan dicatat di
rancangan:
- **K16** — alat ditinjau dan dipaku;
- **K17** — dialog izin dengan pilihan "selama percakapan ini";
- **K18** — kredensial terenkripsi di perangkat;
- **K19** — server baru cukup satu berkas resep.

## Penelusuran graf sebelum menyambung

`graphify update .` (tanpa token) menghasilkan 12.383 node dan 18.798 relasi. Tidak ada berkas mati dan tidak ada
siklus impor. Penelusuran kabel konektor menemukan **10 titik sambung** (S1–S10) yang akan salah tanpa suara bila
rancangan diikuti apa adanya. Contohnya:
- **S1:** pemasang hanya membawa `dist/` + `electron/`, jadi resep di `capability/` tidak akan ikut ke aplikasi
  terpasang.
- **S2:** `AssistantService` hanya mengambil satu konektor yang dikenal.
- **S4:** aplikasi 4.4.1 terpasang mengirim konektor sebagai satu objek.
- **S5:** penyaring rahasia membuang variabel bernama `TOKEN`.

Daftar lengkap dan penanganannya ada di rancangan §9.

**Kerapian.** Ada 26 berkas kode tanpa pemakai statis, dan semuanya beralasan: arsip, `tools/` yang dimuat dinamis,
`IntentClassifier` (ADR-0017), dan `backend/server.js` (T3). Tiga berkas gemuk (`ConversationEngine.jsx`,
`AssistantService.js`, `main.cjs`) tidak ditambah isinya oleh Tahap G.

## Yang dibangun — `frontend/electron/konektor/`

| Berkas | Tugas tunggal |
|---|---|
| `resep.cjs` | Membaca & memvalidasi resep. Program hanya `.exe` (tanpa shell). Variabel berbau rahasia ditolak sebagai nilai biasa. HTTP hanya https atau localhost, tanpa kredensial di URL. Resep Owner tak bisa menimpa resep bawaan |
| `resep/github.json` | Resep GitHub: server resmi `github-mcp-server` (diuji untuk v2.0.3), `stdio --read-only`, token `GITHUB_PERSONAL_ACCESS_TOKEN` diminta sebagai kredensial |
| `sidikAlat.cjs` | Sidik SHA-256 definisi alat (nama + deskripsi + skema, kunci terurut). Bila satu alat yang disetujui berubah, **seluruh server** tidak dipakai sampai ditinjau ulang. Alat baru diabaikan |
| `brankas.cjs` | Kredensial dienkripsi lewat enkripsi yang disuntikkan (`safeStorage` di proses utama). Tanpa enkripsi, brankas menolak menyimpan. `status` hanya mengembalikan "terisi". Nilai berbaris baru ditolak |
| `daftarServer.cjs` | Server yang dipasang Owner. Alamat program harus absolut `.exe`. Mengganti program atau argumen (mis. membuang `--read-only`) menghapus persetujuan alat |
| `transport.cjs` | stdio atau Streamable HTTP. Kredensial ditambahkan **sesudah** penyaringan rahasia (S5), hanya untuk server pemiliknya. Kredensial kosong atau program hilang → server tidak dinyalakan, dengan pesan jelas. Ringkasan untuk log tidak membawa rahasia |

## Bukti

- Uji baru `uji/uji-konektor-umum-g1.mjs` **lulus**.
- **Mutasi pada salinan repo 27/27 mati.** Satu mutan sempat lolos, yaitu "*rug pull* tetap dipakai". Uji saat itu
  hanya memaku satu alat, sehingga aturan "seluruh server dimatikan" tidak pernah diuji. Celah itu sudah ditutup
  dengan dua alat yang dipaku, satu di antaranya diubah.
- Penjaga `uji-catch-diam` menangkap 3 `catch` tanpa keterangan di berkas baru. Ketiganya kini diberi alasan,
  patokan tetap 91.
- Suite penuh **149/149**. Berkas baru dipindai dan tidak memuat karakter kendali.
