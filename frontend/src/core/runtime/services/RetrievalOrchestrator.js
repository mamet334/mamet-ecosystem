/**
 * RetrievalOrchestrator.js — Orkestrator Konteks Web & Panduan Tanpa Dokumen (PR#9)
 *
 * - Tier 2: panduan "jawab dari pengetahuan umum" (InternalKnowledgeFallbackService) — hanya saat RAG mati.
 * - Tier 3: pencarian web pembanding (tool web_search / WebComparisonService).
 *
 * Tier 1 (dokumen lokal lewat pencocokan kata KnowledgeService + RetrievalStrategyService) DIHAPUS
 * 2026-09-17 (Item 90): sejak Item 65 dokumen dicari SERVER berdasarkan makna, dan satu-satunya
 * pemanggil (AssistantService) selalu mengirim `skipLocalKnowledge: true` — cabang itu tak pernah jalan.
 * KnowledgeService & RetrievalStrategyService tetap ada: dipakai server sebagai cadangan pencocokan
 * kata bila vektor tak tersedia (agent-process context_builder.ts).
 */

import { InternalKnowledgeFallbackService } from './InternalKnowledgeFallbackService.js';
import { WebComparisonService } from './WebComparisonService.js';

export class RetrievalOrchestrator {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.internalKnowledgeFallbackService = null;
    this.webComparisonService = null;
    this.eventBus = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    if (this.serviceManager) {
      this.eventBus = this.serviceManager.has('EventBus') ? this.serviceManager.get('EventBus') : null;
      this.internalKnowledgeFallbackService = this.serviceManager.has('InternalKnowledgeFallbackService') ? this.serviceManager.get('InternalKnowledgeFallbackService') : null;
      this.webComparisonService = this.serviceManager.has('WebComparisonService') ? this.serviceManager.get('WebComparisonService') : null;
    }

    if (!this.internalKnowledgeFallbackService) {
      this.internalKnowledgeFallbackService = new InternalKnowledgeFallbackService(this.serviceManager);
      await this.internalKnowledgeFallbackService.initialize();
    }

    if (!this.webComparisonService) {
      this.webComparisonService = new WebComparisonService(this.serviceManager);
      await this.webComparisonService.initialize();
    }

    this.isInitialized = true;
    console.log('[RetrievalOrchestrator] Initialized (Tier 2 & Tier 3; dokumen dicari server)');
  }

  /**
   * Helper: Deteksi apakah query menuntut informasi temporal/terkini/berita.
   * @param {string} query
   * @returns {boolean}
   */
  isTemporalQuery(query) {
    if (!query || typeof query !== 'string') return false;
    const TEMPORAL_REGEX = /\b(terbaru|terkini|hari ini|minggu ini|bulan ini|tahun ini|sekarang|saat ini|berita|update|teranyar|latest|recent|currently|current|today|this week|this month|news)\b/i;
    return TEMPORAL_REGEX.test(query);
  }

  /**
   * Main Entry Point: Eksekusi retrieval pengetahuan multi-tier.
   *
   * @param {string} query - Pesan/pertanyaan yang membutuhkan konteks pengetahuan
   * @param {Object} [options]
   * @param {number} [options.limit=5]
   * @param {string} [options.traceId]
   * @param {Object} [options.supabaseClient]
   * @returns {Promise<{
   *   chunks: Array<Object>,
   *   formattedContext: string,
   *   strategy: string,
   *   sufficiency: number,
   *   tier: 1|2|3,
   *   isFallback: boolean,
   *   error?: string
   * }>}
   */
  async retrieve(query, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return {
        chunks: [],
        formattedContext: '',
        strategy: 'empty',
        sufficiency: 0.0,
        tier: 1,
        isFallback: false
      };
    }

    console.log(`[RetrievalOrchestrator] Starting knowledge retrieval for: "${query.substring(0, 60)}..."`);

    // Dokumen tidak dicari di sini (lihat catatan berkas) — Tier 2 menerima hasil "kosong" yang jujur.
    const tier1Result = { chunks: [], strategy: 'dokumen_di_server', sufficiency: 0.0, caseType: 'NONE', tier: 1, isFallback: false };

    // ========================================================
    // TIER 2: INTERNAL LLM FALLBACK (Fase 2)
    // ========================================================

    let tier2Result = null;
    try {
      const fallbackService = this.internalKnowledgeFallbackService || (this.serviceManager?.has('InternalKnowledgeFallbackService') ? this.serviceManager.get('InternalKnowledgeFallbackService') : null);

      // options.skipInternalFallback (Item 65): dokumen dicari di SERVER, bukan di Tier 1 ini.
      // Panduan Tier 2 berbunyi "tidak ditemukan dokumen lokal — jawab dari pengetahuan umum";
      // disisipkan di sini, ia akan membantah dokumen yang ditemukan server.
      if (options.skipInternalFallback) {
        console.log('[RetrievalOrchestrator] Tier 2 dilewati — dokumen ditangani server (skipInternalFallback).');
      } else if (fallbackService && typeof fallbackService.buildFallbackContext === 'function') {
        tier2Result = await fallbackService.buildFallbackContext({
          query,
          tier1Result,
          traceId: options.traceId,
          options
        });
      }
    } catch (tier2Err) {
      console.error('[RetrievalOrchestrator] Tier 2 fallback error:', tier2Err.message);
    }

    // ========================================================
    // TIER 3: WEB SEARCH COMPARISON (Fase 3)
    // Pemicu: options.enableWebComparison === true ATAU options.needWebComparison === true ATAU isTemporalQuery(query)
    // Wajib: Gerbang konfirmasi Owner (Human-in-Command) & Timeout 8s
    // ========================================================
    const shouldTriggerTier3 = Boolean(options.enableWebComparison || options.needWebComparison || this.isTemporalQuery(query));

    if (shouldTriggerTier3) {
      console.log(`[RetrievalOrchestrator] Web comparison requested. Initiating Tier 3 (via ToolRegistryService: web_search)...`);
      try {
        const isTemporal = this.isTemporalQuery(query);
        const tier3Params = {
          query,
          traceId: options.traceId,
          autoConfirm: options.autoConfirmWebSearch || false,
          isTemporal,
          reason: options.webComparisonReason || (isTemporal ? 'Pertanyaan memerlukan berita/informasi terkini yang tidak ada di dokumen lokal.' : 'Konteks lokal belum memadai dan perbandingan web dibutuhkan.')
        };

        // Jalur utama: lewat ToolRegistryService (folder tools/web_search.js) — supaya web
        // search jadi tool yang bisa dipanggil generik, bukan cuma hardcode di sini.
        // Fallback: kalau tool belum/tidak terdaftar (mis. scan folder tools/ gagal), tetap
        // panggil WebComparisonService langsung supaya Tier 3 tidak mati total.
        const toolRegistry = this.serviceManager?.has('ToolRegistryService') ? this.serviceManager.get('ToolRegistryService') : null;
        const hasWebSearchTool = toolRegistry?.getTool?.('web_search');

        let tier3Result;
        if (hasWebSearchTool) {
          tier3Result = await toolRegistry.executeTool('web_search', tier3Params);
        } else {
          console.warn('[RetrievalOrchestrator] Tool "web_search" belum terdaftar di ToolRegistryService — fallback panggil WebComparisonService langsung.');
          const webService = this.webComparisonService || (this.serviceManager?.has('WebComparisonService') ? this.serviceManager.get('WebComparisonService') : null);
          tier3Result = webService && typeof webService.searchWeb === 'function'
            ? await webService.searchWeb(query, tier3Params)
            : null;
        }

        if (tier3Result) {

          // Jika Web Search SUKSES menghasilkan chunks
          if (tier3Result.status === 'SUCCESS' && tier3Result.chunks?.length > 0) {
            const formattedContext = this.formatAsContext(tier3Result.chunks);

            if (this.eventBus?.emit) {
              this.eventBus.emit('Retrieval:Completed', {
                tier: 3,
                strategy: tier3Result.strategy,
                sufficiency: tier3Result.sufficiency,
                chunksCount: tier3Result.chunks.length,
                status: 'SUCCESS'
              });
            }

            return {
              ...tier3Result,
              formattedContext
            };
          }

          // Jika Web Search Ditolak / Timeout / Gagal -> Tetap jujur, sertakan disclaimer di atas Tier 2
          console.warn(`[RetrievalOrchestrator] Tier 3 web search ended with status: ${tier3Result.status}. Falling back to Tier 2 with disclaimer.`);
          const baseTier2Context = tier2Result ? this.formatAsContext(tier2Result.chunks) : '';
          const disclaimerText = tier3Result.fallbackDisclaimer || `⚠️ Pencarian web pembanding gagal (${tier3Result.error || 'Status: ' + tier3Result.status}). Menjawab dari pengetahuan internal model.`;
          const combinedFormattedContext = baseTier2Context ? `${disclaimerText}\n\n${baseTier2Context}` : disclaimerText;

          if (this.eventBus?.emit) {
            this.eventBus.emit('Retrieval:Completed', {
              tier: 3,
              strategy: tier3Result.strategy,
              sufficiency: tier2Result?.sufficiency || 0.0,
              chunksCount: tier2Result?.chunks?.length || 0,
              isFallback: true,
              status: tier3Result.status
            });
          }

          return {
            chunks: tier2Result?.chunks || [],
            formattedContext: combinedFormattedContext,
            strategy: tier3Result.strategy,
            sufficiency: tier2Result?.sufficiency || 0.0,
            tier: 3,
            isFallback: true,
            status: tier3Result.status,
            error: tier3Result.error,
            fallbackDisclaimer: tier3Result.fallbackDisclaimer
          };
        }
      } catch (tier3Err) {
        console.error('[RetrievalOrchestrator] Tier 3 web comparison error:', tier3Err.message);
      }
    }

    // Jika Tier 3 tidak dipicu, kembalikan hasil Tier 2 normal
    if (tier2Result) {
      const formattedContext = this.formatAsContext(tier2Result.chunks);

      if (this.eventBus?.emit) {
        this.eventBus.emit('Retrieval:Completed', {
          tier: 2,
          strategy: tier2Result.strategy,
          sufficiency: tier2Result.sufficiency,
          chunksCount: tier2Result.chunks.length
        });
      }

      return {
        ...tier2Result,
        formattedContext
      };
    }

    // Fallback Darurat jika Tier 2 & Tier 3 gagal
    return {
      chunks: [],
      formattedContext: '',
      strategy: 'fallback_error',
      sufficiency: 0.0,
      tier: 2,
      isFallback: true,
      error: 'Tier 2 & Tier 3 fallback failed'
    };
  }

  /**
   * Helper: Format chunks ke string markdown prompt LLM sesuai PR#9 §3 (atribusi sumber transparan).
   * @param {Array} chunks
   * @returns {string}
   */
  formatAsContext(chunks) {
    if (!chunks || chunks.length === 0) return '';
    return chunks.map((c, i) => {
      const sourceType = c.source_type || 'local';
      let header = `--- Konteks ${i + 1} [Sumber: Lokal — ${c.source_url || 'Arsip Dokumen'}] ---`;

      if (sourceType === 'llm_internal') {
        header = `--- Konteks ${i + 1} [Sumber: Pengetahuan internal model] ---`;
      } else if (sourceType === 'encyclopedia' || c.isStaticEncyclopedia) {
        header = `--- Konteks ${i + 1} [Sumber: Ensiklopedia Statis — ${c.source_url || 'Wikipedia'} (Informasi ensiklopedis statis, BUKAN berita real-time), akurasi tidak terverifikasi] ---`;
      } else if (sourceType === 'web') {
        header = `--- Konteks ${i + 1} [Sumber: Berita Web — ${c.source_url || 'Web Search'}, akurasi tidak terverifikasi] ---`;
      }

      return `${header}\n${c.content}`;
    }).join('\n\n');
  }
}

export default RetrievalOrchestrator;
