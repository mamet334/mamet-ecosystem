
export const CONFIRMATION_TIMEOUT_MS = 10 * 60 * 1000;

export function emitReasoningReport(task, analysis, options = {}, deps) {
  const { calculateConfidence, eventBus, capability, extractFileNamesFromTask } = deps;
  const { intent = 'MODIFY_CODE', capabilityCheck = null, modelName = 'unknown' } = options;
  const targetFiles = task.files || extractFileNamesFromTask(task);

  const report = {
    taskId: task.id,
    summary: analysis.summary || `Analisis selesai untuk task: ${task.title || task.id}`,
    findings: analysis.findings || [],
    adrReferenced: analysis.metrics?.adrReferenced || 'None',
    filesAnalyzed: Object.keys(analysis.rawContext || {}),
    recommendedFiles: targetFiles,
    compliance: analysis.compliance || { violations: [], warnings: [] },
    confidence: calculateConfidence(analysis),
    intent: intent,
    capabilityCheck: capabilityCheck || { pass: true, checks: [] },
    recommendation: analysis.recommendation || 'Lanjutkan dengan implementasi fitur',
    modelName: modelName,
    timestamp: new Date().toISOString()
  };

  console.log(`[Engineer] 🧠 Emitting Reasoning Report for task: ${task.id}`);
  console.log(`[Engineer] 📋 Report summary: ${report.summary}`);
  console.log(`[Engineer] 🎯 Intent: ${intent}, Model: ${modelName}`);

  eventBus.emit('Engineer:ReasoningReport', {
    ...report,
    from: 'Engineer',
    capability: capability,
    requiresApproval: false,
  });

  return report;
}

export function waitForUserConfirmation(report, deps) {
  const { pendingConfirmations, eventBus } = deps;
  return new Promise((resolve) => {
    const confirmationId = report.taskId || `CONFIRM-${Date.now()}`;

    const timeout = setTimeout(() => {
      if (pendingConfirmations.has(confirmationId)) {
        console.warn(`[Engineer] ⏰ Confirmation timeout for ID: ${confirmationId}. Auto-cancelling.`);
        pendingConfirmations.delete(confirmationId);
        resolve(false);
      }
    }, CONFIRMATION_TIMEOUT_MS);

    pendingConfirmations.set(confirmationId, {
      report,
      resolver: (result) => {
        clearTimeout(timeout);
        resolve(result);
      }
    });

    eventBus.emit('Engineer:RequestConfirmation', {
      confirmationId: confirmationId,
      report: report,
      summary: report.summary,
      findings: report.findings,
      confidence: report.confidence,
      intent: report.intent,
      modelName: report.modelName,
      filesAnalyzed: report.filesAnalyzed,
      recommendedFiles: report.recommendedFiles,
      timeoutMs: CONFIRMATION_TIMEOUT_MS,
      timestamp: new Date().toISOString()
    });

    console.log(`[Engineer] ⏳ Waiting for user confirmation (ID: ${confirmationId}, timeout: ${CONFIRMATION_TIMEOUT_MS / 1000}s)...`);
  });
}

export function handleUserConfirmation(response, deps) {
  const { pendingConfirmations } = deps;
  const { confirmationId, confirmed } = response;
  const pending = pendingConfirmations.get(confirmationId);

  if (pending) {
    console.log(`[Engineer] ${confirmed ? '✅' : '❌'} User confirmation received for: ${confirmationId}`);
    pending.resolver(confirmed === true);
    pendingConfirmations.delete(confirmationId);
  } else {
    console.warn(`[Engineer] ⚠️ No pending confirmation found for ID: ${confirmationId} (mungkin sudah timeout)`);
  }
}
