
import { InternalKnowledgeFallbackService } from './InternalKnowledgeFallbackService.js';
import { WebComparisonService } from './WebComparisonService.js';
import { adalahKueriWaktu } from '../../../../../shared/kueri_pencarian.js';

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

  isTemporalQuery(query) {
    return adalahKueriWaktu(query);
  }

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

    const tier1Result = { chunks: [], strategy: 'dokumen_di_server', sufficiency: 0.0, caseType: 'NONE', tier: 1, isFallback: false };


    let tier2Result = null;
    try {
      const fallbackService = this.internalKnowledgeFallbackService || (this.serviceManager?.has('InternalKnowledgeFallbackService') ? this.serviceManager.get('InternalKnowledgeFallbackService') : null);

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
            fallbackDisclaimer: tier3Result.fallbackDisclaimer,
            kueriDicari: tier3Result.kueriDicari
          };
        }
      } catch (tier3Err) {
        console.error('[RetrievalOrchestrator] Tier 3 web comparison error:', tier3Err.message);
      }
    }

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
        const terbit = c.terbit ? `terbit ${c.terbit}` : 'tanggal terbit tidak diketahui';
        header = `--- Konteks ${i + 1} [Sumber: Berita Web — ${c.source_url || 'Web Search'}, ${terbit}, akurasi tidak terverifikasi] ---`;
      }

      return `${header}\n${c.content}`;
    }).join('\n\n');
  }
}

export default RetrievalOrchestrator;
