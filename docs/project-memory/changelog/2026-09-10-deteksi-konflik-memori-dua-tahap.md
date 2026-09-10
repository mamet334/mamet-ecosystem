# Deteksi Konflik Memori — Aturan yang Dijamin Salah, dan Kemiripan Vektor yang Ternyata Tidak Cukup

**Tanggal:** 10 September 2026
**Roadmap:** Item 55

## Bermula dari satu tanda tanya

Owner mengirim tangkapan layar panel Memory Context dan menulis: "?"

Sistem menandai **"ya, saya suka menggunakan ai"** berbenturan dengan **"saya
lebih suka penjelasan dengan tabel"**. Dua fakta yang sama-sama benar dan tidak
berhubungan sama sekali.

## Aturan lama runtuh menjadi tautologi

`detectAndMarkConflict` mensyaratkan tiga hal: `source_reference` sama, isi
berbeda, dan versi tidak sekuensial. Dua di antaranya tidak pernah bisa gagal.

**Syarat pertama** — setiap fakta chat dalam satu kategori memakai
`source_reference` yang sama, `assistant_chat:preference`.

**Syarat ketiga** — saya query seluruh tabel:

| Memori | version_sequence |
|---|---|
| saya lebih suka penjelasan dengan tabel | 1 |
| ya, saya suka menggunakan ai | 1 |
| nama panggilan saya pak slamet | 1 |
| Menyukai clean architecture | 1 |
| dan saya kuliah di UT | 1 |
| saya juga suka teh | 1 |
| saya suka kopi | 1 |

Semuanya `1`. Pemanggil mengirim `newVersionSeq: 1` yang di-hardcode, dan
`storeGoldenMemory` juga default `1`. Pemeriksaannya berbunyi `1 !== 1 + 1` —
**selalu benar**. Syarat itu murni hiasan.

Sisanya tinggal: *dua fakta berbeda dalam kategori sama = konflik*. Dijamin
menyala untuk setiap fakta baru.

Aturannya memang dirancang untuk memori turunan **berkas** — satu path berarti
satu isi kanonik, jadi isi berbeda memang berarti versi lama usang. Untuk fakta
percakapan yang saling independen, logika itu tidak berlaku.

Sudah pernah ditambal sekali: dulu semua memori chat memakai satu label konstan,
sehingga "pak slamet" berbenturan dengan "clean architecture". Tambalannya
menambahkan kategori — itu hanya **memperkecil** kelompok yang bertabrakan,
tidak menghapus tabrakannya.

## Pengukuran menjatuhkan rancangan saya sendiri

Owner memilih opsi (b): deteksi berbasis makna. Baru mungkin sejak Item 54,
karena sebelumnya tidak ada memori yang punya vektor.

Sebelum memasang apa pun, 12 pasang kalimat nyata diukur lewat konsol:

| Kemiripan | Jenis | Pasangan |
|---|---|---|
| 0,8780 | BENTROK | tabel vs tidak suka tabel |
| 0,8710 | BENTROK | pak slamet vs pak mamet |
| 0,8514 | BENTROK | kopi vs tidak suka kopi |
| **0,8323** | **TAJAM** | kopi vs kopi hitam tanpa gula |
| **0,8185** | **TAJAM** | UT vs jurusan SI di UT |
| 0,7890 | BENTROK | teh vs benci teh |
| **0,7263** | **BEBAS** | kopi vs teh |
| **0,6353** | **BENTROK** | UT vs ITB |
| 0,5201 | BEBAS | ai vs tabel |
| 0,5083 | BEBAS | pak slamet vs kopi |
| 0,5068 | BEBAS | kopi vs UT |
| 0,4763 | BEBAS | clean architecture vs teh |

**Celah antara BENTROK terendah dan BEBAS tertinggi: −0,091. Negatif.**

Dua baris yang merusaknya:

- **"UT vs ITB" di 0,6353** — pertentangan nyata, tapi duduk **di bawah** "kopi
  vs teh" yang bebas di 0,7263.
- **Golongan TAJAM (0,818–0,832)** terkubur persis di tengah rentang BENTROK
  (0,789–0,878).

Tidak ada satu ambang pun yang memisahkan ketiganya.

### Kenapa, dan kenapa ini bukan soal kalibrasi

Vektor mengukur **kemiripan topik**, bukan **pertentangan**. "Suka kopi" dan
"tidak suka kopi" membicarakan hal yang sama persis — kata "tidak" nyaris tidak
menggeser vektornya. Sementara "UT" dan "ITB" adalah dua nama berbeda yang
menjauhkan vektornya, padahal maknanya justru bertabrakan.

Kemiripan tinggi berarti "membicarakan hal yang sama", bukan "saling membantah".
Itu dua pertanyaan berbeda, dan saya keliru mengira yang satu bisa mewakili yang
lain.

## Yang dipasang: dua tahap

**Tahap 1 — saringan, gratis, di klien.** Kemiripan kosinus ≥ **0,78**. Untuk 7
memori Owner, pasangan tak berhubungan tertinggi hanya 0,7263, jadi saringan ini
hampir tidak pernah menyala untuk fakta bebas. Panggilan LLM jadi jarang.

**Tahap 2 — hakim, berbayar, di server.** Endpoint baru
`{ action: 'judge_conflict' }` di `agent-process` meminta model kecil memutuskan
**BERTENTANGAN / PENAJAMAN / INDEPENDEN**. Hanya BERTENTANGAN yang menandai
memori lama.

Beberapa keputusan yang menyertainya:

- **BYOK wajib** untuk hakim (Item 51). Ini panggilan model chat atas nama
  pengguna — beda dengan embedding yang fungsi internal — jadi memakai kunci
  pengguna sendiri.
- **Model dikirim klien** dari `BrainService`, bukan ditebak di server. Katalog
  penyedia berubah lebih cepat daripada kode; pelajaran Item 41 dan 53.
- **Gagal ke arah tidak menandai.** Hakim gagal, tidak ada key, atau jawaban tak
  terbaca → memori dibiarkan aktif. Prompt-nya juga diberi tie-breaker: ragu
  antara BERTENTANGAN dan PENAJAMAN → pilih PENAJAMAN.
- **Deteksi dipindah ke dalam `storeGoldenMemory`**, memakai ulang embedding
  yang sudah dihitung di sana. Sebelumnya dipanggil terpisah dari
  `AssistantService`, yang berarti dua embedding untuk teks yang sama dan
  membuat jalur penyimpanan lain luput dari pemeriksaan.

## Bukti

Tiga kasus diuji lewat chat sungguhan:

| Kasus | Kemiripan | Putusan | Hasil |
|---|---|---|---|
| kopi hitam tanpa gula | 0,8323 | PENAJAMAN | dibiarkan aktif |
| sekarang tidak suka kopi | 0,7957 | BERTENTANGAN | ditandai |
| suka jalan pagi | — | tidak lolos saringan | tanpa panggilan LLM |

**0,8323 dibiarkan sementara 0,7957 ditandai.** Yang lebih mirip justru lolos.
Itu bukti langsung bahwa ambang tunggal mustahil bekerja, dan bahwa hakimnya
benar-benar memutuskan berdasarkan makna — bukan berdasarkan jarak.

Alasan hakim tersimpan di `metadata.conflict_info.judge_reason`: *"kedua
pernyataan tidak mungkin benar bersamaan"*.

Penjagaan endpoint diuji: tanpa token `401`. `proxy_fetch` dan `embed` tidak
rusak. Deploy `agent-process` diverifikasi `[MATCH]`.

## Label tombol yang menyesatkan

Setelah menekan tombolnya, Owner bertanya: *"itu artinya semuanya tersimpan
sekarang? bukan pilih salah satu kan?"*

Jawabannya ya — dan labelnya memang keliru.

Memori baru **selalu** tersimpan, apa pun yang ditekan. Deteksi konflik tidak
pernah membatalkan penyimpanan; ia hanya menandai memori **lama** untuk
ditinjau.

| Sebelum | Sesudah | Yang sebenarnya terjadi |
|---|---|---|
| Pertahankan Lama | **Simpan Keduanya** | kedua memori tetap aktif |
| Buang / Arsipkan | **Arsipkan yang Lama** | hanya memori baru yang berlaku |

Ditambah keterangan eksplisit di atas tombol: *"Memori baru sudah tersimpan.
Yang Anda putuskan di sini hanya apakah memori lama masih berlaku."*

Dua elemen lain dibuang karena menampilkan angka mati sebagai seolah-olah
bermakna: chip `(v1)` — nilainya selalu 1 di setiap baris, sisa aturan versi
yang barusan terbukti inert — dan baris "Sumber" yang menampilkan
`assistant_chat:preference`, tidak berarti apa-apa bagi pengguna. Kemiripan dan
alasan hakim kini ditampilkan, tapi hanya bila ada; konflik lama tidak punya
keduanya dan kolomnya tidak muncul daripada tampil kosong.

## Yang belum terbukti, dan sengaja tidak diklaim

**Tampilan kartu konflik yang baru belum dilihat terpasang.** Tidak ada konflik
aktif saat perubahan UI selesai. Perubahannya lolos kompilasi, tapi itu hanya
membuktikan bentuknya.

**Ambang saringan 0,78 diukur pada 7 memori.** Pada ratusan memori jarak antar
kelompok akan menyempit dan angka ini perlu ditinjau ulang.

## Konsekuensi yang perlu diketahui

Menekan "Simpan Keduanya" pada pertentangan nyata berarti dua fakta yang saling
membantah sama-sama aktif, dan keduanya bisa tertarik ke prompt yang sama. AI
akan menerima dua pernyataan yang bertentangan tanpa tahu mana yang berlaku
sekarang.

Untuk kalimat uji hari ini tidak masalah. Untuk fakta sungguhan — alamat lama
versus alamat baru, misalnya — yang lama sebaiknya diarsipkan.
