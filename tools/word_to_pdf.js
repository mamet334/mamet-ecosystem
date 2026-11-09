export default {
  name: 'word_to_pdf',
  description: 'Mengubah dokumen Word (.doc/.docx) menjadi PDF lewat Microsoft Word + Microsoft Print to PDF, tanpa mengubah foto, grafik, atau susunan huruf. Hanya di aplikasi desktop Windows.',
  category: 'document',

  async execute(params = {}) {
    const api = typeof window !== 'undefined' ? window.electronAPI : null;
    if (!api || typeof api.wordToPdf !== 'function') {
      return { ok: false, stage: 'platform', error: 'Konversi Word ke PDF hanya tersedia di aplikasi desktop Mamet AI (Windows).' };
    }

    let filePath = params.filePath || null;
    if (!filePath && params.file && typeof api.getPathForFile === 'function') {
      filePath = api.getPathForFile(params.file);
    }
    if (!filePath) {
      return { ok: false, stage: 'input', error: 'Lokasi berkas tidak diketahui. Lampirkan dokumen Word lewat tombol 📎 di kolom chat.' };
    }

    return await api.wordToPdf(filePath);
  }
};
