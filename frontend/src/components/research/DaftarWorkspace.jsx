import React, { useState } from 'react';
import Ikon from '../Ikon';
import { periksaNamaRuang, bolehDihapus, PANJANG_NAMA_MAKS } from '../../core/runtime/services/ruangPengetahuan.js';

// Deretan workspace + buat / ganti nama / hapus-bila-kosong (2026-09-21). jumlahDokumen = isi workspace terpilih
// (null bila sedang mencari — daftar di layar saat itu mencakup semua workspace).
export default function DaftarWorkspace({ daftar, terpilih, onPilih, jumlahDokumen, onBuat, onGantiNama, onHapus }) {
    const [mode, setMode] = useState(null); // 'buat' | 'ganti' | null
    const [teks, setTeks] = useState('');
    const [pesan, setPesan] = useState('');
    const [sibuk, setSibuk] = useState(false);

    const ruang = daftar.find((s) => s.id === terpilih) || null;
    const tutup = () => { setMode(null); setTeks(''); setPesan(''); };
    const buka = (m) => { setMode(m); setTeks(m === 'ganti' ? ruang?.name || '' : ''); setPesan(''); };

    const simpan = async () => {
        const cek = periksaNamaRuang(teks, daftar, mode === 'ganti' ? terpilih : null);
        if (!cek.ok) { setPesan(cek.pesan); return; }
        if (mode === 'ganti' && cek.nama === ruang?.name) { tutup(); return; }
        setSibuk(true);
        try {
            if (mode === 'buat') await onBuat(cek.nama); else await onGantiNama(terpilih, cek.nama);
            tutup();
        } catch (err) {
            setPesan(err.message || String(err));
        } finally {
            setSibuk(false);
        }
    };

    const hapus = async () => {
        if (!ruang || !window.confirm(`Hapus workspace "${ruang.name}"?\n\nHanya bisa bila workspace kosong (0 dokumen).`)) return;
        setSibuk(true);
        try { await onHapus(ruang); }
        catch (err) { alert(err.message || String(err)); }
        finally { setSibuk(false); }
    };

    const kosong = jumlahDokumen === 0;
    const alasanTakBisaHapus = !ruang ? '' : !bolehDihapus(ruang)
        ? 'Workspace inti (CORE) tidak bisa dihapus'
        : jumlahDokumen == null ? 'Kosongkan pencarian dulu untuk melihat isi workspace'
        : !kosong ? `Masih berisi ${jumlahDokumen} dokumen — hapus dokumennya dulu` : 'Hapus workspace kosong ini';

    return (
        <div className="mb-6">
            <div className="flex gap-2 flex-wrap items-center">
                {daftar.map((space) => (
                    <button
                        key={space.id}
                        onClick={() => { tutup(); onPilih(space.id); }}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${terpilih === space.id
                            ? 'bg-blue-600 text-di-warna'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                        title={space.space_type === 'CORE' ? 'Workspace inti' : undefined}
                    >
                        {space.name}{space.space_type === 'CORE' ? ' · inti' : ''}
                    </button>
                ))}
                <button
                    onClick={() => buka('buat')}
                    disabled={sibuk}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-blue-300 border border-dashed border-blue-500/40 hover:bg-blue-500/10 transition-colors"
                    title="Buat workspace baru"
                >
                    <Ikon nama="add" ukuran={12} /> Workspace baru
                </button>
            </div>

            {ruang && mode === null && (
                <div className="mt-2 flex items-center gap-3 text-[12px] text-slate-500">
                    <span>Unggahan dokumen masuk ke <span className="text-slate-300">"{ruang.name}"</span></span>
                    <button onClick={() => buka('ganti')} disabled={sibuk} className="flex items-center gap-1 hover:text-blue-300" title="Ganti nama workspace ini">
                        <Ikon nama="edit" ukuran={12} /> Ganti nama
                    </button>
                    <button
                        onClick={hapus}
                        disabled={sibuk || !bolehDihapus(ruang) || !kosong}
                        className="flex items-center gap-1 hover:text-red-400 disabled:opacity-40 disabled:hover:text-slate-500"
                        title={alasanTakBisaHapus}
                    >
                        {sibuk ? <Ikon nama="progress_activity" ukuran={12} className="animate-spin" /> : <Ikon nama="delete" ukuran={12} />} Hapus
                    </button>
                </div>
            )}

            {mode && (
                <div className="mt-2 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <input
                            autoFocus
                            value={teks}
                            maxLength={PANJANG_NAMA_MAKS + 20}
                            onChange={(e) => { setTeks(e.target.value); setPesan(''); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') simpan(); if (e.key === 'Escape') tutup(); }}
                            placeholder={mode === 'buat' ? 'Nama workspace baru, mis. Kepbup OKU 2026' : 'Nama baru'}
                            className="flex-1 max-w-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/60"
                        />
                        <button onClick={simpan} disabled={sibuk} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-400/10" title="Simpan">
                            {sibuk ? <Ikon nama="progress_activity" ukuran={16} className="animate-spin" /> : <Ikon nama="check" ukuran={16} />}
                        </button>
                        <button onClick={tutup} disabled={sibuk} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-700/50" title="Batal">
                            <Ikon nama="close" ukuran={16} />
                        </button>
                    </div>
                    {pesan && <p className="text-[12px] text-red-400">{pesan}</p>}
                    {mode === 'buat' && !pesan && (
                        <p className="text-[12px] text-slate-500">Workspace baru langsung terpilih; unggahan berikutnya masuk ke sana. Chat tetap mencari di semua workspace.</p>
                    )}
                </div>
            )}
        </div>
    );
}
