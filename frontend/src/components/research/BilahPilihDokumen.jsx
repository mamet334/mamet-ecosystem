import React from 'react';
import Ikon from '../Ikon';

/**
 * Bilah pilih banyak dokumen (Research App, 5 Nov 2026 — permintaan Owner): "pilih semua yang tampil", jumlah
 * terpilih, hapus terpilih, batal. Penghapusan & konfirmasinya di ResearchApp (hapusDokumen.js).
 */
export default function BilahPilihDokumen({ jumlahTampil, jumlahDipilih, onPilihSemua, onBatal, onHapus, status }) {
    const semua = jumlahTampil > 0 && jumlahDipilih === jumlahTampil;
    return (
        <div className="flex items-center justify-between gap-3 mb-2 px-1">
            <label className="flex items-center gap-2 text-[12px] text-on-surface-variant cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={semua}
                    onChange={onPilihSemua}
                    disabled={!!status || jumlahTampil === 0}
                    className="w-4 h-4 cursor-pointer accent-blue-500"
                />
                Pilih semua yang tampil ({jumlahTampil})
            </label>
            {jumlahDipilih > 0 && (
                <div className="flex items-center gap-2">
                    <span className="text-[12px] text-on-surface">{status || `${jumlahDipilih} dipilih`}</span>
                    <button
                        onClick={onBatal}
                        disabled={!!status}
                        className="px-3 py-1 rounded-lg text-[12px] text-on-surface border border-outline-variant hover:bg-surface-container-high transition-all"
                    >
                        Batal
                    </button>
                    <button
                        onClick={onHapus}
                        disabled={!!status}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-[12px] text-red-300 border border-red-500/40 hover:bg-red-500/10 transition-all"
                    >
                        <Ikon nama="delete" ukuran={14} />
                        Hapus terpilih
                    </button>
                </div>
            )}
        </div>
    );
}
