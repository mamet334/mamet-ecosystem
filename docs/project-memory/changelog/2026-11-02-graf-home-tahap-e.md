# 2 November 2026 — Item 130 Tahap E: percakapan berekor pesan + label graf tak pernah saling tindih

[Roadmap Item 130](../../roadmap/ROADMAP-GRAF-HOME-PETA-SISTEM.md). Klien + migrasi basis data (diterapkan atas izin
Owner). Dicek Owner di `npm run desktop`: tampil.

## Migrasi `20261102000000_graf_home_hitungan_pesan.sql` (tercatat platform: `20261102085252`)

Dua fungsi baca-saja, SECURITY INVOKER (RLS pemanggil berlaku), `search_path = ''`, menyaring `auth.uid()` sendiri;
EXECUTE dicabut dari `public`/`anon`, hanya `authenticated`. Tabel tak diubah.

| Fungsi | Mengembalikan | Menggantikan |
|---|---|---|
| `hitungan_graf_home()` | angka: pesan per percakapan, potongan per dokumen, total `api_usage` akun | klien menarik ±3.600 baris `document_id` hanya untuk dihitung; panel "LLM CALLS" menghitung kueri ber-limit 100 (selalu 100) |
| `pesan_percakapan_graf(p_chat)` | ekor SATU percakapan: urutan, peran, cuplikan 80 huruf (`<think>` dibuang), kode alat; ≤ 300 pesan | — |

Kode alat diturunkan dari ANGKA/penanda, bukan isi: `toolsUsed[]`, `subagentRuns[].subagent`, baris
`[RAG CONTEXT GENERATED] ragArray size=N (termasuk M …)` (N−M>0 → `rag`, M>0 → `web`), `[MEMORY PROMPT GENERATED] …
memoryArray size=K` (K>0 → `memori`; teks memoryPrompt tak dikembalikan). `[SYSTEM CONTEXT FINAL]` tak disentuh.
Bentuk data diukur dulu (hanya kunci & hitungan): `groundingSources` tak pernah berisi; RAG hanya terbaca dari baris
langkah; kode di seluruh riwayat: rag 248, memori 117, knowledge_manager 112 (sub-agent lama, dihapus T9), web 88,
deep_research 9, researcher 7, word_to_pdf 7.

Biaya: ±300 ms komputasi (membaca kolom `messages` 219 chat) per buka Home — kuota paket, bukan tagihan. Alternatif kolom
`jumlah_pesan` berpemicu ditolak: mengubah skema `chats` dan berisiko pada Cadangkan/Pulihkan (K6).

**Bukti di basis data:** sebelum diterapkan — dalam transaksi yang digulung balik (0 fungsi tertinggal); sesudah
diterapkan — `pg_proc`: bukan DEFINER, `search_path=""`, anon/public tak boleh, authenticated boleh. Sebagai akun Owner:
219 percakapan, 1.183 pesan, pemakaian model 1.255; ekor percakapan terpanjang 138 pesan (33 beralat, cuplikan ≤ 80, 113 ms).
Sebagai akun lain: 0 baris. Sebagai anon: ditolak. **Log edge sesudah migrasi aktif:** `hitungan_graf_home` 4× 200,
`pesan_percakapan_graf` 4× 200 (klik Owner); 404 sebelumnya terjadi sebelum migrasi tercatat (08:52:08–11 vs 08:52:52 UTC).

## Klien

- Ukuran simpul percakapan = jumlah pesannya (4–24; tanpa angka 8). Hook memakai `hitungan_graf_home`; bila gagal →
  jalan lama (kueri `document_chunks`), Home tetap utuh. LLM CALLS = total sebenarnya.
- Klik percakapan (graf atau Knowledge Directory) → ekor dimuat; klik lagi → tutup; satu percakapan pada satu waktu;
  dijaga bila percakapannya hilang dari graf. Garis pesan → alat HANYA ke simpul yang ada (`simpulAlat`): rag → RAG
  Dokumen, memori → Memori; web/alat/sub-agent bila lapisan Kemampuan menyala; kode tak dikenal (knowledge_manager) tak
  bergaris, tetap tercantum di nama. Garis alat berpegas lemah (0,03) — penunjuk rute, bukan penata letak.
- **Penghindar tabrakan label:** label diantrekan per simpul dan dilukis SEKALI di akhir bingkai (`onRenderFramePost`)
  menurut prioritas (pusat < kemampuan < fondasi < lapisan < konflik < data); yang akan menindih dilewati (tetap terbaca
  lewat sorot). Label dua belahan diratakan ke luar (`labelArah`). Label kini pasti di atas semua titik.
  Alasannya diukur: penyetelan gaya saja tak bisa menjamin 15 label muat — garis konektor 70/100/130, kelas konektor
  tersendiri (MCP tersembunyi 7/15 keadaan — ditolak), dst.: tiap pasang yang dibereskan memunculkan pasang lain.
  Hasil: **0 label inti tersembunyi** di semua skenario (dasar, lapisan × 3 urutan alat, ekor 138 pesan, lapisan+ekor) ×
  layar Owner/1920/768; label lapisan baru tersembunyi hanya saat lapisan + ekor menyala bersamaan.
- Node Inspector hanya untuk simpul data — sebelumnya simpul alat (Tahap D) & pesan dibuka dengan lencana bawaan
  "USER MEMORY".

## Ditemukan & dicatat

Uji mutasi menulis berkas sumber di checkout yang dipakai `npm run desktop` Owner → Vite memuat ulang aplikasi Owner
setiap ±22 detik dengan kode termutasi (08:30–08:33 UTC, terlihat di log edge; tak ada data tertulis). Ke depan mutasi
dijalankan di salinan/worktree.

## Bukti

- `uji/uji-graf-home-tahap-e.mjs` (baru) 31/31; **mutasi 21/21 menggigit** (satu sempat lolos — uji belum memeriksa entri
  `pesan_percakapan_graf` di uji K5; dilengkapi).
- `uji-hak-tabel-k5`: `RPC_INVOKER` mengenal kedua fungsi. Uji Tahap A–D & simulasi diperbarui ke kebijakan label baru
  (tumpang MENTAH tetap ukuran mutu tata letak; ditambah `tampil`/`tersembunyi`).
- Suite 146/146; bundel esbuild `HomeDashboard`, `ActivityGraph`, `useDashboardData` OK.
