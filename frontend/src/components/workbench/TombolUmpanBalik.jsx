import React from 'react';
import Ikon from '../Ikon';

const TOMBOL = [
  { tombol: 1, ikon: 'thumb_up', label: 'Jawaban membantu' },
  { tombol: -1, ikon: 'thumb_down', label: 'Jawaban kurang tepat' },
];

export default function TombolUmpanBalik({ nilai = 0, onNilai, galat = null }) {
  return (
    <div className="mt-1 flex items-center justify-end gap-0.5">
      {galat && <span className="mr-2 text-[12px] text-error">Penilaian tidak tersimpan: {galat}</span>}
      {TOMBOL.map(({ tombol, ikon, label }) => {
        const dipilih = nilai === tombol;
        return (
          <button
            key={ikon}
            type="button"
            onClick={() => onNilai(tombol)}
            aria-label={label}
            aria-pressed={dipilih}
            title={dipilih ? `${label} — klik lagi untuk membatalkan` : label}
            className={`p-1.5 rounded-lg transition-opacity ${dipilih ? 'text-primary opacity-100' : 'text-on-surface-variant opacity-40 hover:opacity-100'}`}
          >
            <Ikon nama={ikon} ukuran={17} isi={dipilih} />
          </button>
        );
      })}
    </div>
  );
}
