
const MODULES_BASE_PATH = 'modules';
const MANIFEST_FILENAME = 'module.json';

const REQUIRED_MANIFEST_FIELDS = ['name', 'version', 'type', 'description', 'entry'];
const VALID_MODULE_TYPES = ['tool', 'capability', 'service'];

export class ModuleDiscoveryService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this._initialized = false;
    this._discoveredModules = new Map();
    this._rejectedModules = [];
  }

  async initialize() {
    this._initialized = true;
    console.log('[ModuleDiscoveryService] Initialized — scanning modules/');
    await this._scanAndRegister();
  }


  async _scanAndRegister() {
    if (!window.electronAPI || typeof window.electronAPI.listFiles !== 'function' || typeof window.electronAPI.readFile !== 'function') {
      console.log('[ModuleDiscoveryService] Electron fs API tidak tersedia — module discovery dilewati.');
      return;
    }

    let moduleEntries = [];
    try {
      const entries = await window.electronAPI.listFiles(MODULES_BASE_PATH);
      if (!Array.isArray(entries) || entries.length === 0) {
        console.log('[ModuleDiscoveryService] Folder modules/ tidak ditemukan atau kosong.');
        return;
      }
      moduleEntries = entries.filter(e => e.type === 'dir').map(e => e.name);
    } catch (err) {
      console.warn('[ModuleDiscoveryService] Gagal scan modules/:', err.message);
      return;
    }

    const toolRegistry = this.serviceManager.get('ToolRegistryService');

    for (const folderName of moduleEntries) {
      const modulePath = `${MODULES_BASE_PATH}/${folderName}`;
      const manifestPath = `${modulePath}/${MANIFEST_FILENAME}`;

      try {
        const manifestRaw = await window.electronAPI.readFile(manifestPath);
        if (!manifestRaw) {
          this._reject(manifestPath, `module.json tidak ditemukan di ${modulePath}`);
          continue;
        }

        let manifest;
        try {
          manifest = JSON.parse(manifestRaw);
        } catch (parseErr) {
          this._reject(manifestPath, `module.json tidak valid JSON: ${parseErr.message}`);
          continue;
        }

        const validationError = this._validateManifest(manifest);
        if (validationError) {
          this._reject(manifestPath, validationError);
          continue;
        }

        if (this._discoveredModules.has(manifest.name)) {
          this._reject(manifestPath, `Konflik nama: modul "${manifest.name}" sudah terdaftar dari path lain.`);
          continue;
        }

        if (toolRegistry && typeof toolRegistry.registerTool === 'function') {
          try {
            toolRegistry.registerTool({
              name: manifest.name,
              description: manifest.description,
              version: manifest.version,
              type: manifest.type,
              capabilities: manifest.capabilities || [],
              entryPath: `${modulePath}/${manifest.entry}`,
              source: 'module_discovery'
            });
          } catch (regErr) {
            this._reject(manifestPath, `Gagal daftarkan ke ToolRegistry: ${regErr.message}`);
            continue;
          }
        }

        this._discoveredModules.set(manifest.name, { manifest, path: modulePath });
        console.log(`[ModuleDiscoveryService] ✅ Modul terdaftar: ${manifest.name} v${manifest.version} (${manifest.type})`);

      } catch (err) {
        this._reject(modulePath, `Error tak terduga: ${err.message}`);
      }
    }

    console.log(`[ModuleDiscoveryService] Scan selesai: ${this._discoveredModules.size} modul aktif, ${this._rejectedModules.length} ditolak.`);
    if (this._rejectedModules.length > 0) {
      console.warn('[ModuleDiscoveryService] Modul yang ditolak:', this._rejectedModules);
    }
  }


  _validateManifest(manifest) {
    for (const field of REQUIRED_MANIFEST_FIELDS) {
      if (!manifest[field]) {
        return `Field wajib "${field}" tidak ada atau kosong di module.json`;
      }
    }

    if (typeof manifest.name !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(manifest.name)) {
      return `"name" harus string alfanumerik (boleh - dan _), bukan: ${manifest.name}`;
    }

    if (!VALID_MODULE_TYPES.includes(manifest.type)) {
      return `"type" harus salah satu dari ${VALID_MODULE_TYPES.join('/')}. Ditemukan: ${manifest.type}`;
    }

    if (manifest.dependencies && !Array.isArray(manifest.dependencies)) {
      return `"dependencies" harus array`;
    }

    if (manifest.capabilities && !Array.isArray(manifest.capabilities)) {
      return `"capabilities" harus array`;
    }

    return null;
  }


  _reject(path, reason) {
    console.warn(`[ModuleDiscoveryService] ❌ Modul ditolak (${path}): ${reason}`);
    this._rejectedModules.push({ path, reason });
  }

  getDiscoveredModules() {
    return Array.from(this._discoveredModules.values());
  }

  getRejectedModules() {
    return [...this._rejectedModules];
  }
}
