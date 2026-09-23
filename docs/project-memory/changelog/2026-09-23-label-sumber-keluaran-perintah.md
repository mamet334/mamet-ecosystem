# Keluaran perintah Engineer diakui sebagai sumber label

**Tanggal:** 23 September 2026
**Roadmap:** T10 di [`ROADMAP-TEMUAN-TERBUKA.md`](../../roadmap/ROADMAP-TEMUAN-TERBUKA.md)
**Status:** ✅ kode selesai & teruji otomatis; **bukti live menunggu deploy**

## Masalah

Jawaban Engineer yang seluruh isinya dibangun dari **isi berkas nyata** — dibaca lewat perintah yang Owner setujui
di dialog izin — selalu diturunkan ke `[STATUS: HYPOTHESIS]` dengan alasan "tidak mengutip dokumen".

Terbukti dua kali live 23 September: TUGAS-02 dan TUGAS-04. Pada TUGAS-04, jawaban yang **11 dari 12 klaimnya
terbukti** saat saya jalankan `detectIntent` asli pada tiap contohnya tetap dilabeli HYPOTHESIS, sementara jawaban
tanpa bukti sama sekali tidak dihukum apa-apa. Pemeriksa label hanya mengakui dokumen RAG (BLOK 4) dan hasil alat
folder Assistant (`[HASIL ALAT FOLDER]`, Item 85) — format Engineer `[TERMINAL OUTPUT for: …]` tidak dikenali.

## Perbaikan

| Berkas | Perubahan |
|---|---|
| `folderKerjaAlat.js` | `sumberDariKeluaranTerminal(pesan)` — mengurai `[TERMINAL OUTPUT for: <perintah>]\n<keluaran>` jadi judul (perintah) + isi (keluaran); perintah yang **DITOLAK OWNER** / **TIDAK DIJALANKAN** dilewati |
| `synthesis_handler.ts` | mode ENGINEER: perintah yang dijalankan ikut jadi sumber pemeriksa label, tercatat di jejak (`⌨️ Sumber keluaran perintah untuk pemeriksa label: N perintah`) |
| `universal_contract.ts` + `types.ts` + `context_builder.ts` | blok kontrak baru `[LABEL UNTUK KELUARAN PERINTAH ENGINEER]` (setara blok alat folder), bendera `keluaranPerintah` menyala hanya saat pesan yang dijawab memang keluaran perintah |

Kontrak barunya menyuruh model menulis `Sumber:` berisi **perintahnya** (mis. `git show HEAD:frontend/src/….js`),
dan menegaskan: usulan/tafsiran tetap HYPOTHESIS, perintah yang ditolak Owner **bukan** sumber.

## Yang tetap dijaga ketat

- perintah DITOLAK/TIDAK DIJALANKAN tidak bisa jadi sumber (kode + kontrak);
- pemeriksaan angka tetap berjalan: jawaban yang menyebut angka yang tidak ada di keluaran tetap diturunkan;
- menyebut sumber lain yang tidak dijalankan tetap diturunkan;
- jawaban tanpa label apa pun tetap ditambahi HYPOTHESIS.

## Uji otomatis (di luar git)

`uji-sumber-terminal.mjs` **14/14**, memakai `label_sumber.ts` server yang ASLI (ditranspilasi esbuild, bukan
tiruan). Termasuk **uji kendali**: jawaban yang sama tanpa sumber terminal memang diturunkan — jadi perbaikan inilah
yang membuat perbedaannya. Bundel `agent-process` ✅.

## Berikutnya

Deploy, lalu ulangi TUGAS-04: jawaban dari `git show HEAD:…` seharusnya bertahan `[STATUS: VERIFIED]` dengan baris
`Sumber:` berisi perintahnya. Rancangan lanjutan ada di
[`ROADMAP-ENGINEER-MANDIRI.md`](../../roadmap/ROADMAP-ENGINEER-MANDIRI.md) (disetujui Owner 23 September, belum ada
kode).
