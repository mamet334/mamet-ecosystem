# 2026-09-28 — Lapisan per-klaim dimatikan sesudah uji live (T13)

Dibangun pagi ini, diuji live sore ini, dimatikan sore ini juga atas keputusan Owner. **Bukan karena
gagal dibangun — karena instrumennya terbukti salah pada data nyata.** Modul, uji, dan seluruh angka
ditinggalkan di repo supaya kerja ini tidak hilang dan tidak diulang buta.

## Apa yang dibuktikan uji live

Deploy terkonfirmasi lebih dulu dari sisi server (keenam penanda kode baru ada di bundel terpasang).

**Chat 1 — kendali: LULUS.** Pertanyaan HCDP yang jawabannya benar-benar ada di dokumen → `VERIFIED`
bertahan, `Sumber:` ada, tanpa `Catatan sistem`. Lapisan berjalan sampai ujung lalu **diam**. Risiko
terbesar yang diambil (menjatuhkan jawaban benar) tidak terjadi pada kasus itu.

**Chat 2 — tidak pernah menyentuh lapisannya.** Model menulis sendiri *"Bagian pertama jawaban di atas
bersumber dari dokumen … sedangkan paragraf rekomendasi merupakan pendapat saya sendiri"* lalu melabeli
seluruhnya `HYPOTHESIS`. Lapisan hanya berjalan bila jawaban berlabel VERIFIED, jadi ia keluar di baris
pertama. **Konsekuensi struktural:** PARTIAL hanya bisa dicapai dari VERIFIED, tidak pernah dari
HYPOTHESIS — akibat aturan "hanya boleh memperketat" yang dipilih sendiri. Justru di kasus yang paling
membutuhkan PARTIAL, label itu tak terjangkau.

## Dua kegagalan, keduanya terukur pada data nyata

Lapisan yang sudah ter-deploy dijalankan terhadap jawaban live 02:58 dan potongan HCDP asli dari
`document_chunks`:

| Kalimat | Porsi | Vonis |
|---|---|---|
| "…rumpun pelaksana menjadi fokus utama… 591 pegawai…" | 0,88 | bersandar ✅ |
| **"Rekomendasi saya: … coaching, mentoring, rotasi jabatan…"** | **0,18** | zona diam — **lolos** |
| "…hasil asesmen sebaiknya jadi dasar IDP…" | 0,21 | zona diam — lolos |
| **"Bagian pertama jawaban di atas bersumber dari dokumen…"** | **0,06** | **dituduh** ❌ |

Lalu diukur pada seluruh riwayat:

| | |
|---|---|
| Jawaban VERIFIED sejak 3 Sep | 83 |
| Memuat kalimat percakapan | **20 (24,1%)** |
| Kalimat penutup nyata yang dituduh | **11 dari 12**, termasuk "Semoga membantu, Pak Slamet." (porsi 0,00) |

Artinya kira-kira **satu dari empat jawaban benar** akan turun ke PARTIAL dengan catatan yang konyol —
dan akibatnya kebalikan dari tujuan sistem label ini: kepercayaan pada labelnya sendiri yang rusak.

## Akar salahnya

Lapisan itu menganggap **setiap kalimat pernyataan adalah klaim tentang dokumen.** Sebagian besar
jawaban chat adalah **percakapan** — sapaan, tawaran bantuan, pengantar, penutup — yang memang tidak
punya sandaran dokumen dan memang tidak perlu punya.

Dan lebih dalam lagi: tumpang-tindih kata **tidak bisa** memisahkan "klaim tentang kompetensi ASN yang
bersandar dokumen" dari "saran umum tentang kompetensi ASN". Keduanya sekosakata. Itu tembok yang sama
yang dihantam CHIMERA di T13; di sini ia dihantam satu lapis lebih dalam dengan alat yang sama.

Menambalnya dengan daftar kata ("semoga", "silakan", "beri tahu") adalah jebakan yang persis membuat
CHIMERA gagal. Karena itu ditolak, bukan dikerjakan.

## Kenapa korpus uji paginya tidak menangkap ini

Kalimat asing yang dikarang asing secara **kosakata** ("kementerian pusat meluncurkan platform digital
terpadu" → 0,00–0,13). Ekstrapolasi nyata asing secara **asal-usul** tetapi pribumi secara kosakata — ia
bicara ASN, kompetensi, pelatihan, instansi. Karena itu ia mendarat di 0,18, bukan 0,05. Margin diukur
dengan teliti, tetapi pada bahan karangan sendiri — bentuk yang sama dengan pelajaran "heuristik wajib
diuji di korpus penuh".

Hal itu terulang sekali lagi saat menulis uji penjaga di bawah: percobaan pertamanya memakai satu
potongan pendek buatan sendiri dan melaporkan porsi 0,12 → "SUDAH beres", padahal konteks live memberi
0,18 → "BELUM". Diperbaiki dengan menyalin potongan asli dari `document_chunks`.

## Yang berubah

| Berkas | |
|---|---|
| `lib/verification/label_sumber.ts` | `LAPISAN_KLAIM_AKTIF = false` + alasan lengkap & syarat menyalakan kembali |
| `uji/uji-klaim-sumber.mjs` | uji "lapisan DIMATIKAN" + bagian **syarat menyalakan kembali** |

Tidak ada yang dihapus. `klaim_sumber.ts`, `LABEL_PARSIAL`, dan `label` pada `HasilLabel` tetap ada —
yang terakhir memperbaiki ketimpangan lama (jalur stream memaku HYPOTHESIS) dan tetap berguna.

**Syarat menyalakan kembali**, ditulis sebagai uji yang mencetak statusnya tiap kali dijalankan:

```
(1) kalimat percakapan dituduh: 6 dari 6 — BELUM beres
(2) ekstrapolasi sekosakata tertangkap: BELUM (porsi 0.18)
```

Selama salah satunya BELUM, uji menjaga `LAPISAN_KLAIM_AKTIF` tetap mati.

## Arah berikutnya

Bukan menebak dari kata, melainkan memakai **penandaan model sendiri**: model membuktikan hari ini,
tanpa diminta, bahwa ia TAHU mana pendapatnya sendiri. Menguatkan kontrak agar ia menandai bagian itu
(`[Pengetahuan umum AI…]`) punya sumber kebenaran nyata, bukan statistik kata. Embedding tetap
tersimpan sebagai cadangan bila kontrak tidak cukup.

## Yang tetap didapat hari ini

- Pemeriksa label lama **terbukti bekerja benar** pada dokumen nyata (chat 1).
- Celah "satu gumpalan" **terbukti ada** — uji kendali revisi `8dd5e3b` masih berdiri.
- Batas alat leksikal untuk pekerjaan ini kini **terukur**, bukan diperdebatkan.
- Satu batasan basis data tercatat: `groundingSources` kosong dan `processingSteps` hanya menyimpan
  ringkasan log, jadi **teks potongan RAG tidak tersimpan** — jawaban lama tidak bisa diputar ulang
  dengan konteks aslinya. Itu yang membatasi pengukuran hari ini hanya sampai perkiraan 24%.
