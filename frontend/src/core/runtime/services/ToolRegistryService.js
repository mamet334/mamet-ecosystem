/**
 * ToolRegistryService - Layer 2 Capability Service
 * Bertanggung jawab sebagai pusat pendaftaran dan pengambilan spesifikasi Tool AI.
 *
 * Satu-satunya sumber tool: folder tools/ di root repo, di-scan lewat scanToolsFolder().
 * Tiap file .js WAJIB `export default { name, description, category, async execute(params, context) {...} }`.
 * Ini mekanisme "drop file, tidak perlu ubah kode aplikasi" (mirip modul Linux) —
 * dimuat lewat dynamic import() dari Blob URL saat runtime, bisa di-scan ulang kapan saja
 * lewat scanToolsFolder() tanpa restart aplikasi. Tidak ada lagi tool hardcode di initialize().
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

    // Tidak ada lagi tool hardcode di sini — semua tool (termasuk memory_manager, file_reader,
    // deep_research, web_search) sekarang datang dari folder tools/ di root repo, lihat
    // scanToolsFolder(). Konsisten dengan prinsip "semua tool terkumpul di satu tempat".

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
    // Versi WEB (mamet-ecosystem.vercel.app / browser): tidak ada disk repo untuk dipindai —
    // folder tools/ dibaca lewat IPC Electron. Sejak scan folder diperkenalkan (2026-09-09),
    // versi web jadi tidak memuat SATU tool pun: panel Tools hanya menampilkan RAG, dan
    // web_search diam-diam lewat jalur cadangan di RetrievalOrchestrator. Di web, tool diambil
    // dari salinan yang ikut dibundel Vite saat build.
    if (typeof window === 'undefined' || typeof window.electronAPI?.listFilesRecursive !== 'function') {
      return this._muatToolTerbundel();
    }

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

  /**
   * Tool dari folder tools/ yang ikut dibundel saat build (hanya dipakai di luar Electron).
   * Beda dengan scan disk: tool baru baru muncul di web setelah build & deploy ulang.
   */
  async _muatToolTerbundel() {
    for (const name of this.fileSourcedToolNames) this.tools.delete(name);
    this.fileSourcedToolNames.clear();

    // Path relatif dari file ini: services → runtime → core → src → frontend → root repo.
    const modul = import.meta.glob('../../../../../tools/*.js', { eager: true });
    const registered = [];
    const errors = [];

    for (const [file, mod] of Object.entries(modul)) {
      const toolConfig = mod?.default;
      if (!toolConfig?.name || typeof toolConfig.execute !== 'function') {
        errors.push({ file, message: 'export default harus berupa { name, execute(params, context) {...} }' });
        continue;
      }
      await this.registerTool(toolConfig);
      this.fileSourcedToolNames.add(toolConfig.name);
      registered.push(toolConfig.name);
    }

    this.lastScan = { at: Date.now(), found: Object.keys(modul).length, errors };
    console.log(`[ToolRegistryService] ✅ Versi web: ${registered.length}/${Object.keys(modul).length} tool dimuat dari bundel build`, registered);
    this.eventBus?.emit('ToolRegistry:Scanned', { registered, errors, at: this.lastScan.at });
    return { found: Object.keys(modul).length, registered, errors };
  }
}