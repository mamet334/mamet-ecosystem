import React from 'react';

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
