import { isImmutableFile, isProtectedFile } from './CapabilityGuard.js';
import { simpanCatatanPatch, hapusCatatanPatch } from './CatatanPatch.js';
import { laporanVerifikasi, putusanVerifikasi } from './VerifikasiPatch.js';

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

    let checkpointRef = null;
    if (window.electronAPI?.gitCheckpoint) {
      let cp = null;
      try {
        cp = await window.electronAPI.gitCheckpoint(
          patch.taskId || patch.id,
          patch.files.map(f => f.path)
        );
      } catch (cpErr) {
        cp = { success: false, error: cpErr.message };
      }
      if (!cp?.success) {
        console.error('[Engineer] 🚫 Checkpoint gagal — patch TIDAK ditulis:', cp?.error || cp?.message);
        emitRecommendation({
          type: 'SAFETY_REJECTION',
          taskId: patch.taskId,
          message: `⚠️ **Patch tidak diterapkan**: checkpoint (salinan isi asli untuk Undo) gagal dibuat — ${cp?.error || 'alasan tidak diketahui'}. Tidak ada berkas yang diubah.`,
          requiresApproval: false
        });
        return { success: false, error: `Checkpoint gagal: ${cp?.error || 'tidak diketahui'}` };
      }
      checkpointRef = cp.ref;
      console.log(`[Engineer] 💾 Checkpoint dibuat: ${checkpointRef}`);
    }

    simpanCatatanPatch({
      patchId: patch.id,
      checkpointRef,
      files: patch.files.filter(f => approvedFiles.length === 0 || approvedFiles.includes(f.path)),
    });

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


    let verifikasi = null;
    let dipulihkan = false;
    if (successCount > 0 && window.electronAPI?.verifikasiPatch) {
      let v = null;
      try { v = await window.electronAPI.verifikasiPatch(checkpointRef); }
      catch (e) { v = { sesudahPatch: { galat: e.message } }; }
      dipulihkan = !!v?.dipulihkan;
      verifikasi = {
        status: putusanVerifikasi(v?.sesudahPatch).status,
        dipulihkan,
        laporan: laporanVerifikasi(v || {}),
      };
      console.log(`[Engineer] 🧪 Verifikasi patch: ${verifikasi.status}${dipulihkan ? ' — berkas DIKEMBALIKAN' : ''}`);
      if (dipulihkan) for (const file of patch.files) if (file.status === 'APPLIED') file.status = 'DIPULIHKAN';
    }

    const result = {
      success: failCount === 0 && !dipulihkan,
      patchId: patch.id,
      successCount,
      skippedCount,
      failCount,
      files: patch.files,
      checkpointRef: dipulihkan ? null : checkpointRef,
      verifikasi
    };

    hapusCatatanPatch();
    eventBus.emit('Engineer:PatchApplied', result);
    console.log(`[Engineer] 🎯 Patch selesai: ${successCount} applied, ${skippedCount} skipped, ${failCount} failed`);

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
