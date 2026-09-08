/**
 * ApprovalGateway — Alur persetujuan Owner untuk patch (Granular Approval),
 * plus utilitas notifikasi umum `emitRecommendation` yang dipakai luas oleh
 * orchestrator `_handlePatchTask` di engineer.js.
 *
 * Diekstrak dari engineer.js (Fase 5, ADR-0017). `pendingPatches` (Map) tetap
 * jadi state di instance Engineer, diteruskan lewat `deps` by-reference —
 * sama seperti pola `pendingConfirmations` di ReasoningLock.js.
 *
 * Catatan `emitRecommendation`: dipanggil dari ~21 tempat di dalam
 * `_handlePatchTask` (orchestrator utama, belum diekstrak sampai Fase 8).
 * `engineer.js` mempertahankan method wrapper tipis `_emitRecommendation()`
 * yang mendelegasikan ke sini — menghindari perlu mengubah 21 titik panggil
 * sekaligus (setiap titik punya bentuk closing-brace berbeda), sambil tetap
 * memindahkan logika sesungguhnya ke modul ini.
 */
import { clearPendingPatch, savePendingPatch } from './EngineerMemoryStore.js';
import { isImmutableFile, isProtectedFile } from './CapabilityGuard.js';

export const APPROVAL_TIMEOUT_MS = 10 * 60 * 1000; // 10 menit

/**
 * Handler untuk response approval dari user (approve/reject per-file).
 * Dipanggil dari event listener Engineer:ApprovalResponse.
 * @param {Object} response - { patchId, approved, approvedFiles }
 * @param {Object} deps - { pendingPatches, storageManager }
 */
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
    // Hapus dari persistent storage — patch sudah diselesaikan (approve/reject)
    clearPendingPatch(patchId, { storageManager });
  }
}

/**
 * Minta persetujuan Owner untuk sebuah patch. Timeout otomatis 10 menit —
 * patch tetap tersimpan (bukan reject) supaya tidak hilang.
 * @param {Object} patch
 * @param {Object|null} analysis
 * @param {Object} deps - { pendingPatches, eventBus, storageManager, calculateConfidence }
 * @returns {Promise<{approved: boolean, approvedFiles: string[], persisted?: boolean}>}
 */
export async function requestApproval(patch, analysis = null, deps) {
  const { pendingPatches, eventBus, storageManager, calculateConfidence } = deps;

  // Simpan ke persistent storage SEBELUM menunggu — tidak hilang jika timeout/restart
  await savePendingPatch(patch, { storageManager });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (pendingPatches.has(patch.id)) {
        console.warn(`[Engineer] ⏰ Approval timeout: ${patch.id}. Persisting, tidak di-reject.`);
        pendingPatches.delete(patch.id); // bebas memori, data sudah di storage
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

    // [FIX #6-B] Patch fallback tidak boleh membawa skor confidence yang
    // dihitung dari analysis normal — itu akan bertentangan dengan
    // fallbackWarning di atas (mis. tampil "HIGH confidence" pada patch
    // yang sebenarnya kosong secara substansi). Saat isFallback true,
    // confidence dipaksa ke LOW/0 tanpa mengubah calculateConfidence
    // itu sendiri (masih dipakai apa adanya di jalur analysis lain).
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

/**
 * [FIX #1] emitRecommendation() tidak memaksa requiresApproval: true.
 * Menggunakan nullish coalescing (??) agar caller bisa set requiresApproval: false.
 * @param {Object} recommendation
 * @param {Object} deps - { eventBus, capability }
 */
export function emitRecommendation(recommendation, deps) {
  const { eventBus, capability } = deps;
  eventBus.emit('Engineer:Recommendation', {
    ...recommendation,
    from: 'Engineer',
    capability: capability,
    // Sebelumnya: requiresApproval: true (selalu override)
    // Sekarang: pakai nilai dari caller, default true hanya jika tidak di-set
    requiresApproval: recommendation.requiresApproval ?? true,
    timestamp: new Date().toISOString()
  });
}
