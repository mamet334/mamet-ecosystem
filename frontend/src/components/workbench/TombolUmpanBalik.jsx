import React from 'react';
import Ikon from '../Ikon';

/**
 * 👍/👎 di bawah kartu jawaban (Item 126 Fase 0, Data Flywheel — susunan disetujui Owner 27 Okt).
 *
 * Transparan supaya ikut tema & tidak mengganggu: tanpa latar & bingkai, warna teks samar 40% saat diam, terang saat
 * diarahkan, terisi & berwarna utama tema saat dipilih. Selalu tampak (layar sentuh tak punya hover).
 * Logika & penyimpanan di services/umpanBalikJawaban.js; layar ini hanya menampilkan dan meneruskan klik.
 *
 * @param {{ nilai?: number, onNilai: (tombol: 1 | -1) => void, galat?: string|null }} props
 */
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
