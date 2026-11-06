import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { parseCognitiveIntent, bindCognitiveExecution } from '../lib/context_optimizer.ts';
import { compressCognitiveContext } from './context_compressor.ts';
import { generateEmbedding, EMBEDDING_DIMENSIONS } from '../lib/rag/embedding.ts';

const logMemoryAudit = (supabaseUrl, supabaseKey, payload, rctx) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const promise = supabase.from('memory_audit_logs').insert([payload]).then(({error}) => {
      if (error) console.error("Audit log insert error:", error);
    });
    if (rctx?.tasks?.fire) rctx.tasks.fire('MemoryAuditLog', promise);
  } catch(e) {
    console.error("Audit log setup error:", e);
  }
};

export const saveFactDirectly = async (
  payload: { user_id: string, content: string, memory_type: string, confidence: number, source: string, memory_state?: string },
  supabaseUrl: string,
  supabaseKey: string,
  rctx?: any
) => {
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[V1_CLEAN_INGESTION] Menerima structured payload:', payload);

  let embedding: number[] | null = null;
  if (rctx) {
    try {
      const vektor = await generateEmbedding(payload.content, rctx);
      if (vektor && vektor.length === EMBEDDING_DIMENSIONS) {
        embedding = vektor;
        console.log(`[V1_CLEAN_INGESTION] ✅ Embedding memori dibuat (${vektor.length} dimensi)`);
      } else {
        console.error(`[V1_CLEAN_INGESTION] ⚠️ Embedding dilewati — dimensi ${vektor?.length ?? 0}, diharapkan ${EMBEDDING_DIMENSIONS}. Memori tetap disimpan, tapi tidak akan muncul di pencarian semantik.`);
      }
    } catch (e) {
      console.error(`[V1_CLEAN_INGESTION] ⚠️ Embedding gagal: ${(e as Error).message}. Memori tetap disimpan, tapi tidak akan muncul di pencarian semantik.`);
    }
  } else {
    console.warn('[V1_CLEAN_INGESTION] ⚠️ Tanpa rctx — embedding tidak dibuat. Memori hanya bisa ditemukan lewat pencarian SQL.');
  }

  const { data: insertData, error: insertError } = await supabase.from('user_memories').insert([{
    user_id: payload.user_id,
    summary: payload.content,
    memory_type: payload.memory_type,
    confidence: payload.confidence,
    source: payload.source,
    memory_state: payload.memory_state || 'ACTIVE',
    embedding: embedding
  }]).select('id').single();

  if (insertError) {
    console.error('[V1_CLEAN_INGESTION_ERROR] Insert gagal:', insertError);
    throw new Error(`DB Write Failed: ${insertError.message}`);
  }

  const { data: confirmData, error: confirmError } = await supabase
    .from('user_memories')
    .select('id, summary, memory_type')
    .eq('id', insertData.id)
    .single();

  if (confirmError || !confirmData) {
    console.error('[V1_CLEAN_INGESTION_ERROR] Verify/Select gagal:', confirmError);
    throw new Error(`DB Write Verification Failed: ${confirmError?.message || 'Data missing'}`);
  }

  console.log('[V1_CLEAN_INGESTION_SUCCESS] Berhasil simpan & terverifikasi:', confirmData);
  return confirmData;
};

export const MEMORY_V2_ENABLED = Deno.env.get('MEMORY_V2_ENABLED') === 'true';

export const retrieveMemoriesV2 = async (userPrompt: string, userId: string, supabaseUrl: string, supabaseKey: string, rctx?: any) => {
  const startTime = Date.now();
  
  console.log('[MemoryManagerV2] userId received:', userId);
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  if (!isValidUUID) {
    console.warn('[MemoryManagerV2] Invalid userId, skipping query:', userId);
    return null;
  }
  
  if (!userId || userPrompt.trim().length < 4) return null;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[COST LEAK DETECTION] memoryFetchCount: 1 (V2 Subgraph)');
    
    const intentSpec = parseCognitiveIntent(userPrompt);
    const contract = bindCognitiveExecution(intentSpec);
    
    const promptLower = userPrompt.toLowerCase();
    const keywords = promptLower.split(/[\s\p{P}]+/).filter(w => w.length > 3);
    
    const { data: subgraph, error } = await supabase.rpc('extract_cognitive_subgraph', {
      p_user_id: userId,
      p_keywords: keywords,
      p_intent_mode: intentSpec.intent_mode,
      p_max_nodes: contract.max_nodes,
      p_max_edges: contract.max_edges,
      p_traversal_depth: contract.graph_traversal_depth
    });
    
    if (error) throw error;
    
    console.log('[MEMORY_V2_STATS]', subgraph.stats);
    
    if (!subgraph.nodes || subgraph.nodes.length === 0) return [];
    
    const compressedContext = await compressCognitiveContext({
      intent: intentSpec,
      nodes: subgraph.nodes,
      edges: subgraph.edges,
      query: userPrompt,
      rctx
    });

    console.log('[MEMORY_V2_COMPRESSION_STATS]', {
      token_before: compressedContext.token_before,
      token_after: compressedContext.token_after,
      confidence_score: compressedContext.confidence_score
    });

    const finalMemoryObject = {
      id: compressedContext.source_nodes[0] || 'compressed-memory-root',
      type: 'memory',
      content: compressedContext.compressed_summary + (compressedContext.emotional_context.length > 0 ? '\n\n[EMOTIONAL CONTEXT: ' + compressedContext.emotional_context.join(', ') + ']' : ''),
      score: compressedContext.confidence_score * 10,
      timestamp: new Date().toISOString(),
      is_root: true,
      is_compressed_context: true,
      metadata: { source_nodes: compressedContext.source_nodes }
    };
    
    if (compressedContext.source_nodes.length > 0) {
       const promise = supabase.rpc('update_memory_stats', { memory_ids: compressedContext.source_nodes })
         .then(({error}) => { if (error) console.error("Update memory stats error:", error) });
       if (rctx?.tasks?.fire) rctx.tasks.fire('MemoryStatsUpdate', promise);
    }
    
    return [finalMemoryObject];
  } catch (e) {
    console.error('[MEMORY_V2_ERROR] Fallback triggered', e);
    return null;
  }
};

export const retrieveMemories = async (userPrompt: string, userId: string, supabaseUrl: string, supabaseKey: string, rctx?: any, workspaceId?: string | null) => {
  if (MEMORY_V2_ENABLED) {
     const v2Result = await retrieveMemoriesV2(userPrompt, userId, supabaseUrl, supabaseKey, rctx);
     if (v2Result !== null && v2Result.length > 0) {
         return v2Result; 
     }
  }

  const startTime = Date.now();
  
  console.log('[MemoryManager] userId received:', userId);
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  if (!isValidUUID) {
    console.warn('[MemoryManager] Invalid userId, skipping query:', userId);
    logMemoryAudit(supabaseUrl, supabaseKey, { user_id: userId, event_type: 'memory_retrieval_failed', status: 'FAILED', reason: 'invalid_uuid', query: userPrompt, execution_time_ms: Date.now() - startTime }, rctx);
    return [];
  }
  
  if (!userId || userPrompt.trim().length < 4) {
     logMemoryAudit(supabaseUrl, supabaseKey, { user_id: userId, event_type: 'memory_retrieval_failed', status: 'FAILED', reason: 'query_too_short', query: userPrompt, execution_time_ms: Date.now() - startTime }, rctx);
     return [];
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[COST LEAK DETECTION] memoryFetchCount: 1');
    const promptLower = userPrompt.toLowerCase();
    const isTemporalQuery = ['sebelum', 'dulu', 'pernah', 'awal', 'terakhir'].some(w => promptLower.includes(w));
    const dbLimit = isTemporalQuery ? 50 : 15;
    
    let memoryQuery = supabase.from('user_memories').select('*').eq('user_id', userId);
    
    const isUuid = Boolean(workspaceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(workspaceId).trim()));
    const validWorkspaceId = isUuid ? String(workspaceId).trim() : null;

    try {
        if (validWorkspaceId) {
           memoryQuery = memoryQuery.or(`workspace_id.eq.${validWorkspaceId},workspace_id.is.null`);
        } else {
           memoryQuery = memoryQuery.is('workspace_id', null);
        }
    } catch (e) {
        console.log('[MemoryManager] workspace_id column not found, skipping filter');
    }
    
    let { data, error } = await memoryQuery.order('created_at', { ascending: false }).limit(50);
    
    if (error) {
       if (error.code === 'PGRST204' || (error.message && error.message.includes('workspace_id'))) {
           console.warn('[MemoryManager] workspace_id column missing in DB, falling back to base query');
           const fallbackResult = await supabase.from('user_memories').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
           data = fallbackResult.data;
           error = fallbackResult.error;
       }
       
       if (error) {
           console.error('[MEMORY_RETRIEVAL_ERROR] DB Query failed:', error);
           return [];
       }
    }
    
    if (!data || data.length === 0) return [];
    
    data = data.filter(d => d.is_deprecated !== true);
    
    const keywords = promptLower.split(/[\s\p{P}]+/).filter(w => w.length > 3);
    
    const uniqueMemoriesMap = new Map();
    for (const d of data) {
       const dSumLower = (d.summary || d.content || '').toLowerCase();
       if (!uniqueMemoriesMap.has(dSumLower)) {
          uniqueMemoriesMap.set(dSumLower, d);
       }
    }
    const uniqueMemories = Array.from(uniqueMemoriesMap.values());
    
    const scoredMemories = uniqueMemories.map((mem, index) => {
       let score = 0;
       const memLower = (mem.summary || mem.content || '').toLowerCase();
       
       if (promptLower.includes(memLower) || memLower.includes(promptLower)) {
          score += 5;
       }
       
       for (const kw of keywords) {
          if (memLower.includes(kw)) score += 2;
       }
       
       if (index < 3) score += 1;
       
       const relevanceScore = score;
       const confidenceScore = mem.confidence || 1.0;
       const ageDays = (Date.now() - new Date(mem.created_at).getTime()) / (1000 * 60 * 60 * 24);
       let recencyScore = Math.max(0, 100 - (ageDays * 2));
       const frequencyScore = Math.min(100, (mem.memory_hits || 0) * 10);
       
       let stateModifier = 0;
       if (mem.memory_state === 'STABILIZED') stateModifier = 15.0;
       else if (mem.memory_state === 'CONFLICTED') stateModifier = -20.0;
       else if (mem.memory_state === 'HISTORICAL') stateModifier = isTemporalQuery ? 20.0 : -10.0;

       if (isTemporalQuery) {
           recencyScore = Math.min(100, ageDays * 2);
       }
       
       const cognitiveDepth = (mem.reasoning_depth_score || 0) * 10.0;
       const truthVerification = (mem.truth_verification_score || 0) * 10.0;

       const finalScore = (relevanceScore * 0.4) + (confidenceScore * 30.0) + (recencyScore * 0.2) + (frequencyScore * 0.1) + stateModifier + cognitiveDepth + truthVerification;
       
       return { ...mem, score: finalScore, decayScore: recencyScore, frequencyScore, finalScore };
    });
    
    scoredMemories.sort((a, b) => b.score - a.score);
    
    let dynamicTopK = 5;
    if (isTemporalQuery) dynamicTopK = 10;
    else if (['suka', 'favorit', 'makanan', 'minuman'].some(w => promptLower.includes(w))) dynamicTopK = 8;
    else if (['tinggal', 'dimana', 'lokasi'].some(w => promptLower.includes(w))) dynamicTopK = 3;

    const topMemories = scoredMemories.slice(0, dynamicTopK);
    
    
    let currentLen = 0;
    const finalMemories = [];
    for (const d of topMemories) {
      if (typeof d.finalScore !== 'number' || isNaN(d.finalScore)) continue;
      
      let enrichedContent = d.summary || d.content || '';
      if (d.memory_state === 'STABILIZED' && d.justification_chain) {
          enrichedContent += ` [Verified Fact: ${d.justification_chain}]`;
      } else if (d.memory_state === 'CONFLICTED') {
          enrichedContent += ` [Warning: Unresolved conflicting facts detected. Use with caution.]`;
      }
      
      finalMemories.push({ 
         id: d.id,
         type: 'memory', 
         content: enrichedContent, 
         score: d.finalScore,
         timestamp: d.created_at,
         decayScore: d.decayScore,
         frequencyScore: d.frequencyScore,
         finalScore: d.finalScore
      });
      currentLen += d.summary.length;
    }
    
    if (finalMemories.length > 0) {
       const memoryIds = finalMemories.map(m => m.id).filter(id => id);
       if (memoryIds.length > 0) {
           const promise = supabase.rpc('update_memory_stats', { memory_ids: memoryIds })
             .then(({error}) => { if (error) console.error("Update memory stats error:", error) })
             .catch(e => console.error("Update memory stats exception:", e));
           if (rctx?.tasks?.fire) rctx.tasks.fire('MemoryStatsUpdate', promise);
       }
    }
    
    const latencyMs = Date.now() - startTime;
    
    if (promptLower.includes('deadline')) {
      logMemoryAudit(supabaseUrl, supabaseKey, { user_id: userId, event_type: 'deadline_lookup', status: 'SUCCESS', query: userPrompt, matched_memories: topMemories.length, execution_time_ms: latencyMs }, rctx);
    } else if (promptLower.includes('tugas')) {
      logMemoryAudit(supabaseUrl, supabaseKey, { user_id: userId, event_type: 'task_lookup', status: 'SUCCESS', query: userPrompt, matched_memories: topMemories.length, execution_time_ms: latencyMs }, rctx);
    } else if (promptLower.includes('laporan')) {
      logMemoryAudit(supabaseUrl, supabaseKey, { user_id: userId, event_type: 'report_generation', status: 'SUCCESS', query: userPrompt, matched_memories: topMemories.length, execution_time_ms: latencyMs }, rctx);
    } else {
      logMemoryAudit(supabaseUrl, supabaseKey, { user_id: userId, event_type: 'memory_retrieval_success', status: 'SUCCESS', query: userPrompt, matched_memories: topMemories.length, execution_time_ms: latencyMs }, rctx);
    }
    
    return finalMemories;
  } catch (e) {
    logMemoryAudit(supabaseUrl, supabaseKey, { user_id: userId, event_type: 'memory_retrieval_failed', status: 'FAILED', reason: e.message, query: userPrompt, execution_time_ms: Date.now() - startTime }, rctx);
    return [];
  }
};

