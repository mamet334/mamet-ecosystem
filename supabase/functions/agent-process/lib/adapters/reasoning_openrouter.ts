/**
 * Parameter reasoning untuk OpenRouter — TIGA keadaan, bukan dua.
 *
 *   thinking === true       → reasoning: { enabled: true }   (seperti sebelumnya)
 *   thinking === false      → reasoning: { enabled: false }  (BARU: benar-benar dimatikan)
 *   thinking === undefined  → tidak mengirim apa pun         (bawaan model — mis. mametlite)
 *
 * KENAPA "false" KINI DIKIRIM (2026-09-13):
 * Desain lama (lihat komentar di ai_adapter.ts) sengaja tidak pernah mengirim nilai "mati".
 * Akibatnya terukur di produksi: deepseek/deepseek-v4-flash-0731 di tier SEDANG yang Thinking-nya
 * DIMATIKAN Owner tetap bernalar 1.491 token dalam satu jawaban (13 Sep 2026, 13:03 UTC) — ditagih,
 * dan jawabannya baru selesai 37 detik kemudian. Dokumentasi OpenRouter
 * (openrouter.ai/docs/use-cases/reasoning-tokens, dicek 2026-09-13): model yang mampu bernalar
 * MENYALAKANNYA OTOMATIS bila parameter tidak dikirim; `enabled: false` mematikannya.
 * `enabled: false` pada model ini sudah terbukti bekerja sejak Item 67 (lib/rag/query_rewrite.ts).
 *
 * RISIKO YANG DITANGANI:
 * Sebagian model mewajibkan nalar dan menolak dimatikan — google/gemini-3.5-flash-lite menjawab
 * HTTP 400 "Reasoning is mandatory for this endpoint" (terbukti di Item 67). Untuk kasus itu
 * permintaan DIULANG SEKALI tanpa parameter (perilaku lama), dan nama modelnya diingat selama
 * instans fungsi hidup supaya permintaan berikutnya tidak membuang satu panggilan.
 */

/** Model yang terbukti menolak reasoning dimatikan — diisi saat berjalan, hidup selama instans. */
export const MODEL_WAJIB_NALAR = new Set<string>();

export function badanReasoningOpenRouter(body: Record<string, any>, thinking?: boolean): Record<string, any> {
  if (thinking === true) {
    console.log(`[Thinking] Reasoning dinyalakan untuk provider openrouter, model ${body.model}`);
    return { ...body, reasoning: { enabled: true } };
  }
  if (thinking === false && !MODEL_WAJIB_NALAR.has(String(body.model))) {
    return { ...body, reasoning: { enabled: false } };
  }
  return body;
}

export function ditolakKarenaReasoning(status: number, teks: string): boolean {
  return status === 400 && /reasoning/i.test(teks || '');
}

/**
 * Kirim ke OpenRouter dengan parameter reasoning yang sesuai. Bila reasoning dimatikan lalu model
 * menolaknya (400 yang menyebut "reasoning"), ulangi sekali tanpa parameter.
 * `kirim` menerima body (objek) dan mengembalikan Response — pemanggil yang menyusun fetch-nya.
 */
export async function kirimOpenRouterDenganReasoning(
  body: Record<string, any>,
  thinking: boolean | undefined,
  kirim: (b: Record<string, any>) => Promise<Response>
): Promise<Response> {
  const badan = badanReasoningOpenRouter(body, thinking);
  const res = await kirim(badan);
  if (res.ok || !badan.reasoning || badan.reasoning.enabled !== false || res.status !== 400) return res;

  const teks = await res.clone().text().catch(() => '');
  if (!ditolakKarenaReasoning(res.status, teks)) return res;

  MODEL_WAJIB_NALAR.add(String(body.model));
  console.log(`[Thinking] Model ${body.model} menolak reasoning dimatikan (${teks.slice(0, 120)}) — diulang tanpa parameter, nalar tetap berjalan`);
  return kirim(body);
}
