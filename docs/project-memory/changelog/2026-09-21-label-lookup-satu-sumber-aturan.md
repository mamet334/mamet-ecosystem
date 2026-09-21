# Label Mode LOOKUP: Satu Sumber Aturan (U10 Item 90)

**Tanggal:** 21 September 2026
**Roadmap:** Item 90 utang U10 ([`ROADMAP-PENGAMBILAN-POTONGAN-RAG.md`](../../roadmap/ROADMAP-PENGAMBILAN-POTONGAN-RAG.md))
**Status:** ✅ live — Owner deploy `agent-process`, dibuktikan dua chat + prompt yang benar-benar terkirim.

## Masalah

Dua instruksi label masuk ke prompt yang sama dan saling bertentangan bila mode LOOKUP punya dokumen:

| Sumber | Isi |
|---|---|
| `lib/request/request_pipeline.ts` (panduan identitas) | mode LOOKUP: cetak **TEPAT SATU** label `[Pengetahuan umum AI — tidak diverifikasi dari dokumen Anda]` |
| `lib/verification/universal_contract.ts` BLOK 6 (Evidence Gate `PASSED`) | pilih **TEPAT SATU**: `[STATUS: VERIFIED]` / `[STATUS: HYPOTHESIS - Rekomendasi AI]` / `[STATUS: INSUFFICIENT]` |

LOOKUP tetap mencari dokumen, dan `evidence_validator.ts` memberi `PASSED` begitu RAG/memori tidak kosong — jadi
benturan ini terjadi pada kasus paling umum: pertanyaan dokumen di mode LOOKUP. Label mana yang menang bergantung
pada model, bukan pada aturan.

## Perbaikan (1 berkas, 2 baris)

`request_pipeline.ts` tidak lagi memaksa satu label untuk LOOKUP; ia menunjuk ke BLOK 6 — satu-satunya tempat yang
**tahu ada/tidaknya dokumen** — dan menyebut syaratnya: ada dokumen → VERIFIED (wajib baris Sumber) / HYPOTHESIS /
INSUFFICIENT; tidak ada dokumen → label ringkas `[Pengetahuan umum AI …]` (cabang `WARNING` BLOK 6).

Aman karena: kontrak BLOK 6 **selalu** ikut (`fullSystemContext` = `buildUniversalContract`, `context_builder.ts`),
dan `label_sumber.ts` tidak membeda-bedakan mode — VERIFIED tanpa baris Sumber yang cocok tetap diturunkan sistem.
Menyelaraskan instruksi, bukan aturan label baru; pengambilan potongan tidak disentuh (code freeze aman).

## Bukti live (chat `e8b89c17`, 2026-09-21)

Dibaca dari `chats.messages[].metadata.processingSteps` → `[SYSTEM CONTEXT FINAL]` (prompt yang benar-benar terkirim):

| Chat | Evidence Gate | Instruksi LOOKUP baru di prompt | Label pada jawaban |
|---|---|---|---|
| "Apa pangkat yang dipersyaratkan untuk Camat Kecamatan Lengkiti?" | **PASSED** / 7 bukti | ada | `[STATUS: VERIFIED]` + `Sumber: "Kepbup OKU 2025 - 204 - Camat (Kecamatan Lengkiti)"` |
| "Apa perbedaan HTTP dan HTTPS?" | **WARNING** / 0 bukti | ada | `[Pengetahuan umum AI — tidak diverifikasi dari dokumen Anda]` |

Isi jawaban pertama benar: **Pembina TK. I (IV/b)** — sama dengan PDF asli dan kunci BUKU-01 set uji buku penuh.
Satu mode yang sama kini menghasilkan label berbeda sesuai ada/tidaknya dokumen, dan VERIFIED datang bersama baris
Sumber sehingga pemeriksa label tidak perlu menurunkannya.
