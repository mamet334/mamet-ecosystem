import { UnifiedExecutionContext, MametCapabilityMode } from './types.ts';

export function buildUnifiedExecutionContext(input: { message: string, desktopOSMode?: boolean, tools?: string[], ragEnabled?: boolean, memoryEnabled?: boolean, userId: string, userName?: string, appSource?: string, mode?: string }): UnifiedExecutionContext {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.userId)) {
    console.error('[ExecutionContext] Invalid userId:', input.userId);
    input.userId = null as any;
  }

  const isMametLite = input.appSource === 'mametlite' || input.mode === 'LITE';
  const isMametEngineer = input.appSource === 'engineer' || input.mode === 'ENGINEER';
  const mode: MametCapabilityMode = (input.mode as MametCapabilityMode) || (isMametEngineer ? "ENGINEER" : isMametLite ? "LITE" : (input.desktopOSMode ? "AI" : "LITE"));
  const isRagEnabled = input.ragEnabled !== false;
  const isMemoryEnabled = input.memoryEnabled !== false;

  const dynamicThreshold = 0.55;

  const lowerMsg = (input.message || '').toLowerCase();
  const needsWeb = /terbaru|update|berita|2024|2025|revisi|perubahan|aturan baru/.test(lowerMsg);
  const webHint = needsWeb ? "HIGH_PRIORITY" : "NORMAL";

  const engineerPolicy = isMametEngineer ? {
    canReadRAG: true, canReadMemory: true, canWriteMemory: false, canWriteKnowledge: false, canUseWorkspace: true, canUseAutomation: false
  } : null;
  
  const ctx: UnifiedExecutionContext = {
    auth: { userId: input.userId, userName: input.userName, appSource: input.appSource || 'assistant' },
    request: { originalMessage: input.message, finalMessage: input.message, lowerMsg, mode },
    policy: {
        mode, decision: "ALLOW", toolsEnabled: true, webSearchEnabled: true, riskScore: 0,
        ragTopK: mode === "LITE" ? 10 : 8, ragThreshold: dynamicThreshold, webHint,
        canReadRAG: engineerPolicy?.canReadRAG ?? true,
        canReadMemory: isMemoryEnabled && (engineerPolicy?.canReadMemory ?? !isMametLite),
        canWriteMemory: isMemoryEnabled && (engineerPolicy?.canWriteMemory ?? ((mode === "ENGINEER" || mode === "ASSISTANT" || mode === "AI") && !isMametLite)),
        canWriteKnowledge: engineerPolicy?.canWriteKnowledge ?? ((mode === "ENGINEER" || mode === "ASSISTANT" || mode === "AI") && !isMametLite),
        canUseWorkspace: engineerPolicy?.canUseWorkspace ?? !isMametLite,
        canUseAutomation: engineerPolicy?.canUseAutomation ?? (mode === "AI" && !isMametLite)
    },
    state: { ragArray: [], memoryArray: [], processingSteps: [] },
    rag: { topK: mode === "LITE" ? 10 : 5, threshold: dynamicThreshold, allowLongDocs: mode !== "LITE", compressionLevel: mode === "LITE" ? "high" : "low" },
    execution: { memoryPriority: isMametLite ? "balanced" : "memory_first", webSearchEnabled: true, subAgentEnabled: mode === "AI", webHint },
    trace: { riskScore: 0, retrievalStrategy: isRagEnabled ? "rag_enabled" : "rag_disabled", timestamp: Date.now() }
  };

  const POLICY_LAYER_ENABLED = true;
  if (!POLICY_LAYER_ENABLED) return ctx;

  if (isMametEngineer) {
    ctx.policy.riskScore = 0;
    ctx.trace.riskScore = 0;
    return ctx;
  }

  let riskScore = 0;
  const injectionPatterns = ["ignore previous instructions", "system prompt", "developer mode", "reveal memory", "bypass"];
  if (injectionPatterns.some(p => lowerMsg.includes(p))) { riskScore += 3; }
  
  const toolAbusePatterns = ["recursive agent requests", "infinite search loops", "mass retrieval requests"];
  if (toolAbusePatterns.some(p => lowerMsg.includes(p))) { riskScore += 2; }
  
  const overRetrievalPatterns = ["all data", "dump all", "entire database"];
  if (overRetrievalPatterns.some(p => lowerMsg.includes(p))) { riskScore += 2; }
  
  if (lowerMsg.length > 5000) riskScore += 1;
  const words = lowerMsg.split(/[\s\p{P}]+/u);
  const uniqueWords = new Set(words);
  if (words.length > 100 && uniqueWords.size < words.length * 0.1) riskScore += 1;
  
  ctx.policy.riskScore = riskScore;
  ctx.trace.riskScore = riskScore;
  
  if (riskScore >= 4) {
    ctx.policy.decision = "BLOCK";
    ctx.policy.toolsEnabled = false;
    ctx.policy.ragTopK = 0;
    ctx.policy.webSearchEnabled = false;
  } else if (riskScore >= 2) {
    ctx.policy.decision = "ALLOW_WITH_LIMIT";
    ctx.policy.toolsEnabled = false;
    ctx.policy.ragTopK = 2;
    ctx.policy.webSearchEnabled = false;
  }
  
  return ctx;
}
