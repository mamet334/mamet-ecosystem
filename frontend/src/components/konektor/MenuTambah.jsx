import React, { useCallback, useEffect, useRef, useState } from 'react';
import Ikon from '../Ikon';
import { useService } from '../../core/runtime/hooks/useService';
import { susunMenuKonektor, penandaKonektor } from './menuKonektor';
import { mintaBagianSettings } from './arahSettings';

/**
 * Tombol + di bilah chat (Item 129 Tahap G5, keputusan Owner 3 Nov): dulu hanya "percakapan baru"; kini menu kecil —
 * "Percakapan baru" di baris pertama, lalu konektor workspace ini dengan sakelarnya (K3). Titik di tombol + menandai
 * konektor yang menyala (atau yang dinyalakan tetapi bermasalah), supaya terlihat tanpa membuka menu.
 *
 * Pemasangan, kredensial, dan tinjau alat tetap HANYA di Settings › Konektor — menu ini hanya menyalakan/mematikan
 * konektor yang sudah siap, lewat jalur yang sama dengan Settings (`atur`). Di web (tanpa Electron) menu hanya berisi
 * "Percakapan baru" dan keterangan bahwa konektor hanya di desktop.
 */
const SELANG_SEGAR_MS = 5000;

export default function MenuTambah({ onNewChat, workspaceId }) {
  const api = typeof window !== 'undefined' ? window.electronAPI : null;
  const desktop = !!(api?.konektor?.status || api?.konektorUmum?.status);
  const applicationManager = useService('ApplicationManager');
  const [buka, setBuka] = useState(false);
  const [daftar, setDaftar] = useState([]);
  const [sedang, setSedang] = useState(null);
  const [galat, setGalat] = useState(null);
  const ref = useRef(null);

  const segarkan = useCallback(async () => {
    if (!desktop || !workspaceId) return;
    try {
      const [bawaan, umum] = await Promise.all([
        api.konektor?.status ? api.konektor.status() : [],
        api.konektorUmum?.status ? api.konektorUmum.status() : [],
      ]);
      setDaftar(susunMenuKonektor(bawaan, umum, workspaceId));
    } catch { /* proses utama sibuk — dicoba lagi pada selang berikutnya; penanda tetap keadaan terakhir */ }
  }, [api, desktop, workspaceId]);

  useEffect(() => {
    if (!desktop) return undefined;
    segarkan();
    const t = setInterval(segarkan, SELANG_SEGAR_MS);
    return () => clearInterval(t);
  }, [desktop, segarkan]);

  useEffect(() => {
    if (!buka) return undefined;
    const luar = (e) => { if (ref.current && !ref.current.contains(e.target)) setBuka(false); };
    const esc = (e) => { if (e.key === 'Escape') setBuka(false); };
    document.addEventListener('mousedown', luar);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', luar); document.removeEventListener('keydown', esc); };
  }, [buka]);

  const tekan = async (k) => {
    setSedang(k.id);
    setGalat(null);
    try {
      const h = k.asal === 'bawaan'
        ? await api.konektor.atur(workspaceId, k.id, !k.diaktifkan)
        : await api.konektorUmum.atur(workspaceId, k.id, !k.diaktifkan);
      if (h && !h.ok) setGalat(`${k.nama}: ${h.alasan || 'gagal'}`);
    } catch (e) {
      setGalat(`${k.nama}: ${e.message}`); // tidak ditelan: tampil di bawah daftar konektor
    } finally {
      setSedang(null);
      segarkan();
    }
  };

  const keSettings = () => {
    setBuka(false);
    mintaBagianSettings('konektor');
    applicationManager?.activateApp?.('app:settings');
  };

  const penanda = penandaKonektor(daftar);
  const menyala = daftar.filter((k) => k.menyala).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setBuka((b) => !b); segarkan(); }}
        aria-haspopup="menu"
        aria-expanded={buka}
        title={menyala ? `Percakapan baru · ${menyala} konektor menyala` : 'Percakapan baru · konektor'}
        className="relative w-10 h-10 flex items-center justify-center bg-surface-container-low border border-outline-variant rounded-xl hover:bg-surface-variant text-on-surface transition-all shadow-sm"
      >
        <Ikon nama="add" ukuran={20} />
        {penanda && (
          <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${penanda === 'masalah' ? 'bg-error' : 'bg-primary'}`} />
        )}
      </button>

      {buka && (
        <div role="menu" className="absolute left-0 top-12 z-50 w-72 rounded-xl border border-outline-variant bg-surface-container-low shadow-lg p-2">
          <button
            type="button"
            role="menuitem"
            onClick={() => { setBuka(false); onNewChat(); }}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-variant text-left text-sm font-semibold text-on-surface transition-all"
          >
            <Ikon nama="add" ukuran={18} />
            Percakapan baru
          </button>

          <div className="px-2 pt-2 pb-1 mt-1 border-t border-outline-variant text-[12px] font-bold text-on-surface-variant uppercase tracking-wide">
            Konektor
          </div>
          {!desktop && <p className="px-2 py-1 text-xs text-on-surface-variant">Konektor hanya tersedia di aplikasi desktop.</p>}
          {desktop && daftar.length === 0 && <p className="px-2 py-1 text-xs text-on-surface-variant">Belum ada konektor terpasang.</p>}
          {daftar.map((k) => {
            const bisa = k.siap || k.diaktifkan; // yang sudah menyala selalu bisa dimatikan
            return (
              <button
                key={k.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={k.diaktifkan}
                disabled={!bisa || sedang === k.id}
                onClick={() => tekan(k)}
                title={k.keterangan}
                className="w-full flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-surface-variant text-left transition-all disabled:opacity-60"
              >
                <Ikon nama={k.diaktifkan ? 'toggle_on' : 'toggle_off'} ukuran={18} className={`shrink-0 ${k.diaktifkan ? 'text-primary' : 'text-on-surface-variant'}`} />
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-xs font-semibold text-on-surface">{k.nama} · {k.jumlahAlat} alat</span>
                  <span className={`text-[12px] break-words ${k.diaktifkan && !k.menyala ? 'text-error' : 'text-on-surface-variant'}`}>
                    {sedang === k.id ? 'memproses…' : k.keterangan}
                  </span>
                </span>
              </button>
            );
          })}
          {galat && <p className="px-2 py-1 text-[12px] text-error break-words">{galat}</p>}
          {desktop && (
            <button
              type="button"
              role="menuitem"
              onClick={keSettings}
              className="w-full flex items-center gap-2 px-2 py-2 mt-1 border-t border-outline-variant text-left text-xs text-primary hover:underline"
            >
              <Ikon nama="settings" ukuran={16} />
              Atur di Settings ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}
