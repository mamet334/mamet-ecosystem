# Coordinator & Sub-Agent Lewat OpenRouter; Kunci Server Gemini/Groq Dihapus

**Tanggal:** 15 September 2026
**Roadmap:** Item 82
**Berkas kode:** `lib/request/request_pipeline.ts`, `lib/llm_orchestrator.ts`, `lib/adapters/ai_adapter.ts`,
`lib/event/subscribers/tool_subscriber.ts`, `plugins/context_compressor.ts`, `plugins/deep_research.ts`
(semua di `supabase/functions/agent-process/`)
**Status:** dideploy v439 (03.25 UTC) dan v440 (03.39 UTC), terbukti live. Riset web mendalam ditunda (Pilihan A di bawah).

## Temuan

Log uji mutu RAG putaran 7 memuat `Coordinator LLM Error: GeminiAdapter RATE_LIMIT` berulang. Log 48 jam:

| Kunci `GEMINI_API_KEY` | Hasil |
|---|---|
| #0 | 403 di setiap panggilan (sudah sejak 13 Sep 13.00 UTC) |
| #1 | 429 kuota harian tier gratis habis, mulai 14 Sep 12.00 UTC (lalu lintas uji mutu) |
| #2 | 403 |

- `runCoordinatorLLM` dipatok ke `'gemini'` dan cascade dimatikan (`llm_orchestrator.ts` baris 81–88), jadi **Intent Router
  dan Coordinator gagal di setiap pesan** → sub-agent tidak pernah jalan. Ini penjelasan backlog "sub-agent researcher tidak
  pernah terpanggil" sejak uji mutu putaran 1; perbaikan `shadowMode` (`c49a8ea`) belum pernah sempat berjalan.
- Tiap pesan membuang ±3–6 detik (3 percobaan × 3 kunci dengan jeda).
- Isi pesan 403 tidak tercatat (`ai_adapter.ts` hanya mencetak status) — penyebab pastinya tidak diketahui.

## Keputusan Owner

Kunci Gemini dan Groq server adalah tier gratis; kebijakan dan biaya bisa berubah. **Fokus OpenRouter:** secret
`GEMINI_API_KEY` dan `GROQ_API_KEY` dihapus Owner dari Supabase. Gemini/Groq kini hanya dengan BYOK pengguna.
`APIFY_API_TOKEN` (cadangan transkrip YouTube) dibiarkan: paket gratis Apify, pemakaian periode ini $0 dari $5.

## Perubahan

| Bagian | Sebelum | Sesudah |
|---|---|---|
| Intent Router + Coordinator | kunci Gemini server, tanpa cadangan | kunci & model OpenRouter pengguna, `thinking: false` |
| Peringkas riwayat (`context_compressor`) | hanya `['groq','gemini']` → tak pernah jalan | `['openrouter','gemini','groq']`, `thinking: false` |
| Sub-agent (`tool_subscriber`) | Gemini/Groq dulu | OpenRouter dulu; LLM di dalam sub-agent `thinking: false` |
| Riset Google (`customRunResearch`) | semua adapter, OpenRouter tak pernah mengembalikan sumber | hanya Gemini (BYOK); tanpa itu gagal seketika |
| Deep Research | memanggil Google dengan kunci kosong | kunci kosong disaring → langsung DuckDuckGo |
| Kunci per pesan (`request_pipeline`) | membaca `GEMINI_API_KEY`/`GROQ_API_KEY` | hanya kunci BYOK |

- `callLLMWithMetadata` menerima `opsi.thinking`; `OpenRouterAdapter` memakai `input.thinking` bila boolean, selain itu tier.
  Jawaban akhir tetap mengikuti tier Thinking.
- Bawaan penyedia `'gemini'` → `'openrouter'` (`callLLMWithMetadata`, `callLLMWithCascade`, `runLLMDenganNalar`).
- Peta model OpenRouter: `gemini-2.5-flash` (kiriman mametlite) → `google/gemini-2.5-flash` (dicek ada di katalog).

**Dua bug lama ikut diperbaiki di `request_pipeline.ts`:**
1. `keys.openRouter` jatuh ke `OPENROUTER_API_KEY` **sistem** bila pengguna memilih penyedia lain. Coordinator yang kini lewat
   OpenRouter akan memakai saldo Owner untuk pengguna itu. Kini hanya kunci OpenRouter pengguna; tanpa itu Coordinator
   dilewati tanpa permintaan keluar.
2. `gemini`/`allGemini`/`groq` kunci server ditulis SESUDAH `[finalProvider]: finalApiKey`, sehingga BYOK Gemini pengguna
   tertimpa kunci server. Kini kunci pengguna yang dipakai.

## Uji

- `uji-coordinator-openrouter.mjs` 8/8 (fetch tiruan, loader esbuild): lewat OpenRouter tanpa panggilan Google; kunci & model
  pengguna; `reasoning.enabled:false` walau tier Thinking menyala; jawaban utama tetap `enabled:true`; tanpa kunci OpenRouter
  pengguna gagal cepat dengan 0 permintaan keluar; model mametlite dipetakan.
- Regresi lolos: `uji-nalar-openrouter`, `uji-sse-hybrid`, `uji-tasks-fire`. Sintaks keenam berkas OK (esbuild).

## Bukti live

**v439 (Coordinator ke OpenRouter):**
- 03.27 "hai mamet, gimana sistem aplikasi saya?" → Intent Router (gpt-4o-mini, $0,000028) → obrolan biasa.
- 03.28 "tolong riset singkat ai besar hanya 3 top saja" (web + RAG) → Intent Router ($0,00001, nalar 0) → Coordinator
  ($0,0000088, nalar 0) → **"Rencana: 1 sub-agent → researcher" — sub-agent pertama kali dijalankan**. Tetapi researcher
  `late. Result DISCARDED`: langkah "Google Grounding" lewat OpenRouter dengan nalar menyala makan 9 detik (batas per
  plugin 12 detik), sumbernya selalu kosong.
- 03.35 "3 perusahaan AI terbesar 2026" → pola sama: langkah Grounding **17 detik**, $0,00037 terbuang, hasil dibuang.
  Jawaban INSUFFICIENT, jujur menyebut sub-agent timeout.

**v440 (riset Google hanya Gemini, nalar mati di sub-agent):**
- 03.40 pesan yang sama → Grounding dilewati seketika → **researcher selesai 213 ms**, tidak ada lagi `late`. Tetapi
  DuckDuckGo Lite tidak mengembalikan hasil ("Riset gagal: … fallback DuckDuckGo …"). Jawaban HYPOTHESIS: Canva "AI terbesar
  ke-3" (Kompas), CEO OpenAI/Anthropic/Sakana AI di KTT G7 (Tribunnews), nama lain ditandai "bukan dari dokumen".
- Tidak ada lagi log GeminiAdapter/403. Biaya router + coordinator ±$0,00005 per pesan.

## Catatan pencarian web

- Tool web yang berhasil berjalan **di aplikasi desktop**, bukan server (`WebComparisonService.js`: Bing News RSS → Google
  News RSS → Antara → Wikipedia; Wikipedia diblokir untuk kueri temporal).
- Pesan pendek/umum ("ai besar hanya 3 top") memberi potongan Wikipedia tak relevan (Arisan, Ralph Wiggum, TSMC); pesan
  spesifik ("3 perusahaan AI terbesar 2026") memberi berita Bing News yang relevan, tetapi hanya cuplikan 1–2 kalimat.
- DuckDuckGo Lite dari server kosong dalam ±200 ms; dari komputer Owner bahkan tidak bisa dihubungi. Bing News RSS dari
  komputer Owner memberi 5 hasil. `searchDuckDuckGo` tidak mencatat status/isi balasan, jadi penyebab pastinya tidak terlihat.

## Keputusan Owner: Pilihan B (berhenti di sini), Pilihan A dicatat untuk nanti

**B (dipilih):** sistem sudah benar dan cepat — Coordinator jalan, researcher gagal cepat dan dilaporkan jujur, tool web tetap
memberi berita terbaru. Kelemahan: jawaban riset bersandar pada cuplikan berita.

**A — solusi riset web mendalam (dikerjakan nanti bila kebutuhan riset sering muncul):**
1. Di `researcher.ts`, ganti `searchDuckDuckGo` dengan mesin yang sama dengan tool web desktop: **Bing News RSS**
   (`https://www.bing.com/news/search?q=…&format=rss`), cadangan **Google News RSS** (`hl=id` lalu `hl=en-US`). Urai
   `<item>` (title, link, description) seperti `WebComparisonService._parseRssResults`. Catat status HTTP dan jumlah hasil ke
   log (kekurangan `searchDuckDuckGo` sekarang).
2. **Baca isi 1–2 artikel teratas** lewat `https://r.jina.ai/<url>` (sudah dipakai `fetchYahooImages`), paralel, dengan
   `AbortController` ±5 detik per artikel dan potong ±3.000 huruf per artikel. Tautan Bing RSS berupa `apiclick.aspx?…&url=`
   — ambil parameter `url` agar yang dibaca halaman aslinya. Inilah yang membawa jawaban dari cuplikan ke isi (nama tiga
   perusahaan ada di isi artikel Kompas, bukan cuplikannya).
3. Rangkum dengan `runLLM` (sudah `thinking: false`), cantumkan nomor sumber `[1]`, `[2]` dan URL asli.
4. Anggaran waktu per plugin 12 detik (`execution_handler.ts` `PER_PLUGIN_TIMEOUT_MS`): RSS ±1 s + baca artikel ≤5 s +
   rangkuman ±3–5 s. Bila ketat, turunkan ke satu artikel sebelum menaikkan batas waktu.

Risiko A: Bing/Google News RSS belum pernah dicoba dari IP server Supabase (uji dulu dengan satu log status); `r.jina.ai`
layanan gratis tanpa kunci dengan batas pemakaian (tanpa biaya, bisa ditolak bila sering); anggaran 12 detik ketat.
Bukti selesai A: log `researcher selesai (<12000 ms)` dengan hasil berisi sumber berita, dan jawaban akhir memuat isi artikel.
