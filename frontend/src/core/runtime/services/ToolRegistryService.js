/**
 * ToolRegistryService - Layer 2 Capability Service
 * Bertanggung jawab sebagai pusat pendaftaran dan pengambilan spesifikasi Tool AI.
 *
 * Dua sumber tool:
 * 1. Built-in (hardcode di initialize()) — belum semua fungsional, lihat komentar masing-masing.
 * 2. Folder tools/ di root repo — di-scan lewat scanToolsFolder(), tiap file .js WAJIB
 *    `export default { name, description, category, async execute(params, context) {...} }`.
 *    Ini mekanisme "drop file, tidak perlu ubah kode aplikasi" (mirip modul Linux) —
 *    dimuat lewat dynamic import() dari Blob URL saat runtime, bisa di-scan ulang kapan saja
 *    lewat scanToolsFolder() tanpa restart aplikasi.
 */
const TOOLS_FOLDER = 'tools';

export class ToolRegistryService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.isInitialized = false;
    this.tools = new Map();
    this.fileSourcedToolNames = new Set(); // Nama tool yang berasal dari folder tools/ (untuk dibersihkan saat rescan)
    this.lastScan = { at: null, found: 0, errors: [] };
  }

  async initialize() {
    if (this.isInitialized) return;

    this.isInitialized = true;

    // Register built-in tools
    // [BELUM FUNGSIONAL] memory_manager: referensi `memoryService` di bawah tidak pernah
    // di-import di file ini — akan error kalau benar-benar dieksekusi. Dibiarkan apa adanya,
    // di luar scope perbaikan folder tools/ (lihat changelog 2026-09-09 folder tools/).
    this.registerTool({
      name: 'memory_manager',
      description: 'Menyimpan, mencari, dan mengelola User Memory di Supabase',
      category: 'memory',
      execute: async (params) => {
        if (params.action === 'store') return await memoryService.storeMemory(params.key, params.value, {
          source_type: 'tool_call',
          source_reference: 'tool_memory_manager',
          version_code: `TOOL-${Date.now()}`,
          category: params.category || 'general',
          useGovernor: true
        });
        if (params.action === 'get') return await memoryService.getMemory(params.query);
        return { error: 'Unknown action' };
      }
    });

    // 'web_search' TIDAK didaftarkan di sini lagi — sekarang datang dari tools/web_search.js
    // (implementasi nyata, delegasi ke WebComparisonService), lihat scanToolsFolder().

    this.registerTool({
      name: 'file_reader',
      description: 'Membaca dan menganalisis file (PDF, Excel, Word, TXT)',
      category: 'analysis',
      execute: async (params) => {
        return { message: 'File reader tool ready', filePath: params.filePath };
      }
    });

    this.registerTool({
      name: 'deep_research',
      description: 'Melakukan riset mendalam multi-langkah dengan sintesis',
      category: 'research',
      execute: async (params) => {
        return { message: 'Deep research tool ready', topic: params.topic };
      }
    });

    this.eventBus.emit('ToolRegistry:Ready', { status: 'READY', timestamp: Date.now() });
    console.log('[ToolRegistryService] Initialized and Ready');
  }

  async registerTool(toolConfig) {
    if (!this.isInitialized) throw new Error('ToolRegistryService not initialized');

    const name = toolConfig.name;
    if (!name) throw new Error('Tool must have a name');

    console.log(`[ToolRegistryService] Registering tool: ${name}`);
    this.tools.set(name, toolConfig);

    this.eventBus.emit('Tool:Registered', { name });
    return true;
  }

  getTool(toolName) {
    return this.tools.get(toolName) || null;
  }

  listTools() {
    return Array.from(this.tools.values());
  }

  async executeTool(toolName, args) {
    console.log(`[ToolRegistryService] Executing tool: ${toolName}`);
    const tool = this.tools.get(toolName);
    if (!tool) {
      const error = `Tool tidak ditemukan: ${toolName}`;
      console.warn(`[ToolRegistryService] ${error}`);
      this.eventBus.emit('Tool:Executed', { toolName, args, success: false, error });
      return { success: false, error };
    }
    if (typeof tool.execute !== 'function') {
      const error = `Tool "${toolName}" tidak punya fungsi execute()`;
      console.warn(`[ToolRegistryService] ${error}`);
      this.eventBus.emit('Tool:Executed', { toolName, args, success: false, error });
      return { success: false, error };
    }
    try {
      const result = await tool.execute(args, { serviceManager: this.serviceManager });
      this.eventBus.emit('Tool:Executed', { toolName, args, success: true });
      return result;
    } catch (err) {
      console.error(`[ToolRegistryService] Tool "${toolName}" execute() error:`, err.message);
      this.eventBus.emit('Tool:Executed', { toolName, args, success: false, error: err.message });
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // FOLDER SCANNING — "drop file, tidak perlu ubah kode" (lihat komentar kelas di atas)
  // =========================================================================

  /**
   * Pindai ulang folder tools/ dan daftarkan ulang semua tool yang ditemukan.
   * Aman dipanggil berkali-kali (tidak perlu restart app) — tool lama dari folder
   * yang sudah dihapus/diubah namanya akan ikut dibersihkan dari registry.
   * @returns {Promise<{found: number, registered: string[], errors: Array<{file: string, message: string}>}>}
   */
  async scanToolsFolder() {
    const storageManager = this.serviceManager?.get?.('StorageManager');
    if (!storageManager) {
      const error = 'StorageManager tidak tersedia, tidak bisa scan folder tools/';
      console.warn(`[ToolRegistryService] ${error}`);
      this.lastScan = { at: Date.now(), found: 0, errors: [{ file: '(folder)', message: error }] };
      return { found: 0, registered: [], errors: this.lastScan.errors };
    }

    console.log(`[ToolRegistryService] 🔍 Memindai folder "${TOOLS_FOLDER}/"...`);

    // Bersihkan dulu tool hasil scan sebelumnya (supaya file yang dihapus ikut hilang dari registry)
    for (const name of this.fileSourcedToolNames) {
      this.tools.delete(name);
    }
    this.fileSourcedToolNames.clear();

    // [FIX] listRecursive(TOOLS_FOLDER) mengembalikan path RELATIF terhadap folder itu sendiri
    // (mis. "web_search.js", bukan "tools/web_search.js") — lihat walkDir() di electron/main.cjs
    // yang mulai relativePath dari '' persis di titik folder yang diminta. Jadi untuk baca isinya
    // lewat storageManager.read() (yang selalu relatif ke PROJECT_ROOT), path itu harus digabung
    // lagi dengan TOOLS_FOLDER.
    let relativeFilePaths = [];
    try {
      const allPaths = await storageManager.listRecursive(TOOLS_FOLDER);
      relativeFilePaths = (allPaths || []).filter(p => p.endsWith('.js'));
    } catch (e) {
      console.warn(`[ToolRegistryService] Gagal list folder "${TOOLS_FOLDER}/": ${e.message}`);
    }

    const registered = [];
    const errors = [];

    for (const relativeFilePath of relativeFilePaths) {
      const filePath = `${TOOLS_FOLDER}/${relativeFilePath}`;
      try {
        const sourceCode = await storageManager.read(filePath);
        if (!sourceCode) {
          errors.push({ file: filePath, message: 'File kosong atau gagal dibaca' });
          continue;
        }

        const blob = new Blob([sourceCode], { type: 'text/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        let moduleExports;
        try {
          moduleExports = await import(/* @vite-ignore */ blobUrl);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }

        const toolConfig = moduleExports?.default;
        if (!toolConfig || !toolConfig.name || typeof toolConfig.execute !== 'function') {
          errors.push({ file: filePath, message: 'export default harus berupa { name, execute(params, context) {...} }' });
          continue;
        }

        await this.registerTool(toolConfig);
        this.fileSourcedToolNames.add(toolConfig.name);
        registered.push(toolConfig.name);
      } catch (e) {
        console.error(`[ToolRegistryService] Gagal memuat tool dari "${filePath}":`, e.message);
        errors.push({ file: filePath, message: e.message });
      }
    }

    this.lastScan = { at: Date.now(), found: relativeFilePaths.length, errors };
    console.log(`[ToolRegistryService] ✅ Scan selesai: ${registered.length}/${relativeFilePaths.length} tool terdaftar dari "${TOOLS_FOLDER}/"`, registered);
    this.eventBus?.emit('ToolRegistry:Scanned', { registered, errors, at: this.lastScan.at });

    return { found: relativeFilePaths.length, registered, errors };
  }
}