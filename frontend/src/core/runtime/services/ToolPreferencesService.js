/**
 * ToolPreferencesService — Preferensi on/off per-tool (RAG, Web Search, dst),
 * dengan default global + override opsional per workspace.
 *
 * Skema (lihat docs/roadmap/INDEX-ROADMAP.md untuk diskusi desainnya):
 *   globalDefaults: { [toolName]: boolean }
 *   workspaceOverrides: { [workspaceId]: { [toolName]: boolean } }
 *
 * Resolusi nilai efektif: override workspace (jika ada) > default global > DEFAULT_TOOLS fallback.
 * Disimpan di localStorage — murni preferensi per-perangkat, tidak perlu sinkron server.
 */

const STORAGE_KEY = 'mamet:toolPreferences';

// Tool yang didukung saat ini. Menambah tool baru (mis. 'deep_research') di masa depan
// cukup menambah entrinya di sini — struktur data & UI tidak perlu berubah.
const DEFAULT_TOOLS = {
  rag: true,
  web_search: true
};

export class ToolPreferencesService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.globalDefaults = { ...DEFAULT_TOOLS };
    this.workspaceOverrides = {};
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    this._load();
    this.isInitialized = true;
    console.log('[ToolPreferencesService] Initialized', {
      globalDefaults: this.globalDefaults,
      workspaceOverrides: this.workspaceOverrides
    });
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.globalDefaults) {
        this.globalDefaults = { ...DEFAULT_TOOLS, ...parsed.globalDefaults };
      }
      if (parsed?.workspaceOverrides) {
        this.workspaceOverrides = parsed.workspaceOverrides;
      }
    } catch (e) {
      console.warn('[ToolPreferencesService] Gagal load dari localStorage, pakai default:', e.message);
    }
  }

  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        globalDefaults: this.globalDefaults,
        workspaceOverrides: this.workspaceOverrides
      }));
    } catch (e) {
      console.warn('[ToolPreferencesService] Gagal menyimpan ke localStorage:', e.message);
    }
  }

  /**
   * Nilai efektif untuk satu tool di satu workspace: override workspace (jika ada) > default global.
   * @param {string} workspaceId
   * @param {string} toolName
   * @returns {boolean}
   */
  getEffective(workspaceId, toolName) {
    const override = this.workspaceOverrides?.[workspaceId]?.[toolName];
    if (typeof override === 'boolean') return override;
    if (typeof this.globalDefaults[toolName] === 'boolean') return this.globalDefaults[toolName];
    return DEFAULT_TOOLS[toolName] ?? true;
  }

  getGlobalDefault(toolName) {
    return this.globalDefaults[toolName] ?? DEFAULT_TOOLS[toolName] ?? true;
  }

  setGlobalDefault(toolName, enabled) {
    this.globalDefaults = { ...this.globalDefaults, [toolName]: !!enabled };
    this._persist();
    this.eventBus?.emit('ToolPreferences:Changed', { scope: 'global', toolName, enabled: !!enabled });
  }

  /**
   * @returns {boolean|null} null berarti "ikuti default global" (tidak ada override)
   */
  getWorkspaceOverride(workspaceId, toolName) {
    const value = this.workspaceOverrides?.[workspaceId]?.[toolName];
    return typeof value === 'boolean' ? value : null;
  }

  /**
   * @param {boolean|null} enabled - null untuk menghapus override (kembali ikuti default global)
   */
  setWorkspaceOverride(workspaceId, toolName, enabled) {
    const current = { ...(this.workspaceOverrides[workspaceId] || {}) };
    if (enabled === null || enabled === undefined) {
      delete current[toolName];
    } else {
      current[toolName] = !!enabled;
    }
    this.workspaceOverrides = { ...this.workspaceOverrides, [workspaceId]: current };
    this._persist();
    this.eventBus?.emit('ToolPreferences:Changed', { scope: 'workspace', workspaceId, toolName, enabled });
  }

  /** Daftar nama tool yang didukung (untuk render UI generik). */
  listToolNames() {
    return Object.keys(this.globalDefaults);
  }
}
