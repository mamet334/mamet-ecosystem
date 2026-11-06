import { useCallback, useSyncExternalStore } from 'react';
import { penyimpanKeadaan } from '../PenyimpanKeadaan.js';

export function useKeadaanTersimpan(kunci, nama, awal) {
  penyimpanKeadaan.siapkan(kunci, nama, awal);
  const langgan = useCallback((fn) => penyimpanKeadaan.langgan(kunci, nama, fn), [kunci, nama]);
  const ambil = useCallback(() => penyimpanKeadaan.baca(kunci, nama), [kunci, nama]);
  const nilai = useSyncExternalStore(langgan, ambil);
  const setel = useCallback((v) => penyimpanKeadaan.tulis(kunci, nama, v), [kunci, nama]);
  return [nilai, setel];
}

export function useRefTersimpan(kunci, nama, awal) {
  return penyimpanKeadaan.ref(kunci, nama, awal);
}
