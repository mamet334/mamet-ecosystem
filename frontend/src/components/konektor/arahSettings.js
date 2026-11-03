// ARAH KE SETTINGS (Item 129 Tahap G5, 2026-11-03) — satu tugas: membuka Settings langsung di tab tertentu.
//
// Settings selalu terbuka di "Model AI". Dari menu + di chat, "Atur di Settings ›" seharusnya mendarat di tab
// Konektor. Dua keadaan:
//   - Settings belum pernah dibuka (belum terpasang) → permintaan disimpan, dibaca SEKALI saat Settings terpasang;
//   - Settings sudah terpasang (aplikasi lain sedang di depan) → peristiwa jendela, Settings mengganti tabnya.

export const PERISTIWA_BAGIAN_SETTINGS = 'mamet:settings-bagian';
let tertunda = null;

/** Minta Settings membuka tab `bagian` (mis. 'konektor'). Aplikasinya diaktifkan oleh pemanggil. */
export function mintaBagianSettings(bagian) {
  tertunda = String(bagian || '') || null;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PERISTIWA_BAGIAN_SETTINGS, { detail: { bagian: tertunda } }));
}

/** Dibaca Settings saat terpasang: tab yang diminta (sekali pakai), atau null. */
export function ambilBagianSettings() {
  const b = tertunda;
  tertunda = null;
  return b;
}
