# 1 Oktober 2026 — Kacamata kuda Engineer dilepas: kode sumber jadi evidence yang sah

## Owner yang menamainya

> *"masih ingat saya berkata membodohkan model? itu lebih mirip memasang kacamata kuda, seperti
> menyembunyikan kebenaran."*

Dan istilah itu lebih tepat daripada "prosedurnya kurang". Prosedur yang kurang membuat model
**menebak**. Yang terjadi 1 Oktober bukan menebak — model **menolak melihat**, lalu menyatakan
kebenaran itu tidak ada.

## Kejadian yang membuktikannya

Owner bertanya: *"Di mana label VERIFIED akhirnya diputuskan? Sebutkan berkas dan nomor barisnya."*

Saat itu **semuanya sudah tersedia**:

| | |
|---|---|
| Peta repo di prompt | **16.945 huruf**, terukur lewat `[PROMPT_KOMPOSISI]` 12.28.40 |
| Perintah git | sudah jalan **sendiri** tanpa persetujuan (4.2.5, terbukti live hari itu juga) |
| Jawabannya | `hakim_bayangan.ts:212` — dua perintah jauhnya |

Model menjawab *"tidak ada evidence"*, `SOURCE TRACE: [NONE]`, **tanpa menjalankan satu pun
pencarian**.

## Sebabnya: ia tidak bodoh, ia patuh

Prompt Engineer mengirim ini tiap pesan:

```
[BLOK 1: IDENTITY]
Batasan: … | Tidak boleh menjalankan perintah OS | WAJIB memiliki evidence sebelum menjawab

[BLOK 5: CONSTRAINT]
Dilarang keras:
  ✗ Menggunakan pengetahuan di luar evidence yang terdaftar (untuk Engineer mode)
```

Dan "evidence" hanya berarti **8 baris** dari `project_memory_entries` ditambah dokumen RAG. Kode
sumber repo — kebenarannya sendiri — berada **di luar daftar itu**.

Jadi model melakukan persis yang diperintahkan: cari di dokumen, tidak ketemu, jawab tidak ada. Ia
baru menjalankan perintah ketika Owner menyuruhnya langsung — perintah Owner mengalahkan larangan.

**Berminggu-minggu matanya dibangun** — `git grep`, peta repo, catatan akar repo, lalu gerbang
izinnya dilepas — **sementara prompt terus menyuruhnya jangan melihat.**

Pengukuran 1 Oktober (±5.400 token aturan lawan ±1.200 token kode) melihat gejalanya, tetapi
kesimpulannya salah: yang kurang bukan kodenya, melainkan **izin untuk melihatnya**.

## Yang diubah

| Sebelum | Sesudah |
|---|---|
| "Tidak boleh menjalankan perintah OS" | kapabilitas: **membaca kode sumber repo** lewat `[MAMET_CMD: …]` — `git grep/show/log/blame/ls-files`, dan disebutkan bahwa perintah baca **jalan sendiri tanpa menunggu persetujuan** |
| "Dilarang: menggunakan pengetahuan di luar evidence yang terdaftar" | "Dilarang: **mengaku tahu isi kode tanpa menengoknya**" + "dilarang menyatakan *tidak ada evidence* untuk pertanyaan kode tanpa pernah mencari di repo" |
| evidence = Brain 1 + RAG | "**kode sumber repo TERMASUK evidence yang sah**, asalkan alamat berkas dan nomor barisnya disebut" |

### Yang sengaja DIPERTAHANKAN

**"WAJIB memiliki evidence sebelum menjawab"** tidak dihapus. Aturan itu mahal diperoleh — ia yang
mencegah model mengarang tindakan (Item 85 Tahap 3). Yang salah bukan kewajiban berbuktinya,
melainkan **daftar tempat bukti boleh dicari**. Melonggarkan kewajibannya akan mengembalikan cacat
lama lewat pintu baru.

Perintah yang **menjalankan kode** (`node -e`, `python -c`, `npm`) tetap disebut butuh persetujuan
Owner — garis yang sama persis dengan `tanpaPersetujuan()` di proses utama. Kalau prompt dan
pelaksana berbeda pendapat, model akan mengusulkan yang ditolak atau menahan yang sebenarnya boleh.

Mode LITE dan Assistant tidak disentuh; web search tetap mati untuk Engineer.

## Dikerjakan SENDIRIAN, atas pilihan Owner

> *"saya pilih melonggarkan kacamata kuda dulu untuk pembandingan, karena bisa jadi nanti kalau saya
> pindah dengan model yang lebih pintar, hasilnya akan sama saja."*

Usul `AGENTS.md` + peta-sebagai-berkas **ditunda** supaya pengaruh perubahan ini terukur sendirian.
Kalau sesudah ini model yang lebih pintar pun tetap gagal, itu membuktikan masalahnya tidak pernah
di modelnya.

## Uji

`uji/uji-kacamata-kuda-engineer.mjs` (baru) — 26 pemeriksaan. **66/66 berkas uji hijau.** Bundel
esbuild atas `agent-process/index.ts` bersih (500,9 kb).

**Batas uji ini, disebut apa adanya:** ia memeriksa **teks sumber**, bukan perilaku. Modulnya tidak
bisa diimpor Node (tipe di-*re-export* dari `types.ts`), dan mengubah kode produksi hanya demi uji
bukan pertukaran yang baik di sini. Jadi yang dijamin hanya: kalimat kacamata kuda sudah tidak ada,
penggantinya ada, dan ketiganya benar-benar **dirender** ke prompt. Bahwa model benar-benar
**menengok** hanya bisa dibuktikan live.

Satu asersi khusus menjaga hal yang pernah menggigit di tempat lain: kalimat itu harus benar-benar
dirender (`Kapabilitas:`, `Batasan:`, `for (const f of constraint.forbidden)`). Kode yang dibaca
lalu tidak dikirim tidak mengubah apa pun — persis nasib `INIT.md`/`AGENTS.md` di Brain 1.

## Temuan lain yang ikut terbuka, BELUM dikerjakan

`engineer.js:316` memuat **32 berkas** konstitusi tiap boot — `INIT.md`, `AGENTS.md`,
`constitution/00`–`27`, termasuk `24_ANTI_HALLUCINATION_PROTOCOL.md`. Satu-satunya pemakaian isinya
di seluruh kode:

```js
staticKnowledgeLoaded: brain.static?.loadedFiles?.length || 0
```

**Hanya jumlahnya.** Konstitusi dibaca tiap boot lalu dibuang; tidak pernah sampai ke model. Blok
"BRAIN 1 — STATIC" yang model laporkan sebagai `[✓] ADR` adalah 8 baris dari `project_memory_entries`,
bukan konstitusi.

Dicatat di INDEX; dikerjakan sesudah pengaruh perubahan ini terukur.

## ✅ TERBUKTI LIVE — 1 Oktober 2026, 13.12

Pertanyaan yang **sama persis** dengan yang gagal kemarin, di percakapan baru, sesudah deploy.

**Deploy terkonfirmasi dari log:** `kontrak_blok1_2` membesar 673 → **1099** huruf.

**Model menengok.** 13.12.30 pertanyaan masuk (79 huruf); **9 detik kemudian** masuk pesan **6.025
huruf** — keluaran terminal yang dikembalikan ke model. Kemarin angka itu tidak pernah ada.

Jawabannya: `label_sumber.ts`, gerbang di **baris 475**, penurunan di **563–569**. Diperiksa
baris demi baris terhadap berkas aslinya:

| Klaim | Kenyataan |
|---|---|
| 475 — `if (!tampil.includes(LABEL_VERIFIED)) return diam;` | **persis** |
| 459 — menyeragamkan varian penulisan label | **persis** (`replace(/\[\s*status\s*:\s*verified\s*\]/gi, …)`) |
| 511–520 — penurunan karena halaman, rujukan, angka, centang | **persis, keempatnya, berurutan** |
| 563–569 — `turunkan(...)` ke HYPOTHESIS/PARTIAL | **persis** |

Dan ia melabeli jawabannya `[STATUS: VERIFIED]` dengan baris Sumber berisi **perintah yang ia
jalankan sendiri** — persis perilaku yang dirancang: kode sumber jadi evidence sah, dengan syarat
ketertelusuran.

### Kunci jawaban penguji yang meleset, bukan modelnya

Kunci yang disiapkan adalah `hakim_bayangan.ts:212`. Pertanyaannya berbunyi *"di mana label VERIFIED
**akhirnya** diputuskan"* — dan `label_sumber.ts` justru tahap **terakhir** yang masih bisa
menurunkan label itu. Jawaban model lebih tepat daripada kunci pengujinya.

Dicatat karena pola ini berulang: penguji yang memilih kasusnya sendiri cenderung memilih yang
nyaman (lihat juga 93% Kepbup, ketika contoh SQL yang dipilih sendiri menyembunyikan kegagalan
"semua kata").

### Artinya

Masalahnya memang **tidak pernah di modelnya**. Model yang sama kelasnya, repo yang sama, peta yang
sama — berubah total hanya karena satu kalimat larangan dicabut dan satu kapabilitas disebut
namanya.
