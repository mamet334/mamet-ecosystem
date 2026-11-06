
const STORAGE_KEY = 'mamet:toolPreferences';

const DEFAULT_TOOLS = {
  rag: true,
  web_search: true,
  deep_research: false,
  data_tabel: false
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

  getWorkspaceOverride(workspaceId, toolName) {
    const value = this.workspaceOverrides?.[workspaceId]?.[toolName];
    return typeof value === 'boolean' ? value : null;
  }

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

  listToolNames() {
    return Object.keys(this.globalDefaults);
  }
}
