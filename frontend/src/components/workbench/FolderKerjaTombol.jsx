import React, { useEffect, useState } from 'react';
import { FolderOpen, Folder, X } from 'lucide-react';

// TOMBOL 📁 FOLDER KERJA ASSISTANT (Item 85 Tahap 1, 2026-09-22). Menggantikan FolderSelector: folder dipilih lewat
// IPC berpagar `folder:pilih` — akarnya dicatat & diingat di PROSES UTAMA, layar hanya menerima NAMA folder. Pesan
// chat membaca status langsung dari proses utama (AssistantService), jadi komponen ini hanya tampilan & tombol.
// Tanpa Electron (web/Mametlite) tombol tidak tampil.

export default function FolderKerjaTombol() {
  const api = typeof window !== 'undefined' ? window.electronAPI?.folderKerja : null;
  const [status, setStatus] = useState({ aktif: false, nama: null });
  const [pesan, setPesan] = useState('');

  useEffect(() => {
    if (!api) return;
    api.status().then(setStatus).catch(() => {});
  }, [api]);

  if (!api) return null;

  const pilih = async () => {
    setPesan('');
    try {
      const h = await api.pilih();
      setStatus({ aktif: h.aktif, nama: h.nama });
      if (h.ditolak) setPesan(`Folder ditolak: ${h.ditolak}`);
    } catch (e) { setPesan(`Gagal membuka folder: ${e.message || e}`); }
  };
  const lepas = async () => {
    try { setStatus(await api.lepas()); setPesan(''); } catch (e) { setPesan(e.message || String(e)); }
  };

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={pilih}
        className={`p-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${status.aktif
          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
          : 'text-on-surface-variant hover:bg-surface-container-high'}`}
        title={status.aktif
          ? `Folder kerja: ${status.nama} — Mamet bisa MEMBACA isinya. Isi berkas yang dibaca ikut terkirim ke penyedia model. Klik untuk ganti.`
          : 'Pilih folder kerja — Mamet bisa membaca isinya (baca saja)'}
      >
        {status.aktif ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
        {status.aktif && <span className="text-[11px] max-w-[120px] truncate">{status.nama}</span>}
      </button>
      {status.aktif && (
        <button type="button" onClick={lepas} className="p-1 rounded-lg text-on-surface-variant hover:text-red-400" title="Lepas folder kerja">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {pesan && <span className="absolute bottom-full left-0 mb-1 whitespace-nowrap rounded bg-red-900/80 px-2 py-1 text-[10px] text-red-100">{pesan}</span>}
    </div>
  );
}
