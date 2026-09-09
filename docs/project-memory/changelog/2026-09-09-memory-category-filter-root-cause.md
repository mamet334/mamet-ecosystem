# Penyaring Kategori di Tahap 1 — Akar Sebenarnya di Balik "AI Lupa Terus"

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai & Diverifikasi Live
**Commit:** `ef2537b`
**Terkait:** [Empat Cacat Sistem Memori](./2026-09-09-memory-system-four-defects-eventbus-conflict-duplicate.md) (Item 36), Item 37 di INDEX-ROADMAP

---

## 1. Bagaimana Ini Ketahuan

Ini kelanjutan langsung dari perbaikan empat cacat memori. Setelah keempatnya
beres — badge memori muncul, konflik palsu berhenti, guard duplikat bekerja —
Owner menguji ulang dan melaporkan sesuatu yang seharusnya sudah tidak mungkin:

> "kok dia tidak tau, dan memory menjadi 3 lagi"

AI masih menjawab bahwa nama panggilan Owner belum pernah disebutkan, padahal
di database jelas ada **tiga salinan** memori "nama panggilan saya adalah pak
slamet". Guard duplikat bahkan sudah membuktikan memori itu ada — ia menolak
menyimpan salinan keempat. Tapi saat ditanya, AI tetap tidak tahu.

Log memberi angka yang menyingkap semuanya:

```
[MemoryGovernorService] Two-Stage: Tahap 1 → 3 kandidat, Tahap 2 → 3 teratas
[LiveThought] emit Brain:ActiveThoughts — 3 memori aktif
```

Selalu **tepat 3**, untuk pertanyaan apa pun. Bukan angka yang berubah-ubah
sesuai relevansi — angka mati. Itu ciri khas penyaring yang terlalu ketat,
bukan ranking yang meleset.

---

## 2. Akar Masalah

`MemoryGovernorService.retrieveMemory()` menyaring kandidat Tahap 1 dengan:

```js
.in('category', categories)
```

dan `categories` datang dari `MemoryService._inferCategories(query)` — sebuah
pemetaan kata kunci sederhana yang **menebak kategori dari kalimat pertanyaan**:

```js
_inferCategories(query = '') {
  const q = query.toLowerCase();
  const categories = ['general'];
  if (q.includes('preferens') || q.includes('suka') || q.includes('ingin')) categories.push('preference');
  if (q.includes('lokasi') || q.includes('alamat') || q.includes('tempat')) categories.push('location');
  // ...
}
```

Di sisi lain, kategori memori ditetapkan **saat penyimpanan**, oleh proses yang
sama sekali berbeda. Dua sumber ini tidak pernah dirancang untuk sinkron, dan
memang tidak pernah sinkron.

Rangkaiannya pada kasus nyata Owner:

| Tahap | Nilai |
|---|---|
| Memori disimpan sebagai | `preference` (di UI: *Preferensi / Profil User*) |
| Owner bertanya | "siapa nama panggilan saya?" |
| Kata pemicu `preference` yang dicari | "preferens", "suka", "ingin" |
| Ada di pertanyaan? | **Tidak satu pun** |
| Kategori hasil tebakan | `['general']` |
| Memori nama panggilan lolos? | **Tidak** |

Jadi memori itu tak pernah masuk kolam kandidat, tak pernah sampai ke Tahap 2,
tak pernah masuk prompt. Yang lolos hanya 3 memori berkategori `general` — persis
angka mati di log.

Untuk menemukannya, Owner harus menanyakan nama panggilannya dengan kalimat yang
memuat kata "suka" atau "ingin". Itu bukan antarmuka yang bisa dipakai manusia.

---

## 3. Kenapa Ini Menjelaskan Semua Gejala Sebelumnya

Cacat ini adalah **hulu** dari rantai yang dibongkar di Item 36. Urutannya:

1. Penyaring kategori membuat memori tak bisa dipanggil kembali
2. Karena AI tampak lupa, Owner mengulang fakta yang sama berkali-kali
3. Pengulangan itu menumpuk jadi duplikat (tidak ada guard waktu itu)
4. Duplikat + `source_reference` konstan membuat deteksi konflik menuduh
   fakta-fakta tak berhubungan saling berbenturan
5. Memori yang dituduh konflik keluar dari status aktif — memperparah gejala awal

Perbaikan di Item 36 semuanya benar dan tetap diperlukan, tapi semuanya
menangani **akibat**. Penyebabnya ada di satu baris `.in('category', categories)`.

---

## 4. Perbaikan

Filter kategori dihapus dari Tahap 1, beserta seluruh mesin penebaknya:

- `MemoryGovernorService.retrieveMemory()`: baris `.in('category', categories)`
  dibuang, parameter `categories` dihapus dari signature dan JSDoc, pesan log
  "0 kandidat" tidak lagi menyebut kategori
- `MemoryService`: metode `_inferCategories()` dihapus seluruhnya beserta
  pemakaiannya dan baris JSDoc-nya

Komentar panjang ditinggalkan di lokasi bekas filter, berisi kasus nyata "pak
slamet", supaya tidak ada yang mengembalikannya karena mengira itu optimasi yang
hilang.

### Yang Sengaja TIDAK Ikut Berubah

Kolom `category` **tetap disimpan** dan **tetap ditampilkan** di panel Memory dan
Node Inspector. Yang dilepas hanya pemakaiannya sebagai *penyaring saat
pengambilan*. Kategori tetap berguna untuk manusia yang membaca, hanya tidak
lagi boleh menentukan apa yang boleh diingat mesin.

### Kontrak Addendum Fase 1 Tetap Utuh

| Jaminan | Status |
|---|---|
| Tidak boleh full-table scan | ✅ `candidatePoolSize` (default 30) tetap berlaku |
| Hanya memori aktif | ✅ `.eq('status', 'active')` tidak disentuh |
| Memori sensitif tersaring | ✅ `access_tier` tidak disentuh |
| Relevansi | ✅ diserahkan ke Tahap 2 (recency 0.4 + confidence 0.6) |

Pertukarannya jelas dan disetujui Owner: kolam kandidat melebar dari "hanya
kategori yang kebetulan tertebak" jadi "30 memori aktif terbaru", lalu Tahap 2
yang memeringkat. Melebar, bukan tanpa batas.

---

## 5. Bukti Verifikasi Live

| Bukti | Sebelum | Sesudah |
|---|---|---|
| `Two-Stage: Tahap 1` | 3 kandidat (angka mati) | **7 kandidat, Tahap 2 → 7 teratas** |
| `[LiveThought] emit` | 3 memori aktif | **7 memori aktif** |
| `[LiveThought] terima` | 3 cocok | **7 cocok dengan simpul di graf** |
| Node Inspector — memori nama panggilan | tak pernah terpanggil | **Aktif dalam Memori Jangka Panjang, "Dirujuk AI 1 kali"** |

Penghitung "Dirujuk AI" naik dari nol adalah bukti terkuatnya: memori itu benar-benar
ikut dikirim ke model, bukan sekadar tampil di panel.

---

## 6. Catatan Jujur — Yang Terlihat Mencurigakan Tapi Bukan Masalah

Di log yang sama muncul:

```
[RetrievalStrategy] Tier 1 Sufficiency score: 0.255
[RetrievalOrchestrator] Tier 1 insufficient. Switching to Tier 2...
```

Ini **bukan** kegagalan memori. Skor kecukupan itu menilai dokumen RAG dari
`KnowledgeService` — jalur yang terpisah dari memori. Memori dikirim ke prompt
lewat jalurnya sendiri terlepas dari skor RAG. Dicatat di sini supaya baris itu
tidak salah dibaca sebagai regresi di kemudian hari.

---

## 7. Pelajaran

**Angka mati di log adalah tanda penyaring, bukan tanda ranking.** Hitungan yang
tidak pernah berubah untuk masukan yang berbeda-beda hampir selalu berarti ada
klausa `WHERE` yang terlalu ketat di hulu. Kalau angka 3 yang berulang itu
diperhatikan lebih awal, empat cacat di Item 36 mungkin ketahuan sebagai gejala,
bukan sebagai temuan terpisah.

**Menebak niat dari kata kunci akan gagal begitu manusia berbicara wajar.**
Penebak kategori ini masuk akal di atas kertas, tapi ia menuntut Owner menghafal
kosakata pemicunya. Setiap sistem yang menuntut pengguna menebak kata ajaib
sedang memindahkan bebannya ke orang yang salah.
