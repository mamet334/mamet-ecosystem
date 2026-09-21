import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, FileSpreadsheet, ChevronDown, ChevronRight, Loader2, ScanLine } from 'lucide-react';
import { uraiBaris, labelBaris, SUMBER_OCR } from '../../core/runtime/services/dataTabelAsnOcr.js';

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
              Baris JUMLAH di {s.sumber === SUMBER_OCR ? 'PDF' : 'Excel'} ({labelBaris(s.jumlahTertulis.baris)}):{' '}
              {s.jumlahTertulis.l === null ? s.jumlahTertulis.total : `L${s.jumlahTertulis.l} + P${s.jumlahTertulis.p} = ${s.jumlahTertulis.total}`}
              {' '}— terbaca {s.orang.length} orang
            </p>
          )}
          {s.kejanggalan.length > 0 && (
            <div className="space-y-1">
              {s.kejanggalan.map((k, i) => (
                <div key={i} className="flex items-start gap-2 text-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                  <span>{k.pesan}{k.baris ? ` (${labelBaris(k.baris)})` : ''}</span>
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
                          <td className="px-2 py-1 text-slate-500 whitespace-nowrap">{uraiBaris(o.baris_asal)}</td>
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

export default function PratinjauDataTabel({ hasil, onTutup, opdAwal, onPeriksaVersi, onSimpan }) {
  const r = hasil.ringkasan;
  const perluCek = hasil.sheets.filter((s) => s.status === 'PERLU_CEK' || s.status === 'GAGAL').length;
  return (
    <div className="mb-6 border border-blue-500/30 rounded-xl bg-slate-900/70 p-4">
      <div className="flex items-start gap-3 mb-3">
        {hasil.sumber === SUMBER_OCR
          ? <ScanLine className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          : <FileSpreadsheet className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />}
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
      {hasil.sumber === SUMBER_OCR && (
        // PDF pindaian (Item 92 Tahap 5): uji 3 pasangan PDF–xlsx — 121 NIP tepat, 2 NIP 18 digit beda SATU digit (tak
        // terdeteksi susunan NIP), sisanya terpotong (dicatat). Maka NIP hasil OCR wajib dicocokkan sebelum dikirim balik.
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100 space-y-1">
          <p>
            <b>Dibaca dari PDF pindaian lewat OCR.</b> Jumlah orang dan L/P umumnya tepat, tetapi <b>digit NIP bisa salah baca</b>{' '}
            tanpa terdeteksi — cocokkan NIP dengan berkas kertasnya sebelum dipakai. Nomor baris = halaman PDF dan urutan baris tabel.
          </p>
          {hasil.catatanOcr?.map((c, i) => <p key={i} className="text-amber-200/80">• {c.pesan}</p>)}
        </div>
      )}
      <p className="text-[11px] text-slate-500 mb-3">
        {hasil.sumber === SUMBER_OCR ? 'Hasil OCR ditampilkan di perangkat ini' : 'Dibaca di perangkat ini'} — <b>belum disimpan</b> sampai Anda menekan Simpan.
      </p>
      <div className="space-y-2">
        {hasil.sheets.map((s, i) => <KartuSheet key={s.sheet + i} s={s} terbukaAwal={s.status === 'PERLU_CEK' || s.status === 'GAGAL'} />)}
      </div>
      {onSimpan && <BagianSimpan hasil={hasil} opdAwal={opdAwal} onPeriksaVersi={onPeriksaVersi} onSimpan={onSimpan} />}
    </div>
  );
}

// SIMPAN (Item 92 Tahap 2). Mesin hanya tahu dua berkas BERBAGI NIP; ia tidak tahu mana yang lebih baru (simulasi 53
// berkas dengan urutan acak: "PBJ.xlsx" lama sempat "menggantikan" "PBJ yg baru.xlsx"). Arah versi = keputusan Owner.
function BagianSimpan({ hasil, opdAwal, onPeriksaVersi, onSimpan }) {
  const [opd, setOpd] = useState(opdAwal || '');
  const [tahap, setTahap] = useState('siap'); // siap → memeriksa → pilih → menyimpan → tersimpan | galat
  const [kandidat, setKandidat] = useState([]);
  const [pilihan, setPilihan] = useState('ganti'); // untuk satu kandidat: ganti | lama | terpisah
  const [diganti, setDiganti] = useState({}); // untuk beberapa kandidat: id → true
  const [pesan, setPesan] = useState('');
  const kosong = hasil.ringkasan.jumlahOrang === 0;

  const simpan = async (opsi) => {
    setTahap('menyimpan');
    try {
      await onSimpan(opd.trim(), opsi);
      setTahap('tersimpan');
    } catch (e) {
      setPesan(e?.message || String(e));
      setTahap('galat');
    }
  };

  const mulai = async () => {
    if (!opd.trim()) { setPesan('Isi nama OPD dulu.'); setTahap('galat'); return; }
    setTahap('memeriksa');
    try {
      const k = await onPeriksaVersi(opd.trim());
      if (!k.length) return simpan({ gantikan: [], versiLamaDari: null });
      setKandidat(k);
      setPilihan('ganti');
      setDiganti(Object.fromEntries(k.map((x) => [x.id, true])));
      setTahap('pilih');
    } catch (e) {
      setPesan(e?.message || String(e));
      setTahap('galat');
    }
  };

  const konfirmasi = () => {
    if (kandidat.length === 1) {
      const id = kandidat[0].id;
      return simpan(pilihan === 'ganti' ? { gantikan: [id] } : pilihan === 'lama' ? { gantikan: [], versiLamaDari: id } : { gantikan: [] });
    }
    return simpan({ gantikan: kandidat.filter((x) => diganti[x.id]).map((x) => x.id) });
  };

  if (tahap === 'tersimpan') {
    return (
      <div className="mt-4 flex items-center gap-2 text-sm text-emerald-300">
        <CheckCircle2 className="w-4 h-4" /> Tersimpan: {opd} — {hasil.ringkasan.jumlahOrang} orang. Lihat di "Data Tabel Tersimpan" di bawah.
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-slate-800 pt-4 space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-slate-400">Nama OPD</label>
        <input
          value={opd}
          onChange={(e) => setOpd(e.target.value)}
          disabled={tahap !== 'siap' && tahap !== 'galat'}
          className="flex-1 min-w-[220px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none"
          placeholder="mis. RSUD dr. H. Ibnu Sutowo"
        />
        {(tahap === 'siap' || tahap === 'galat') && (
          <button onClick={mulai} disabled={kosong} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold">
            Simpan {hasil.ringkasan.jumlahOrang} orang
          </button>
        )}
        {(tahap === 'memeriksa' || tahap === 'menyimpan') && (
          <span className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> {tahap === 'memeriksa' ? 'Memeriksa versi…' : 'Menyimpan…'}</span>
        )}
      </div>
      {tahap === 'galat' && <p className="text-red-300">Gagal: {pesan}</p>}

      {/* ISI SAMA PERSIS (Item 92): INSPEKTORAT senin tersimpan dua kali karena ditawarkan sebagai "versi" — padahal
          tidak ada yang perlu dipilih. Tidak ada tombol Simpan. */}
      {tahap === 'pilih' && kandidat.length === 1 && kandidat[0].identik && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
          <p className="text-emerald-200">
            Isi berkas ini <b>sama persis</b> dengan data yang sudah tersimpan: <b>{kandidat[0].opd}</b> — {kandidat[0].nama_berkas}. Tidak perlu disimpan lagi.
          </p>
          <button onClick={() => setTahap('siap')} className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white border border-slate-700">Tutup</button>
        </div>
      )}

      {tahap === 'pilih' && !(kandidat.length === 1 && kandidat[0].identik) && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-amber-200">
            Berkas ini berbagi NIP dengan data yang sudah tersimpan — kemungkinan versi dari data yang sama. Sistem tidak tahu mana yang lebih baru; Anda yang menentukan.
          </p>
          {kandidat.length === 1 ? (
            <>
              <p className="text-slate-300">
                <b>{kandidat[0].opd}</b> — {kandidat[0].nama_berkas} ({kandidat[0].alasan}, {Math.round(kandidat[0].rasio * 100)}%)
              </p>
              {kandidat[0].perbedaan && <p className="text-slate-400">Beda isi dengan yang tersimpan: {kandidat[0].perbedaan}</p>}
              {[
                ['ganti', 'Berkas ini lebih baru — gantikan yang lama (yang lama disimpan sebagai riwayat, tidak dihitung)'],
                ['lama', 'Berkas ini justru versi lama — simpan sebagai riwayat saja, yang aktif tetap yang sudah ada'],
                ['terpisah', 'Bukan versi — simpan terpisah (keduanya dihitung)'],
              ].map(([nilai, teks]) => (
                <label key={nilai} className="flex items-start gap-2 text-slate-200 cursor-pointer">
                  <input type="radio" name="pilihan-versi" checked={pilihan === nilai} onChange={() => setPilihan(nilai)} className="mt-0.5" />
                  {teks}
                </label>
              ))}
            </>
          ) : (
            kandidat.map((k) => (
              <label key={k.id} className="flex items-start gap-2 text-slate-200 cursor-pointer">
                <input type="checkbox" checked={!!diganti[k.id]} onChange={(e) => setDiganti((d) => ({ ...d, [k.id]: e.target.checked }))} className="mt-0.5" />
                Gantikan <b>{k.opd}</b> — {k.nama_berkas} ({k.alasan}, {Math.round(k.rasio * 100)}%{k.perbedaan ? ` · ${k.perbedaan}` : ''})
              </label>
            ))
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={konfirmasi} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">Simpan</button>
            <button onClick={() => setTahap('siap')} className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}
