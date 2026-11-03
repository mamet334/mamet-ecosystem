import React, { useState } from 'react';
import Ikon from '../Ikon';

/**
 * Tambah server MCP dari resep (Item 129 Tahap G2, K19). Resep = satu berkas JSON: bawaan (ikut pemasang) atau buatan
 * Owner di folder resep perangkat ini — server baru tanpa kode. Alamat program dipilih di dialog proses utama.
 * Sumber resmi ditampilkan sebagai teks (bukan tautan): tautan di jendela aplikasi akan membuka halaman di dalam Mamet.
 */
const TOMBOL_BIASA = 'flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all active:scale-95 font-semibold text-sm disabled:opacity-60 border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface';

export default function TambahServer({ resep, terpasang, api, onBerubah }) {
  const [galat, setGalat] = useState(null);
  const [sedang, setSedang] = useState(null);
  const belum = (resep?.resep || []).filter((r) => !terpasang.includes(r.id));

  const pasang = async (id) => {
    setGalat(null);
    setSedang(id);
    try {
      const h = await api.pasang(id);
      if (h && !h.ok && !h.dibatalkan) setGalat(h.alasan || 'gagal');
    } catch (e) {
      setGalat(e.message); // tidak ditelan: tampil di bawah daftar resep
    } finally {
      setSedang(null);
      onBerubah();
    }
  };

  const bukaFolder = async () => {
    setGalat(null);
    try {
      const h = await api.bukaFolderResep();
      if (!h?.ok) setGalat(h?.alasan || 'folder resep tidak bisa dibuka');
    } catch (e) {
      setGalat(e.message); // tidak ditelan: tampil di bawah daftar resep
    }
  };

  return (
    <div className="rounded-lg border border-outline-variant p-4 mb-4">
      <p className="text-sm font-semibold text-on-surface flex items-center gap-2">
        <Ikon nama="add_circle" ukuran={18} className="text-on-surface-variant" />
        Tambah konektor
      </p>
      {belum.length === 0 && (
        <p className="text-body-sm text-on-surface-variant mt-1">Semua resep sudah terpasang.</p>
      )}
      {belum.map((r) => (
        <div key={r.id} className="flex items-start gap-3 py-2.5 border-t border-outline-variant mt-2">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <p className="text-sm text-on-surface">
              {r.nama} <span className="text-[12px] text-on-surface-variant">({r.jenis}{r.asal === 'owner' ? ', resep Anda' : ''}{r.versiDiuji ? `, diuji v${r.versiDiuji}` : ''})</span>
            </p>
            {r.petunjuk && <p className="text-body-sm text-on-surface-variant whitespace-pre-wrap break-words">{r.petunjuk}</p>}
            {r.sumber && <code className="text-[12px] text-on-surface-variant break-all">{r.sumber}</code>}
          </div>
          <button type="button" disabled={sedang === r.id} onClick={() => pasang(r.id)} className={`shrink-0 ${TOMBOL_BIASA}`}>
            <Ikon nama="download" ukuran={18} />
            {r.jenis === 'stdio' ? 'Pasang (tunjuk program)' : 'Pasang'}
          </button>
        </div>
      ))}
      <div className="mt-3 pt-3 border-t border-outline-variant flex items-center gap-3 flex-wrap">
        <span className="text-body-sm text-on-surface-variant flex-1 min-w-0">
          Server lain: taruh berkas resep <code>&lt;id&gt;.json</code> di folder resep, lalu buka lagi layar ini.
        </span>
        <button type="button" onClick={bukaFolder} className={TOMBOL_BIASA}>
          <Ikon nama="folder_open" ukuran={18} />
          Buka folder resep
        </button>
      </div>
      {resep?.galat?.length > 0 && (
        <div className="mt-2">
          {resep.galat.map((g) => <p key={g} className="text-body-sm text-error break-words">Resep diabaikan — {g}</p>)}
        </div>
      )}
      {galat && <p className="text-body-sm text-error mt-2">{galat}</p>}
    </div>
  );
}
