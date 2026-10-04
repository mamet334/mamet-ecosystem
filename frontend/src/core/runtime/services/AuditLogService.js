/**
 * AuditLogService.js — Audit Trail untuk Aksi AI (PR#1)
 *
 * Menyimpan log narasi terstruktur setiap aksi AI ke Supabase.
 * Format log: naratif (bisa "dimengerti" oleh AI masa depan), bukan sekadar baris teknis.
 *
 * Wajib log:
 * - Semua aksi di luar workspace
 * - Semua aksi destruktif (delete/overwrite)
 *
 * Opsional (ringkas saja):
 * - Operasi read-only (list/scan)
 *
 * Fase awal: log kronologis — BUKAN semantic search/embedding dulu.
 * Peningkatan ke semantic search hanya setelah pola pemakaian nyata terlihat.
 */

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

  // =============================================
  // CORE: Log satu entri aksi
  // =============================================

  /**
   * Catat satu entri aksi ke audit log.
   *
   * @param {Object} entry
   * @param {string} entry.requestedBy      - pesan user yang memicu aksi
   * @param {string} entry.aiDecision       - alasan AI memilih aksi ini
   * @param {Object} entry.action           - { command, targetPath, timestamp }
   * @param {Object} entry.result           - { success: bool, output: string, reason?: string }
   * @param {Object} entry.securityStatus   - { inWorkspace: bool, destructive: bool }
   * @param {string} [entry.userId]         - user ID dari Supabase session
   */
  async log(entry) {
    if (!this._initialized) return;

    const logEntry = {
      requested_by:   entry.requestedBy   || '',
      ai_decision:    entry.aiDecision    || '',
      command:        entry.action?.command    || '',
      target_path:    entry.action?.targetPath || '',
      executed_at:    entry.action?.timestamp  || new Date().toISOString(),
      result_success: entry.result?.success    ?? false,
      result_output:  (entry.result?.output    || '').substring(0, 1000), // cap 1000 char
      result_reason:  entry.result?.reason     || '',
      in_workspace:   entry.securityStatus?.inWorkspace  ?? true,
      is_destructive: entry.securityStatus?.destructive  ?? false,
      // Perintah yang jalan TANPA dialog izin (sejak 4.2.5, git-baca bagi profil engineer).
      tanpa_persetujuan: entry.securityStatus?.tanpaPersetujuan ?? false,
      user_id:        entry.userId || null,
      logged_at:      new Date().toISOString()
    };

    // Log ke konsol selalu (observasi awal)
    console.log('[AuditLog]', logEntry);

    // Simpan ke Supabase hanya untuk aksi wajib-log.
    //
    // `wajibSimpan` eksplisit ditambahkan 2026-10-04. Tanpa itu aturan di bawah membuat
    // `logCommand` mencatat NOL: perintah Engineer justru read-only DI DALAM workspace, jadi
    // `is_destructive === false && in_workspace === true` dan fungsinya pulang sebelum insert.
    // Menyambungkan `logCommand` begitu saja akan menghasilkan fitur yang TERLIHAT TERSAMBUNG
    // TETAPI BUTA — pola yang sama dengan cacat `mimeType` pada lampiran gambar.
    //
    // Pemanggil lain (SKILL_EXECUTED) tidak mengirim medan ini, jadi perilakunya tidak berubah.
    const mustLog = entry.wajibSimpan ?? (logEntry.is_destructive || !logEntry.in_workspace);
    if (!mustLog) return; // Read-only ringan tidak wajib disimpan

    try {
      const { error } = await supabase.from(this._tableName).insert(logEntry);
      if (error) {
        // Jika tabel belum ada, log ke konsol saja — jangan throw
        console.warn('[AuditLogService] Supabase insert gagal (tabel mungkin belum dibuat):', error.message);
      }
    } catch (err) {
      console.warn('[AuditLogService] Log gagal disimpan:', err.message);
    }
  }

  // =============================================
  // SHORTCUT: Log command execution
  // =============================================

  /**
   * Shortcut untuk mencatat eksekusi command dari AssistantService.
   *
   * TMN-0003 (dikoreksi 2026-10-04) — `commandName` dulu disebut berasal "dari CommandRegistry";
   * berkas `core/runtime/services/CommandRegistry.js` sudah TIDAK ADA, namanya kini datang dari
   * pemanggil apa adanya.
   *
   * DIPAKAI sejak 2026-10-04 — sebelumnya YATIM (nol pemanggil), jadi tak satu pun eksekusi
   * perintah tercatat. Pemanggilnya kini `AssistantService.runCommand()`, satu-satunya pintu
   * semua perintah Engineer, sehingga kedua pemanggil di UI (tombol manual & jalan-sendiri)
   * tercakup tanpa masing-masing perlu ingat mencatat.
   *
   * Yang membuatnya pantas dihidupkan: sejak 4.2.5 perintah `git`-baca jalan TANPA dialog izin.
   * Sebelum itu tiap eksekusi punya gerbang manusia dan dialognya sendiri adalah catatannya;
   * kini sebagian jalan tanpa saksi, dan satu-satunya jejak tersisa adalah `useState` yang
   * hilang saat muat ulang.
   *
   * @param {Object} params
   * @param {string} params.userMsg      - pesan user yang memicu command
   * @param {string} params.commandName  - nama command (dari pemanggil; CommandRegistry sudah tiada)
   * @param {string} params.targetPath   - path target
   * @param {boolean} params.inWorkspace - apakah path di dalam workspace
   * @param {boolean} params.isDestructive - apakah command destruktif
   * @param {boolean} params.success     - apakah berhasil
   * @param {string}  params.output      - output/error
   * @param {string}  [params.userId]
   */
  async logCommand({ userMsg, commandName, targetPath, inWorkspace, isDestructive, success, output, userId, tanpaPersetujuan = false, alasan = '' }) {
    // KELUARANNYA TIDAK DISIMPAN — hanya panjangnya.
    //
    // Nilai audit di sini adalah "apa yang dijalankan atas nama saya, dan apakah saya sempat
    // melihatnya". Isi keluaran tidak menjawab itu, sudah ada di chat, dan menyalinnya ke basis
    // data hanya menambah tempat kebocoran: ia isi berkas repo mentah, jalur ini ada di sisi
    // KLIEN yang tak punya penyaring rahasia sama sekali (`saring_rahasia.ts` hanya di server),
    // dan `agent_logs` pernah benar-benar menyimpan kunci API karena kelalaian yang sama.
    // `.env`/`*.key` memang ditolak dibaca, tetapi keluaran `git grep` masih bisa memuat token
    // dari berkas lain.
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
      // Setiap eksekusi perintah disimpan, tanpa menebak-nebak keberbahayaannya. `is_destructive`
      // dibiarkan apa adanya (tidak diklasifikasikan) justru supaya ia tidak dipakai sebagai
      // klaim yang tak punya dasar; pembedaan yang nyata ada di `tanpa_persetujuan`.
      wajibSimpan: true,
      userId
    });
  }

  // =============================================
  // QUERY: Baca log terbaru (untuk UI/debug)
  // =============================================

  /**
   * Ambil log terbaru dari Supabase.
   * @param {number} [limit=20]
   * @param {string} [userId]
   * @returns {Promise<Array>}
   */
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
