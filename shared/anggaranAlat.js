export const PUTARAN_ALAT_BAWAAN = 8;
export const PAGAR_PUTARAN_ALAT = 40;
export const ALAT_PER_PUTARAN = 10;

const bulat = (v) => (typeof v === 'number' && Number.isInteger(v) ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : null);

export function putaranAlatAman(nilai, bawaan = PUTARAN_ALAT_BAWAAN) {
  const n = bulat(nilai);
  if (n === null || n < 1) return bawaan;
  return Math.min(n, PAGAR_PUTARAN_ALAT);
}

export function anggaranAlatAman(muatan, maksTanpaSetelan) {
  const m = muatan && typeof muatan === 'object' ? muatan : {};
  const maks = bulat(m.maks) !== null && bulat(m.maks) >= 1 ? Math.min(bulat(m.maks), PAGAR_PUTARAN_ALAT) : maksTanpaSetelan;
  const putaran = bulat(m.putaran) !== null ? Math.min(Math.max(bulat(m.putaran), 0), PAGAR_PUTARAN_ALAT) : 0;
  const sisa = bulat(m.sisa) !== null ? Math.min(Math.max(bulat(m.sisa), 0), maks) : Math.max(0, maks - putaran);
  return { putaran, maks, sisa };
}

export function kalimatAnggaranPutaran({ maks, sisa }) {
  return `Anggaran putaran alat per pertanyaan: ${maks} (angka yang diatur pengguna di Settings, berlaku untuk semua jenis alat); sisa ${sisa}${sisa <= 0 ? ' — putaran alat SUDAH HABIS: jawab sekarang tanpa tag' : ''}.`;
}

export function kalimatLanjutPutaran({ sisa }, apa = 'isi') {
  return sisa > 0
    ? `Lanjutkan: jawab pertanyaan pengguna dari ${apa} di atas, atau minta alat lagi (sisa ${sisa} putaran alat).`
    : `Ini putaran alat TERAKHIR: jawab sekarang dari ${apa} yang sudah terbaca, JANGAN meminta alat lagi. Sebutkan bila ada bagian yang belum sempat dibaca.`;
}
