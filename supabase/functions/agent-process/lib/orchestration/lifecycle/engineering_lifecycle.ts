import { EngineeringState, RuntimeContext } from '../../runtime_context.ts';
import { eventBus } from '../../event/event_bus.ts';

export class EngineeringLifecycleManager {
  static determineState(userMessage: string, previousState?: EngineeringState, currentTraceId?: string): EngineeringState {
    const msg = (userMessage || '').trim();
    
    const defaultState: EngineeringState = {
      phase: 'OBSERVE_ANALYZE',
      ownerApprovalGranted: false
    };

    let currentState = previousState || defaultState;
    let newState: EngineeringState | null = null;

    if (currentTraceId && currentState.approval && currentState.approval.targetTaskId !== currentTraceId) {
        currentState = defaultState;
        
        eventBus.emit({
          type: 'EngineeringLifecycle.PhaseChanged',
          source: 'EngineeringLifecycleManager',
          payload: { fromPhase: previousState?.phase, toPhase: 'OBSERVE_ANALYZE', approved: false, intent: 'AUTO_REVOKE' }
        });
    }

    if (msg.includes('ENGINEER:OBSERVE')) {
      newState = { phase: 'OBSERVE_ANALYZE', ownerApprovalGranted: false };
    } else if (msg.includes('ENGINEER:PROPOSAL')) {
      newState = { phase: 'PROPOSAL', ownerApprovalGranted: false };
    } else if (msg.includes('ENGINEER:APPROVE')) {
      newState = { 
        phase: 'IMPLEMENTATION', 
        ownerApprovalGranted: true,
        approval: { targetTaskId: currentTraceId || 'unknown', grantedAt: Date.now(), status: 'ACTIVE' }
      };
    } else if (msg.includes('ENGINEER:VERIFY')) {
      newState = { 
        phase: 'VERIFICATION_DOCUMENTATION', 
        ownerApprovalGranted: true,
        approval: { targetTaskId: currentTraceId || 'unknown', grantedAt: Date.now(), status: 'ACTIVE' }
      };
    }

    if (newState && newState.phase !== currentState.phase) {
      eventBus.emit({
        type: 'EngineeringLifecycle.PhaseChanged',
        source: 'EngineeringLifecycleManager',
        payload: {
          fromPhase: currentState.phase,
          toPhase: newState.phase,
          approved: newState.ownerApprovalGranted,
          intent: msg
        }
      });
      if (newState.phase === 'IMPLEMENTATION') {
        eventBus.emit({
          type: 'EngineeringLifecycle.ApprovalGranted',
          source: 'EngineeringLifecycleManager',
          payload: { timestamp: new Date().toISOString(), contextId: 'runtime-session' }
        });
      }
      return newState;
    }

    return currentState;
  }

  static filterTools(tools: any[], state: EngineeringState): any[] {
    if (!tools) return [];

    const allowedToolNames = new Set<string>();

    allowedToolNames.add('view_file');
    allowedToolNames.add('list_dir');
    allowedToolNames.add('grep_search');
    
    allowedToolNames.add('run_command');
    allowedToolNames.add('command_status');
    allowedToolNames.add('send_command_input');

    if (state.phase === 'PROPOSAL') {
      allowedToolNames.add('write_to_file');
      allowedToolNames.add('replace_file_content');
      allowedToolNames.add('multi_replace_file_content');
    }

    if (state.phase === 'IMPLEMENTATION' && state.ownerApprovalGranted) {
      return tools; 
    }

    if (state.phase === 'VERIFICATION_DOCUMENTATION' && state.ownerApprovalGranted) {
      return tools;
    }

    return tools.filter(tool => {
      const name = tool.name || tool.function?.name;
      return allowedToolNames.has(name);
    });
  }

  static enforcePolicy(toolName: string, args: any, state: EngineeringState, rctx: RuntimeContext): { allowed: boolean; reason?: string } {
    const safeTools = ['view_file', 'list_dir', 'grep_search', 'command_status', 'send_command_input', 'run_command', 'search_web', 'read_url_content'];
    if (safeTools.includes(toolName)) {
      return { allowed: true };
    }

    const writeTools = ['write_to_file', 'replace_file_content', 'multi_replace_file_content'];
    if (writeTools.includes(toolName)) {
      
      if (state.phase === 'OBSERVE_ANALYZE') {
        const reason = `[DENY] Tool ${toolName} is not allowed in OBSERVE_ANALYZE phase.`;
        this.logDeny(rctx, state, toolName, args, reason);
        return { allowed: false, reason };
      }

      if (state.phase === 'PROPOSAL') {
        const targetPath = args.TargetFile || args.AbsolutePath || '';
        
        const normalizedPath = targetPath.replace(/\\/g, '/');
        
        const isSafePath = normalizedPath.startsWith('docs/') || normalizedPath.startsWith('scratch/');
        
        if (!isSafePath) {
          const reason = `[DENY] Tool ${toolName} on path '${targetPath}' is denied during PROPOSAL phase. Only docs/ and scratch/ are allowed.`;
          this.logDeny(rctx, state, toolName, args, reason);
          return { allowed: false, reason };
        }
      }

      if ((state.phase === 'IMPLEMENTATION' || state.phase === 'VERIFICATION_DOCUMENTATION') && state.ownerApprovalGranted) {
        return { allowed: true };
      }
    }

    const reason = `[DENY] Tool ${toolName} blocked by Engineering Policy fallback. Phase: ${state.phase}.`;
    this.logDeny(rctx, state, toolName, args, reason);
    return { allowed: false, reason };
  }

  private static logDeny(rctx: RuntimeContext, state: EngineeringState, toolName: string, args: any, reason: string) {
    if (rctx && rctx.logger) {
      let targetResource = args.TargetFile || args.AbsolutePath || args.DirectoryPath || args.CommandLine || 'unknown';
      const metadata = {
        phase: state.phase,
        ownerApprovalGranted: state.ownerApprovalGranted,
        capability_group: 'WRITE',
        attempted_tool: toolName,
        target_resource: targetResource,
        reason: reason
      };
      rctx.logger.logAgentEvent('ENGINEERING_POLICY_DENY', 'system', JSON.stringify(metadata)).catch(e => console.error('[Log Error]', e));
    }
    
    eventBus.emit({
      type: 'EngineeringLifecycle.ViolationAttempt',
      source: 'EngineeringLifecycleManager',
      payload: {
        attemptedTool: toolName,
        currentState: state.phase,
        denyReason: 'LIFECYCLE_RESTRICTION'
      }
    });
  }
}
