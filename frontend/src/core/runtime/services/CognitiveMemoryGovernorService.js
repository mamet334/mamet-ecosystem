
export const LEGACY_COGNITION_ENABLED = true;

const REJECT_THRESHOLD = 0.3;
const HALLUCINATION_THRESHOLD = 0.2;

export function calculateTruthScore(memory) {
  if (!memory) return 0.4;
  if (typeof memory.truth_score === 'number') return memory.truth_score;

  const source = memory.source_type || memory.source || '';
  if (source === 'explicit_user_statement') return 0.9;
  if (source === 'user_confirmed')          return 0.95;
  if (source === 'web_search')              return 0.7;
  if (source === 'ai_inference')            return 0.6;
  if (source === 'user_upload')             return 0.75;
  return 0.4;
}

export function runCognitiveMemoryGovernor(input) {
  if (!LEGACY_COGNITION_ENABLED) {
    return {
      status: 'ALLOW',
      reason: '[LEGACY DISABLED] Bypassed.',
      confidence: input?.final_decision_context?.confidence_score || 1.0,
      selected_truth: input?.final_decision_context?.memory?.active || null
    };
  }

  const active_truth = input?.final_decision_context?.memory?.active;
  let status = 'ALLOW';
  let reason = 'Valid context.';
  let confidence = input?.final_decision_context?.confidence_score || 0;

  if (!active_truth) {
    return { status: 'ALLOW', reason: 'No active memory. Stateless execution.', confidence, selected_truth: null };
  }

  const truth_score = calculateTruthScore(active_truth);

  if (truth_score < REJECT_THRESHOLD) {
    status = 'REJECT';
    reason = `Rejected: truth_score (${truth_score.toFixed(2)}) < threshold ${REJECT_THRESHOLD}.`;
    console.warn('[CMG] REJECT:', reason);
  }

  const hasConflicts = input?.memory_context?.conflict_edges?.length > 0;
  if (hasConflicts && status === 'ALLOW') {
    reason = 'FLAG: UNSTABLE. Unresolved conflicts in Truth Graph.';
    confidence -= 0.1;
  }

  if (truth_score < HALLUCINATION_THRESHOLD) {
    status = 'REJECT';
    reason = `Hallucination Risk: truth_score (${truth_score.toFixed(2)}) < ${HALLUCINATION_THRESHOLD}.`;
    console.warn('[CMG] Hallucination risk:', reason);
  }

  const latent = input?.final_decision_context?.memory?.latent || [];
  if (latent.length > 0 && status !== 'REJECT') {
    const top_latent_score = calculateTruthScore(latent[0]);
    if (top_latent_score >= truth_score) {
      status = 'REWRITE';
      reason = 'Latent memory rivals active truth. Re-evaluating.';
      confidence -= 0.2;
      console.warn('[CMG] REWRITE:', reason);
    }
  }

  return {
    status,
    reason,
    confidence: Number(Math.max(0, confidence).toFixed(3)),
    selected_truth: status === 'REJECT' ? null : active_truth
  };
}
