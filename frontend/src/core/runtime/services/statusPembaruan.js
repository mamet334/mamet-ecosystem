
const BENTUK = {
  'not-available': { nada: 'aman', teks: 'Aplikasi Anda sudah di versi terbaru.' },
  checking: { nada: 'sibuk', teks: 'Memeriksa pembaruan…' },
  checked: { nada: 'sibuk', teks: 'Pemeriksaan dikirim — hasilnya muncul di sini.' },
  'dev-mode': { nada: 'aman', teks: 'Mode pengembangan: pembaruan otomatis dimatikan. Versi baru hanya sampai ke aplikasi yang dipasang dari installer.' },
};

export function ringkasPembaruan(data) {
  if (!data || typeof data !== 'object') return null;
  const status = String(data.status || '').trim();
  if (!status) return null;

  if (status === 'available') {
    return { nada: 'sibuk', teks: `Versi ${data.version || 'baru'} tersedia — sedang diunduh di latar belakang.` };
  }
  if (status === 'downloading') {
    const p = Number.isFinite(data.percent) ? Math.max(0, Math.min(100, Math.round(data.percent))) : null;
    return { nada: 'sibuk', teks: p === null ? 'Mengunduh pembaruan…' : `Mengunduh pembaruan… ${p}%` };
  }
  if (status === 'downloaded') {
    return { nada: 'perlu', teks: `Versi ${data.version || 'baru'} siap dipasang. Mulai ulang aplikasi untuk menerapkannya.` };
  }
  if (status === 'error') {
    return { nada: 'galat', teks: data.message || 'Pembaruan gagal, sebabnya tidak dilaporkan.' };
  }

  const tetap = BENTUK[status];
  if (tetap) return tetap;
  return { nada: 'netral', teks: data.message || `Keadaan pembaruan: ${status}` };
}

export function bentukVersi(versi) {
  const v = String(versi || '').trim();
  return v ? `v${v.replace(/^v/i, '')}` : 'tidak diketahui';
}

export function warnaStatus(nada) {
  if (nada === 'aman') return 'text-primary';
  if (nada === 'perlu') return 'text-tertiary';
  if (nada === 'galat') return 'text-error';
  return 'text-on-surface-variant';
}
