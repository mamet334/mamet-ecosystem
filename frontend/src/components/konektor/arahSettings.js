
export const PERISTIWA_BAGIAN_SETTINGS = 'mamet:settings-bagian';
let tertunda = null;

export function mintaBagianSettings(bagian) {
  tertunda = String(bagian || '') || null;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PERISTIWA_BAGIAN_SETTINGS, { detail: { bagian: tertunda } }));
}

export function ambilBagianSettings() {
  const b = tertunda;
  tertunda = null;
  return b;
}
