import React from 'react';

const DINDING = 'bg-[radial-gradient(ellipse_62%_72%_at_39%_56%,rgba(119,70,35,.68)_0%,rgba(78,43,23,.48)_32%,rgba(42,24,15,.72)_64%,#0b0705_100%),linear-gradient(180deg,#21140c,#3a2113_50%,#17100b)]';
const BAYANGAN_SAMPING = 'bg-gradient-to-r from-black/[.43] via-transparent via-[78%] to-black/[.52]';
const VINYET = 'bg-[radial-gradient(ellipse_82%_82%_at_47%_47%,transparent_40%,rgba(0,0,0,.08)_65%,rgba(0,0,0,.40)_100%)]';
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

const PENDAR_1 = 'absolute left-[2%] top-[8%] w-[85%] h-[65%] bg-[radial-gradient(ellipse_at_45%_30%,rgba(255,191,88,.28)_0%,rgba(231,143,52,.16)_28%,rgba(190,100,31,.06)_52%,transparent_75%)] blur-[30px]';
const PENDAR_2 = 'absolute left-[4%] top-[20%] w-[80%] h-[55%] bg-[radial-gradient(ellipse_at_48%_20%,rgba(255,188,82,.22),rgba(215,119,37,.08)_46%,transparent_76%)] blur-[20px]';

export default function LatarRuangan() {
  return (
    <div aria-hidden="true" className="latar-ruangan absolute inset-0 pointer-events-none overflow-hidden">
      <div className={`absolute inset-0 ${DINDING}`} />
      <div
        className="absolute inset-0 opacity-10 mix-blend-overlay"
        style={{ backgroundImage: NOISE, backgroundRepeat: 'repeat', backgroundSize: '256px 256px' }}
      />
      <div className={`absolute inset-0 ${BAYANGAN_SAMPING}`} />
      <div className="lampu-ruangan absolute left-0 top-0 w-full h-[75%] opacity-25">
        <div className={PENDAR_1} />
        <div className={PENDAR_2} />
      </div>
      <div className={`absolute inset-0 ${VINYET}`} />
    </div>
  );
}
