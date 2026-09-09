// [BELUM FUNGSIONAL] Dipindah apa adanya dari ToolRegistryService.js (initialize()) ke folder tools/
// untuk konsistensi lokasi ("semua tool terkumpul di tools/"). Referensi `memoryService` di bawah
// TIDAK pernah diimport — akan error kalau benar-benar dieksekusi. Bug lama, di luar scope
// pemindahan ini (lihat changelog 2026-09-09 folder tools/).
export default {
  name: 'memory_manager',
  description: 'Menyimpan, mencari, dan mengelola User Memory di Supabase',
  category: 'memory',
  async execute(params, context) {
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
};
