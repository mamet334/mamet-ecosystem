/**
 * Tool: word_to_pdf
 *
 * Mengubah dokumen Word (.doc/.docx) menjadi PDF tanpa mengubah foto, grafik, maupun
 * susunan huruf. Mesinnya adalah Word itu sendiri yang mencetak ke printer virtual
 * "Microsoft Print to PDF" — bukan library pembaca teks — jadi tata letaknya dibuat oleh
 * program yang sama dengan pembuat dokumen. Rinciannya di electron/scripts/word_to_pdf.ps1.
 *
 * Hanya jalan di aplikasi desktop (Electron) Windows. Di browser biasa tidak ada akses ke
 * Word maupun path berkas, jadi tool ini menolak dengan jujur, tidak berpura-pura berhasil.
 *
 * Dipanggil dari chat oleh AssistantService saat RequestClassifier mengenali perintah
 * seperti "ubah word ke pdf dokumen ini" DAN ada berkas yang dilampirkan.
 *
 * Kontrak wajib tiap file di tools/ (lihat web_search.js):
 *   export default { name, description, category, async execute(params, context) { ... } }
 */
export default {
  name: 'word_to_pdf',
  description: 'Mengubah dokumen Word (.doc/.docx) menjadi PDF lewat Microsoft Word + Microsoft Print to PDF, tanpa mengubah foto, grafik, atau susunan huruf. Hanya di aplikasi desktop Windows.',
  category: 'document',

  /**
   * @param {Object} params
   * @param {File}   [params.file]     - berkas yang dilampirkan di chat
   * @param {string} [params.filePath] - atau path absolut langsung
   * @returns {Promise<Object>} hasil dari electron/scripts/word_to_pdf.ps1:
   *   { ok, stage, output, ukuran, halaman_word, halaman_pdf, detik, error, word_versi, word_ditutup }
   */
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
