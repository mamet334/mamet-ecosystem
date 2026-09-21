// Jalur folder lokal (target LOCAL, plugin file_analyzer, penanda [LOCAL FOLDER CONTENT]) dihapus 2026-09-15 (Item 85):
// tidak ada klien yang mengirimnya. Folder kerja Assistant dibangun ulang sebagai jalur baru berpagar
// (docs/roadmap/ROADMAP-FOLDER-KERJA-ASSISTANT.md).
//
// T9 (2026-09-21): penjaga ini dulu MENYUNTIKKAN sub-agent knowledge_manager ke setiap permintaan dan menyuruh
// Coordinator mengarahkan "seluruh operasi CRUD Folder/Workspace" ke sana. Plugin itu dihapus (tak pernah berhasil
// menyimpan apa pun, membuat workspace bernama kalimat chat, merusak jawaban RAG); workspace kini dikelola dari UI
// Research App. Yang tersisa hanya penentuan target penyimpanan.
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

  // Otoritas penentuan target
  public determineTarget(): 'SUPABASE' {
    return 'SUPABASE';
  }

  // Daftar tools diteruskan apa adanya (tidak ada lagi sub-agent yang disuntikkan).
  public filterTools(tools: string[], _target: 'SUPABASE'): string[] {
    return [...(tools || [])];
  }

  // Tidak ada arahan tambahan untuk Coordinator.
  public getGuardianPrompt(_target: 'SUPABASE'): string {
    return '';
  }
}
