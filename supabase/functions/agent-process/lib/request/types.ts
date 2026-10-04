export type MametCapabilityMode = "AI" | "LITE" | "ENGINEER";

export interface UnifiedExecutionContext {
  auth: { userId: string; userName?: string; appSource: string; };
  request: { 
    originalMessage: string; 
    finalMessage: string; 
    lowerMsg: string; 
    mode?: string;
    tools?: any[]; 
    model?: string; 
    stream?: boolean; 
    history?: any[]; 
    globalMemory?: any; 
    workspaceTarget?: string; 
    storageTarget?: string; 
    desktopOSMode?: boolean; 
    auditMode?: string; 
    extractedImage?: any; 
    routingDecision?: any; 
    agentIdentityPrompt?: string; 
    userContextPrompt?: string; 
    ragEnabled?: boolean;
    memoryEnabled?: boolean;
    dataTabel?: boolean; // tombol Data Tabel (Item 92 Tahap 3)
    isRagEnabled?: boolean;
    /**
     * Vektor pertanyaan, dibuat SEKALI di `request_pipeline` lalu dipakai ulang oleh pencarian
     * dokumen di `context_builder`. Dulu diselipkan lewat `as any`.
     */
    queryEmbedding?: number[];
    /**
     * Terisi bila pembuatan vektor di hulu GAGAL, beserta sebabnya.
     *
     * Dua titik panggil dulu tidak saling tahu: `request_pipeline` gagal dan melempar sehingga
     * `queryEmbedding` tak pernah disetel, lalu `context_builder` memanggil pintu embedding
     * sekali lagi — gagal untuk alasan yang sama, milidetik kemudian. Terekam di log 1 Okt:
     * dua `[Embedding] Gagal (SALDO_HABIS)` berjarak 183 ms untuk SATU pesan.
     *
     * Medan ini bukan kebijakan ulang-coba; ia hanya membuat percobaan kedua tahu bahwa yang
     * pertama sudah terjadi.
     */
    embeddingGagal?: { sebab?: string; pesan?: string };
    effectiveRagThreshold?: number;
    effectiveRagMatchCount?: number;
    contractValidation?: any;
    guardianPromptDirective?: string;
  };
  policy: { mode: MametCapabilityMode; decision: "ALLOW" | "ALLOW_WITH_LIMIT" | "BLOCK"; toolsEnabled: boolean; webSearchEnabled: boolean; riskScore: number; ragTopK: number; ragThreshold: number; webHint?: string; canReadRAG: boolean; canReadMemory: boolean; canWriteMemory: boolean; canWriteKnowledge: boolean; canUseWorkspace: boolean; canUseAutomation: boolean; };
  state: { ragArray: any[]; memoryArray: any[]; processingSteps: string[]; };
  rag: { topK: number; threshold: number; allowLongDocs: boolean; compressionLevel: "low" | "high"; };
  execution: { memoryPriority: "memory_first" | "balanced"; webSearchEnabled: boolean; subAgentEnabled: boolean; webHint?: string; };
  trace: { riskScore: number; retrievalStrategy: string; timestamp: number; };
}

export interface RequestPipelineParams {
  request: Request;
  corsHeaders: HeadersInit;
}

export interface RequestPipelineResult {
  ctx: UnifiedExecutionContext;
  rctx: any; // RuntimeContext
  response?: Response;
}