import React, { useCallback, useEffect, useState } from 'react';
import KartuServerUmum from './KartuServerUmum';
import TambahServer from './TambahServer';

const SELANG_SEGAR_MS = 3000;

export default function KonektorUmum() {
  const api = typeof window !== 'undefined' ? window.electronAPI?.konektorUmum : null;
  const [status, setStatus] = useState([]);
  const [resep, setResep] = useState(null);

  const segarkan = useCallback(async () => {
    if (!api) return;
    try { setStatus(await api.status()); } catch {  }
  }, [api]);

  const segarkanResep = useCallback(async () => {
    if (!api) return;
    try { setResep(await api.resep()); } catch (e) { setResep({ resep: [], galat: [`resep tidak terbaca: ${e.message}`] }); }
  }, [api]);

  useEffect(() => {
    if (!api) return undefined;
    segarkan();
    segarkanResep();
    const t = setInterval(segarkan, SELANG_SEGAR_MS);
    return () => clearInterval(t);
  }, [api, segarkan, segarkanResep]);

  if (!api) return null;
  const berubah = () => { segarkan(); segarkanResep(); };
  return (
    <>
      {status.map((s) => <KartuServerUmum key={s.id} s={s} api={api} onBerubah={berubah} />)}
      <TambahServer resep={resep} terpasang={status.map((s) => s.id)} api={api} onBerubah={berubah} />
    </>
  );
}
