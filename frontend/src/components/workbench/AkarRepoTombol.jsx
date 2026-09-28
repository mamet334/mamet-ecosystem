import React, { useEffect, useState } from 'react';
import { GitBranch, FolderGit2, X } from 'lucide-react';

// TOMBOL AKAR REPO ENGINEER (ROADMAP-ENGINEER-MANDIRI Tahap 5, 2026-09-28).
//
// Kembaran `FolderKerjaTombol` untuk Engineer, dan sengaja dibuat semirip mungkin: folder dipilih
// lewat IPC berpagar `engineer:pilih-akar-repo`, akarnya dicatat di PROSES UTAMA, layar hanya
// menerima NAMA folder. Yang berbeda cuma dua penjaga di sisi proses utama — wajib ada `.git`, dan
// folder di dalam direktori instalasi ditolak.
//
// Di `npm run desktop` akar repo sudah pasti (folder induk main.cjs), jadi tombol tampil sebagai
// keterangan saja: tidak ada yang perlu dipilih. Di aplikasi terpasang, tanpa pilihan Owner seluruh
// alat repo Engineer MATI — dan tombol ini satu-satunya jalan menghidupkannya.
// Tanpa Electron (web/Mametlite) tombol tidak tampil.

export default function AkarRepoTombol() {
  const api = typeof window !== 'undefined' ? window.electronAPI?.engineer : null;
  const [status, setStatus] = useState({ aktif: false, nama: null, sumber: 'belum-dipilih', alasan: '' });
  const [pesan, setPesan] = useState('');

  useEffect(() => {
    if (!api?.statusAkarRepo) return;
    api.statusAkarRepo().then(setStatus).catch(() => {});
  }, [api]);

  if (!api?.statusAkarRepo) return null;

  const pilih = async () => {
    setPesan('');
    try {
      const h = await api.pilihAkarRepo();
      setStatus(h);
      if (h.ditolak) setPesan(h.ditolak);
    } catch (e) { setPesan(`Gagal membuka folder: ${e.message || e}`); }
  };
  const lepas = async () => {
    try { setStatus(await api.lepasAkarRepo()); setPesan(''); } catch (e) { setPesan(e.message || String(e)); }
  };

  const dariPengembangan = status.sumber === 'pengembangan';
  const judul = status.aktif
    ? (dariPengembangan
      ? `Akar repo: ${status.nama} (mode pengembangan — mengikuti folder aplikasi, tidak perlu dipilih)`
      : `Akar repo Engineer: ${status.nama}. git, patch, checkpoint, dan uji klaim bekerja di sini. Klik untuk ganti.`)
    : 'Pilih folder repo — hasil "git clone" Anda. Tanpa ini, alat repo Engineer (git, patch, checkpoint, uji klaim) mati.';

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={dariPengembangan ? undefined : pilih}
        disabled={dariPengembangan}
        className={`p-2 rounded-xl transition-all flex items-center gap-1.5 ${dariPengembangan ? 'cursor-default' : 'cursor-pointer'} ${status.aktif
          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
          : 'bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25'}`}
        title={judul}
      >
        {status.aktif ? <FolderGit2 className="w-4 h-4" /> : <GitBranch className="w-4 h-4" />}
        <span className="text-[11px] max-w-[130px] truncate">{status.aktif ? status.nama : 'Pilih repo'}</span>
      </button>
      {status.aktif && !dariPengembangan && (
        <button type="button" onClick={lepas} className="p-1 rounded-lg text-on-surface-variant hover:text-red-400" title="Lepas akar repo">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {pesan && (
        <span className="absolute bottom-full left-0 mb-1 max-w-[380px] rounded bg-red-900/90 px-2 py-1 text-[10px] leading-snug text-red-100">
          {pesan}
        </span>
      )}
    </div>
  );
}
