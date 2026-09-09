/**
 * Tool: web_search
 *
 * Dipindai otomatis oleh ToolRegistryService.scanToolsFolder() dari folder tools/ ini.
 * Tidak boleh punya `import` relatif — file ini dimuat lewat dynamic import() dari Blob URL
 * saat runtime (bukan lewat Vite bundler), jadi tidak ada resolusi path modul biasa.
 * Akses ke service lain (EventBus, service lain di aplikasi) HARUS lewat `context.serviceManager`
 * yang disuntikkan saat eksekusi — bukan lewat import langsung.
 *
 * Kontrak wajib tiap file di tools/:
 *   export default { name, description, category, async execute(params, context) { ... } }
 */
export default {
  name: 'web_search',
  description: 'Mencari informasi terkini dari web (Bing News, Google News, Wikipedia, DuckDuckGo) dengan gerbang konfirmasi Owner (Human-in-Command) dan timeout 8 detik.',
  category: 'research',

  /**
   * @param {Object} params
   * @param {string} params.query - Kata kunci pencarian
   * @param {string} [params.traceId]
   * @param {boolean} [params.autoConfirm] - true = lewati dialog konfirmasi (sudah disetujui via preferensi)
   * @param {boolean} [params.isTemporal]
   * @param {string} [params.reason]
   * @param {Object} context - { serviceManager }
   */
  async execute(params, context) {
    const webComparisonService = context?.serviceManager?.get?.('WebComparisonService');
    if (!webComparisonService || typeof webComparisonService.searchWeb !== 'function') {
      return {
        chunks: [],
        strategy: 'web_search_unavailable',
        sufficiency: 0.0,
        tier: 3,
        isFallback: true,
        status: 'FAILED',
        error: 'WebComparisonService tidak tersedia di serviceManager.'
      };
    }
    return await webComparisonService.searchWeb(params?.query, params || {});
  }
};
