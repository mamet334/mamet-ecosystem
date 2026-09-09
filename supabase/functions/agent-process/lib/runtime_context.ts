/**
 * RuntimeContext — Mamet AI Agent Process
 * =========================================
 * Mengelompokkan seluruh dependency request-level yang sebelumnya
 * di-capture secara implisit sebagai closure di dalam serve() handler.
 *
 * ADR-0009 Phase 5.1 — RuntimeContext Preparation
 * Tujuan: menghilangkan hidden closure dependencies sebelum module extraction.
 *
 * TIDAK ADA logic runtime di file ini. Hanya type definitions.
 */

// ─────────────────────────────────────────────
// 1. PROVIDER KEYS
// ─────────────────────────────────────────────

export interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  supabaseAnonKey: string;
  apifyApiToken: string;
  enableAsyncMemoryWrite: boolean;
}

export interface ProviderKeys {
  /** Dynamic provider key (e.g., 'openrouter', 'openai', 'custom-provider') */
  [key: string]: string | string[] | undefined;
  /** Primary Gemini API key (selected via round-robin) */
  gemini: string;
  /** All Gemini API keys for retry/rotation */
  allGemini: string[];
  groq: string;
  openRouter?: string;
  openAI: string;
}

// ─────────────────────────────────────────────
// 2. LOGGER INTERFACE
// ─────────────────────────────────────────────

/**
 * Logger interface untuk semua operasi background logging.
 * Menggantikan fungsi-fungsi `logApiUsage` dan `logAgentEvent`
 * yang sebelumnya di-capture dari closure.
 */
export interface RequestLogger {
  /**
   * Mencatat pemakaian API ke tabel `api_usage`.
   * Dipanggil setelah setiap LLM call non-streaming.
   */
  logApiUsage: (provider: string, modelName: string, inputText: string, outputText: string, actualCostUsd?: number) => void;

  /**
   * Mencatat event agent ke tabel `agent_logs`.
   * Dipanggil untuk RATE_LIMIT_HIT, FALLBACK_TRIGGERED, dll.
   */
  logAgentEvent: (eventType: string, provider: string, logMessage: string) => Promise<void>;
}

// ─────────────────────────────────────────────
// 3. STREAM CONFIG
// ─────────────────────────────────────────────

export interface StreamConfig {
  /** True jika request menggunakan SSE streaming */
  isStream: boolean;
  /** Gambar yang di-extract dari file upload, jika ada */
  extractedImage: { mimeType: string; data: string } | null;
  /** Mode OS Desktop — mengaktifkan terminal tags */
  desktopOSMode: boolean;
  /** Audit mode: 'OFF' | 'BASIC' | 'FULL' */
  auditMode: string;
}

// ─────────────────────────────────────────────
// 4. MODEL CONFIG
// ─────────────────────────────────────────────

export interface ModelConfig {
  /**
   * Model string dari request client.
   * Contoh: 'gemini-2.5-flash', 'groq/llama-3.1-8b-instant',
   *         'openrouter/anthropic/claude-sonnet-4.6'
   * Undefined = gunakan default cascade.
   */
  model: string | undefined;
  /**
   * Provider string dari request client.
   * Contoh: 'openrouter', 'openai', 'anthropic', 'custom-provider'
   * Undefined = gunakan default cascade.
   */
  provider?: string;
  /**
   * Minta model melakukan penalaran mendalam (reasoning/thinking).
   * Berasal dari slot tier Adaptive Model Tiering di BrainService.
   *
   * PENTING — semantiknya sengaja asimetris:
   *   true            = kirim parameter reasoning provider yang sesuai
   *   false/undefined = JANGAN kirim apa pun, biarkan perilaku bawaan model
   *
   * Ini BUKAN "matikan reasoning". Mematikan tidak bisa dijamin lintas provider:
   * OpenRouter menolak dengan 400 kalau parameter reasoning dikirim ke model
   * non-reasoning, dan Gemini 2.5 Pro sama sekali tidak bisa dimatikan
   * thinking-nya. Karena ai_adapter.ts dilewati SEMUA panggilan LLM (Assistant,
   * Engineer, Lite, dan pengguna eksternal mametlite), jalur aman satu-satunya
   * adalah tidak mengirim apa pun kecuali diminta eksplisit.
   */
  thinking?: boolean;
}

// ─────────────────────────────────────────────
// 5. POLICY CONFIG
// ─────────────────────────────────────────────

export interface PolicyConfig {
  canUseDesktopTools: boolean;
}

// ─────────────────────────────────────────────
// 6. RUNTIME STATE
// ─────────────────────────────────────────────

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

/**
 * State yang diakumulasi selama request lifecycle.
 * Ditulis oleh berbagai stage pipeline.
 *
 * Note: MametExecutionContext (ctx) mengandung sebagian besar state.
 * RuntimeState menampung state tambahan yang tidak ada di ctx.
 */
export interface RuntimeState {
  /** Error string yang terakumulasi dari explicit model failures */
  explicitModelErrors: string;
  /** State of the engineering lifecycle (only active for ENGINEER mode) */
  engineeringState?: EngineeringState;
}

// ─────────────────────────────────────────────
// 6. BACKGROUND TASK TRACKER
// ─────────────────────────────────────────────

/**
 * Tracker untuk background async tasks.
 * Menggantikan `safeFireAndTrack` closure.
 */
export interface BackgroundTaskTracker {
  traceId?: string;
  fire: (taskName: string, promise: Promise<any>) => void;
  awaitAll: () => Promise<void>;
}

// ─────────────────────────────────────────────
// 7. RUNTIME CONTEXT (MAIN)
// ─────────────────────────────────────────────

/**
 * RuntimeContext — single object yang merangkum seluruh
 * dependencies request-level.
 *
 * Digunakan sebagai pengganti hidden closure capture.
 * Setiap fungsi yang sebelumnya bergantung pada closure
 * sekarang menerima RuntimeContext sebagai parameter eksplisit.
 *
 * Dibuat sekali di awal request, di-pass ke semua fungsi.
 *
 * ADR-0009 Phase 5.1
 */
export interface RuntimeContext {
  /** Trace ID untuk observability & cost tracking */
  traceId: string;

  /** Provider API keys — immutable per request */
  keys: ProviderKeys;

  /** Model configuration dari request */
  model: ModelConfig;

  /** Policy parameters */
  policy: PolicyConfig;

  /** Stream dan output configuration */
  stream: StreamConfig;

  /** Logger untuk API usage dan agent events */
  logger: RequestLogger;

  /** Identitas User */
  userId?: string;

  /** Mutable runtime state */
  state: RuntimeState;

  /** Background task tracker */
  tasks: BackgroundTaskTracker;

  /** Environment variables and external endpoints */
  env: EnvironmentConfig;
}

// ─────────────────────────────────────────────
// 8. FACTORY: createBackgroundTaskTracker
// ─────────────────────────────────────────────

/**
 * Factory untuk membuat BackgroundTaskTracker.
 * Menggantikan `pendingBackgroundTasks` array + `safeFireAndTrack` closure.
 */
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

// ─────────────────────────────────────────────
// 9. FACTORY: createRuntimeLogger
// ─────────────────────────────────────────────

/**
 * Factory untuk membuat RequestLogger yang terhubung ke Supabase.
 * Menggantikan `logApiUsage` dan `logAgentEvent` closures.
 *
 * @param userId - Auth user ID untuk tagging log entries
 * @param tasks  - BackgroundTaskTracker untuk fire-and-forget logging
 * @param env - Environment configuration for Supabase credentials
 */
/**
 * TABEL TARIF — dipakai menghitung `api_usage.cost_usd`, yang dibaca RPC
 * `check_daily_quota` dan MENENTUKAN KAPAN CIRCUIT BREAKER MEMUTUS OWNER.
 * Salah di sini = Owner diblokir untuk biaya yang tidak pernah terjadi.
 *
 * URUTAN PENTING: dicocokkan dari atas ke bawah, yang PALING SPESIFIK dulu.
 * Sebelum perbaikan 2026-09-09 kodenya memakai `modelName.includes('gpt-4o')`
 * tanpa urutan, sehingga "openai/gpt-4o-mini" — yang mengandung substring
 * "gpt-4o" — ditagih dengan tarif gpt-4o. Terukur: 335.485 token input dicatat
 * $1,7119, padahal tagihan asli di dashboard OpenRouter hari itu $0,0606 untuk
 * model yang sama. Selisih 28x. Owner sepanjang hari menaikkan batas hariannya
 * ($1 → $1,5 → $2 → $3) mengejar biaya yang tidak nyata. Lihat Item 41.
 *
 * Angka di bawah diambil dari katalog resmi OpenRouter
 * (https://openrouter.ai/api/v1/models) pada 2026-09-09, dikonversi dari
 * harga per-token ke per-1K token. JANGAN diubah dari ingatan — ambil ulang
 * dari katalog. Tarif gpt-4o yang lama ($0,005/$0,015) bahkan salah untuk
 * gpt-4o sendiri; harga sebenarnya $0,0025/$0,01.
 *
 * BATAS KETELITIAN YANG DISADARI: jumlah token di sini masih ESTIMASI
 * (`Math.ceil(text.length / 4)`), bukan angka dari provider. Jadi hasilnya
 * tetap perkiraan sekalipun tarifnya benar — pada data uji 2026-09-09 hasilnya
 * $0,0517 vs $0,0606 asli. Solusi tepatnya memakai `usage` yang dikembalikan
 * provider, bukan menebak dari panjang teks. Dicatat sebagai pekerjaan terpisah.
 */
const MODEL_PRICING: Array<{ match: string; costIn: number; costOut: number }> = [
  // Paling spesifik lebih dulu — "gpt-4o-mini" WAJIB sebelum "gpt-4o".
  { match: 'gpt-4o-mini',              costIn: 0.00015,    costOut: 0.0006 },
  { match: 'gpt-4o',                   costIn: 0.0025,     costOut: 0.01 },
  { match: 'deepseek-v4-pro',          costIn: 0.00057948, costOut: 0.00173844 },
  { match: 'deepseek-v4-flash',        costIn: 0.000065,   costOut: 0.00018 },
  { match: 'llama',                    costIn: 0.00005,    costOut: 0.00008 },
];

/** Tarif cadangan kalau model tidak dikenali — sengaja konservatif (lebih mahal). */
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
      if (isStream) return; // streaming: skip per-call logging
      if (!userId) return;

      tasks.fire('LogAPIUsage', (async () => {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
        const inputTokens = Math.ceil(inputText.length / 4);
        const outputTokens = Math.ceil(outputText.length / 4);

        // Biaya sesungguhnya dari provider selalu menang. Perkiraan tabel tarif hanya
        // cadangan untuk provider yang tidak melaporkan biaya. Ini yang membuat angka
        // circuit breaker akhirnya cocok dengan tagihan nyata — lihat Item 42.
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
