import { UnifiedExecutionContext, MametCapabilityMode } from './types.ts';

export function buildUnifiedExecutionContext(input: { message: string, desktopOSMode?: boolean, tools?: string[], ragEnabled?: boolean, userId: string, userName?: string, appSource?: string, mode?: string }): UnifiedExecutionContext {
  // UUID Validation - Fix for "SUPABASE" string error
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.userId)) {
    console.error('[ExecutionContext] Invalid userId:', input.userId);
    input.userId = null as any;
  }

  const isMametLite = input.appSource === 'mametlite' || input.mode === 'LITE';
  const isMametEngineer = input.appSource === 'engineer' || input.mode === 'ENGINEER';
  const mode: MametCapabilityMode = (input.mode as MametCapabilityMode) || (isMametEngineer ? "ENGINEER" : isMametLite ? "LITE" : (input.desktopOSMode ? "AI" : "LITE"));
  const isRagEnabled = input.ragEnabled !== false;
  
  // AMBANG PENCARIAN DOKUMEN: 0,55 tetap (Item 65, 2026-09-11) — menggantikan 0,60/0,65/0,68
  // menurut panjang pertanyaan. Diukur di Item 63 dengan 33 potongan HCDP, 8 pertanyaan
  // berjawaban pasti, model gemini-embedding-2: potongan benar berskor 0,649–0,803, pertanyaan
  // kontrol tak berhubungan maksimal 0,455. Ambang 0,65 membuang satu jawaban benar (0,649).
  // 0,55 meloloskan 8/8 dengan jarak 0,1 dari kontrol; jumlah tetap dibatasi ragTopK.
  // Ambang MEMORI (match_memories, request_pipeline.ts) terpisah dan tidak diubah di sini.
  const dynamicThreshold = 0.55;

  const lowerMsg = (input.message || '').toLowerCase();
  const needsWeb = /terbaru|update|berita|2024|2025|revisi|perubahan|aturan baru/.test(lowerMsg);
  const webHint = needsWeb ? "HIGH_PRIORITY" : "NORMAL";

  const engineerPolicy = isMametEngineer ? {
    canReadRAG: true, canReadMemory: true, canWriteMemory: false, canWriteKnowledge: false, canUseWorkspace: true, canUseAutomation: false, canUseDesktopTools: false
  } : null;
  
  const ctx: UnifiedExecutionContext = {
    auth: { userId: input.userId, userName: input.userName, appSource: input.appSource || 'assistant' },
    request: { originalMessage: input.message, finalMessage: input.message, lowerMsg, mode },
    policy: {
        mode, decision: "ALLOW", toolsEnabled: true, webSearchEnabled: true, riskScore: 0,
        // 8 potongan (dulu 5) sejak potongan 800 huruf (Item 70): 8 × ±800 = ±6.400 huruf dokumen
        // per jawaban — tetap jauh di bawah 5 × 4.500 = 22.500 sebelumnya, dengan potongan tetangga
        // ikut terbawa (jawaban di peringkat #2 pun masuk). LITE sudah 10.
        ragTopK: mode === "LITE" ? 10 : 8, ragThreshold: dynamicThreshold, webHint,
        canReadRAG: engineerPolicy?.canReadRAG ?? true,
        canReadMemory: engineerPolicy?.canReadMemory ?? !isMametLite,
        canWriteMemory: engineerPolicy?.canWriteMemory ?? ((mode === "ENGINEER" || mode === "ASSISTANT" || mode === "AI") && !isMametLite),
        canWriteKnowledge: engineerPolicy?.canWriteKnowledge ?? ((mode === "ENGINEER" || mode === "ASSISTANT" || mode === "AI") && !isMametLite),
        canUseWorkspace: engineerPolicy?.canUseWorkspace ?? !isMametLite,
        canUseAutomation: engineerPolicy?.canUseAutomation ?? (mode === "AI" && !isMametLite),
        canUseDesktopTools: engineerPolicy?.canUseDesktopTools ?? (mode === "AI")
    },
    state: { ragArray: [], memoryArray: [], processingSteps: [] },
    rag: { topK: mode === "LITE" ? 10 : 5, threshold: dynamicThreshold, allowLongDocs: mode !== "LITE", compressionLevel: mode === "LITE" ? "high" : "low" },
    execution: { memoryPriority: isMametLite ? "balanced" : "memory_first", webSearchEnabled: true, subAgentEnabled: mode === "AI", webHint },
    trace: { riskScore: 0, retrievalStrategy: isRagEnabled ? "rag_enabled" : "rag_disabled", timestamp: Date.now() }
  };

  const POLICY_LAYER_ENABLED = true;
  if (!POLICY_LAYER_ENABLED) return ctx;

  // ENGINEER mode sudah divalidasi dengan BYOK key di request_pipeline.ts.
  // Prompt Engineer berisi kode source file (panjang, banyak token berulang) yang
  // secara salah memicu riskScore >= 4 → BLOCK. Exempt dari policy risk scoring.
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
