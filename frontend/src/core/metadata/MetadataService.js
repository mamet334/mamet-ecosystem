export class MetadataService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.metadata = {
      system: null,
      apps: [],
      navigation: [],
      workspaces: [],
      appToCapability: {},
      capabilities: [],
      widgets: []
    };
  }

  validateSchema(data, type) {
    const requiredFields = ['schemaVersion', 'version', 'id', 'description', 'owner', 'updatedAt'];
    const missing = requiredFields.filter(f => !data[f]);
    if (missing.length > 0) {
      throw new Error(`[Metadata Validation Error] Metadata file for '${type}' is missing required schema fields: ${missing.join(', ')}`);
    }
    return true;
  }

  async initialize() {
    try {
      const fetchJson = async (filename) => {
        const response = await fetch(`/metadata/${filename}`);
        if (!response.ok) throw new Error(`Failed to load ${filename}: HTTP ${response.status}`);
        return await response.json();
      };

      const sysData = await fetchJson('system.json');
      this.validateSchema(sysData, 'system');
      this.metadata.system = sysData.system;
      this.metadata.apps = sysData.apps;

      const navData = await fetchJson('navigation.json');
      this.validateSchema(navData, 'navigation');
      this.metadata.navigation = navData.navigation;
      
      const capData = await fetchJson('capabilities.json');
      this.validateSchema(capData, 'capabilities');
      this.metadata.capabilities = capData.capabilities;

      const wsData = await fetchJson('workspace.json');
      this.validateSchema(wsData, 'workspace');
      this.metadata.workspaces = wsData.workspaces;
      this.metadata.appToCapability = wsData.appToCapability;

      const widgetData = await fetchJson('widgets.json');
      this.validateSchema(widgetData, 'widgets');
      this.metadata.widgets = widgetData.widgets;

      try {
        const temaData = await fetchJson('themes.json');
        this.validateSchema(temaData, 'themes');
        this.metadata.themes = temaData;
      } catch (eTema) {
        console.warn('[MetadataService] themes.json gagal dimuat — hanya tema bawaan yang tersedia:', eTema.message);
        this.metadata.themes = null;
      }

      console.log('[MetadataService] Successfully validated and loaded all metadata');
    } catch (e) {
      console.error('[MetadataService] CRITICAL ERROR: Failed to load metadata:', e.message);
      throw e;
    }
  }

  getWorkspaceConfig(workspaceId) {
    return this.metadata.workspaces.find(w => w.id === workspaceId);
  }

  getCapabilities() {
    return this.metadata.capabilities;
  }

  getAppToCapabilityMapping() {
    return this.metadata.appToCapability;
  }

  getWidgets() {
    return this.metadata.widgets;
  }

  getThemes() {
    return this.metadata.themes ?? null;
  }

  getSystemConfig() {
    return this.metadata.system;
  }

  getApps() {
    return this.metadata.apps;
  }

  getNavigation() {
    return this.metadata.navigation;
  }
}
