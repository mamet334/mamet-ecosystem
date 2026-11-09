import type { UnifiedExecutionContext, MametCapabilityMode } from './types.ts';

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
        mode,
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
    trace: { retrievalStrategy: isRagEnabled ? "rag_enabled" : "rag_disabled", timestamp: Date.now() }
  };

  return ctx;
}
