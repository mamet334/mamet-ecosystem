# Mametlite: Layar Pengaturan Kunci + Label VERIFIED di Jalur Streaming (U8a Item 90)

**Tanggal:** 21 September 2026
**Roadmap:** Item 90 utang U8 ([`ROADMAP-PENGAMBILAN-POTONGAN-RAG.md`](../../roadmap/ROADMAP-PENGAMBILAN-POTONGAN-RAG.md))
**Status:** ✅ U8a terbukti live — `agent-process` v461 (deploy Owner 02:48 UTC), Mametlite diuji lewat `npm run dev`.

## Temuan 1 — Mametlite buntu di `NO_API_KEY`

Uji pertama U8 di mametlite.vercel.app: `❌ Error: NO_API_KEY`. Mametlite **membaca** `localStorage`
`x-byok-openrouter` di tiga tempat (chat, unggah, OCR), tetapi **tidak punya tempat mengisinya** — satu-satunya
input di aplikasi: email, kata sandi, kotak chat, pilih berkas. Pesan galat server menyuruh "Settings → AI
Provider" dan pesan unggah Mametlite menyuruh "Pasang kunci di Pengaturan" — halaman yang tidak ada. Sejak gerbang
BYOK umum dipasang, chat dan unggah Mametlite ditolak untuk semua pengguna kecuali kunci ditanam lewat DevTools.

**Perbaikan (`mametlite/src/App.jsx`, keputusan Owner "pilihan 2"):**
- Tombol gerigi di kepala sidebar (kuning bila kunci belum ada) + peringatan yang bisa diklik.
- Panel kunci: isian `type="password"`, Simpan (Enter juga), Hapus kunci (konfirmasi), penanda terpasang/belum ada.
  State layar hanya menyimpan **ada/tidaknya** kunci, bukan isinya. Huruf non-ASCII dibuang saat menyimpan (spasi
  tak terlihat dari halaman OpenRouter ditolak header HTTP — aturan yang sama dengan jalur unggah & OCR).
- Kirim chat tanpa kunci ditahan di klien dan membuka panel — bukan `NO_API_KEY` dari server.
- Pesan unggah menunjuk ikon gerigi dan membuka panel.
- `vite build` Mametlite exit 0.

## Temuan 2 — VERIFIED yang sah selalu diturunkan di dua jalur streaming

Sesudah kunci terpasang, jawaban Mametlite benar (Pembina TK. I (IV/b), Sumber dokumen 204) tetapi ditambah
`[STATUS: HYPOTHESIS]` + "label VERIFIED diturunkan". Log: `[LABEL] stream: label dikoreksi -> HYPOTHESIS (tidak ada
dokumen yang dilampirkan); dokumen dilampirkan: 0` — padahal 7 potongan, Evidence Gate `PASSED`.

`synthesis_handler.ts` punya **tiga** jalur `STREAM`/`LLM`. Hanya jalur "jawab langsung" yang membawa
`judulDokumen` + `isiDokumen` ke `stream_handler.ts`; jalur sintesis sub-agent dan jalur `else` tidak. Pemeriksa
label (`label_sumber.ts`) lalu mengira tidak ada dokumen dan menurunkan **setiap** VERIFIED. Mametlite selalu
streaming dengan tool → di Mametlite VERIFIED tak mungkin bertahan; desktop juga kena bila streaming lewat Coordinator.

**Perbaikan:** dua payload itu kini ikut membawa `judulDokumen` dan `isiDokumen` (variabel yang sama, dideklarasikan di
awal fungsi). Aturan label tidak diubah. Sintaks diperiksa esbuild (`deno` tidak ada di mesin ini).

## Bukti live (pertanyaan sama, prompt identik)

| | 02:44 (v460) | 02:49 (v461) |
|---|---|---|
| Asal / potongan / Evidence Gate | mametlite / 7 / PASSED | mametlite / 7 / PASSED |
| `[PROMPT_KOMPOSISI]` | 14.355 huruf | 14.355 huruf (identik) |
| Log `[LABEL] stream: label dikoreksi` | muncul, "dokumen dilampirkan: 0" | **tidak muncul** |
| Label di layar | VERIFIED + HYPOTHESIS "diturunkan" | **`[STATUS: VERIFIED]`**, Sumber dokumen 204 |

Nalar model memilah dokumen kembar dengan benar: menolak Camat Sosoh Buay Rayap & Semidang Aji (beda kecamatan) dan
Sekretaris Camat (beda jabatan) — baris konteks Item 89 terpakai nyata.

**U8a selesai:** RAG di Mametlite terbukti bekerja langsung, dari pencarian sampai label.

## Temuan 3 — mode LITE tidak pernah aktif (dicatat, belum diubah)

Log kedua chat: `[RequestParser] Mode diterima: ASSISTANT`, `[RAG] Mode: ASSISTANT … maks 8`. `request_parser.ts`
memberi mode bawaan `ASSISTANT` bila klien tak mengirim `mode`, sehingga cabang LITE di `execution_context.ts`
(`input.mode || … isMametLite ? "LITE"`) tak pernah tercapai: Mametlite mendapat 8 potongan, bukan 10. Pembatasan
memori Mametlite **tetap benar** karena dihitung dari `appSource`, bukan mode. Mengaktifkan LITE mengubah perilaku
untuk semua pengguna Mametlite → keputusan Owner sesudah diukur.

## Koreksi rumusan U8b

"Jalur tanpa kunci OpenRouter" tidak bisa dibuktikan karena **tidak bisa tercapai**: tanpa kunci, menjawab pun
ditolak gerbang BYOK. Cabang cadangan pencocokan kata (`context_builder.ts`) hidup untuk keadaan lain — **kunci ada
tetapi embedding gagal** (model embedding bermasalah/ditolak). U8b diganti rumusannya menjadi itu, masih terbuka.
