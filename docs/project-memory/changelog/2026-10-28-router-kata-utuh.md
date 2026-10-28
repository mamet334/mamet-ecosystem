# 28 Oktober 2026 — Intent Router: kata kunci dicocokkan sebagai kata, bukan potongan (Item 126 Fase 1)

Penerapan pertama [ADR-0021](../../adr/ADR-0021-kapan-llm-dipakai-di-depan.md) (diterima hari yang sama): aturan yang bisa
ditulis dan diuji dengan kode → kode. Kode server — **berlaku sesudah Owner men-deploy `agent-process`**; tidak perlu
rilis aplikasi.

## Urutan kerja

1. **Mode bayangan** (hanya agregat dihitung di database; nol isi pesan keluar — T12) atas **482** pesan Owner:
   sekarang **285 (59%)** tersangkut daftar kata kunci, **41** hanya karena kata tanya (18 Okt: 279/465, 39). Salah picu
   potongan kata: `cto` 36 → 0 sebagai kata ("vector", "october"), `send` 27 → 0 ("sendiri"), `api` 37 → 16
   ("tapi", "rapi"), `kapan` 23 → 3 ("kelengkapan"), `yt` 16 → 0 ("python", "byte"). Tiga varian diukur: kata utuh,
   awal kata (masih tertipu "**send**iri"), kata + imbuhan generik (menangkap pasif "ditemukan").
2. **Peta graf graphify** (`graphify update .`, 0 node mati, kode 484/484) atas permintaan Owner sebelum menyentuh
   kode: penulis ulang pertanyaan lanjutan RAG (Item 67), `kataKunciPencarian()` (RAG) dan `ringkasKueri()` (kata
   kunci berita) **sudah ada** — rencana menulis aturan kueri baru dibatalkan; `intent_router.ts` satu-satunya router
   kata kunci di server, jadi perbaikan ditaruh di sebelahnya. Dicatat di ADR-0021 §1.2 + keputusan Owner #5 (model
   tetap Item 67 = pengecualian) dan #6 (peringkas kueri lewat modul bersama, prasyarat T15).
3. Kode, uji, mutasi, bayangan ulang dengan aturan yang benar-benar akan berjalan.

## Yang dibuat

- **`lib/orchestration/kata_kunci_router.ts`** (baru, modul murni): `KATA_KUNCI_AKSI` dicocokkan sebagai kata utuh
  (`(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])`, bukan `\b` yang hanya paham ASCII); kata tanya dibuang;
  `KATA_KERJA_PERINTAH` — bentuk **eksplisit** (cari/carikan/mencari, baca/bacakan/membaca, kirim/mengirim, …) tanpa
  pasif `di-` dan tanpa kata benda `-an`; `https` ditambahkan (URL tak lagi bergantung pada potongan "http").
  `kataKunciAksi(pesan)` mengembalikan **kata kunci pemicunya**, bukan sekadar true.
- **`intent_router.ts`**: memakai `kataKunciAksi`; langkah proses kini *🎯 Intent Router: kata kunci aksi "cari
  (mencari)" → Butuh Sub-Agent* — terlihat (ADR-0021) dan menjadi data "kata kunci mana yang memicu" (Fase 0).

## Bukti

- **Bayangan dengan aturan baru** (pola SQL dihasilkan dari modul itu sendiri): **285 → 235**; **50** pesan pindah ke
  LLM pengklasifikasi; **0** pesan yang dulu lolos kini tertangkap.
- `uji/uji-kata-kunci-router.mjs` (baru): salah picu terukur hilang, kata tanya tak memicu, bentuk perintah tertangkap,
  pasif/kata benda tidak, frasa & URL, kabel di router. **Mutasi 6/6 menggigit** (batas kata dibuang, "apakah"
  kembali, "ditemukan" ikut, "mengirim" hilang, router tak memakai pencocok, pemicu tak ditampilkan).
- Bundel esbuild `agent-process/index.ts` lolos (522,6 KB, 0 karakter kendali) — siap deploy.
- Suite penuh **122/123**: satu-satunya gagal `uji-konektor-stealth.mjs` — **tidak terkait**; terekam "habis waktu 120
  detik" (batas per berkas `jalankan-semua.mjs`) saat suite lambat (415 s, biasanya 130–296 s); sendirian lulus 2× dalam
  35 s. Diperbaiki di sesi terpisah.

## Efek yang diharapkan — jujur

Pesan yang pindah tidak langsung dijawab: ia ke LLM pengklasifikasi (jalur kata kunci memanggil Coordinator; jumlah
panggilan nyaris sama). Manfaatnya **ketepatan** — tak ada sub-agent dipicu "tapi"/"sendiri"/"python" — **bukan
kecepatan**. Target Gerbang 2 "latensi turun ≥ 30%" ditandai perlu ditinjau ulang.

## Deploy (diperiksa di platform, bukan dari keluaran deploy)

Owner men-deploy `agent-process` 28 Okt. API Supabase (`list_edge_functions`): versi **532 → 533**, status ACTIVE,
`verify_jwt` **tetap `false`**, sidik isi `ezbr_sha256` `e6cd15…` → `2e5ad9…`; fungsi lain tidak berubah.
**Isi yang ter-deploy** (`get_edge_function`, versi 533) diperiksa, bukan hanya nomornya:
`lib/orchestration/kata_kunci_router.ts` ada (memuat `export function kataKunciAksi` dan bentuk `'mengirim'`; daftar
`KATA_KUNCI_AKSI` tanpa `'apakah'`); `handlers/intent_router.ts` mengimpor `kataKunciAksi` dan memakai
`const pemicu = kataKunciAksi(ctx.request.lowerMsg)`; `actionKeywords` (pencocokan potongan lama) **tidak ada lagi**.

## Menunggu

- Bukti live (kata pemicu tampil di langkah proses chat) — butuh satu chat sungguhan (saldo OpenRouter).
- Sisa Fase 1: kegagalan router berhenti jatuh ke jalur mahal (temuan 4); peringkas kueri web Tier 3 lewat modul
  bersama (ADR-0021 #6, prasyarat T15).
