
export const ALAMAT_API = 'https://api.github.com/repos/mamet334/mamet-ai-releases/releases/latest';
export const ALAMAT_HALAMAN = 'https://github.com/mamet334/mamet-ai-releases/releases/latest';

export function pilihPemasang(rilis) {
  if (!rilis || typeof rilis !== 'object') return null;
  if (rilis.draft || rilis.prerelease) return null;
  const aset = Array.isArray(rilis.assets) ? rilis.assets : [];
  const exe = aset.find((a) => typeof a?.name === 'string' && /\.exe$/i.test(a.name) && a.browser_download_url);
  if (!exe) return null;
  return {
    versi: String(rilis.tag_name || '').replace(/^v/i, ''),
    nama: exe.name,
    url: exe.browser_download_url,
    byte: Number(exe.size) || 0,
  };
}

export function bentukUkuran(byte) {
  const n = Number(byte);
  if (!Number.isFinite(n) || n <= 0) return '';
  const mb = n / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1).replace('.', ',')} GB`;
  return `${Math.round(mb)} MB`;
}

export function teksUnduh(info) {
  if (!info) return 'Unduh aplikasi desktop';
  const ukuran = bentukUkuran(info.byte);
  return `Unduh Mamet AI ${info.versi ? `v${info.versi}` : 'terbaru'}${ukuran ? ` · ${ukuran}` : ''}`;
}

export function alamatUnduh(info) {
  return info?.url || ALAMAT_HALAMAN;
}

export async function ambilRilisTerbaru(fetchFn = fetch) {
  try {
    const res = await fetchFn(ALAMAT_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res?.ok) return null;
    return pilihPemasang(await res.json());
  } catch {
    return null;
  }
}
