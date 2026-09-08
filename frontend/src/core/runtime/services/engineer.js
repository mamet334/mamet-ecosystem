import { FileIndexService } from './FileIndexService.js';
import { SessionArtifact } from './engineer/SessionArtifact.js'; // [ADR-0017 Fase 1] Diekstrak dari file ini
import { MAX_FILES_PER_PATCH, checkCapabilityAndDeclare, isImmutableFile, isProtectedFile } from './engineer/CapabilityGuard.js'; // [ADR-0017 Fase 2]
import { detectIntent } from './engineer/IntentClassifier.js'; // [ADR-0017 Fase 2]
import { extractExports, extractFunctionSignatures, findUsages, detectBreakingChanges, verifySemanticDiff } from './engineer/StaticCodeAnalyzer.js'; // [ADR-0017 Fase 3]
import { savePendingPatch, clearPendingPatch, restorePersistedPatches, saveVerifiedApproach, saveRejectedApproach, loadVerifiedApproaches } from './engineer/EngineerMemoryStore.js'; // [ADR-0017 Fase 4]
import { readFile, findFiles, extractFileNamesFromTask, findRelevantADR, tryReadFile } from './engineer/FileSystemGateway.js'; // [ADR-0017 Fase 4]
import { emitReasoningReport, waitForUserConfirmation, handleUserConfirmation } from './engineer/ReasoningLock.js'; // [ADR-0017 Fase 5]
import { handleApprovalResponse, requestApproval, emitRecommendation } from './engineer/ApprovalGateway.js'; // [ADR-0017 Fase 5]

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

  /**
   * [FIX #5] _buildDynamicContext() diperkaya dengan metadata task dan file list.
   * Sebelumnya hampir kosong — sekarang menyediakan konteks yang berguna untuk analisis.
   * @param {Object} task - Task yang sedang diproses
   * @returns {Object} Dynamic context object
   */
  async _buildDynamicContext(task) {
    const targetFiles = task.files || extractFileNamesFromTask(task);
    let availableFiles = [];

    try {
      if (this.fileIndexService && this.fileIndexService.isReady) {
        availableFiles = this.fileIndexService.getAllFiles?.() || [];
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
        staticKnowledgeLoaded: this.brain.static?.loadedFiles?.length || 0
      },
      sessionContext: this.sessionArtifact ? this.sessionArtifact.getSummary() : null,
      timestamp: new Date().toISOString()
    };
  }

  async _handleAnalysisTask(task) {
    this.metrics.tasksAnalyzed++;
    console.log(`[Engineer] Analyzing task: ${task.title || task.id}`);
    this.brain.dynamic = await this._buildDynamicContext(task);
    const analysis = await this._analyze(task);

    // FASE 4: Update Session Artifact
    this._updateArtifact('ANALYSIS', {
      taskId: task.id,
      files: Object.keys(analysis.rawContext || {}),
      violations: analysis.compliance?.violations || [],
      summary: analysis.summary
    });

    this._emitRecommendation({
      type: 'ANALYSIS',
      taskId: task.id,
      analysis,
      confidence: this._calculateConfidence(analysis),
      requiresApproval: false
    });
  }

  async _handleReviewTask(task) {
    this.metrics.recommendationsMade++;
    console.log(`[Engineer] Reviewing changes for: ${task.title || task.id}`);
    this.brain.dynamic = await this._buildDynamicContext(task);
    const review = await this._review(task);
    this._emitRecommendation({
      type: 'REVIEW',
      taskId: task.id,
      review,
      confidence: this._calculateConfidence(review),
      requiresApproval: false
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
    const taskText = `${task.title || ''} ${task.description || ''}`;
    console.log(`[Engineer] 📂 READ_REPO task: ${task.title || task.id}`);

    if (!this.repositoryReader) {
      this._emitRecommendation({
        type: 'READ_REPO_ERROR',
        taskId: task.id,
        message: '❌ **RepositoryReaderService** belum tersedia. Coba restart OS.',
        requiresApproval: false
      });
      return;
    }

    // Deteksi apakah LIST atau READ
    const isListRequest = /list|daftar|struktur|tree|folder|direktori|directory/i.test(taskText);
    const isSearchRequest = /cari|search|find|dimana|where/i.test(taskText);

    if (isListRequest) {
      const dirPath = this._extractDirectoryFromPrompt(taskText);
      await this._handleListDirectory(task, dirPath);
    } else if (isSearchRequest) {
      const query = this._extractSearchQueryFromPrompt(taskText);
      await this._handleSearchFiles(task, query);
    } else {
      // Default: baca konten file
      const paths = this._extractPathsFromPrompt(taskText);
      if (paths.length === 0) {
        this._emitRecommendation({
          type: 'READ_REPO_CLARIFICATION',
          taskId: task.id,
          message: '❓ **Engineer** — Sebutkan nama file atau path yang ingin dibaca.\n\nContoh:\n- `baca file Kernel.js`\n- `tampilkan isi engineer.js`\n- `list folder frontend/src/core`\n- `cari file BrainService`',
          requiresApproval: false
        });
        return;
      }
      await this._handleReadFiles(task, paths);
    }
  }

  /**
   * Membaca satu atau beberapa file dan emit hasilnya ke UI.
   */
  async _handleReadFiles(task, paths) {
    const results = [];
    const errors = [];

    for (const requestedPath of paths) {
      // Coba resolve path via FileIndexService (jika hanya nama file)
      let resolvedPath = requestedPath;
      if (!requestedPath.includes('/') && this.fileIndexService?.isReady) {
        const resolved = this.fileIndexService.resolvePath(requestedPath);
        if (resolved) {
          resolvedPath = resolved;
          console.log(`[Engineer] 🔍 Path resolved: ${requestedPath} → ${resolvedPath}`);
        }
      }

      const result = await this.repositoryReader.readFile(resolvedPath);
      if (result) {
        results.push(result);
        this.sessionArtifact?.addAnalyzedFile(resolvedPath);
      } else {
        // Coba search sebagai fallback
        const searchResults = await this.repositoryReader.searchFiles(requestedPath);
        if (searchResults.length > 0) {
          const firstMatch = searchResults[0];
          const fallback = await this.repositoryReader.readFile(firstMatch);
          if (fallback) {
            results.push(fallback);
            this.sessionArtifact?.addAnalyzedFile(firstMatch);
          } else {
            errors.push(requestedPath);
          }
        } else {
          errors.push(requestedPath);
        }
      }
    }

    if (results.length === 0) {
      this._emitRecommendation({
        type: 'READ_REPO_NOT_FOUND',
        taskId: task.id,
        message: `❌ **Engineer** — File tidak ditemukan: ${errors.join(', ')}\n\nGunakan \`cari file [nama]\` untuk mencari file yang dimaksud.`,
        requiresApproval: false
      });
      return;
    }

    // Emit setiap file sebagai FileContent event ke UI
    for (const file of results) {
      this.eventBus.emit('Engineer:FileContent', {
        taskId: task.id,
        path: file.path,
        content: file.content,
        size: file.size,
        backend: file.backend,
        from: 'Engineer',
        timestamp: new Date().toISOString()
      });
    }

    // Juga emit summary sebagai Recommendation
    const summary = results.map(r => `📄 \`${r.path}\` (${r.size} chars)`).join('\n');
    const errorNote = errors.length > 0 ? `\n\n⚠️ Tidak ditemukan: ${errors.join(', ')}` : '';

    this._emitRecommendation({
      type: 'READ_REPO_RESULT',
      taskId: task.id,
      message: `✅ **Engineer** — ${results.length} file berhasil dibaca:\n\n${summary}${errorNote}`,
      files: results.map(r => ({ path: r.path, size: r.size, content: r.content })),
      requiresApproval: false
    });
  }

  /**
   * Mendaftar isi direktori dan emit hasilnya.
   */
  async _handleListDirectory(task, dirPath) {
    const entries = await this.repositoryReader.listDirectory(dirPath);

    if (entries.length === 0) {
      this._emitRecommendation({
        type: 'READ_REPO_EMPTY',
        taskId: task.id,
        message: `📁 **Engineer** — Direktori \`${dirPath || '(root)'}\` kosong atau tidak ditemukan.`,
        requiresApproval: false
      });
      return;
    }

    const dirs = entries.filter(e => e.type === 'dir');
    const files = entries.filter(e => e.type !== 'dir');
    let listing = `📁 **Isi direktori:** \`${dirPath || '(root)'}\`\n\n`;
    if (dirs.length) listing += `**Folder (${dirs.length}):**\n` + dirs.map(d => `  📁 ${d.name}`).join('\n') + '\n\n';
    if (files.length) listing += `**File (${files.length}):**\n` + files.map(f => `  📄 ${f.name}`).join('\n');

    this._emitRecommendation({
      type: 'READ_REPO_LISTING',
      taskId: task.id,
      message: listing,
      entries,
      dirPath,
      requiresApproval: false
    });
  }

  /**
   * Mencari file berdasarkan query dan emit hasilnya.
   */
  async _handleSearchFiles(task, query) {
    const matches = await this.repositoryReader.searchFiles(query);

    if (matches.length === 0) {
      this._emitRecommendation({
        type: 'READ_REPO_NOT_FOUND',
        taskId: task.id,
        message: `🔍 **Engineer** — Tidak ada file yang cocok dengan: \`${query}\``,
        requiresApproval: false
      });
      return;
    }

    const listing = matches.slice(0, 30).map(p => `  📄 ${p}`).join('\n');
    const note = matches.length > 30 ? `\n\n_...dan ${matches.length - 30} file lainnya._` : '';

    this._emitRecommendation({
      type: 'READ_REPO_SEARCH_RESULT',
      taskId: task.id,
      message: `🔍 **Engineer** — Ditemukan **${matches.length} file** untuk: \`${query}\`\n\n${listing}${note}\n\nGunakan \`baca file [nama lengkap]\` untuk membaca isinya.`,
      matches,
      query,
      requiresApproval: false
    });
  }

  /**
   * Mengekstrak path/nama file dari teks prompt.
   * Contoh: "baca file Kernel.js" → ["Kernel.js"]
   *         "tampilkan engineer.js dan BrainService.js" → ["engineer.js", "BrainService.js"]
   */
  _extractPathsFromPrompt(text) {
    const paths = [];

    // Pattern 1: kata dengan ekstensi file (.js, .jsx, .ts, .tsx, .css, .md, .json, dll)
    const extPattern = /[\w\-./]+\.(js|jsx|ts|tsx|css|scss|md|json|html|txt|yaml|yml|cjs|mjs|env)/gi;
    const extMatches = text.match(extPattern) || [];
    paths.push(...extMatches);

    // Pattern 2: path dengan slash (e.g., "frontend/src/Kernel.js")
    const pathPattern = /(?:file|path|dari|of|di|in)\s+([\w\-./]+)/gi;
    let m;
    while ((m = pathPattern.exec(text)) !== null) {
      if (!paths.includes(m[1])) paths.push(m[1]);
    }

    // Deduplicate & filter terlalu pendek
    return [...new Set(paths)].filter(p => p.length > 2);
  }

  /**
   * Mengekstrak nama direktori dari teks prompt.
   */
  _extractDirectoryFromPrompt(text) {
    // Coba ekstrak path eksplisit (e.g., "frontend/src/core")
    const pathPattern = /(?:folder|direktori|directory|di|in|of)\s+([\w\-./]+)/i;
    const m = text.match(pathPattern);
    if (m) return m[1].replace(/\\/g, '/');

    // Cari path-like string
    const pathLike = text.match(/[\w]+\/[\w./\-]*/);
    if (pathLike) return pathLike[0];

    return ''; // root
  }

  /**
   * Mengekstrak query pencarian dari teks prompt.
   */
  _extractSearchQueryFromPrompt(text) {
    const m = text.match(/(?:cari|search|find|dimana|where(?:\s+is)?)\s+(?:file\s+)?(.+)/i);
    if (m) return m[1].trim().replace(/\?$/, '');
    return text.replace(/cari|search|find|file/gi, '').trim();
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

  async _generatePatch(task) {
    try {
      console.log(`[Engineer] 🔨 Generating patch for task: ${task?.title || task?.id || 'unknown'}`);

      const relevantFiles = task?.files || [];
      const fileContents = {};

      const targetFiles = relevantFiles.length > 0
        ? relevantFiles
        : extractFileNamesFromTask(task);

      console.log(`[Engineer] 📂 Target files: ${targetFiles.join(', ')}`);

      // [FIX #4] Disamakan dengan MAX_FILES_PER_PATCH (10), sebelumnya hanya slice(0, 5)
      for (const filePath of targetFiles.slice(0, MAX_FILES_PER_PATCH)) {
        const result = await tryReadFile(filePath, { storageManager: this.storageManager, fileIndexService: this.fileIndexService });
        if (result) {
          fileContents[result.path] = result.content;
          console.log(`[Engineer] ✅ Read: ${result.path} (${result.content.length} chars)`);
        } else {
          console.warn(`[Engineer] ⚠️ File not found: ${filePath}`);
        }
      }

      if (Object.keys(fileContents).length === 0) {
        console.warn('[Engineer] No files could be read for patch generation');
        return {
          files: [],
          description: 'No target files could be read.',
          ready: false,
          error: 'No readable files'
        };
      }

      let generatedCode = null;
      let rawLLMResponse = null;
      let modelUsed = 'fallback';
      let isFallback = false;
      let llmErrorMessage = null;

      console.log('[Engineer] 🔍 Checking BrainService availability...');

      let brainService = null;
      try {
        brainService = this.serviceManager.get('BrainService');
      } catch (e) {
        console.error('[Engineer] Error getting BrainService:', e.message);
      }

      if (brainService && typeof brainService.executeLLM === 'function') {
        console.log(`[Engineer] 🧠 BrainService available, calling LLM...`);
        const prompt = this._buildPatchPrompt(task, fileContents);

        try {
          rawLLMResponse = await brainService.executeLLM(prompt, {
            model: task?.requestedModel
          });
          modelUsed = task?.requestedModel || brainService.currentModel || 'unknown';

          console.log('[Engineer] === LLM RAW RESPONSE ===');
          console.log(rawLLMResponse);
          console.log('[Engineer] === END RAW RESPONSE ===');
          console.log(`[Engineer] 🤖 Model: ${modelUsed} | Length: ${rawLLMResponse?.length || 0} chars`);

          generatedCode = this._extractCodeFromResponse(rawLLMResponse);
        } catch (llmError) {
          console.error('[Engineer] LLM call failed:', llmError.message);
          llmErrorMessage = llmError.message;
          isFallback = true;
          generatedCode = this._generateFallbackPatch(task, fileContents);
        }
      } else {
        console.warn('[Engineer] ⚠️ BrainService not available or missing executeLLM method');
        llmErrorMessage = 'BrainService not available or missing executeLLM method';
        isFallback = true;
        generatedCode = this._generateFallbackPatch(task, fileContents);
      }

      const patchFiles = [];
      for (const [filePath, newContent] of Object.entries(generatedCode || {})) {
        if (filePath === 'message' || filePath === 'reply' || filePath === 'content') continue;

        let finalContent = null;

        // === HANDLE FORMAT SEARCH-REPLACE ===
        if (newContent && typeof newContent === 'object' && newContent.__mode === 'search_replace') {
          const originalContent = fileContents[filePath] || '';
          let workingContent = originalContent;
          let changeCount = 0;

          if (Array.isArray(newContent.changes)) {
            for (const change of newContent.changes) {
              if (!change.search || typeof change.search !== 'string') continue;
              if (typeof change.replace !== 'string') continue;

              if (workingContent.includes(change.search)) {
                workingContent = workingContent.replace(change.search, change.replace);
                changeCount++;
                console.log(`[Engineer] ✅ Search-replace applied: "${change.search.substring(0, 50)}..."`);
              } else {
                const trimmedSearch = change.search.trim();
                if (workingContent.includes(trimmedSearch)) {
                  workingContent = workingContent.replace(trimmedSearch, change.replace);
                  changeCount++;
                  console.log(`[Engineer] ✅ Search-replace (trimmed) applied`);
                } else {
                  console.warn(`[Engineer] ⚠️ Search pattern not found: "${change.search.substring(0, 80)}"`);
                }
              }
            }
          }

          if (changeCount > 0) {
            finalContent = workingContent;
            console.log(`[Engineer] 🔄 Search-replace mode: ${changeCount} perubahan diterapkan ke ${filePath}`);
          } else {
            console.error(`[Engineer] ❌ Search-replace mode: tidak ada perubahan berhasil diterapkan ke ${filePath}`);
            continue;
          }
        }
        // === HANDLE FORMAT STRING BIASA ===
        else if (newContent !== null && newContent !== undefined && typeof newContent === 'string') {
          finalContent = newContent;
        }
        // === SKIP TIPE LAIN ===
        else {
          console.warn(`[Engineer] ⚠️ Skipping file "${filePath}": format tidak dikenal (${typeof newContent})`);
          continue;
        }

        patchFiles.push({
          path: filePath,
          newContent: finalContent,
          originalContent: fileContents[filePath] || '',
          status: 'PENDING_APPROVAL',
          size: finalContent.length
        });
      }

      const patch = {
        id: `PATCH-${Date.now()}`,
        taskId: task.id,
        files: patchFiles,
        description: task.description || 'Auto-generated patch',
        generatedAt: new Date().toISOString(),
        ready: patchFiles.length > 0,
        rawLLMResponse: rawLLMResponse,
        extractedCodeKeys: Object.keys(generatedCode || {}),
        modelUsed: modelUsed,
        isFallback: isFallback,
        llmError: llmErrorMessage
      };

      this.eventBus.emit('Engineer:PatchGenerated', patch);
      return patch;
    } catch (error) {
      console.error('[Engineer] Patch generation failed:', error);
      return { files: [], description: `Patch generation failed: ${error.message}`, ready: false, error: error.message };
    }
  }

  /**
   * [FIX #3] _buildPatchPrompt() sekarang menyertakan Session Artifact context
   * untuk memungkinkan handoff antar model AI.
   */
  _buildPatchPrompt(task, fileContents) {
    let prompt = `### SYSTEM INSTRUCTION (WAJIB DIPATUHI) ###\n`;
    prompt += `Anda adalah Mamet Engineer. Tugas Anda adalah menghasilkan PATCH FILE dalam format JSON MURNI.\n\n`;

    prompt += `### PERINGATAN KERAS ###\n`;
    prompt += `- Jika Anda tidak mengembalikan JSON murni, sistem akan ERROR.\n`;
    prompt += `- JANGAN menulis kalimat pembuka atau penutup.\n`;
    prompt += `- JANGAN menggunakan markdown code block.\n`;
    prompt += `- HANYA JSON yang akan diproses.\n`;
    prompt += `- Kembalikan KONTEN LENGKAP file, bukan diff/snippet.\n\n`;

    // [FIX #3] Inject Session Artifact jika ada konteks sesi sebelumnya
    const artifactContext = this._injectArtifactIntoPrompt();
    if (artifactContext) {
      prompt += `### KONTEKS SESI SEBELUMNYA ###\n`;
      prompt += `(Gunakan ini sebagai referensi keputusan yang sudah diambil dalam sesi ini)\n`;
      prompt += artifactContext;
      prompt += `\n\n`;
    }

    // 🧠 VERIFIED APPROACH MEMORY: inject pendekatan terbukti dari sesi-sesi sebelumnya
    const verifiedApproaches = this.brain?.verifiedApproaches || [];
    const rejectedPatterns   = this.brain?.rejectedPatterns   || [];

    if (verifiedApproaches.length > 0 || rejectedPatterns.length > 0) {
      prompt += `### MEMORI ENGINEER (DARI SESI-SESI SEBELUMNYA) ###\n`;
      prompt += `Gunakan ini sebagai panduan — pendekatan yang sudah terbukti berhasil atau pernah ditolak.\n\n`;

      if (verifiedApproaches.length > 0) {
        prompt += `✅ PENDEKATAN YANG TERBUKTI BERHASIL:\n`;
        verifiedApproaches.slice(0, 5).forEach((a, i) => {
          const files = (a.files || []).map(f => f.split('/').pop()).join(', ');
          prompt += `${i + 1}. [${a.taskType}] Task: "${(a.taskSummary || '').slice(0, 100)}"\n`;
          prompt += `   File: ${files || '(tidak ada)'} | Disetujui: ${a.approvalCount}x | Terakhir: ${(a.lastApprovedAt || '').slice(0, 10)}\n`;
        });
        prompt += `\n`;
      }

      if (rejectedPatterns.length > 0) {
        prompt += `❌ POLA YANG PERNAH DITOLAK (HINDARI):\n`;
        rejectedPatterns.slice(0, 3).forEach((r, i) => {
          const files = (r.files || []).map(f => f.split('/').pop()).join(', ');
          prompt += `${i + 1}. [${r.taskType}] Task: "${(r.taskSummary || '').slice(0, 100)}"\n`;
          prompt += `   File: ${files || '(tidak ada)'} | Ditolak: ${r.rejectionCount}x | Alasan: ${(r.reason || '-').slice(0, 100)}\n`;
        });
        prompt += `\n`;
      }

      prompt += `=== END MEMORI ENGINEER ===\n\n`;
    }

    prompt += `### ATURAN OUTPUT (CRITICAL - JANGAN DILANGGAR) ###\n`;
    prompt += `1. Karakter PERTAMA output Anda HARUS "{" (kurung kurawal buka)\n`;
    prompt += `2. Karakter TERAKHIR output Anda HARUS "}" (kurung kurawal tutup)\n`;
    prompt += `3. DILARANG KERAS menulis kalimat pembuka (contoh: "Baik", "Tentu", "Berikut", "Ini patch-nya")\n`;
    prompt += `4. DILARANG KERAS menulis kalimat penutup (contoh: "Semoga membantu", "Let me know")\n`;
    prompt += `5. DILARANG KERAS menggunakan markdown code block (\`\`\`json atau \`\`\`)\n`;
    prompt += `6. DILARANG KERAS menambah komentar di luar JSON\n`;
    prompt += `7. Output Anda akan di-PARSE oleh mesin. Jika ada teks di luar JSON, sistem akan ERROR.\n\n`;

    prompt += `### FORMAT JSON WAJIB ###\n`;
    prompt += `{\n`;
    prompt += `  "path/lengkap/ke/file1.jsx": "KONTEN LENGKAP FILE SETELAH PERUBAHAN (semua baris, dari import sampai penutup)",\n`;
    prompt += `  "path/lengkap/ke/file2.js": "KONTEN LENGKAP FILE SETELAH PERUBAHAN"\n`;
    prompt += `}\n\n`;

    prompt += `### CONTOH OUTPUT YANG BENAR ###\n`;
    prompt += `{\n`;
    prompt += `  "frontend/src/components/chat/ConversationEngine.jsx": "import React from 'react';\\n\\nexport default function ConversationEngine() {\\n  return <div>Test</div>;\\n}"\n`;
    prompt += `}\n\n`;

    prompt += `### CONTOH OUTPUT YANG SALAH (JANGAN DITIRU) ###\n`;
    prompt += `❌ "Tentu, berikut patch-nya:\\n\`\`\`json\\n{...}\\n\`\`\`\\nSemoga membantu!"\n`;
    prompt += `❌ "Saya akan menambahkan console.log. Ini kodenya: {...}"\n`;
    prompt += `❌ \`\`\`json\\n{...}\\n\`\`\`\n\n`;

    prompt += `### TUGAS ANDA ###\n`;
    prompt += `Task ID: ${task.title || task.id}\n`;
    prompt += `Deskripsi: ${task.description || 'Tidak ada deskripsi'}\n\n`;

    if (Object.keys(fileContents).length > 0) {
      const isLargeFile = Object.values(fileContents).some(c => c.length > 6000);

      if (isLargeFile) {
        prompt += `### STRATEGI MODIFIKASI: SEARCH-REPLACE ###\n`;
        prompt += `File yang diminta BESAR (>6000 chars). JANGAN kembalikan full file!\n`;
        prompt += `Gunakan format JSON SEARCH-REPLACE berikut:\n\n`;
        prompt += `{\n`;
        prompt += `  "path/ke/file.jsx": {\n`;
        prompt += `    "__mode": "search_replace",\n`;
        prompt += `    "changes": [\n`;
        prompt += `      {\n`;
        prompt += `        "search": "KODE ASLI YANG AKAN DIGANTI (EXACT, termasuk whitespace)",\n`;
        prompt += `        "replace": "KODE BARU PENGGANTINYA"\n`;
        prompt += `      }\n`;
        prompt += `    ]\n`;
        prompt += `  }\n`;
        prompt += `}\n\n`;

        prompt += `### FILE YANG DIMINTA UNTUK DIUBAH (REFERENSI) ###\n`;
        prompt += `(Hanya lihat konteks sekitar area yang perlu diubah. JANGAN kembalikan full file!)\n\n`;
        const MAX_FILE_CHARS = 8000;
        for (const [path, content] of Object.entries(fileContents)) {
          prompt += `--- FILE: ${path} (${content.length} chars total) ---\n`;
          if (content.length > MAX_FILE_CHARS) {
            const half = MAX_FILE_CHARS / 2;
            prompt += content.substring(0, half);
            prompt += `\n\n...[${content.length - MAX_FILE_CHARS} karakter dihilangkan, total file ${content.length} chars]...\n\n`;
            prompt += content.substring(content.length - half);
          } else {
            prompt += content;
          }
          prompt += `\n--- END FILE ---\n\n`;
        }
      } else {
        prompt += `### FILE YANG DIMINTA UNTUK DIUBAH ###\n`;
        prompt += `(Kembalikan KONTEN LENGKAP file setelah perubahan dalam JSON)\n\n`;
        for (const [path, content] of Object.entries(fileContents)) {
          prompt += `--- FILE: ${path} ---\n`;
          prompt += content;
          prompt += `\n--- END FILE ---\n\n`;
        }
      }
    }

    prompt += `### ATURAN KODE (WAJIB DIPATUHI) ###\n`;
    prompt += `- Kembalikan KONTEN LENGKAP file (jangan hanya diff/patch partial)\n`;
    prompt += `- Jangan ubah file yang tidak diminta\n`;
    prompt += `- Pertahankan komentar dan dokumentasi yang ada\n`;
    prompt += `- Ikuti standar ESModules\n`;
    prompt += `- JANGAN gunakan eval() atau new Function()\n`;
    prompt += `- Event EventBus HARUS pakai format Kategori:Nama (contoh: Engineer:Ready)\n`;
    prompt += `- DILARANG KERAS menulis eventBus.emit("Engineer:GeneratePatch", ...) di file yang Anda ubah (memicu infinite loop patch)\n`;
    prompt += `- Jangan panggil API vendor langsung (OpenAI, Gemini, dll)\n`;
    prompt += `- JANGAN modifikasi file core (Kernel.js, EventBus.js, ServiceManager.js, dll)\n`;
    prompt += `- Untuk belajar dari eksperimen lama, HANYA baca _knowledge_archive/00_EXPERIMENT_HISTORY.md. DILARANG membaca atau menyalin kode raw dari _knowledge_archive/\n\n`;

    prompt += `### MULAI OUTPUT JSON SEKARANG ###\n`;

    return prompt;
  }

  _extractCodeFromResponse(response) {
    try {
      if (!response || typeof response !== 'string') return {};

      try {
        const trimmed = response.trim();
        if (trimmed.startsWith('{')) {
          const parsed = JSON.parse(trimmed);
          const keys = Object.keys(parsed);
          if (keys.length === 1 && (keys[0] === 'message' || keys[0] === 'reply' || keys[0] === 'content')) {
            const inner = parsed[keys[0]];
            if (typeof inner === 'string' && inner.trim().startsWith('{')) {
              try {
                const innerParsed = JSON.parse(inner);
                if (typeof innerParsed === 'object' && !Array.isArray(innerParsed)) {
                  console.log('[Engineer] ✅ Double-JSON unwrapped successfully');
                  return innerParsed;
                }
              } catch (_) {}
            }
          }
          return parsed;
        }
      } catch (_) {}

      const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
      const codeBlockMatches = [...response.matchAll(codeBlockRegex)];
      for (const match of codeBlockMatches) {
        const jsonCandidate = match[1].trim();
        try {
          const parsed = JSON.parse(jsonCandidate);
          if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
          }
        } catch (_) {
          continue;
        }
      }

      const firstBrace = response.indexOf('{');
      const lastBrace = response.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const jsonCandidate = response.substring(firstBrace, lastBrace + 1);
        const cleaned = jsonCandidate
          .replace(/,\s*([\]}])/g, '$1')
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
        try {
          const parsed = JSON.parse(cleaned);
          if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
          }
        } catch (_) {}
      }

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
          }
        } catch (_) {}
      }

      // =============================================
      // FALLBACK: Ekstrak dari diff atau natural language
      // =============================================
      try {
        // Coba ekstrak file path + content dari diff format
        const diffRegex = /--- a\/(.+?)\n\+\+\+ b\/(.+?)\n@@.*?\n([\s\S]+?)(?=\n---|\n@@|$)/g;
        const matches = [...response.matchAll(diffRegex)];
        if (matches.length > 0) {
          const result = {};
          for (const match of matches) {
            const filePath = match[2] || match[1];
            let content = match[3].trim();
            // Hapus tanda + di awal baris (untuk baris yang ditambahkan)
            content = content.split('\n').map(line => {
              if (line.startsWith('+')) return line.substring(1);
              if (line.startsWith('-')) return null; // skip baris yang dihapus
              return line;
            }).filter(Boolean).join('\n');
            if (content.length > 50) {
              result[filePath] = content;
            }
          }
          if (Object.keys(result).length > 0) {
            console.log('[Engineer] ✅ Extracted files from diff format:', Object.keys(result));
            return result;
          }
        }

        // Coba cari kata kunci "file" atau "path" diikuti konten
        const fileBlockRegex = /(?:file|path)\s*[:：]\s*([^\n]+)\s*```(?:js|ts|jsx|tsx|json)\s*\n([\s\S]+?)\s*```/gi;
        const blockMatches = [...response.matchAll(fileBlockRegex)];
        if (blockMatches.length > 0) {
          const result = {};
          for (const match of blockMatches) {
            const filePath = match[1].trim();
            const content = match[2].trim();
            if (content.length > 50) {
              result[filePath] = content;
            }
          }
          if (Object.keys(result).length > 0) {
            console.log('[Engineer] ✅ Extracted files from named code blocks:', Object.keys(result));
            return result;
          }
        }
      } catch (e) {
        console.warn('[Engineer] Fallback extraction error:', e.message);
      }

      return {};
    } catch (e) {
      console.warn('[Engineer] Failed to extract code from response:', e);
      return {};
    }
  }

  _generateFallbackPatch(task, fileContents) {
    const result = {};
    for (const filePath of Object.keys(fileContents)) {
      result[filePath] = fileContents[filePath] + '\n// TODO: Implement changes for task: ' + (task.title || task.id);
    }
    return result;
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