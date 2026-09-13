# Nalar yang Benar-Benar Mati, Penyedia yang Tercatat, dan Jam yang Bukan Tebakan

**Tanggal:** 13 September 2026
**Roadmap:** Item 75

Empat perbaikan kecil yang lahir dari satu pertanyaan uji — *"melihat status jam saat ini"* — dan
satu temuan sampingan Item 73.

## 1. Penyedia hulu OpenRouter dicatat

**Masalah.** Di Item 73 dua permintaan identik ke `deepseek-v4-flash-0731` menghasilkan satu jawaban
melantur dan satu benar; selisihnya hanya di token, cache, dan biaya. Dugaannya: OpenRouter
mengarahkan model yang sama ke penyedia hulu berbeda. Tidak bisa dibuktikan, karena field
`provider` yang dikirim OpenRouter di setiap respons dibuang.

**Perbaikan.** Baris `[PR#6 TOKEN METRICS] OpenRouter` kini diakhiri `penyedia=<nama>`, di jalur biasa
maupun stream. Groq dan OpenAI tidak berubah.

**Bukti produksi.** Satu model, tiga chat, penyedia berganti-ganti:

| Waktu (UTC) | Penyedia |
|---|---|
| 13:03 | OpenInference |
| 13:22 | Relace |
| 13:36 | OpenInference |

## 2. Thinking yang dimatikan kini benar-benar mematikan nalar

**Masalah.** Tier SEDANG yang kotak Thinking-nya **tidak dicentang** tetap bernalar 1.491 token dalam
satu jawaban — ditagih, dan jawaban baru selesai 37 detik kemudian. Dua sebab bertumpuk:

- Frontend mengirim `thinking: aiThinking || undefined`, jadi nilai `false` tidak pernah sampai ke
  server. "Owner mematikan" dan "klien tidak mengirim apa pun" terlihat sama.
- Adapter sengaja tidak pernah mengirim nilai "mati". Menurut dokumentasi OpenRouter, model yang
  mampu bernalar **menyalakannya otomatis** bila parameter tidak dikirim.

**Perbaikan.** Tiga keadaan, bukan dua:

| Setelan | Dikirim ke OpenRouter |
|---|---|
| dicentang | `reasoning: { enabled: true }` |
| tidak dicentang | `reasoning: { enabled: false }` — **baru** |
| klien tidak mengirim (mis. mametlite) | tidak ada — perilaku lama |

Model yang menolak dimatikan (terbukti untuk `gemini-3.5-flash-lite`, HTTP 400 *"Reasoning is
mandatory"*) diulang sekali tanpa parameter, lalu namanya diingat selama instans hidup.

**Bukti produksi.**

| | 13:03 (sebelum) | 13:22 (sesudah) | 13:36 (sesudah) |
|---|---|---|---|
| Token nalar | 1.491 | **0** | **0** |
| Token jawaban | 1.804 | 113 | 59 |
| Lama menunggu model | 37 detik | 2,6 detik | 3,0 detik |

Biaya tidak dijadikan pembanding: token yang ter-cache berbeda jauh antar chat (3.544, 0, 3.266),
sehingga selisih biayanya bercampur dengan efek cache.

**Perhatian.** Tier THINKING Owner juga berstatus Thinking tidak dicentang. Dulu ia tetap bernalar
karena perintah "mati" tak pernah terkirim; sekarang benar-benar tidak bernalar kecuali dicentang.

## 3. Jam dari sistem tidak boleh jadi dasar label VERIFIED

**Masalah.** "Melihat status jam saat ini" dijawab dari stempel waktu header prompt, lalu berlabel
`VERIFIED` karena tabel zona waktu ebook ikut dikutip untuk sebagian isinya. Tabel itu mencatat
waktu **standar** (`Dublin GMT ST UTC`, `Bahamas Eastern ST UTC-05:00`), sehingga pada 13 September
jam Dublin dan Bahamas meleset satu jam karena musim panas. Pemeriksa label Item 71 meloloskannya
karena judul dokumen disebut dengan benar — ia hanya bisa memeriksa kutipan, bukan asal tiap fakta.

**Perbaikan.** Stempel waktu header ditulis *"Waktu server (DATA SISTEM, bukan dokumen)"*, dan BLOK 6
menambah aturan: data sistem tidak boleh dijadikan Sumber; bila inti jawaban dari data sistem atau
pengetahuan sendiri, pakai `HYPOTHESIS` dan sebutkan bagian mana yang dari dokumen.

**Bukti produksi (13:22).** Label `HYPOTHESIS`, dengan *"Sumber: Data sistem (waktu server), bukan
dari dokumen RAG"*. Tidak ada koreksi otomatis — model sendiri memilih label yang benar.

## 4. Browser mengirim zona waktunya

**Masalah.** Setelah perbaikan 3, model berhenti menebak — tapi juga berhenti membantu: *"saya tidak
memiliki informasi zona waktu Anda"*. Pemeriksaan log membongkar hal lain: chat 13:03 yang menjawab
"20:03 WIB untuk Anda di Indonesia" pun **tidak tahu**. Riwayatnya 0 pesan dan tanpa memori; model
menebak dari bahasa pertanyaan dan baris pertama tabel ebook (`Indonesia: Jakarta`), dan kebetulan
benar.

**Perbaikan.** AssistantService mengirim `clientTimezone` dari `Intl` (mis. `"Asia/Jakarta"`). Server
memvalidasinya lalu menulis KONTEKS WAKTU bertanda DATA SISTEM: jam lokal, zona, selisih UTC, dan
tanggal lokal — waktu musim panas dihitung `Intl`. Ini menggantikan baris lama yang hanya berisi
tanggal UTC dan tahun "2026" yang ditulis tetap. Server juga mencatat `[Waktu] Zona waktu pengguna`,
karena jawaban yang menyebut WIB belum membuktikan datanya sampai.

**Bukti produksi (13:36).**

```
[Waktu] Zona waktu pengguna: Asia/Jakarta
[PROMPT_KOMPOSISI] … riwayat=0 pesan/0 huruf …
```

Jawaban: *"Minggu, 13 September 2026, pukul 20.36 WIB"* — chat masuk 13:36:08 UTC, tepat. Tanpa
riwayat, tanpa tebakan. Prompt identitas bertambah 333 huruf.

## Uji sebelum deploy

| Perbaikan | Uji |
|---|---|
| Penyedia hulu | 16/16 — fungsi stream diambil dari berkas asli, teks utuh saat dipecah per 17 byte |
| Nalar tiga keadaan | 12/12 — fetch palsu dengan `Response` asli: nyala, mati, tak ditentukan, wajib nalar diulang lalu diingat, 400 lain dan 500 tidak diulang |
| Data sistem | 10/10 — termasuk frasa yang diandalkan Item 71 dan aturan Item 73 tetap utuh |
| Zona waktu | 26/26 — musim panas Dublin/Nassau, tanggal melewati tengah malam, sisipan baris baru dan kutip ditolak |

## Keterbatasan yang disadari

- **Label untuk jawaban dari data sistem terasa janggal.** Jam yang dihitung dengan benar tetap
  berlabel `HYPOTHESIS - Rekomendasi AI`, padahal itu bukan rekomendasi. Belum ada label yang pas.
- **RAG tetap menarik tabel zona waktu ebook untuk pertanyaan jam** (7 potongan, skor 0,674), dan
  mesin kepercayaan melaporkan "100% — Sangat Tinggi" sambil menyuruh model memprioritaskan dokumen.
  Model kini tidak terpancing, tapi dorongannya masih ada.
- **Jalur cadangan model wajib-nalar belum pernah terjadi di produksi** — hanya teruji dengan fetch palsu.
- mametlite dan pemanggil lain di luar AssistantService belum mengirim zona waktu; mereka mendapat
  teks cadangan "jam lokal pengguna tidak diketahui".
- Groq dan OpenAI tetap tidak dikirimi perintah "mati".
