/**
 * PatchApplier — Menerapkan patch yang sudah disetujui ke file sungguhan:
 * blokir file IMMUTABLE, buat git checkpoint untuk rollback, tulis tiap file
 * (dengan safety-check anti-truncation), simpan ringkasan ke Project Memory,
 * lalu finalisasi sesi.
 *
 * Diekstrak dari engineer.js (Fase 8/8, ADR-0017 — TERAKHIR & RISIKO TERTINGGI).
 * Ini hard gate: bug di sini berarti patch tidak pernah benar-benar ter-apply
 * ke file sungguhan. Dikerjakan paling akhir, setelah 7 modul lain stabil.
 *
 * `this.suspiciousAttempts` (primitif number) dan `this.capability` (primitif
 * string) di instance Engineer TIDAK BISA diteruskan by-reference seperti Map
 * atau object (`metrics`/`brain`) di fase-fase sebelumnya — primitif di JS
 * bukan reference type. Sebagai gantinya, mutasi keamanan (increment percobaan
 * mencurigakan + downgrade capability + emit lockdown) tetap tinggal sebagai
 * closure di `engineer.js` dan diteruskan sebagai satu callback
 * `onImmutableFileBlocked` — modul ini tidak perlu tahu apa pun soal `this`.
 */
import { isImmutableFile, isProtectedFile } from './CapabilityGuard.js';

/**
 * @param {Object} patch
 * @param {string[]} approvedFiles
 * @param {Object} deps - { metrics, eventBus, storageManager, serviceManager,
 *   emitRecommendation, finalizeSession, onImmutableFileBlocked }
 */
export async function executePatchApplication(patch, approvedFiles = [], deps) {
  const { metrics, eventBus, storageManager, serviceManager, emitRecommendation, finalizeSession, onImmutableFileBlocked } = deps;

  try {
    console.log(`[Engineer] 🔧 Menerapkan patch: ${patch.id}`);
    console.log(`[Engineer] 📋 Files to process: ${patch.files.length}, Approved: ${approvedFiles.length}`);

    for (const file of patch.files) {
      if (isImmutableFile(file.path)) {
        console.error(`[Engineer] 🚫 BLOCKED: Attempt to modify IMMUTABLE core file: ${file.path}`);
        metrics.coreModificationsBlocked++;
        onImmutableFileBlocked();

        emitRecommendation({
          type: 'CORE_MODIFICATION_BLOCKED',
          taskId: patch.taskId,
          message: `🚫 BLOKIR: File "${file.path}" adalah CORE IMMUTABLE.`,
          severity: 'CRITICAL',
          requiresApproval: false
        });

        return { success: false, error: 'Core file modification blocked' };
      }
    }

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    // =============================================
    // ROLLBACK CHECKPOINT — git stash sebelum write
    // Dilakukan sekali sebelum semua file ditulis.
    // Jika ada error, user bisa rollback dengan aman.
    // =============================================
    let checkpointRef = null;
    if (window.electronAPI?.gitCheckpoint) {
      try {
        const cp = await window.electronAPI.gitCheckpoint(
          patch.taskId || patch.id,
          patch.files.map(f => f.path)
        );
        if (cp?.success) {
          checkpointRef = cp.ref || `ENG-CHECKPOINT-${patch.taskId || patch.id}`;
          console.log(`[Engineer] 💾 Checkpoint dibuat: ${checkpointRef}`);
        } else {
          console.warn('[Engineer] ⚠️ Checkpoint gagal dibuat:', cp?.error || cp?.message);
        }
      } catch (cpErr) {
        console.warn('[Engineer] Checkpoint error (non-blocking):', cpErr.message);
      }
    }

    for (const file of patch.files) {
      try {
        if (approvedFiles.length > 0 && !approvedFiles.includes(file.path)) {
          console.log(`[Engineer] ⏭️ Skipping (not approved): ${file.path}`);
          file.status = 'SKIPPED';
          skippedCount++;
          continue;
        }

        if (isProtectedFile(file.path)) {
          console.warn(`[Engineer] ⚠️ WARNING: Modifying PROTECTED file: ${file.path}`);
        }

        // Safety Check: Cegah LLM truncation overwrite file
        const originalSize = file.originalContent ? file.originalContent.length : 0;
        const newSize = file.newContent.length;
        if (originalSize > 500 && newSize < originalSize * 0.5) {
          console.error(`[Engineer] 🚫 DITOLAK: Konten baru (${newSize} chars) < 50% dari asli (${originalSize} chars). LLM kemungkinan truncate response!`);
          file.status = 'FAILED';
          file.error = `Konten terlalu kecil: ${newSize} vs ${originalSize} chars (${Math.round(newSize / originalSize * 100)}%). Kemungkinan LLM truncate response.`;
          failCount++;

          eventBus.emit('Engineer:Recommendation', {
            taskId: patch.taskId,
            message: `⚠️ **Patch Ditolak Otomatis**: File \`${file.path}\` tidak ditulis karena LLM mengembalikan konten yang terpotong (${newSize} dari ${originalSize} karakter). Coba lagi dengan instruksi yang lebih spesifik.`,
            type: 'SAFETY_REJECTION',
            requiresApproval: false
          });
          continue;
        }

        console.log(`[Engineer] ✍️ Menulis file: ${file.path} (${newSize} karakter, asli: ${originalSize} karakter)`);
        const writeResult = await storageManager.write(file.path, file.newContent);

        if (writeResult) {
          file.status = 'APPLIED';
          successCount++;
          console.log(`[Engineer] ✅ File berhasil ditulis: ${file.path}`);
        } else {
          file.status = 'FAILED';
          file.error = 'StorageManager.write() mengembalikan false';
          failCount++;
          console.error(`[Engineer] ❌ Gagal menulis file: ${file.path}`);
        }
      } catch (e) {
        file.status = 'FAILED';
        file.error = e.message;
        failCount++;
        console.error(`[Engineer] ❌ Error menulis file ${file.path}:`, e);
      }
    }

    try {
      const memoryService = serviceManager.get('MemoryService');
      await memoryService.storeMemory(
        `Patch ${patch.id} applied`,
        `Patch ${patch.id}: ${successCount} applied, ${skippedCount} skipped, ${failCount} failed.`,
        {
          source_type: 'engineer_patch',
          source_reference: `patch_${patch.id}`,
          version_code: `PATCH-${Date.now()}`,
          category: 'engineering',
          useGovernor: true
        }
      );
    } catch (e) {
      console.warn('[Engineer] Gagal menyimpan ke Project Memory:', e);
    }

    const result = {
      success: failCount === 0,
      patchId: patch.id,
      successCount,
      skippedCount,
      failCount,
      files: patch.files,
      checkpointRef  // dikirim ke UI untuk tombol Rollback
    };

    eventBus.emit('Engineer:PatchApplied', result);
    console.log(`[Engineer] 🎯 Patch selesai: ${successCount} applied, ${skippedCount} skipped, ${failCount} failed`);

    // [FASE 1] Finalisasi sesi: verifikasi ringkasan memori terhadap golden source
    try {
      await finalizeSession(patch);
    } catch (e) {
      console.warn('[Engineer] Finalisasi sesi gagal (tidak memblokir patch):', e.message);
    }

    return result;
  } catch (error) {
    console.error('[Engineer] ❌ Patch execution gagal total:', error);
    return { success: false, error: error.message };
  }
}
