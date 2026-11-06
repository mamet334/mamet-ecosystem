export class ModuleLoader {
  constructor(storageManager) {
    this.storageManager = storageManager;
    this.cache = new Map();
  }

  async load(modulePath) {
    if (this.cache.has(modulePath)) {
      return this.cache.get(modulePath);
    }

    try {
      const module = await import(/* @vite-ignore */ `/packages/${modulePath}.js`);
      
      this.cache.set(modulePath, module);
      return module;
    } catch (error) {
      throw new Error(`Module ${modulePath} failed to load: ${error.message}`);
    }
  }

  async loadFromFs(modulePath) {
    if (this.cache.has(modulePath)) {
      return this.cache.get(modulePath);
    }

    let objectUrl = null;
    try {
      const code = await this.storageManager.read(`/packages/${modulePath}.js`);
      if (!code) {
        throw new Error(`Code not found in FS for module: ${modulePath}`);
      }

      const blob = new Blob([code], { type: 'application/javascript' });
      
      objectUrl = URL.createObjectURL(blob);
      
      // @vite-ignore: alamat Blob hanya ada saat aplikasi berjalan, jadi Vite tak bisa menganalisisnya
      const module = await import(/* @vite-ignore */ objectUrl);
      
      this.cache.set(modulePath, module);
      return module;
    } catch (error) {
      throw new Error(`Module ${modulePath} failed to load from FS: ${error.message}`);
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }
}