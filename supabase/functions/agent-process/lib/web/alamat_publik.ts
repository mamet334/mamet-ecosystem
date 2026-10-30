/**
 * ALAMAT PUBLIK — pagar SSRF untuk setiap `fetch` ke alamat yang ditentukan pengguna atau model (K5, ADR-0022).
 *
 * Dipakai `proxy_fetch_endpoint.ts`, sub-agent `communicator` dan `scraper`. Dulu (s.d. 30 Okt 2026) hanya
 * `proxy_fetch` yang berpagar, dan itu pun hanya alamat AWAL: `fetch` bawaan mengikuti pengalihan (redirect) tanpa
 * memeriksa tujuannya, jadi alamat publik yang mengalihkan ke 169.254.169.254 tetap lolos. `communicator` (permintaan
 * HTTP sembarang buatan model) dan `scraper` sama sekali tanpa pagar — dan pendaftaran akun Supabase terbuka, jadi
 * "wajib masuk" tidak menghalangi siapa pun (model ancaman TM-001, TM-005).
 *
 * Batas yang diketahui: host bernama tidak di-resolve DNS — nama yang menunjuk ke alamat privat tetap lolos.
 */

/** Alamat boleh diambil server? Hanya http/https ke host publik. Tidak memeriksa DNS (host bernama tetap boleh). */
export function alamatBolehDiambil(url: unknown): boolean {
  let u: URL;
  try { u = new URL(String(url)); } catch { return false; /* bukan URL sah → ditolak (penolakannya dicatat pemanggil) */ }
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

/**
 * `fetch` dengan pagar: alamat awal DAN setiap tujuan pengalihan diperiksa `alamatBolehDiambil`. Pengalihan diikuti
 * sendiri (`redirect: 'manual'`) paling banyak MAKS_PENGALIHAN kali. 303 — dan 301/302 sesudah POST — diteruskan
 * sebagai GET tanpa isi, seperti peramban. Alamat ditolak → `AlamatDitolakError` (tak ada permintaan yang keluar).
 */
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
