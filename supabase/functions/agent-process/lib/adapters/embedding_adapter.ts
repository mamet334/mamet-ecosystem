import { CapabilityAdapter, AdapterContext, AdapterResult } from './capability_adapter.ts';
import { RuntimeContext } from '../runtime_context.ts';

export class GeminiEmbeddingAdapter implements CapabilityAdapter {
  name = 'GeminiEmbeddingAdapter';
  type = 'EMBEDDING' as const;
  private rctx: RuntimeContext;
  private static keyIndex = 0;

  constructor(rctx: RuntimeContext) {
    this.rctx = rctx;
  }

  async initialize() {
    return this.rctx.keys.allGemini.length > 0;
  }

  async execute(input: any, context: AdapterContext): Promise<AdapterResult> {
    const { text } = input;
    const allKeys = this.rctx.keys.allGemini;
    const maxRetries = 2;
    let lastError = 'Unknown error';

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      for (let ki = 0; ki < allKeys.length; ki++) {
        const key = allKeys[(GeminiEmbeddingAdapter.keyIndex + ki) % allKeys.length];
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'models/gemini-embedding-2', content: { parts: [{ text }] } })
          });
          
          if (res.ok) {
            GeminiEmbeddingAdapter.keyIndex = (GeminiEmbeddingAdapter.keyIndex + ki + 1) % allKeys.length;
            const data = await res.json();
            const embedding = data.embedding?.values || [];
            if (embedding.length > 0) {
              return { result: embedding, confidence: 1.0, source: 'gemini_embedding', trace_id: context.trace_id };
            }
          }
          
          const errText = await res.text();
          lastError = `Status ${res.status}: ${errText}`;
        } catch (e: any) {
          lastError = e.message || String(e);
        }
      }
    }

    throw new Error(`Gemini embedding failed. Last error: ${lastError}`);
  }

  async *stream(input: any, context: AdapterContext): AsyncGenerator<string, void, unknown> {
    throw new Error("Stream not supported for embedding adapter");
  }

  async healthCheck() {
    return await this.initialize();
  }

  async shutdown() {}
}

// OpenAIEmbeddingAdapter DIHAPUS 2026-09-10 (Item 62). Ia dulu cadangan Gemini, tapi cadangan
// embedding dari MODEL LAIN tidak pernah bisa benar:
//   - Vektor tiap model hidup di ruang makna sendiri. Vektor kueri OpenAI yang dibandingkan
//     dengan vektor Gemini di database menghasilkan skor kemiripan tanpa arti — menyamakan
//     dimensinya (text-embedding-3-large bisa 3072) hanya mengubah error jujur menjadi hasil
//     pencarian ngawur yang diam.
//   - Ia mematok `dimensions: 768`, sisa era Gemini 768; kolom vektor kini 3072.
//   - OPENAI_API_KEY sistem tidak ada, jadi ia hanya hidup lewat kunci BYOK pengguna yang
//     chat dengan provider openai — embedding internal sistem ditagihkan ke kunci pengguna,
//     bertentangan dengan keputusan Item 51.
// Mengganti model embedding berarti memvektorkan ulang SEMUA baris, bukan menambah cadangan.
