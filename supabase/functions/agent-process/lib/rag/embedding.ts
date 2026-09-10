import { RuntimeContext } from '../runtime_context.ts';
import { CapabilityRegistry } from '../adapters/adapter_registry.ts';

/**
 * Dimensi vektor yang WAJIB dihasilkan embedding.
 *
 * Angkanya ditentukan oleh skema database, bukan sebaliknya: kolom
 * `document_chunks.embedding` bertipe `vector(3072)` dan seluruh 512 chunk yang
 * ada berdimensi 3072 (diverifikasi lewat information_schema + vector_dims pada
 * 2026-09-09). Menyimpan dimensi lain ke kolom itu akan ditolak Postgres.
 *
 * SEBELUMNYA konstanta ini bernilai 768 — sisa era model embedding lama yang tidak
 * ikut dimutakhirkan. Akibatnya generateEmbedding() SELALU mengembalikan array
 * kosong: GeminiEmbeddingAdapter mengembalikan 3072, ditolak penjaga 768, lalu
 * fungsi menyerah tanpa pernah ada yang tahu. Terbukti di log produksi
 * 2026-09-09 03:12 dan 03:33:
 *   [Embedding] Adapter GeminiEmbeddingAdapter returned invalid dimension (expected 768, got 3072).
 *   [Embedding] All embedding adapters failed. Errors:
 * Pencarian vektor lewat context_builder dan pengindeksan dokumen lewat
 * knowledge_manager karenanya mati diam-diam. Lihat Item 39.
 *
 * TIDAK ADA CADANGAN (Item 62, 2026-09-10). Dulu ada fallback OpenAIEmbeddingAdapter
 * (768 dimensi) yang selalu ditolak penjaga ini — dan lolos di request_pipeline.ts yang
 * punya salinan kaskade TANPA penjaga. Fallback itu dihapus, bukan dinaikkan ke 3072:
 * vektor dari model lain tidak sebanding dengan vektor Gemini di database, jadi hasilnya
 * ngawur walau dimensinya cocok. Kalau Gemini gagal, embedding gagal JUJUR (array kosong)
 * dan pemanggil memutuskan: pencarian dilewati, pengindeksan menolak.
 *
 * Fungsi ini satu-satunya pintu embedding di agent-process — jangan buat kaskade kedua.
 * (rag-process memakai getGeminiEmbeddingWithRetry di vector_utils.ts — model yang sama.)
 */
// Diekspor sejak 2026-09-10 (Item 46): penjaga dimensi kedua ternyata tercecer
// di knowledge_manager.ts dengan angka 768 yang di-hardcode terpisah. Selama
// angkanya ditulis ulang di banyak tempat, perbaikan di satu tempat tidak
// menyembuhkan tempat lainnya — dan kegagalannya diam.
export const EMBEDDING_DIMENSIONS = 3072;

export const generateEmbedding = async (text: string, rctx: RuntimeContext): Promise<number[]> => {
  // Ensure adapters are initialized (usually done in Orchestrator, but safe to call)
  await CapabilityRegistry.initializeAdapters(rctx);
  
  const availableAdapters = CapabilityRegistry.getAvailableEmbeddingAdapters(['gemini_embedding']);
  
  if (availableAdapters.length === 0) {
      console.error("[Embedding] No embedding adapters available. Please check your API keys.");
      return [];
  }

  let lastError = '';

  for (const adapter of availableAdapters) {
      try {
          // Provide trace_id if available, fallback to 'unknown'
          const traceId = (rctx?.tasks as any)?.traceId || 'unknown';
          const res = await adapter.execute({ text }, { trace_id: traceId });
          
          if (res.result && Array.isArray(res.result) && res.result.length === EMBEDDING_DIMENSIONS) {
              return res.result;
          } else {
              console.warn(`[Embedding] Adapter ${adapter.name} returned invalid dimension (expected ${EMBEDDING_DIMENSIONS}, got ${res.result?.length}).`);
          }
      } catch(e: any) {
          console.warn(`[Embedding] Adapter ${adapter.name} failed:`, e.message || String(e));
          lastError += `[${adapter.name}]: ${e.message}; `;
      }
  }
  
  console.error(`[Embedding] All embedding adapters failed. Errors: ${lastError}`);
  return [];
};
