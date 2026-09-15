// Jalur folder lokal (target LOCAL, plugin file_analyzer, penanda [LOCAL FOLDER CONTENT]) dihapus 2026-09-15 (Item 85):
// tidak ada klien yang mengirimnya. Folder kerja Assistant dibangun ulang sebagai jalur baru berpagar
// (docs/roadmap/ROADMAP-FOLDER-KERJA-ASSISTANT.md). Penjaga ini kini hanya mengunci operasi workspace ke Cloud RAG.
export type WorkspaceTarget = 'AUTO' | 'SUPABASE';

export interface GuardianState {
  workspaceTarget: string;
  message: string;
}

export class WorkspaceGuardian {
  private state: GuardianState;

  constructor(state: GuardianState) {
    this.state = state;
  }

  // 1. Otoritas penentuan target
  public determineTarget(): 'SUPABASE' {
    return 'SUPABASE';
  }

  // 2. Proteksi tool (Mencegah LLM salah pilih)
  public filterTools(tools: string[], _target: 'SUPABASE'): string[] {
    const safeTools = [...(tools || [])];
    if (!safeTools.includes('knowledge_manager')) safeTools.push('knowledge_manager');
    return safeTools;
  }

  // 3. Otoritas Prompt LLM (Instruksi Mutlak)
  public getGuardianPrompt(_target: 'SUPABASE'): string {
    return `\n[WORKSPACE GUARDIAN: SUPABASE LOCKED] Seluruh operasi CRUD Folder/Workspace WAJIB diarahkan ke knowledge_manager (Cloud RAG).`;
  }
}
