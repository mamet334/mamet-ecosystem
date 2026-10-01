# Peta repo untuk Engineer — dari "bisa mencari" menjadi "tahu apa yang ada"

**1 Oktober 2026** · belum diuji live · lahir dari keberatan Owner

## Keberatan Owner

> *"Kenapa ini seperti memperbodoh model AI yang menjadi otak Mamet? …saya pakai OpenRouter karena
> bisa menyesuaikan apa yang saya butuhkan. Dari tes-tes yang kita jalani, saya rasa membatasi model
> yang sebenarnya tahu. Di mana Engineer yang seharusnya tahu kode sumber Mamet Ecosystem?"*

## Diukur dulu, bukan diperdebatkan

Komposisi satu permintaan Engineer **nyata** milik Owner (`[PROMPT_KOMPOSISI]`, 01:26):

```
sistem = 35.061 huruf
  dasar_identitas_panduan  21.756   ← 62% prompt, hanya ATURAN
  blok4_rag                 6.566   ← dokumen tugas, BUKAN kode
  blok5_constraint          2.553
  blok4_brain               2.265
  blok6_format              1.248
  kontrak_blok1_2             673
riwayat = 4.807 huruf                ← SATU-SATUNYA tempat kode bisa muncul
total   = 39.917 huruf ≈ 10.000 token   (anggaran: 60.000)
```

Tiga kesimpulan, dan ketiganya membenarkan Owner:

1. **Tidak ada satu pun blok untuk kode sumber.** Kode hanya masuk lewat riwayat percakapan — yaitu
   keluaran perintah yang sudah dijalankan.
2. **Aturan 4,5× lipat lebih banyak daripada kode**: ±5.400 token lawan ±1.200.
3. **Anggaran terpakai seperenam.** Jendela besar yang Owner bayar lewat OpenRouter tidak pernah diisi.

Yang membatasi bukan modelnya — **pipanya yang tidak pernah dibuka.**

Koreksi yang perlu dicatat juga: penjaga (uji klaim, label, Tahap 6) **bukan** penyebabnya. Penjaga
lahir dari kegagalan terukur — model menyalin hasil dari riwayat lalu mengaku menjalankan perintah,
mengarang blok alat yang tak pernah dieksekusi. Menghapusnya tidak memberi Engineer yang lebih pintar,
hanya Engineer yang kesalahannya tak ketahuan. Yang salah bukan verifikasinya, melainkan
**kami banyak memverifikasi dan sedikit memberi tahu.**

## Yang dikerjakan (nomor 1 dari tiga arahan Owner)

Peta repo: daftar **seluruh berkas kode** beserta **jumlah barisnya**, disisipkan tiap kiriman di
workspace Engineer.

```
frontend/src/components/workbench/ConversationEngine.jsx:2195
frontend/src/core/runtime/services/AssistantService.js:1822
frontend/electron/main.cjs:1158
```

| | |
|---|---|
| Isi | 270 berkas, 15.494 huruf (**±3.870 token**) |
| Dibuat | `git grep -c "" -- frontend/src frontend/electron supabase/functions mametlite/src` |
| Lama | **0,13 detik**, satu proses — bukan 270 |
| Cache | per akar repo, di proses utama |

Lebih kecil daripada blok aturan yang sudah ada, dan masih menyisakan ±46.000 token kosong.

## Kenapa jumlah barisnya ikut — bukan hiasan

Keluaran perintah dipotong **20 KB**, jadi `git show` pada berkas besar terpotong **diam-diam**. Dengan
tahu `ConversationEngine.jsx` 2.195 baris, model bisa memilih `git grep` **sejak awal** — bukan mencoba
membaca utuh, gagal, lalu mengarang jalan memutar (yang terjadi live 28 September).

## Dua kalimat yang paling menentukan di catatannya

- **"Ini daftar LENGKAP kode aplikasi — bila sebuah berkas tidak ada di sini, ia memang tidak ada."**
  Tanpa itu model tetap menduga ada berkas lain yang belum terlihat, dan tetap menelusuri.
- **"JANGAN mencari letak berkas… Yang perlu dicari hanya ISInya."** Larangan tanpa batas yang jelas
  akan membuatnya berhenti mencari sama sekali.

## Yang TIDAK dikerjakan hari ini

Dua arahan Owner lainnya, sengaja ditunda supaya pengaruh peta bisa **diukur sendirian**:

2. **Batas keluaran ikut model** — `BATAS_JALAN.keluaranByte` masih 20 KB mati; jendela model sudah
   tersimpan di `model_pricing.context_length`, tinggal diteruskan ke proses utama.
3. **Porsi konteks Engineer** — `PORSI_PER_PESAN = 0.05`. Owner mengoreksi: batas harian itu **plafon**,
   bukan jatah yang dibagi antara Assistant dan Engineer.

Mengerjakan ketiganya sekaligus berarti tiga perubahan dan satu hasil — tidak akan ketahuan mana yang
berpengaruh.

## Bukti

61 berkas uji hijau · `vite build` lolos · `node --check` proses utama lolos.

`uji-catatan-akar-repo.mjs` sempat merah karena memaku daftar sisipan apa adanya
(`[catatanAkar, ringkasanTemuan]`). Itu penjaga yang bekerja, bukan cacat — asersinya dilonggarkan ke
**keanggotaan**, bukan urutan utuh, supaya sisipan baru yang sah tidak membuatnya merah lagi.

**Uji live yang masih perlu:** build baru, lalu satu chat Engineer yang menyuruh membaca berkas besar.
Yang dibuktikan: ia langsung memakai `git grep` pada berkas 2.195 baris **tanpa** mencoba `git show`
lebih dulu, dan tidak lagi bertanya di mana letak sebuah berkas.
