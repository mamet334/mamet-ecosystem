import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Download, Loader2, RefreshCw } from 'lucide-react';
import { uraiBaris } from '../../core/runtime/services/dataTabelAsnOcr.js';
import { susunLaporanJanggal, lembarExcelOpd, lembarRingkasan, namaLembar, JENIS, TINGKAT } from '../../core/runtime/services/dataTabelAsnJanggal.js';

// LAPORAN KEJANGGALAN PER OPD (Item 92 Tahap 4): diperiksa kode dari data tersimpan (berkas aktif), tanpa AI.
// Unduh Excel = berkas dibuat di perangkat pengguna, siap dikirim balik ke OPD.

const MAKS_TAMPIL = 300; // baris per OPD di layar; lengkapnya di Excel
const LEBAR = [5, 16, 44, 22, 10, 34, 21, 60];
const hariIni = () => new Date().toISOString().slice(0, 10);
const aman = (s) => String(s).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

export default function LaporanKejanggalan({ onMuatBahan, onUnduh }) {
  const [laporan, setLaporan] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [terbuka, setTerbuka] = useState(null);
  const [hanyaSalah, setHanyaSalah] = useState(false);
  const [mengunduh, setMengunduh] = useState(null);

  const muat = async () => {
    setMemuat(true); setGalat('');
    try { setLaporan(susunLaporanJanggal(await onMuatBahan())); }
    catch (err) { setGalat(err.message || String(err)); }
    finally { setMemuat(false); }
  };

  const unduh = async (kunci, namaBerkas, lembar) => {
    setMengunduh(kunci);
    try { await onUnduh(namaBerkas, lembar); }
    catch (err) { alert('Gagal membuat Excel: ' + (err.message || err)); }
    finally { setMengunduh(null); }
  };
  const unduhOpd = (x) => unduh(x.berkas_id, `Kejanggalan ${aman(x.opd)} ${hariIni()}.xlsx`,
    [{ nama: namaLembar(x.opd), aoa: lembarExcelOpd(x), lebar: LEBAR }]);
  const unduhSemua = () => {
    const pakai = new Set();
    unduh('semua', `Kejanggalan semua OPD ${hariIni()}.xlsx`, [
      { nama: namaLembar('Ringkasan', pakai), aoa: lembarRingkasan(laporan), lebar: [34, 40, 8, 16, 16] },
      ...laporan.perOpd.map((x) => ({ nama: namaLembar(x.opd, pakai), aoa: lembarExcelOpd(x), lebar: LEBAR })),
    ]);
  };

  if (!laporan) {
    return (
      <div className="mb-6">
        <button onClick={muat} disabled={memuat} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-amber-300 border border-amber-500/30 hover:bg-amber-500/10 transition-colors disabled:opacity-50">
          {memuat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          Laporan kejanggalan per OPD
        </button>
        {galat && <p className="mt-1 text-[11px] text-red-400">Gagal memuat: {galat}</p>}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-500/20 bg-slate-900/40 p-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-slate-200">Laporan Kejanggalan</h2>
        <span className="text-[11px] text-slate-500">
          {laporan.perOpd.length} berkas aktif · <span className="text-red-300">{laporan.total.salah} perlu dibetulkan</span> · <span className="text-amber-300">{laporan.total.lengkapi} perlu dilengkapi</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
            <input type="checkbox" checked={hanyaSalah} onChange={(e) => setHanyaSalah(e.target.checked)} /> hanya yang perlu dibetulkan
          </label>
          <button onClick={muat} disabled={memuat} className="p-1 rounded text-slate-500 hover:text-slate-200" title="Periksa ulang dari data tersimpan">
            {memuat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
          <button onClick={unduhSemua} disabled={!!mengunduh} className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/10">
            {mengunduh === 'semua' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Excel semua OPD
          </button>
          <button onClick={() => setLaporan(null)} className="text-[11px] text-slate-500 hover:text-slate-300">Tutup</button>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 mb-2">
        Diperiksa kode dari data tersimpan, tanpa AI. NIP diperiksa menurut susunannya: tanggal lahir, TMT (PPPK: tahun + kode 21),
        digit ke-15 jenis kelamin (1 = L, 2 = P). "Baris" = nomor baris di berkas Excel kiriman OPD; PDF pindaian: "hal. N baris M".
      </p>

      <div className="space-y-1">
        {laporan.perOpd.map((x) => {
          const buka = terbuka === x.berkas_id;
          const butir = hanyaSalah ? x.butir.filter((b) => b.tingkat === 'salah') : x.butir;
          if (hanyaSalah && !x.salah) return null;
          return (
            <div key={x.berkas_id} className="rounded border border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
                <button onClick={() => setTerbuka(buka ? null : x.berkas_id)} className="flex min-w-0 flex-1 items-center gap-1 text-left text-slate-200">
                  {buka ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{x.opd}</span>
                  <span className="truncate text-[10px] text-slate-500">· {x.jumlah_orang} orang</span>
                </button>
                <span className={`text-[11px] ${x.salah ? 'text-red-300' : 'text-slate-600'}`}>{x.salah} dibetulkan</span>
                <span className={`text-[11px] ${x.lengkapi ? 'text-amber-300' : 'text-slate-600'}`}>{x.lengkapi} dilengkapi</span>
                <button onClick={() => unduhOpd(x)} disabled={!!mengunduh} className="p-1 rounded text-slate-500 hover:text-emerald-300" title={`Unduh Excel ${x.opd}`}>
                  {mengunduh === x.berkas_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                </button>
              </div>
              {buka && (
                <div className="border-t border-slate-800 px-2 py-2 overflow-x-auto">
                  <p className="mb-1 text-[10px] text-slate-500">{x.nama_berkas}</p>
                  {!butir.length ? (
                    <p className="text-[11px] text-emerald-300">Tidak ada kejanggalan{hanyaSalah ? ' yang perlu dibetulkan' : ''}.</p>
                  ) : (
                    <table className="w-full text-[11px]">
                      <thead className="text-slate-500">
                        <tr className="text-left">
                          <th className="pr-2 font-normal">Masalah</th><th className="pr-2 font-normal">Sheet</th><th className="pr-2 font-normal">Baris</th>
                          <th className="pr-2 font-normal">Nama</th><th className="pr-2 font-normal">NIP</th><th className="font-normal">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {butir.slice(0, MAKS_TAMPIL).map((b, i) => (
                          <tr key={i} className="align-top border-t border-slate-800/60">
                            <td className={`pr-2 py-0.5 ${b.tingkat === 'salah' ? 'text-red-300' : 'text-amber-300'}`} title={TINGKAT[b.tingkat]}>{JENIS[b.jenis].label}</td>
                            <td className="pr-2 py-0.5 text-slate-400">{b.sheet}</td>
                            <td className="pr-2 py-0.5 text-slate-400 whitespace-nowrap">{b.baris == null ? '' : uraiBaris(b.baris)}</td>
                            <td className="pr-2 py-0.5 text-slate-200">{b.nama}</td>
                            <td className="pr-2 py-0.5 font-mono text-slate-400">{b.nip}</td>
                            <td className="py-0.5 text-slate-400">{b.keterangan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {butir.length > MAKS_TAMPIL && <p className="mt-1 text-[10px] text-slate-500">Menampilkan {MAKS_TAMPIL} dari {butir.length} — lengkapnya di Excel.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
