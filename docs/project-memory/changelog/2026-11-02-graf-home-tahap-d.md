# 2 November 2026 — Item 130 Tahap D: lapisan Kemampuan di graf Home + daftar resmi sub-agent di `shared/`

[Roadmap Item 130](../../roadmap/ROADMAP-GRAF-HOME-PETA-SISTEM.md). Klien + server. Dicek Owner di `npm run desktop`
(tampilan sesuai); `agent-process` **di-deploy Owner → v544**.

## Daftar resmi sub-agent (keputusan Owner: pilihan a)

- `shared/daftarSubagen.js` (baru): 11 sub-agent = persis `name` plugin di `agent-process/plugins/registry.ts`, dengan
  label, `mametlite`, `khususPemilik`, `ALIAS_TOOLS`. Ikut bundel klien & repo publik → hanya nama/label/sifat; tanpa ID
  pemilik, token, alamat, env (dijaga uji).
- `lib/orchestration/izin_subagent.ts` membaca `ALIAS_TOOLS`, `SUBAGEN_MAMETLITE`, `SUBAGEN_KHUSUS_PEMILIK` dari sana —
  aturan T1 tak berubah (`uji-izin-subagent` tetap lulus). `uji-shared-t15`: bundel server kini membawa 8 modul `shared/`.
- Catatan: hitungan lama "13 sub-agent" = jumlah berkas di `plugins/`; yang terdaftar sebagai sub-agent 11
  (`memory_manager_v1`, `context_compressor` bukan sub-agent registry).

## Lapisan Kemampuan (Konstitusi 23 "lingkar 2")

Tombol **Kemampuan** di kotak Knowledge Directory, tertutup di awal; lapisan disusun HANYA saat dinyalakan
(`susunLapisanKemampuan` + `gabungGraf`, `grafHome.js`):

| Hub | Isi | Garis (relasi nyata) |
|---|---|---|
| Alat chat | registry `tools/` (5); nonaktif di ws-assistant → abu-abu bertanda | → Chat; `data_tabel` → Data Tabel ASN; `memory_manager` → Memori |
| Alat folder | `shared/folderKerjaAlat.js` (9) | → Chat & Engineer |
| MCP | konektor dari `KONEKTOR_DIKENAL` → alatnya (dari server MCP yang menyala, atau daftar yang dikenal bila mati); web → "MCP · hanya desktop" | → Chat & Engineer, → Electron (proses utama) |
| Sub-agent | `shared/daftarSubagen.js` (11); khusus pemilik → "terkunci" abu-abu | → MAMET · SERVER |

- **Keamanan:** graf hanya memanggil `electronAPI.konektor.status()` — jalur baca-saja yang dipakai Settings (diperiksa:
  `peluncuran()` hanya `fs.existsSync`, tak menjalankan proses); hasilnya dipangkas `konektorUntukGraf` (pid, ringkasan
  katalog, stealth dibuang). Tak pernah `panggil`/`atur`.
- **Gratis:** semua sumber di laptop; tanpa jaringan.
- Tombol memakai kelas kotak Directory yang sudah ada; teks putih transparan (ikut tema) → `uji-ciri-tampilan` tak naik.

## Tata letak — diukur pada 3 urutan alat (urutan registry tak bisa dikendalikan)

1. "Alat folder" & "MCP" sama-sama bergaris ke Chat & Engineer → titik yang sama, tindih. Garis MCP → Electron (relasi
   nyata) + cincin hub lapisan. Tolakan hub −700/−1200 dicoba: memperbesar graf, label kerangka ikut tindih ✗.
2. Cincin lapisan 340/380/400/420: 400 terbaik. Jari fondasi 540/600 & lapisan 380/420 dibandingkan: 480/400 terbaik.
3. Garis alat `data_tabel` → Data Tabel ASN berpanjang bawaan 28 menyeret Data Tabel (tanpa ekor) ke kerumunan
   Chat/Server (tindih di layar Owner pada 2 dari 3 urutan) → `'alat-kemampuan': 180` (120 → 768 px tindih 2).

Hasil dengan lapisan menyala: layar Owner, 1920×1080, 768×900 → **0 tumpang di semua urutan**; data 2× → 1–3 (batas jujur,
graf dasar tetap 0). Pita legenda tetap bersih.

## Bukti

- `uji/uji-graf-home-tahap-d.mjs` (baru) 22/22: daftar = registry, server membaca shared/, tanpa rahasia, isi & garis
  lapisan, warna/tanda, MCP mati/menyala/web, pemangkasan status konektor, gabung tanpa mengubah graf dasar, Directory tak
  kemasukan alat, tata letak 4 layar × 3 urutan, tertutup di awal, hanya `konektor.status`, kelas tombol dikompilasi
  Tailwind sungguhan. **Mutasi 15/15 menggigit**; dua sempat lolos — regex uji tak mengenali `new Set<string>([…` (uji
  diperbaiki) dan mutasi `text-white/85` setara (Tailwind 3.4 punya opasitas 85; diganti `/83`).
- Uji Tahap A diperbarui (tata letak kini dipasang pada graf yang ditampilkan, `grafTampil`).
- Suite 145/145. Bundel esbuild `agent-process`, `HomeDashboard`, `ActivityGraph` OK.
- **Deploy (platform):** `agent-process` v543 → **v544**, `verify_jwt` tetap `false`; isi paket dibandingkan dengan repo
  (CRLF→LF): 104 berkas, **99 identik, 0 berbeda**, 5 kosong (berkas tipe saja); `izin_subagent.ts` &
  `shared/daftarSubagen.js` ada di paket dan sama persis.
