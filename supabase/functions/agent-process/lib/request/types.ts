import type { JejakPrompt } from '../jejak_prompt.ts';

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
    dataTabel?: boolean;
    isRagEnabled?: boolean;
    queryEmbedding?: number[];
    embeddingGagal?: { sebab?: string; pesan?: string };
    effectiveRagThreshold?: number;
    effectiveRagMatchCount?: number;
    contractValidation?: any;
    guardianPromptDirective?: string;
  };
  policy: { mode: MametCapabilityMode; ragTopK: number; ragThreshold: number; webHint?: string; canReadRAG: boolean; canReadMemory: boolean; canWriteMemory: boolean; canWriteKnowledge: boolean; canUseWorkspace: boolean; canUseAutomation: boolean; };
  state: { ragArray: any[]; memoryArray: any[]; processingSteps: string[]; jejakPrompt?: JejakPrompt; };
  rag: { topK: number; threshold: number; allowLongDocs: boolean; compressionLevel: "low" | "high"; };
  execution: { memoryPriority: "memory_first" | "balanced"; webSearchEnabled: boolean; subAgentEnabled: boolean; webHint?: string; };
  trace: { retrievalStrategy: string; timestamp: number; };
}

export interface RequestPipelineParams {
  request: Request;
  corsHeaders: HeadersInit;
}

export interface RequestPipelineResult {
  ctx: UnifiedExecutionContext;
  rctx: any;
  response?: Response;
}