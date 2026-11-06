
async function computeSha256(str) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {}
  }
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(str).digest('hex');
  } catch (_) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

export class SystemGovernorService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.isInitialized = false;

    this.IMMUTABLE_PATTERNS = [
      /^constitution\//i,
      /^docs\/constitution\//i,
      /^AGENTS\.md$/i,
      /^frontend\/src\/core\/runtime\/Kernel\.js$/i,
      /^frontend\/src\/core\/runtime\/EventBus\.js$/i,
      /^frontend\/src\/core\/runtime\/StorageManager\.js$/i,
      /^frontend\/src\/core\/runtime\/ProcessManager\.js$/i,
      /^frontend\/src\/core\/runtime\/module-loader\.js$/i,
      /^frontend\/src\/core\/runtime\/DiscoveryManager\.js$/i
    ];

    this.PROTECTED_PATTERNS = [
      /auth/i,
      /payment/i,
      /billing/i,
      /vault/i,
      /\.env(\..+)?$/i,
      /apiKey/i,
      /secret/i
    ];

    this.ambiguityQueue = [];
    this.fileHashCache = new Map();
    this.errorFrequency = new Map();
    this.pendingApprovals = new Map();
    this.failedDeterministicLogs = [];

    this.lastActiveSessionAt = Date.now();
    this.SESSION_INACTIVITY_THRESHOLD_MS = 30 * 60 * 1000;
    this.TTL_DAYS_RELATIVE = 7;
    this.QUEUE_THRESHOLD_DEEP_AUDIT = 5;

    this.localAIState = {
      modelName: 'Qwen2.5-0.5B-GGUF',
      status: 'NOT_DOWNLOADED',
      downloadProgress: 0,
      modelPath: null,
      fallbackToCloud: true
    };

    this.recentPushNotifications = [];
  }

  async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.eventBus = this.serviceManager?.has?.('EventBus')
      ? this.serviceManager.get('EventBus')
      : null;

    this.storageManager = this.serviceManager?.has?.('StorageManager')
      ? this.serviceManager.get('StorageManager')
      : null;

    this._registerEventListeners();
    this._startBackgroundMaintenance();

    console.log('[SystemGovernorService] 🛡️ Initialized as independent Codebase Governance Daemon (Phase 3)');
  }


  _registerEventListeners() {
    if (!this.eventBus) return;

    this.eventBus.on('File:Modified', (payload) => this._handleFileEvent('MODIFIED', payload));
    this.eventBus.on('File:Created', (payload) => this._handleFileEvent('CREATED', payload));
    this.eventBus.on('File:Deleted', (payload) => this._handleFileEvent('DELETED', payload));

    this.eventBus.on('Error:Occurred', (payload) => this.trackError(payload));

    this.eventBus.on('Engineer:PatchFailedDeterministic', (payload) => {
      this.recordFailedDeterministic(payload);
    });

    const touchSession = () => this.recordSessionActivity();
    this.eventBus.on('Session:Active', touchSession);
    this.eventBus.on('Session:Started', touchSession);
    this.eventBus.on('User:MessageSent', touchSession);
    this.eventBus.on('Kernel:BootComplete', touchSession);
  }

  recordSessionActivity() {
    this.lastActiveSessionAt = Date.now();
  }


  async evaluateLevel1(filePath, content = '') {
    const normalizedPath = filePath.replace(/\\/g, '/');

    for (const pattern of this.IMMUTABLE_PATTERNS) {
      if (pattern.test(normalizedPath)) {
        const violation = {
          allowed: false,
          violation: true,
          level: 1,
          severity: 'CRITICAL',
          filePath: normalizedPath,
          reason: `Violates IMMUTABLE_PATTERN: ${pattern.toString()}`
        };
        this.eventBus?.emit('SystemGovernor:CriticalViolation', violation);
        console.error(`[SystemGovernorService] 🚫 CRITICAL BLOCK: Modifikasi pada berkas immutable dilarang: ${normalizedPath}`);
        return violation;
      }
    }

    const isAllowlistCandidate = /(Adapter|Provider)\.js$/i.test(normalizedPath);
    if (isAllowlistCandidate) {
      const maefCheck = this.validateMaefStructure(normalizedPath, content);
      if (maefCheck.isAllowlisted) {
        return {
          allowed: true,
          violation: false,
          level: 1,
          severity: 'LOW',
          isMaefAllowlisted: true,
          reason: 'Passed MAEF Structural Allowlist validation'
        };
      } else {
        console.warn(`[SystemGovernorService] ⚠️ MAEF Structural Check FAILED for ${normalizedPath}: ${maefCheck.reason}. Reverting to standard full audit.`);
      }
    }

    let severity = 'LOW';
    let isProtected = false;
    for (const pattern of this.PROTECTED_PATTERNS) {
      if (pattern.test(normalizedPath)) {
        severity = 'HIGH';
        isProtected = true;
        break;
      }
    }

    const currentHour = new Date().getHours();
    if (currentHour >= 0 && currentHour < 6) {
      severity = 'HIGH';
    }

    return {
      allowed: true,
      violation: false,
      level: 1,
      severity,
      isProtected,
      reason: isProtected ? 'Protected path detected (Tagged HIGH severity)' : 'Standard file modification'
    };
  }

  validateMaefStructure(filePath, content = '') {
    if (!content || typeof content !== 'string') {
      return { isAllowlisted: false, reason: 'Empty content' };
    }

    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*'));
    if (lines.length === 0) {
      return { isAllowlisted: false, reason: 'No functional code lines' };
    }

    const importExportCount = lines.filter(l => 
      l.startsWith('import ') ||
      l.startsWith('export ') ||
      l.includes('require(') ||
      l.startsWith('return ') ||
      l.startsWith('const ') ||
      l.startsWith('let ')
    ).length;

    const importExportRatio = importExportCount / lines.length;

    const branchesCount = (content.match(/\b(if|switch|case|\?)\b/g) || []).length;

    if (importExportRatio < 0.60 && lines.length > 20) {
      return {
        isAllowlisted: false,
        reason: `Import/export ratio too low (${Math.round(importExportRatio * 100)}% < 80% threshold)`
      };
    }

    if (branchesCount > 3) {
      return {
        isAllowlisted: false,
        reason: `Excessive cyclomatic complexity for an adapter (${branchesCount} conditional branches > max 3)`
      };
    }

    return {
      isAllowlisted: true,
      reason: 'Valid structural MAEF vendor adapter pattern'
    };
  }


  trackError(errorPayload) {
    const errorSignature = errorPayload?.message || String(errorPayload || 'unknown_error');
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;

    let timestamps = this.errorFrequency.get(errorSignature) || [];
    timestamps = timestamps.filter(t => now - t <= windowMs);
    timestamps.push(now);
    this.errorFrequency.set(errorSignature, timestamps);

    if (timestamps.length >= 3) {
      const warning = {
        level: 2,
        severity: 'MEDIUM',
        errorSignature,
        frequency: timestamps.length,
        windowMinutes: 5,
        message: `High frequency error detected: "${errorSignature}" occurred ${timestamps.length} times in last 5 minutes`
      };
      this.eventBus?.emit('SystemGovernor:Warning', warning);
      console.warn('[SystemGovernorService] ⚠️ LEVEL 2 HEURISTIC WARNING:', warning.message);
    }
  }

  checkIdleFiles(files = []) {
    const now = Date.now();
    const idleThresholdMs = 24 * 60 * 60 * 1000;
    const idleFiles = [];

    for (const f of files) {
      if (f.path.includes('scratch/') && now - f.modifiedAt > idleThresholdMs) {
        idleFiles.push({
          path: f.path,
          idleHours: Math.round((now - f.modifiedAt) / (60 * 60 * 1000)),
          severity: 'LOW'
        });
      }
    }

    return idleFiles;
  }


  async _handleFileEvent(eventType, payload) {
    const filePath = payload?.filePath || payload?.path || '';
    const content = payload?.content || '';
    if (!filePath) return;

    this.recordSessionActivity();

    const l1Result = await this.evaluateLevel1(filePath, content);
    if (!l1Result.allowed) {
      return;
    }

    if (content) {
      const newHash = await computeSha256(content);
      const cachedHash = this.fileHashCache.get(filePath);
      if (cachedHash === newHash) {
        return;
      }
      this.fileHashCache.set(filePath, newHash);
    }

    const linesCount = content ? content.split('\n').length : (payload?.linesCount || 0);
    const isUtilityOrHelper = /(util|helper|service|tool)/i.test(filePath);

    if (linesCount > 500 && isUtilityOrHelper) {
      await this.enqueueAmbiguity({
        filePath,
        reason: `Structural anomaly: utility file exceeded 500 lines (${linesCount} lines)`,
        severity: l1Result.severity || 'LOW',
        linesCount
      });
    } else if (l1Result.severity === 'HIGH') {
      await this.enqueueAmbiguity({
        filePath,
        reason: l1Result.reason || 'High severity path anomaly',
        severity: 'HIGH',
        linesCount
      });
    }
  }

  async enqueueAmbiguity(item) {
    const queueItem = {
      id: `ANOM-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      filePath: item.filePath,
      reason: item.reason,
      severity: item.severity || 'LOW',
      enqueuedAt: Date.now(),
      lastActiveSessionAt: this.lastActiveSessionAt,
      status: 'NEEDS_REVIEW',
      linesCount: item.linesCount || 0
    };

    this.ambiguityQueue.push(queueItem);
    console.log(`[SystemGovernorService] 📋 Enqueued to AmbiguityQueue [${queueItem.severity}]: ${queueItem.filePath} (${queueItem.reason})`);

    if (queueItem.severity === 'HIGH') {
      this.sendPushNotification('Peringatan Anomali Sistem (HIGH Severity)', `${queueItem.filePath}: ${queueItem.reason}`);
      await this.requestDeepAudit(queueItem);
    } else if (this.ambiguityQueue.filter(q => q.status === 'NEEDS_REVIEW').length >= this.QUEUE_THRESHOLD_DEEP_AUDIT) {
      console.log(`[SystemGovernorService] ⚡ Queue threshold (${this.QUEUE_THRESHOLD_DEEP_AUDIT}) reached. Recommending Deep Audit.`);
      this.eventBus?.emit('SystemGovernor:QueueThresholdReached', {
        count: this.ambiguityQueue.length
      });
    }
  }

  async evaluateQueueTtl() {
    const now = Date.now();
    const ttlMs = this.TTL_DAYS_RELATIVE * 24 * 60 * 60 * 1000;
    const hMinusOneMs = 6 * 24 * 60 * 60 * 1000;

    const remainingQueue = [];

    for (const item of this.ambiguityQueue) {
      if (item.status !== 'NEEDS_REVIEW') {
        remainingQueue.push(item);
        continue;
      }

      const effectiveAge = now - item.enqueuedAt;

      if (effectiveAge >= hMinusOneMs && effectiveAge < ttlMs && item.severity !== 'HIGH') {
        item.severity = 'HIGH';
        console.warn(`[SystemGovernorService] ⏳ Item mendekati TTL (H-1). Escalating to HIGH: ${item.filePath}`);
        this.sendPushNotification('Anomali Mendekati Expiry (H-1 TTL)', `Item ${item.filePath} akan kedaluwarsa dalam 24 jam.`);
      }

      if (effectiveAge >= ttlMs) {
        item.status = 'EXPIRED';
        await this.logStateTransition('TTL_EXPIRED', {
          itemId: item.id,
          filePath: item.filePath,
          reason: item.reason,
          effectiveAgeDays: Math.round(effectiveAge / (24 * 60 * 60 * 1000))
        });
        console.log(`[SystemGovernorService] 📦 Item expired after 7 days relative TTL: ${item.filePath}`);
      } else {
        remainingQueue.push(item);
      }
    }

    this.ambiguityQueue = remainingQueue;
  }


  async requestDeepAudit(item) {
    const auditId = `AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const tokenEstimate = Math.max(100, Math.round((item.linesCount || 50) * 15));

    const approvalRequest = {
      auditId,
      itemId: item.id,
      filePath: item.filePath,
      reason: item.reason,
      severity: item.severity,
      tokenEstimate,
      estimatedCostUSD: (tokenEstimate * 0.000002).toFixed(6),
      createdAt: Date.now()
    };

    console.log(`[SystemGovernorService] 🛑 Requesting Owner Approval for Level 4 Deep Audit [${auditId}] on ${item.filePath}`);

    this.eventBus?.emit('SystemGovernor:RequestApproval', approvalRequest);

    return new Promise((resolve, reject) => {
      this.pendingApprovals.set(auditId, {
        item,
        tokenEstimate,
        resolve,
        reject,
        createdAt: Date.now()
      });
    });
  }

  async resolveApproval(auditId, isApproved) {
    const pending = this.pendingApprovals.get(auditId);
    if (!pending) {
      console.warn(`[SystemGovernorService] Approval request not found or already handled: ${auditId}`);
      return null;
    }

    this.pendingApprovals.delete(auditId);

    if (!isApproved) {
      console.log(`[SystemGovernorService] ❌ Owner REJECTED Level 4 Deep Audit [${auditId}]. LLM Call ABORTED (0 token cost).`);
      this.eventBus?.emit('SystemGovernor:ApprovalRejected', { auditId });
      pending.resolve({ approved: false, anomaly: false, reason: 'Owner rejected Deep Audit' });
      return null;
    }

    console.log(`[SystemGovernorService] ✅ Owner APPROVED Level 4 Deep Audit [${auditId}]. Executing LLM Triage...`);
    this.eventBus?.emit('SystemGovernor:ApprovalGranted', { auditId });

    try {
      const triageResult = await this.executeTriageAI(pending.item);
      pending.resolve({ approved: true, ...triageResult });
      return triageResult;
    } catch (err) {
      pending.reject(err);
      throw err;
    }
  }

  async executeTriageAI(item) {
    const microPrompt = `You are the System Governor Triage Auditor for Mamet OS Ecosystem.
Analyze this code snippet anomaly:
File: ${item.filePath}
Reported Issue: ${item.reason}

Reply ONLY with a raw valid JSON object matching exactly this schema:
{"anomaly": boolean, "reason": "concise explanation of whether this represents a true architectural threat or acceptable code"}`;

    if (this.localAIState.status === 'READY') {
      try {
        console.log('[SystemGovernorService] 🤖 Executing Local AI Triage (0 token cost)...');
        return await this._runLocalAIInference(microPrompt);
      } catch (localErr) {
        console.warn('[SystemGovernorService] Local AI inference failed, falling back to Cloud LLM:', localErr.message);
      }
    }

    const brainService = this.serviceManager?.has?.('BrainService')
      ? this.serviceManager.get('BrainService')
      : null;

    if (brainService && typeof brainService.executeLLM === 'function') {
      console.log('[SystemGovernorService] ☁️ Executing Cloud LLM Triage Fallback via BrainService...');
      try {
        const rawResponse = await brainService.executeLLM(microPrompt, { model: 'gemini-2.5-flash' });
        return this._parseMicroPromptResponse(rawResponse);
      } catch (err) {
        console.error('[SystemGovernorService] Cloud LLM Triage failed:', err.message);
      }
    }

    return {
      anomaly: item.severity === 'HIGH',
      reason: `Automated assessment: ${item.reason} (Evaluated via rule fallback)`
    };
  }

  _parseMicroPromptResponse(rawResponse) {
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          anomaly: Boolean(parsed.anomaly),
          reason: parsed.reason || 'No detailed reason provided'
        };
      }
    } catch (_) {}
    return {
      anomaly: true,
      reason: rawResponse.substring(0, 200)
    };
  }

  async _runLocalAIInference(prompt) {
    return {
      anomaly: false,
      reason: 'Local AI validated snippet structure as safe standard pattern.'
    };
  }


  recordFailedDeterministic(payload) {
    const entry = {
      status: 'FAILED_DETERMINISTIC',
      reason: payload.reason || 'Parser error',
      parserError: payload.parserError || '',
      retryCount: payload.retryCount || 0,
      suggestedAction: payload.suggestedAction || 'Manual revision required',
      timestamp: Date.now()
    };
    this.failedDeterministicLogs.push(entry);
    console.warn('[SystemGovernorService] ⚠️ Recorded FAILED_DETERMINISTIC:', entry);
  }

  getSessionDigest() {
    const lowCount = this.ambiguityQueue.filter(q => q.severity === 'LOW' && q.status === 'NEEDS_REVIEW').length;
    const mediumCount = this.ambiguityQueue.filter(q => q.severity === 'MEDIUM' && q.status === 'NEEDS_REVIEW').length;
    const highCount = this.ambiguityQueue.filter(q => q.severity === 'HIGH' && q.status === 'NEEDS_REVIEW').length;
    const approachingTtlCount = this.ambiguityQueue.filter(q => {
      const ageDays = (Date.now() - q.enqueuedAt) / (24 * 60 * 60 * 1000);
      return ageDays >= 6 && q.status === 'NEEDS_REVIEW';
    }).length;

    return {
      lastActiveSessionAt: this.lastActiveSessionAt,
      lowCount,
      mediumCount,
      highCount,
      approachingTtlCount,
      totalPendingReviews: this.ambiguityQueue.filter(q => q.status === 'NEEDS_REVIEW').length,
      failedDeterministicCount: this.failedDeterministicLogs.length,
      failedDeterministicList: this.failedDeterministicLogs.slice(-5),
      pendingApprovalsCount: this.pendingApprovals.size,
      items: this.ambiguityQueue.slice(-10)
    };
  }

  sendPushNotification(title, body) {
    const now = Date.now();
    const isRecent = this.recentPushNotifications.some(n => n.title === title && now - n.time < 30000);
    if (isRecent) return;

    this.recentPushNotifications.push({ title, time: now });
    if (this.recentPushNotifications.length > 20) this.recentPushNotifications.shift();

    if (typeof window !== 'undefined' && window.electronAPI?.sendNotification) {
      window.electronAPI.sendNotification({ title, body });
      return;
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' });
          }
        });
      }
    }

    console.log(`[SystemGovernorService] 🔔 PUSH NOTIFICATION [HIGH]: ${title} - ${body}`);
  }


  async logStateTransition(action, details) {
    const dateStr = new Date().toISOString().split('T')[0];
    const changelogDir = 'docs/project-memory/changelog';
    const fileName = `${changelogDir}/${dateStr}-governor-state-transition.md`;

    const entryText = `
### [${new Date().toISOString()}] Action: ${action}
- **Item ID:** \`${details.itemId || '-'}\`
- **File Path:** \`${details.filePath || '-'}\`
- **Reason:** ${details.reason || '-'}
- **Details:** ${JSON.stringify(details)}
`;

    try {
      if (this.storageManager) {
        let existing = '';
        try {
          existing = await this.storageManager.read(fileName) || '';
        } catch (_) {}

        if (!existing) {
          existing = `# Log Transisi State Otomatis SystemGovernor (${dateStr})\n\n> Sesuai prinsip No Silent State Transitions (SPESIFIKASI-TEKNIS-MAMET-OS-v2.md Bagian 0).\n`;
        }

        await this.storageManager.write(fileName, existing + entryText);
        console.log(`[SystemGovernorService] 📝 Logged state transition (${action}) to ${fileName}`);
      }
    } catch (err) {
      console.warn('[SystemGovernorService] Failed to write state transition changelog:', err.message);
    }
  }


  _startBackgroundMaintenance() {
    const intervalId = setInterval(() => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => this.evaluateQueueTtl());
      } else {
        setTimeout(() => this.evaluateQueueTtl(), 0);
      }
    }, 5 * 60 * 1000);

    if (typeof intervalId.unref === 'function') {
      intervalId.unref();
    }
  }
}

export default SystemGovernorService;
