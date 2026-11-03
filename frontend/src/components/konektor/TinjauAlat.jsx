import React, { useState } from 'react';
import Ikon from '../Ikon';

/**
 * Tinjau alat server MCP (Item 129 Tahap G2, K16). Deskripsi alat adalah TULISAN PIHAK LAIN: ditampilkan sebagai teks
 * biasa (React meng-escape-nya; tidak pernah dangerouslySetInnerHTML — desktop tanpa CSP). Yang dikirim balik ke
 * proses utama hanya NAMA alat yang dicentang; sidiknya dihitung di sana dari snapshot yang sama dengan yang tampil.
 *
 * Centang awal: alat yang sudah disetujui dan tidak berubah. Alat baru & alat yang BERUBAH tidak dicentang —
 * Owner memutuskannya sendiri.
 */
const LABEL_KEADAAN = {
  disetujui: { teks: 'disetujui', kelas: 'text-primary' },
  baru: { teks: 'baru', kelas: 'text-on-surface-variant' },
  berubah: { teks: 'BERUBAH sejak disetujui', kelas: 'text-error' },
};

export default function TinjauAlat({ hasil, onSetujui, onBatal, sedang }) {
  const [pilih, setPilih] = useState(() => new Set((hasil?.alat || []).filter((a) => a.keadaan === 'disetujui').map((a) => a.nama)));
  if (!hasil?.ok) return null;
  const alat = hasil.alat || [];
  const ubah = (nama) => setPilih((p) => { const b = new Set(p); if (b.has(nama)) b.delete(nama); else b.add(nama); return b; });

  return (
    <div className="mt-4 rounded-lg border border-outline-variant p-3">
      <p className="text-sm font-semibold text-on-surface flex items-center gap-2">
        <Ikon nama="verified_user" ukuran={18} className="text-on-surface-variant" />
        Tinjau alat ({alat.length})
      </p>
      <p className="text-body-sm text-on-surface-variant mt-1">
        Deskripsi di bawah ditulis oleh pembuat server, bukan oleh Mamet. Centang hanya alat yang Anda izinkan dipakai.
        Bila nanti server mengubah alat yang Anda setujui, konektor ini berhenti dipakai sampai Anda meninjaunya lagi.
      </p>
      {hasil.hilang?.length > 0 && (
        <p className="text-body-sm text-error mt-2">Alat yang dulu disetujui tetapi tidak ada lagi: {hasil.hilang.join(', ')}</p>
      )}
      <div className="mt-3 flex flex-col">
        {alat.map((a) => (
          <label key={a.nama} className="flex items-start gap-3 py-2.5 border-t border-outline-variant cursor-pointer">
            <input type="checkbox" className="mt-1 shrink-0" checked={pilih.has(a.nama)} onChange={() => ubah(a.nama)} />
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-sm text-on-surface break-all">{a.nama}</code>
                <span className={`text-[12px] ${LABEL_KEADAAN[a.keadaan]?.kelas || ''}`}>{LABEL_KEADAAN[a.keadaan]?.teks || a.keadaan}</span>
              </div>
              <p className="text-body-sm text-on-surface-variant whitespace-pre-wrap break-words">
                {a.deskripsi || '(tanpa deskripsi)'}{a.deskripsiTerpotong ? ' …(dipotong untuk tampilan)' : ''}
              </p>
              {a.parameter?.length > 0 && (
                <p className="text-[12px] text-on-surface-variant break-words">
                  Parameter: {a.parameter.map((p) => `${p.nama}${p.wajib ? '*' : ''} (${p.tipe})`).join(', ')}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          disabled={sedang}
          onClick={() => onSetujui([...pilih])}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all active:scale-95 font-semibold text-sm disabled:opacity-60 border-primary/50 bg-primary/10 text-primary"
        >
          <Ikon nama="check_circle" ukuran={18} />
          Setujui {pilih.size} alat
        </button>
        <button
          type="button"
          onClick={onBatal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all active:scale-95 font-semibold text-sm border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
