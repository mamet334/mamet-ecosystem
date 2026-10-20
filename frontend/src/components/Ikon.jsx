import React from 'react';

/**
 * Ikon — SATU set ikon untuk seluruh aplikasi: Material Symbols (Item 128, sisa "satu set ikon" — keputusan Owner
 * 20 Okt: "satu set ikon pakai yang terbaru"). Menggantikan lucide-react.
 *
 *   <Ikon nama="close" ukuran={16} className="text-slate-400" />
 *
 * `nama` = nama ligatur Material Symbols. Font yang dibundel hanya SUBSET, jadi nama baru wajib masuk subset lewat
 * `npm run ikon` (skrip itu memindai `nama="…"` pada komponen ini) — nama di luar subset tampil sebagai tulisan, dan
 * uji-ikon-subset menjadi merah karenanya.
 *
 * Kotaknya dibuat persis seperti ikon lucide yang digantikannya: `block` (Tailwind preflight menjadikan <svg> block,
 * jadi `mx-auto` dan tata letak lama tetap berlaku) dan berukuran tetap `ukuran` × `ukuran`. Warna mengikuti teks
 * (`text-*`), sama seperti stroke lucide yang memakai currentColor.
 *
 * aria-hidden: ligatur adalah teks — tanpa ini pembaca layar mengucapkan "close", "progress_activity", dst.
 */
export default function Ikon({ nama, ukuran = 24, isi = false, className = '', style, ...sisa }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined block ${className}`}
      style={{
        fontSize: ukuran,
        width: ukuran,
        height: ukuran,
        ...(isi ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : null),
        ...style,
      }}
      {...sisa}
    >
      {nama}
    </span>
  );
}
