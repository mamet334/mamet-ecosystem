import React, { useCallback, useEffect, useState } from 'react';
import Ikon from './Ikon';

/**
 * Settings › Konektor (Item 129 Tahap C, 2026-10-23) — susunan disetujui Owner dari pratinjau ①–⑤.
 *
 *   ① tab sendiri · ② sakelar TERPISAH Assistant/Engineer (K3) · ③ cara crawler mengakses halaman, hanya ditampilkan
 *   (dibaca Mamet dari `katalog` saat konektor menyala; sakelarnya di `.env` crawler) · ④ konektor yang tak bisa
 *   dijalankan: sakelar mati, alasan ditampilkan · ⑤ versi web: konektor hanya di desktop.
 *
 * Setelan disimpan proses utama di perangkat (K7, `konektor.json` di userData). Layar ini hanya membaca status dan
 * memakai sakelar — memanggil alat konektor tidak bisa dari sini (K2: gerbang persetujuan di proses utama, Tahap D).
 * Warna memakai token palet (primary/error/tertiary), jadi ikut tema (Item 128); ikon lewat <Ikon>.
 */

const WORKSPACE = [
  { id: 'ws-assistant', label: 'Assistant' },
  { id: 'ws-engineer', label: 'Engineer' },
];

const KETERANGAN = {
  'ecosystem-crawler': 'Mencari dan mengambil data mentah dari banyak sumber. Setiap misi menunggu persetujuan Anda.',
};

const SELANG_SEGAR_MS = 3000;

/** Status per konektor: { id, nama, jenis, tersedia, alasan, ws: { 'ws-assistant': {...}, ... }, ringkasan } */
export function kelompokkan(daftar) {
  const hasil = new Map();
  for (const s of daftar || []) {
    const k = hasil.get(s.konektor) || { id: s.konektor, nama: s.nama, jenis: s.jenis, tersedia: s.tersedia, alasan: s.alasan, ws: {}, ringkasan: null };
    k.ws[s.workspace] = s;
    if (s.ringkasan && !k.ringkasan) k.ringkasan = s.ringkasan;
    hasil.set(s.konektor, k);
  }
  return [...hasil.values()];
}

export function teksStatus(s, sedang) {
  if (sedang) return { teks: 'menyalakan…', kelas: 'text-on-surface-variant' };
  if (s?.status === 'nyala') return { teks: '● menyala', kelas: 'text-primary' };
  if (s?.diaktifkan) return { teks: '● berhenti — matikan lalu nyalakan lagi', kelas: 'text-error' };
  return { teks: '○ mati', kelas: 'text-on-surface-variant' };
}

function KotakAkses({ ringkasan }) {
  const akses = ringkasan?.akses;
  if (!akses) {
    return <p className="text-body-sm text-on-surface-variant italic">Cara crawler mengakses halaman tampil setelah konektor menyala.</p>;
  }
  return (
    <div className="rounded-lg border border-outline-variant px-3 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-on-surface">
      <span className="flex items-center gap-1.5">
        <Ikon nama={akses.patuhi_robots ? 'check_circle' : 'warning'} ukuran={16} className={akses.patuhi_robots ? 'text-primary' : 'text-tertiary'} />
        robots.txt <b className="font-semibold">{akses.patuhi_robots ? 'dipatuhi' : 'tidak dipatuhi'}</b>
      </span>
      <span className="flex items-center gap-1.5">
        <Ikon nama={akses.stealth ? 'visibility_off' : 'visibility'} ukuran={16} className="text-on-surface-variant" />
        stealth <b className="font-semibold">{akses.stealth ? 'nyala' : 'mati'}</b>
      </span>
      <span className="text-[12px] text-on-surface-variant">diubah di <code>.env</code> crawler</span>
    </div>
  );
}

export default function BagianKonektor() {
  const api = typeof window !== 'undefined' ? window.electronAPI?.konektor : null;
  const [daftar, setDaftar] = useState([]);
  const [sedang, setSedang] = useState({}); // `${ws}::${id}` → true selama sakelar diproses
  const [galat, setGalat] = useState({});   // `${ws}::${id}` → alasan gagal terakhir

  const segarkan = useCallback(async () => {
    if (!api) return;
    try { setDaftar(await api.status()); } catch { /* proses utama sibuk — dicoba lagi pada selang berikutnya */ }
  }, [api]);

  useEffect(() => {
    if (!api) return undefined;
    segarkan();
    const t = setInterval(segarkan, SELANG_SEGAR_MS); // status "berhenti sendiri" & ringkasan katalog muncul tanpa muat ulang
    return () => clearInterval(t);
  }, [api, segarkan]);

  const tekan = async (ws, id, nyala) => {
    const k = `${ws}::${id}`;
    setSedang((s) => ({ ...s, [k]: true }));
    setGalat((g) => ({ ...g, [k]: null }));
    try {
      const h = await api.atur(ws, id, nyala);
      if (!h?.ok) setGalat((g) => ({ ...g, [k]: h?.alasan || 'gagal' }));
    } catch (e) {
      setGalat((g) => ({ ...g, [k]: e.message }));
    } finally {
      setSedang((s) => ({ ...s, [k]: false }));
      segarkan();
    }
  };

  return (
    <section className="glass-panel rim-light p-4 md:p-gutter rounded-xl border border-outline-variant">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center">
          <Ikon nama="lan" ukuran={24} className="text-primary" />
        </div>
        <div>
          <h2 className="font-headline-md text-headline-md">Konektor</h2>
          <p className="text-body-sm text-on-surface-variant">Alat dari program lain (MCP), dinyalakan per workspace. Setelan disimpan di perangkat ini, tidak ikut akun.</p>
        </div>
      </div>

      {!api && (
        <p className="text-body-sm text-on-surface-variant flex items-center gap-2">
          <Ikon nama="public" ukuran={18} />
          Konektor hanya tersedia di aplikasi desktop.
        </p>
      )}

      {api && kelompokkan(daftar).map((k) => (
        <div key={k.id} className="rounded-lg border border-outline-variant p-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-on-surface">{k.nama}</span>
            <span className="text-[12px] px-2 py-0.5 rounded border border-outline-variant text-on-surface-variant">{k.jenis}</span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {KETERANGAN[k.id] || ''}
            {k.ringkasan ? ` ${k.ringkasan.sumber} sumber (${k.ringkasan.siap} siap).` : ''}
          </p>

          {!k.tersedia ? (
            <p className="text-body-sm text-error mt-3 flex items-start gap-2">
              <Ikon nama="error" ukuran={18} className="shrink-0" />
              <span>{k.alasan}</span>
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-2.5">
                {WORKSPACE.map((w) => {
                  const kunci = `${w.id}::${k.id}`;
                  const s = k.ws[w.id];
                  const nyala = !!s?.diaktifkan;
                  const st = teksStatus(s, sedang[kunci]);
                  return (
                    <div key={w.id} className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        aria-pressed={nyala}
                        disabled={!!sedang[kunci]}
                        onClick={() => tekan(w.id, k.id, !nyala)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all active:scale-95 font-semibold text-sm disabled:opacity-60
                          ${nyala ? 'border-primary/50 bg-primary/10 text-primary' : 'border-outline-variant bg-surface-container-low text-on-surface-variant'}`}
                      >
                        <Ikon nama={nyala ? 'toggle_on' : 'toggle_off'} ukuran={18} />
                        {w.label}
                      </button>
                      <span className={`text-body-sm ${st.kelas}`}>{st.teks}</span>
                      {galat[kunci] && <span className="text-body-sm text-error basis-full">{galat[kunci]}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                <KotakAkses ringkasan={k.ringkasan} />
              </div>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
