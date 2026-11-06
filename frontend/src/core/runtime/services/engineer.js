import { FileIndexService } from './FileIndexService.js';
import { SessionArtifact } from './engineer/SessionArtifact.js';
import { MAX_FILES_PER_PATCH, checkCapabilityAndDeclare } from './engineer/CapabilityGuard.js';
import { extractExports, extractFunctionSignatures, findUsages, detectBreakingChanges, verifySemanticDiff } from './engineer/StaticCodeAnalyzer.js';
import { savePendingPatch, clearPendingPatch, restorePersistedPatches, saveVerifiedApproach, saveRejectedApproach, loadVerifiedApproaches } from './engineer/EngineerMemoryStore.js';
import { readFile, findFiles, extractFileNamesFromTask, findRelevantADR, tryReadFile } from './engineer/FileSystemGateway.js';
import { emitReasoningReport, waitForUserConfirmation, handleUserConfirmation } from './engineer/ReasoningLock.js';
import { handleApprovalResponse, requestApproval, emitRecommendation } from './engineer/ApprovalGateway.js';
import { buildDynamicContext } from './engineer/TaskHandlers.js';
import { generatePatch } from './engineer/PatchGenerator.js';
import { executePatchApplication } from './engineer/PatchApplier.js';

export const BATAS_PATCH_PER_MENIT = 5;
export const JENDELA_PEMUTUS_MS = 60_000;





class Engineer {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.storageManager = serviceManager.get('StorageManager');
    this.process = serviceManager.get('ProcessManager');
    this.moduleLoader = serviceManager.get('ModuleLoader');
    this.fileIndexService = null;

    this.brain = {
      static: null,
      dynamic: null,
      verifiedApproaches: [],
      rejectedPatterns: []
    };

    this.capability = 'IMPLEMENTER';
    this.pendingPatches = new Map();
    this.suspiciousAttempts = 0;
    this._apiCallCount = 0;
    this._lastApiReset = 0;

    this._sebabDemosi = null;
    this._kapabilitasSebelumDemosi = null;
    this.intentState = 'READY';
    this.pendingConfirmations = new Map();
    this.sessionArtifact = null;

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

    const { verifiedApproaches, rejectedPatterns } = await loadVerifiedApproaches({ storageManager: this.storageManager });
    this.brain.verifiedApproaches = verifiedApproaches;
    this.brain.rejectedPatterns = rejectedPatterns;

    this.fileIndexService = new FileIndexService(this.storageManager);
    console.log('[Engineer] 🔨 Membangun FileIndexService...');
    await this.fileIndexService.buildIndex();
    console.log('[Engineer] ✅ FileIndexService siap digunakan');

    this._initializeSessionArtifact();

    await restorePersistedPatches({ storageManager: this.storageManager, eventBus: this.eventBus });

    this._registerListeners();
    console.log(`[Engineer] Initialized as ${this.capability}`);
    this.eventBus.emit('Engineer:Ready', { capability: this.capability });
  }


  _initializeSessionArtifact() {
    const sessionId = `ENG-SESSION-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.sessionArtifact = new SessionArtifact(sessionId);
    console.log(`[Engineer] 📦 Session Artifact initialized: ${sessionId}`);
  }

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

  _injectArtifactIntoPrompt() {
    if (!this.sessionArtifact) {
      return '';
    }
    const summary = this.sessionArtifact.getSummary();
    if (summary.taskCount === 0 && summary.decisionsCount === 0) {
      return '';
    }
    return this.sessionArtifact.toPromptContext();
  }

  async _finalizeSession(patch = null) {
    try {
      const governor = this.serviceManager.has('MemoryGovernorService')
        ? this.serviceManager.get('MemoryGovernorService')
        : null;

      if (!governor || typeof governor.verifyEngineeringSession !== 'function') {
        console.warn('[Engineer] MemoryGovernorService tidak tersedia, skip finalisasi sesi');
        return null;
      }


      const result = await governor.verifyEngineeringSession(this.sessionArtifact);
      console.log('[Engineer] Sesi Engineering difinalisasi:', result);
      return result;
    } catch (err) {
      console.error('[Engineer] _finalizeSession error:', err);
      return null;
    }
  }



  async _loadStaticKnowledge() {
    try {
      const constitutionPaths = [
        'INIT.md',
        'AGENTS.md',
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
        'constitution/24_ANTI_HALLUCINATION_PROTOCOL.md',
        'constitution/25_DESIGN_PHILOSOPHY.md',
        'constitution/26_MENTAL_MODEL.md',
        'constitution/27_DECISION_HEURISTICS.md',
        'constitution/ENGINEERING_CONTRACT.md',
        'constitution/README.md'
      ];

      const terpindai = await (window?.electronAPI?.engineer?.indeksKonstitusi?.() ?? Promise.resolve([]))
        .catch(() => []);
      const daftar = Array.isArray(terpindai) && terpindai.length
        ? terpindai.filter((d) => d && d.alamat)
        : constitutionPaths.map((alamat) => ({ alamat, judul: '' }));

      this.brain.static = {
        loadedFiles: daftar.map((d) => d.alamat),
        indeks: daftar,
        terpindai: Array.isArray(terpindai) && terpindai.length > 0,
        summary: 'Indeks konstitusi (alamat + judul); isi dibaca saat perlu lewat git show',
        loadedAt: new Date().toISOString()
      };

      console.log(`[Engineer] Indeks konstitusi: ${daftar.length} berkas (${this.brain.static.terpindai ? 'dipindai' : 'daftar cadangan'}); isi TIDAK dimuat`);
    } catch (error) {
      console.error('[Engineer] Gagal memuat indeks konstitusi', error);
      this.brain.static = { loadedFiles: [], indeks: [], error: error.message };
    }
  }


  _registerListeners() {
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

    this.eventBus.on('Engineer:UserConfirmation', (wrappedPayload) => {
      const response = wrappedPayload?.data || wrappedPayload;
      handleUserConfirmation(response, { pendingConfirmations: this.pendingConfirmations });
    });

    this.eventBus.on('Engineer:CommandExecuted', (wrappedPayload) => {
      const data = wrappedPayload?.data || wrappedPayload;
      console.log(`[Engineer] 📟 Command audit: [${(data?.status || '?').toUpperCase()}] $ ${data?.command || 'unknown'}`);
      this._updateArtifact('COMMAND_EXECUTED', data);
    });
  }





  async _buildDynamicContext(task) {
    return buildDynamicContext(task, {
      fileIndexService: this.fileIndexService,
      brain: this.brain,
      sessionArtifact: this.sessionArtifact
    });
  }




  async _handlePatchTask(task) {
    this._apiCallCount++;

    const now = Date.now();
    if (now - this._lastApiReset > JENDELA_PEMUTUS_MS) {
      this._apiCallCount = 1;
      this._lastApiReset = now;
      this._pulihkanDariPemutusArus();
    }

    if (this._apiCallCount > BATAS_PATCH_PER_MENIT) {
      this._turunkanKarenaPemutusArus(task);
      return;
    }

    if (this.capability !== 'IMPLEMENTER' && this.capability !== 'SELF_MAINTENANCE') {
      this.eventBus.emit('Engineer:Recommendation', {
        type: 'ERROR',
        taskId: task.id,
        message: this._alasanKapabilitasKurang(),
        requiresApproval: false
      });
      return;
    }

    this.intentState = 'ANALYZING';
    if (!task?.dariTombolApply) {
      console.warn(`[Engineer] 🚫 Tugas tanpa dariTombolApply ditolak (task: ${task?.title || task?.id})`);
      this._emitRecommendation({
        type: 'ERROR',
        taskId: task?.id,
        message: 'Tugas ini tidak datang dari tombol **Apply Patch**, jadi Engineer tidak memprosesnya. Hanya patch yang Anda setujui sendiri yang dikerjakan.',
        requiresApproval: false
      });
      return;
    }
    const intent = 'MODIFY_CODE';
    console.log(`[Engineer] 🎯 Intent: ${intent} (task: ${task.title || task.id})`);

    this.intentState = 'PROCEEDING';
    this.metrics.patchesGenerated++;
    console.log(`[Engineer] 🔨 Proceeding with patch generation for: ${task.title || task.id}`);
    this.brain.dynamic = await this._buildDynamicContext(task);

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

    this._updateArtifact('REASONING', {
      taskId: task.id,
      report: reasoningReport,
      summary: reasoningReport.summary
    });

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
            originalText: JSON.stringify(patch.files.reduce((acc, f) => {
              acc[f.path] = f.originalContent || '';
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
              message: [
                `Patch tidak lolos verifikasi: ${patch.verification.criticalCount} masalah kritis`
                  + ` dari ${patch.verification.issues?.length || 0} temuan (skor ${patch.verification.score}).`,
                '',
                ...(patch.verification.issues || []).map(
                  (i) => `- **[${i.severity || 'TIDAK DIKETAHUI'}] ${i.id || i.name || 'tanpa id'}** — ${i.message || 'tanpa keterangan'}`
                ),
                '',
                'Tidak ada berkas yang diubah.',
              ].join('\n'),
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
      try {
        console.log('[Engineer] 🔍 Menjalankan Breaking Change Detector...');
        const bcWarnings = await detectBreakingChanges(patch, { fileIndexService: this.fileIndexService, storageManager: this.storageManager });
        const highSeverity   = bcWarnings.filter(w => w.severity === 'HIGH');
        const medSeverity    = bcWarnings.filter(w => w.severity === 'MEDIUM');

        if (highSeverity.length > 0) {
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
        const hasilTerap = await this._executePatchApplication(patch, approvalResult.approvedFiles);
        const dipulihkan = !!hasilTerap?.verifikasi?.dipulihkan;
        this.metrics.patchesApproved++;

        this._updateArtifact('APPROVED', {
          taskId: task.id,
          files: approvalResult.approvedFiles
        });

        try {
          if (dipulihkan) throw { dilewati: true };
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
          if (sdErr?.dilewati) console.log('[Engineer] 🔬 Semantic Diff dilewati — berkas sudah dikembalikan Tahap 6.');
          else console.warn('[Engineer] Semantic diff verification error (non-blocking):', sdErr.message);
        }

        if (!dipulihkan) {
          this._emitRecommendation({
            type: 'PATCH_APPLIED',
            taskId: task.id,
            patch,
            message: `Patch diterapkan: ${approvalResult.approvedFiles.length} file dari ${patch.files.length}.`,
            confidence: this._calculateConfidence(analysis),
            requiresApproval: false
          });
        }

        saveVerifiedApproach(task, patch, { storageManager: this.storageManager });

      } else {
        this.metrics.patchesRejected++;

        this._updateArtifact('REJECTED', {
          taskId: task.id,
          reason: 'User menolak patch'
        });

        saveRejectedApproach(task, 'User menolak patch', { storageManager: this.storageManager });

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
          message: `❌ **Patch tidak dibuat** — ${patch.llmError || patch.error || patch.description || 'model tidak menghasilkan perubahan yang bisa diterapkan'}. Tidak ada berkas yang diubah.`,
          confidence: this._calculateConfidence(analysis),
          requiresApproval: false
        });
      }
    }
  }





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
    return executePatchApplication(patch, approvedFiles, {
      metrics: this.metrics,
      eventBus: this.eventBus,
      storageManager: this.storageManager,
      serviceManager: this.serviceManager,
      emitRecommendation: (r) => this._emitRecommendation(r),
      finalizeSession: (p) => this._finalizeSession(p),
      onImmutableFileBlocked: () => {
        this.suspiciousAttempts++;
        if (this.suspiciousAttempts >= 3) {
          this._kapabilitasSebelumDemosi = this.capability;
          this._sebabDemosi = 'keamanan';
          this.capability = 'OBSERVER';
          this.eventBus.emit('Engineer:EmergencyLockdown', {
            reason: 'Suspicious core modification attempts detected',
            attempts: this.suspiciousAttempts
          });
        }
      }
    });
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



  _emitRecommendation(recommendation) {
    emitRecommendation(recommendation, { eventBus: this.eventBus, capability: this.capability });
  }

  upgradeCapability(newCapability, opsi = {}) {
    const validCapabilities = [
      'OBSERVER', 'REVIEWER', 'ARCHITECT', 'PLANNER',
      'IMPLEMENTER', 'VERIFIER', 'SELF_MAINTENANCE'
    ];
    if (!validCapabilities.includes(newCapability)) {
      console.warn(`[Engineer] Invalid capability: ${newCapability}`);
      return false;
    }
    if (opsi.otomatis && this._sebabDemosi === 'keamanan') {
      console.warn('[Engineer] Pemulihan otomatis DITOLAK — demosi karena keamanan, bukan laju.');
      return false;
    }
    this.capability = newCapability;
    if (!opsi.otomatis) this.suspiciousAttempts = 0;
    this._sebabDemosi = null;
    this._kapabilitasSebelumDemosi = null;
    console.log(`[Engineer] Capability upgraded to ${newCapability}`);
    this.eventBus.emit('Engineer:CapabilityUpdated', {
      capability: this.capability,
      otomatis: opsi.otomatis === true
    });
    return true;
  }


  _turunkanKarenaPemutusArus(task = null) {
    if (this._sebabDemosi !== 'keamanan') {
      this._kapabilitasSebelumDemosi = this.capability;
      this._sebabDemosi = 'laju';
      this.capability = 'OBSERVER';
    }
    const detikLagi = Math.max(
      1,
      Math.ceil((JENDELA_PEMUTUS_MS - (Date.now() - this._lastApiReset)) / 1000)
    );
    console.warn(`[Engineer] PEMUTUS ARUS aktif: lebih dari ${BATAS_PATCH_PER_MENIT} patch dalam satu menit. Menambal dihentikan ~${detikLagi}s.`);
    this.eventBus.emit('Engineer:Recommendation', {
      type: 'ERROR',
      taskId: task?.id,
      message: `Pemutus arus aktif — lebih dari ${BATAS_PATCH_PER_MENIT} penerapan patch dalam satu menit. Ini penjaga saldo, bukan penolakan. Engineer menambal lagi sekitar ${detikLagi} detik lagi; coba kirim ulang setelah itu.`,
      requiresApproval: false
    });
    this.eventBus.emit('Engineer:CircuitBreaker', {
      aktif: true,
      sebab: 'laju',
      batas: BATAS_PATCH_PER_MENIT,
      pulihDalamDetik: detikLagi
    });
  }

  _pulihkanDariPemutusArus() {
    if (this._sebabDemosi !== 'laju') return;
    const kembaliKe = this._kapabilitasSebelumDemosi || 'IMPLEMENTER';
    if (this.upgradeCapability(kembaliKe, { otomatis: true })) {
      console.log(`[Engineer] Pemutus arus pulih — kapabilitas kembali ke ${kembaliKe}.`);
      this.eventBus.emit('Engineer:CircuitBreaker', { aktif: false, sebab: 'laju', capability: kembaliKe });
    }
  }

  _alasanKapabilitasKurang() {
    if (this._sebabDemosi === 'keamanan') {
      return `Engineer diturunkan ke ${this.capability} oleh penjaga keamanan — ada percobaan mengubah berkas inti. Ini tidak pulih sendiri; mulai ulang aplikasi setelah memastikan tugasnya benar.`;
    }
    if (this._sebabDemosi === 'laju') {
      return `Engineer sedang ditahan pemutus arus (lebih dari ${BATAS_PATCH_PER_MENIT} patch/menit). Coba lagi sebentar.`;
    }
    return `Engineer belum memiliki kapabilitas IMPLEMENTER (sekarang ${this.capability}).`;
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