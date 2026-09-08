/**
 * ReasoningLock — "Tidak ada kode yang dihasilkan tanpa analisis yang ditunjukkan."
 * Menghasilkan laporan reasoning sebelum eksekusi patch, lalu menunggu konfirmasi
 * eksplisit dari Owner (dengan timeout) sebelum lanjut ke generate patch.
 *
 * Diekstrak dari engineer.js (Fase 5, ADR-0017). `pendingConfirmations` (Map)
 * tetap jadi state di instance Engineer — diteruskan lewat `deps` by-reference,
 * sehingga mutasi (`set`/`delete`) tetap terlihat di Map yang sama, perilaku
 * identik dengan sebelum diekstrak.
 */

export const CONFIRMATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 menit

/**
 * Menghasilkan laporan reasoning komprehensif sebelum eksekusi patch.
 * @param {Object} task - Task yang sedang diproses
 * @param {Object} analysis - Hasil analisis dari _analyze()
 * @param {Object} options - Opsi tambahan (intent, capabilityCheck, modelName)
 * @param {Object} deps - { calculateConfidence, eventBus, capability, extractFileNamesFromTask }
 * @returns {Object} Reasoning report object
 */
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
    requiresApproval: false, // Reasoning report hanya perlu konfirmasi, bukan approval
  });

  return report;
}

/**
 * Menunggu konfirmasi eksplisit dari user sebelum melanjutkan ke generasi patch.
 * Timeout otomatis 10 menit untuk mencegah memory leak.
 * @param {Object} report - Reasoning report yang akan dikonfirmasi
 * @param {Object} deps - { pendingConfirmations, eventBus }
 * @returns {Promise<boolean>} true jika user mengkonfirmasi, false jika dibatalkan atau timeout
 */
export function waitForUserConfirmation(report, deps) {
  const { pendingConfirmations, eventBus } = deps;
  return new Promise((resolve) => {
    const confirmationId = report.taskId || `CONFIRM-${Date.now()}`;

    // Timeout otomatis untuk mencegah memory leak
    const timeout = setTimeout(() => {
      if (pendingConfirmations.has(confirmationId)) {
        console.warn(`[Engineer] ⏰ Confirmation timeout for ID: ${confirmationId}. Auto-cancelling.`);
        pendingConfirmations.delete(confirmationId);
        resolve(false);
      }
    }, CONFIRMATION_TIMEOUT_MS);

    // Simpan resolver + timeout di Map
    pendingConfirmations.set(confirmationId, {
      report,
      resolver: (result) => {
        clearTimeout(timeout); // Bersihkan timeout saat user merespons
        resolve(result);
      }
    });

    // Emit event ke UI untuk menampilkan tombol konfirmasi
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

/**
 * Handler untuk response konfirmasi dari user.
 * Dipanggil dari event listener Engineer:UserConfirmation.
 * @param {Object} response - { confirmationId, confirmed }
 * @param {Object} deps - { pendingConfirmations }
 */
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
