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
import { simpanCatatanPatch, hapusCatatanPatch } from './CatatanPatch.js';
import { laporanVerifikasi, putusanVerifikasi } from './VerifikasiPatch.js';

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
    // ROLLBACK CHECKPOINT — salinan isi asli berkas target (proses utama, eng:git-checkpoint), sekali sebelum menulis.
    // Dulu `git stash` seluruh working tree dan "non-blocking": live TUGAS-01 (2026-09-22) pekerjaan Owner yang belum
    // di-commit lenyap ke stash. Kini checkpoint WAJIB berhasil — tanpanya Undo mustahil, jadi tak ada yang ditulis.
    // =============================================
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

    // Menulis berkas aplikasi memicu muat ulang Vite (mode pengembangan) — catatan ini melaporkan hasil setelahnya.
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

    // CATATAN PATCH TIDAK LAGI DITULIS KE MEMORI PENGGUNA (keputusan Owner, 2026-10-01).
    //
    // Dulu tiap patch menulis `"Patch PATCH-1790841319400 applied"` ke memori pribadi Owner. Tak ada
    // yang pernah membacanya kembali — `engineer_patch` hanya muncul di tempat penulisannya — dan
    // isinya nomor mesin tanpa keterangan apa pun. Ia tumbuh satu baris tiap patch, selamanya.
    //
    // Yang ditanyakan orang tentang patch ("apa yang berubah, kapan, kenapa") dijawab jauh lebih
    // baik oleh `git log` dan checkpoint: selalu benar, tidak membeku jadi potret satu saat, dan
    // sejak 4.2.5 bisa dijalankan Engineer sendiri tanpa persetujuan. Baris memori ini hanya
    // menyalin sebagian kecilnya dalam bentuk yang lebih buruk.
    //
    // Alasan lengkap & ukurannya ada di catatan yang sama di `engineer.js` (_finalizeSession).

    // =============================================
    // TAHAP 6 — VERIFIKASI YANG DIJALANKAN (2026-09-28)
    //
    // Pertanyaannya berubah dari "apakah patch ini TAMPAK aman" menjadi "apakah sistem ini MASIH BENAR
    // sesudah patch". Itu baru mungkin karena checkpoint sudah wajib di atas: patch boleh diterapkan
    // dulu, lalu diputuskan. Seluruh langkahnya (jalankan uji → pulihkan → jalankan ulang yang gagal)
    // dikerjakan proses utama dalam satu panggilan, supaya muat ulang Vite tidak membatalkan pemulihan.
    //
    // Dilewati bila tidak ada satu berkas pun yang benar-benar ditulis — tidak ada yang perlu dijaga —
    // dan di luar Electron (web/Mametlite) tempat node tidak ada.
    // =============================================
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
      // Checkpoint SUDAH TERPAKAI bila berkas dipulihkan otomatis — berkasnya dihapus proses utama,
      // jadi tombol Undo tidak boleh ditawarkan lagi untuk sesuatu yang sudah dikembalikan.
      checkpointRef: dipulihkan ? null : checkpointRef,
      verifikasi
    };

    // Selesai tanpa muat ulang → alur biasa melapor sendiri; catatan tak diperlukan lagi.
    hapusCatatanPatch();
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
