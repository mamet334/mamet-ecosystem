import { supabase } from '../../../supabase.js';

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
      }

      const { data, error } = await supabase.functions.invoke('agent-process', {
        body: { action: 'embed', text: text.substring(0, 8000) },
        headers: kunciOpenRouter ? { 'x-byok-openrouter': kunciOpenRouter } : {}
      });

      if (error) {
        let pesan = error.message;
        try {
          const isi = await error.context?.json?.();
          if (isi?.message || isi?.error) pesan = isi.message || isi.error;
        } catch {
        }
        throw new Error(pesan);
      }
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

      await new Promise(r => setTimeout(r, 400));
    }

    console.log(`[Backfill] Selesai — ${berhasil} berhasil, ${gagal} gagal, dari ${rows.length} diperiksa.`);
    this.eventBus?.emit('MemoryGovernor:BackfillDone', { diperiksa: rows.length, berhasil, gagal });
    return { diperiksa: rows.length, berhasil, gagal };
  }

  _computeHash(content) {
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  _getBrainService() {
    try {
      return this.serviceManager.has('BrainService')
        ? this.serviceManager.get('BrainService')
        : null;
    } catch (e) {
      return null;
    }
  }

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

    let resolvedAccessTier = access_tier;
    if (!resolvedAccessTier) {
      const contentStr = (typeof content === 'string' ? content : JSON.stringify(content)).toLowerCase();
      const hasSensitivePattern = /password|token|secret|api[_-]?key|kredensial|credential|bearer|private[_-]?key/i.test(contentStr);
      resolvedAccessTier = hasSensitivePattern ? 'sensitive' : 'generic';
    }

    try {
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
        return { ...existingMemory, _duplicateSkipped: true };
      }

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

      const embedding = await this._requestEmbedding(resolvedSummary);

      await this.detectAndMarkConflict({ userId: user_id, newContent: resolvedSummary, newEmbedding: embedding });

      const { data: memRow, error: memError } = await supabase
        .from('user_memories')
        .insert([{
          user_id,
          summary: resolvedSummary,
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

  async verifyMemorySummary(memoryId) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');

    try {
      const { data: mem, error: memErr } = await supabase
        .from('user_memories')
        .select('id, summary, raw_content_id, source_reference, version_code, chat_id')
        .eq('id', memoryId)
        .single();

      if (memErr || !mem) {
        console.error('[MemoryGovernorService] verifyMemorySummary: memori tidak ditemukan', memErr?.message);
        return { status: 'ERROR', memoryId, message: 'memory_not_found' };
      }

      if (!mem.raw_content_id) {
        return { status: 'NO_RAW', memoryId, message: 'no_raw_content_reference' };
      }

      const { data: raw, error: rawErr } = await supabase
        .from('raw_memory_content')
        .select('id, content, content_hash')
        .eq('id', mem.raw_content_id)
        .single();

      if (rawErr || !raw) {
        console.error('[MemoryGovernorService] verifyMemorySummary: raw content tidak ditemukan', rawErr?.message);
        return { status: 'ERROR', memoryId, message: 'raw_content_not_found' };
      }

      const currentHash = this._computeHash(raw.content);
      if (currentHash === raw.content_hash) {
        return { status: 'UNCHANGED', memoryId, message: 'content_unchanged' };
      }

      const newSummary = await this._regenerateSummary(raw.content, mem.source_reference);
      if (!newSummary) {
        return { status: 'ERROR', memoryId, message: 'regeneration_failed' };
      }

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

  async verifyEngineeringSession(sessionArtifact) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');
    if (!sessionArtifact) {
      return { status: 'NO_SESSION', verified: 0, regenerated: 0 };
    }

    const modifiedFiles = sessionArtifact.modifiedFiles || [];
    const results = [];

    for (const filePath of modifiedFiles) {
      try {
        const { data: memories, error } = await supabase
          .from('user_memories')
          .select('id, summary, source_reference, raw_content_id')
          .eq('source_reference', filePath);

        if (error) {
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

    const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
    return content.substring(0, 200);
  }


  async retrieveMemory({ userId, includeSensitive = false, candidatePoolSize = 30, topK = 10 }) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');
    if (!userId) throw new Error('MemoryGovernorService.retrieveMemory: userId required');

    try {
      let query = supabase
        .from('user_memories')
        .select('id, summary, memory_type, category, confidence, access_tier, status, created_at, source_reference, last_verified_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(candidatePoolSize);

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

      const now = Date.now();
      const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

      const ranked = candidates
        .map(mem => {
          const timestamp = mem.last_verified_at || mem.created_at;
          const ageMs = timestamp ? Math.max(0, now - new Date(timestamp).getTime()) : MAX_AGE_MS;
          const recencyScore = Math.max(0, 1 - ageMs / MAX_AGE_MS);
          const confidenceScore = typeof mem.confidence === 'number' ? mem.confidence : 0.5;
          const totalScore = recencyScore * 0.4 + confidenceScore * 0.6;
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



  async detectAndMarkConflict({ userId, newContent, newEmbedding = null }) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');

    const AMBANG_SARING = 0.78;

    try {
      const vektorBaru = newEmbedding || await this._requestEmbedding(newContent);
      if (!Array.isArray(vektorBaru) || vektorBaru.length === 0) {
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

  _cosine(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let d = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    if (na === 0 || nb === 0) return 0;
    return d / (Math.sqrt(na) * Math.sqrt(nb));
  }

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
        .eq('status', 'CONFLICT_PENDING_REVIEW');

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


  async archiveMemory(memoryId) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');

    try {
      const { error } = await supabase
        .from('user_memories')
        .update({ status: 'archived' })
        .eq('id', memoryId)
        .eq('status', 'active');

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

  async requestPurge(memoryId) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');

    try {
      const { error } = await supabase
        .from('user_memories')
        .update({ status: 'pending_purge' })
        .eq('id', memoryId)
        .eq('status', 'archived');

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

  async executePurge(memoryId) {
    if (!this.isInitialized) throw new Error('MemoryGovernorService not initialized');

    try {
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
