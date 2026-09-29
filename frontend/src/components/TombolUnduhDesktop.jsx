import React, { useState, useEffect } from 'react';
import { ambilRilisTerbaru, teksUnduh, alamatUnduh } from '../core/runtime/services/unduhAplikasi';

/**
 * TombolUnduhDesktop — tautan unduh aplikasi desktop, untuk pengguna yang membuka Mamet lewat web.
 *
 * Dipasang di DUA tempat dengan alasan berbeda:
 *   • layar masuk (`LampLogin`) — rekan kantor mendarat di sana, dan bisa mengunduh TANPA login dulu.
 *     Inilah yang menghapus pekerjaan mengirim berkas 190 MB satu per satu.
 *   • Pengaturan — untuk yang sudah masuk lewat web dan baru kemudian ingin versi desktopnya.
 *
 * TIDAK dirender di aplikasi desktop: di sana pembaruan datang sendiri lewat auto-updater, dan tombol
 * "unduh aplikasi" hanya akan membingungkan orang yang sudah memakainya.
 *
 * Versi & ukurannya ditampilkan SEBELUM diklik. 190 MB bukan angka yang pantas mengejutkan orang
 * sesudah unduhannya berjalan — apalagi di jaringan kantor.
 */
export default function TombolUnduhDesktop({ ringkas = false }) {
  const [info, setInfo] = useState(null);
  const diDesktop = typeof window !== 'undefined' && !!window.electronAPI?.checkForUpdates;

  useEffect(() => {
    if (diDesktop) return;
    let batal = false;
    ambilRilisTerbaru().then((r) => { if (!batal) setInfo(r); });
    return () => { batal = true; };
  }, [diDesktop]);

  // Sudah memakai aplikasi desktopnya — tak ada yang perlu diunduh.
  if (diDesktop) return null;

  const alamat = alamatUnduh(info);
  const teks = teksUnduh(info);

  if (ringkas) {
    return (
      <a
        href={alamat}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[12px] text-[#e4b84f] hover:text-[#ffe29a] transition-colors underline underline-offset-2"
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
