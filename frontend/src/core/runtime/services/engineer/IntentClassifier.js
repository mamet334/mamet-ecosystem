export function detectIntent(task) {
  const text = `${task.title || ''} ${task.description || ''}`.toLowerCase().trim();

  if (!text) {
    console.log('[Engineer] Task text kosong, return CLARIFICATION');
    return 'CLARIFICATION';
  }

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

  if (isAnalysis && isModify) {
    console.log('[Engineer] Intent ambiguous: analysis + modify detected');
    return 'CLARIFICATION';
  }

  if (!isAnalysis && !isModify) {
    console.log('[Engineer] Intent unknown: no keywords matched');
    return 'CLARIFICATION';
  }

  if (isAnalysis && !isModify) {
    console.log('[Engineer] Intent detected: ANALYSIS');
    return 'ANALYSIS';
  }

  console.log('[Engineer] Intent detected: MODIFY_CODE');
  return 'MODIFY_CODE';
}
