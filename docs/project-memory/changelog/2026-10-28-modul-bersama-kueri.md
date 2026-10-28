# 28 Oktober 2026 — Modul bersama `shared/kueri_pencarian.js`: web Tier 3 di klien berhenti mengirim pesan mentah (Item 126 Fase 1, ADR-0021 #6)

Sisa terakhir Fase 1 Item 126. Peta graf graphify (hari yang sama) menunjukkan aturan "kalimat perintah → kata kunci"
**sudah ada** di server — `ringkasKueri()` (`agent-process/lib/web/pencarian_berita.ts`, 15 Sep; uji live: kalimat
perintah → Bing **0** hasil, kata kunci → **5–8**) — tetapi hanya dipakai sub-agent `researcher`/`deep_research`. Web
Tier 3 di klien mengirim pesan Owner utuh ke Bing/Google News. Keputusan Owner (ADR-0021 #6): aturan itu dipakai dua
sisi lewat **modul bersama di tempat netral** — bukan disalin, bukan diimpor server dari `frontend/src` (pola T15).

## Prasyarat T15 — dibuktikan, bukan diandaikan

- **Deno (server):** sudah memuat berkas `.js` biasa di luar folder fungsinya di **9 titik impor** ke `frontend/src`, dan
  deploy-nya berjalan selama ini — folder netral dimuat dengan cara yang sama.
- **Vite (klien):** sudah memuat `../tools` di luar `frontend/` lewat `server.fs.allow`.
- `pencarian_berita.ts` tak mengimpor apa pun → `ringkasKueri()` murni, aman dipindah.

## Yang dibuat

- **`shared/kueri_pencarian.js`** (folder baru di akar repo): `ringkasKueri()` **dipindah apa adanya** — aturannya tidak
  diubah (memperbaikinya = mengubah perilaku server; terpisah).
- **`pencarian_berita.ts`** mengimpor dari `../../../../../shared/`; salinannya dibuang (tak ada pengimpor lain, jadi tak
  diekspor ulang).
- **`WebComparisonService.js`** (klien): mencari dengan kata kunci; kosong → kalimat asli (urutan sama dengan server);
  `kueriDicari` (kueri yang benar-benar dipakai) dikembalikan pada hasil berhasil, kosong, maupun gagal. Semua kata
  terbuang → pesan asli, bukan kueri kosong.
- **`RetrievalOrchestrator.js`**: meneruskan `kueriDicari` juga saat web gagal (jalur berhasil sudah meneruskan seluruh hasil).
- **`AssistantService.js`**: baris **"🔍 Dicari (web): "…" → N hasil"** di awal langkah proses (ADR-0021 §2.3, satu
  baris) — `langkahAwal` di `_handleResponseStream`, pada **kedua** jalur jawaban (aliran & JSON); ikut tersimpan di
  metadata pesan.
- **`vite.config.js`**: `server.fs.allow` + `'../shared'`.

Contoh: *"tolong carikan berita terbaru tentang banjir di Baturaja"* → dicari **"terbaru banjir Baturaja"**.

## Bukti

- **Deno 2.2.7 sungguhan** (`frontend/node_modules/deno-bin`, mesin yang sama dengan Supabase; `--no-remote`, izin baca
  hanya folder repo): `pencarian_berita.ts` dimuat lewat impor relatif barunya; permintaan pertama `cariBerita()` ke
  Bing = `"3 perusahaan AI terbesar 2026"` = aturan bersama (`fetch` tiruan, tanpa jaringan).
- **Vite sungguhan**: `vite build` lulus (58,9 s), aturan ikut terbundel di `dist/assets/index-*.js`; server dev
  `npm run desktop` yang sedang berjalan menulis ulang impor ke `/@fs/…/shared/kueri_pencarian.js` dan menyajikannya
  (**HTTP 200**), sedangkan berkas lain di luar izin tetap ditolak (`AGENTS.md` → **403**).
- **`uji/uji-kueri-pencarian.mjs`** (baru, + pembantu `uji/bantu-deno-kueri.ts`): aturan (contoh 15 Sep tetap sama),
  **satu sumber** (definisi `ringkasKueri` hanya di `shared/`), bukti Deno (otomatis bila `deno.exe` ada), Tier 3 klien
  sungguhan (`WebComparisonService` dibundel; hanya klien Supabase ditiru), kabel tampilan & izin Vite.
  **Mutasi 6/6 menggigit** (pesan mentah, tanpa cadangan, server menyalin aturan sendiri, baris hilang di jalur aliran,
  izin Vite dicabut, `kueriDicari` hilang saat gagal).
- Bundel esbuild `agent-process` lolos; 0 karakter kendali. **Suite penuh 126/126** (147,1 s).

## Kapan berlaku

- `npm run desktop`: sudah aktif (Vite memuat ulang sendiri) — baris "🔍 Dicari (web)" tampil pada chat berikutnya yang
  memakai pencarian web.
- Server: perilaku `pencarian_berita.ts` sama (hanya cara impor) — tetap **perlu deploy** agar server = repo.
- Aplikasi terpasang: rilis 4.4.0.

## Sisa / arah

- Ini modul bersama **pertama**. Sisa T15 — 7 titik impor server ke `frontend/src` — bisa dipindah ke `shared/` dengan
  pola yang sama, satu per satu.
- Dua pendeteksi kata waktu kembar (`RetrievalOrchestrator.isTemporalQuery`, `RetrievalStrategyService.isTemporalOrRecencyQuery`)
  belum disatukan.
- Aturan `ringkasKueri` sendiri belum diukur ulang atas pesan Owner (mis. "soal", "dong" tidak dibuang).
