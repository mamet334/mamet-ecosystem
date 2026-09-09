// [STUB] Dipindah apa adanya dari ToolRegistryService.js (initialize()) ke folder tools/
// untuk konsistensi lokasi. Belum ada logika baca file nyata, hanya placeholder.
export default {
  name: 'file_reader',
  description: 'Membaca dan menganalisis file (PDF, Excel, Word, TXT)',
  category: 'analysis',
  async execute(params, context) {
    return { message: 'File reader tool ready', filePath: params.filePath };
  }
};
