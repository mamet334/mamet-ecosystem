/**
 * CapabilityGuard — FASE 2: Pemeriksaan kelayakan task & proteksi file core (MAEF 4.2).
 *
 * Diekstrak dari engineer.js (Fase 2, ADR-0017). Fungsi murni/deterministik,
 * tanpa panggilan LLM. `checkCapabilityAndDeclare` menerima helper eksternal
 * (extractFileNamesFromTask, findRelevantADR, calculateConfidence) lewat
 * parameter `deps` alih-alih `this.method()` — perilaku identik dengan versi
 * lama, tapi modul ini jadi murni testable tanpa instance Engineer.
 */

// Harus sama dengan batas file di _analyze()/_generatePatch() (masih di engineer.js
// sampai Fase 7/8 ADR-0017) — diekspor dari sini agar jadi satu sumber kebenaran.
export const MAX_FILES_PER_PATCH = 10;

/**
 * Memeriksa apakah task memenuhi syarat untuk diproses Engineer.
 * @param {Object} task - Task yang akan diperiksa
 * @param {Object} options - Opsi tambahan (analysis, modelName)
 * @param {Object} deps - { extractFileNamesFromTask, findRelevantADR, calculateConfidence }
 * @returns {{ pass: boolean, reason?: string, suggestBatch?: boolean }}
 */
export function checkCapabilityAndDeclare(task, options = {}, deps = {}) {
  const { analysis, modelName } = options;
  const { extractFileNamesFromTask, findRelevantADR, calculateConfidence } = deps;
  const text = `${task.title || ''} ${task.description || ''}`;
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const targetFiles = task.files || extractFileNamesFromTask(task);

  const checks = [];

  // 1. Prompt Clarity Check — minimal 20 kata
  if (wordCount < 20) {
    checks.push({
      pass: false,
      reason: `Prompt terlalu pendek (${wordCount} kata). Minimal 20 kata untuk menghasilkan patch yang akurat. Silakan berikan instruksi yang lebih detail.`
    });
  }

  // 2. File Limit Check — maksimal MAX_FILES_PER_PATCH file
  // [FIX #4] Menggunakan konstanta MAX_FILES_PER_PATCH agar konsisten dengan _generatePatch()
  if (targetFiles.length > MAX_FILES_PER_PATCH) {
    checks.push({
      pass: false,
      reason: `Terlalu banyak file (${targetFiles.length} file). Maksimal ${MAX_FILES_PER_PATCH} file per patch. Sarankan memecah tugas menjadi beberapa batch.`,
      suggestBatch: true
    });
  }

  // 3. ADR Wajib Check — untuk perubahan struktur/core
  const relevantADR = findRelevantADR(task);
  if (!relevantADR) {
    const adrRequiredPhrases = [
      'perubahan arsitektur', 'arsitektur baru', 'service baru', 'module baru',
      'new architecture', 'new service', 'new module', 'restruktur', 'restrukturisasi',
      'mengubah flow', 'merubah flow', 'mengubah alur', 'merubah alur',
      'pipeline baru', 'integration baru', 'integrasi baru',
      'architectural change', 'structural change'
    ];
    const needsADR = adrRequiredPhrases.some(phrase => text.toLowerCase().includes(phrase));
    if (needsADR) {
      checks.push({
        pass: false,
        reason: `Perubahan ini menyentuh area arsitektur yang membutuhkan ADR (Architecture Decision Record). Silakan buat ADR terlebih dahulu atau arahkan saya ke ADR yang relevan.`
      });
    }
  }

  // 4. Confidence Threshold Check — jika analysis tersedia
  if (analysis) {
    const confidence = calculateConfidence(analysis);
    if (confidence.level === 'LOW' || confidence.evidence < 70) {
      checks.push({
        pass: false,
        reason: `Confidence terlalu rendah (${confidence.level}, evidence: ${confidence.evidence}/100) untuk auto-patch. Saya sarankan analisis manual terlebih dahulu.`,
        confidenceDetails: confidence
      });
    }
  }

  // Jika ada pelanggaran, return detail pelanggaran pertama
  if (checks.length > 0) {
    const failedCheck = checks.find(c => c.pass === false);
    console.log(`[Engineer] 🚫 Capability check failed: ${failedCheck?.reason}`);
    return {
      pass: false,
      checks: checks,
      reason: failedCheck?.reason || 'Capability check gagal',
      suggestBatch: checks.some(c => c.suggestBatch),
      modelName: modelName || 'unknown'
    };
  }

  console.log(`[Engineer] ✅ Capability check passed`);
  return {
    pass: true,
    checks: [],
    modelName: modelName || 'unknown'
  };
}

// =============================================
// CORE PROTECTION LAYER (MAEF 4.2 Compliant)
// =============================================

export function isImmutableFile(filePath) {
  const IMMUTABLE_PATTERNS = [
    '/core/runtime/Kernel.js',
    '/core/runtime/EventBus.js',
    '/core/runtime/ServiceManager.js',
    '/core/runtime/ProcessManager.js',
    '/core/runtime/StorageManager.js',
    '/core/runtime/ModuleLoader.js',
    '/core/runtime/DiscoveryManager.js',
    '/electron/main.js',
    '/electron/preload.cjs',
    '/constitution/00_CONSTITUTION.md',
    '/constitution/01_VISION.md',
    '/constitution/09_DNA.md'
  ];
  return IMMUTABLE_PATTERNS.some(pattern => filePath.includes(pattern));
}

export function isProtectedFile(filePath) {
  const PROTECTED_PATTERNS = [
    '/core/runtime/services/',
    '/supabase/functions/agent-process/index.ts',
    '/supabase/functions/agent-process/lib/',
    '/frontend/src/core/runtime/services/engineer.js'
  ];
  return PROTECTED_PATTERNS.some(pattern => filePath.includes(pattern));
}
