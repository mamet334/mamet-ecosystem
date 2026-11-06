
const panjang = (s) => (typeof s === 'string' ? s.length : 0);

export function jejakSisipan({
  engineer = false,
  akarRepo = '',
  petaMentah = '',
  catatanAkar = '',
  catatanPeta = '',
  ringkasanTemuan = '',
  mulaiDari = 0,
  jumlahPesan = 0,
} = {}) {
  if (!engineer) return '';

  const bagian = [
    ['akar', panjang(catatanAkar)],
    ['peta', panjang(catatanPeta)],
    ['temuan', panjang(ringkasanTemuan)],
  ];
  const terpasang = bagian.filter(([, n]) => n > 0);
  const total = bagian.reduce((n, [, x]) => n + x, 0);
  const kosong = bagian.filter(([, n]) => n === 0).map(([nama]) => nama);

  return [
    '[Sisipan]',
    `akarRepo=${akarRepo ? 'ADA' : 'KOSONG'}`,
    `petaMentah=${panjang(petaMentah)}`,
    `→ ${bagian.map(([nama, n]) => `${nama}=${n}`).join(' ')}`,
    `| ${terpasang.length} sisipan / ${total} huruf`,
    `| mulaiDari=${mulaiDari} dari ${jumlahPesan} pesan`,
    kosong.length ? `| KOSONG: ${kosong.join(', ')}` : '',
  ].filter(Boolean).join(' ');
}
