import { MAEFExecutionResult } from '../maef/maef_contract.ts';
import { initializeEventSubscribers } from '../event/subscribers/registry.ts';
import { MAEFStateMachine } from '../maef/maef_state_machine.ts';
import { ContextBuilderHandler } from './handlers/context_builder.ts';
import { IntentRouterHandler } from './handlers/intent_router.ts';
import { ExecutionPlannerHandler } from './handlers/execution_handler.ts';
import { SynthesisHandler } from './handlers/synthesis_handler.ts';
import { EngineeringLifecycleManager } from './lifecycle/engineering_lifecycle.ts';
import { temukanLanjutan } from '../streaming/batas_waktu.ts';

export const coreEngine = {
  async execute(ctx: any, rctx: any): Promise<MAEFExecutionResult> {
    initializeEventSubscribers();
    const maef = new MAEFStateMachine();

    let model = rctx.model.model;
    let tools = ctx.request.tools;

    if (ctx.request.mode === 'ENGINEER' || ctx.policy.mode === 'ENGINEER') {
      const prevState = rctx.state.engineeringState;
      
      const intentCommand = ctx.request.command || ctx.request.action || ctx.request.finalMessage;
      const currentTraceId = ctx.request.trace_id || ctx.traceId || (rctx.tasks ? rctx.tasks.traceId : undefined);
      
      const newState = EngineeringLifecycleManager.determineState(intentCommand, prevState, currentTraceId);
      rctx.state.engineeringState = newState;
      tools = EngineeringLifecycleManager.filterTools(tools, newState);
      ctx.request.tools = tools;
    }

    let groundingSources: any[] = [];
    let toolExecution: any = null;
    let subagentRuns: any[] = [];
    let contractValidation = ctx.request.contractValidation;
    let routingDecision = ctx.request.routingDecision;

    const contextResult = await ContextBuilderHandler.handle(ctx, rctx, maef);
    
    if (contextResult.isBlocked) {
       return contextResult.response;
    }

    const { fullSystemContext, evidenceReport, confidenceReport } = contextResult;
    routingDecision = contextResult.routingDecision || routingDecision;

    const lanjutan = !ctx.request.stream ? temukanLanjutan(ctx.request.finalMessage, ctx.request.history) : null;

    let routerResult: any;
    const dataTabelSelesai = (ctx.state as any).dataTabel?.status === 'ok';
    if (lanjutan || dataTabelSelesai) {
      maef.evaluatePhaseResult('CONTEXT_BUILD', { skipPhases: ['ORCHESTRATION', 'TOOL_EXECUTION'] });
      routerResult = { isChatBiasa: true, plan: [], contractValidation };
      if (dataTabelSelesai) ctx.state.processingSteps.push('📊 [DATA TABEL] jawaban dari data tabel — Coordinator & sub-agent dilewati');
    } else {
      routerResult = await IntentRouterHandler.handle(ctx, rctx, maef);
    }
    const { isChatBiasa, plan } = routerResult;
    contractValidation = routerResult.contractValidation || contractValidation;

    let accumulatedContext = `Permintaan awal user: "${ctx.request.finalMessage}"\n\n`;
    
    if (plan && plan.length > 0 && maef.shouldExecutePhase('ORCHESTRATION')) {
        const executionResult = await ExecutionPlannerHandler.execute(plan, ctx, rctx, maef, accumulatedContext, model);
        accumulatedContext = executionResult.accumulatedContext;
        subagentRuns = executionResult.subagentRuns;
    }

    const synthesisState = {
      isChatBiasa,
      fullSystemContext,
      accumulatedContext,
      confidenceReport,
      evidenceReport,
      tools,
      groundingSources,
      toolExecution,
      subagentRuns,
      routingDecision,
      contractValidation,
      lanjutan
    };

    return await SynthesisHandler.handle(synthesisState, ctx, rctx, maef);
  }
};
