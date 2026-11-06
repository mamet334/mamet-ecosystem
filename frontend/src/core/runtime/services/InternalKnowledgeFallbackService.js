
export const TIER2_FALLBACK_TIMEOUT_MS = 20000;

export class InternalKnowledgeFallbackService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    if (this.serviceManager && this.serviceManager.has('EventBus')) {
      this.eventBus = this.serviceManager.get('EventBus');
    }

    this.isInitialized = true;
    console.log('[InternalKnowledgeFallbackService] Initialized & Ready (Tier 2 Active)');
  }

  async buildFallbackContext({ query, tier1Result, traceId, options = {} }) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const sufficiency = tier1Result?.sufficiency ?? 0.0;
    const timestamp = new Date().toISOString();

    if (this.eventBus?.emit) {
      this.eventBus.emit('Retrieval:Tier2Fallback', {
        traceId: traceId || null,
        query: query ? query.substring(0, 100) : '',
        tier1Sufficiency: sufficiency,
        tier1Strategy: tier1Result?.strategy || 'unknown',
        timestamp
      });
    }

    console.log(`[InternalKnowledgeFallbackService] Tier 2 fallback triggered (Tier 1 sufficiency: ${sufficiency}, traceId: ${traceId || 'none'})`);

    const fallbackDirective = `[PANDUAN SISTEM TIER 2 — INTERNAL KNOWLEDGE FALLBACK]:
Tidak ditemukan dokumen atau arsip lokal yang relevan di Knowledge Base (Skor kecukupan Tier 1: ${sufficiency}).
Jawab pertanyaan pengguna menggunakan pengetahuan umum / pengetahuan internal bawaan model Anda.
WAJIB: Sebutkan atau jelaskan secara jujur dan eksplisit bahwa jawaban ini bersumber dari "pengetahuan umum" / "pengetahuan internal model", bukan dari data lokal repositori yang terverifikasi.`;

    const fallbackChunk = {
      content: fallbackDirective,
      source_type: 'llm_internal',
      source_url: null,
      similarity: null,
      retrieved_at: timestamp
    };

    return {
      chunks: [fallbackChunk],
      strategy: 'llm_internal_fallback',
      sufficiency: 0.35,
      tier: 2,
      isFallback: true,
      timeoutMs: TIER2_FALLBACK_TIMEOUT_MS,
      fallbackDisclaimer: '⚠️ Waktu tunggu inferensi habis (Timeout 20s). Sistem tidak dapat memberikan respons dari pengetahuan internal saat ini. Silakan coba kembali atau berikan dokumen referensi ke Knowledge Base.'
    };
  }
}

export default InternalKnowledgeFallbackService;
