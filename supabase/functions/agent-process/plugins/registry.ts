import researcher from './researcher.ts';
import scraper from './scraper.ts';
import coder from './coder.ts';
import communicator from './communicator.ts';
import logika from './logic.ts';
import bahasa from './language.ts';
import debate from './debate.ts';
import deepResearch from './deep_research.ts';
import youtubeAnalyst from './youtube_analyst.ts';
import cronManager from './cron_manager.ts';
import shopeeNinja from './shopee_ninja.ts';
// knowledge_manager DIHAPUS (T9, keputusan Owner 2026-09-21): rpc get_workspace_stats tidak ada, filter mutunya butuh
// kunci Groq yang sudah dihapus (0 dokumen pernah tersimpan dari chat, 0 ringkasan workspace), dan ia MEMBUAT
// knowledge_space bernama pertanyaan pengguna. Uji live: jawaban RAG Kepbup menjadi "dokumen tidak ditemukan" karena
// galat/daftar workspace-nya masuk konteks. Workspace kini dikelola dari UI Research App. Kode lama ada di riwayat git.

// Daftarkan semua plugin di sini
export const plugins = [
  researcher,
  scraper,
  coder,
  communicator,
  logika,
  bahasa,
  debate,
  deepResearch,
  youtubeAnalyst,
  cronManager,
  shopeeNinja
];

// Fungsi helper untuk membangun daftar tool otomatis bagi LLM
export const getPluginPromptList = (requestedTools?: string[]) => {
  const toolAliases: Record<string, string> = {
    'web_search': 'researcher',
    'code_executor': 'coder',
    'web_scraper': 'scraper',
    'rag_search': 'rag_search'
  };

  const resolvedTools = requestedTools ? requestedTools.map(t => toolAliases[t] || t) : [];

  return plugins
    .filter(p => {
      // Strict Whitelisting
      if (resolvedTools && resolvedTools.length > 0) {
        if (!resolvedTools.includes(p.name)) return false;
      }
      return true;
    })
    .map((p, index) => `${index + 1}. "${p.name}": ${p.description}`).join('\n');
};

export const getPluginByName = (name: string) => {
  return plugins.find(p => p.name === name);
};
