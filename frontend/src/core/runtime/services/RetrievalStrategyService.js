/**
 * RetrievalStrategyService.js — Adaptive Retrieval Strategy (PR#5)
 *
 * Layer retrieval cerdas sebelum context dikirim ke LLM.
 * Mendeteksi otomatis Kasus A (dokumen besar tunggal) vs Kasus B (multi-dokumen)
 * berdasarkan distribusi top-K similarity results.
 *
 * Kasus A (dokumen besar): potongan diteruskan apa adanya. "Neighbor expansion" dan
 *   "full-read" DIHAPUS 2026-09-11 (Item 65) — lihat catatan di _handleCaseA.
 *
 * Kasus B (multi-dokumen):
 *   1. Max N chunk per dokumen — cegah satu sumber mendominasi
 *   2. Diversity-aware — prioritaskan keberagaman sumber
 *
 * Prasyarat: PR#4 (source_type / source_url) agar bisa identifikasi origin chunk.
 *
 * Integrasi: Kernel Phase 3 → AssistantService.processMessage()
 */

// Threshold: jika >60% top-K chunk berasal dari 1 dokumen → Kasus A
const CASE_A_DOMINANCE_THRESHOLD = 0.6;

// Max chunk per dokumen untuk Kasus B (diversity)
const MAX_CHUNKS_PER_DOC_CASE_B = 3;

// PR#9: Ambang batas sufficiency awal untuk transisi antar-tier (starting point: 0.4)
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

  // =============================================
  // CORE: Deteksi kasus dan apply strategi
  // =============================================

  /**
   * Helper: Deteksi apakah query menuntut informasi terkini/temporal/berita yang tidak dapat dipenuhi dokumen statis lokal.
   * @param {string} query
   * @returns {boolean}
   */
  isTemporalOrRecencyQuery(query) {
    if (!query || typeof query !== 'string') return false;
    const TEMPORAL_RECENCY_REGEX = /\b(terbaru|terkini|hari ini|minggu ini|bulan ini|tahun ini|sekarang|saat ini|berita|update|teranyar|latest|recent|currently|current|today|this week|this month|news)\b/i;
    return TEMPORAL_RECENCY_REGEX.test(query);
  }

  /**
   * Entry point utama — panggil setelah similarity search awal.
   *
   * @param {Array} topKChunks - hasil similarity search (array of chunk objects)
   *   Setiap chunk: { id, document_id, content, source_url, source_type, similarity }
   * @param {Object} supabaseClient - Supabase client untuk fallback full-read
   * @param {string} [query=''] - Teks query asli pengguna untuk evaluasi temporal/kontekstual
   * @returns {Promise<{ chunks: Array, strategy: string, caseType: 'A'|'B'|'NONE', sufficiency: number, tier: 1 }>}
   */
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

  /**
   * Hitung skor sufficiency (0.0 – 1.0) untuk hasil retrieval Tier 1.
   * Menggabungkan evaluasi temporal, bobot kelengkapan strategi, dan kualitas kemiripan chunk.
   *
   * @param {Array} chunks
   * @param {string} strategy
   * @param {string} [query='']
   * @returns {number}
   */
  _calculateSufficiency(chunks, strategy, query = '') {
    if (!chunks || chunks.length === 0 || strategy === 'empty') return 0.0;

    // Evaluasi Temporal: Jika query meminta berita/informasi terkini, dokumen lokal statis pasti tidak memadai
    if (this.isTemporalOrRecencyQuery(query)) {
      console.log('[RetrievalStrategy] Temporal/recency intent detected. Dokumen statis lokal tidak memadai untuk berita/fakta terkini.');
      return 0.15; // Jauh di bawah threshold 0.40 agar memicu eskalasi ke Tier 2/3
    }

    // Bobot strategi
    let strategyWeight = 0.55;
    if (strategy === 'case_a_full_read') strategyWeight = 0.95;
    else if (strategy === 'case_a_neighbor_expansion') strategyWeight = 0.85;
    else if (strategy === 'case_b_diversity') strategyWeight = 0.75;
    else if (strategy === 'case_a_passthrough') strategyWeight = 0.65;
    else if (strategy === 'passthrough') strategyWeight = 0.55;

    // Rata-rata similarity
    const similarityScores = chunks
      .map(c => typeof c.similarity === 'number' ? c.similarity : 0.5);
    const avgSimilarity = similarityScores.length > 0
      ? similarityScores.reduce((sum, val) => sum + val, 0) / similarityScores.length
      : 0.5;

    // Gating Relevansi: Jika rata-rata kemiripan rendah (< 0.60), strategi struktural tidak boleh melambungkan skor di atas threshold
    if (avgSimilarity < 0.60) {
      return Number(Math.min(0.35, avgSimilarity * 0.5).toFixed(3));
    }

    // Komposisi: 30% strategi + 70% similarity (mengutamakan relevansi semantik nyata)
    const score = (strategyWeight * 0.3) + (avgSimilarity * 0.7);
    return Number(Math.min(1.0, Math.max(0.0, score)).toFixed(3));
  }

  // =============================================
  // DETEKSI KASUS
  // =============================================

  /**
   * Deteksi Kasus A vs B berdasarkan distribusi document_id.
   * @param {Array} chunks
   * @returns {'A'|'B'|'NONE'}
   */
  _detectCase(chunks) {
    if (chunks.length <= 1) return 'NONE';

    // Hitung frekuensi tiap document_id
    const docFreq = {};
    for (const chunk of chunks) {
      const docId = chunk.document_id || 'unknown';
      docFreq[docId] = (docFreq[docId] || 0) + 1;
    }

    const docIds = Object.keys(docFreq);

    // Hanya 1 dokumen → Kasus A (trivial)
    if (docIds.length === 1) return 'A';

    // Cek apakah ada satu dokumen yang mendominasi
    const maxFreq = Math.max(...Object.values(docFreq));
    const dominanceRatio = maxFreq / chunks.length;

    if (dominanceRatio >= CASE_A_DOMINANCE_THRESHOLD) return 'A';
    return 'B';
  }

  // =============================================
  // KASUS A — Dokumen Besar
  // =============================================

  /**
   * Handle Kasus A: teruskan potongan yang sudah ditemukan, apa adanya.
   *
   * DULU (sampai 2026-09-11, Item 65): "neighbor expansion" mengambil SEMUA potongan dokumen
   * dominan, diurutkan `order('id')` dengan asumsi "id berurutan". Asumsi itu tidak pernah
   * benar — `document_chunks.id` adalah UUID acak dan tabel itu tidak punya kolom urutan —
   * jadi yang terambil bukan tetangga, melainkan SELURUH dokumen dalam urutan acak. Terbukti
   * di Item 64: satu pertanyaan tentang HCDP menyeret 33 potongan, prompt=90116t, $0,0112.
   * "Full-read" (kolom documents.content) dihapus bersamanya.
   *
   * Tetangga yang sebenarnya baru mungkin bila potongan menyimpan nomor urutnya.
   *
   * @param {Array} chunks
   * @returns {Promise<{ chunks: Array, strategy: string }>}
   */
  async _handleCaseA(chunks) {
    return { chunks, strategy: 'case_a_passthrough' };
  }

  // =============================================
  // KASUS B — Multi-dokumen
  // =============================================

  /**
   * Handle Kasus B: max N chunk per dokumen + diversity-aware ordering.
   * @param {Array} chunks
   * @returns {{ chunks: Array, strategy: string }}
   */
  _handleCaseB(chunks) {
    const perDocCount = {};
    const diverse = [];

    // Sort by similarity DESC dulu (jaga kualitas)
    const sorted = [...chunks].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    for (const chunk of sorted) {
      const docId = chunk.document_id || 'unknown';
      const count = perDocCount[docId] || 0;

      if (count < MAX_CHUNKS_PER_DOC_CASE_B) {
        diverse.push(chunk);
        perDocCount[docId] = count + 1;
      }
      // Lewati chunk dari dokumen yang sudah mencapai batas
    }

    console.log(`[RetrievalStrategy] Case B: diversity → ${diverse.length}/${chunks.length} chunks (max ${MAX_CHUNKS_PER_DOC_CASE_B}/doc)`);
    return { chunks: diverse, strategy: 'case_b_diversity' };
  }

  // =============================================
  /**
   * Format array chunks menjadi string context siap dikirim ke LLM.
   * Menyertakan label source_type dan source_url (transparansi sumber PR#4/PR#9).
   *
   * @param {Array} chunks
   * @returns {string}
   */
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
