/**
 * IntentClassifier — Klasifikasi intent task (ANALYSIS / MODIFY_CODE / CLARIFICATION).
 *
 * Diekstrak dari engineer.js (Fase 2, ADR-0017). Murni deterministik berbasis
 * pattern kata kunci, tanpa panggilan LLM — pola identik dengan
 * RequestClassifierService.js (PR#8) di codebase yang sama.
 */
export function detectIntent(task) {
  const text = `${task.title || ''} ${task.description || ''}`.toLowerCase().trim();

  if (!text) {
    console.log('[Engineer] Task text kosong, return CLARIFICATION');
    return 'CLARIFICATION';
  }

  // `readRepoKeywords` + cabang READ_REPO dihapus 2026-09-28 bersama handler-nya di TaskHandlers.js —
  // lihat catatan di sana. Engineer membaca repo lewat [MAMET_CMD: git grep / git blame], bukan lewat intent.
  const analysisKeywords = [
    'analisis', 'review', 'telaah', 'evaluasi', 'cek', 'laporan',
    'analyze', 'analyse', 'check', 'examine', 'inspect',
    'audit', 'lihat', 'baca', 'pelajari', 'cari tahu',
    'what is', 'how does', 'explain', 'describe', 'tunjukkan',
    'diagnosa', 'diagnose'
  ];

  const modifyKeywords = [
    'ubah', 'tambah', 'hapus', 'perbaiki', 'refactor', 'implementasi',
    'change', 'add', 'remove', 'delete', 'fix', 'implement',
    'modify', 'update', 'create', 'buat', 'tulis', 'write',
    'patch', 'edit', 'ganti', 'masukkan', 'insert',
    'migrate', 'pindahkan', 'move','perubahan','patch'
  ];

  if (text.includes('patch') || text.includes('perbaiki') || text.includes('perubahan')) {
  console.log('[Engineer] Intent forced: MODIFY_CODE (keyword patch/perbaiki/perubahan)');
  return 'MODIFY_CODE';
  }

  const isAnalysis = analysisKeywords.some(kw => text.includes(kw));
  const isModify = modifyKeywords.some(kw => text.includes(kw));

  // 1. Jika ambiguous (kedua kategori terdeteksi)
  if (isAnalysis && isModify) {
    console.log('[Engineer] Intent ambiguous: analysis + modify detected');
    return 'CLARIFICATION';
  }

  // 2. Jika tidak ada kategori yang terdeteksi
  if (!isAnalysis && !isModify) {
    console.log('[Engineer] Intent unknown: no keywords matched');
    return 'CLARIFICATION';
  }

  // 3. Analisis murni
  if (isAnalysis && !isModify) {
    console.log('[Engineer] Intent detected: ANALYSIS');
    return 'ANALYSIS';
  }

  // 4. Modifikasi kode murni
  console.log('[Engineer] Intent detected: MODIFY_CODE');
  return 'MODIFY_CODE';
}
