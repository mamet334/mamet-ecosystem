/**
 * unduhAplikasi.js — menemukan pemasang (.exe) terbaru dari rilis GitHub, untuk pengguna yang membuka
 * Mamet lewat web.
 *
 * Masalah yang diselesaikan (permintaan Owner, 29 September 2026): sampai hari ini satu-satunya cara
 * rekan kantor mendapatkan aplikasi desktop adalah Owner MENGIRIMKAN berkasnya sendiri — 190 MB, manual,
 * dan setiap kali ada versi baru harus diulang. Sekarang cukup membuka alamat webnya.
 *
 * KENAPA BOLEH LANGSUNG DIUNDUH TANPA LOGIN: repo rilis `mamet334/mamet-ai-releases` bersifat PUBLIK
 * (diperiksa 29 Sep). Yang publik hanya installer-nya — kode sumber, kunci, dan data tetap tidak ikut.
 *
 * DUA LAPIS, supaya tidak pernah buntu:
 *   1. API GitHub → nama berkas, versi, dan ukurannya bisa ditampilkan sebelum orang mengklik.
 *   2. Bila API gagal (batas laju 60 permintaan/jam per IP, atau jaringan) → tautan halaman rilis yang
 *      SELALU menunjuk versi terbaru. Tombolnya tetap berguna, hanya tanpa keterangan versi.
 */

export const ALAMAT_API = 'https://api.github.com/repos/mamet334/mamet-ai-releases/releases/latest';
/** Halaman ini selalu menunjuk rilis terbaru yang sudah diterbitkan — dipakai sebagai cadangan. */
export const ALAMAT_HALAMAN = 'https://github.com/mamet334/mamet-ai-releases/releases/latest';

/**
 * Ambil pemasang Windows dari satu objek rilis GitHub.
 *
 * Rilis kita memuat tiga berkas: installer `.exe`, `latest.yml`, dan `.blockmap`. Dua yang terakhir
 * dipakai auto-updater, BUKAN untuk diunduh manusia — memberikannya kepada orang yang mengklik
 * "Unduh" adalah kesalahan yang diam: berkasnya turun, tetapi tidak bisa dipasang.
 *
 * @returns {{versi: string, nama: string, url: string, byte: number}|null}
 */
export function pilihPemasang(rilis) {
  if (!rilis || typeof rilis !== 'object') return null;
  if (rilis.draft || rilis.prerelease) return null;   // draf tak terlihat publik; pra-rilis bukan untuk rekan kantor
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

/** Ukuran berkas dalam bentuk yang dimengerti orang — 190 MB itu angka yang pantas diketahui dulu. */
export function bentukUkuran(byte) {
  const n = Number(byte);
  if (!Number.isFinite(n) || n <= 0) return '';
  const mb = n / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1).replace('.', ',')} GB`;
  return `${Math.round(mb)} MB`;
}

/** Tulisan tombol. Tanpa info rilis, tombolnya tetap ada — hanya tanpa versi & ukuran. */
export function teksUnduh(info) {
  if (!info) return 'Unduh aplikasi desktop';
  const ukuran = bentukUkuran(info.byte);
  return `Unduh Mamet AI ${info.versi ? `v${info.versi}` : 'terbaru'}${ukuran ? ` · ${ukuran}` : ''}`;
}

/**
 * Alamat yang dipakai tombol: berkas langsung bila diketahui, halaman rilis bila tidak.
 * Tidak pernah mengembalikan alamat kosong — tombol yang tidak menuju ke mana-mana lebih buruk
 * daripada tombol yang membuka halaman rilis.
 */
export function alamatUnduh(info) {
  return info?.url || ALAMAT_HALAMAN;
}

/** Ambil info rilis terbaru. Gagal = null, bukan lemparan — tombol harus tetap tampil. */
export async function ambilRilisTerbaru(fetchFn = fetch) {
  try {
    const res = await fetchFn(ALAMAT_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res?.ok) return null;
    return pilihPemasang(await res.json());
  } catch {
    return null;
  }
}
