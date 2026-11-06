class VaultService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this._vault = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    const storedKeys = localStorage.getItem('maef_secure_vault');
    if (storedKeys) {
      try {
        const parsed = JSON.parse(storedKeys);
        for (const [provider, key] of Object.entries(parsed)) {
          this._vault.set(provider, key);
        }
      } catch (e) {
        console.error('[VaultService] Vault corruption detected. Wiping vault.');
        localStorage.removeItem('maef_secure_vault');
      }
    }
    
    const oldKey = localStorage.getItem('maef_ai_key');
    const oldProvider = localStorage.getItem('maef_ai_provider');
    if (oldKey && oldProvider && !this._vault.has(oldProvider)) {
      this.setKey(oldProvider, oldKey);
      localStorage.removeItem('maef_ai_key');
    }

    this.isInitialized = true;
    console.log('[VaultService] Initialized and secured.');
  }

  setKey(provider, key) {
    this._vault.set(provider, key);
    this._persist();
    if (this.eventBus) {
      this.eventBus.emit('Vault:KeyUpdated', { provider });
    }
  }

  getKey(provider) {
    return this._vault.get(provider) || null;
  }

  getAllProviders() {
    return Array.from(this._vault.keys());
  }

  _persist() {
    const obj = Object.fromEntries(this._vault);
    localStorage.setItem('maef_secure_vault', JSON.stringify(obj));
  }
}

export { VaultService };
