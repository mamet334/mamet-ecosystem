# 5 Oktober 2026 — `finish_reason` akhirnya dibaca; lantai 512 turun ke 128

## Yang memicu

Owner: *"tapi semalam bisa menghasilkan jawaban chatnya walaupun saldo minus"*.

Benar, dan logmya menunjukkan pesan mana persisnya.

| Jam (WIB) | Kutipan penyedia | Yang terjadi |
|---|---|---|
| 13.55 | `can only afford 779` | gagal — kode lama, belum ada pengulangan |
| 14.20 | 778 | diulang dengan 778 → tetap gagal |
| 14.28 | 615 → ulang 553 | gagal, **sebab lain**: `Prompt tokens limit exceeded: 14250 > 3621` |
| **14.36** | **615 → ulang 553** | **BERHASIL** — tak ada baris gagal sesudahnya |
| 14.45 | **444** | ditolak di gerbang |
| 01.05 (5 Okt) | **444** | ditolak di gerbang |

Jadi jawaban semalam datang dari **jalur pengulangan**, bukan permintaan pertama. Permintaan
pertama selalu 402.

## Kenapa jalur itu berhenti menyala

Bukan kode, bukan prompt — prompt justru **lebih kecil** sesudah peta jadi indeks (41.235 vs
55.125 huruf). Yang berubah hanya kutipan penyedia: **615 → 444**.

```
444 × 0,9 = 399   plafon ulang
lantai             512          → ditolak sebelum dicoba
semalam: 615 × 0,9 = 553 ≥ 512  → dicoba, berhasil
```

## Akarnya bukan angka lantainya

Lantai 512 bersandar pada satu kalimat: *"jawaban terpotong tampak seperti model gagal"*. Kalimat
itu **hanya benar selama sistem tidak tahu ia terpotong** — dan memang tidak tahu.
`finish_reason` tidak dibaca di mana pun; `terpotong` yang sudah ada hanya menandai **batas waktu
dinding** (`bacaSseOpenRouter`, tenggat worker).

Jadi 512 adalah **tebakan di muka yang menggantikan pengukuran yang tak pernah diambil**. Ia
menolak mencoba karena tak sanggup melihat hasilnya.

Perbaikannya membalik urutan: **baca `finish_reason` → beri label bila terpotong → baru lantainya
boleh turun.**

## Yang berubah

| | |
|---|---|
| `bacaSseOpenRouter` | merekam `sebabSelesai` dari bingkai **terakhir** (sebelum itu `null`) |
| `processOpenAIStream` | merekam `info.sebabSelesai` — tanpa ini jalur stream buta |
| `terpotongKarenaPlafon()` | mengenali `finish_reason === 'length'` dari bentuk stream **dan** non-stream |
| `pesanTerpotongPlafon()` | label yang ditempel di luar suara model |
| `kirimOpenRouterDenganReasoning` | parameter keluaran `jejak.plafonDipakai` |
| `MIN_TOKEN_LAYAK` | **512 → 128** |

Label di kedua jalur. Di jalur stream ia **ikut di-`yield`** ke layar, bukan sekadar ditambahkan
ke variabel yang tak pernah dilihat siapa pun.

### Kenapa `jejak.plafonDipakai` perlu ada

Plafonnya **diturunkan di dalam** fungsi pengirim sesudah 402, sehingga pemanggil tak tahu angka
yang benar-benar dipakai. Tanpa jejak itu labelnya akan berkata "max_tokens=8192" padahal yang
dipakai 399 — **angka salah yang terdengar pasti**, lebih buruk daripada tanpa angka.

### Kenapa 128

Langkah pertama Engineer bukan prosa melainkan satu penanda `[MAMET_CMD: …]`. Satu kalimat
rencana + penanda ≈ 30–40 token; 128 kira-kira tiga sampai empat kali lipatnya. Di bawah itu
bahkan satu penanda berisiko terpotong.

## Keamanan — diperiksa sebelum menurunkan lantai

```js
/\[MAMET_CMD:([^\]]+)\]/g
```

Penanda **wajib punya `]` penutup**, jadi penanda yang terpotong di tengah tidak cocok sama
sekali — tak ada perintah separuh yang bisa jalan. Ditambah dialog izin Owner di tiap perintah.
Menurunkan lantai **tidak membuka jalur eksekusi baru**.

## Uji

`uji/uji-saldo-plafon-token.mjs` (v2). Bagian 3 **dibalik arahnya, bukan dilonggarkan** — ia dulu
menegakkan keputusan lama. Yang dulu wajib ditolak (399) kini wajib dicoba; lantainya tetap ada,
hanya turun, dan itu dijaga asersi tersendiri (100 → 90 tetap ditolak).

Kasus produksi 5 Okt (`can only afford 444`) kini jadi **data uji**, jadi kegagalan nyata itu tak
bisa kembali diam-diam.

| Mutasi | Asersi jatuh |
|---|---|
| M1 lantai kembali 512 | 2 |
| M2 `finish_reason` tidak direkam di SSE | 2 |
| M3 pengenalan terpotong dibalik | 5 |
| M4 label non-stream tidak dipasang | 1 |
| M5 label menyebut 8192, bukan plafon nyata | 1 |
| M6 label stream tidak dialirkan ke layar | 1 |
| M7 plafon ulang tidak tercatat | 1 |
| M8 `processOpenAIStream` buta | 1 |

**81/81 berkas uji hijau.** Bundel esbuild bersih (523.920 bita).

### Yang jujur tentang M5

M5 dijatuhkan oleh asersi **berbasis teks** (`jejakPlafon.plafonDipakai || MAKS_TOKEN_JAWABAN`
muncul dua kali), bukan oleh asersi perilaku — `pesanTerpotongPlafon(399)` tetap lulus karena ia
dipanggil langsung dengan angka yang benar. Asersi teks lebih rapuh terhadap penataan ulang kode.
Dicatat apa adanya, tidak dipoles.

## PERLU DEPLOY, tanpa rilis klien

Seluruhnya di `supabase/functions/agent-process/lib/adapters/`.

**Yang dibuka oleh perubahan ini:** uji live 2–4 untuk 4.2.12 bisa jalan tanpa isi ulang saldo,
karena kutipan 444 tak lagi ditolak di gerbang.

## Hasil sampingan yang ikut terbukti dari log yang sama

`[PROMPT_KOMPOSISI]` 5 Okt 01:05 — **uji 1 untuk 4.2.12 LULUS**:

```
riwayat = 2 pesan / 2.687 huruf   (dari 16.557)
total   = 41.235 huruf            (dari 55.125, −25,2%)
blok4_rag = 6.959                 → RAG tetap hidup
```

2.687 **tepat** seperti hitungan uji lokal, bukan sekadar "±2.700".
