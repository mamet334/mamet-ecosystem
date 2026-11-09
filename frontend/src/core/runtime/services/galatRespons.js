export const MAKS_TEKNIS_GALAT = 300;
const POLA_HALAMAN_CLOUDFLARE = /cloudflare|cf-error|no-js ie6 oldie/i;

export async function bacaGalatRespons(response) {
  const status = response?.status ?? null;
  let mentah = '';
  try { mentah = await response.text(); } catch (e) { console.warn('[galatRespons] badan jawaban galat tak terbaca:', e?.message || e); mentah = ''; }
  if (status === 403 && POLA_HALAMAN_CLOUDFLARE.test(mentah)) {
    return { kode: 'DIBLOKIR_CLOUDFLARE', pesan: null, status, teknis: 'HTTP 403 dari halaman blokir Cloudflare (permintaan tidak sampai ke server Mamet)' };
  }
  try {
    const e = JSON.parse(mentah);
    return { kode: e?.error || null, pesan: e?.message || null, status, teknis: null };
  } catch (_) {
    const teks = String(mentah || '').replace(/\s+/g, ' ').trim().slice(0, MAKS_TEKNIS_GALAT);
    return { kode: null, pesan: null, status, teknis: teks ? `HTTP ${status}: ${teks}` : `HTTP ${status} tanpa isi` };
  }
}
