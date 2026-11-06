

export interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  supabaseAnonKey: string;
  apifyApiToken: string;
  enableAsyncMemoryWrite: boolean;
  hakimBayangan?: string;
}

export interface ProviderKeys {
  [key: string]: string | string[] | undefined;
  gemini: string;
  allGemini: string[];
  groq: string;
  openRouter?: string;
  openRouterByok?: string;
  openAI: string;
}


export interface RequestLogger {
  logApiUsage: (provider: string, modelName: string, inputText: string, outputText: string, actualCostUsd?: number) => void;

  logAgentEvent: (eventType: string, provider: string, logMessage: string) => Promise<void>;
}


export interface StreamConfig {
  isStream: boolean;
  extractedImage: { mimeType: string; data: string } | null;
  desktopOSMode: boolean;
  auditMode: string;
  streamNalar?: boolean;
  kirimNalar?: (ev: { tipe: 'nalar' | 'nalar_selesai'; teks?: string }) => void;
  mulaiPermintaan?: number;
  jawabanTerpotong?: boolean;
}


export interface ModelConfig {
  model: string | undefined;
  provider?: string;
  thinking?: boolean;
  pemilih?: string;
}


export type PolicyConfig = Record<string, never>;


export type EngineeringPhase = 'OBSERVE_ANALYZE' | 'PROPOSAL' | 'IMPLEMENTATION' | 'VERIFICATION_DOCUMENTATION';

export interface EphemeralApproval {
  targetTaskId: string;
  grantedAt: number;
  status: 'ACTIVE' | 'EXHAUSTED' | 'REVOKED';
}

export interface EngineeringState {
  phase: EngineeringPhase;
  ownerApprovalGranted: boolean;
  approval?: EphemeralApproval;
}

export interface RuntimeState {
  explicitModelErrors: string;
  engineeringState?: EngineeringState;
}


export interface BackgroundTaskTracker {
  traceId?: string;
  fire: (taskName: string, promise: Promise<any>) => void;
  awaitAll: () => Promise<void>;
}


export interface RuntimeContext {
  traceId: string;

  keys: ProviderKeys;

  model: ModelConfig;

  policy: PolicyConfig;

  stream: StreamConfig;

  logger: RequestLogger;

  userId?: string;

  state: RuntimeState;

  tasks: BackgroundTaskTracker;

  env: EnvironmentConfig;
}


export function createBackgroundTaskTracker(traceId?: string): BackgroundTaskTracker {
  const pending: Promise<any>[] = [];

  return {
    traceId,
    fire(taskName: string, promise: Promise<any>): void {
      const start = Date.now();
      const tracked = promise
        .then(() => {
          console.log(`[BACKGROUND_TASK_SUCCESS] ${taskName} selesai (${Date.now() - start}ms)`);
        })
        .catch((err) => {
          console.error(`[BACKGROUND_TASK_FAILED] ${taskName} gagal:`, err);
        });
      pending.push(tracked);
    },

    async awaitAll(): Promise<void> {
      if (pending.length > 0) {
        await Promise.allSettled(pending);
      }
    },
  };
}


const MODEL_PRICING: Array<{ match: string; costIn: number; costOut: number }> = [
  { match: 'gpt-4o-mini',              costIn: 0.00015,    costOut: 0.0006 },
  { match: 'gpt-4o',                   costIn: 0.0025,     costOut: 0.01 },
  { match: 'deepseek-v4-pro',          costIn: 0.00057948, costOut: 0.00173844 },
  { match: 'deepseek-v4-flash',        costIn: 0.000065,   costOut: 0.00018 },
  { match: 'llama',                    costIn: 0.00005,    costOut: 0.00008 },
  { match: 'gpt-oss-120b',             costIn: 0.00015,    costOut: 0.0006 },
  { match: 'gpt-oss-20b',              costIn: 0.000075,   costOut: 0.0003 },
];

const FALLBACK_PRICING = { costIn: 0.0001, costOut: 0.0002 };

function resolveModelPricing(modelName: string): { costIn: number; costOut: number } {
  const name = (modelName || '').toLowerCase();
  for (const row of MODEL_PRICING) {
    if (name.includes(row.match)) return { costIn: row.costIn, costOut: row.costOut };
  }
  console.log(`[Pricing] Model "${modelName}" tidak ada di tabel tarif — memakai tarif cadangan`);
  return FALLBACK_PRICING;
}

export function createRuntimeLogger(
  userId: string,
  tasks: BackgroundTaskTracker,
  isStream: boolean,
  env: EnvironmentConfig
): RequestLogger {

  return {
    logApiUsage(provider: string, modelName: string, inputText: string, outputText: string, actualCostUsd?: number): void {
      if (isStream) return;
      if (!userId) return;

      tasks.fire('LogAPIUsage', (async () => {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
        const inputTokens = Math.ceil(inputText.length / 4);
        const outputTokens = Math.ceil(outputText.length / 4);

        let totalCost: number;
        if (typeof actualCostUsd === 'number' && isFinite(actualCostUsd) && actualCostUsd >= 0) {
          totalCost = actualCostUsd;
        } else {
          const { costIn, costOut } = resolveModelPricing(modelName);
          totalCost = ((inputTokens / 1000) * costIn) + ((outputTokens / 1000) * costOut);
        }
        const supClient = createClient(
          env.supabaseUrl,
          env.supabaseServiceKey
        );
        await supClient.from('api_usage').insert([{
          user_id: userId, provider, model: modelName,
          input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: totalCost
        }]);
      })());
    },

    async logAgentEvent(eventType: string, provider: string, logMessage: string): Promise<void> {
      tasks.fire('LogAgentEvent', (async () => {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
        const supClient = createClient(
          env.supabaseUrl,
          env.supabaseServiceKey
        );
        await supClient.from('agent_logs').insert([{
          user_id: userId || null, event_type: eventType, provider, message: logMessage
        }]);
      })());
    },
  };
}
