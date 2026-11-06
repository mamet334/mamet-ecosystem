
export interface EvidenceReport {
  requestId: string;
  userId: string;
  mode: string;
  brain1Count: number;
  brain2Count: number;
  ragCount: number;
  memoryCount: number;
  totalEvidence: number;
  isValid: boolean;
  blockReason: string | null;
  verdict: 'PASSED' | 'BLOCKED' | 'WARNING';
  gateVerdictText: string;
}

export interface EvidenceInput {
  requestId?: string;
  userId: string;
  mode: string;
  brain1Ids: string[];
  brain2Tasks: string[];
  brain2Gaps: string[];
  brain2Verifications: string[];
  ragArray: any[];
  memoryArray: any[];
}

export interface SourceTraceItem {
  type: 'ADR' | 'TASK' | 'GAP' | 'VERIFICATION' | 'RAG' | 'MEMORY' | 'LESSON' | 'VISION' | 'MAEF' | 'SOLUTION' | 'OTHER';
  id: string;
  title: string;
  govStatus?: string;
  version?: string;
  isCurrent?: boolean;
  relationship?: string;
}

export interface ConfidenceReport {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    baseScore: number;
    evidenceBonus: number;
    conflictPenalty: number;
    versionBonus: number;
    verificationBonus: number;
    engineerBrainPenalty: number;
  };
  signals: {
    evidenceCount: number;
    activeConflicts: number;
    versionStatus: 'CURRENT' | 'OUTDATED' | 'UNKNOWN';
    hasVerification: boolean;
    mode: string;
  };
  sourceTrace: SourceTraceItem[];
  summaryText: string;
  label: string;
}

export interface ConfidenceInput {
  mode: string;
  brain1Ids: string[];
  brain1Entries?: Array<{
    id: string;
    entry_type: string;
    title: string;
    governance_status?: string;
    version_major?: number;
    version_minor?: number;
    version_patch?: number;
    is_current?: boolean;
  }>;
  brain2Tasks: string[];
  brain2Gaps: string[];
  brain2Verifications: string[];
  ragDocs: string[];
  memoryCount: number;
  activeConflicts?: number;
  hasVerification?: boolean;
  allCurrent?: boolean;
}

export type MametMode = 'LITE' | 'AI' | 'ENGINEER';
export type PolicyAction =
  | 'CALL_LLM'
  | 'WRITE_MEMORY'
  | 'READ_MEMORY'
  | 'USE_WEB_SEARCH'
  | 'USE_AUTOMATION'
  | 'USE_DESKTOP_TOOLS'
  | 'WRITE_KNOWLEDGE'
  | 'USE_WORKSPACE'
  | 'ANSWER_WITHOUT_EVIDENCE'
  | 'USE_SUB_AGENTS'
  | 'READ_DEPRECATED_KNOWLEDGE'
  | 'READ_DRAFT_KNOWLEDGE';

export interface PolicyContext {
  mode: MametMode;
  evidenceCount: number;
  riskScore: number;
  appSource: string;
  hasActiveConflicts?: boolean;
  govStatus?: string;
}

export interface PolicyDecision {
  allow: boolean;
  reason: string;
  constraints: string[];
  auditNote: string;
  severity: 'INFO' | 'WARNING' | 'BLOCK';
}

export interface IdentityBlock {
  name: string;
  version: string;
  mode: string;
  appSource: string;
  capabilities: string[];
  restrictions: string[];
}

export interface MemoryBlock {
  hasMemory: boolean;
  memoryCount: number;
  memoryContext: string;
}

export interface KnowledgeBlock {
  hasBrain1: boolean;
  brain1Count: number;
  brain1Summary: string;
  hasBrain2: boolean;
  brain2Count: number;
  brain2Summary: string;
  hasRAG: boolean;
  ragCount: number;
  ragSummary: string;
}

export interface RuntimeBlock {
  evidenceGateVerdict: 'PASSED' | 'BLOCKED' | 'WARNING';
  totalEvidence: number;
  confidenceScore: number;
  confidenceGrade: string;
  activeConflicts: number;
  versionStatus: string;
  requestId: string;
  timestamp: string;
}

export interface ConstraintBlock {
  canCallLLM: boolean;
  canWriteMemory: boolean;
  canReadMemory: boolean;
  canUseWebSearch: boolean;
  canUseAutomation: boolean;
  canUseDesktopTools: boolean;
  canWriteKnowledge: boolean;
  activeConstraints: string[];
  forbidden: string[];
}

export interface OutputContractBlock {
  language: string;
  expectedFormat: string;
  requireSourceTrace: boolean;
  requireConfidenceStatement: boolean;
  maxResponseLength?: number;
  forbiddenPatterns: string[];
  labelVariant?: 'full' | 'short';
}


export interface UniversalEvidenceContract {
  identity: IdentityBlock;
  memory: MemoryBlock;
  knowledge: KnowledgeBlock;
  runtime: RuntimeBlock;
  constraint: ConstraintBlock;
  outputContract: OutputContractBlock;
  systemBasePrompt: string;
  hasilAlatFolder?: boolean;
  keluaranPerintah?: boolean;
  asSystemPromptText: () => string;
}

export interface ContractBuilderInput {
  mode: string;
  appSource: string;
  userId: string;
  evidenceReport: EvidenceReport;
  confidenceReport: ConfidenceReport;
  brain1Entries: any[];
  brain2Tasks: string[];
  brain2Gaps: string[];
  brain2Verifications: string[];
  ragArray: any[];
  memoryArray: any[];
  memoryContextText: string;
  brain1ContextText: string;
  brain2ContextText: string;
  ragContextText: string;
  policyConstraints: string[];
  policyForbidden: string[];
  systemBasePrompt: string;
  activeConflicts?: number;
  hasilAlatFolder?: boolean;
  keluaranPerintah?: boolean;
}
