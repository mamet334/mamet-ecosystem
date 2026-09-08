/**
 * SessionArtifact — Melacak konteks sesi Engineer untuk handoff antar model AI.
 * Diinisialisasi sekali saat Engineer.initialize() dan diperbarui per task.
 *
 * Diekstrak dari engineer.js (Fase 1, ADR-0017) — struktur data murni,
 * tidak ada dependency ke instance Engineer atau service lain.
 */
export class SessionArtifact {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.decisions = [];          // Riwayat keputusan
    this.analyzedFiles = [];      // File yang dianalisis
    this.modifiedFiles = [];      // File yang diubah
    this.maefViolations = [];     // Pelanggaran MAEF yang ditemukan
    this.reasoningReports = [];   // Riwayat reasoning report
    this.executedCommands = [];   // Audit trail terminal commands [MAMET_CMD:]
    this.startedAt = new Date().toISOString();
    this.lastActivity = new Date().toISOString();
    this.taskCount = 0;
  }

  addDecision(decision) {
    this.decisions.push({ ...decision, timestamp: new Date().toISOString() });
    this.lastActivity = new Date().toISOString();
  }

  addAnalyzedFile(filePath) {
    if (!this.analyzedFiles.includes(filePath)) {
      this.analyzedFiles.push(filePath);
    }
    this.lastActivity = new Date().toISOString();
  }

  addModifiedFile(filePath) {
    if (!this.modifiedFiles.includes(filePath)) {
      this.modifiedFiles.push(filePath);
    }
    this.lastActivity = new Date().toISOString();
  }

  addReasoningReport(report) {
    this.reasoningReports.push({
      taskId: report.taskId,
      summary: report.summary,
      confidence: report.confidence,
      timestamp: new Date().toISOString()
    });
    this.lastActivity = new Date().toISOString();
  }

  addMaefViolation(violation) {
    this.maefViolations.push({ ...violation, recordedAt: new Date().toISOString() });
    this.lastActivity = new Date().toISOString();
  }

  // Catat setiap terminal command yang dijalankan via [MAMET_CMD:]
  addCommand(cmd, status, output = '') {
    this.executedCommands.push({
      command: cmd,
      status,          // 'success' | 'error' | 'skipped'
      outputSnippet: output.slice(0, 300), // simpan max 300 char
      executedAt: new Date().toISOString()
    });
    this.lastActivity = new Date().toISOString();
  }

  incrementTaskCount() {
    this.taskCount++;
    this.lastActivity = new Date().toISOString();
  }

  getSummary() {
    const durationMs = Date.now() - new Date(this.startedAt).getTime();
    const durationSeconds = Math.round(durationMs / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;

    return {
      sessionId: this.sessionId,
      taskCount: this.taskCount,
      decisionsCount: this.decisions.length,
      analyzedFilesCount: this.analyzedFiles.length,
      modifiedFilesCount: this.modifiedFiles.length,
      violationsFound: this.maefViolations.length,
      reasoningReportsCount: this.reasoningReports.length,
      commandsExecuted: this.executedCommands.length,
      duration: `${minutes}m ${seconds}s`,
      startedAt: this.startedAt,
      lastActivity: this.lastActivity
    };
  }

  /**
   * Menghasilkan string konteks untuk di-inject ke prompt LLM.
   * Berguna untuk handoff antar model AI.
   */
  toPromptContext() {
    const summary = this.getSummary();
    let context = `=== SESSION ARTIFACT ===\n`;
    context += `Session ID: ${summary.sessionId}\n`;
    context += `Durasi Sesi: ${summary.duration}\n`;
    context += `Task Diproses: ${summary.taskCount}\n`;
    context += `File Dianalisis: ${summary.analyzedFilesCount} (${this.analyzedFiles.join(', ') || 'tidak ada'})\n`;
    context += `File Dimodifikasi: ${summary.modifiedFilesCount} (${this.modifiedFiles.join(', ') || 'tidak ada'})\n`;
    context += `Keputusan Diambil: ${summary.decisionsCount}\n`;
    context += `Pelanggaran MAEF: ${summary.violationsFound}\n`;
    context += `Terminal Commands: ${summary.commandsExecuted}\n`;

    // Inject 5 command terakhir ke konteks LLM — Engineer tahu apa yang sudah dijalankan
    if (this.executedCommands.length > 0) {
      context += `\n=== TERMINAL AUDIT TRAIL (5 terakhir) ===\n`;
      this.executedCommands.slice(-5).forEach((c, i) => {
        const icon = c.status === 'success' ? '[OK]' : c.status === 'error' ? '[ERR]' : '[SKIP]';
        context += `${icon} $ ${c.command} | ${c.executedAt.slice(11,19)}\n`;
        if (c.outputSnippet) context += `    > ${c.outputSnippet.replace(/\n/g, ' ').slice(0, 120)}\n`;
      });
    }

    if (this.reasoningReports.length > 0) {
      context += `\n=== REASONING REPORTS ===\n`;
      this.reasoningReports.forEach((r, i) => {
        context += `[${i + 1}] Task: ${r.taskId} | Confidence: ${r.confidence?.level || 'N/A'} | ${r.summary}\n`;
      });
    }

    if (this.decisions.length > 0) {
      context += `\n=== KEPUTUSAN TERAKHIR ===\n`;
      const lastDecisions = this.decisions.slice(-3);
      lastDecisions.forEach(d => {
        context += `- ${d.type || 'Decision'}: ${d.detail || d.summary || 'N/A'}\n`;
      });
    }

    context += `\n=== END SESSION ARTIFACT ===\n`;
    return context;
  }
}
