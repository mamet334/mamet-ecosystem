
import { supabase } from '../../../supabase.js';

export class AuditLogService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this._initialized = false;
    this._tableName = 'assistant_audit_log';
  }

  async initialize() {
    this._initialized = true;
    console.log('[AuditLogService] Initialized');
  }


  async log(entry) {
    if (!this._initialized) return;

    const logEntry = {
      requested_by:   entry.requestedBy   || '',
      ai_decision:    entry.aiDecision    || '',
      command:        entry.action?.command    || '',
      target_path:    entry.action?.targetPath || '',
      executed_at:    entry.action?.timestamp  || new Date().toISOString(),
      result_success: entry.result?.success    ?? false,
      result_output:  (entry.result?.output    || '').substring(0, 1000),
      result_reason:  entry.result?.reason     || '',
      in_workspace:   entry.securityStatus?.inWorkspace  ?? true,
      is_destructive: entry.securityStatus?.destructive  ?? false,
      tanpa_persetujuan: entry.securityStatus?.tanpaPersetujuan ?? false,
      user_id:        entry.userId || null,
      logged_at:      new Date().toISOString()
    };

    console.log('[AuditLog]', logEntry);

    const mustLog = entry.wajibSimpan ?? (logEntry.is_destructive || !logEntry.in_workspace);
    if (!mustLog) return;

    try {
      const { error } = await supabase.from(this._tableName).insert(logEntry);
      if (error) {
        console.warn('[AuditLogService] Supabase insert gagal (tabel mungkin belum dibuat):', error.message);
      }
    } catch (err) {
      console.warn('[AuditLogService] Log gagal disimpan:', err.message);
    }
  }


  async logCommand({ userMsg, commandName, targetPath, inWorkspace, isDestructive, success, output, userId, tanpaPersetujuan = false, alasan = '' }) {
    const panjang = String(output ?? '').length;

    await this.log({
      requestedBy: userMsg,
      aiDecision: tanpaPersetujuan
        ? `Engineer menjalankan "${commandName}" TANPA dialog izin (perintah baca, 4.2.5) di "${targetPath}"`
        : `Engineer menjalankan "${commandName}" setelah Owner menyetujui di dialog, di "${targetPath}"`,
      action: {
        command: commandName,
        targetPath,
        timestamp: new Date().toISOString()
      },
      result: {
        success,
        output: '',
        reason: [
          success ? 'Perintah selesai.' : (alasan || 'Perintah gagal atau ditolak.'),
          `keluaran ${panjang} huruf (tidak disimpan — lihat chat)`,
        ].join(' · ')
      },
      securityStatus: {
        inWorkspace,
        destructive: isDestructive,
        tanpaPersetujuan
      },
      wajibSimpan: true,
      userId
    });
  }


  async getRecentLogs(limit = 20, userId = null) {
    try {
      let query = supabase
        .from(this._tableName)
        .select('*')
        .order('logged_at', { ascending: false })
        .limit(limit);

      if (userId) query = query.eq('user_id', userId);

      const { data, error } = await query;
      if (error) {
        console.warn('[AuditLogService] getRecentLogs gagal:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('[AuditLogService] getRecentLogs error:', err.message);
      return [];
    }
  }
}
