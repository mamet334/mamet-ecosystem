# 3 November 2026 — Konektor MCP Tahap G2: Settings untuk konektor umum (pasang, kredensial, tinjau & paku, sakelar)

[Rancangan §9](../../roadmap/ROADMAP-KONEKTOR-MCP.md) · Item 129. Desktop saja; tanpa perubahan server. Lanjutan
[G1](2026-11-03-konektor-mcp-tahap-g1-pipa-umum.md).

## Yang dibangun

**Proses utama** — tiap tugas di berkasnya sendiri:
- `konektor/sesiUmum.cjs` menyalakan dan mematikan server per workspace (K3).
  - **Tinjau:** tersambung sebentar ke server, membaca `tools/list`, lalu menyimpan *snapshot* alatnya.
  - **Setujui:** layar hanya mengirim **nama** alat. Sidik dihitung dari snapshot yang dilihat Owner. Tanpa tinjauan,
    persetujuan ditolak, dan satu snapshot hanya bisa dipakai sekali.
  - Server yang mengubah alat yang sudah disetujui tidak dinyalakan dan prosesnya dimatikan.
  - Sakelar disimpan di `konektor-umum-sakelar.json`. Bukan di `konektor.json`, karena normalisasi crawler membuang id
    yang tidak dikenalnya.
  - Dipulihkan saat aplikasi dibuka.
- `konektor/ipcUmum.cjs` adalah satu-satunya pintu dari layar:
  - alamat program **dipilih di dialog proses utama**, dan nama berkasnya harus sama dengan resep;
  - kredensial hanya dikirim dari layar ke `safeStorage`;
  - menghapus server ditanyakan lewat dialog;
  - folder resep Owner bisa dibuka;
  - **tidak ada saluran untuk memanggil alat** (itu bagian gerbang K17 di G3).
- `main.cjs` hanya bertambah satu blok pendaftaran. Server umum dipulihkan saat aplikasi dibuka dan **dimatikan saat
  keluar**.
- `preload.cjs` mendapat jembatan `konektorUmum`.
- `konektorMcp.cjs` kini juga mengekspor `matikanPohon` dan `denganBatasWaktu`, supaya cara mematikan dan membatasi
  waktunya tetap satu.

**Layar** — `components/konektor/`, ditampilkan di bawah konektor bawaan oleh `BagianKonektor.jsx` (satu baris):
- `TambahServer.jsx`: daftar resep, pasang, dan buka folder resep. Sumber resmi ditampilkan sebagai teks, bukan
  tautan.
- `KartuServerUmum.jsx`: isian kredensial (tipe *password*, dikosongkan sesudah terkirim, layar hanya tahu "terisi"),
  tinjau alat, sakelar Assistant/Engineer, dan hapus.
- `TinjauAlat.jsx`: deskripsi alat ditampilkan sebagai **teks**, bukan HTML, dengan keterangan bahwa itu tulisan
  pembuat server. Alat ditandai baru, disetujui, atau **BERUBAH**.
- Dua ikon diganti dengan ikon yang sudah ada di subset font, supaya tidak perlu mengunduh font baru.

## Bukti

- **Uji `uji-konektor-umum-g2.mjs`** menyalakan **server MCP sungguhan**: `uji/lib/serverMcpTiruan.cjs`, berbasis SDK
  resmi dan dijalankan lewat `node.exe`, tanpa unduhan. Rantai yang diuji:
  - kredensial kosong → server tidak menyala;
  - tinjau, lalu setujui (nama karangan dibuang);
  - nyala di Assistant, sementara Engineer tetap mati;
  - token dari brankas sampai ke server (dicek lewat SHA-256), dan rahasia proses utama tidak;
  - alat yang tak disetujui ditolak sebelum sampai ke server;
  - **rug pull:** deskripsi diganti → tidak ada alat dipakai, lalu tinjau ulang menandai alat yang "berubah";
  - proses benar-benar mati setelah dimatikan;
  - server yang berhenti sendiri tidak dipanggil;
  - kedua workspace dipulihkan;
  - hapus membersihkan entri, kredensial, dan sakelar;
  - kelas Tailwind benar-benar dibuat.
- **Mutasi pada salinan: 18/18 mati.** Putaran pertama hanya 13/18. Tiga di antaranya celah uji sungguhan yang kini
  ditutup: server yang berhenti sendiri, pemulihan sakelar Engineer, dan proses yang benar-benar mati. Dua lainnya
  mutan yang keliru: satu setara dengan kode asli, dan `mt-[13.37q]` ternyata CSS sah karena `q` adalah satuan.
- Penjaga `uji-catch-diam` tetap 91. `uji-ikon-subset` lulus. `vite build` berhasil. Suite penuh **150/150**. Tidak
  ada proses server tiruan yang tertinggal.
- **Di aplikasi Owner** (`npm run desktop` dijalankan ulang, 3 Nov 13:05): Settings › Konektor menampilkan kotak
  "Tambah konektor" berisi GitHub (stdio, diuji v2.0.3), petunjuknya, tombol "Pasang (tunjuk program)", dan "Buka
  folder resep". Kartu Ecosystem Crawler tetap utuh.
