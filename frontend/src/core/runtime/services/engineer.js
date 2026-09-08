import { FileIndexService } from './FileIndexService.js';
import { SessionArtifact } from './engineer/SessionArtifact.js'; // [ADR-0017 Fase 1] Diekstrak dari file ini
import { MAX_FILES_PER_PATCH, checkCapabilityAndDeclare, isImmutableFile, isProtectedFile } from './engineer/CapabilityGuard.js'; // [ADR-0017 Fase 2]
import { detectIntent } from './engineer/IntentClassifier.js'; // [ADR-0017 Fase 2]
import { extractExports, extractFunctionSignatures, findUsages, detectBreakingChanges, verifySemanticDiff } from './engineer/StaticCodeAnalyzer.js'; // [ADR-0017 Fase 3]
import { savePendingPatch, clearPendingPatch, restorePersistedPatches, saveVerifiedApproach, saveRejectedApproach, loadVerifiedApproaches } from './engineer/EngineerMemoryStore.js'; // [ADR-0017 Fase 4]
import { readFile, findFiles, extractFileNamesFromTask, findRelevantADR, tryReadFile } from './engineer/FileSystemGateway.js'; // [ADR-0017 Fase 4]
import { emitReasoningReport, waitForUserConfirmation, handleUserConfirmation } from './engineer/ReasoningLock.js'; // [ADR-0017 Fase 5]
import { handleApprovalResponse, requestApproval, emitRecommendation } from './engineer/ApprovalGateway.js'; // [ADR-0017 Fase 5]
import { buildDynamicContext, handleAnalysisTask, handleReviewTask, handleReadRepoTask, handleReadFiles, handleListDirectory, handleSearchFiles } from './engineer/TaskHandlers.js'; // [ADR-0017 Fase 6]
import { generatePatch } from './engineer/PatchGenerator.js'; // [ADR-0017 Fase 7 + SPESIFIKASI-TEKNIS §2.1]

/**
 * Engineer.js — Engineering Brain Mamet AI (Real Analysis Engine + Core Protection)
 *
 * Peran:
 * - Membaca static knowledge (constitution, ADR)
 * - Menerima tugas via event bus
 * - Menganalisis, memberi rekomendasi
 * - Tidak pernah mengeksekusi perubahan tanpa persetujuan User
 * - TIDAK BOLEH mengubah file core (Kernel, EventBus, dll)
 *
 * Two-Brain Model:
 * - Brain 1: Static Engineering Knowledge (dimuat sekali)
 * - Brain 2: Dynamic Engineering Context (dibangun per tugas)
 *
 * Status: IMPLEMENTER — siap menghasilkan dan menerapkan patch
 * Upgrade: Real Analysis Engine (MAEF 4.5) + Core Protection Layer + Granular Approval
 *
 * Fixes Applied:
 * - ✅ Granular Approval support (approvedFiles flow)
 * - ✅ Confidence & Compliance injection ke UI
 * - ✅ Correct VerificationEngine method name (verifyPatchEngineering)
 * - ✅ [FIX #1] requiresApproval tidak lagi di-override oleh _emitRecommendation()
 * - ✅ [FIX #2] Timeout 10 menit di _waitForUserConfirmation() dan _requestApproval()
 * - ✅ [FIX #3] Session Artifact di-inject ke prompt LLM via _buildPatchPrompt()
 * - ✅ [FIX #4] Slice limit diselaraskan: max 10 file di _generatePatch() sesuai capability check
 * - ✅ [FIX #5] _buildDynamicContext() diperkaya dengan file list dan metadata task
 */

// =============================================
// CONSTANTS
// =============================================

// CONFIRMATION_TIMEOUT_MS [ADR-0017 Fase 5] diimpor dari ./engineer/ReasoningLock.js
// APPROVAL_TIMEOUT_MS [ADR-0017 Fase 5] diimpor dari ./engineer/ApprovalGateway.js
// MAX_FILES_PER_PATCH [ADR-0017 Fase 2] diimpor dari ./engineer/CapabilityGuard.js

// [ADR-0017 Fase 1] Class SessionArtifact diekstrak ke ./engineer/SessionArtifact.js

class Engineer {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.storageManager = serviceManager.get('StorageManager');
    this.process = serviceManager.get('ProcessManager');
    this.moduleLoader = serviceManager.get('ModuleLoader');
    this.fileIndexService = null; // Akan diinisialisasi setelah StorageManager siap
    // Repository Reader — kemampuan membaca file dari GitHub/Electron
    this.repositoryReader = serviceManager.has('RepositoryReaderService')
      ? serviceManager.get('RepositoryReaderService')
      : null;

    // Two-Brain Model
    this.brain = {
      static: null,
      dynamic: null,
      verifiedApproaches: [],  // Pendekatan yang terbukti berhasil (lintas sesi)
      rejectedPatterns: []     // Pola yang pernah ditolak user
    };

    this.capability = 'IMPLEMENTER';
    this.pendingPatches = new Map();
    this.suspiciousAttempts = 0; // Circuit breaker counter
    this._lastApiReset = 0;
    this.intentState = 'READY'; // READY | ANALYZING | ASK_CLARIFICATION | PROCEEDING
    this.pendingConfirmations = new Map(); // Untuk Reasoning Lock
    this.sessionArtifact = null; // FASE 4: Session Artifact — diinisialisasi di initialize()

    this.metrics = {
      tasksAnalyzed: 0,
      recommendationsMade: 0,
      patchesGenerated: 0,
      patchesApproved: 0,
      patchesRejected: 0,
      patchesFailedVerification: 0,
      coreModificationsBlocked: 0
    };
  }

  async initialize() {
    await this._loadStaticKnowledge();

    // ✅ VERIFIED APPROACH MEMORY: Load pendekatan terbukti dari sesi sebelumnya ke Brain
    const { verifiedApproaches, rejectedPatterns } = await loadVerifiedApproaches({ storageManager: this.storageManager });
    this.brain.verifiedApproaches = verifiedApproaches;
    this.brain.rejectedPatterns = rejectedPatterns;

    // ✅ Inisialisasi FileIndexService menggunakan static import di atas, dan tunggu selesai
    this.fileIndexService = new FileIndexService(this.storageManager);
    console.log('[Engineer] 🔨 Membangun FileIndexService...');
    await this.fileIndexService.buildIndex();
    console.log('[Engineer] ✅ FileIndexService siap digunakan');

    // ✅ FASE 4: Inisialisasi Session Artifact (sekali, bukan per task)
    this._initializeSessionArtifact();

    // ✅ PERSISTENT PENDING: Restore patch yang belum diapprove dari sesi sebelumnya
    await restorePersistedPatches({ storageManager: this.storageManager, eventBus: this.eventBus });

    this._registerListeners(); // Pastikan terjadi SETELAH indeks siap!
    console.log(`[Engineer] Initialized as ${this.capability}`);
    this.eventBus.emit('Engineer:Ready', { capability: this.capability });
  }

  // =============================================
  // FASE 4: SESSION ARTIFACT
  // =============================================

  /**
   * Menginisialisasi Session Artifact untuk melacak konteks sesi Engineer.
   * Dipanggil sekali saat initialize(), bukan per task.
   */
  _initializeSessionArtifact() {
    const sessionId = `ENG-SESSION-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.sessionArtifact = new SessionArtifact(sessionId);
    console.log(`[Engineer] 📦 Session Artifact initialized: ${sessionId}`);
  }

  /**
   * Memperbarui Session Artifact berdasarkan action yang terjadi.
   * @param {string} action - Tipe action
   * @param {Object} data - Data terkait action
   */
  _updateArtifact(action, data = {}) {
    if (!this.sessionArtifact) {
      console.warn('[Engineer] ⚠️ Session Artifact belum diinisialisasi');
      return;
    }

    switch (action) {
      case 'ANALYSIS':
        this.sessionArtifact.incrementTaskCount();
        if (data.files) {
          data.files.forEach(f => this.sessionArtifact.addAnalyzedFile(f));
        }
        if (data.violations) {
          data.violations.forEach(v => this.sessionArtifact.addMaefViolation(v));
        }
        this.sessionArtifact.addDecision({
          type: 'ANALYSIS',
          detail: data.summary || 'Analisis selesai',
          taskId: data.taskId
        });
        break;

      case 'REASONING':
        if (data.report) {
          this.sessionArtifact.addReasoningReport(data.report);
        }
        this.sessionArtifact.addDecision({
          type: 'REASONING',
          detail: data.summary || 'Reasoning report dikeluarkan',
          taskId: data.taskId
        });
        break;

      case 'PATCH_GENERATED':
        if (data.files) {
          data.files.forEach(f => this.sessionArtifact.addModifiedFile(f));
        }
        this.sessionArtifact.addDecision({
          type: 'PATCH_GENERATED',
          detail: `Patch generated: ${data.files?.length || 0} files`,
          taskId: data.taskId
        });
        break;

      case 'VERIFICATION':
        this.sessionArtifact.addDecision({
          type: 'VERIFICATION',
          detail: data.passed ? 'Verifikasi lulus' : `Verifikasi gagal: ${data.issues || ''}`,
          taskId: data.taskId
        });
        break;

      case 'APPROVED':
        this.sessionArtifact.addDecision({
          type: 'APPROVED',
          detail: `Patch disetujui: ${data.files?.length || 0} files`,
          taskId: data.taskId
        });
        break;

      case 'REJECTED':
        this.sessionArtifact.addDecision({
          type: 'REJECTED',
          detail: data.reason || 'Patch ditolak',
          taskId: data.taskId
        });
        break;

      case 'CAPABILITY_BLOCKED':
        this.sessionArtifact.addDecision({
          type: 'CAPABILITY_BLOCKED',
          detail: data.reason || 'Capability check gagal',
          taskId: data.taskId
        });
        break;

      case 'COMMAND_EXECUTED':
        // Audit trail: catat setiap terminal command [MAMET_CMD:]
        this.sessionArtifact.addCommand(
          data.command || 'unknown',
          data.status  || 'unknown',
          data.output  || ''
        );
        this.sessionArtifact.addDecision({
          type: 'COMMAND_EXECUTED',
          detail: `[${(data.status || '?').toUpperCase()}] $ ${data.command || 'unknown'}`,
          taskId: data.taskId || null
        });
        break;

      default:
        console.warn(`[Engineer] Unknown artifact action: ${action}`);
    }
  }

/**
   * [FIX #3] Menghasilkan string konteks Session Artifact untuk di-inject ke prompt LLM.
   * @returns {string} Konteks terformat, atau string kosong jika artifact belum ada
   */
  _injectArtifactIntoPrompt() {
    if (!this.sessionArtifact) {
      return '';
    }
    // Hanya inject jika ada aktivitas sebelumnya yang relevan
    const summary = this.sessionArtifact.getSummary();
    if (summary.taskCount === 0 && summary.decisionsCount === 0) {
      return '';
    }
    return this.sessionArtifact.toPromptContext();
  }

  /**
   * [FASE 1] Memfinalisasi sesi Engineering: memanggil MemoryGovernorService
   * untuk memverifikasi ringkasan memori terhadap raw content (golden source).
   * Dipanggil di akhir _executePatchApplication() ketika patch berhasil/selesai.
   * @param {Object} patch - Patch yang baru saja diterapkan
   * @returns {Promise<Object|null>} hasil verifikasi, atau null jika governor tidak tersedia
   */
  async _finalizeSession(patch = null) {
    try {
      const governor = this.serviceManager.has('MemoryGovernorService')
        ? this.serviceManager.get('MemoryGovernorService')
        : null;

      if (!governor || typeof governor.verifyEngineeringSession !== 'function') {
        console.warn('[Engineer] MemoryGovernorService tidak tersedia, skip finalisasi sesi');
        return null;
      }

      // Kotak metadata untuk memori yang disimpan selama sesi
      const goldenMeta = {
        source_type: 'engineer_session',
        source_reference: patch?.files?.map(f => f.path).join(',') || null,
        version_code: `ENG-${Date.now()}`,
        chat_id: null
      };

      // Simpan ringkasan sesi sebagai golden memory (opsional, via MemoryService)
      try {
        const memoryService = this.serviceManager.get('MemoryService');
        if (memoryService && this.sessionArtifact) {
          const summary = this.sessionArtifact.getSummary();
          const sessionSummary = `Engineering session ${summary.sessionId}: ${summary.taskCount} task, ${summary.modifiedFilesCount} file dimodifikasi, ${summary.violationsFound} pelanggaran MAEF.`;
          await memoryService.storeMemory(
            `Engineering session ${summary.sessionId}`,
            sessionSummary,
            goldenMeta
          );
        }
      } catch (e) {
        console.warn('[Engineer] Gagal menyimpan ringkasan sesi ke golden memory:', e);
      }

      // Verifikasi file yang dimodifikasi terhadap raw content
      const result = await governor.verifyEngineeringSession(this.sessionArtifact);
      console.log('[Engineer] Sesi Engineering difinalisasi:', result);
      return result;
    } catch (err) {
      console.error('[Engineer] _finalizeSession error:', err);
      return null;
    }
  }
  // [ADR-0017 Fase 4] Pending Patch Persistence & Verified/Rejected Approach Memory
  // diekstrak ke ./engineer/EngineerMemoryStore.js

  // [ADR-0017 Fase 2] _checkCapabilityAndDeclare, _isImmutableFile, _isProtectedFile
  // diekstrak ke ./engineer/CapabilityGuard.js (checkCapabilityAndDeclare, isImmutableFile, isProtectedFile)

  // =============================================
  // STATIC KNOWLEDGE (Brain 1)
  // =============================================

  async _loadStaticKnowledge() {
    try {
      const constitutionPaths = [
        'init.md',
        'agent.md',
        'AGENTS.md',
        'constitution/MAEF_v3.0.md',
        'constitution/Mamet_AI_Constitution_v2.0.md',
        'constitution/vision.md',
        'constitution/master-architecture.md',
        'constitution/00_CONSTITUTION.md',
        'constitution/01_VISION.md',
        'constitution/02_MAEF_KERNEL.md',
        'constitution/03_CAPABILITY_PORT.md',
        'constitution/04_OWNER_SOVEREIGNTY.md',
        'constitution/05_KNOWLEDGE_SYSTEM.md',
        'constitution/06_MEMORY_SYSTEM.md',
        'constitution/07_ENGINEERING_SYSTEM.md',
        'constitution/08_ROADMAP.md',
        'constitution/09_DNA.md',
        'constitution/10_ADR_SYSTEM.md',
        'constitution/11_MAEF_EVENT_SYSTEM.md',
        'constitution/12_CAPABILITY_ADAPTER_SPEC.md',
        'constitution/13_VERIFICATION_ENGINE_SPEC.md',
        'constitution/14_MAEF_ORCHESTRATOR_SPEC.md',
        'constitution/15_LOGGING_OBSERVABILITY_SYSTEM.md',
        'constitution/16_ENGINEERING_METRICS_SYSTEM.md',
        'constitution/17_MAEF_BOOTSTRAP_SYSTEM.md',
        'constitution/18_DEPLOYMENT_ARCHITECTURE.md',
        'constitution/19_REFERENCE_IMPLEMENTATION.md',
        'constitution/20_ENGINEERING POLICY.md',
        'constitution/21 Engineer Capability.md',
        'constitution/22_MUS_UI_SPECIFICATION.md',
        'constitution/23_HOME_DASHBOARD_SPEC.md',
        'constitution/ENGINEERING_CONTRACT.md',
        'constitution/README.md'
      ];

      const staticData = {};
      for (const path of constitutionPaths) {
        try {
          const content = await this.storageManager.read(path);
          if (content) {
            staticData[path] = content;
          }
        } catch (e) {
          // File mungkin belum ada
        }
      }

      this.brain.static = {
        loadedFiles: Object.keys(staticData),
        raw: staticData,
        summary: 'Static knowledge loaded from constitution & ADRs',
        loadedAt: new Date().toISOString()
      };

      console.log(`[Engineer] Static knowledge loaded: ${this.brain.static.loadedFiles.length} files`);
    } catch (error) {
      console.error('[Engineer] Failed to load static knowledge', error);
      this.brain.static = { loadedFiles: [], error: error.message };
    }
  }

  // =============================================
  // EVENT LISTENERS
  // =============================================

  _registerListeners() {
    this.eventBus.on('Engineer:AnalyzeTask', (wrappedPayload) => {
      const task = wrappedPayload?.data || wrappedPayload;
      this._handleAnalysisTask(task);
    });

    this.eventBus.on('Engineer:ReviewChanges', (wrappedPayload) => {
      const task = wrappedPayload?.data || wrappedPayload;
      this._handleReviewTask(task);
    });

    this.eventBus.on('Engineer:GeneratePatch', (wrappedPayload) => {
      const task = wrappedPayload?.data || wrappedPayload;
      console.log('[Engineer] 📨 Received GeneratePatch event:', task);
      console.log('[Engineer] Task title:', task?.title);
      console.log('[Engineer] Task description:', task?.description?.substring(0, 100));
      this._handlePatchTask(task);
    });

    this.eventBus.on('Engineer:ApprovalResponse', (wrappedPayload) => {
      const response = wrappedPayload?.data || wrappedPayload;
      handleApprovalResponse(response, { pendingPatches: this.pendingPatches, storageManager: this.storageManager });
    });

    // FASE 3: Reasoning Lock listener
    this.eventBus.on('Engineer:UserConfirmation', (wrappedPayload) => {
      const response = wrappedPayload?.data || wrappedPayload;
      handleUserConfirmation(response, { pendingConfirmations: this.pendingConfirmations });
    });

    // READ_REPO: Membaca file/folder dari repository
    this.eventBus.on('Engineer:ReadRepo', (wrappedPayload) => {
      const task = wrappedPayload?.data || wrappedPayload;
      this._handleReadRepoTask(task);
    });

    // AUDIT TRAIL: terminal command dijalankan via [MAMET_CMD:] di ConversationEngine
    this.eventBus.on('Engineer:CommandExecuted', (wrappedPayload) => {
      const data = wrappedPayload?.data || wrappedPayload;
      console.log(`[Engineer] 📟 Command audit: [${(data?.status || '?').toUpperCase()}] $ ${data?.command || 'unknown'}`);
      this._updateArtifact('COMMAND_EXECUTED', data);
    });
  }

  // [ADR-0017 Fase 5] _emitReasoningReport, _waitForUserConfirmation, _handleUserConfirmation
  // diekstrak ke ./engineer/ReasoningLock.js
  // =============================================
  // FASE 1: INTENT DETECTION & KLARIFIKASI
  // =============================================

  /**
   * Mendeteksi intent user berdasarkan keyword pada task title + description.
   * @param {Object} task - Task object dengan title & description
   * @returns {string} 'ANALYSIS' | 'MODIFY_CODE' | 'CLARIFICATION' | 'UNKNOWN'
   */
  // [ADR-0017 Fase 2] _detectIntent diekstrak ke ./engineer/IntentClassifier.js (detectIntent)

  // =============================================
  // DYNAMIC CONTEXT (Brain 2) & TASK HANDLING
  // =============================================

  // [ADR-0017 Fase 6] _buildDynamicContext, _handleAnalysisTask, _handleReviewTask,
  // _handleReadRepoTask, _handleReadFiles, _handleListDirectory, _handleSearchFiles,
  // dan ketiga _extract*FromPrompt diekstrak ke ./engineer/TaskHandlers.js

  async _buildDynamicContext(task) {
    return buildDynamicContext(task, {
      fileIndexService: this.fileIndexService,
      brain: this.brain,
      sessionArtifact: this.sessionArtifact
    });
  }

  async _handleAnalysisTask(task) {
    return handleAnalysisTask(task, {
      metrics: this.metrics,
      brain: this.brain,
      fileIndexService: this.fileIndexService,
      sessionArtifact: this.sessionArtifact,
      analyze: (t) => this._analyze(t),
      updateArtifact: (type, data) => this._updateArtifact(type, data),
      emitRecommendation: (r) => this._emitRecommendation(r),
      calculateConfidence: (a) => this._calculateConfidence(a)
    });
  }

  async _handleReviewTask(task) {
    return handleReviewTask(task, {
      metrics: this.metrics,
      brain: this.brain,
      fileIndexService: this.fileIndexService,
      sessionArtifact: this.sessionArtifact,
      review: (t) => this._review(t),
      emitRecommendation: (r) => this._emitRecommendation(r),
      calculateConfidence: (a) => this._calculateConfidence(a)
    });
  }

  // =============================================
  // READ REPO — Membaca file dari repository
  // =============================================

  /**
   * Handler utama untuk intent READ_REPO.
   * Dipanggil dari _handlePatchTask() saat intent = READ_REPO,
   * dan dari listener Engineer:ReadRepo.
   */
  async _handleReadRepoTask(task) {
    return handleReadRepoTask(task, this._taskHandlerDeps());
  }

  /**
   * Membaca satu atau beberapa file dan emit hasilnya ke UI.
   */
  async _handleReadFiles(task, paths) {
    return handleReadFiles(task, paths, this._taskHandlerDeps());
  }

  /**
   * Mendaftar isi direktori dan emit hasilnya.
   */
  async _handleListDirectory(task, dirPath) {
    return handleListDirectory(task, dirPath, this._taskHandlerDeps());
  }

  /**
   * Mencari file berdasarkan query dan emit hasilnya.
   */
  async _handleSearchFiles(task, query) {
    return handleSearchFiles(task, query, this._taskHandlerDeps());
  }

  _taskHandlerDeps() {
    return {
      repositoryReader: this.repositoryReader,
      emitRecommendation: (r) => this._emitRecommendation(r),
      fileIndexService: this.fileIndexService,
      sessionArtifact: this.sessionArtifact,
      eventBus: this.eventBus
    };
  }

  async _handlePatchTask(task) {
    // =============================================
    // CIRCUIT BREAKER: Mencegah saldo OpenRouter habis akibat loop AI
    // =============================================
    if (!this._apiCallCount) this._apiCallCount = 0;
    this._apiCallCount++;

    const now = Date.now();
    if (now - this._lastApiReset > 60000) {
      this._apiCallCount = 1;
      this._lastApiReset = now;
    }

    if (this._apiCallCount > 5) {
      this.capability = 'OBSERVER';
      console.warn('[Engineer] 🚨 CIRCUIT BREAKER TRIPPED! API calls exceeded 5/min. Downgrading to OBSERVER.');
      return;
    }

    if (this.capability !== 'IMPLEMENTER' && this.capability !== 'SELF_MAINTENANCE') {
      this.eventBus.emit('Engineer:Recommendation', {
        type: 'ERROR',
        taskId: task.id,
        message: 'Engineer belum memiliki kapabilitas IMPLEMENTER.',
        requiresApproval: false
      });
      return;
    }

    // === FASE 1: INTENT DETECTION ===
    this.intentState = 'ANALYZING';
    const intent = detectIntent(task);
    console.log(`[Engineer] 🎯 Intent detected: ${intent} (task: ${task.title || task.id})`);

    if (intent === 'READ_REPO') {
      this.intentState = 'READY';
      console.log(`[Engineer] 📂 Redirecting to READ_REPO handler`);
      await this._handleReadRepoTask(task);
      return;
    }

    if (intent === 'ANALYSIS') {
      this.intentState = 'READY';
      console.log(`[Engineer] 📋 Redirecting to ANALYSIS handler (bukan patch)`);
      await this._handleAnalysisTask(task);
      return;
    }

    if (intent === 'CLARIFICATION') {
      this.intentState = 'ASK_CLARIFICATION';
      const clarificationMsg = `Permintaan Anda membutuhkan klarifikasi. Apakah Anda ingin:\n1. 🔍 **Menganalisis** kode yang ada?\n2. ✏️ **Memodifikasi/menambahkan** kode?\n3. 📖 **Meninjau** perubahan yang sudah ada?\n\n_Mohon diperjelas agar Engineer dapat memberikan hasil yang tepat._`;

      console.log(`[Engineer] ❓ Asking clarification for task: ${task.title || task.id}`);
      this._emitRecommendation({
        type: 'ASK_CLARIFICATION',
        taskId: task.id,
        message: clarificationMsg,
        intent: intent,
        requiresApproval: false
      });
      return;
    }

    // Jika sampai sini, intent pasti MODIFY_CODE
    this.intentState = 'PROCEEDING';
    this.metrics.patchesGenerated++;
    console.log(`[Engineer] 🔨 Proceeding with patch generation for: ${task.title || task.id}`);
    this.brain.dynamic = await this._buildDynamicContext(task);

    // === FASE 2: CAPABILITY GUARD ===
    let modelName = 'unknown';
    try {
      const brainService = this.serviceManager.get('BrainService');
      if (brainService && typeof brainService.getActiveBrainContext === 'function') {
        const context = await brainService.getActiveBrainContext();
        modelName = context.model || modelName;
      }
    } catch (e) {
      console.warn('[Engineer] Gagal mendapatkan model name:', e.message);
    }

    const capabilityCheck = checkCapabilityAndDeclare(task, { modelName }, {
      extractFileNamesFromTask,
      findRelevantADR,
      calculateConfidence: (a) => this._calculateConfidence(a)
    });

    if (!capabilityCheck.pass) {
      console.log(`[Engineer] 🚫 Capability check blocked task: ${task.title || task.id}`);
      this._updateArtifact('CAPABILITY_BLOCKED', {
        taskId: task.id,
        reason: capabilityCheck.reason
      });
      this._emitRecommendation({
        type: 'CAPABILITY_BLOCKED',
        taskId: task.id,
        message: `🧠 **Engineer (${modelName})** — Saya tidak dapat memproses permintaan ini.\n\n**Alasan:** ${capabilityCheck.reason}`,
        capabilityCheck,
        modelName,
        requiresApproval: false
      });
      return;
    }

    const analysis = await this._analyze(task);

    // === FASE 3: REASONING LOCK ===
    const reasoningReport = emitReasoningReport(task, analysis, {
      intent: 'MODIFY_CODE',
      capabilityCheck,
      modelName
    }, {
      calculateConfidence: (a) => this._calculateConfidence(a),
      eventBus: this.eventBus,
      capability: this.capability,
      extractFileNamesFromTask
    });

    // FASE 4: Update Session Artifact — Reasoning
    this._updateArtifact('REASONING', {
      taskId: task.id,
      report: reasoningReport,
      summary: reasoningReport.summary
    });

    // Tunggu konfirmasi user (Reasoning Lock)
    const userConfirmed = await waitForUserConfirmation(reasoningReport, { pendingConfirmations: this.pendingConfirmations, eventBus: this.eventBus });

    if (!userConfirmed) {
      console.log(`[Engineer] 🚫 User membatalkan task: ${task.title || task.id}`);
      this._emitRecommendation({
        type: 'REASONING_REJECTED',
        taskId: task.id,
        message: `🧠 **Engineer (${modelName})** — Analisis telah dibatalkan.\n\n**Ringkasan Analisis:** ${reasoningReport.summary}\n\nAnda dapat mengirim ulang permintaan dengan instruksi yang lebih spesifik.`,
        reasoningReport,
        modelName,
        requiresApproval: false
      });
      return;
    }

    console.log(`[Engineer] ✅ User confirmed, proceeding to generate patch for: ${task.title || task.id}`);
    const patch = await this._generatePatch(task);

    // FASE 4: Update Session Artifact — Patch Generated
    this._updateArtifact('PATCH_GENERATED', {
      taskId: task.id,
      files: patch.files?.map(f => f.path) || []
    });

    if (patch.ready) {
      const verificationEngine = this.serviceManager.get('VerificationEngine');
      if (verificationEngine && typeof verificationEngine.verifyPatchEngineering === 'function') {
        try {
          const vContext = {
            responseText: JSON.stringify(patch.files.reduce((acc, f) => {
              acc[f.path] = f.newContent;
              return acc;
            }, {})),
            runtimeContext: { mode: 'ENGINEER' }
          };
          const verificationResult = verificationEngine.verifyPatchEngineering(vContext);
          patch.verification = {
            passed: verificationResult.decision === 'PASS',
            score: verificationResult.score,
            issues: verificationResult.failures,
            criticalCount: verificationResult.failures.filter(f => f.severity === 'CRITICAL').length
          };

          // FASE 4: Update Session Artifact — Verification
          this._updateArtifact('VERIFICATION', {
            taskId: task.id,
            passed: patch.verification.passed,
            issues: patch.verification.issues?.map(i => i.message).join(', ')
          });

          if (!patch.verification.passed) {
            console.warn('[Engineer] Patch gagal verifikasi:', patch.verification.issues);
            this.metrics.patchesFailedVerification++;
            patch.ready = false;

            this._emitRecommendation({
              type: 'PATCH_VERIFICATION_FAILED',
              taskId: task.id,
              patch,
              verification: patch.verification,
              message: `Patch tidak lolos verifikasi: ${patch.verification.criticalCount} masalah kritis.`,
              confidence: this._calculateConfidence(analysis),
              requiresApproval: false
            });
            return;
          }
        } catch (e) {
          console.warn('[Engineer] Frontend verification skipped:', e.message);
        }
      }
    }

    if (patch.ready) {
      // ===================================================
      // [C] BREAKING CHANGE DETECTOR
      // Cek export yang hilang & masih dipakai file lain.
      // Non-blocking: warning ditampilkan tapi tidak menghentikan proses.
      // ===================================================
      try {
        console.log('[Engineer] 🔍 Menjalankan Breaking Change Detector...');
        const bcWarnings = await detectBreakingChanges(patch, { fileIndexService: this.fileIndexService, storageManager: this.storageManager });
        const highSeverity   = bcWarnings.filter(w => w.severity === 'HIGH');
        const medSeverity    = bcWarnings.filter(w => w.severity === 'MEDIUM');

        if (highSeverity.length > 0) {
          // Simpan di patch agar tampil di approval dialog
          patch.breakingWarnings = highSeverity;

          const lines = highSeverity.map(w =>
            `- \`${w.symbol}\` dihapus dari \`${w.file}\`\n  Digunakan di: ${w.callers.slice(0, 3).join(', ')}${w.callers.length > 3 ? ` +${w.callers.length - 3} lainnya` : ''}`
          );
          this._emitRecommendation({
            type: 'BREAKING_CHANGE_WARNING',
            taskId: task.id,
            message: `⚠️ **Peringatan Breaking Change** — ${highSeverity.length} export yang dihapus masih digunakan di tempat lain:\n\n${lines.join('\n\n')}\n\n_Patch tetap bisa dilanjutkan — tapi Anda perlu memperbarui file yang terpengaruh._`,
            breakingWarnings: highSeverity,
            requiresApproval: false
          });
          console.warn(`[Engineer] ⚠️ Breaking changes terdeteksi: ${highSeverity.length} symbol`);
        }

        if (medSeverity.length > 0) {
          const sigLines = medSeverity.map(w => {
            const callerInfo = w.callers.length > 0
              ? `\n  Digunakan di: ${w.callers.slice(0, 3).join(', ')}${w.callers.length > 3 ? ` +${w.callers.length - 3} lainnya` : ''}`
              : '';
            return `- \`${w.symbol}\` — ${w.detail}${callerInfo}`;
          });
          this._emitRecommendation({
            type: 'SIGNATURE_CHANGE_WARNING',
            taskId: task.id,
            message: `⚠️ **Peringatan Signature Berubah** — ${medSeverity.length} fungsi mengalami perubahan jumlah parameter:\n\n${sigLines.join('\n\n')}\n\n_Periksa apakah parameter baru bersifat optional. Caller lama mungkin masih valid._`,
            breakingWarnings: medSeverity,
            requiresApproval: false
          });
          console.warn(`[Engineer] ⚠️ Signature changes terdeteksi: ${medSeverity.length} symbol`);
        }

        if (highSeverity.length === 0 && medSeverity.length === 0) {
          const lowCount = bcWarnings.filter(w => w.severity === 'LOW').length;
          if (lowCount > 0) {
            console.log(`[Engineer] ℹ️ Breaking change LOW severity: ${lowCount} (tidak ada caller aktif, aman)`);
          } else {
            console.log('[Engineer] ✅ Tidak ada breaking change terdeteksi');
          }
        }
      } catch (bcErr) {
        console.warn('[Engineer] Breaking change detector error (non-blocking):', bcErr.message);
      }

      const approvalResult = await requestApproval(patch, analysis, {
        pendingPatches: this.pendingPatches,
        eventBus: this.eventBus,
        storageManager: this.storageManager,
        calculateConfidence: (a) => this._calculateConfidence(a)
      });

      if (approvalResult.approved) {
        await this._executePatchApplication(patch, approvalResult.approvedFiles);
        this.metrics.patchesApproved++;

        // FASE 4: Update Session Artifact — Approved
        this._updateArtifact('APPROVED', {
          taskId: task.id,
          files: approvalResult.approvedFiles
        });

        // ===================================================
        // [D] SEMANTIC DIFF VERIFICATION (post-apply)
        // Baca ulang file yang baru ditulis, verifikasi strukturnya.
        // ===================================================
        try {
          console.log('[Engineer] 🔬 Menjalankan Semantic Diff Verification...');
          const semanticIssues = await verifySemanticDiff(patch, { storageManager: this.storageManager });
          const criticalIssues = semanticIssues.filter(i => i.severity === 'CRITICAL');
          const highIssues     = semanticIssues.filter(i => i.severity === 'HIGH');

          if (semanticIssues.length > 0) {
            const issueLines = semanticIssues.map(i =>
              `- \`${i.file}\` [${i.severity}]: ${i.issue}`
            );
            const isCritical = criticalIssues.length > 0;
            this._emitRecommendation({
              type: 'SEMANTIC_DIFF_ISSUE',
              taskId: task.id,
              message: `${isCritical ? '🔴' : '🟡'} **Semantic Diff ${isCritical ? 'Kritis' : 'Peringatan'}** — ${semanticIssues.length} masalah terdeteksi setelah patch diterapkan:\n\n${issueLines.join('\n')}\n\n${isCritical ? '_Disarankan untuk rollback menggunakan tombol Rollback di atas._' : '_Periksa file tersebut untuk memastikan tidak ada masalah._'}`,
              semanticIssues,
              requiresApproval: false
            });
            console.warn(`[Engineer] Semantic issues: ${criticalIssues.length} critical, ${highIssues.length} high`);
          } else {
            console.log('[Engineer] ✅ Semantic diff OK - semua file terverifikasi');
          }
        } catch (sdErr) {
          console.warn('[Engineer] Semantic diff verification error (non-blocking):', sdErr.message);
        }

        this._emitRecommendation({
          type: 'PATCH_APPLIED',
          taskId: task.id,
          patch,
          message: `Patch diterapkan: ${approvalResult.approvedFiles.length} file dari ${patch.files.length}.`,
          confidence: this._calculateConfidence(analysis),
          requiresApproval: false
        });

        // 🧠 VERIFIED APPROACH MEMORY: simpan pendekatan yang berhasil
        saveVerifiedApproach(task, patch, { storageManager: this.storageManager }); // fire-and-forget

      } else {
        this.metrics.patchesRejected++;

        // FASE 4: Update Session Artifact — Rejected
        this._updateArtifact('REJECTED', {
          taskId: task.id,
          reason: 'User menolak patch'
        });

        // 🧠 VERIFIED APPROACH MEMORY: simpan pola yang ditolak
        saveRejectedApproach(task, 'User menolak patch', { storageManager: this.storageManager }); // fire-and-forget

        this._emitRecommendation({
          type: 'PATCH_REJECTED',
          taskId: task.id,
          patch,
          message: 'Patch ditolak oleh User.',
          confidence: this._calculateConfidence(analysis),
          requiresApproval: false
        });
      }
    } else {
      if (!patch.verification) {
        this._emitRecommendation({
          type: 'PATCH_FAILED',
          taskId: task.id,
          patch,
          confidence: this._calculateConfidence(analysis),
          requiresApproval: false
        });
      }
    }
  }

  // =============================================
  // FASE 3: BREAKING CHANGE DETECTOR
  // Sebelum patch apply: cek apakah ada export yang hilang/berubah
  // yang masih dipakai oleh file lain di codebase.
  // =============================================

  // [ADR-0017 Fase 3] _extractExports, _extractFunctionSignatures, _findUsages, _detectBreakingChanges,
  // _verifySemanticDiff diekstrak ke ./engineer/StaticCodeAnalyzer.js

  // [ADR-0017 Fase 5] _handleApprovalResponse diekstrak ke ./engineer/ApprovalGateway.js (handleApprovalResponse)

  // [ADR-0017 Fase 4] readFile, findFiles, _extractFileNamesFromTask, _findRelevantADR
  // diekstrak ke ./engineer/FileSystemGateway.js

  _checkCompliance(fileContents) {
    const violations = [];
    const warnings = [];

    for (const [filePath, content] of Object.entries(fileContents)) {
      const lines = content.split('\n');

      const eventEmitRegex = /eventBus\.emit\(['"]([^'"]+)['"]/g;
      const eventMatches = [...content.matchAll(eventEmitRegex)];
      for (const match of eventMatches) {
        const eventName = match[1];
        if (!eventName.includes(':')) {
          violations.push({
            file: filePath,
            line: content.substring(0, match.index).split('\n').length,
            rule: 'MAEF 4.6 (Event-Driven)',
            severity: 'HIGH',
            message: `Event "${eventName}" tidak menggunakan format namespace (Kategori:Nama)`
          });
        }
      }

      if (content.includes('eval(') || content.includes('new Function(')) {
        violations.push({
          file: filePath,
          line: null,
          rule: 'MAEF 4.1 (Security)',
          severity: 'CRITICAL',
          message: 'Terdeteksi penggunaan eval() atau new Function() yang dilarang'
        });
      }

      const directVendorCalls = [
        /fetch\(['"]https:\/\/api\.openai\.com/,
        /fetch\(['"]https:\/\/generativelanguage\.googleapis\.com/,
        /require\(['"]@anthropic-ai/
      ];
      for (const pattern of directVendorCalls) {
        if (pattern.test(content)) {
          violations.push({
            file: filePath,
            line: null,
            rule: 'MAEF 4.7 (Adapter Isolation)',
            severity: 'HIGH',
            message: 'Terdeteksi pemanggilan vendor API langsung tanpa Adapter Layer'
          });
        }
      }

      if (lines.length > 200) {
        const jsdocCount = (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
        if (jsdocCount < 3) {
          warnings.push({
            file: filePath,
            rule: 'MAEF 4.8 (Documentation)',
            severity: 'LOW',
            message: `File besar (${lines.length} baris) dengan dokumentasi minimal (${jsdocCount} JSDoc)`
          });
        }
      }
    }

    return { violations, warnings };
  }

  async _analyze(task) {
    console.log(`[Engineer] Memulai Real Analysis untuk: ${task.title || task.id}`);

    const targetFiles = extractFileNamesFromTask(task);
    console.log(`[Engineer] File terdeteksi: ${targetFiles.join(', ')}`);

    const fileContents = {};
    const readResults = [];

    for (const filePath of targetFiles.slice(0, MAX_FILES_PER_PATCH)) {
      const result = await tryReadFile(filePath, { storageManager: this.storageManager, fileIndexService: this.fileIndexService });
      if (result) {
        fileContents[result.path] = result.content;
        readResults.push({ file: result.path, status: 'SUCCESS', size: result.content.length });
      } else {
        readResults.push({ file: filePath, status: 'NOT_FOUND' });
      }
    }

    const relevantADR = findRelevantADR(task);
    let adrContent = null;
    if (relevantADR) {
      adrContent = await readFile(relevantADR.path, { storageManager: this.storageManager });
    }

    const compliance = this._checkCompliance(fileContents);
    const findings = [];

    if (compliance.violations.length > 0) {
      findings.push(`🔴 Ditemukan ${compliance.violations.length} pelanggaran MAEF:`);
      compliance.violations.forEach(v => {
        findings.push(`   - [${v.severity}] ${v.file}:${v.line || '?'} - ${v.message} (${v.rule})`);
      });
    }

    if (compliance.warnings.length > 0) {
      findings.push(`🟡 Ditemukan ${compliance.warnings.length} peringatan:`);
      compliance.warnings.forEach(w => {
        findings.push(`   - [${w.severity}] ${w.file} - ${w.message}`);
      });
    }

    if (compliance.violations.length === 0 && compliance.warnings.length === 0) {
      findings.push('✅ Tidak ada pelanggaran MAEF yang terdeteksi pada file yang dianalisis.');
    }

    const metrics = {
      filesAnalyzed: Object.keys(fileContents).length,
      totalCodeLines: Object.values(fileContents).reduce((sum, c) => sum + c.split('\n').length, 0),
      violationsFound: compliance.violations.length,
      warningsFound: compliance.warnings.length,
      adrReferenced: relevantADR ? relevantADR.path : 'None'
    };

    return {
      summary: `Analisis selesai: ${metrics.filesAnalyzed} file, ${metrics.totalCodeLines} baris kode, ${metrics.violationsFound} pelanggaran`,
      findings: findings,
      rawContext: fileContents,
      compliance: compliance,
      metrics: metrics,
      recommendation: metrics.violationsFound > 0
        ? 'Perlu perbaikan untuk mematuhi MAEF'
        : 'Kode aman, lanjutkan dengan implementasi fitur'
    };
  }

  async _review(task) {
    const analysis = await this._analyze(task);
    return {
      verdict: analysis.compliance.violations.length > 0 ? 'REJECT' : 'APPROVE',
      issues: analysis.compliance.violations,
      notes: `Review selesai: ${analysis.metrics.filesAnalyzed} file diperiksa.`,
      analysis: analysis
    };
  }

  // [ADR-0017 Fase 7] _generatePatch, _buildPatchPrompt, _extractCodeFromResponse,
  // _generateFallbackPatch diekstrak ke ./engineer/PatchGenerator.js. §2.1 (Scoped
  // Snippet Extraction) diimplementasikan sebagai modul baru ./engineer/CodeSnippetExtractor.js,
  // dipanggil dari dalam PatchGenerator.js — bukan lagi potongan char-count di prompt builder.

  async _generatePatch(task) {
    return generatePatch(task, {
      storageManager: this.storageManager,
      fileIndexService: this.fileIndexService,
      serviceManager: this.serviceManager,
      eventBus: this.eventBus,
      brain: this.brain,
      injectArtifactIntoPrompt: () => this._injectArtifactIntoPrompt()
    });
  }

  async _executePatchApplication(patch, approvedFiles = []) {
    try {
      console.log(`[Engineer] 🔧 Menerapkan patch: ${patch.id}`);
      console.log(`[Engineer] 📋 Files to process: ${patch.files.length}, Approved: ${approvedFiles.length}`);

      for (const file of patch.files) {
        if (isImmutableFile(file.path)) {
          console.error(`[Engineer] 🚫 BLOCKED: Attempt to modify IMMUTABLE core file: ${file.path}`);
          this.metrics.coreModificationsBlocked++;
          this.suspiciousAttempts++;

          if (this.suspiciousAttempts >= 3) {
            this.capability = 'OBSERVER';
            this.eventBus.emit('Engineer:EmergencyLockdown', {
              reason: 'Suspicious core modification attempts detected',
              attempts: this.suspiciousAttempts
            });
          }

          this._emitRecommendation({
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

            this.eventBus.emit('Engineer:Recommendation', {
              taskId: patch.taskId,
              message: `⚠️ **Patch Ditolak Otomatis**: File \`${file.path}\` tidak ditulis karena LLM mengembalikan konten yang terpotong (${newSize} dari ${originalSize} karakter). Coba lagi dengan instruksi yang lebih spesifik.`,
              type: 'SAFETY_REJECTION',
              requiresApproval: false
            });
            continue;
          }

          console.log(`[Engineer] ✍️ Menulis file: ${file.path} (${newSize} karakter, asli: ${originalSize} karakter)`);
          const writeResult = await this.storageManager.write(file.path, file.newContent);

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
        const memoryService = this.serviceManager.get('MemoryService');
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

this.eventBus.emit('Engineer:PatchApplied', result);
      console.log(`[Engineer] 🎯 Patch selesai: ${successCount} applied, ${skippedCount} skipped, ${failCount} failed`);

      // [FASE 1] Finalisasi sesi: verifikasi ringkasan memori terhadap golden source
      try {
        await this._finalizeSession(patch);
      } catch (e) {
        console.warn('[Engineer] Finalisasi sesi gagal (tidak memblokir patch):', e.message);
      }

      return result;
    } catch (error) {
      console.error('[Engineer] ❌ Patch execution gagal total:', error);
      return { success: false, error: error.message };
    }
  }

  _calculateConfidence(result) {
    let coverage = 0;
    let evidence = 0;

    if (result.rawContext) {
      const filesAttempted = result.metrics?.filesAnalyzed || 0;
      const filesRead = Object.keys(result.rawContext).length;
      coverage = filesAttempted > 0 ? Math.round((filesRead / filesAttempted) * 100) : 0;
    }

    if (result.compliance) {
      const violations = result.compliance.violations?.length || 0;
      const warnings = result.compliance.warnings?.length || 0;

      if (violations === 0 && warnings === 0) {
        evidence = 90;
      } else if (violations === 0) {
        evidence = 70;
      } else if (violations <= 2) {
        evidence = 50;
      } else {
        evidence = 20;
      }
    }

    let level = 'LOW';
    if (coverage >= 80 && evidence >= 70) level = 'HIGH';
    else if (coverage >= 50 && evidence >= 50) level = 'MEDIUM';

    return { coverage, evidence, level };
  }

  // [ADR-0017 Fase 4] _tryReadFile diekstrak ke ./engineer/FileSystemGateway.js (tryReadFile)

  // [ADR-0017 Fase 5] _requestApproval diekstrak ke ./engineer/ApprovalGateway.js (requestApproval)

  /**
   * [ADR-0017 Fase 5] Wrapper tipis — logika sesungguhnya ada di
   * ./engineer/ApprovalGateway.js (emitRecommendation). Dipertahankan sebagai
   * method instance karena dipanggil dari ~21 tempat di dalam _handlePatchTask;
   * mengubah semua titik panggil sekaligus berisiko tidak sepadan manfaatnya.
   */
  _emitRecommendation(recommendation) {
    emitRecommendation(recommendation, { eventBus: this.eventBus, capability: this.capability });
  }

  upgradeCapability(newCapability) {
    const validCapabilities = [
      'OBSERVER', 'REVIEWER', 'ARCHITECT', 'PLANNER',
      'IMPLEMENTER', 'VERIFIER', 'SELF_MAINTENANCE'
    ];
    if (validCapabilities.includes(newCapability)) {
      this.capability = newCapability;
      this.suspiciousAttempts = 0;
      console.log(`[Engineer] Capability upgraded to ${newCapability}`);
      this.eventBus.emit('Engineer:CapabilityUpdated', { capability: this.capability });
    } else {
      console.warn(`[Engineer] Invalid capability: ${newCapability}`);
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      capability: this.capability,
      suspiciousAttempts: this.suspiciousAttempts,
      sessionSummary: this.sessionArtifact ? this.sessionArtifact.getSummary() : null
    };
  }
}

export { Engineer };