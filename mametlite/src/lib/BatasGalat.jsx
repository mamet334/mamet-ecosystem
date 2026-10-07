// BATAS GALAT MAMETLITE (2026-10-08) — jaring terakhir, dengan jalan keluar untuk orang awam.
//
// Sampai 8 Okt 2026 Mametlite tidak punya satu pun error boundary (`grep errorboundary|
// componentDidCatch|getDerivedStateFromError` → 0). Satu galat saat render = **halaman putih kosong**,
// tanpa sepatah kata. Dan jalur yang paling mungkin memicunya — riwayat `localStorage` yang rusak —
// berulang **setiap muat ulang**, karena nilai buruknya masih tersimpan.
//
// `lib/riwayatLokal.js` sudah menutup jalur itu di sumbernya. Berkas ini untuk sisanya: galat yang
// belum kita ketahui. Dua hal yang membedakannya dari error boundary biasa:
//
//   1. **Ada tindakan, bukan cuma permintaan maaf.** Tombolnya menghapus HANYA kunci riwayat lalu
//      memuat ulang — jadi pengguna bisa keluar sendiri dari keadaan yang terkunci, tanpa tahu apa
//      itu localStorage. Kunci OpenRouter miliknya TIDAK disentuh; ia membayar untuk itu.
//   2. **Tidak menelan sebabnya.** Pesan teknisnya tetap ditampilkan, kecil, di bawah. Pengguna
//      Mametlite membuka dari HP dan tidak punya DevTools — kalau pesannya disembunyikan, satu-satunya
//      cara melaporkan masalah adalah "layarnya putih".

import React from 'react';
import { hapusRiwayat } from './riwayatLokal';

export default class BatasGalat extends React.Component {
  constructor(props) {
    super(props);
    this.state = { galat: null };
  }

  static getDerivedStateFromError(galat) {
    return { galat };
  }

  componentDidCatch(galat, info) {
    // Satu-satunya jejak yang tersisa bila pengguna melaporkannya. Bukan ditelan.
    console.error('[Mametlite] galat render:', galat, info?.componentStack);
  }

  mulaiBaru = () => {
    hapusRiwayat();
    globalThis.location?.reload();
  };

  render() {
    if (!this.state.galat) return this.props.children;

    const pesan = this.state.galat?.message || String(this.state.galat);

    return (
      <div className="min-h-dvh bg-slate-900 text-slate-200 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6">
          <h1 className="text-lg font-semibold text-slate-100">Mamet Lite tersendat</h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Ada yang tidak bisa ditampilkan, jadi halaman ini berhenti di tengah jalan. Riwayat
            percakapan yang tersimpan di perangkat ini kadang jadi sebabnya.
          </p>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Tombol di bawah menghapus riwayat percakapan di perangkat ini, lalu membuka Mamet Lite
            dari awal. <strong>Kunci OpenRouter Anda tidak dihapus.</strong>
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={this.mulaiBaru}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white"
            >
              Hapus riwayat & mulai dari awal
            </button>
            <button
              onClick={() => globalThis.location?.reload()}
              className="w-full rounded-lg border border-slate-600 hover:bg-slate-700 px-4 py-2.5 text-sm text-slate-200"
            >
              Coba muat ulang dulu
            </button>
          </div>

          <p className="mt-4 text-[11px] text-slate-500 break-words leading-snug">
            Pesan teknis (sebutkan ini bila melapor): {pesan}
          </p>
        </div>
      </div>
    );
  }
}
