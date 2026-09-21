import React, { useState } from 'react';
import { Table2, Trash2, Loader2 } from 'lucide-react';

// DATA TABEL TERSIMPAN (Item 92 Tahap 2): berkas rekonsiliasi yang sudah dikonfirmasi Owner. Aktif = dihitung; riwayat
// = versi lama yang sudah digantikan (tetap disimpan untuk diperiksa). Hapus = batalkan unggahan: bila berkas itu
// pernah menggantikan versi lama, versi lama aktif lagi (ON DELETE SET NULL).

const tanggal = (t) => new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function DaftarDataTabel({ daftar, onHapus }) {
  const [menghapus, setMenghapus] = useState(null);
  if (!daftar.length) return null;
  const nama = Object.fromEntries(daftar.map((b) => [b.id, `${b.opd} (${b.nama_berkas})`]));
  const aktif = daftar.filter((b) => !b.digantikan_oleh);
  const orangAktif = aktif.reduce((a, b) => a + b.jumlah_orang, 0);

  const hapus = async (b) => {
    const pengganti = daftar.filter((x) => x.digantikan_oleh === b.id);
    const pesan = `Hapus permanen data tabel "${b.opd}" (${b.jumlah_orang} orang)?`
      + (pengganti.length ? `\n\nVersi lama yang digantikannya akan aktif lagi: ${pengganti.map((x) => x.opd).join(', ')}.` : '');
    if (!window.confirm(pesan)) return;
    setMenghapus(b.id);
    try { await onHapus(b.id); } finally { setMenghapus(null); }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Table2 className="w-4 h-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-slate-200">Data Tabel Tersimpan</h2>
        <span className="text-[11px] text-slate-500">{aktif.length} berkas aktif · {orangAktif} orang dihitung</span>
      </div>
      <div className="space-y-1.5">
        {daftar.map((b) => (
          <div key={b.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${b.digantikan_oleh ? 'border-slate-800/60 bg-slate-900/30 text-slate-500' : 'border-slate-800 bg-slate-900/50 text-slate-300'}`}>
            <div className="min-w-0 flex-1">
              <p className={`truncate ${b.digantikan_oleh ? '' : 'text-slate-100'}`}>{b.opd}</p>
              <p className="truncate text-[10px] text-slate-500">
                {b.nama_berkas} · {tanggal(b.created_at)}
                {b.digantikan_oleh && ` · riwayat — digantikan oleh ${nama[b.digantikan_oleh] || 'berkas lain'}`}
              </p>
            </div>
            <span>{b.jumlah_orang} orang</span>
            <span className={`text-[10px] px-2 py-0.5 rounded border ${b.digantikan_oleh ? 'border-slate-700 text-slate-500' : 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'}`}>
              {b.digantikan_oleh ? 'RIWAYAT' : 'AKTIF'}
            </span>
            <button onClick={() => hapus(b)} disabled={menghapus === b.id} className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-400/10" title="Hapus data tabel ini">
              {menghapus === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
