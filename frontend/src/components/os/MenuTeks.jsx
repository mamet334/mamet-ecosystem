import React, { useEffect, useRef, useState } from 'react';
import { useService } from '../../core/runtime/hooks/useService';
import { useKeadaanTersimpan } from '../../core/runtime/hooks/useKeadaanTersimpan.js';
import { supabase } from '../../supabase';


const APP_CHAT = ['app:assistant', 'app:mametlite', 'app:engineer'];
const KUNCI_CHAT_TERAKHIR = 'mamet_menu_chat_terakhir';
const KREM = 'rgb(var(--warna-menu-teks))';
const CAHAYA = '0 0 10px rgb(var(--warna-menu-cahaya-1) / 0.55), 0 0 22px rgb(var(--warna-menu-cahaya-2) / 0.25)';

const bacaChatTerakhir = () => {
  try { return localStorage.getItem(KUNCI_CHAT_TERAKHIR); } catch {  return null; }
};

const KUNCI_POSISI = 'mamet_menu_posisi';
const TEPI = 16;
const posisiBawaan = () => ({ x: TEPI, y: Math.max(TEPI, window.innerHeight - TEPI - 40) });
const bacaPosisi = () => {
  try {
    const p = JSON.parse(localStorage.getItem(KUNCI_POSISI));
    if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) return p;
  } catch {  }
  return posisiBawaan();
};
const simpanPosisi = (p) => {
  try { localStorage.setItem(KUNCI_POSISI, JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y) })); } catch {  }
};
const jepit = (p, el) => {
  const w = el?.offsetWidth || 72, h = el?.offsetHeight || 40;
  return {
    x: Math.min(Math.max(TEPI / 2, p.x), window.innerWidth - w - TEPI / 2),
    y: Math.min(Math.max(TEPI / 2, p.y), window.innerHeight - h - TEPI / 2),
  };
};

function ItemMenu({ label, keterangan, aktif, onClick, judul, akhiran }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={judul}
      aria-current={aktif ? 'page' : undefined}
      className={`group flex items-baseline gap-2 w-full text-left py-1.5 font-mono uppercase tracking-[0.12em] text-[14px] whitespace-nowrap transition-opacity ${aktif ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
      style={{ color: KREM, textShadow: aktif ? CAHAYA : 'none' }}
    >
      <span aria-hidden="true" className={aktif ? '' : 'invisible group-hover:visible'}>▸</span>
      <span>
        <span className="block">{label}{akhiran}</span>
        {keterangan && <span className="block normal-case tracking-normal text-[12px] opacity-80">{keterangan}</span>}
      </span>
    </button>
  );
}

export default function MenuTeks() {
  const applicationManager = useService('ApplicationManager');
  const navigationService = useService('NavigationService');
  const [appState, setAppState] = useState({ apps: [], activeAppId: null });
  const [navTree, setNavTree] = useState([]);
  const [grupTerbuka, setGrupTerbuka] = useState(null);
  const [terbuka, setTerbuka] = useState(false);
  const [chatTerakhir, setChatTerakhir] = useState(bacaChatTerakhir);
  const kotakRef = useRef(null);
  const tombolRef = useRef(null);

  const [posisi, setPosisi] = useState(bacaPosisi);
  const geserRef = useRef({ aktif: false, bergeser: false, x0: 0, y0: 0, px: 0, py: 0 });
  useEffect(() => {
    const jepitUlang = () => setPosisi((p) => jepit(p, tombolRef.current));
    jepitUlang();
    window.addEventListener('resize', jepitUlang);
    return () => window.removeEventListener('resize', jepitUlang);
  }, []);
  const mulaiGeser = (e) => {
    if (e.button !== 0) return;
    geserRef.current = { aktif: true, bergeser: false, x0: e.clientX, y0: e.clientY, px: posisi.x, py: posisi.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const saatGeser = (e) => {
    const g = geserRef.current;
    if (!g.aktif) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.bergeser && Math.abs(dx) + Math.abs(dy) < 5) return;
    g.bergeser = true;
    setPosisi(jepit({ x: g.px + dx, y: g.py + dy }, tombolRef.current));
  };
  const selesaiGeser = () => {
    const g = geserRef.current;
    if (!g.aktif) return;
    g.aktif = false;
    if (g.bergeser) setPosisi((p) => { simpanPosisi(p); return p; });
  };

  const ikutiHalaman = () => {
    setTerbuka(false);
    setGrupTerbuka(null);
  };

  useEffect(() => {
    if (!applicationManager) return;
    const st = applicationManager.getState();
    setAppState(st);
    ikutiHalaman(st);
  }, [applicationManager]);

  useEffect(() => {
    if (navigationService) setNavTree(navigationService.getTree() || []);
  }, [navigationService]);

  useEffect(() => {
    if (!applicationManager) return;
    let terakhir = applicationManager.getState().activeAppId;
    return applicationManager.subscribe((payload) => {
      const st = payload?.data || payload;
      setAppState(st);
      if (navigationService) setNavTree(navigationService.getTree() || []);
      if (st.activeAppId !== terakhir) { terakhir = st.activeAppId; ikutiHalaman(st); }
      if (APP_CHAT.includes(st.activeAppId)) {
        setChatTerakhir(st.activeAppId);
        try { localStorage.setItem(KUNCI_CHAT_TERAKHIR, st.activeAppId); } catch {  }
      }
    });
  }, [applicationManager, navigationService]);

  useEffect(() => {
    if (!terbuka) return;
    const tombol = (e) => {
      if (e.key !== 'Escape') return;
      if (grupTerbuka) setGrupTerbuka(null); else setTerbuka(false);
    };
    const klik = (e) => {
      if (kotakRef.current?.contains(e.target) || tombolRef.current?.contains(e.target)) return;
      setTerbuka(false);
      setGrupTerbuka(null);
    };
    window.addEventListener('keydown', tombol);
    document.addEventListener('mousedown', klik);
    return () => { window.removeEventListener('keydown', tombol); document.removeEventListener('mousedown', klik); };
  }, [terbuka, grupTerbuka]);

  const [chatIdTerakhir] = useKeadaanTersimpan(chatTerakhir || 'app:assistant', 'currentChatId', null);
  const adaLanjutkan = !!chatTerakhir && !!chatIdTerakhir && appState.apps.some((a) => a.id === chatTerakhir);

  const aktif = appState.activeAppId;
  const namaApp = (id) => appState.apps.find((a) => a.id === id)?.name || id;
  const buka = (id) => {
    if (applicationManager && appState.apps.some((a) => a.id === id)) applicationManager.activateApp(id);
    setTerbuka(false);
    setGrupTerbuka(null);
  };
  const keluar = () => {
    if (window.confirm('Keluar dari Mamet?')) supabase.auth.signOut();
  };

  const grup = navTree.find((n) => n.type === 'group' && n.name === grupTerbuka);
  const isiAktif = (n) => n.items?.some((i) => i.appId === aktif);

  return (
    <>
      <button
        ref={tombolRef}
        type="button"
        onPointerDown={mulaiGeser}
        onPointerMove={saatGeser}
        onPointerUp={selesaiGeser}
        onPointerCancel={selesaiGeser}
        onClick={() => {
          if (geserRef.current.bergeser) { geserRef.current.bergeser = false; return; }
          setTerbuka((t) => !t);
          setGrupTerbuka(null);
        }}
        title={terbuka ? 'Tutup menu (Esc) — seret untuk memindahkan' : 'Buka menu — seret untuk memindahkan'}
        aria-expanded={terbuka}
        aria-controls="menu-utama"
        className={`fixed z-50 h-10 px-3.5 flex items-center justify-center rounded-lg bg-[rgb(var(--warna-menu-latar))] border border-[rgb(var(--warna-menu-garis))] shadow-2xl font-mono uppercase tracking-[0.15em] text-[12px] leading-none cursor-grab active:cursor-grabbing select-none transition-opacity ${terbuka ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
        style={{ left: posisi.x, top: posisi.y, touchAction: 'none', color: KREM, textShadow: terbuka ? CAHAYA : 'none' }}
      >
        Menu
      </button>

      {terbuka && (() => {
        const w = tombolRef.current?.offsetWidth || 72, h = tombolRef.current?.offsetHeight || 40;
        const keAtas = posisi.y + h / 2 > window.innerHeight / 2;
        const keKiri = posisi.x + w / 2 > window.innerWidth / 2;
        const letak = {
          ...(keAtas ? { bottom: window.innerHeight - posisi.y + 8 } : { top: posisi.y + h + 8 }),
          ...(keKiri ? { right: window.innerWidth - posisi.x - w } : { left: posisi.x }),
          maxHeight: (keAtas ? posisi.y : window.innerHeight - posisi.y - h) - 16,
        };
        return (
        <aside
          id="menu-utama"
          ref={kotakRef}
          aria-label="Menu utama"
          style={letak}
          className="fixed z-[70] w-max min-w-[12rem] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-[rgb(var(--warna-menu-latar))] border border-[rgb(var(--warna-menu-garis))] rounded-lg px-5 py-5 shadow-2xl select-none"
        >
          <div
            className="mb-5 font-mono font-light uppercase tracking-[0.15em] leading-[1.25] text-[15px]"
            style={{ color: KREM, textShadow: CAHAYA }}
          >
            <div>Mamet</div>
            <div>OS</div>
            <div>Ecosystem</div>
          </div>

          <nav className="flex flex-col gap-0.5">
            {grup ? (
              <>
                <p className="mb-2 font-mono uppercase tracking-[0.15em] text-[12px] opacity-[0.55]" style={{ color: KREM }}>
                  {grup.name}
                </p>
                {grup.items.filter((i) => i.isAvailable !== false).map((i) => (
                  <ItemMenu key={i.appId} label={namaApp(i.appId)} aktif={aktif === i.appId} onClick={() => buka(i.appId)} />
                ))}
                <div className="mt-3">
                  <ItemMenu label="‹ Kembali" onClick={() => setGrupTerbuka(null)} judul="Kembali ke menu utama (Esc)" />
                </div>
              </>
            ) : (
              <>
                {adaLanjutkan && (
                  <div className="mb-2">
                    <ItemMenu
                      label="Lanjutkan"
                      keterangan={namaApp(chatTerakhir)}
                      aktif={false}
                      onClick={() => buka(chatTerakhir)}
                      judul="Kembali ke percakapan terakhir"
                    />
                  </div>
                )}
                {navTree.map((n, idx) => {
                  if (n.type === 'group') {
                    return (
                      <ItemMenu
                        key={`grup-${n.name}`}
                        label={n.name}
                        akhiran=" ›"
                        aktif={isiAktif(n)}
                        onClick={() => setGrupTerbuka(n.name)}
                      />
                    );
                  }
                  if ((n.type === 'item' || n.appId) && n.appId) {
                    return <ItemMenu key={n.appId} label={namaApp(n.appId)} aktif={aktif === n.appId} onClick={() => buka(n.appId)} />;
                  }
                  return n.type === 'separator' ? <div key={`sep-${idx}`} className="h-1" /> : null;
                })}
                <div className="mt-3">
                  <ItemMenu label="Keluar" onClick={keluar} judul="Keluar dari Mamet" />
                </div>
              </>
            )}
          </nav>
        </aside>
        );
      })()}
    </>
  );
}
