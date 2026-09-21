# Workspace di Research App — Buat, Ganti Nama, Hapus Bila Kosong, Pilihan Diingat

**Tanggal:** 21 September 2026
**Roadmap:** T9 ([`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md))
**Status:** ✅ selesai — dicoba Owner di aplikasi, dibuktikan dari log server.

## Masalah

Research App hanya menampilkan deretan tombol workspace; tidak ada cara membuat, mengganti nama, atau menghapus.
Satu-satunya pembuat workspace adalah sub-agent `knowledge_manager`, yang menamai workspace dengan kalimat chat
("Observasi Pasar Freelance dan tampilkan hasilnya saja", "Berapa pejabat struktural …?"). Research App memilih space
**terbaru** sebagai bawaan, jadi unggahan RAG diam-diam mendarat di sana — buku Kepbup 222 dokumen tersimpan di space
bernama "Observasi Pasar Freelance dan tampilkan hasilnya saja".

## Ke mana unggahan masuk (dijawab dari kode)

- PDF / Word / teks → workspace yang **terpilih** (tombol biru), dikirim sebagai `spaceId` ke `rag-process` (yang memeriksa
  kepemilikannya); tanpa pilihan → space CORE pengguna.
- Excel → jalur Data Tabel (`asn_berkas`/`asn_pegawai`, Item 92), bukan workspace.
- Chat mencari di **semua** workspace pengguna (`document_search.ts`, Item 65); dibatasi ke satu workspace hanya bila
  namanya disebut lengkap bersama kata "workspace"/"ruang"/"space" (`routing_decider.ts`).

## Perubahan

- `frontend/src/core/runtime/services/ruangPengetahuan.js` (baru): `periksaNamaRuang` (dirapikan, ≤60 huruf, tidak
  kembar tanpa beda huruf besar, bukan "global"), `pilihRuangAwal` (pilihan tersimpan bila masih ada, selain itu
  terbaru), `buatRuang`, `gantiNamaRuang`, `hapusRuangKosong` — jumlah dokumen dihitung di server **tepat sebelum**
  menghapus (dokumen ikut terhapus lewat `ON DELETE CASCADE`), CORE ditolak di kode dan di filter DELETE
  (`space_type=neq.CORE`), 0 baris terhapus dilaporkan.
- `frontend/src/components/research/DaftarWorkspace.jsx` (baru): tombol "＋ Workspace baru" (langsung terpilih), baris
  "Unggahan dokumen masuk ke …", Ganti nama, Hapus (redup + alasan bila berisi dokumen / CORE / sedang mencari).
- `ResearchApp.jsx`: memakai komponen itu; pilihan workspace diingat (`localStorage`, dibungkus try/catch).

## Bukti

- Uji otomatis `uji-ruang-pengetahuan.mjs` (di luar git, `frontend/node_modules/.uji-rag/`): 16/16 lulus — termasuk
  workspace berisi 3 dokumen ditolak **tanpa** DELETE terkirim, CORE ditolak sebelum ke server.
- Uji Owner di aplikasi, log server (UTC): ganti nama "Kepbup OKU 2025" 2× (12:20), buat "uji workspace" (12:21:28),
  hapus "Observasi Pasar" & "Observasi Pasar Freelance" (12:21:52, 12:22:05) — masing-masing didahului hitung dokumen
  (HEAD `documents?space_id=…`). Kepbup tetap 222 dokumen.
- Sebelumnya (izin Owner): space Kepbup diganti nama langsung di database menjadi "Kepbup OKU 2025".

## Catatan

- Ralat laporan: dua "My Core Knowledge" yang terlihat di kueri awal milik dua akun berbeda; workspace Owner kini
  "Kepbup OKU 2025", "uji workspace", "My Core Knowledge · inti".
- Belum ada fitur memindahkan dokumen antar-workspace.
