
const pemformat = new Map();
const fmt = (desimal) => {
  if (!pemformat.has(desimal)) {
    pemformat.set(desimal, new Intl.NumberFormat('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal }));
  }
  return pemformat.get(desimal);
};

export function angka(n, desimal = 0) {
  const x = Number(n);
  return fmt(desimal).format(Number.isFinite(x) ? x : 0);
}

export function ukuranMB(bita) {
  return angka((Number(bita) || 0) / 1048576, 1);
}

export function waktuLokal(nilai) {
  const d = new Date(nilai);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('id-ID');
}
