import { EngineeringLifecycleManager } from '../lifecycle/engineering_lifecycle.ts';
import { RuntimeContext } from '../../runtime_context.ts';
import { PolicyEnforcer } from '../../policy/policy_enforcer.ts';

export type DispatcherDecision = 'ALLOW' | 'ALLOW_WITH_LIMIT' | 'DENY' | 'REQUIRE_USER_APPROVAL' | 'WOULD_DENY' | 'WOULD_REQUIRE_APPROVAL';

export interface DispatcherResult {
  decision: DispatcherDecision;
  reason?: string;
}

export class ToolDispatcher {
  static async execute(
    toolName: string,
    args: any,
    rctx: RuntimeContext,
    executionFn: () => Promise<any>
  ): Promise<any> {
    const shadowMode = false;
    let finalDecision: DispatcherDecision = 'ALLOW';
    let denyReason = '';

    try {
      if (!rctx || !rctx.policy || !rctx.state) {
          throw new Error('[ToolDispatcher] Critical Error: RuntimeContext is malformed or null.');
      }

      if (typeof rctx.state._dispatchDepth !== 'number') {
          rctx.state._dispatchDepth = 0;
      }
      
      const MAX_DISPATCH_DEPTH = 5;
      if (rctx.state._dispatchDepth >= MAX_DISPATCH_DEPTH) {
          throw new Error(`[ToolDispatcher] Maximum dispatch depth exceeded (${MAX_DISPATCH_DEPTH}) for tool: ${toolName}. Execution aborted.`);
      }
      
      rctx.state._dispatchDepth++;

      if (rctx.policy.mode === 'ENGINEER' && rctx.state.engineeringState) {
         const policyRes = EngineeringLifecycleManager.enforcePolicy(toolName, args, rctx.state.engineeringState, rctx);
         if (!policyRes.allowed) {
            finalDecision = shadowMode ? 'WOULD_DENY' : 'DENY';
            denyReason = policyRes.reason || 'Blocked by EngineeringLifecycleManager';
         }
      }

      if (finalDecision === 'ALLOW' && this.isHighRisk(toolName, args)) {
         finalDecision = shadowMode ? 'WOULD_DENY' : 'DENY';
         denyReason = 'Risk Gate: High risk operation detected (e.g. destructive commands or outside workspace).';
      }

      if (finalDecision === 'ALLOW') {
         let workspaceId = 'ws-assistant';
         if (rctx.policy.mode === 'ENGINEER') workspaceId = 'ws-engineer';
         if (rctx.policy.mode === 'LITE') workspaceId = 'ws-lite';
         if (rctx.policy.mode === 'ASSISTANT') workspaceId = 'ws-assistant';

         const toolPolicyDecision = PolicyEnforcer.canUseTool(workspaceId, toolName);
         if (toolPolicyDecision === 'DENY') {
             finalDecision = shadowMode ? 'WOULD_DENY' : 'DENY';
             denyReason = `HARD POLICY ENFORCEMENT: Workspace ${workspaceId} is not permitted to use tool ${toolName}.`;
         }
      }

    } catch (e: any) {
      finalDecision = 'DENY';
      denyReason = `Dispatcher internal error during policy check: ${e.message}`;
      await this.logTelemetry(toolName, args, finalDecision, denyReason, rctx);
      if (rctx?.state?._dispatchDepth) rctx.state._dispatchDepth--;
      throw new Error(`[DENY_ON_INTERNAL_ERROR] ${denyReason}`);
    }
    
    await this.logTelemetry(toolName, args, finalDecision, denyReason, rctx);

    if (!shadowMode && (finalDecision === 'DENY' || finalDecision === 'REQUIRE_USER_APPROVAL')) {
      if (rctx?.state?._dispatchDepth) rctx.state._dispatchDepth--;
      throw new Error(denyReason);
    }

    try {
        return await executionFn();
    } finally {
        if (rctx?.state?._dispatchDepth) rctx.state._dispatchDepth--;
    }
  }

  private static isHighRisk(toolName: string, args: any): boolean {
    if (toolName === 'run_command' && args?.CommandLine) {
      const cmd = args.CommandLine.toLowerCase();
      
      const dangerousPatterns = [
          'rm -rf', 'rm -r ', 'del /s /q', 'format ',
          'remove-item', 'rmdir', 'shred ', 'dd if=', 
          'os.remove', 'shutil.rmtree',
          'base64', 'certutil', 'wget ', 'curl '
      ];
      
      for (const pattern of dangerousPatterns) {
          if (cmd.includes(pattern)) return true;
      }
      
      const chainedPatterns = ['&&', '||', ';', '|'];
      for (const pattern of chainedPatterns) {
          if (cmd.includes(pattern)) return true;
      }
    }
    return false;
  }

  private static async logTelemetry(toolName: string, args: any, decision: DispatcherDecision, reason: string, rctx: RuntimeContext) {
    if (!rctx?.logger) return;
    
    const targetResource = args?.TargetFile || args?.AbsolutePath || args?.task || args?.CommandLine || 'unknown';
    const metadata = {
       dispatcher_mode: decision === 'WOULD_DENY' ? 'SHADOW' : 'ENFORCED',
       tool_name: toolName,
       target: targetResource,
       decision: decision,
       reason: reason,
       timestamp: new Date().toISOString()
    };

    try {
        await rctx.logger.logAgentEvent('TOOL_DISPATCHER_AUDIT', 'system', JSON.stringify(metadata));
    } catch(e) {
        console.error('[ToolDispatcher] Failed to log telemetry:', e);
    }
  }
}
