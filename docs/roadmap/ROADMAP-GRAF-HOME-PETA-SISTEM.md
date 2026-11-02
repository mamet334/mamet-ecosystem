# ROADMAP-GRAF-HOME-PETA-SISTEM — Item 130: Graf Home menjadi peta sistem Mamet

**Status:** 📝 berjalan — Tahap 0 ✅ (pratinjau disetujui 2 Nov), **Tahap A ✅** (2 Nov, dicek Owner di desktop —
[log](../project-memory/changelog/2026-11-02-graf-home-tahap-a.md)); berikutnya **Tahap B**.
**Kedudukan:** butir **Parkir** fase hardening ([ADR-0022](../adr/ADR-0022-mamet-cukup-dan-fase-hardening.md)) yang
diambil Owner — boleh dikerjakan kapan saja (mis. selagi K1/K2 menunggu saldo), asal uji yang menjaga K1–K7 tetap hijau.
**Kode:** `frontend/src/components/dashboard/ActivityGraph.jsx`, `HomeDashboard.jsx`,
`frontend/src/core/runtime/hooks/useDashboardData.js`, `frontend/src/components/os/MenuTeks.jsx`.
**Menggantikan sebagian:** [`constitution/23_HOME_DASHBOARD_SPEC.md`](../../constitution/23_HOME_DASHBOARD_SPEC.md) §CENTRAL NODE
(diubah di Tahap C). Dokumen lama `ROADMAP-KNOWLEDGE-GALAXY-COSMIC-ORBITS.md` & `ROADMAP-DASHBOARD-OBSERVABILITY-REALTIME.md`
tetap ✅ — efek visualnya (orbit, pijaran) dipertahankan.

## 1. Masalah (diperiksa 2 Nov di kode + platform)

Graf Home menggambarkan **apa yang tersimpan**, bukan **bagaimana Mamet bekerja**, dan sebagian lampunya berbohong:

| Yang tampil | Keadaan sebenarnya |
|---|---|
| Pusat "SUPABASE KERNEL" (perintah Konstitusi 23) | Supabase = basis data/ingatan bersama, bukan otak. Owner: K23 dulu dihasilkan ChatGPT — cocok untuk "pengetahuan Mamet", tidak untuk memahami sistem & fitur |
| Agent Process merah | `service_heartbeat` = DOWN basi sejak 30 Okt; `agent-process` aktif (v543) |
| LLM Provider selalu hijau | dibaca dari `ai_system_logs` yang 0 baris → saldo OpenRouter minus tak terlihat |
| Embedding hijau | hanya karena potongan lama ada, bukan bukti embedding baru bisa dibuat |
| Realtime abu-abu | status tak pernah diisi |
| Sub Agents, Tools, Skills, Trace, Verification, Audit, Embedding, pgvector | label statis tanpa isi; Directory memberi lencana MEMORI pada Sub Agents/Tools |
| Label cluster | menumpuk di satu titik, tak terbaca |
| Tak tampil sama sekali | Data Tabel ASN, alat chat (5), alat folder (9), konektor MCP (Ecosystem Crawler, 5 alat), 13 sub-agent server, OpenRouter |
| Knowledge Directory & kotak Menu | terbuka di awal (`ActivityGraph.jsx:39` `useState(true)`; `MenuTeks.jsx` membuka menu di Home — "lobi game" Item 127) |

**Biaya per buka Home** (sekali, tanpa interval; nol panggilan model): `functions.invoke('ping')` hanya untuk lampu Edge,
`select('*')` pada `agent_logs`/`api_usage`/`ai_system_logs`, `document_chunks` s/d 5.000 baris hanya untuk dihitung,
`storage.listBuckets()`, Realtime 3 tabel.

## 2. Keputusan Owner (2 Nov)

1. **Pusat = MAMET, digambar dua belahan** — Desktop/Klien (`AssistantService`, jendela konteks, alat folder, Data Tabel,
   MCP di Electron) & Server (`agent-process` `core_engine`). Bukan `agent-process` saja: otaknya memang terbelah.
   **Penyambung** yang digambar: jalur pesan (kontrak permintaan/jawaban), putaran alat (alat lokal dijalankan klien, hasil
   dikirim balik sebagai pesan hasil mesin), `shared/` (satu buku aturan), Supabase (ingatan bersama: Auth, data, `traceId`).
2. **Lingkar 1** = inti ADR-0022 (Chat, RAG Dokumen, Data Tabel ASN) + Engineer + Memori. **Lingkar 2** = alat chat, alat
   folder, MCP, sub-agent. **Data** = ekor dari pemakainya. **Fondasi luar** = Supabase, OpenRouter, Electron dengan lampu
   status nyata.
3. Simpul statis **diganti** simpul kemampuan nyata, diambil dari **daftar resmi** (alat baru otomatis muncul).
4. Lapisan Kemampuan dibuka **lewat tombol** (layar Owner 1366×768).
5. **MCP berekor**: MCP → konektor → alat; konektor baru otomatis muncul. Sumber = `KONEKTOR` di
   `frontend/electron/konektorMcp.cjs` (yang dibaca Settings › Konektor); status per workspace di `konektor.json`.
6. **Sub-agent: daftar resmi di `shared/`**, dibaca server & graf (pilihan a).
7. **Percakapan berekor pesan**: ukuran simpul = jumlah pesan (dihitung di DB), ekor pesan dimuat saat diklik; ekor pesan =
   tempat garis ke alat yang dipakai (`steps` 🔍/📋, `metadata.toolsUsed`, `subagentRuns`) → graf menjadi rute pemakaian.
8. **Knowledge Directory & Menu tertutup di awal** — keputusan "lobi game" Item 127 dibalik; dikerjakan **sekalian** dengan
   graf (satu tampilan Home).
9. **Hanya Mamet Ecosystem** (Mametlite tidak punya Home).
10. Dipertahankan dari K23: **setiap garis = relasi nyata**; tak ada data karangan.

## 3. Syarat wajib (berlaku di setiap tahap)

**GRATIS — menampilkan graf tak boleh memakan biaya:**
- nol panggilan berbayar (OpenRouter, embedding, model) — juga untuk cek kesehatan;
- nol Edge Function demi graf — `ping` dibuang; status `agent-process` dari jejak `agent_logs` ("terakhir bekerja N menit lalu");
- kueri hemat: kolom yang dipakai saja, hitungan di basis data (angka saja), ekor pesan dimuat saat klik;
- tanpa polling — pembaruan lewat Realtime yang hanya bergerak saat ada data baru;
- status MCP & alat dari laptop (registry, `konektor.json`) — tanpa jaringan.
- Catatan jujur: baca basis data tak bisa nol, tetapi masuk kuota paket Supabase, bukan tagihan per pemakaian.

**KEAMANAN:**
- View/RPC hitungan pesan: mematuhi RLS (SECURITY INVOKER atau saring `auth.uid()`), hanya `authenticated`, anon 0;
  migrasi grant + `uji-hak-tabel-k5`. Mengembalikan angka, bukan isi.
- Isi pesan & judul (bisa berasal dari web/crawler/dokumen) ditampilkan sebagai **teks** — tanpa `dangerouslySetInnerHTML`
  atau markdown mentah (M1 Item 125); CSP tetap.
- `[SYSTEM CONTEXT FINAL]` di `steps` berisi teks dokumen: graf hanya membaca penanda alat, tak pernah menampilkan atau
  mengirim konteks utuh.
- Data Tabel ASN: graf hanya tahu alatnya ada & jumlah pemakaian — **tak pernah NIP/nama/lampiran** (K3).
- MCP lewat preload: jalur **baca-saja** (nama, alat, status); `panggil()`, jalur folder, env tidak diekspos; tak ada
  tools/call dari graf — gerbang K2/K8 tetap satu-satunya jalan.
- Daftar sub-agent di `shared/` ikut ke bundel klien (repo publik): hanya nama/sifat/terkunci — **bukan** ID pemilik
  (`MAMET_PEMILIK_IDS`), token, atau alamat.
- Tidak mencatat payload/objek runtime ke log (T7).
- Jumlah simpul dibatasi + muat malas supaya Home tak berat.

## 4. Tahap

| Tahap | Isi | Status |
|---|---|---|
| **0** | **Pratinjau** (gambar/mockup statis) susunan dua belahan + lingkar + fondasi + lapisan Kemampuan + ekor; disetujui Owner sebelum kode aplikasi disentuh | ✅ 2 Nov |
| **A** | Tampilan Home: Directory & Menu tertutup di awal; label cluster tak menumpuk; lencana Directory benar. Ikut: celah K5 tooltip ber-HTML ditutup; penyusun graf dipindah ke `grafHome.js` (dapat diuji) | ✅ 2 Nov |
| **B** | Gratis & lampu jujur: buang `ping`, kueri hemat (tanpa `select('*')`, hitungan di DB), status agent-process & penyedia dari `agent_logs`, Realtime/Embedding jujur atau dibuang | 📋 |
| **C** | Ubah Konstitusi 23 (pusat, lapisan); pusat MAMET dua belahan + penyambung; lingkar 1; fondasi luar | 📋 |
| **D** | Lapisan Kemampuan (tombol): alat chat dari ToolRegistry, alat folder dari `shared/folderKerjaAlat.js`, MCP berekor (preload baca-saja), sub-agent dari daftar resmi baru di `shared/` (mulai dari `plugins/registry.ts` & `izin_subagent.ts`) | 📋 |
| **E** | Percakapan berekor pesan: RPC/view hitungan + migrasi grant; ekor dimuat saat klik; garis pesan → alat dari penanda pemakaian | 📋 |

**Perubahan server:** hanya Tahap D (server ikut membaca daftar sub-agent di `shared/`) — Owner men-deploy dulu, bundel
esbuild sebelum meminta deploy, catat & push sekali (CLAUDE.md). Tahap E butuh migrasi basis data (atas izin Owner).

## 5. Uji

- Setiap uji baru dibuktikan dengan **mutasi**.
- Uji tampilan **mengompilasi Tailwind sungguhan**.
- **Uji "gratis":** sumber graf tak memuat `functions.invoke`, `select('*')`, panggilan OpenRouter/agent-process, maupun
  `setInterval` pengambil data.
- **Uji keamanan:**
  - tak ada `dangerouslySetInnerHTML` di komponen graf;
  - daftar sub-agent `shared/` tanpa ID/token;
  - preload MCP tanpa jalur panggil;
  - RPC hitungan ditolak bagi anon & tak membuka baris akun lain (impersonasi dua akun, digulung balik).
- **Graf dibandingkan sumber resmi:** jumlah simpul alat = isi registry/`KONEKTOR`/daftar `shared/`.

## 6. Sisa / catatan

- **Untuk Tahap B (ditemukan di Tahap A):** warna simpul layanan memakai `vitals` dari state SEBELUM `setVitals` —
  `susunGrafHome` menerima objek awal (semua UNKNOWN), jadi 11 simpul layanan selalu abu-abu dengan garis merah ke pusat,
  apa pun keadaan sebenarnya. `documents` tak punya kolom `metadata` → semua dokumen jatuh ke satu sub-cluster `docs`.
- Ambang nama simpul data `AMBANG_LABEL_DATA = 2` tetap (bukan relatif terhadap skala pas): layar 4K bisa melewatinya
  saat dibuka — belum diukur.
- Simulasi tata letak (`uji/lib/simulasiGrafHome.mjs`) dipakai lagi di Tahap C untuk susunan dua belahan.

- `scripts/graf-bercahaya.mjs` (efek cahaya untuk graf **graphify**, bukan graf Home) belum di-commit & belum ditanggapi
  Owner — terpisah dari item ini.
