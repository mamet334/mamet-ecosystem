/**
 * TaskHandlers — membangun dynamic context untuk task Engineer.
 *
 * Diekstrak dari engineer.js (Fase 6, ADR-0017). `brain` diteruskan by-reference, sama seperti pola
 * Map di fase-fase sebelumnya — mutasi (`brain.dynamic = ...`) tetap terlihat di instance asli.
 *
 * DUA PENGHAPUSAN, keduanya sesudah dibuktikan mati — bukan sebelum:
 *   • 2026-09-28 — alur READ_REPO beserta parser teks prompt-nya (219 baris).
 *   • 2026-09-29 — `handleAnalysisTask` & `handleReviewTask`. Keduanya hanya punya pendengar,
 *     tak pernah ada pemancar; dan `_review` yang dipanggilnya tidak menambah apa pun di atas
 *     `_analyze` selain memetakan jumlah pelanggaran jadi APPROVE/REJECT — vonis dari pencocokan
 *     pola teks, cara yang 24 September memblokir patch yang benar. Penggantinya sudah jalan dan
 *     lebih baik: Tahap 6 MENJALANKAN berkas uji sesudah patch, lalu memulihkan sendiri bila gagal.
 *
 * `buildDynamicContext` di bawah TETAP HIDUP: dipakai jalur MODIFY_CODE (engineer.js `_processTask`).
 * Catatan lengkapnya ada di akhir `engineer.js`.
 */
import { extractFileNamesFromTask } from './FileSystemGateway.js';

/**
 * @param {Object} task
 * @param {Object} deps - { fileIndexService, brain, sessionArtifact }
 */
export async function buildDynamicContext(task, deps) {
  const { fileIndexService, brain, sessionArtifact } = deps;
  const targetFiles = task.files || extractFileNamesFromTask(task);
  let availableFiles = [];

  try {
    if (fileIndexService && fileIndexService.isReady) {
      availableFiles = fileIndexService.getAllFiles?.() || [];
    }
  } catch (e) {
    console.warn('[Engineer] Gagal mengambil file list dari FileIndexService:', e.message);
  }

  return {
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      files: targetFiles,
      requestedModel: task.requestedModel || null
    },
    projectContext: {
      totalIndexedFiles: availableFiles.length,
      targetFileCount: targetFiles.length,
      staticKnowledgeLoaded: brain.static?.loadedFiles?.length || 0
    },
    sessionContext: sessionArtifact ? sessionArtifact.getSummary() : null,
    timestamp: new Date().toISOString()
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// JALUR READ_REPO DIHAPUS (2026-09-28)
//
// handleReadRepoTask, handleReadFiles, handleListDirectory, handleSearchFiles, dan ketiga
// extract*FromPrompt (219 baris) dihapus dari sini. Semuanya mati sejak arsitektur lama: satu-satunya
// tugas yang pernah masuk ke Engineer datang dari tombol "Apply Patch", dan tugas itu selalu membawa
// `dariTombolApply: true` sehingga intent dipaksa MODIFY_CODE — cabang READ_REPO di IntentClassifier
// tak pernah tercapai. Pintu satunya, event `Engineer:ReadRepo`, hanya punya pendengar; tidak ada satu
// pun pemancar di seluruh repo.
//
// Kemampuan membaca repo TIDAK hilang, dan tidak pernah lewat sini:
//   • Engineer  → [MAMET_CMD: git grep -n -B2 -A4 …] dan git blame -L (constitution/28 §3a)
//   • Explorer  → RepositoryReaderService, dipakai langsung, tetap hidup
//
// Dihapus karena kode mati yang lengkap dan rapi TAMPAK hidup: 28 September 2026 ia menipu asisten
// sendiri, yang sempat menyimpulkan jalurnya tinggal "disambungkan beberapa baris".
// ─────────────────────────────────────────────────────────────────────────────────────────────
