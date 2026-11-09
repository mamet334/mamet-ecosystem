
import { adalahKueriWaktu } from './kueri_pencarian.js';

const CASE_A_DOMINANCE_THRESHOLD = 0.6;

const MAX_CHUNKS_PER_DOC_CASE_B = 3;

export const SUFFICIENCY_THRESHOLD = 0.4;

export class RetrievalStrategyService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this._initialized = false;
  }

  async initialize() {
    this._initialized = true;
    console.log('[RetrievalStrategyService] Initialized');
  }


  isTemporalOrRecencyQuery(query) {
    return adalahKueriWaktu(query);
  }

  async apply(topKChunks, supabaseClient, query = '') {
    if (!topKChunks || topKChunks.length === 0) {
      return { chunks: [], strategy: 'empty', caseType: 'NONE', sufficiency: 0.0, tier: 1 };
    }

    const caseType = this._detectCase(topKChunks);
    console.log(`[RetrievalStrategy] Detected case: ${caseType} (${topKChunks.length} chunks)`);

    let finalResult;
    if (caseType === 'A') {
      const result = await this._handleCaseA(topKChunks);
      finalResult = { ...result, caseType: 'A' };
    } else if (caseType === 'B') {
      const result = this._handleCaseB(topKChunks);
      finalResult = { ...result, caseType: 'B' };
    } else {
      finalResult = { chunks: topKChunks, strategy: 'passthrough', caseType: 'NONE' };
    }

    const sufficiency = this._calculateSufficiency(finalResult.chunks, finalResult.strategy, query);
    console.log(`[RetrievalStrategy] Tier 1 Sufficiency score: ${sufficiency} (strategy: ${finalResult.strategy})`);

    return {
      ...finalResult,
      sufficiency,
      tier: 1
    };
  }

  _calculateSufficiency(chunks, strategy, query = '') {
    if (!chunks || chunks.length === 0 || strategy === 'empty') return 0.0;

    if (this.isTemporalOrRecencyQuery(query)) {
      console.log('[RetrievalStrategy] Temporal/recency intent detected. Dokumen statis lokal tidak memadai untuk berita/fakta terkini.');
      return 0.15;
    }

    let strategyWeight = 0.55;
    if (strategy === 'case_b_diversity') strategyWeight = 0.75;
    else if (strategy === 'case_a_passthrough') strategyWeight = 0.65;
    else if (strategy === 'passthrough') strategyWeight = 0.55;

    const similarityScores = chunks
      .map(c => typeof c.similarity === 'number' ? c.similarity : 0.5);
    const avgSimilarity = similarityScores.length > 0
      ? similarityScores.reduce((sum, val) => sum + val, 0) / similarityScores.length
      : 0.5;

    if (avgSimilarity < 0.60) {
      return Number(Math.min(0.35, avgSimilarity * 0.5).toFixed(3));
    }

    const score = (strategyWeight * 0.3) + (avgSimilarity * 0.7);
    return Number(Math.min(1.0, Math.max(0.0, score)).toFixed(3));
  }


  _detectCase(chunks) {
    if (chunks.length <= 1) return 'NONE';

    const docFreq = {};
    for (const chunk of chunks) {
      const docId = chunk.document_id || 'unknown';
      docFreq[docId] = (docFreq[docId] || 0) + 1;
    }

    const docIds = Object.keys(docFreq);

    if (docIds.length === 1) return 'A';

    const maxFreq = Math.max(...Object.values(docFreq));
    const dominanceRatio = maxFreq / chunks.length;

    if (dominanceRatio >= CASE_A_DOMINANCE_THRESHOLD) return 'A';
    return 'B';
  }


  async _handleCaseA(chunks) {
    return { chunks, strategy: 'case_a_passthrough' };
  }


  _handleCaseB(chunks) {
    const perDocCount = {};
    const diverse = [];

    const sorted = [...chunks].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    for (const chunk of sorted) {
      const docId = chunk.document_id || 'unknown';
      const count = perDocCount[docId] || 0;

      if (count < MAX_CHUNKS_PER_DOC_CASE_B) {
        diverse.push(chunk);
        perDocCount[docId] = count + 1;
      }
    }

    console.log(`[RetrievalStrategy] Case B: diversity → ${diverse.length}/${chunks.length} chunks (max ${MAX_CHUNKS_PER_DOC_CASE_B}/doc)`);
    return { chunks: diverse, strategy: 'case_b_diversity' };
  }

  formatAsContext(chunks) {
    if (!chunks || chunks.length === 0) return '';

    return chunks.map((chunk, i) => {
      let sourceTag = '';
      const type = chunk.source_type || 'local';

      if (type === 'local') {
        sourceTag = chunk.source_url ? `[Sumber: Lokal — ${chunk.source_url}]` : '[Sumber: Dokumen Lokal]';
      } else if (type === 'llm_internal') {
        sourceTag = '[Sumber: Pengetahuan internal model]';
      } else if (type === 'web') {
        sourceTag = chunk.source_url
          ? `[Sumber: Web — ${chunk.source_url}, akurasi tidak terverifikasi]`
          : '[Sumber: Web — akurasi tidak terverifikasi]';
      } else {
        sourceTag = chunk.source_url ? `[Sumber: ${chunk.source_url}]` : '';
      }

      const fullReadNote = chunk._isFullRead ? ' [Full document read]' : '';
      return `--- Konteks ${i + 1} ${sourceTag}${fullReadNote} ---\n${chunk.content}`;
    }).join('\n\n');
  }
}
