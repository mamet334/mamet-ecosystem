
export function alamatBolehDiambil(url: unknown): boolean {
  let u: URL;
  try { u = new URL(String(url)); } catch { return false;  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0' || h === '::' || h === '::1') return false;
  if (/^(127|10)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (/^(fc|fd|fe80)/.test(h) && h.includes(':')) return false;
  return true;
}

export class AlamatDitolakError extends Error {
  constructor(public alamat: string) {
    super(`Alamat tidak diizinkan (bukan http/https publik): ${alamat.slice(0, 120)}`);
    this.name = 'AlamatDitolakError';
  }
}

const KODE_PENGALIHAN = new Set([301, 302, 303, 307, 308]);
export const MAKS_PENGALIHAN = 5;

export async function ambilAman(
  alamat: string,
  init: RequestInit = {},
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  let url = String(alamat);
  let opsi: RequestInit = { ...init };
  for (let lompatan = 0; lompatan <= MAKS_PENGALIHAN; lompatan++) {
    if (!alamatBolehDiambil(url)) throw new AlamatDitolakError(url);
    const res = await fetchFn(url, { ...opsi, redirect: 'manual' });
    const tujuan = res.headers.get('location');
    if (!KODE_PENGALIHAN.has(res.status) || !tujuan) return res;
    url = new URL(tujuan, url).href;
    const metode = String(opsi.method || 'GET').toUpperCase();
    if (res.status === 303 || ((res.status === 301 || res.status === 302) && metode === 'POST')) {
      const { body: _isi, ...tanpaIsi } = opsi;
      opsi = { ...tanpaIsi, method: 'GET' };
    }
  }
  throw new Error(`Terlalu banyak pengalihan (> ${MAKS_PENGALIHAN})`);
}
