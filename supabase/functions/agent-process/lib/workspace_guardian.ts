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

  public determineTarget(): 'SUPABASE' {
    return 'SUPABASE';
  }

  public filterTools(tools: string[], _target: 'SUPABASE'): string[] {
    return [...(tools || [])];
  }

  public getGuardianPrompt(_target: 'SUPABASE'): string {
    return '';
  }
}
