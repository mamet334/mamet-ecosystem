/**
 * statusPembaruan.js — menerjemahkan keadaan auto-updater menjadi satu kalimat untuk layar Pengaturan.
 *
 * Sampai 29 September 2026, jembatan pembaruan di `preload.cjs` (`checkForUpdates`, `getAppVersion`,
 * `onUpdateStatus`) **tidak dipakai satu pun berkas di `frontend/src`** — kebalikan dari kode mati yang
 * kita hapus minggu ini: di sana pendengar tanpa pemancar, di sini jembatan tanpa pemakai. Akibatnya
 * Pengaturan tidak punya apa pun untuk ditampilkan, dan Owner maupun rekan kantornya tidak bisa tahu
 * dari dalam aplikasi versi berapa yang sedang berjalan.
 *
 * Logikanya ditaruh di modul tersendiri, bukan di dalam komponen React, supaya bisa DIIMPOR berkas uji —
 * pola yang sudah terbukti di `KonteksChat.js`, `IngatanTemuan.js`, `pemulihanChat.js`. Uji yang menyalin
 * logika ke dalam dirinya sendiri tetap hijau walau kode aslinya berubah (lihat penanda UJI-CERMIN).
 */

/** Nada: 'aman' (tak perlu tindakan) · 'sibuk' (sedang berjalan) · 'perlu' (menunggu Owner) · 'galat'. */
// Nada dipakai layar Pengaturan untuk memilih warna lencana.
const BENTUK = {
  'not-available': { nada: 'aman', teks: 'Aplikasi Anda sudah di versi terbaru.' },
  checking: { nada: 'sibuk', teks: 'Memeriksa pembaruan…' },
  checked: { nada: 'sibuk', teks: 'Pemeriksaan dikirim — hasilnya muncul di sini.' },
  'dev-mode': { nada: 'aman', teks: 'Mode pengembangan: pembaruan otomatis dimatikan. Versi baru hanya sampai ke aplikasi yang dipasang dari installer.' },
};

/**
 * @param {{status?: string, version?: string, percent?: number, message?: string}|null} data
 * @returns {{nada: string, teks: string}|null} null bila belum ada kabar apa pun — layar tidak
 *   menampilkan baris status sama sekali, bukan menampilkan "tidak diketahui".
 */
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
    // Satu-satunya keadaan yang menunggu tindakan Owner: pemasangan baru terjadi saat aplikasi ditutup.
    return { nada: 'perlu', teks: `Versi ${data.version || 'baru'} siap dipasang. Mulai ulang aplikasi untuk menerapkannya.` };
  }
  if (status === 'error') {
    return { nada: 'galat', teks: data.message || 'Pembaruan gagal, sebabnya tidak dilaporkan.' };
  }

  const tetap = BENTUK[status];
  if (tetap) return tetap;
  // Status yang tidak dikenal TIDAK dikarang jadi kalimat menenangkan — pesan aslinya ditampilkan
  // apa adanya, dan bila tak ada pun statusnya tetap disebut.
  return { nada: 'netral', teks: data.message || `Keadaan pembaruan: ${status}` };
}

/** Versi untuk ditampilkan; tanpa data → tanda tanya, bukan tebakan. */
export function bentukVersi(versi) {
  const v = String(versi || '').trim();
  return v ? `v${v.replace(/^v/i, '')}` : 'tidak diketahui';
}

/** Kelas warna per nada — dipisah supaya bisa diuji tanpa merender React. */
// Dipakai Settings.jsx untuk mewarnai teks status pembaruan.
export function warnaStatus(nada) {
  if (nada === 'aman') return 'text-primary';
  if (nada === 'perlu') return 'text-tertiary';
  if (nada === 'galat') return 'text-error';
  return 'text-on-surface-variant';
}
