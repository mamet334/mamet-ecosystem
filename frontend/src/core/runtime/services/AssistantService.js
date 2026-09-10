/**
 * AssistantService.js — Assistant Brain Mamet AI
 *
 * Peran:
 * - Memproses pesan user (handleSend logic)
 * - Inject memory & semantic context ke payload AI
 * - Memanggil Supabase Edge Function (agent-process) dengan streaming/JSON
 * - Menyimpan dan memuat riwayat chat ke/dari Supabase
 * - Menjadi "rumah arsitektur" resmi untuk PR#1 (CommandRegistry),
 *   PR#2 (CognitiveMemoryGovernor), PR#5 (RetrievalStrategy), PR#6 (TokenEfficiency)
 *
 * Prinsip: Satu file, satu tanggung jawab — tidak ada JSX, tidak ada useState.
 * Komponen React (ConversationEngine) hanya memanggil service ini dan menampilkan hasil.
 *
 * Mengikuti pola engineer.js:
 * - Constructor menerima serviceManager
 * - initialize() async untuk setup
 * - Terdaftar resmi di Kernel.js Phase 3
 */

const AGENT_ENDPOINT = 'https://uuyzdjifhdfyyvpxsofu.supabase.co/functions/v1/agent-process';

import { supabase } from '../../../supabase.js';
import { statusLaptop, kirimKeLaptop, sidikJari, cariDiCache, KUOTA_CACHE_MB } from './remoteConversionClient.js';
import { runDesktopInterceptors } from '../../../components/AIAgent/hooks/useDesktopInterceptor.js';

// PR#2: Import governor dari versi JS lokal (bukan cross-boundary ke lib/ TypeScript)
import {
  runCognitiveMemoryGovernor,
  LEGACY_COGNITION_ENABLED
} from './CognitiveMemoryGovernorService.js';

// PR#6: Token estimator sederhana (~4 chars per token, standar Anthropic/OpenAI approximation)
// Dipakai untuk logging before/after context optimization
function estimateTokens(text = '') {
  return Math.ceil(text.length / 4);
}

// PR#6: Batas maksimal karakter untuk RAG/memory context yang dikirim ke Edge Function
// Cegah bloat — context besar tidak selalu = jawaban lebih baik
const MAX_RAG_CONTEXT_CHARS = 4000;   // ~1000 token
const MAX_SEMANTIC_CONTEXT_CHARS = 2000; // ~500 token

export class AssistantService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this._initialized = false;
  }

  async initialize() {
    this._initialized = true;
    console.log('[AssistantService] Initialized');
  }

  // =============================================
  // MODE RESOLUTION
  // =============================================

  /**
   * Resolusi mode berdasarkan workspaceId aktif.
   * @param {string} workspaceId
   * @returns {{ resolvedMode: string, resolvedAppSource: string }}
   */
  resolveMode(workspaceId) {
    if (workspaceId === 'ws-engineer' || workspaceId === 'ENGINEER') {
      return { resolvedMode: 'ENGINEER', resolvedAppSource: 'engineer' };
    }
    if (workspaceId === 'ws-lite' || workspaceId === 'MAMETLITE' || workspaceId === 'LITE') {
      return { resolvedMode: 'LITE', resolvedAppSource: 'mametlite' };
    }
    return { resolvedMode: 'ASSISTANT', resolvedAppSource: 'assistant' };
  }

  // =============================================
  // FILE PATH EXTRACTION (untuk Engineer mode)
  // =============================================

  /**
   * Extract file path dari pesan user untuk Engineer mode.
   * @param {string} message
   * @returns {string|null}
   */
  extractFilePathFromMessage(message) {
    if (!message) return null;
    const pattern1 = /(?:di\s+)?(?:file|berkas)\s+([a-zA-Z0-9_\-\/\.]+\.(jsx?|tsx?|ts|js))/i;
    const match1 = message.match(pattern1);
    if (match1) return match1[1];

    const pattern2 = /([a-zA-Z0-9_\-\/]+\.(jsx?|tsx?))/g;
    const match2 = message.match(pattern2);
    if (match2 && match2.length > 0) {
      const withSlash = match2.find(m => m.includes('/'));
      return withSlash || match2[0];
    }
    return null;
  }

  // =============================================
  // MEMORY: Store Handler (PR#8 Unification)
  // =============================================

  /**
   * Handle intent MEMORY_STORE dari RequestClassifierService.
   * Menyimpan teks memori bersih ke MemoryGovernorService / MemoryService.
   * @private
   */
  async _handleMemoryStore({ userMsg, contentToStore, category, workspaceId, userId, onDone }) {
    if (!contentToStore || contentToStore.length === 0) {
      onDone?.('⚠️ Konten memori tidak valid atau terlalu pendek.', [], null);
      return;
    }

    const governor = this.serviceManager.has('MemoryGovernorService')
      ? this.serviceManager.get('MemoryGovernorService')
      : null;
    const memoryService = this.serviceManager.get('MemoryService');

    const goldenMeta = {
      source_type: 'assistant_chat',
      // Dulu semua memori chat memakai satu nilai konstan 'assistant_chat_trigger'. Karena
      // detectAndMarkConflict() menganggap "source_reference sama + isi beda + versi tidak
      // berurutan" sebagai konflik, SETIAP fakta baru menendang fakta lama yang sama sekali
      // tidak berhubungan ke CONFLICT_PENDING_REVIEW (mis. "nama panggilan pak slamet"
      // dianggap berbenturan dengan "menyukai clean architecture"). Aturan itu memang
      // dirancang untuk memori turunan file (satu path = satu isi kanonik), bukan untuk
      // fakta chat yang saling independen. Dengan menyertakan kategori, benturan hanya
      // mungkin terjadi antar fakta sejenis.
      source_reference: `assistant_chat:${category || 'general'}`,
      chat_id: workspaceId || null,
      version_code: `AST-${Date.now()}`,
      category: category || 'general',
      useGovernor: true
    };

    try {
      if (governor && userId && typeof governor.storeGoldenMemory === 'function') {
        // Deteksi konflik TIDAK lagi dipanggil di sini (Item 55).
        //
        // Sejak deteksinya berbasis vektor, ia dijalankan di dalam
        // storeGoldenMemory memakai embedding yang memang sudah dihitung di sana.
        // Memanggilnya terpisah berarti dua embedding untuk teks yang sama, dan
        // membuat jalur penyimpanan lain (mis. MemoryService) luput dari
        // pemeriksaan. Satu memori = satu embedding = satu pemeriksaan.
        const stored = await governor.storeGoldenMemory({
          user_id: userId,
          content: contentToStore,
          summary: contentToStore,
          source_type: goldenMeta.source_type,
          source_reference: goldenMeta.source_reference,
          chat_id: goldenMeta.chat_id,
          version_code: goldenMeta.version_code,
          category: goldenMeta.category
        });

        if (stored?._duplicateSkipped) {
          // Jujur: tidak ada yang disimpan. Mengklaim "sudah disimpan" untuk sesuatu yang
          // dilewati adalah over-claiming yang dilarang 24_ANTI_HALLUCINATION_PROTOCOL.
          onDone?.(`ℹ️ Info itu sudah ada di memori saya, jadi tidak saya simpan lagi: "${contentToStore}"`, [], null);
          return;
        }
        if (stored) {
          onDone?.(`✅ Saya telah menyimpan: "${contentToStore}" ke memori (kategori: ${category || 'general'}).`, [], null);
          return;
        }
      } else if (memoryService) {
        const stored = await memoryService.storeMemory(contentToStore, contentToStore, goldenMeta);
        if (stored) {
          onDone?.(`✅ Saya telah menyimpan: "${contentToStore}" ke memori.`, [], null);
          return;
        }
      }
    } catch (err) {
      console.warn('[AssistantService] _handleMemoryStore error:', err);
    }

    onDone?.(`⚠️ Gagal menyimpan ke memori. Silakan coba lagi.`, [], null);
  }

  // =============================================
  // CONTEXT INJECTION: Memory + Semantic
  // =============================================

  /**
   * Bangun localContext (memory) dan semanticContext untuk payload.
   * @param {string} userMsg
   * @param {string} resolvedMode
   * @param {string} userId
   * @returns {Promise<{ localContext: string, semanticContext: string }>}
   */
  async buildContextInjection(userMsg, resolvedMode, userId) {
    let localContext = '';
    let semanticContext = '';

    if (resolvedMode === 'LITE') {
      console.log('[AssistantService] Mode LITE — Memory & Semantic injection dilewati.');
      return { localContext, semanticContext };
    }

    // Cek apakah kueri adalah pertanyaan berita/temporal murni
    const retrievalOrchestrator = this.serviceManager?.get('RetrievalOrchestrator');
    const isTemporal = retrievalOrchestrator?.isTemporalQuery?.(userMsg) || false;

    // Memory injection
    let memoryService = this.serviceManager.get('MemoryService');
    if (!memoryService) {
      await new Promise(r => setTimeout(r, 1000));
      memoryService = this.serviceManager.get('MemoryService');
    }

    if (memoryService) {
      try {
        const memories = await memoryService.getMemory(userMsg);
        if (memories && memories.length > 0) {
          // Jika kueri temporal/berita eksternal, cegah pencemaran kueri dengan memori profil/preferensi personal yang tidak relevan
          const filteredMemories = isTemporal
            ? memories.filter(m => (m.similarity && m.similarity >= 0.8) || m.category === 'knowledge')
            : memories;

          if (filteredMemories.length > 0) {
            localContext = filteredMemories.map(m => m.summary || m.content || '').filter(Boolean).join('\n');
          }
        }
      } catch (e) {
        console.warn('[AssistantService] MemoryService query failed:', e);
      }
    }

    // Semantic context injection
    try {
      const semanticContextService = this.serviceManager.get('SemanticContextService');
      if (semanticContextService && userId) {
        const intentResult = semanticContextService.parseIntent(userMsg);
        if (intentResult.entities && intentResult.entities.length > 0) {
          semanticContextService.updateGraph(userId, intentResult.entities);
          const contextResult = semanticContextService.getContext(userId, userMsg);
          semanticContext = contextResult.context;
        }
      }
    } catch (e) {
      console.warn('[AssistantService] SemanticContextService failed:', e);
    }

    return { localContext, semanticContext };
  }

  // =============================================
  // BUILD REQUEST HEADERS
  // =============================================

  /**
   * Bangun headers untuk fetch ke Edge Function.
   * @param {string} token - Supabase access token
   * @param {string} aiProvider - 'gemini' | 'openai' | 'openrouter' | 'groq'
   * @param {string} aiKey - BYOK key
   * @returns {Object}
   */
  buildHeaders(token, aiProvider, aiKey) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.replace(/[^\x00-\x7F]/g, '')}`
    };

    if (aiKey) {
      const cleanKey = aiKey.replace(/[^\x00-\x7F]/g, '');
      if (aiProvider === 'openrouter') headers['x-byok-openrouter'] = cleanKey;
      else if (aiProvider === 'openai') headers['x-byok-openai'] = cleanKey;
      else if (aiProvider === 'groq') headers['x-byok-groq'] = cleanKey;
      else if (aiProvider === 'gemini') headers['x-byok-gemini'] = cleanKey;
    }

    return headers;
  }

  // =============================================
  // FILE ATTACHMENT: konversi ke base64
  // =============================================

  /**
   * Konversi File object ke payload base64 untuk dikirim ke API.
   * @param {File|null} attachedFile
   * @returns {Promise<Object|null>}
   */
  async buildFileData(attachedFile) {
    if (!attachedFile) return null;
    const buffer = await attachedFile.arrayBuffer();
    const base64String = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    return {
      name: attachedFile.name,
      type: attachedFile.type,
      size: attachedFile.size,
      data: base64String
    };
  }

  // =============================================
  // CORE: processMessage
  // =============================================

  /**
   * Proses pesan user — PR#8: Thin dispatcher (Linux-style).
   * Hanya: resolve mode → memory trigger → classify → dispatch.
   * Logic berat ada di _handleLookup() dan _handleConversation().
   */
  async processMessage({
    userMsg,
    history,
    workspaceId,
    userId,
    token,
    attachedFile = null,
    workspaceManager,
    onChunk,
    onDone,
    onError,
    modelTierOverride = null,
    _isPostHocWebRetry = false,
    _injectedKnowledgeContext = ''
  }) {
    if (!userMsg || !token) {
      onError?.('Pesan atau token tidak tersedia.');
      return;
    }

    console.log('[LIFECYCLE] Chat request sent');

    // 1. Resolve mode
    const { resolvedMode, resolvedAppSource } = this.resolveMode(workspaceId);

    // 2. PR#8: Classify request type (deterministic, 0 LLM cost)
    const classifier = this.serviceManager.has('RequestClassifierService')
      ? this.serviceManager.get('RequestClassifierService')
      : null;
    const classifiedResult = classifier?.classify(userMsg, history, resolvedMode)
      || { type: 'CONVERSATION', metadata: {} };
    const requestType = classifiedResult.type;
    const classifierMeta = classifiedResult.metadata || {};

    // 3. Dispatch ke handler yang sesuai
    const handlerParams = {
      userMsg, history, workspaceId, userId, token,
      attachedFile, workspaceManager, onChunk, onDone, onError,
      resolvedMode, resolvedAppSource, modelTierOverride,
      _isPostHocWebRetry, _injectedKnowledgeContext
    };

    // Dispatch MEMORY_STORE (PR#8 Intent Unification)
    if (requestType === 'MEMORY_STORE') {
      return this._handleMemoryStore({
        ...handlerParams,
        contentToStore: classifierMeta.contentToStore,
        category: classifierMeta.category
      });
    }

    if (requestType === 'DOC_CONVERT') {
      return this._handleDocConvert({ ...handlerParams, direction: classifierMeta.direction });
    }

    if (requestType === 'LOOKUP') {
      return this._handleLookup(handlerParams);
    }

    // Dispatch SKILL → _handleSkill()
    if (requestType === 'SKILL') {
      const skillReg = this.serviceManager.has('SkillRegistry')
        ? this.serviceManager.get('SkillRegistry')
        : null;
      const skill = skillReg?.getSkill(classifierMeta?.skillId);
      if (skill) {
        return this._handleSkill({ ...handlerParams, skill });
      }
      // Fallback ke CONVERSATION jika skill tidak ditemukan
      console.warn(`[processMessage] Skill "${classifierMeta?.skillId}" tidak ditemukan — fallback ke CONVERSATION`);
    }

    // COMMAND, ENGINEER, CONVERSATION → semua lewat ConversationHandler
    // CommandRegistry dipanggil downstream setelah LLM respond (via PR#1 flow)
    return this._handleConversation(handlerParams);
  }

  // =============================================
  // DOC_CONVERT — tool word_to_pdf
  // =============================================

  /**
   * Jalankan konversi dokumen langsung lewat ToolRegistry, tanpa LLM.
   *
   * Sengaja deterministik: perintahnya jelas, dan menyerahkannya ke LLM hanya membuka
   * peluang model MENGAKU sudah mengonversi tanpa berkas apa pun tercipta. Setiap klaim
   * berhasil di sini bersandar pada bukti dari skrip: berkas selesai ditulis dan jumlah
   * halaman PDF sama dengan jumlah halaman menurut Word.
   *
   * @private
   */
  async _handleDocConvert({ direction, attachedFile, workspaceId, onChunk, onDone }) {
    if (direction === 'pdf_to_word') {
      onDone?.(
        'ℹ️ Konversi **PDF → Word** belum tersedia.\n\n' +
        'Word 2007 di komputer ini tidak bisa membuka PDF, dan PDF tidak menyimpan susunan ' +
        'paragraf atau tabel, sehingga hasilnya selalu berupa tebakan. Yang sudah tersedia ' +
        'adalah arah sebaliknya: **Word → PDF**.',
        [], null
      );
      return;
    }

    if (!attachedFile) {
      onDone?.('📎 Lampirkan dulu dokumen Word-nya lewat tombol 📎 di kolom chat, lalu kirim ulang perintahnya.', [], null);
      return;
    }

    const toolPreferences = this.serviceManager.has('ToolPreferencesService')
      ? this.serviceManager.get('ToolPreferencesService')
      : null;
    if (toolPreferences && !toolPreferences.getEffective(workspaceId, 'word_to_pdf')) {
      onDone?.('⚠️ Tool **Word → PDF** sedang dimatikan untuk workspace ini. Aktifkan lewat tombol **Tools** di atas chat.', [], null);
      return;
    }

    // Versi WEB (mamet-ecosystem.vercel.app, termasuk dari HP): tidak ada Word di sini, jadi
    // dokumennya dikirim ke laptop lewat antrian Supabase (Item 57).
    if (typeof window === 'undefined' || typeof window.electronAPI?.wordToPdf !== 'function') {
      return this._handleDocConvertLewatLaptop({ attachedFile, onChunk, onDone });
    }

    const toolRegistry = this.serviceManager.has('ToolRegistryService')
      ? this.serviceManager.get('ToolRegistryService')
      : null;
    if (!toolRegistry?.getTool('word_to_pdf')) {
      onDone?.('⚠️ Tool `word_to_pdf` belum terdaftar. Pastikan berkas `tools/word_to_pdf.js` ada, lalu pindai ulang folder tools.', [], null);
      return;
    }

    const menunggu = `⏳ Mengubah **${attachedFile.name}** ke PDF lewat Microsoft Word...\n\n` +
      '_Dokumen dengan banyak grafik bisa butuh satu sampai beberapa menit. Berkas PDF akan ' +
      'tampak 0 KB selama proses berlangsung — itu normal, jangan dibuka dulu._';
    onChunk?.(menunggu, menunggu, []);

    const hasil = await toolRegistry.executeTool('word_to_pdf', { file: attachedFile });

    if (hasil?.ok) {
      const mb = (hasil.ukuran / (1024 * 1024)).toFixed(1);
      onDone?.(
        `✅ **Selesai.** PDF tersimpan di sebelah dokumen aslinya:\n\n` +
        `\`${hasil.output}\`\n\n` +
        `| | |\n|---|---|\n` +
        `| Halaman | ${hasil.halaman_pdf} (sama dengan di Word) |\n` +
        `| Ukuran | ${mb} MB |\n` +
        `| Waktu | ${hasil.detik} detik |\n` +
        `| Mesin | Microsoft Word ${hasil.word_versi || ''} → Microsoft Print to PDF |\n\n` +
        '_Tautan (hyperlink) di dalam dokumen tidak bisa diklik di PDF hasil cetak._',
        [], { toolsUsed: ['word_to_pdf'], toolExecution: { name: 'word_to_pdf', result: hasil } }
      );
      return;
    }

    // Gagal atau tidak terbukti — sebutkan tahap dan alasannya apa adanya.
    const tahap = {
      platform: 'aplikasi', input: 'berkas', sibuk: 'antrian', printer: 'printer',
      word: 'Microsoft Word', tunggu: 'penulisan PDF', selesai: 'pemeriksaan hasil',
      timeout: 'batas waktu', skrip: 'skrip konversi'
    }[hasil?.stage] || hasil?.stage || 'tidak diketahui';

    let pesan = `❌ **Konversi tidak berhasil** (tahap: ${tahap}).\n\n${hasil?.error || 'Tidak ada keterangan dari skrip.'}`;
    if (hasil?.stage === 'selesai' && hasil?.output) {
      pesan += `\n\nBerkas tetap dibuat di \`${hasil.output}\`, tapi **jangan dianggap benar** sebelum Anda periksa sendiri.`;
    }
    onDone?.(pesan, [], { toolsUsed: ['word_to_pdf'], toolExecution: { name: 'word_to_pdf', result: hasil } });
  }

  /**
   * Word → PDF dari versi web: kirim ke laptop-pekerja lewat antrian Supabase (Item 57).
   * Laptop harus online (aplikasi desktop terbuka); kalau tidak, katakan apa adanya — jangan
   * membuat antrian yang tidak akan dikerjakan siapa pun tanpa memberi tahu pengguna.
   * @private
   */
  async _handleDocConvertLewatLaptop({ attachedFile, onChunk, onDone }) {
    // CACHE DULU (Item 58), SEBELUM memeriksa laptop: dokumen yang isinya pernah dikonversi
    // langsung diberikan — tanpa antre, tanpa Word, dan tetap berhasil walau laptop mati.
    onChunk?.(`🔍 Memeriksa apakah **${attachedFile.name}** pernah dikonversi...`, `🔍 Memeriksa apakah **${attachedFile.name}** pernah dikonversi...`, []);
    let hash = null;
    try {
      hash = await sidikJari(attachedFile);
      const dariCache = await cariDiCache(hash);
      if (dariCache) {
        const r = dariCache.result || {};
        const mb = dariCache.output_size ? (dariCache.output_size / (1024 * 1024)).toFixed(1) : '?';
        const sejak = dariCache.finished_at ? new Date(dariCache.finished_at).toLocaleString('id-ID') : '?';
        onDone?.(
          `⚡ **Diambil dari cache** — isi dokumen ini sama persis dengan yang pernah dikonversi, jadi tidak diproses ulang.\n\n` +
          `| | |\n|---|---|\n` +
          `| Halaman | ${r.halaman_pdf ?? '?'} |\n` +
          `| Ukuran | ${mb} MB |\n` +
          `| Dikonversi | ${sejak} |\n` +
          (dariCache.source_name !== attachedFile.name ? `| Nama saat itu | ${dariCache.source_name} |\n` : '') +
          '\n_Dokumen dikenali dari isinya, bukan namanya. Kalau Anda mengubah isinya, dokumen akan dikonversi ulang._',
          [],
          {
            toolsUsed: ['word_to_pdf'],
            toolExecution: {
              name: 'word_to_pdf',
              result: r,
              cache: true,
              remote: { jobId: dariCache.id, outputPath: dariCache.output_path, sourceName: attachedFile.name }
            }
          }
        );
        return;
      }
    } catch (err) {
      // Cache hanya jalan pintas: gagal di sini tidak boleh menggagalkan konversi.
      console.warn('[AssistantService] Pemeriksaan cache konversi gagal, lanjut ke laptop:', err.message);
    }

    const laptop = await statusLaptop();
    if (!laptop?.online) {
      onDone?.(
        '💻 **Laptop Anda sedang offline.**\n\n' +
        'Konversi Word → PDF dikerjakan oleh Microsoft Word di laptop, jadi laptop harus menyala ' +
        'dan aplikasi desktop Mamet OS harus terbuka.' +
        (laptop ? `\n\n_Terakhir terlihat ${Math.round(laptop.detik_lalu / 60)} menit lalu._` : ''),
        [], null
      );
      return;
    }

    const teks = {
      mengirim: `📤 Mengirim **${attachedFile.name}** ke laptop Anda...`,
      pending: `⏳ **${attachedFile.name}** menunggu diambil laptop...`,
      processing: `⚙️ Laptop sedang mengubah **${attachedFile.name}** ke PDF lewat Microsoft Word...\n\n_Dokumen dengan banyak grafik bisa butuh satu sampai beberapa menit._`
    };
    const hasil = await kirimKeLaptop(attachedFile, (status) => {
      if (teks[status]) onChunk?.(teks[status], teks[status], []);
    }, hash);

    const job = hasil.job;
    if (hasil.ok && job?.output_path) {
      const r = job.result || {};
      const mb = r.ukuran ? (r.ukuran / (1024 * 1024)).toFixed(1) : '?';
      onDone?.(
        `✅ **Selesai.** PDF dibuat oleh laptop Anda dan siap diunduh.\n\n` +
        `| | |\n|---|---|\n` +
        `| Halaman | ${r.halaman_pdf ?? '?'} (sama dengan di Word) |\n` +
        `| Ukuran | ${mb} MB |\n` +
        `| Waktu di laptop | ${r.detik ?? '?'} detik |\n` +
        `| Mesin | Microsoft Word ${r.word_versi || ''} → Microsoft Print to PDF |\n\n` +
        `💾 PDF disimpan di **Riwayat konversi** (tombol di atas chat). Kalau dokumen yang sama dikirim lagi, PDF langsung diberikan tanpa diproses ulang. Penyimpanan dibatasi ${KUOTA_CACHE_MB} MB; bila penuh, yang paling lama tidak dipakai dibuang lebih dulu.\n\n` +
        '_Tautan (hyperlink) di dalam dokumen tidak bisa diklik di PDF hasil cetak._',
        [],
        {
          toolsUsed: ['word_to_pdf'],
          toolExecution: {
            name: 'word_to_pdf',
            result: r,
            remote: { jobId: job.id, outputPath: job.output_path, sourceName: job.source_name }
          }
        }
      );
      return;
    }

    onDone?.(
      `❌ **Konversi tidak berhasil.**\n\n${hasil.error || 'Tidak ada keterangan.'}`,
      [], { toolsUsed: ['word_to_pdf'], toolExecution: { name: 'word_to_pdf', result: job?.result || null, error: hasil.error } }
    );
  }

  // =============================================
  // PR#8 — LOOKUP HANDLER (ringan, cepat, murah)
  // =============================================

  /**
   * Handle pesan tipe LOOKUP — pertanyaan faktual singkat.
   * SKIP: memory retrieval, RAG, semantic context, CMG validation.
   * Hanya: get AI provider → build minimal payload → fetch → handle response.
   *
   * @private
   */
  async _handleLookup({
    userMsg, history, userId, token, workspaceManager,
    resolvedMode, resolvedAppSource, onChunk, onDone, onError
  }) {
    console.log('[AssistantService] PR#8 → _handleLookup (skip memory/RAG/semantic)');

    // Get AI provider config
    // LOOKUP selalu memakai tier KECIL tanpa classifier: jalur ini memang sudah dirancang ringan
    // (tanpa memory/RAG/semantic) dan tidak menuntut penalaran berat — keputusan Owner 2026-09-09.
    let aiProvider = 'gemini';
    let formattedModel = '';
    let aiKey = '';
    let aiThinking = false;
    try {
      const brainService = this.serviceManager.get('BrainService');
      if (brainService) {
        const context = await brainService.getActiveBrainContext('KECIL');
        aiProvider = context.provider || 'gemini';
        formattedModel = context.model || '';
        aiKey = context.key || '';
        aiThinking = context.thinking === true;
        console.log(`[AssistantService] Model tier: KECIL (LOOKUP selalu tier ringan) → ${aiProvider}/${formattedModel || '(default)'}${aiThinking ? ' [thinking: ON]' : ''}`);
      }
    } catch (e) {
      console.warn('[AssistantService] BrainService not available:', e);
    }

    // Payload minimal — tidak ada globalMemory atau semanticContext
    const payload = {
      message: userMsg,
      mode: 'LOOKUP',              // flag ke Edge Function
      appSource: resolvedAppSource,
      workspaceTarget: null,
      history: history.slice(-3),  // hanya 3 pesan terakhir (bukan 10)
      globalMemory: '',            // sengaja kosong — tidak butuh RAG
      semanticContext: '',         // sengaja kosong
      stream: false,
      ragEnabled: false,
      model: formattedModel || undefined,
      thinking: aiThinking || undefined,
      cache_hint: true,
      _request_type: 'LOOKUP'
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    const headers = this.buildHeaders(token, aiProvider, aiKey);

    let response;
    try {
      response = await fetch(AGENT_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload) });
    } catch (fetchErr) {
      onError?.(`Gagal menghubungi server: ${fetchErr.message}`);
      return;
    }

    console.log(`[LIFECYCLE] LOOKUP response received (HTTP ${response.status})`);

    if (!response.ok) {
      let errorText = `HTTP error! status: ${response.status}`;
      try { const e = await response.json(); errorText = e.error || errorText; } catch (_) { errorText = (await response.text()) || errorText; }
      onError?.(`⚠️ Error: ${errorText}`);
      return;
    }

    // Reuse response handler yang sama dengan ConversationHandler
    await this._handleResponseStream(response, { userMsg, isEngineerMode: false, workspaceManager, onChunk, onDone, onError });
  }

  // =============================================
  // PR#8 / Skill Impl — SKILL HANDLER
  // =============================================

  /**
   * Handle pesan tipe SKILL — eksekusi prosedur multi-step yang didefinisikan Owner.
   *
   * Alur:
   * 1. Ambil skill dari SkillRegistry
   * 2. Validasi via SkillGuardService
   * 3. Eksekusi steps berurutan:
   *    - 'ask'      → kirim prompt sebagai pesan AI, tunggu jawaban Owner
   *    - 'generate' → kirim ke Edge Function dengan context dari jawaban sebelumnya
   *    - 'write'    → emit ke CommandRegistry (PR#1 confirmation)
   *    - 'read'     → baca file (stub, dikembangkan berikutnya)
   * 4. Log ke AuditLogService
   *
   * @private
   */
  async _handleSkill({
    skill, userMsg, history, userId, token, workspaceManager,
    resolvedMode, resolvedAppSource, onChunk, onDone, onError
  }) {
    console.log(`[AssistantService] Skill → _handleSkill("${skill.id}")`);

    // 1. Validasi via SkillGuardService
    const guard = this.serviceManager.has('SkillGuardService')
      ? this.serviceManager.get('SkillGuardService')
      : null;

    const validation = guard ? guard.validate(skill) : { allowed: true, stepPolicies: [] };

    if (!validation.allowed) {
      const msg = `⚠️ Skill "${skill.name}" tidak bisa dijalankan: ${validation.reason}`;
      console.warn('[SkillHandler]', msg);
      onDone?.(msg, [], null);
      return;
    }

    this.eventBus.emit('Skill:Started', { skillId: skill.id, skillName: skill.name });
    const startedAt = Date.now();

    // 2. Context yang diakumulasi selama eksekusi multi-step
    const skillContext = {
      skillId: skill.id,
      skillName: skill.name,
      answers: [],    // Jawaban dari Owner untuk step 'ask'
      outputs: [],    // Output generate dari setiap step
      currentStep: 0
    };

    // 3. Eksekusi steps berurutan
    for (let i = 0; i < skill.steps.length; i++) {
      const step = skill.steps[i];
      const stepPolicy = validation.stepPolicies?.[i]?.policy || 'ALLOW';
      skillContext.currentStep = i + 1;

      console.log(`[SkillHandler] Step ${i + 1}/${skill.steps.length}: action=${step.action}`);

      // — STEP: ask — kirim prompt, tunggu jawaban di pesan berikutnya
      if (step.action === 'ask') {
        // Format pesan tanya yang jelas — sertakan progress step
        const askMsg = `**[Skill: ${skill.name} — Langkah ${i + 1}/${skill.steps.length}]**\n\n${step.prompt}`;

        // Simpan jawaban dari history jika sudah ada (multi-turn skill)
        // Untuk sekarang: kirim pertanyaan pertama, berikutnya lewat history
        if (i === 0) {
          // Step pertama: kirim pertanyaan ke Owner
          onDone?.(askMsg, [], null, { isSkillStep: true, skillId: skill.id, stepIndex: i });
          this.eventBus.emit('Skill:StepDone', { skillId: skill.id, step: i + 1, action: 'ask' });
          // Skill multi-turn akan dilanjutkan di pesan berikutnya via history
          // Untuk versi ini, selesaikan skill sampai di sini dan beri tahu Owner
          const continueMsg = `\n\n_Jawab pertanyaan di atas, kemudian saya akan melanjutkan ke langkah berikutnya._`;
          // Simpan state skill ke EventBus untuk dilanjutkan
          this.eventBus.emit('Skill:AwaitingAnswer', {
            skillId: skill.id,
            stepIndex: i,
            remainingSteps: skill.steps.slice(i + 1)
          });
          return;
        } else {
          // Step berikutnya: ambil jawaban dari history terakhir
          const lastUserMsg = history.slice().reverse().find(m => m.role === 'user')?.content || '';
          skillContext.answers.push({ step: i + 1, answer: lastUserMsg });
        }
      }

      // — STEP: generate — kirim ke LLM dengan context terkumpul
      if (step.action === 'generate') {
        // Bangun prompt yang menyertakan semua jawaban yang terkumpul
        let contextSummary = '';
        if (skillContext.answers.length > 0) {
          contextSummary = skillContext.answers
            .map(a => `Jawaban langkah ${a.step}: ${a.answer}`)
            .join('\n');
        }

        const generatePrompt = contextSummary
          ? `${step.prompt}\n\nKonteks dari jawaban sebelumnya:\n${contextSummary}`
          : step.prompt;

        // Kirim ke Edge Function dengan payload minimal
        const { aiProvider, formattedModel, aiKey } = await this._resolveAIProvider();
        const payload = {
          message: generatePrompt,
          mode: resolvedMode || 'STANDARD',
          appSource: resolvedAppSource,
          history: history.slice(-5),
          globalMemory: '',
          semanticContext: '',
          stream: false,
          ragEnabled: false,
          model: formattedModel || undefined,
          cache_hint: true,
          _request_type: 'SKILL',
          _skill_id: skill.id
        };
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

        const headers = this.buildHeaders(token, aiProvider, aiKey);
        let response;
        try {
          response = await fetch(AGENT_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload) });
        } catch (fetchErr) {
          onError?.(`Gagal menghubungi server saat eksekusi skill: ${fetchErr.message}`);
          this.eventBus.emit('Skill:Error', { skillId: skill.id, step: i + 1, reason: fetchErr.message });
          return;
        }

        if (!response.ok) {
          onError?.(`⚠️ Skill error HTTP ${response.status}`);
          this.eventBus.emit('Skill:Error', { skillId: skill.id, step: i + 1, reason: `HTTP ${response.status}` });
          return;
        }

        await this._handleResponseStream(response, {
          userMsg: generatePrompt,
          isEngineerMode: false,
          workspaceManager,
          onChunk,
          onDone,
          onError
        });

        skillContext.outputs.push({ step: i + 1, done: true });
        this.eventBus.emit('Skill:StepDone', { skillId: skill.id, step: i + 1, action: 'generate' });
      }

      // — STEP: write — butuh konfirmasi (PR#1 flow)
      if (step.action === 'write') {
        if (stepPolicy === 'REQUIRE_CONFIRMATION') {
          const confirmMsg = `⚠️ Skill "${skill.name}" ingin menulis file. Konfirmasi diperlukan via CommandRegistry.`;
          onDone?.(confirmMsg, [], null);
          this.eventBus.emit('Skill:StepDone', { skillId: skill.id, step: i + 1, action: 'write', requiresConfirmation: true });
        }
      }

      // — STEP: read — stub (belum implementasi penuh)
      if (step.action === 'read') {
        console.log(`[SkillHandler] Step read — stub, path: ${step.path || '(tidak ada)'}`);
        skillContext.answers.push({ step: i + 1, answer: `[read: ${step.path || 'tidak ada path'}]` });
        this.eventBus.emit('Skill:StepDone', { skillId: skill.id, step: i + 1, action: 'read' });
      }
    }

    // 4. Skill selesai
    const duration = Date.now() - startedAt;
    this.eventBus.emit('Skill:Completed', {
      skillId: skill.id,
      totalSteps: skill.steps.length,
      duration
    });
    console.log(`[SkillHandler] Skill "${skill.id}" selesai dalam ${duration}ms`);

    // 5. Log ke AuditLogService jika tersedia
    const auditLog = this.serviceManager.has('AuditLogService')
      ? this.serviceManager.get('AuditLogService')
      : null;
    if (auditLog) {
      auditLog.log({
        type: 'SKILL_EXECUTED',
        skillId: skill.id,
        skillName: skill.name,
        steps: skill.steps.length,
        duration,
        triggeredBy: userMsg
      });
    }
  }

  /**
   * Helper: resolve AI provider dari BrainService.
   * Dipakai oleh _handleSkill dan _handleLookup.
   * @private
   */
  async _resolveAIProvider() {
    let aiProvider = 'gemini';
    let formattedModel = '';
    let aiKey = '';
    try {
      const brainService = this.serviceManager.get('BrainService');
      if (brainService) {
        const context = await brainService.getActiveBrainContext();
        aiProvider = context.provider || 'gemini';
        formattedModel = context.model || '';
        aiKey = context.key || '';
      }
    } catch (e) {
      console.warn('[AssistantService] BrainService not available:', e);
    }
    return { aiProvider, formattedModel, aiKey };
  }

  // =============================================
  // PR#8 — CONVERSATION HANDLER (alur penuh)
  // =============================================

  /**
   * Handle pesan tipe CONVERSATION/ENGINEER/COMMAND — alur lengkap.
   * Ini adalah logika yang sebelumnya ada di processMessage().
   *
   * @private
   */
  async _handleConversation({
    userMsg, history, workspaceId, userId, token,
    attachedFile, workspaceManager, resolvedMode, resolvedAppSource,
    onChunk, onDone, onError, modelTierOverride = null,
    _isPostHocWebRetry = false, _injectedKnowledgeContext = ''
  }) {
    const isEngineerMode = resolvedMode === 'ENGINEER';
    const isLiteMode = resolvedMode === 'LITE';

    console.log(`[AssistantService] Mode check: workspace=${workspaceId}, resolvedMode=${resolvedMode}`);

    // 3. Get AI provider config dari BrainService
    // Adaptive Model Tiering: tingkat (KECIL/SEDANG/THINKING) ditentukan TierClassifierService
    // secara deterministik (0 biaya token). Engineer dikecualikan sepenuhnya — jalur BYOK-nya
    // tetap memakai model utama (getActiveBrainContext tanpa tier), lihat roadmap §3.
    let aiProvider = 'gemini';
    let formattedModel = '';
    let aiKey = '';
    let aiThinking = false;
    let selectedTier = null;
    let tierReason = '';
    try {
      const brainService = this.serviceManager.get('BrainService');
      if (brainService) {
        if (!isEngineerMode) {
          if (modelTierOverride) {
            // Owner mengunci tingkat lewat pil di kolom chat — classifier dilewati sepenuhnya.
            selectedTier = modelTierOverride;
            tierReason = 'override manual Owner';
          } else {
            const tierClassifier = this.serviceManager.get('TierClassifierService');
            if (tierClassifier) {
              const verdict = tierClassifier.classify(userMsg, history);
              selectedTier = verdict.tier;
              tierReason = verdict.reason;
            }
          }
        }
        const context = await brainService.getActiveBrainContext(selectedTier);
        aiProvider = context.provider || 'gemini';
        formattedModel = context.model || '';
        aiKey = context.key || '';
        aiThinking = context.thinking === true;

        if (selectedTier) {
          // Model ikut dicetak supaya Owner bisa memverifikasi tier benar-benar mengganti model,
          // bukan cuma mengganti label tingkat.
          console.log(`[AssistantService] Model tier: ${selectedTier} (${tierReason}) → ${aiProvider}/${formattedModel || '(default)'}${aiThinking ? ' [thinking: ON]' : ''}`);
        }
      }
    } catch (e) {
      console.warn('[AssistantService] BrainService not available:', e);
    }

    // 4. Inject memory + semantic context
    const { localContext, semanticContext } = await this.buildContextInjection(
      userMsg, resolvedMode, userId
    );

    // 4b. PR#9: 3-Tier Retrieval Orchestrator — ambil knowledge/RAG context (terpisah dari memory)
    // Toggle per-tool (ToolPreferencesService): RAG & Web Search independen. retrieve() tetap
    // dipanggil kalau salah satu nyala; RAG mati diteruskan sebagai skipLocalKnowledge supaya
    // Tier 1 (dokumen lokal) dilewati tapi Tier 3 (web) tetap bisa jalan kalau Web nyala.
    const toolPreferencesService = this.serviceManager?.get('ToolPreferencesService');
    const ragToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'rag') : true;
    const webSearchToolEnabled = toolPreferencesService ? toolPreferencesService.getEffective(workspaceId, 'web_search') : true;

    const requestTraceId = crypto.randomUUID();
    let knowledgeContext = _injectedKnowledgeContext || '';
    const retrievalOrchestrator = this.serviceManager?.get('RetrievalOrchestrator');
    if (!knowledgeContext && retrievalOrchestrator && !isLiteMode && (ragToolEnabled || webSearchToolEnabled)) {
      try {
        const retrievalResult = await retrievalOrchestrator.retrieve(userMsg, {
          userId,
          limit: 5,
          traceId: requestTraceId,
          skipLocalKnowledge: !ragToolEnabled,
          enableWebComparison: webSearchToolEnabled,
          autoConfirmWebSearch: webSearchToolEnabled
        });
        if (retrievalResult && retrievalResult.formattedContext) {
          knowledgeContext = retrievalResult.formattedContext;
          console.log(`[AssistantService] PR#9 RetrievalOrchestrator: Tier ${retrievalResult.tier}, strategy=${retrievalResult.strategy}, sufficiency=${retrievalResult.sufficiency}`);
        }
      } catch (err) {
        console.warn('[AssistantService] RetrievalOrchestrator query error (fallback):', err.message);
      }
    }

    // Gabungkan localContext (Memory) + knowledgeContext (RAG Knowledge & Berita Web)
    // Beri demarkasi tegas agar konteks berita tidak tertukar dengan preferensi personal
    let combinedContext = '';
    if (localContext && knowledgeContext) {
      combinedContext = `[PREFERENSI PERSONAL PENGGUNA (Gunakan hanya jika relevan dengan konteks)]:\n${localContext}\n\n[DOKUMEN PENGETAHUAN & REFERENSI BERITA/WEB]:\n${knowledgeContext}`;
    } else if (knowledgeContext) {
      combinedContext = `[DOKUMEN PENGETAHUAN & REFERENSI BERITA/WEB]:\n${knowledgeContext}`;
    } else if (localContext) {
      combinedContext = localContext;
    }

    let enhancedRagContext = combinedContext;

    // 4c. PR#2: Cognitive Memory Governor — validasi memory sebelum dikirim ke LLM
    if (enhancedRagContext && LEGACY_COGNITION_ENABLED) {
      try {
        const governorResult = runCognitiveMemoryGovernor({
          final_decision_context: { memory: { active: { content: enhancedRagContext } }, confidence_score: 0.8 },
          memory_context: { tgml_nodes: [], conflict_edges: [] },
          truth_score_bundle: null,
          behavior_profile: null,
          global_loop_result: null
        });
        if (governorResult.status === 'REJECT') {
          console.warn('[AssistantService] CMG REJECT — mengirim tanpa memory context');
          enhancedRagContext = '';
        } else if (governorResult.status === 'REWRITE') {
          console.warn('[AssistantService] CMG REWRITE — confidence diturunkan');
        }
      } catch (e) {
        console.warn('[AssistantService] CMG error (skip):', e.message);
      }
    }

    // 5. Build file data
    const fileData = await this.buildFileData(attachedFile);

    // 6. PR#6: Context trimming
    const rawRagLen = (enhancedRagContext || '').length;
    const rawSemLen = (semanticContext || '').length;

    let trimmedRagContext = enhancedRagContext || '';
    if (trimmedRagContext.length > MAX_RAG_CONTEXT_CHARS) {
      trimmedRagContext = trimmedRagContext.slice(0, MAX_RAG_CONTEXT_CHARS) +
        '\n[...konteks RAG dipotong untuk efisiensi token...]';
    }

    let trimmedSemanticContext = semanticContext || '';
    if (trimmedSemanticContext.length > MAX_SEMANTIC_CONTEXT_CHARS) {
      trimmedSemanticContext = trimmedSemanticContext.slice(0, MAX_SEMANTIC_CONTEXT_CHARS) +
        '\n[...konteks semantik dipotong...]';
    }

    const tokensBefore = estimateTokens(enhancedRagContext) + estimateTokens(semanticContext) + estimateTokens(userMsg);
    const tokensAfter  = estimateTokens(trimmedRagContext) + estimateTokens(trimmedSemanticContext) + estimateTokens(userMsg);
    const tokensSaved  = tokensBefore - tokensAfter;
    console.log(`[PR#6 TokenEfficiency] RAG: ${rawRagLen}→${trimmedRagContext.length} chars | Semantic: ${rawSemLen}→${trimmedSemanticContext.length} chars`);
    console.log(`[PR#6 TokenEfficiency] Estimasi token: ${tokensBefore} → ${tokensAfter} (hemat ~${tokensSaved} token)`);

    // 7. Build payload
    const payload = {
      message: userMsg,
      mode: resolvedMode,
      appSource: resolvedAppSource,
      workspaceTarget: workspaceId,
      traceId: requestTraceId,
      history: history.slice(isLiteMode ? -5 : -10),
      globalMemory: trimmedRagContext,
      semanticContext: trimmedSemanticContext,
      stream: false,
      ragEnabled: ragToolEnabled,
      model: formattedModel || undefined,
      thinking: aiThinking || undefined,
      file: fileData || undefined,
      requestedFilePath: isEngineerMode ? this.extractFilePathFromMessage(userMsg) : undefined,
      tools: isLiteMode ? ['rag_search', 'web_search', 'deep_research'] : undefined,
      cache_hint: true,
      _token_meta: { estimated_before: tokensBefore, estimated_after: tokensAfter, saved: tokensSaved },
      _request_type: 'CONVERSATION'
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    // 8. Build headers & fetch
    const headers = this.buildHeaders(token, aiProvider, aiKey);
    let response;
    try {
      response = await fetch(AGENT_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload) });
    } catch (fetchErr) {
      onError?.(`Gagal menghubungi server: ${fetchErr.message}`);
      return;
    }

    console.log(`[LIFECYCLE] LLM response received (HTTP Status: ${response.status})`);

    if (!response.ok) {
      let errorText = `HTTP error! status: ${response.status}`;
      try { const errorData = await response.json(); errorText = errorData.error || errorText; }
      catch (_) { errorText = (await response.text()) || errorText; }
      console.error('[LIFECYCLE] Edge Function Error:', errorText);
      onError?.(`⚠️ Error: ${errorText}`);
      return;
    }

    await this._handleResponseStream(response, {
      userMsg, isEngineerMode, workspaceManager, onChunk, onDone, onError, userId,
      history, workspaceId, token, attachedFile, resolvedMode, resolvedAppSource,
      _isPostHocWebRetry
    });
  }

  // =============================================
  // SHARED — Response Stream Handler
  // =============================================

  /**
   * Handle JSON/streaming response dari Edge Function.
   * Dipakai bersama oleh _handleLookup dan _handleConversation.
   * @private
   */
  async _handleResponseStream(response, {
    userMsg, isEngineerMode, workspaceManager, onChunk, onDone, onError, userId,
    history, workspaceId, token, attachedFile, resolvedMode, resolvedAppSource,
    _isPostHocWebRetry = false
  }) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      console.log('[LIFECYCLE] Received JSON response (DIRECT mode)');
      const jsonData = await response.json();
      const rawContent = typeof (jsonData.message || jsonData) === 'string'
        ? (jsonData.message || jsonData)
        : JSON.stringify(jsonData.message || jsonData);

      const hasPatch = isEngineerMode && rawContent.includes('[MAMET_PATCH_READY]');
      const cleanContent = hasPatch ? rawContent.replace('[MAMET_PATCH_READY]', '').trim() : rawContent;

      onDone?.(cleanContent, jsonData.processingSteps || [], jsonData, { hasPatch, patchOriginalTask: hasPatch ? userMsg : undefined });

      // MAEF Monitor TIDAK lagi dibuka otomatis di sini — dulu tiap respons AI memaksa panel
      // ini terbuka kembali walau Owner baru saja menutupnya (minimize jadi terasa tidak
      // berfungsi). Sekarang murni dikendalikan manual lewat tombol "Monitor" di toolbar chat
      // (ConversationEngine.jsx handleToggleMaefMonitor).

      // Verifikasi integritas memori sesi Assistant (golden source alignment) tepat 1x di akhir turn
      if (userId) {
        await this.finalizeAssistantSession({ userId });
      }
      return;
    }

    // Streaming path
    let reader, decoder;
    try {
      reader = response.body.getReader();
      decoder = new TextDecoder('utf-8');
    } catch (streamErr) {
      console.error('[LIFECYCLE] Failed to get stream reader:', streamErr);
      onError?.('⚠️ Error: Gagal membaca aliran data.');
      return;
    }

    let done = false;
    let aiResponseText = '';
    let processingSteps = [];
    let buffer = '';

    console.log('[LIFECYCLE] Stream started');
    onChunk?.('', '', []);

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.step) processingSteps.push(parsed.step);

              let chunkText = '';
              if (parsed.text) {
                chunkText = parsed.text;
              } else if (parsed.choices?.[0]?.delta?.content) {
                chunkText = parsed.choices[0].delta.content;
              }

              if (chunkText) aiResponseText += chunkText;
              onChunk?.(chunkText, aiResponseText, [...processingSteps]);
            } catch (err) {
              console.error('[LIFECYCLE] Exception during chunk processing:', err);
              aiResponseText += `\n\n[System Error: Gagal memproses aliran data. Root Cause: ${err.message}]`;
              onChunk?.('', aiResponseText, [...processingSteps]);
              done = true;
            }
          }
        }
      }
    }

    console.log('[LIFECYCLE] Stream completed');

    const hasPatch = isEngineerMode && aiResponseText.includes('[MAMET_PATCH_READY]');
    const finalText = hasPatch
      ? aiResponseText.replace('[MAMET_PATCH_READY]', '').trim()
      : aiResponseText;

    onDone?.(finalText, processingSteps, null, {
      hasPatch,
      patchOriginalTask: hasPatch ? userMsg : undefined
    });

    // Post-Hoc Re-Evaluation (PR#9 Fase 3):
    // Jika jawaban LLM mengandung [STATUS: INSUFFICIENT] atau menyatakan tidak tahu/kurang info terkini,
    // eskalasikan konfirmasi Tier 3 Web Comparison ke Owner
    const isInsufficient = /\[STATUS:\s*INSUFFICIENT\]/i.test(finalText) ||
      /\b(saya tidak dapat memberikan informasi terbaru|tidak ditemukan di database.*tidak memiliki informasi|informasi.*tidak cukup.*\[STATUS:\s*INSUFFICIENT\])\b/i.test(finalText);

    if (isInsufficient && !_isPostHocWebRetry && !isEngineerMode) {
      const webService = this.serviceManager?.get('WebComparisonService');
      if (webService && typeof webService.requestConfirmation === 'function') {
        const traceId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        webService.requestConfirmation({
          query: userMsg,
          traceId,
          reason: 'Jawaban model menyatakan informasi tidak mencukupi ([STATUS: INSUFFICIENT]). Ingin mencari pembanding dari web?'
        }).then(async (approved) => {
          if (approved) {
            console.log('[AssistantService] ✅ Owner menyetujui web search post-hoc. Mengambil data web dan memperbarui jawaban...');
            onChunk?.('\n\n_🌐 Mengambil data pembanding dari web..._\n', finalText + '\n\n_🌐 Mengambil data pembanding dari web..._\n', processingSteps);
            const webRes = await webService.searchWeb(userMsg, { autoConfirm: true });
            if (webRes.status === 'SUCCESS' && webRes.chunks?.length > 0) {
              const orchestrator = this.serviceManager?.get('RetrievalOrchestrator');
              const webContext = orchestrator ? orchestrator.formatAsContext(webRes.chunks) : '';
              await this._handleConversation({
                userMsg, history, workspaceId, userId, token,
                attachedFile, workspaceManager, resolvedMode, resolvedAppSource,
                onChunk, onDone, onError,
                _isPostHocWebRetry: true,
                _injectedKnowledgeContext: webContext
              });
            }
          }
        }).catch(e => {
          console.warn('[AssistantService] Post-hoc web confirmation error:', e);
        });
      }
    }

    // Verifikasi integritas memori sesi Assistant (golden source alignment) tepat 1x di akhir turn
    if (userId) {
      await this.finalizeAssistantSession({ userId });
    }

    // OS Execution Interceptor (Electron only)
    await this._runOSInterceptor(finalText, userMsg, workspaceManager, onChunk, onDone, onError);
  }

  // =============================================
  // OS EXECUTION INTERCEPTOR
  // =============================================

  /**
   * Jalankan desktop interceptor setelah AI selesai merespons.
   * Memanfaatkan `runDesktopInterceptors` dari useDesktopInterceptor.js
   * yang sudah ada — tidak duplikasi logika.
   *
   * @private
   */
  async _runOSInterceptor(finalAiResponseText, originalUserMsg, workspaceManager, onChunk, onDone, onError) {
    if (!window.electronAPI) return;

    // Ambil osState dari workspaceManager jika tersedia
    const osState = workspaceManager?.osState;
    if (!osState?.capabilities?.includes('cap:code-execution')) return;

    try {
      const { interceptHit, autoReply } = await runDesktopInterceptors(finalAiResponseText);

      if (interceptHit && autoReply) {
        // Feed output kembali ke AI setelah 1 detik
        setTimeout(() => {
          this.processMessage({
            userMsg: `[OS EXECUTION REPORT]\nBerikut adalah hasil eksekusi dari tindakan otomatis Anda di sistem operasi lokal user.\n${autoReply}`,
            history: [],
            workspaceId: workspaceManager?.activeWorkspaceId || 'ws-assistant',
            userId: null,
            token: '',
            attachedFile: null,
            workspaceManager,
            onChunk,
            onDone,
            onError
          });
        }, 1000);
      }
    } catch (e) {
      console.warn('[AssistantService] OS Interceptor import failed:', e);
    }
  }

  // =============================================
  // CHAT PERSISTENCE
  // =============================================

  /**
   * Simpan riwayat chat ke Supabase.
   * @param {Object} params
   * @param {Array}  params.messages
   * @param {string|null} params.chatId - null untuk INSERT baru
   * @param {string} params.userId
   * @param {string} params.workspaceId
   * @param {Function} params.onNewChatId - callback(newId) saat INSERT berhasil
   * @returns {Promise<void>}
   */
  async saveChatToDB({ messages, chatId, userId, workspaceId, onNewChatId }) {
    if (!messages || messages.length === 0) return;
    if (!userId) return;

    // Gunakan supabase client statis
    const title = messages[0]?.content?.substring(0, 50) || 'Percakapan Baru';
    const payload = {
      user_id: userId,
      title,
      messages,
      updated_at: new Date().toISOString(),
      workspace_type: workspaceId || 'ws-assistant'
    };

    let result;
    let finalChatId = chatId;
    if (chatId) {
      result = await supabase.from('chats').update(payload).eq('id', chatId);
    } else {
      result = await supabase.from('chats').insert(payload).select('id').single();
      if (result.data?.id) {
        finalChatId = result.data.id;
        onNewChatId?.(finalChatId);
      }
    }

    if (result?.error) {
      console.error('[AssistantService] Gagal menyimpan chat:', result.error);
      return;
    }

    // [FIX: ChatHistory realtime] Pancarkan event Chat:Updated via EventBus agar
    // ChatHistory.jsx langsung memanggil fetchChats() tanpa mengandalkan
    // window.addEventListener('storage') yang hanya berfungsi antar-tab/jendela.
    try {
      const eventBus = this.serviceManager?.get('EventBus');
      if (eventBus && finalChatId) {
        eventBus.emit('Chat:Updated', { chatId: finalChatId, workspaceId: workspaceId || 'ws-assistant', title });
      }
    } catch (e) {
      // EventBus opsional — jangan gagalkan operasi save jika emit gagal
      console.warn('[AssistantService] Gagal emit Chat:Updated:', e.message);
    }
  }

  /**
   * Finalisasi sesi Assistant: memverifikasi integritas golden memory yang disimpan selama sesi.
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} [params.chatId]
   * @returns {Promise<Object|null>}
   */
  async finalizeAssistantSession({ userId, chatId }) {
    try {
      const governor = this.serviceManager.has('MemoryGovernorService')
        ? this.serviceManager.get('MemoryGovernorService')
        : null;

      if (governor && typeof governor.verifyAssistantSession === 'function' && userId) {
        const res = await governor.verifyAssistantSession({ userId, chatId });
        console.log('[AssistantService] Sesi Assistant difinalisasi:', res);
        return res;
      }
    } catch (e) {
      console.warn('[AssistantService] Finalisasi sesi error:', e.message);
    }
    return null;
  }

  /**
   * Muat riwayat chat dari Supabase.
   * @param {string} chatId
   * @returns {Promise<Array|null>} - array messages atau null jika tidak ditemukan
   */
  async loadChat(chatId) {
    if (!chatId) return null;
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (error) {
      console.error('[AssistantService] loadChat error:', error);
      return null;
    }
    return data?.messages || [];
  }

  // =============================================
  // ENGINEER COMMAND (PR#1 integration point)
  // =============================================

  /**
   * Jalankan command dari Engineer mode melalui CommandRegistry (PR#1).
   * Whitelist-first: hanya command terdaftar yang bisa dieksekusi.
   *
   * @param {string} commandName - nama command dari CommandRegistry (atau raw cmd untuk legacy)
   * @param {Object} args        - { path, content, sourcePath, targetPath, ... }
   * @param {Object} [context]   - { userMsg, userId } untuk audit log
   * @returns {Promise<{ output: string, success: boolean, needsConfirmation?: boolean, confirmationReason?: string }>}
   */
  async runCommand(commandName, args = {}, context = {}) {
    const commandRegistry = this.serviceManager.get('CommandRegistry');
    const auditLogService = this.serviceManager.get('AuditLogService');

    // Fallback: jika CommandRegistry belum siap (boot timing), pakai electronAPI langsung
    if (!commandRegistry) {
      console.warn('[AssistantService] CommandRegistry tidak tersedia, fallback ke electronAPI langsung');
      return this._runCommandLegacy(commandName, context);
    }

    // 1. Prepare: cek whitelist + boundary
    const preparation = commandRegistry.prepareExecution(commandName, args);

    if (!preparation.canProceed) {
      // Command tidak ada di whitelist — tolak
      return { output: preparation.reason, success: false };
    }

    if (preparation.needsConfirmation) {
      // Emit ke EventBus — UI yang menampilkan dialog, bukan service
      // Setelah user konfirmasi, UI memanggil assistantService.confirmAndRunCommand()
      const eventBus = this.serviceManager.get('EventBus');
      if (eventBus) {
        eventBus.emit('Command:ConfirmationRequired', {
          commandName,
          args,
          isDestructive: preparation.isDestructive,
          inWorkspace: preparation.inWorkspace,
          reason: preparation.reason,
          context
        });
      }
      return {
        output: '',
        success: false,
        needsConfirmation: true,
        isDestructive: preparation.isDestructive,
        inWorkspace: preparation.inWorkspace,
        confirmationReason: preparation.reason,
        _pendingCommand: { commandName, args }
      };
    }

    // 2. Eksekusi langsung (tidak perlu konfirmasi)
    return this._executeAndLog({ commandName, args, preparation, context, commandRegistry, auditLogService });
  }

  /**
   * Eksekusi command setelah konfirmasi user (dipanggil dari UI).
   *
   * @param {string} commandName
   * @param {Object} args
   * @param {Object} [context] - { userMsg, userId }
   * @returns {Promise<{ output: string, success: boolean }>}
   */
  async confirmAndRunCommand(commandName, args = {}, context = {}) {
    const commandRegistry = this.serviceManager.get('CommandRegistry');
    const auditLogService = this.serviceManager.get('AuditLogService');

    if (!commandRegistry) {
      return this._runCommandLegacy(commandName, context);
    }

    const preparation = commandRegistry.prepareExecution(commandName, args);
    return this._executeAndLog({ commandName, args, preparation, context, commandRegistry, auditLogService });
  }

  /**
   * @private Eksekusi + log audit.
   */
  async _executeAndLog({ commandName, args, preparation, context, commandRegistry, auditLogService }) {
    const result = await commandRegistry.executeConfirmed(commandName, args);

    // Audit log (async, tidak blocking)
    auditLogService?.logCommand({
      userMsg:      context.userMsg    || '',
      commandName,
      targetPath:   args.path || args.targetPath || '',
      inWorkspace:  preparation.inWorkspace  ?? true,
      isDestructive: preparation.isDestructive ?? false,
      success:      result.success,
      output:       result.output || result.error || '',
      userId:       context.userId || null
    }).catch(err => console.warn('[AssistantService] Audit log gagal:', err));

    // Emit audit trail ke Engineer SessionArtifact
    try {
      const eventBus = this.serviceManager.get('EventBus');
      eventBus?.emit('Engineer:CommandExecuted', {
        command: commandName,
        status: result.success ? 'success' : 'error',
        output: result.output || result.error || ''
      });
    } catch (_) {}

    return { output: result.output || result.error || '', success: result.success };
  }

  /**
   * @private Fallback ke electronAPI langsung (backward compat saat boot).
   */
  async _runCommandLegacy(rawCmd, context = {}) {
    if (!window.electronAPI) {
      return { output: 'Electron API tidak tersedia (bukan desktop mode).', success: false };
    }
    try {
      const result = await window.electronAPI.runTerminalCommand(rawCmd);
      const output = result?.output || result?.error || 'Command selesai (tidak ada output).';
      const success = !!result?.success;
      try {
        const eventBus = this.serviceManager.get('EventBus');
        eventBus?.emit('Engineer:CommandExecuted', { command: rawCmd, status: success ? 'success' : 'error', output });
      } catch (_) {}
      return { output, success };
    } catch (err) {
      return { output: err?.message || String(err), success: false };
    }
  }

  /**
   * Rollback patch via git stash.
   * @param {string|null} checkpointRef
   * @returns {Promise<{ success: boolean, output?: string, error?: string, cancelled?: boolean }>}
   */
  async rollback(checkpointRef) {
    if (!window.electronAPI?.gitRollback) {
      return { success: false, error: 'Rollback tidak tersedia (bukan desktop mode).' };
    }
    try {
      const result = await window.electronAPI.gitRollback(checkpointRef);
      return result;
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Refresh memory untuk query tertentu.
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async refreshMemory(query) {
    const memoryService = this.serviceManager.get('MemoryService');
    if (!memoryService || !query) return [];
    try {
      return await memoryService.getMemory(query) || [];
    } catch (err) {
      console.warn('[AssistantService] refreshMemory gagal:', err);
      return [];
    }
  }
}
