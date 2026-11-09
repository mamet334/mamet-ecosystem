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
