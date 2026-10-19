import { useCallback, useSyncExternalStore } from 'react';
import { penyimpanKeadaan } from '../PenyimpanKeadaan.js';

/**
 * Pengganti `useState` yang keadaannya hidup di luar layar (Item 127 Tahap 1) — lihat `PenyimpanKeadaan.js`.
 *
 *   const [messages, setMessages] = useKeadaanTersimpan(kunci, 'messages', []);
 *
 * Bentuk kembaliannya SAMA dengan useState, termasuk pengubah fungsi, supaya memindahkan sebuah keadaan
 * tidak mengubah satu pun baris yang memakainya. Penyetelnya STABIL dan tetap bekerja sesudah layarnya
 * dilepas — itulah yang membuat jawaban yang sedang mengalir selamat saat Owner pindah halaman.
 */
export function useKeadaanTersimpan(kunci, nama, awal) {
  penyimpanKeadaan.siapkan(kunci, nama, awal);
  const langgan = useCallback((fn) => penyimpanKeadaan.langgan(kunci, nama, fn), [kunci, nama]);
  const ambil = useCallback(() => penyimpanKeadaan.baca(kunci, nama), [kunci, nama]);
  const nilai = useSyncExternalStore(langgan, ambil);
  const setel = useCallback((v) => penyimpanKeadaan.tulis(kunci, nama, v), [kunci, nama]);
  return [nilai, setel];
}

/** Pengganti `useRef` untuk ref yang harus selamat melewati lepas-pasang layar. */
export function useRefTersimpan(kunci, nama, awal) {
  return penyimpanKeadaan.ref(kunci, nama, awal);
}
