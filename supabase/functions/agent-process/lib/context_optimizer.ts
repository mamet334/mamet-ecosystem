
export const INTENT_MODES = {
  STATE_QUERY: 'STATE_QUERY',
  DELTA: 'DELTA',
  PROFILE: 'PROFILE',
  ANALYTIC: 'ANALYTIC'
};

export function parseCognitiveIntent(query: string) {
  const lower = query.toLowerCase();

  if (/(?:kenapa|mengapa|alasan|sebab|berubah|dulu|sekarang|beda)/i.test(lower)) {
    return {
      intent_mode: INTENT_MODES.DELTA,
      target_entity_types: ['ALL'],
      requires_graph: true,
      requires_causal_chain: true,
      compression_budget: 1500,
      recency_bias: 0.5
    };
  }

  if (/(?:apa kesukaanku|favorit|suka|hobi|warna|makanan|minuman|preferensi|alergi)/i.test(lower)) {
    return {
      intent_mode: INTENT_MODES.PROFILE,
      target_entity_types: ['PREFERENCE', 'ACTIVITY'],
      requires_graph: false,
      requires_causal_chain: false,
      compression_budget: 1200,
      recency_bias: 0.7 
    };
  }

  if (/(?:pola|kebiasaan|analisis|rutinitas|karakter|gaya hidup|jelaskan tentangku)/i.test(lower)) {
    return {
      intent_mode: INTENT_MODES.ANALYTIC,
      target_entity_types: ['ALL'],
      requires_graph: true,
      requires_causal_chain: false,
      compression_budget: 2000,
      recency_bias: 0.6
    };
  }

  return {
    intent_mode: INTENT_MODES.STATE_QUERY,
    target_entity_types: ['LOCATION', 'IDENTITY', 'FACT', 'OCCUPATION', 'PROJECT', 'GOAL'],
    requires_graph: false,
    requires_causal_chain: false,
    compression_budget: 800,
    recency_bias: 1.0
  };
}


export interface CognitiveExecutionContract {
  allowed_sources: string[];
  forbidden_sources: string[];
  max_nodes: number;
  max_edges: number;
  graph_traversal_depth: number;
  must_include: string[];
  must_exclude: string[];
  ranking_policy: 'STRICT_RECENCY' | 'STRICT_IMPORTANCE' | 'BALANCED' | 'CAUSAL_CHAIN';
}

export function bindCognitiveExecution(intentSpec: any): CognitiveExecutionContract {
  if (intentSpec.intent_mode === INTENT_MODES.STATE_QUERY) {
    return {
      allowed_sources: ['ACTIVE_VIEW', 'METADATA'],
      forbidden_sources: ['RAW_HISTORY', 'RELATIONS'],
      max_nodes: 5,
      max_edges: 0,
      graph_traversal_depth: 0,
      must_include: ['ACTIVE_NODE_ONLY'],
      must_exclude: ['OVERRIDDEN_NODES', 'EDGES'],
      ranking_policy: 'STRICT_IMPORTANCE'
    };
  }

  if (intentSpec.intent_mode === INTENT_MODES.DELTA) {
    return {
      allowed_sources: ['ACTIVE_VIEW', 'RELATIONS', 'RAW_HISTORY'],
      forbidden_sources: [],
      max_nodes: 8,
      max_edges: 8,
      graph_traversal_depth: 3,
      must_include: ['ACTIVE_NODE_ONLY', 'EDGES', 'REASONS'],
      must_exclude: ['UNRELATED_BUCKETS'],
      ranking_policy: 'CAUSAL_CHAIN'
    };
  }

  if (intentSpec.intent_mode === INTENT_MODES.PROFILE) {
    return {
      allowed_sources: ['ACTIVE_VIEW', 'METADATA'],
      forbidden_sources: ['RAW_HISTORY', 'RELATIONS'],
      max_nodes: 15,
      max_edges: 0,
      graph_traversal_depth: 0,
      must_include: ['ACTIVE_NODE_ONLY', 'METADATA_TAGS'],
      must_exclude: ['OVERRIDDEN_NODES', 'EDGES'],
      ranking_policy: 'STRICT_IMPORTANCE'
    };
  }

  return {
    allowed_sources: ['ACTIVE_VIEW', 'RELATIONS', 'METADATA', 'RAW_HISTORY'],
    forbidden_sources: [],
    max_nodes: 20,
    max_edges: 15,
    graph_traversal_depth: 2,
    must_include: ['ACTIVE_NODE_ONLY', 'METADATA_TAGS', 'EDGES'],
    must_exclude: ['NOISE_NODES'],
    ranking_policy: 'BALANCED'
  };
}


export interface SoftExceptionPolicy {
  allow_overshoot_if: {
    semantic_density_gain: boolean;
    missing_human_factor_risk: boolean;
  };
  soft_sources: string[];
  soft_edge_inclusion: boolean;
  budget_override_cap: number;
}

export function buildSoftExceptionPolicy(intentSpec: any): SoftExceptionPolicy {
  if (intentSpec.intent_mode === INTENT_MODES.DELTA || intentSpec.intent_mode === INTENT_MODES.ANALYTIC) {
    return {
      allow_overshoot_if: {
        semantic_density_gain: true,
        missing_human_factor_risk: true
      },
      soft_sources: ['LOW_IMPORTANCE_NODES', 'EMOTIONAL_NUANCE'],
      soft_edge_inclusion: true,
      budget_override_cap: 1.25
    };
  }

  if (intentSpec.intent_mode === INTENT_MODES.PROFILE) {
    return {
      allow_overshoot_if: {
        semantic_density_gain: true,
        missing_human_factor_risk: false
      },
      soft_sources: ['PERIPHERAL_PREFERENCES'],
      soft_edge_inclusion: false,
      budget_override_cap: 1.10
    };
  }

  return {
    allow_overshoot_if: {
      semantic_density_gain: false,
      missing_human_factor_risk: false
    },
    soft_sources: [],
    soft_edge_inclusion: false,
    budget_override_cap: 1.0
  };
}
