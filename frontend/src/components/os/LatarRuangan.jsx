import React from 'react';

// Latar terdalam seluruh aplikasi = dinding ruangan LampLogin (Item 127 Tahap 3). Owner, 19 Okt: "penyebabnya warna
// hijau kayu yang mendominasi… bisakah background dasar yang terletak paling dalam menggunakan background yang sama
// di LampLogin?" Dulu setiap aplikasi mengecat latar terdalamnya sendiri (#050505, slate-950, bg-background) — kini
// latar itu dimiliki SATU lapisan ini di OSDesktopShell, dan akar tiap aplikasi tembus pandang.
//
// UTANG K5 ("dua ruangan"): nilai di bawah DISALIN dari LampLogin.jsx, bukan diimpor — LampLogin tidak boleh disentuh
// dalam pekerjaan ini. Supaya dua salinan tak menyimpang diam-diam, uji-latar-ruangan membaca KEDUA berkas dan
// menuntut kelas dindingnya sama persis. Disatukan nanti di K5, dengan izin Owner menyentuh LampLogin.
//
// Satu perbedaan disengaja: vinyet akhir LampLogin berada DI ATAS semua lapisan (z-20), termasuk kartu masuk.
// Di sini ia berada di BAWAH isi — di atas isi ia akan menggelapkan teks di tepi layar hingga 40%.
const DINDING = 'bg-[radial-gradient(ellipse_62%_72%_at_39%_56%,rgba(119,70,35,.68)_0%,rgba(78,43,23,.48)_32%,rgba(42,24,15,.72)_64%,#0b0705_100%),linear-gradient(180deg,#21140c,#3a2113_50%,#17100b)]';
const BAYANGAN_SAMPING = 'bg-gradient-to-r from-black/43 via-transparent via-78% to-black/52';
const VINYET = 'bg-[radial-gradient(ellipse_82%_82%_at_47%_47%,transparent_40%,rgba(0,0,0,.08)_65%,rgba(0,0,0,.40)_100%)]';
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

export default function LatarRuangan() {
  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className={`absolute inset-0 ${DINDING}`} />
      <div
        className="absolute inset-0 opacity-10 mix-blend-overlay"
        style={{ backgroundImage: NOISE, backgroundRepeat: 'repeat', backgroundSize: '256px 256px' }}
      />
      <div className={`absolute inset-0 ${BAYANGAN_SAMPING}`} />
      <div className={`absolute inset-0 ${VINYET}`} />
    </div>
  );
}
