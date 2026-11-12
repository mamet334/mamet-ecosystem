import { alamatBolehDiambil } from '../../../../../shared/alamatPublik.js';

export { alamatBolehDiambil };

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
