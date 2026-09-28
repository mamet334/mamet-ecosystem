/**
 * TaskHandlers — Jalur read-only Engineer: membangun dynamic context dan menangani task ANALYSIS/REVIEW.
 *
 * Alur READ_REPO (baca file, list direktori, cari file) beserta parser teks prompt-nya DIHAPUS
 * 2026-09-28 — lihat catatan di akhir berkas.
 *
 * Diekstrak dari engineer.js (Fase 6, ADR-0017). `_handleAnalysisTask` dan
 * `_handleReviewTask` masih bergantung pada `_analyze`/`_review`/
 * `_calculateConfidence` yang belum diekstrak (target Fase 7/8) — deps
 * membawa fungsi-fungsi itu dalam bentuk sudah di-bind dari engineer.js.
 * `brain` dan `metrics` diteruskan by-reference (objek), sama seperti pola
 * Map di fase-fase sebelumnya — mutasi (`brain.dynamic = ...`,
 * `metrics.tasksAnalyzed++`) tetap terlihat di instance Engineer asli.
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

/**
 * @param {Object} task
 * @param {Object} deps - { metrics, brain, fileIndexService, sessionArtifact, analyze, updateArtifact, emitRecommendation, calculateConfidence }
 */
export async function handleAnalysisTask(task, deps) {
  const { metrics, brain, fileIndexService, sessionArtifact, analyze, updateArtifact, emitRecommendation, calculateConfidence } = deps;
  metrics.tasksAnalyzed++;
  console.log(`[Engineer] Analyzing task: ${task.title || task.id}`);
  brain.dynamic = await buildDynamicContext(task, { fileIndexService, brain, sessionArtifact });
  const analysis = await analyze(task);

  updateArtifact('ANALYSIS', {
    taskId: task.id,
    files: Object.keys(analysis.rawContext || {}),
    violations: analysis.compliance?.violations || [],
    summary: analysis.summary
  });

  emitRecommendation({
    type: 'ANALYSIS',
    taskId: task.id,
    analysis,
    confidence: calculateConfidence(analysis),
    requiresApproval: false
  });
}

/**
 * @param {Object} task
 * @param {Object} deps - { metrics, brain, fileIndexService, sessionArtifact, review, emitRecommendation, calculateConfidence }
 */
export async function handleReviewTask(task, deps) {
  const { metrics, brain, fileIndexService, sessionArtifact, review, emitRecommendation, calculateConfidence } = deps;
  metrics.recommendationsMade++;
  console.log(`[Engineer] Reviewing changes for: ${task.title || task.id}`);
  brain.dynamic = await buildDynamicContext(task, { fileIndexService, brain, sessionArtifact });
  const reviewResult = await review(task);
  emitRecommendation({
    type: 'REVIEW',
    taskId: task.id,
    review: reviewResult,
    confidence: calculateConfidence(reviewResult),
    requiresApproval: false
  });
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
