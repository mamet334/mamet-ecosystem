import { clearPendingPatch, savePendingPatch } from './EngineerMemoryStore.js';
import { isImmutableFile, isProtectedFile } from './CapabilityGuard.js';

export const APPROVAL_TIMEOUT_MS = 10 * 60 * 1000;

export function handleApprovalResponse(response, deps) {
  const { pendingPatches, storageManager } = deps;
  const { patchId, approved, approvedFiles } = response;
  const pending = pendingPatches.get(patchId);

  if (pending) {
    pending.resolver({
      approved,
      approvedFiles: approvedFiles || []
    });
    pendingPatches.delete(patchId);
    clearPendingPatch(patchId, { storageManager });
  }
}

export async function requestApproval(patch, analysis = null, deps) {
  const { pendingPatches, eventBus, storageManager, calculateConfidence } = deps;

  await savePendingPatch(patch, { storageManager });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (pendingPatches.has(patch.id)) {
        console.warn(`[Engineer] ⏰ Approval timeout: ${patch.id}. Persisting, tidak di-reject.`);
        pendingPatches.delete(patch.id);
        eventBus.emit('Engineer:Recommendation', {
          type: 'PATCH_PERSISTED',
          patchId: patch.id,
          message: `⏰ **Waktu Habis** — Patch \`${patch.id}\` belum disetujui dalam 10 menit.\n\n💾 Patch **disimpan otomatis** — tidak hilang. Saat Anda membuka kembali aplikasi, patch akan tampil kembali untuk persetujuan.\n\nAtau ketik: **"lanjutkan patch ${patch.id}"** untuk melanjutkan sekarang.`,
          requiresApproval: false,
          from: 'Engineer',
          timestamp: new Date().toISOString()
        });
        resolve({ approved: false, approvedFiles: [], persisted: true });
      }
    }, APPROVAL_TIMEOUT_MS);

    pendingPatches.set(patch.id, {
      patch,
      resolver: (result) => {
        clearTimeout(timeout);
        resolve(result);
      }
    });

    const fallbackWarning = patch.isFallback
      ? `⚠️ **PERINGATAN: Patch Cadangan (Fallback)** — Pemanggilan LLM gagal (${patch.llmError || 'unknown error'}). Patch ini dibuat oleh template darurat, BUKAN hasil analisis AI penuh. Tinjau dengan lebih hati-hati sebelum menyetujui.\n\n`
      : '';

    const computedConfidence = analysis
      ? calculateConfidence(analysis)
      : { level: 'UNKNOWN', coverage: 0, evidence: 0 };

    const confidence = patch.isFallback
      ? { level: 'LOW', coverage: 0, evidence: 0, forcedByFallback: true }
      : computedConfidence;

    eventBus.emit('Engineer:RequestApproval', {
      patchId: patch.id,
      summary: fallbackWarning + (patch.description || 'Patch generated'),
      isFallback: patch.isFallback || false,
      llmError: patch.llmError || null,
      files: patch.files.map(f => ({
        path: f.path,
        status: f.status,
        size: f.size || 0,
        newContent: f.newContent,
        originalContent: f.originalContent,
        isImmutable: isImmutableFile(f.path),
        isProtected: isProtectedFile(f.path)
      })),
      diff: patch.diff || '',
      verification: patch.verification || null,
      confidence: confidence,
      compliance: analysis?.compliance || { violations: [], warnings: [] },
      timeoutMs: APPROVAL_TIMEOUT_MS,
      timestamp: new Date().toISOString()
    });
  });
}

export function emitRecommendation(recommendation, deps) {
  const { eventBus, capability } = deps;
  eventBus.emit('Engineer:Recommendation', {
    ...recommendation,
    from: 'Engineer',
    capability: capability,
    requiresApproval: recommendation.requiresApproval ?? true,
    timestamp: new Date().toISOString()
  });
}
