import type { UnifiedExecutionContext } from './types.ts';

export function saringAlatMenurutKemampuan(ctx: UnifiedExecutionContext): void {
  if (ctx.request.tools && Array.isArray(ctx.request.tools)) {
    ctx.request.tools = ctx.request.tools.filter(t => {
      if (t === 'cron_manager' && !ctx.policy.canUseAutomation) { console.warn(`[CAPABILITY_BLOCK] Tool '${t}' blocked: canUseAutomation=false (mode=${ctx.policy.mode})`); return false; }
      return true;
    });
  }
}
