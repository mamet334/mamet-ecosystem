import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, FileSpreadsheet, ChevronDown, ChevronRight } from 'lucide-react';

// PRATINJAU DATA TABEL (Item 92 Tahap 1): hasil pembacaan Excel rekonsiliasi ASN ditampilkan untuk diperiksa Owner
// SEBELUM apa pun disimpan (penyimpanan = Tahap 2). Semua dibaca di perangkat; tidak ada yang dikirim.

const WARNA_STATUS = {
  BERSIH: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  PERLU_CEK: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  KOSONG: 'text-slate-400 bg-slate-500/10 border-slate-600/40',
  GAGAL: 'text-red-300 bg-red-500/10 border-red-500/30',
};
const LABEL_KELOMPOK = { struktural: 'Struktural', jft: 'JFT', pelaksana: 'Pelaksana', pppk: 'PPPK', paruh_waktu: 'Paruh waktu', tidak_dikenal: 'Tidak dikenal' };
const LABEL_BIDANG = {
  no: 'No', nama_nip: 'Nama/NIP', nama: 'Nama', nip: 'NIP', jk_l: 'L', jk_p: 'P', jk: 'Jenis kelamin', status: 'Status',
  pendidikan_cpns: 'Pend. CPNS', pendidikan_akhir: 'Pend. akhir', pim2: 'PIM II', pim3: 'PIM III', pim4: 'PIM IV', pim: 'PIM',
  pelatihan: 'Pelatihan', nilai_ipa: 'Nilai IPA', jabatan: 'Jabatan', pangkat: 'Pangkat', tahun_lulus: 'Tahun lulus',
};

function KartuSheet({ s, terbukaAwal }) {
  const [buka, setBuka] = useState(terbukaAwal);
  const [tabel, setTabel] = useState(false);
  const Ikon = buka ? ChevronDown : ChevronRight;
  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900/50">
      <button onClick={() => setBuka((b) => !b)} className="w-full flex items-center gap-3 p-3 text-left">
        <Ikon className="w-4 h-4 text-slate-500 shrink-0" />
        <span className="text-sm text-slate-200 font-medium truncate">{s.sheet}</span>
        <span className="text-[11px] text-slate-500">{LABEL_KELOMPOK[s.kelompok] || s.kelompok}</span>
        {/* Catatan ringan (mis. pembagian L/P beda) tidak mengubah status BERSIH — tetap harus terlihat tanpa membuka kartu. */}
        {s.kejanggalan.length > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-amber-300" title="buka kartu untuk melihat catatan">
            <AlertTriangle className="w-3.5 h-3.5" /> {s.kejanggalan.length} catatan
          </span>
        )}
        <span className={`${s.kejanggalan.length ? '' : 'ml-auto '}text-xs text-slate-300`}>{s.orang.length} orang</span>
        <span className={`text-[10px] px-2 py-0.5 rounded border ${WARNA_STATUS[s.status] || ''}`}>{s.status.replace('_', ' ')}</span>
      </button>
      {buka && (
        <div className="px-4 pb-4 space-y-3 text-xs">
          {s.jumlahTertulis && (
            <p className="text-slate-400">
              Baris JUMLAH di Excel (baris {s.jumlahTertulis.baris}):{' '}
              {s.jumlahTertulis.l === null ? s.jumlahTertulis.total : `L${s.jumlahTertulis.l} + P${s.jumlahTertulis.p} = ${s.jumlahTertulis.total}`}
              {' '}— terbaca {s.orang.length} orang
            </p>
          )}
          {s.kejanggalan.length > 0 && (
            <div className="space-y-1">
              {s.kejanggalan.map((k, i) => (
                <div key={i} className="flex items-start gap-2 text-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                  <span>{k.pesan}{k.baris ? ` (baris ${k.baris})` : ''}</span>
                </div>
              ))}
            </div>
          )}
          {s.pemetaan.length > 0 && (
            <div>
              <p className="text-slate-500 mb-1">Kolom terbaca sebagai:</p>
              <div className="flex flex-wrap gap-1">
                {s.pemetaan.map((p) => (
                  <span key={p.kolom} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300" title={p.label}>
                    {p.huruf} → {LABEL_BIDANG[p.bidang] || p.bidang}
                  </span>
                ))}
                {s.kolomTakTerpeta.map((p) => (
                  <span key={`t${p.kolom}`} className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-500 line-through" title="tidak dikenali — tidak dipakai">
                    {p.huruf}: {p.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {s.dilewati.length > 0 && (
            <p className="text-slate-500">Dilewati: {s.dilewati.length} baris ({[...new Set(s.dilewati.map((d) => d.alasan))].join('; ')})</p>
          )}
          {s.orang.length > 0 && (
            <div>
              <button onClick={() => setTabel((t) => !t)} className="text-blue-300 hover:text-blue-200">
                {tabel ? 'Sembunyikan' : 'Tampilkan'} {s.orang.length} orang
              </button>
              {tabel && (
                <div className="mt-2 max-h-80 overflow-auto border border-slate-800 rounded">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-slate-900 text-slate-400">
                      <tr>{['No', 'Nama', 'NIP', 'L/P', 'Pend. akhir', 'Jabatan', 'PIM', 'Pelatihan', 'IPA', 'Baris'].map((h) => <th key={h} className="text-left font-medium px-2 py-1">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {s.orang.map((o) => (
                        <tr key={o.baris_asal} className="border-t border-slate-800/70 text-slate-300 align-top">
                          <td className="px-2 py-1">{o.no}</td>
                          <td className="px-2 py-1">{o.nama}</td>
                          <td className={`px-2 py-1 font-mono ${o.nip ? '' : 'text-amber-400'}`}>{o.nip || 'tidak ada'}</td>
                          <td className="px-2 py-1">{o.jenis_kelamin}</td>
                          <td className="px-2 py-1">{o.pendidikan_akhir}</td>
                          <td className={`px-2 py-1 ${o.jabatan ? '' : 'text-amber-400'}`}>{o.jabatan || 'kosong'}</td>
                          <td className="px-2 py-1">{o.pim.join(', ') || '—'}</td>
                          <td className="px-2 py-1">{o.pelatihan.length || '—'}</td>
                          <td className="px-2 py-1">{o.nilai_ipa}</td>
                          <td className="px-2 py-1 text-slate-500">{o.baris_asal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PratinjauDataTabel({ hasil, onTutup }) {
  const r = hasil.ringkasan;
  const perluCek = hasil.sheets.filter((s) => s.status === 'PERLU_CEK' || s.status === 'GAGAL').length;
  return (
    <div className="mb-6 border border-blue-500/30 rounded-xl bg-slate-900/70 p-4">
      <div className="flex items-start gap-3 mb-3">
        <FileSpreadsheet className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{hasil.berkas}</p>
          <p className="text-xs text-slate-400">
            {r.jumlahOrang} orang dari {hasil.sheets.length} sheet
            {Object.entries(r.perKelompok).filter(([, n]) => n).map(([k, n]) => ` · ${LABEL_KELOMPOK[k] || k} ${n}`).join('')}
          </p>
        </div>
        <button onClick={onTutup} className="p-1 text-slate-500 hover:text-slate-200" title="Tutup pratinjau"><X className="w-4 h-4" /></button>
      </div>
      <div className={`flex items-center gap-2 text-xs mb-3 ${perluCek ? 'text-amber-300' : 'text-emerald-300'}`}>
        {perluCek ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
        {perluCek ? `${perluCek} sheet perlu dicek — lihat kejanggalan di bawah.` : 'Semua sheet terbaca tanpa kejanggalan berat.'}
        {r.nipGandaAntarSheet > 0 && <span className="text-amber-300"> · {r.nipGandaAntarSheet} NIP muncul di lebih dari satu sheet</span>}
      </div>
      <p className="text-[11px] text-slate-500 mb-3">
        Pratinjau saja — dibaca di perangkat ini, <b>belum disimpan</b> dan tidak dikirim ke mana pun. Penyimpanan & tanya-jawab menyusul (Item 92 Tahap 2–3).
      </p>
      <div className="space-y-2">
        {hasil.sheets.map((s, i) => <KartuSheet key={s.sheet + i} s={s} terbukaAwal={s.status === 'PERLU_CEK' || s.status === 'GAGAL'} />)}
      </div>
    </div>
  );
}
