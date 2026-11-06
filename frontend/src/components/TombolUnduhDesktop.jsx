import React, { useState, useEffect } from 'react';
import { ambilRilisTerbaru, teksUnduh, alamatUnduh } from '../core/runtime/services/unduhAplikasi';

export default function TombolUnduhDesktop({ ringkas = false }) {
  const [info, setInfo] = useState(null);
  const diDesktop = typeof window !== 'undefined' && !!window.electronAPI?.checkForUpdates;

  useEffect(() => {
    if (diDesktop) return;
    let batal = false;
    ambilRilisTerbaru().then((r) => { if (!batal) setInfo(r); });
    return () => { batal = true; };
  }, [diDesktop]);

  if (diDesktop) return null;

  const alamat = alamatUnduh(info);
  const teks = teksUnduh(info);

  if (ringkas) {
    return (
      <a
        href={alamat}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[12px] text-[rgb(var(--warna-tautan-unduh))] hover:text-[rgb(var(--warna-tautan-unduh-sorot))] transition-colors underline underline-offset-2"
      >
        {teks}
      </a>
    );
  }

  return (
    <a
      href={alamat}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 text-sm font-semibold transition-all active:scale-95"
    >
      <span className="material-symbols-outlined text-[18px]">download</span>
      {teks}
    </a>
  );
}
