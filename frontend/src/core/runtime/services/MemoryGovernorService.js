import { supabase } from '../../../supabase.js';

/**
 * MemoryGovernorService — Anti-Bias & Memory Maintenance (Fase 1)
 *
 * Tujuan:
 * - Mencegah AI menjadi bias akibat "ringkasan dari ringkasan".
 * - Golden Source: Data mentah (raw content) disimpan di tabel terpisah
 *   (`raw_memory_content`). Ringkasan hanya pointer/metadata ke raw content.
 * - Verifikasi Otomatis: Saat sesi Engineering berakhir, membandingkan ringkasan
 *   lama dengan raw content. Jika file/konteks asli berubah, panggil AI murah
 *   untuk membuat ulang ringkasan.
 * - Metadata Wajib: Setiap memori/ringkasan memiliki tag:
 *   `source_reference`, `timestamp`, `version_code`, `chat_id`.
 *
 * Backward Compatibility:
 * - Semua kolom baru di `user_memories` nullable → data lama tanpa metadata
 *   tetap berfungsi dan tidak crash.
 * - `raw_content_id` null ditangani dengan fallback regenerasi langsung.
 */
export class MemoryGovernorService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.eventBus.emit('MemoryGovernor:Ready', { status: 'READY', timestamp: Date.now() });
    console.log('[MemoryGovernorService] Initialized and Ready');
  }

  /**
   * Meminta vektor embedding ke `agent-process` untuk sebuah teks.
   *
   * KENAPA LEWAT SERVER (Item 46, 2026-09-10)
   * Sampai hari ini `storeGoldenMemory` menyimpan memori TANPA embedding, dan
   * karena kolomnya nullable, Postgres menerimanya tanpa protes. Akibatnya
   * `match_memories` tidak pernah bisa menemukan apa pun — pencarian memori
   * berbasis makna tidak pernah hidup sejak awal.
   *
   * Embedding dibuat di server, bukan di sini, supaya model dan dimensi vektor
   * ditentukan di SATU tempat saja. Menghitungnya di klien berarti menyalin
   * logika provider ke frontend — itu yang dulu membuat penjaga dimensi 768
   * tercecer di dua berkas dan bertahan berbulan-bulan tanpa ketahuan.
   * Sejak Item 63–65 embedding dibayar pengguna: kunci OpenRouter dari Vault
   * dikirim sebagai header x-byok-openrouter; tanpanya server menjawab gagal.
   *
   * GAGAL-LUNAK, TAPI BERSUARA. Kalau embedding gagal, memorinya TETAP
   * disimpan — memori tanpa vektor masih ditemukan lewat pencarian SQL (Tahap 1,
   * Item 36), jadi menolak menyimpan justru merugikan. Yang tidak boleh adalah
   * gagal dalam diam, maka kegagalannya dicatat keras dan dipancarkan sebagai
   * event supaya bisa dihitung.
   *
   * @param {string} text - teks yang akan divektorkan
   * @returns {Promise<number[]|null>} vektor, atau null bila gagal
   */
  async _requestEmbedding(text) {
    if (!text || !text.trim()) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('[MemoryGovernorService] Embedding dilewati — tidak ada sesi aktif.');
        return null;
      }

      let kunciOpenRouter = '';
      try {
        const vault = this.serviceManager?.has('VaultService') ? this.serviceManager.get('VaultService') : null;
        kunciOpenRouter = (vault?.getKey('openrouter') || '').replace(/[^\x00-\x7F]/g, '');
      } catch {
        // Vault belum siap — server akan menjawab EMBEDDING_FAILED.
      }

      const { data, error } = await supabase.functions.invoke('agent-process', {
        body: { action: 'embed', text: text.substring(0, 8000) },
        headers: kunciOpenRouter ? { 'x-byok-openrouter': kunciOpenRouter } : {}
      });

      if (error) {
        // Alasan sebenarnya ada di body jawaban (Item 64), bukan di error.message yang umum.
        let pesan = error.message;
        try {
          const isi = await error.context?.json?.();
          if (isi?.message || isi?.error) pesan = isi.message || isi.error;
        } catch {
          // Body bukan JSON.
        }
        throw new Error(pesan);
      }
      // Endpoint menjawab 502 dengan { error } saat semua adapter gagal;
      // supabase-js tidak selalu melemparnya, jadi diperiksa sendiri.
      if (data?.error) throw new Error(data.message || data.error);

      const vektor = data?.embedding;
      if (!Array.isArray(vektor) || vektor.length === 0) {
        throw new Error('Endpoint menjawab tanpa vektor yang sah.');
      }

      console.log(`[MemoryGovernorService] Embedding didapat: ${vektor.length} dimensi.`);
      return vektor;
    } catch (err) {
      console.error(
        '[MemoryGovernorService] ⚠️ Gagal membuat embedding — memori tetap disimpan ' +
        'tetapi TIDAK akan bisa dicari berdasarkan makna. Sebab: ' + err.message
      );
      this.eventBus?.emit('MemoryGovernor:EmbeddingFailed', {
        reason: err.message,
        timestamp: new Date().toISOString()
      });
      return null;
    }
  }

  /**
   * Mengisi embedding untuk memori lama yang tersimpan sebelum vektorisasi ada.
   *
   * Item 46 mencatat ini sebagai pekerjaan terpisah, dan memang seharusnya
   * terpisah: memperbaiki jalur maju dan mengisi ulang data lama adalah dua
   * risiko yang berbeda. Jalur majunya dibuktikan lebih dulu (2026-09-10,
   * `match_memories` mengembalikan similarity 1,0 untuk memori pertama yang
   * bervektor) — baru sesudah itu pengisian ini layak dijalankan.
   *
   * Aman dijalankan berulang: hanya menyentuh baris yang `embedding`-nya NULL.
   *
   * Dijalankan manual dari konsol:
   *   await window.__mamet.serviceManager.get('MemoryGovernorService').backfillMissingEmbeddings()
   *
   * @param {number} batas - maksimal baris yang diproses dalam satu panggilan
   * @returns {Promise<{diperiksa:number, berhasil:number, gagal:number}>}
   */
  async backfillMissingEmbeddings(batas = 50) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Tidak ada sesi aktif — masuk dulu.');

    const { data: rows, error } = await supabase
      .from('user_memories')
      .select('id, summary')
      .eq('user_id', session.user.id)
      .is('embedding', null)
      .limit(batas);

    if (error) throw new Error('Gagal membaca memori: ' + error.message);
    if (!rows || rows.length === 0) {
      console.log('[Backfill] Tidak ada memori tanpa embedding. Tidak ada yang dikerjakan.');
      return { diperiksa: 0, berhasil: 0, gagal: 0 };
    }

    console.log(`[Backfill] ${rows.length} memori tanpa embedding ditemukan. Mulai...`);
    let berhasil = 0;
    let gagal = 0;

    for (const row of rows) {
      // Yang divektorkan HARUS `summary`, sama seperti di storeGoldenMemory —
      // kalau berbeda, memori lama dan memori baru akan hidup di ruang vektor
      // yang tidak sebanding dan kecocokannya meleset tanpa sebab yang terlihat.
      const vektor = await this._requestEmbedding(row.summary);
      if (!vektor) {
        gagal++;
        console.warn(`[Backfill] ✗ ${row.id} — gagal divektorkan, dilewati.`);
        continue;
      }

      const { error: updateError } = await supabase
        .from('user_memories')
        .update({ embedding: vektor })
        .eq('id', row.id);

      if (updateError) {
        gagal++;
        console.warn(`[Backfill] ✗ ${row.id} — gagal disimpan: ${updateError.message}`);
      } else {
        berhasil++;
        console.log(`[Backfill] ✓ ${row.id} — "${(row.summary || '').substring(0, 40)}"`);
      }

      // Jeda kecil untuk menghormati batas laju penyedia embedding, sama
      // alasannya dengan jeda 600ms di rag-process.
      await new Promise(r => setTimeout(r, 400));
    }

    // Dilaporkan apa adanya, termasuk yang gagal. Melaporkan "selesai" tanpa
    // menyebut kegagalan adalah pola yang justru sedang diperbaiki Item 46.
    console.log(`[Backfill] Selesai — ${berhasil} berhasil, ${gagal} gagal, dari ${rows.length} diperiksa.`);
    this.eventBus?.emit('MemoryGovernor:BackfillDone', { diperiksa: rows.length, berhasil, gagal });
    return { diperiksa: rows.length, berhasil, gagal };
  }

  /**
   * Menghasilkan hash sederhana dari sebuah string (deterministik).
   * Digunakan untuk membandingkan apakah raw content berubah.
   * @param {string} content
   * @returns {string} hash 32-hex
   */
  _computeHash(content) {
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    // Return hex (deterministic)
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Mendapatkan BrainService untuk memanggil AI murah (regenerasi ringkasan).
   * @returns {Object|null} BrainService instance
   */
  _getBrainService() {
    try {
      return this.serviceManager.has('BrainService')
        ? this.serviceManager.get('BrainService')
        : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Menyimpan Golden Memory: raw content ke `raw_memory_content` + ringkasan
   * ke `user_memories` (dengan metadata golden source).
   *
   * @param {Object} params
   * @param {string} params.user_id
   * @param {string} params.content     - Raw content (golden source)
   * @param {string} [params.summary]   - Ringkasan (opsional, default dari content)
   * @param {string} [params.source_type] - 'fact' | 'preference' | 'location' | 'engineer_session' | 'assistant_chat'
   * @param {string} [params.source_reference] - Reference ke file/sumber asli
   * @param {string} [params.chat_id]   - Chat ID terkait
   * @param {string} [params.version_code] - Kode versi
   * @param {string} [params.category='general'] - Kategori memori ('general' | 'engineering' | 'preference')
   * @param {'generic'|'sensitive'} [params.access_tier] - Access tier (auto-detect fallback: 'generic')
   * @param {'active'|'archived'|'pending_purge'|'CONFLICT_PENDING_REVIEW'} [params.status='active'] - Status lifecycle
   * @param {number} [params.version_sequence=1] - Nomor urutan versi
   * @returns {Promise<Object|null>} inserted memory row atau null
   */
  async storeGoldenMemory({
    user_id,
    content,
    summary,
    source_type = 'fact',
    source_reference,
    chat_id,
    version_code,
    category = 'general',
    access_tier,
    status = 'active',
    version_sequence = 1
  }) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');
    if (!user_id) throw new Error('MemoryGovernorService: user_id required');
    if (!content) throw new Error('MemoryGovernorService: content required');

    const contentHash = this._computeHash(content);
    const resolvedSummary = summary || (typeof content === 'string' ? content.substring(0, 500) : JSON.stringify(content));

    // Auto-detect access tier jika tidak dikirim eksplisit
    let resolvedAccessTier = access_tier;
    if (!resolvedAccessTier) {
      const contentStr = (typeof content === 'string' ? content : JSON.stringify(content)).toLowerCase();
      const hasSensitivePattern = /password|token|secret|api[_-]?key|kredensial|credential|bearer|private[_-]?key/i.test(contentStr);
      resolvedAccessTier = hasSensitivePattern ? 'sensitive' : 'generic';
    }

    try {
      // 0. GUARD DUPLIKAT — sebelumnya tidak ada sama sekali: isi yang identik selalu jadi baris
      // baru. detectAndMarkConflict() pun tidak menangkapnya karena justru mensyaratkan isi
      // BERBEDA (existingHash !== newHash). Akibatnya fakta yang diberitahukan Owner berulang
      // kali menumpuk sebagai salinan identik, dan tiap salinan ikut disuntikkan ke prompt di
      // setiap permintaan — token terbuang untuk kalimat yang sama.
      // Dicek langsung ke kolom `summary` di user_memories, TANPA join ke raw_memory_content:
      // kedua tabel itu tidak punya foreign key (satu-satunya FK user_memories mengarah ke
      // knowledge_spaces), sehingga embed PostgREST akan gagal — dan gagalnya senyap. Lagipula
      // `summary` justru kolom yang benar-benar disuntikkan ke prompt, jadi itu yang relevan.
      const { data: duplicates, error: duplicateError } = await supabase
        .from('user_memories')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .eq('summary', resolvedSummary)
        .limit(1);

      if (duplicateError) {
        console.warn('[MemoryGovernorService] Cek duplikat gagal, lanjut menyimpan:', duplicateError.message);
      } else if (duplicates && duplicates.length > 0) {
        const existingMemory = duplicates[0];
        console.log(`[MemoryGovernorService] Duplikat dilewati — memori aktif dengan isi identik sudah ada (id: ${existingMemory.id})`);
        this.eventBus?.emit('MemoryGovernor:DuplicateSkipped', {
          existingMemoryId: existingMemory.id,
          contentHash,
          timestamp: new Date().toISOString()
        });
        // Bentuk kembalian tetap baris memori (sama seperti jalur normal) supaya kontraknya
        // konsisten, ditambah penanda supaya pemanggil bisa memberi tahu Owner dengan jujur
        // bahwa tidak ada penyimpanan baru — bukan mengklaim "sudah disimpan".
        return { ...existingMemory, _duplicateSkipped: true };
      }

      // 1. INSERT raw content ke tabel golden source
      const { data: rawRow, error: rawError } = await supabase
        .from('raw_memory_content')
        .insert([{
          user_id,
          content: typeof content === 'object' ? JSON.stringify(content) : content,
          content_hash: contentHash,
          source_type,
          source_reference: source_reference || null,
          chat_id: chat_id || null,
          version_code: version_code || null
        }])
        .select('id')
        .single();

      if (rawError) {
        console.error('[MemoryGovernorService] Gagal menyimpan raw content:', rawError.message);
        return null;
      }

      // 1b. Vektorkan ringkasannya (Item 46).
      //
      // Yang divektorkan adalah `summary`, BUKAN `content` mentah — karena
      // `summary` pula yang disuntikkan ke prompt dan yang dibandingkan oleh
      // `match_memories`. Memvektorkan teks yang berbeda dari teks yang dicari
      // akan menghasilkan kecocokan yang meleset tanpa ada yang tahu sebabnya.
      const embedding = await this._requestEmbedding(resolvedSummary);

      // 1c. Deteksi konflik — memakai ULANG vektor di atas (Item 55).
      //
      // Dulu dipanggil terpisah dari AssistantService SEBELUM fungsi ini. Sejak
      // deteksinya berbasis vektor, memanggilnya di sana berarti menghitung
      // embedding dua kali untuk teks yang sama. Ditaruh di sini supaya satu
      // memori = satu embedding, dan supaya SETIAP jalur yang menyimpan memori
      // golden ikut terperiksa — bukan hanya jalur chat.
      await this.detectAndMarkConflict({ userId: user_id, newContent: resolvedSummary, newEmbedding: embedding });

      // 2. INSERT summary di user_memories dengan metadata lengkap
      const { data: memRow, error: memError } = await supabase
        .from('user_memories')
        .insert([{
          user_id,
          summary: resolvedSummary,
          // null bila embedding gagal — kolomnya nullable dan memori tanpa vektor
          // masih ditemukan lewat pencarian SQL. Kegagalannya sudah bersuara di
          // _requestEmbedding, jadi ia tidak lagi hilang dalam diam.
          embedding,
          memory_type: source_type,
          category: category || 'general',
          access_tier: resolvedAccessTier,
          status: status || 'active',
          version_sequence: version_sequence || 1,
          confidence: 1.0,
          source: 'MemoryGovernorService',
          raw_content_id: rawRow.id,
          source_reference: source_reference || null,
          version_code: version_code || null,
          chat_id: chat_id || null,
          last_verified_at: new Date().toISOString()
        }])
        .select('id')
        .single();

      if (memError) {
        console.error('[MemoryGovernorService] Gagal menyimpan summary:', memError.message);
        return null;
      }

      this.eventBus.emit('MemoryGovernor:Stored', {
        memoryId: memRow.id,
        rawContentId: rawRow.id,
        source_reference,
        timestamp: new Date().toISOString()
      });

      console.log('[MemoryGovernorService] Golden memory stored:', memRow.id, 'raw:', rawRow.id);
      return memRow;
    } catch (err) {
      console.error('[MemoryGovernorService] storeGoldenMemory error:', err);
      return null;
    }
  }

  /**
   * Memverifikasi sebuah ringkasan terhadap raw content-nya.
   * Jika raw content berubah (hash berbeda), panggil AI murah untuk regenerasi.
   *
   * @param {string} memoryId - ID memori di user_memories
   * @returns {Promise<Object>} { status: 'UNCHANGED'|'REGENERATED'|'NO_RAW'|'ERROR', memoryId }
   */
  async verifyMemorySummary(memoryId) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');

    try {
      // Ambil ringkasan + raw_content_id
      const { data: mem, error: memErr } = await supabase
        .from('user_memories')
        .select('id, summary, raw_content_id, source_reference, version_code, chat_id')
        .eq('id', memoryId)
        .single();

      if (memErr || !mem) {
        console.error('[MemoryGovernorService] verifyMemorySummary: memori tidak ditemukan', memErr?.message);
        return { status: 'ERROR', memoryId, message: 'memory_not_found' };
      }

      // Data lama tanpa raw_content_id → tidak punya golden source
      if (!mem.raw_content_id) {
        return { status: 'NO_RAW', memoryId, message: 'no_raw_content_reference' };
      }

      // Ambil raw content
      const { data: raw, error: rawErr } = await supabase
        .from('raw_memory_content')
        .select('id, content, content_hash')
        .eq('id', mem.raw_content_id)
        .single();

      if (rawErr || !raw) {
        console.error('[MemoryGovernorService] verifyMemorySummary: raw content tidak ditemukan', rawErr?.message);
        return { status: 'ERROR', memoryId, message: 'raw_content_not_found' };
      }

      // Hitung ulang hash dari raw content saat ini
      const currentHash = this._computeHash(raw.content);
      if (currentHash === raw.content_hash) {
        // Tidak berubah → aman
        return { status: 'UNCHANGED', memoryId, message: 'content_unchanged' };
      }

      // Berubah → regenerasi ringkasan dengan AI murah
      const newSummary = await this._regenerateSummary(raw.content, mem.source_reference);
      if (!newSummary) {
        return { status: 'ERROR', memoryId, message: 'regeneration_failed' };
      }

      // Update ringkasan + hash baru + timestamp
      const { error: updErr } = await supabase
        .from('user_memories')
        .update({
          summary: newSummary,
          last_verified_at: new Date().toISOString()
        })
        .eq('id', memoryId);

      if (updErr) {
        console.error('[MemoryGovernorService] verifyMemorySummary: update gagal', updErr.message);
        return { status: 'ERROR', memoryId, message: 'update_failed' };
      }

      // Update hash raw sebagai sinkronisasi (menandai sudah diverifikasi)
      await supabase
        .from('raw_memory_content')
        .update({ content_hash: currentHash })
        .eq('id', raw.id);

      this.eventBus.emit('MemoryGovernor:SummaryRegenerated', {
        memoryId,
        source_reference: mem.source_reference,
        timestamp: new Date().toISOString()
      });

      console.log('[MemoryGovernorService] Summary regenerated untuk memory:', memoryId);
      return { status: 'REGENERATED', memoryId, message: 'summary_regenerated' };
    } catch (err) {
      console.error('[MemoryGovernorService] verifyMemorySummary error:', err);
      return { status: 'ERROR', memoryId, message: err.message };
    }
  }

  /**
   * Memverifikasi sesi Engineering: mengiterasi file yang dimodifikasi di
   * SessionArtifact dan memastikan ringkasan memori tetap sinkron dengan
   * versi file yang berubah.
   *
   * @param {Object} sessionArtifact - Instance SessionArtifact dari Engineer
   * @returns {Promise<Object>} hasil verifikasi
   */
  async verifyEngineeringSession(sessionArtifact) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');
    if (!sessionArtifact) {
      return { status: 'NO_SESSION', verified: 0, regenerated: 0 };
    }

    const modifiedFiles = sessionArtifact.modifiedFiles || [];
    const results = [];

    // Untuk setiap file yang dimodifikasi, cari memori yang mereferensikannya
    for (const filePath of modifiedFiles) {
      try {
        const { data: memories, error } = await supabase
          .from('user_memories')
          .select('id, summary, source_reference, raw_content_id')
          .eq('source_reference', filePath);

        if (error) {
          // source_reference mungkin belum ada di DB (data lama) → skip
          continue;
        }

        for (const mem of memories || []) {
          const result = await this.verifyMemorySummary(mem.id);
          results.push(result);
        }
      } catch (e) {
        console.warn('[MemoryGovernorService] verifyEngineeringSession file error:', filePath, e.message);
      }
    }

    const regenerated = results.filter(r => r.status === 'REGENERATED').length;
    const unchanged = results.filter(r => r.status === 'UNCHANGED').length;

    this.eventBus.emit('MemoryGovernor:SessionVerified', {
      verified: results.length,
      regenerated,
      unchanged,
      timestamp: new Date().toISOString()
    });

    console.log(`[MemoryGovernorService] Sesi diverifikasi: ${results.length} memori, ${regenerated} regenerated`);
    return { status: 'DONE', verified: results.length, regenerated, unchanged };
  }

  /**
   * Memverifikasi memori sesi Assistant (golden source alignment).
   * Dipanggil saat sesi Assistant disimpan/diakhiri.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} [params.chatId]
   * @returns {Promise<Object>} hasil verifikasi
   */
  async verifyAssistantSession({ userId, chatId }) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');
    if (!userId) return { status: 'NO_USER', verified: 0, regenerated: 0, unchanged: 0 };

    try {
      let query = supabase
        .from('user_memories')
        .select('id, summary, source_reference, raw_content_id')
        .eq('user_id', userId)
        .not('raw_content_id', 'is', null);

      if (chatId) {
        query = query.eq('chat_id', chatId);
      } else {
        // Pencocokan awalan, bukan nilai persis: memori chat lama memakai
        // 'assistant_chat_trigger', sedangkan yang baru memakai 'assistant_chat:<kategori>'
        // (lihat AssistantService goldenMeta — kategori disertakan supaya deteksi konflik
        // tidak lagi menuduh fakta yang tidak berhubungan). Keduanya harus tetap terjaring.
        query = query.like('source_reference', 'assistant_chat%');
      }

      const { data: memories, error } = await query.limit(10);
      if (error || !memories || memories.length === 0) {
        return { status: 'NO_MEMORIES', verified: 0, regenerated: 0, unchanged: 0 };
      }

      const results = [];
      for (const mem of memories) {
        const result = await this.verifyMemorySummary(mem.id);
        results.push(result);
      }

      const regenerated = results.filter(r => r.status === 'REGENERATED').length;
      const unchanged = results.filter(r => r.status === 'UNCHANGED').length;

      this.eventBus.emit('MemoryGovernor:AssistantSessionVerified', {
        userId,
        chatId,
        verified: results.length,
        regenerated,
        unchanged,
        timestamp: new Date().toISOString()
      });

      console.log(`[MemoryGovernorService] Sesi Assistant diverifikasi: ${results.length} memori, ${regenerated} regenerated`);
      return { status: 'DONE', verified: results.length, regenerated, unchanged };
    } catch (err) {
      console.warn('[MemoryGovernorService] verifyAssistantSession error:', err.message);
      return { status: 'ERROR', error: err.message, verified: 0, regenerated: 0, unchanged: 0 };
    }
  }

  /**
   * Memanggil AI murah untuk membuat ulang ringkasan dari raw content.
   * Jika BrainService tidak tersedia, fallback ke ringkasan deterministik.
   *
   * @param {string} rawContent
   * @param {string|null} sourceReference
   * @returns {Promise<string|null>} ringkasan baru atau null
   */
  async _regenerateSummary(rawContent, sourceReference) {
    const brainService = this._getBrainService();

    if (brainService && typeof brainService.executeLLM === 'function') {
      try {
        const prompt = `Buat ringkasan singkat (maks 200 kata) dari konten berikut yang berasal dari "${sourceReference || 'sumber'}", fokus pada fakta penting tanpa mengubah makna:\n\n${rawContent}`;
        const result = await brainService.executeLLM(prompt, { model: 'cheap' });
        if (result && typeof result === 'string' && result.trim().length > 0) {
          return result.trim().substring(0, 500);
        }
      } catch (e) {
        console.warn('[MemoryGovernorService] AI murah gagal, fallback deterministik:', e.message);
      }
    }

    // Fallback deterministik
    const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
    return content.substring(0, 200);
  }

  // ===========================================================================
  // ADDENDUM FASE 1 — Two-Stage Retrieval
  // ===========================================================================

  /**
   * Ambil memori dengan Two-Stage Filter sesuai kontrak Addendum Fase 1.
   *
   * Tahap 1 — Category + status + access_tier filter (SQL, bukan vector search)
   *   → Batasi candidate pool terlebih dahulu, WAJIB sebelum Tahap 2.
   * Tahap 2 — Ranking dalam candidate pool berdasarkan recency + confidence.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {boolean} [params.includeSensitive=false] - Hanya true jika ada flag eksplisit dari user
   * @param {number} [params.candidatePoolSize=30] - Batas Tahap 1
   * @param {number} [params.topK=10] - Hasil akhir setelah ranking Tahap 2
   * @returns {Promise<Array>} Memori yang sudah di-ranking
   */
  async retrieveMemory({ userId, includeSensitive = false, candidatePoolSize = 30, topK = 10 }) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');
    if (!userId) throw new Error('MemoryGovernorService.retrieveMemory: userId required');

    try {
      // TAHAP 1: status + access_tier filter, pool dibatasi (tidak boleh full-table scan)
      //
      // Filter `.in('category', categories)` SENGAJA DIHAPUS (2026-09-09). Kategori kandidat
      // ditebak dari kata-kata di PERTANYAAN (`MemoryService._inferCategories`), sedangkan
      // kategori memori ditetapkan saat PENYIMPANAN — dua sumber yang tidak pernah sinkron.
      // Akibatnya memori jadi tak terlihat kecuali Owner kebetulan memakai kata kunci yang
      // benar: "nama panggilan saya adalah pak slamet" tersimpan sebagai 'preference', tapi
      // pertanyaan "siapa nama panggilan saya?" hanya menghasilkan ['general'] karena tidak
      // memuat kata "suka"/"ingin"/"preferens" — memorinya tidak pernah masuk kandidat.
      // Itulah sebabnya AI berulang kali "lupa" fakta yang jelas-jelas ada di database.
      //
      // Semangat kontrak Addendum Fase 1 tetap dijaga: pool tetap dibatasi (candidatePoolSize),
      // hanya status aktif, dan access_tier tetap menyaring memori sensitif. Yang dilepas cuma
      // pembuangan berbasis tebakan kata kunci — relevansi diserahkan ke Tahap 2.
      let query = supabase
        .from('user_memories')
        .select('id, summary, memory_type, category, confidence, access_tier, status, created_at, source_reference, last_verified_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(candidatePoolSize);

      // Access tier: default exclude sensitive — hanya include jika flag eksplisit
      if (!includeSensitive) {
        query = query.eq('access_tier', 'generic');
      }

      const { data: candidates, error } = await query;

      if (error) {
        console.error('[MemoryGovernorService] retrieveMemory Tahap 1 error:', error.message);
        return [];
      }

      if (!candidates || candidates.length === 0) {
        console.log('[MemoryGovernorService] Two-Stage Tahap 1: 0 kandidat aktif untuk user ini');
        return [];
      }

      // TAHAP 2: Ranking dalam candidate pool
      // Formula: recency_score (0–1) + confidence_score (0–1), dinormalisasi
      const now = Date.now();
      const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari = recency_score 0

      const ranked = candidates
        .map(mem => {
          const timestamp = mem.last_verified_at || mem.created_at;
          const ageMs = timestamp ? Math.max(0, now - new Date(timestamp).getTime()) : MAX_AGE_MS;
          const recencyScore = Math.max(0, 1 - ageMs / MAX_AGE_MS);
          const confidenceScore = typeof mem.confidence === 'number' ? mem.confidence : 0.5;
          const totalScore = recencyScore * 0.4 + confidenceScore * 0.6; // bobot: confidence lebih berat
          return { ...mem, _score: totalScore };
        })
        .sort((a, b) => b._score - a._score)
        .slice(0, topK);

      console.log(`[MemoryGovernorService] Two-Stage: Tahap 1 → ${candidates.length} kandidat, Tahap 2 → ${ranked.length} teratas`);
      return ranked;

    } catch (err) {
      console.error('[MemoryGovernorService] retrieveMemory error:', err);
      return [];
    }
  }

  // ===========================================================================
  // ADDENDUM FASE 1 — Conflict Resolution
  // ===========================================================================


  /**
   * Deteksi konflik memori — DUA TAHAP (Item 55, 2026-09-10).
   *
   * ATURAN LAMA DAN KENAPA IA SELALU SALAH
   * Sebelumnya: "source_reference sama + isi berbeda + versi tidak sekuensial"
   * = konflik. Dua dari tiga syarat itu runtuh di praktik:
   *   - Setiap fakta chat dalam satu kategori memakai `source_reference` yang
   *     sama (`assistant_chat:preference`), jadi syarat pertama selalu benar.
   *   - SETIAP baris `user_memories` punya `version_sequence = 1` (pemanggil
   *     mengirim 1, default-nya juga 1), sehingga `newSeq !== existingSeq + 1`
   *     berbunyi `1 !== 2` — selalu benar. Syarat itu tidak menyaring apa pun.
   * Sisanya tinggal "dua fakta berbeda = konflik". Dijamin positif palsu:
   * "saya suka menggunakan ai" ditandai berbenturan dengan "saya lebih suka
   * penjelasan dengan tabel", padahal keduanya benar.
   *
   * KENAPA KEMIRIPAN VEKTOR SAJA TIDAK CUKUP
   * Diukur pada 12 pasang kalimat nyata (2026-09-10). Celah antara pasangan
   * BERTENTANGAN terendah dan pasangan BEBAS tertinggi ternyata -0,091 —
   * NEGATIF. "kuliah di UT" vs "kuliah di ITB" bertentangan tapi hanya 0,6353,
   * di BAWAH "suka kopi" vs "suka teh" yang bebas di 0,7263. Dan penajaman
   * ("suka kopi" vs "suka kopi hitam tanpa gula", 0,8323) duduk persis di tengah
   * rentang pertentangan (0,789-0,878). Tidak ada satu ambang pun yang memisah.
   *
   * Sebabnya mendasar: vektor mengukur KEMIRIPAN TOPIK, bukan PERTENTANGAN.
   * Kata "tidak" nyaris tidak menggeser vektor; dua nama berbeda justru
   * menjauhkannya meski maknanya bertabrakan.
   *
   * MAKA DUA TAHAP
   *   Tahap 1 — SARINGAN (gratis): kemiripan vektor >= AMBANG_SARING.
   *             Untuk 7 memori Owner, pasangan tak berhubungan tertinggi 0,7263,
   *             jadi saringan 0,78 hampir tidak pernah menyala untuk fakta bebas.
   *   Tahap 2 — HAKIM (berbayar): model kecil memutuskan BERTENTANGAN /
   *             PENAJAMAN / INDEPENDEN. Hanya yang lolos saringan sampai sini,
   *             jadi panggilannya jarang. Memakai BYOK key Owner (Item 51).
   *
   * Hanya putusan BERTENTANGAN yang menandai memori lama sebagai
   * CONFLICT_PENDING_REVIEW. Aturan wajib tetap: DILARANG auto-resolve.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.newContent - isi baru yang akan disimpan
   * @param {number[]} [params.newEmbedding] - vektor isi baru; dihitung sendiri bila kosong
   * @returns {Promise<{ hasConflict: boolean, conflictedIds: string[] }>}
   */
  async detectAndMarkConflict({ userId, newContent, newEmbedding = null }) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');

    const AMBANG_SARING = 0.78;

    try {
      const vektorBaru = newEmbedding || await this._requestEmbedding(newContent);
      if (!Array.isArray(vektorBaru) || vektorBaru.length === 0) {
        // Tanpa vektor tidak ada saringan. Memilih TIDAK menandai apa pun —
        // menebak di sini persis yang melahirkan keluhan positif palsu.
        console.warn('[MemoryGovernorService] Deteksi konflik dilewati — tidak ada embedding untuk isi baru.');
        return { hasConflict: false, conflictedIds: [] };
      }

      const { data: existing, error } = await supabase
        .from('user_memories')
        .select('id, summary, embedding, metadata')
        .eq('user_id', userId)
        .eq('status', 'active')
        .not('embedding', 'is', null);

      if (error || !existing || existing.length === 0) {
        return { hasConflict: false, conflictedIds: [] };
      }

      const kandidat = [];
      for (const mem of existing) {
        // PostgREST mengembalikan kolom vector sebagai STRING "[0.1,0.2,...]",
        // bukan array. Tanpa parse ini cosine-nya menghasilkan NaN dan seluruh
        // saringan diam-diam tidak pernah menyala.
        const vektorLama = this._parseVector(mem.embedding);
        if (!vektorLama) continue;

        const kemiripan = this._cosine(vektorBaru, vektorLama);
        if (kemiripan >= AMBANG_SARING) kandidat.push({ mem, kemiripan });
      }

      if (kandidat.length === 0) return { hasConflict: false, conflictedIds: [] };

      console.log(`[MemoryGovernorService] ${kandidat.length} kandidat lolos saringan ${AMBANG_SARING}. Meminta putusan hakim...`);

      const conflictedIds = [];
      for (const { mem, kemiripan } of kandidat) {
        const putusan = await this._judgeConflict(mem.summary || '', newContent);

        // null = hakim tidak dapat memutuskan. Tidak menandai apa pun.
        if (putusan?.putusan !== 'BERTENTANGAN') {
          console.log(`[MemoryGovernorService] ${putusan?.putusan || 'TIDAK DIPUTUS'} (mirip ${kemiripan.toFixed(4)}) — "${(mem.summary || '').substring(0, 40)}" dibiarkan aktif.`);
          continue;
        }

        const updatedMetadata = {
          ...(mem.metadata || {}),
          conflict_info: {
            detected_at: new Date().toISOString(),
            reason: 'SEMANTIC_CONTRADICTION',
            similarity: +kemiripan.toFixed(4),
            judge_verdict: putusan.putusan,
            judge_reason: putusan.alasan || '',
            incoming_content: newContent,
            previous_summary: mem.summary || ''
          }
        };

        const { error: updateErr } = await supabase
          .from('user_memories')
          .update({ status: 'CONFLICT_PENDING_REVIEW', metadata: updatedMetadata })
          .eq('id', mem.id);

        if (!updateErr) conflictedIds.push(mem.id);
      }

      if (conflictedIds.length > 0) {
        this.eventBus.emit('MemoryGovernor:ConflictDetected', {
          conflictedIds,
          timestamp: new Date().toISOString()
        });
        console.log(`[MemoryGovernorService] Konflik nyata: ${conflictedIds.length} memori ditandai CONFLICT_PENDING_REVIEW`);
      }

      return { hasConflict: conflictedIds.length > 0, conflictedIds };

    } catch (err) {
      console.error('[MemoryGovernorService] detectAndMarkConflict error:', err);
      return { hasConflict: false, conflictedIds: [] };
    }
  }

  /** Kemiripan kosinus dua vektor. */
  _cosine(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let d = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    if (na === 0 || nb === 0) return 0;
    return d / (Math.sqrt(na) * Math.sqrt(nb));
  }

  /** Kolom `vector` datang sebagai string JSON dari PostgREST — ubah ke array angka. */
  _parseVector(v) {
    if (Array.isArray(v)) return v;
    if (typeof v !== 'string') return null;
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) ? arr : null;
    } catch {
      return null;
    }
  }

  /**
   * Tahap 2: minta model kecil memutuskan hubungan dua pernyataan.
   * Mengembalikan null bila tidak bisa memutuskan — pemanggil TIDAK menandai apa pun.
   */
  async _judgeConflict(existing, incoming) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const brain = this.serviceManager.has('BrainService') ? this.serviceManager.get('BrainService') : null;
      const vault = this.serviceManager.has('VaultService') ? this.serviceManager.get('VaultService') : null;
      const cfg = brain?.getBrainConfig?.() || {};
      const provider = cfg.provider || null;
      const key = provider && vault ? vault.getKey(provider) : null;

      if (!provider || !key) {
        console.warn('[MemoryGovernorService] Hakim konflik dilewati — tidak ada API Key pengguna.');
        return null;
      }

      const headers = {};
      headers['x-byok-' + provider] = String(key).replace(/[^\x00-\x7F]/g, '');

      const { data, error } = await supabase.functions.invoke('agent-process', {
        body: { action: 'judge_conflict', existing, incoming, model: cfg.model || undefined },
        headers
      });

      if (error) throw new Error(error.message);
      if (!data?.putusan) return null;
      return data;
    } catch (err) {
      console.warn('[MemoryGovernorService] Hakim konflik gagal, dianggap tidak berkonflik:', err.message);
      return null;
    }
  }

  /**
   * Resolve konflik — HANYA dipanggil via aksi eksplisit user, tidak ada jalur otomatis.
   *
   * @param {string} memoryId - ID memori yang berstatus CONFLICT_PENDING_REVIEW
   * @param {'keep'|'discard'} resolution - Keputusan user
   * @returns {Promise<{ success: boolean, newStatus: string }>}
   */
  async resolveConflict(memoryId, resolution) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');
    if (!['keep', 'discard'].includes(resolution)) {
      throw new Error('resolveConflict: resolution harus "keep" atau "discard"');
    }

    const newStatus = resolution === 'keep' ? 'active' : 'archived';

    try {
      const { error } = await supabase
        .from('user_memories')
        .update({ status: newStatus })
        .eq('id', memoryId)
        .eq('status', 'CONFLICT_PENDING_REVIEW'); // Hanya resolve yang memang berkonflik

      if (error) {
        console.error('[MemoryGovernorService] resolveConflict error:', error.message);
        return { success: false, newStatus: null };
      }

      this.eventBus.emit('MemoryGovernor:ConflictResolved', {
        memoryId,
        resolution,
        newStatus,
        timestamp: new Date().toISOString()
      });

      console.log(`[MemoryGovernorService] Conflict resolved: ${memoryId} → ${newStatus}`);
      return { success: true, newStatus };

    } catch (err) {
      console.error('[MemoryGovernorService] resolveConflict error:', err);
      return { success: false, newStatus: null };
    }
  }

  // ===========================================================================
  // ADDENDUM FASE 1 — Soft-Delete Lifecycle
  // ===========================================================================

  /**
   * Soft-delete: set status memori dari 'active' ke 'archived'.
   * Record tetap ada di database (fungsi kotak sampah).
   * Di-exclude dari retrieval normal (retrieveMemory hanya ambil status='active').
   *
   * @param {string} memoryId
   * @returns {Promise<{ success: boolean }>}
   */
  async archiveMemory(memoryId) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');

    try {
      const { error } = await supabase
        .from('user_memories')
        .update({ status: 'archived' })
        .eq('id', memoryId)
        .eq('status', 'active'); // Hanya archive yang masih active

      if (error) {
        console.error('[MemoryGovernorService] archiveMemory error:', error.message);
        return { success: false };
      }

      this.eventBus.emit('MemoryGovernor:Archived', {
        memoryId,
        timestamp: new Date().toISOString()
      });

      console.log('[MemoryGovernorService] Memory archived:', memoryId);
      return { success: true };

    } catch (err) {
      console.error('[MemoryGovernorService] archiveMemory error:', err);
      return { success: false };
    }
  }

  /**
   * Tandai memori untuk dihapus permanen (tahap 1 dari 2).
   * Hanya bisa dari status 'archived'. Hard-delete via executePurge().
   * Tidak ada jalur otomatis ke hard-delete.
   *
   * @param {string} memoryId
   * @returns {Promise<{ success: boolean }>}
   */
  async requestPurge(memoryId) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');

    try {
      const { error } = await supabase
        .from('user_memories')
        .update({ status: 'pending_purge' })
        .eq('id', memoryId)
        .eq('status', 'archived'); // Hanya bisa dari archived, bukan langsung dari active

      if (error) {
        console.error('[MemoryGovernorService] requestPurge error:', error.message);
        return { success: false };
      }

      console.log('[MemoryGovernorService] Purge requested for memory:', memoryId);
      return { success: true };

    } catch (err) {
      console.error('[MemoryGovernorService] requestPurge error:', err);
      return { success: false };
    }
  }

  /**
   * Hard-delete permanen (tahap 2 dari 2). Hanya bisa setelah requestPurge().
   * HANYA dipanggil via command eksplisit owner — tidak ada cron/background job.
   *
   * @param {string} memoryId
   * @returns {Promise<{ success: boolean }>}
   */
  async executePurge(memoryId) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');

    try {
      // Pastikan record benar-benar di status pending_purge sebelum hard-delete
      const { data: mem, error: checkErr } = await supabase
        .from('user_memories')
        .select('id, status')
        .eq('id', memoryId)
        .eq('status', 'pending_purge')
        .single();

      if (checkErr || !mem) {
        console.error('[MemoryGovernorService] executePurge: record tidak ditemukan atau belum pending_purge');
        return { success: false };
      }

      const { error: deleteErr } = await supabase
        .from('user_memories')
        .delete()
        .eq('id', memoryId);

      if (deleteErr) {
        console.error('[MemoryGovernorService] executePurge: delete gagal', deleteErr.message);
        return { success: false };
      }

      this.eventBus.emit('MemoryGovernor:Purged', {
        memoryId,
        timestamp: new Date().toISOString()
      });

      console.log('[MemoryGovernorService] Memory hard-deleted (purged):', memoryId);
      return { success: true };

    } catch (err) {
      console.error('[MemoryGovernorService] executePurge error:', err);
      return { success: false };
    }
  }

  /**
   * Pulihkan memori dari status 'archived' atau 'pending_purge' kembali ke 'active'.
   * @param {string} memoryId
   * @returns {Promise<{ success: boolean }>}
   */
  async restoreMemory(memoryId) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');

    try {
      const { error } = await supabase
        .from('user_memories')
        .update({ status: 'active' })
        .eq('id', memoryId)
        .in('status', ['archived', 'pending_purge']);

      if (error) {
        console.error('[MemoryGovernorService] restoreMemory error:', error.message);
        return { success: false };
      }

      this.eventBus.emit('MemoryGovernor:Restored', {
        memoryId,
        timestamp: new Date().toISOString()
      });

      console.log('[MemoryGovernorService] Memory restored to active:', memoryId);
      return { success: true };
    } catch (err) {
      console.error('[MemoryGovernorService] restoreMemory error:', err);
      return { success: false };
    }
  }

  /**
   * Ambil semua record memori yang berstatus CONFLICT_PENDING_REVIEW untuk keperluan UI.
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getConflicts(userId) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('user_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'CONFLICT_PENDING_REVIEW')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[MemoryGovernorService] getConflicts error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('[MemoryGovernorService] getConflicts error:', err);
      return [];
    }
  }

  /**
   * Ambil semua record memori yang berstatus 'archived' atau 'pending_purge' untuk Trash Bin UI.
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getTrashMemories(userId) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('user_memories')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['archived', 'pending_purge'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[MemoryGovernorService] getTrashMemories error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('[MemoryGovernorService] getTrashMemories error:', err);
      return [];
    }
  }

  /**
   * Ambil daftar memori aktif untuk keperluan tampilan Memory Context Panel (Display Only).
   * Menampilkan top-N memori aktif lintas seluruh kategori tanpa penyempitan heuristik retrieval.
   * @param {string} userId
   * @param {Object} [options]
   * @param {number} [options.limit=50]
   * @returns {Promise<Array>}
   */
  async getActiveMemories(userId, { limit = 50 } = {}) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('user_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[MemoryGovernorService] getActiveMemories error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('[MemoryGovernorService] getActiveMemories error:', err);
      return [];
    }
  }
}

export default MemoryGovernorService;
