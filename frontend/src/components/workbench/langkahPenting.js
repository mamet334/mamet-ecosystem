export function langkahPenting(steps) {
  return Array.isArray(steps) ? steps.filter((l) => typeof l === 'string' && /^(🔍 Dicari|📋 Rencana)/.test(l)) : [];
}
