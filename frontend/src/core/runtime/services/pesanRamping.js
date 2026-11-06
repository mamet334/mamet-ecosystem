
export const VERSI_PESAN_RAMPING = 'pesan-ramping v1 (2026-11-02)';

function salinanEkor(steps, langkahMeta) {
  if (!Array.isArray(steps) || !Array.isArray(langkahMeta) || langkahMeta.length > steps.length) return false;
  const awal = steps.length - langkahMeta.length;
  return langkahMeta.every((l, i) => l === steps[awal + i]);
}

export function rampingkanPesan(pesan) {
  const meta = pesan?.metadata;
  if (!meta || typeof meta !== 'object' || !salinanEkor(pesan.steps, meta.processingSteps)) return pesan;
  const { processingSteps: _salinan, ...sisa } = meta;
  return { ...pesan, metadata: sisa };
}

export function pesanUntukServer(pesan) {
  if (!pesan || typeof pesan !== 'object') return pesan;
  const { steps: _langkah, ...sisa } = pesan;
  if (sisa.metadata && typeof sisa.metadata === 'object' && 'processingSteps' in sisa.metadata) {
    const { processingSteps: _p, ...meta } = sisa.metadata;
    sisa.metadata = meta;
  }
  return sisa;
}
