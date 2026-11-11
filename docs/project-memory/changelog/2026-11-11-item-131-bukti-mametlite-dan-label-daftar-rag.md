# 11 November 2026 — Item 131: bukti Mametlite, label daftar RAG, urut judul

Perintah Owner 11 Nov: *"ya kerjakan langkah 2, saya uji mametlite"*.

## Bukti Mametlite tidak rusak (syarat ✅ tahap yang mengubah server)

Diuji Owner di Mametlite web live terhadap `agent-process` v559 (lalu v562):
- chat "halo" dijawab, label "Perkiraan AI";
- pertanyaan RAG: `RSUD.txt` ditemukan & disebut sebagai Sumber; model tidak mengarang jabatan yang tak tertulis →
  label "Jawabannya tidak ditemukan".

Dengan ini tahap **B, C, D, E, F, H, I** terbukti tidak merusak Mametlite (yang tersisa di tiap tahap dicatat di
roadmap). K4: syarat "Mametlite tidak rusak" terpenuhi untuk muatan Item 131.

## Yang diubah (`shared/ragAlat.js`, `prompt_dasar.ts`)

1. **Label untuk laporan daftar RAG.** Jawaban dari `rag_daftar` yang menulis "Sumber: space …" diturunkan dari
   VERIFIED (temuan live 11 Nov) karena yang dihitung sumber hanya judul dokumen. Kini nama space dari hasil
   `rag_daftar` ikut menjadi sumber, dan petunjuk alat menyebut: Sumber = judul dokumen (isi) atau nama space (daftar).
2. **Celah yang ditemukan saat menulis uji:** baris berbentuk daftar/space di dalam *isi dokumen* bisa ikut terurai
   sebagai sumber. Kini isi dokumen dibuang lebih dulu sebelum judul/space diurai.
3. **Urut judul.** Keterangan `rag_daftar`: "terbaru/terlama" = waktu unggah; "judul" untuk "dokumen paling awal/akhir"
   bila dokumen diunggah bersamaan.
4. **Nama model.** Di Mametlite model menyebut nama modelnya saat hanya disapa (efek kalimat "sebutkan dengan jujur bila
   ditanya" di prompt baru) → "sebutkan HANYA bila pengguna menanyakannya".

**Tidak dikerjakan (sengaja):** merampingkan blok petunjuk alat folder (±4.300 huruf). Hampir setiap kalimatnya dijaga
uji dan lahir dari kegagalan nyata model; merampingkannya tanpa skenario live dengan model lemah berisiko mengembalikan
kegagalan itu diam-diam. Tetap sisa Tahap I.

## Bukti

- `uji-alat-rag-b` lulus, mutasi **29/29 mati** (dua mutasi baru; satu pemeriksaan lama "onDone asli" yang sudah tak
  bisa gagal sejak Tahap E diperketat). `uji-anggaran-prompt-efi` +1 pemeriksaan. Tujuh uji terkait lulus; bundel bersih.
  Suite penuh tidak diulang (perubahan di satu modul + satu kalimat prompt).
- **Platform:** `agent-process` **v562** — 114 berkas = 108 identik, 0 berbeda, 6 berkas tipe dikosongkan platform.
- **Live v562:**
  - Ecosystem, percakapan baru, "dokumen paling awal di space sejarah aplikasi apa?" — **1 putaran** `rag_daftar`
    (dulu 4), menjawab kedua tafsir (waktu unggah vs tanggal judul `2026-06-23-…`), `Sumber: sejarah aplikasi mamet
    ecosystem`, **`[STATUS: VERIFIED]` bertahan**.
  - Mametlite "halo" — nama model tidak lagi disebut.

## Temuan yang dicatat (belum dikerjakan)

- Mametlite: model memanggil pengguna "Mamet Lite" — pesan pembuka aplikasi dikira perkenalan pengguna. Sumbernya di
  kode Mametlite (tidak disentuh tanpa perintah Owner); belum diperiksa apakah sudah terjadi sebelum Item 131.
- Mametlite: jawaban RAG menampilkan NIP yang ada di dokumen pengguna. Perlindungan K3 hanya untuk Data Tabel ASN;
  penyamaran NIP di RAG biasa adalah keputusan Owner.
- Model masih memilih `urut: "terlama"` (bukan `"judul"`) untuk "paling awal", tetapi menjawab benar dari daftar.
