# 2026-09-28 — Hakim bayangan per kalimat (T13, mode bayangan)

Keputusan Owner sesudah diskusi: **mode bayangan dulu, hakim per kalimat.** Dibangun, diuji, **belum
dinyalakan** — butuh migrasi + variabel lingkungan + deploy, ketiganya tindakan Owner.

## Kenapa hakim, bukan pengukuran lagi

Dua kali pendekatan leksikal gagal memisahkan "kalimat bersandar dokumen" dari "kalimat pendapat":
CHIMERA WASM (5 dari 6 kasus Mamet salah) lalu `klaim_sumber.ts` (melewatkan ekstrapolasi di porsi
0,18; menuduh "Semoga membantu, Pak Slamet." pada 24% jawaban VERIFIED). Sebabnya sama: **dua sebaran
itu beririsan**, jadi tak ada ambang yang memisahkannya.

Tembok itu sudah pernah dihadapi proyek ini. **Item 55** (`judge_endpoint.ts`, 10 September) mencatat:

```
0,8780  BENTROK  tabel vs tidak suka tabel
0,8514  BENTROK  kopi vs tidak suka kopi
0,8323  TAJAM    kopi vs kopi hitam tanpa gula   ← beririsan
```

Bentuk grafik yang sama. Jalan keluarnya waktu itu: **berhenti mengukur, tanya model** — lengkap dengan
aturan gagal-amannya (*"Kalau ragu … pilih PENAJAMAN. Salah menandai konflik lebih merugikan daripada
melewatkannya."*). Berkas baru ini memakai jalan yang sama, untuk alasan yang sama, dengan aturan ragu
yang sama.

Alasan alatnya memang berbeda: *"apakah kalimat ini bersandar pada potongan ini?"* adalah **memahami
bacaan** — yang dikuasai model. Tumpang-tindih kata hanya **menghitung**.

## Tiga pagar yang membuatnya benar-benar bayangan

1. **Mati secara bawaan** — butuh env `HAKIM_BAYANGAN=1`. Tanpa itu: tak ada panggilan, tak ada biaya,
   tak ada tambahan waktu tunggu. Hanya nilai `"1"` yang menyalakan (bukan `"true"`).
2. **Tidak mengembalikan apa pun** (`Promise<void>`). Mustahil dipakai mengubah label tanpa lebih dulu
   mengubah tanda tangannya — dan perubahan itu terlihat di diff. Dijaga uji.
3. **Gagal dengan diam** — seluruh isinya dalam try/catch; masukan rusak, tanpa kunci, adapter mati,
   balasan tak terbaca: semuanya hanya dicatat di log.

Tambahan: tanpa kunci BYOK ia berhenti **sebelum** menyentuh model — diuji dengan `rctx` yang akan
menandai dirinya bila adapter sampai disentuh.

## Yang dinilai hakim

Tiga vonis per kalimat, dan yang ketiga justru yang menjawab kegagalan kemarin:

| Vonis | Arti |
|---|---|
| `BERSANDAR` | didukung salah satu potongan (+ nomor potongannya) |
| `TIDAK` | pernyataan tentang pokok bahasan, tanpa dukungan potongan |
| **`PERCAKAPAN`** | **bukan pernyataan sama sekali** — sapaan, tawaran bantuan, pengantar, penutup, atau kalimat tentang jawaban itu sendiri |

`PERCAKAPAN` adalah kelas yang tidak dimiliki pendekatan leksikal, dan justru kelas itu yang membuatnya
menuduh 11 dari 12 kalimat penutup nyata. Kalimat penutup **tetap dikirim** ke hakim — apakah ia
mengenalinya adalah pertanyaan yang dijawab data, bukan diasumsikan.

Hakim **dilarang** memvonis sebuah kalimat SALAH. Hanya: didukung, tidak didukung, bukan pernyataan.
Aturan ragu: `BERSANDAR` menang atas `TIDAK`; `PERCAKAPAN` menang atas `TIDAK`.

## Bagian yang dipakai ulang

`pecahKlaim` dari `klaim_sumber.ts` — bagian terbaik dari lapisan yang kemarin dimatikan. Ia sudah
teruji membuang judul, baris tabel, blok kode, baris `Sumber:`, label, dan kalimat tanya. Lapisannya
mati, kerjanya tidak terbuang.

## Biaya, dan kenapa harus tercatat

Satu panggilan model tambahan per jawaban RAG, memakai **kunci pengguna** (BYOK, Item 51), dicatat ke
`api_usage` lewat `logApiUsage` **lengkap dengan biaya asli dari penyedia** — celah yang diperbaiki
24 September di `padatkan_endpoint.ts` dan `judge_endpoint.ts` tidak diulang di sini. Pengeluaran yang
tak terlihat anggaran adalah pengeluaran yang tak bisa dihentikan.

Batasnya dipaku supaya biaya satu pesan bisa diduga: **40 kalimat**, **8 potongan**, **1.200 huruf**
per potongan, kalimat < 12 huruf tidak dikirim.

Ia ditunggu `tasks.awaitAll()` di `index.ts`, jadi ia **menambah waktu tunggu**. Itu harga uji coba,
dan itu sebabnya ia mati secara bawaan.

## Tabel `hakim_bayangan`

Sengaja ramping — kuota basis data proyek ini pernah dimakan log (Item 93):

- `rinci` hanya memuat **160 huruf pertama** tiap kalimat: untuk mengenali kalimatnya, bukan arsip chat;
- **isi potongan dokumen tidak disimpan sama sekali**, hanya jumlahnya;
- RLS menyala tanpa policy apa pun → tertutup bagi klien, hanya ditulis service-role;
- **aman di-DROP kapan saja** tanpa memengaruhi jalannya sistem.

Tiap baris menyimpan `label_sistem` (apa yang benar-benar dipakai) berdampingan dengan `label_usulan`
(apa yang akan diusulkan hakim **seandainya** ia berwenang) — itu pasangan yang nanti dibandingkan.

## Berkas

| Berkas | |
|---|---|
| `lib/verification/hakim_bayangan.ts` | **baru** |
| `supabase/migrations/20260928061500_hakim_bayangan.sql` | **baru** |
| `lib/orchestration/handlers/synthesis_handler.ts` | panggilan sesudah `koreksiLabel` |
| `lib/request/request_pipeline.ts`, `lib/runtime_context.ts` | bendera `HAKIM_BAYANGAN` |
| `uji/uji-hakim-bayangan.mjs` | **baru** — 33 pemeriksaan, tanpa satu pun panggilan model |

## Yang terbukti, dan yang belum

- ✅ 46 berkas uji hijau; bundel `agent-process` lolos esbuild.
- ✅ Ketiga pagar diuji, termasuk "tanpa kunci → tidak menyentuh model".
- ⏳ **Mutu vonis hakim belum diketahui sama sekali.** Itu justru pertanyaan yang dibangun untuk dijawab.

## Tiga langkah Owner sebelum data mulai terkumpul

1. Terapkan migrasi `20260928061500_hakim_bayangan.sql`.
2. Setel `HAKIM_BAYANGAN=1` di Edge Function secrets.
3. Deploy.

Sesudah beberapa puluh pesan, tiga pertanyaan ini bisa dijawab angka: benarkah sebagian jawaban
HYPOTHESIS sebenarnya campuran yang layak PARTIAL; seberapa sering hakim tidak sepakat dengan
`label_sumber.ts` dan siapa yang benar saat tidak sepakat; berapa biayanya sungguhan per hari.
Mematikannya cukup menghapus variabel lingkungan — tanpa deploy ulang kode.

---

# Lanjutan — empat cacat alat ukur diperbaiki (2026-09-28)

Delapan panggilan pertama sesudah nalar dimatikan berjalan wajar: **rata-rata $0,0001 dan 3,7 detik**
(kisaran $0,000033–0,000121; 1,8–7,2 detik) — sekitar **15%** dari biaya jawaban chat itu sendiri.

Hakimnya bekerja. Yang belum benar seluruhnya ada di sisi alat ukur, dan keempatnya ketahuan dari
data nyata, bukan dari tebakan:

| # | Cacat | Bukti |
|---|---|---|
| 1 | Baris tabel disembunyikan dari hakim | 05:46 — bagian bersandar ditulis model sebagai tabel; hakim hanya menerima paragraf rekomendasi lalu menyimpulkan HYPOTHESIS |
| 2 | Jawaban pendek tidak pernah dinilai | 06:10 — "berapa jumlah pegawai?" dijawab ringkas, dilewati diam-diam, tak ada barisnya |
| 3 | Penggulungan tak kenal INSUFFICIENT | 06:12 — jawaban "tidak ketemu" digulung jadi **VERIFIED** |
| 4 | `label_sistem` menyimpan hal yang keliru | lima baris pertama berbunyi `(diam)`; perbandingan harus digabung manual ke `chats` |

Pola ketiganya sama: **vonis per kalimat hakim benar; yang salah apa yang dikirimkan kepadanya dan
bagaimana hasilnya dibaca.**

## Perbaikan

1. `pecahKlaim(jawaban, { sertakanTabel })` — baris tabel ikut dinilai untuk hakim (baris pemisah
   `| --- |` tetap dibuang, dan baris tabel masuk apa adanya, bukan dipecah per titik). Lapisan
   leksikal tetap memakai bawaan `false`: angka & pasangan kolom sudah ditangani `periksaAngkaSumber`
   dan `periksaTabelCentang` yang jauh lebih teliti.
2. Batas minimal **satu** kalimat, bukan dua. Justru jawaban pendek yang paling mudah diperiksa.
3. `labelUsulan(ringkas, labelModel)` → `TIDAK_BERLAKU` untuk jawaban INSUFFICIENT. Jawaban "tidak
   menemukan" tidak berada di tangga VERIFIED–PARTIAL–HYPOTHESIS sama sekali; kasusnya dikeluarkan
   dari perbandingan, bukan dipaksa masuk.
4. `labelTerlihat(jawabanAkhir)` membaca label yang **benar-benar dilihat Owner**; kolom baru
   `diturunkan` dan `sepakat` (migrasi `20260928063000`). Baris lama sengaja **tidak** diisi ulang —
   menebak label yang dulu terlihat berarti mengarang data pengukuran.

## Hasil live sebelum perbaikan ini (4 percakapan terpisah, 06:10–06:12)

| Chat | Terlihat | Usulan hakim | |
|---|---|---|---|
| jumlah pegawai | VERIFIED | — | tidak dinilai (cacat 2) |
| kelompok jabatan | VERIFIED | VERIFIED | ✅ tes penggugur lulus lagi |
| **fokus + rekomendasi** | **HYPOTHESIS** | **PARTIAL** | ⭐ ketidaksepakatan yang benar |
| tunjangan | INSUFFICIENT | VERIFIED | ❌ cacat 3 |

Chat ketiga adalah hasil yang dikejar sejak lapisan leksikal dimatikan: dari 8 kalimat, hakim
memvonis `TIDAK` pada dua kalimat rekomendasi — **bentuk kalimat yang persis lolos dari pendekatan
leksikal di porsi 0,18** — dan `PERCAKAPAN` pada empat kalimat pengantar/judul/catatan, tanpa satu pun
tuduhan palsu. Enam dari delapan jelas benar, satu abu-abu (menyebut "Corporate University" yang
memang ada di dokumen), nol salah tuduh.

Ketidaksepakatannya bermanfaat: model melabeli seluruh jawaban HYPOTHESIS padahal separuhnya
bersandar dokumen. PARTIAL lebih jujur.

## Terbukti

47 berkas uji hijau; bundel `agent-process` lolos esbuild. Perlu deploy Owner; `HAKIM_BAYANGAN`
tidak perlu disentuh.
