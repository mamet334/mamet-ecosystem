import { saveFactDirectly } from './plugins/memory_manager_v1.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { detectFact } from './lib/fact_detector.ts';
import { PolicyEngine } from './lib/verification/policy_engine.ts';

export const processMemoryWriteQueue = async (
  userId: string,
  userMessage: string,
  supabaseUrl: string,
  supabaseKey: string,
  mode: string,
  workspaceId?: string | null,
  rctx?: any
) => {
  if (/^\s*\[(TERMINAL OUTPUT for: |HASIL ALAT FOLDER\]|HASIL ALAT KONEKTOR\])/.test(String(userMessage || ''))) return;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const logAudit = async (action: string, intent: string, confidence: number, reason: string) => {
    try {
      await supabase.from('memory_audit_log').insert([{
        user_id: userId,
        input_text: userMessage,
        detected_intent: intent,
        confidence: confidence,
        action: action,
        reason: reason,
        source: 'fact_detector'
      }]);
      console.log(`[MEMORY_AUDIT_LOG] ${action} | Intent: ${intent} | Reason: ${reason}`);
    } catch (e) {
      console.error("[MEMORY_AUDIT_LOG_ERROR]", e);
    }
  };

  try {
    const policyDecision = PolicyEngine.evaluate('WRITE_MEMORY', {
      mode: mode as any,
      evidenceCount: 0,
      riskScore: 0,
      appSource: 'WORKER',
      hasActiveConflicts: false
    });

    if (!policyDecision.allow) {
       await logAudit('REJECTED_BY_POLICY', 'UNKNOWN', 0.0, policyDecision.reason);
       return;
    }

    const detectorResult = detectFact(userMessage);

    if (!detectorResult.memory_eligible || detectorResult.intent !== 'FACT') {
       await logAudit('SKIPPED', detectorResult.intent, detectorResult.score, detectorResult.reason);
       return;
    }

    if (detectorResult.memory_type === 'EVENT') {
       await logAudit('SKIPPED', 'FACT', detectorResult.score, 'Event detected, ephemeral memory skipped');
       return;
    }

    const msgLower = userMessage.trim().toLowerCase();
    
    const validWorkspaceId = (workspaceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(workspaceId).trim()))
      ? String(workspaceId).trim()
      : null;

    let extractedFact = userMessage.trim();
    let memoryType = detectorResult.memory_type || detectorResult.tier;

    if (memoryType === 'LOCATION' || memoryType === 'JOB') {
        let updateQuery = supabase
          .from('user_memories')
          .update({ memory_state: 'HISTORICAL' })
          .eq('user_id', userId)
          .eq('memory_type', memoryType)
          .neq('memory_state', 'HISTORICAL');
          
        if (validWorkspaceId) {
          updateQuery = updateQuery.eq('workspace_id', validWorkspaceId);
        } else {
          updateQuery = updateQuery.is('workspace_id', null);
        }
        await updateQuery;
    }

    const sanitizedFact = (extractedFact || '').replace(/[%_"'(),\\]/g, ' ').replace(/\s+/g, ' ').trim();
    let existingQuery = supabase
      .from('user_memories')
      .select('id, summary, confidence')
      .eq('user_id', userId);

    if (sanitizedFact.length > 0) {
      existingQuery = existingQuery.ilike('summary', `%${sanitizedFact}%`);
    }
      
    if (validWorkspaceId) {
      existingQuery = existingQuery.eq('workspace_id', validWorkspaceId);
    } else {
      existingQuery = existingQuery.is('workspace_id', null);
    }
    
    const { data: existing } = await existingQuery.limit(1);

    if (existing && existing.length > 0) {
       const newConfidence = Math.min(1.0, (existing[0].confidence || detectorResult.score) + 0.1);
       await supabase.from('user_memories').update({ confidence: newConfidence }).eq('id', existing[0].id);
       await logAudit('DEDUPED', 'FACT', detectorResult.score, 'Duplikat, confidence naik');
       return;
    }

    await saveFactDirectly({
      user_id: userId,
      content: extractedFact,
      memory_type: memoryType,
      confidence: detectorResult.score,
      source: 'rule_based_async_worker',
      memory_state: 'ACTIVE',
      workspace_id: validWorkspaceId || null
    }, supabaseUrl, supabaseKey, rctx);

    await logAudit('STORED', 'FACT', detectorResult.score, detectorResult.reason);
  } catch (error) {
    await logAudit('REJECTED', 'UNKNOWN', 0.0, `System Error: ${error}`);
  }
};
