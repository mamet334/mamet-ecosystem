# Plumbing Parameter `thinking` dari Slot Tier sampai ke Provider

**Tanggal:** 2026-09-09
**Status:** ✅ Selesai & Diverifikasi Live di Kedua Ujung
**Commit:** `65d8427` (implementasi), `32631da` (penjaga Gemini + koreksi klaim)
**Deploy:** `agent-process` ter-deploy, drift check `[MATCH]`
**Terkait:** Item 34 (Adaptive Model Tiering), Item 38 (temuan turunan)

---

## 1. Masalah

`BrainService` sudah menyimpan field `thinking` per slot tier sejak Item 34, tapi
nilainya berhenti di penyimpanan — **nol kemunculan** `thinking` atau
`reasoning_effort` di seluruh edge function. Adapter hanya meneruskan `model`,
dengan `temperature: 0.1` dan `max_tokens: 8192` hardcoded.

Rantai yang harus disambung:

```
BrainService.state.tiers[X].thinking
  → getActiveBrainContext(tier).thinking
  → payload AssistantService { thinking }
  → request_parser.ts
  → request_pipeline.ts → RuntimeContext.model.thinking
  → ai_adapter.ts → parameter reasoning tiap provider
```

---

## 2. Nama Parameter — Diverifikasi dari Dokumentasi, Bukan Ingatan

Item 35 menuliskan peringatan eksplisit bahwa nama parameter ini **wajib** diambil
dari dokumentasi terkini tiap provider. Peringatan itu dipatuhi:

| Provider | Field | Nilai saat menyala |
|---|---|---|
| OpenRouter | `reasoning: { enabled }` | `true` |
| OpenAI | `reasoning_effort` | `"medium"` |
| Groq | `reasoning_effort` | `"medium"` |
| Gemini 3.x | `generationConfig.thinkingConfig.thinkingLevel` | `"high"` |
| Gemini 2.5 | `generationConfig.thinkingConfig.thinkingBudget` | `-1` (dinamis) |

Cakupan: 8 titik request di `ai_adapter.ts` — 4 provider × (non-stream + stream).

---

## 3. Keputusan Desain: Semantik Sengaja Asimetris

`true` mengirim parameter; `false` **tidak mengirim apa pun**. Ini bukan "matikan
reasoning", melainkan "pakai perilaku bawaan model".

Alasannya:

1. Dokumentasi OpenRouter menyatakan request ditolak **400** kalau parameter
   reasoning dikirim ke model yang tidak mendukungnya. Mengirim nilai "off" tetap
   berarti mengirim parameternya.
2. **Gemini 2.5 Pro tidak bisa dimatikan thinking-nya sama sekali.**

`ai_adapter.ts` dilewati **semua** panggilan LLM — Assistant, Engineer, Lite, dan
pengguna eksternal mametlite. Perilaku bawaan wajib tidak berubah sedikit pun bagi
siapa pun yang tidak menyalakan toggle.

### Konsekuensi yang Harus Dicatat Jujur

Rencana asli [`ROADMAP-ADAPTIVE-MODEL-TIERING.md`](../../roadmap/ROADMAP-ADAPTIVE-MODEL-TIERING.md)
§4.3 membayangkan Kecil vs Sedang memakai **model yang sama** dengan reasoning mati
vs hidup. Itu **hanya separuh tercapai**. Menyalakan bisa; mematikan tidak bisa
dijamin lintas provider. Membedakan tier tetap paling andal lewat model ID berbeda.

---

## 4. Di Luar Daftar Item 35, Tapi Wajib: Toggle di Settings

Item 35 hanya menyebut plumbing. Tapi tanpa UI, nilai slot tidak akan pernah bisa
bernilai `true` — `_seedTiersFromMainModel()` selalu menulis `thinking: false`, dan
Settings tidak pernah meneruskan field itu ke `setTier()`. Fiturnya akan mustahil
diuji.

Checkbox per slot ditambahkan, dengan peringatan risiko ditulis **langsung di UI**,
bukan hanya di komentar kode.

---

## 5. Bukti Verifikasi Live

Ini pertama kalinya sebuah fitur di proyek ini diverifikasi di **kedua ujung**, bukan
hanya dari konsol browser.

**Sisi klien** (konsol Electron):
```
Model tier: KECIL (LOOKUP selalu tier ringan) → openrouter/openai/gpt-4o-mini [thinking: ON]
Model tier: SEDANG (override manual Owner) → openrouter/deepseek/deepseek-v4-flash-0731 [thinking: ON]
```

**Sisi server** (log edge function Supabase):
```
[Thinking] Reasoning dinyalakan untuk provider openrouter, model openai/gpt-4o-mini
[Thinking] Reasoning dinyalakan untuk provider openrouter, model deepseek/deepseek-v4-flash-0731
```

Log klien saja tidak akan cukup — ia hanya membuktikan niat, bukan pengiriman. Log
server membuktikan parameternya benar-benar masuk ke body request.

---

## 6. Koreksi atas Klaim Saya Sendiri

Peringatan "OpenRouter menolak dengan 400 kalau parameter reasoning dikirim ke model
non-reasoning" berasal dari dokumentasi resmi OpenRouter, tapi **tidak terbukti
menyeluruh**. Uji live membuktikan `openai/gpt-4o-mini` — yang jelas bukan model
reasoning — menerima `reasoning: { enabled: true }` dan menjawab **HTTP 200**.

Jadi penolakannya bergantung model, bukan aturan menyeluruh. Perilaku nyata ini
dicatat di komentar `ai_adapter.ts`, dan teks peringatan di UI Settings diperbaiki
supaya tidak menjanjikan error yang belum tentu muncul.

Desain asimetris tetap dipertahankan — risikonya nyata untuk sebagian model, dan
alasan Gemini 2.5 Pro sama sekali tidak terpengaruh temuan ini.

---

## 7. Efek Samping yang Menguntungkan: Log Baru Membongkar Cacat Lama

Log `[Thinking]` yang ditambahkan fitur ini langsung menampilkan 18 baris:

```
[Thinking] Reasoning dinyalakan untuk gemini, model deepseek/deepseek-v4-flash-0731 → {"thinkingBudget":-1}
```

GeminiAdapter menerima model ID milik OpenRouter. Bagian yang menjadi tanggung jawab
Item 35 langsung diperbaiki (`applyGeminiThinking` sekarang menolak menyuntikkan
parameter kalau nama model tidak mengandung "gemini"). Akar masalahnya jauh lebih
besar dan dicatat terpisah sebagai **Item 38**.

**Pelajaran:** menambahkan log di jalur yang selama ini bisu sering lebih berharga
daripada fitur yang dibawanya. Cacat di Item 38 sudah berjalan diam-diam entah sejak
kapan; yang membuatnya terlihat cuma satu baris `console.log`.

---

## 8. Sengaja Tidak Dikerjakan

- Tiering & thinking untuk mode SKILL (`_resolveAIProvider`) — di luar scope, sesuai Item 34
- Nilai `reasoning_effort` masih dipatok `'medium'`, belum bisa diatur Owner per slot
- Akar cascade Gemini → Item 38
