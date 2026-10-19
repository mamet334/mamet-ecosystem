import React, { useEffect, useRef, useState } from 'react';
import { useService } from '../../core/runtime/hooks/useService';
import { useKeadaanTersimpan } from '../../core/runtime/hooks/useKeadaanTersimpan.js';
import { supabase } from '../../supabase';

/**
 * MenuTeks — menu utama bergaya menu game (Item 127, K2 — PERCOBAAN 19 Okt, menunggu penilaian Owner).
 *
 * Bentuk: KOTAK MELAYANG + TOMBOL (pilihan Owner 19 Okt, sesudah versi kolom penuh dinilai "terlalu banyak
 * memotong layar" dan "kaku saat riwayat dibuka"). Menu TIDAK mengambil kolom apa pun: tombol MENU adalah kotak
 * kecil melayang yang bisa DIGESER, bawaannya pojok KIRI BAWAH (versi jalur 48px pun dinilai "tidak menyatu dengan temanya"; kiri atas
 * setiap halaman sudah terisi, kiri bawah kosong di semuanya). Kotak menu terbuka ke arah yang lapang (mengikuti posisi tombol), setinggi isinya:
 *   - di Home ia TERBUKA (lobi game sebelum mulai);
 *   - di halaman lain tertutup; MENU membukanya; memilih aplikasi menutupnya; klik di luar menutupnya.
 *
 * Isinya dari `NavigationService` (= public/metadata/navigation.json), sama dengan sumber bilah samping lama —
 * MUS §21. Grup membuka sub-menu di tempat yang sama dengan "‹ Kembali" (VIDEO · AUDIO · CONTROLS · BACK di
 * gambar referensi Owner). Esc: sub-menu → menu → tutup.
 *
 * Gaya huruf = usul K4 (judul LampLogin: mono krem bercahaya), BELUM diputuskan Owner. Warna dari palet
 * LampLogin, bukan token Material. Kontras setiap teks ≥ 4,5:1 (WCAG 2.2 AA), dihitung dari warna di bawah.
 *
 * "Lanjutkan" hanya muncul bila memang ada percakapan terakhir (MUS §4.2): aplikasi chat yang terakhir dibuka
 * DAN punya chat aktif di PenyimpanKeadaan.
 */

const APP_CHAT = ['app:assistant', 'app:mametlite', 'app:engineer'];
const KUNCI_CHAT_TERAKHIR = 'mamet_menu_chat_terakhir';   // hanya id aplikasi, bukan isi percakapan
const KREM = '#fff8ec';
const CAHAYA = '0 0 10px rgba(255, 220, 150, 0.55), 0 0 22px rgba(255, 200, 100, 0.25)';

const bacaChatTerakhir = () => {
  // localStorage bisa diblokir (profil terkunci) — diperlakukan "belum ada chat terakhir": "Lanjutkan" sekadar
  // tidak tampil, dan tak ada yang lebih buruk dari itu.
  try { return localStorage.getItem(KUNCI_CHAT_TERAKHIR); } catch { /* diblokir → belum ada */ return null; }
};

const KUNCI_POSISI = 'mamet_menu_posisi';
const TEPI = 16;
// Bawaan: pojok kiri bawah — satu-satunya pojok yang kosong di semua halaman.
const posisiBawaan = () => ({ x: TEPI, y: Math.max(TEPI, window.innerHeight - TEPI - 40) });
const bacaPosisi = () => {
  try {
    const p = JSON.parse(localStorage.getItem(KUNCI_POSISI));
    if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) return p;
  } catch { /* rusak atau diblokir */ }
  return posisiBawaan();
};
const simpanPosisi = (p) => {
  try { localStorage.setItem(KUNCI_POSISI, JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y) })); } catch { /* diblokir */ }
};
/** Jepit posisi ke dalam jendela, memakai ukuran tombol yang sebenarnya bila sudah ada. */
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
      {/* Kursor menu game: tampil pada pilihan aktif, dan saat ditunjuk */}
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

  // ── Tombol MENU yang bisa DIGESER (permintaan Owner 19 Okt) ──────────────────────────────────────────
  // Posisinya disimpan di localStorage — kenyamanan per mesin, bukan data. Selalu dijepit ke dalam layar (juga
  // saat jendela diubah ukurannya), supaya tombol tak pernah hilang di luar jendela.
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
    // Ambang 5px: di bawahnya ini KLIK (membuka menu), bukan geser.
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

  // Lobi: kotak terbuka saat berada di Home, tertutup di halaman lain.
  const ikutiHalaman = (st) => {
    setTerbuka(st.activeAppId === 'app:home');
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
        try { localStorage.setItem(KUNCI_CHAT_TERAKHIR, st.activeAppId); } catch { /* penyimpanan diblokir */ }
      }
    });
  }, [applicationManager, navigationService]);

  // Esc: sub-menu → menu → tutup. Klik di luar kotak (dan di luar tombol MENU) menutupnya.
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
      {/* Tombol MENU — kotak kecil melayang tanpa kolom apa pun (versi jalur 48px dinilai Owner "terlalu panjang
          ke bawah… tidak menyatu dengan temanya"), bisa DIGESER ke mana saja (permintaan Owner). Bertuliskan
          "MENU", bukan ☰ — ☰ tertukar dengan tombol riwayat `≡` di bilah chat. Bawaannya kiri bawah: pojok yang
          kosong di semua halaman. z-50: laci riwayat (z-[60]) menutupinya dengan rapi, tidak ditimpa. */}
      <button
        ref={tombolRef}
        type="button"
        onPointerDown={mulaiGeser}
        onPointerMove={saatGeser}
        onPointerUp={selesaiGeser}
        onPointerCancel={selesaiGeser}
        onClick={() => {
          // Klik sesudah menggeser bukan permintaan membuka menu.
          if (geserRef.current.bergeser) { geserRef.current.bergeser = false; return; }
          setTerbuka((t) => !t);
          setGrupTerbuka(null);
        }}
        title={terbuka ? 'Tutup menu (Esc) — seret untuk memindahkan' : 'Buka menu — seret untuk memindahkan'}
        aria-expanded={terbuka}
        aria-controls="menu-utama"
        className={`fixed z-50 h-10 px-3.5 flex items-center justify-center rounded-lg bg-[#0b0806] border border-[#3a2113] shadow-2xl font-mono uppercase tracking-[0.15em] text-[12px] leading-none cursor-grab active:cursor-grabbing select-none transition-opacity ${terbuka ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
        style={{ left: posisi.x, top: posisi.y, touchAction: 'none', color: KREM, textShadow: terbuka ? CAHAYA : 'none' }}
      >
        Menu
      </button>

      {terbuka && (() => {
        // Arah buka mengikuti posisi tombol: separuh bawah → ke atas, separuh kanan → rata kanan. Tanpa ini kotak
        // terpotong di tepi layar begitu tombolnya digeser.
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
          // Bilah gulir DISEMBUNYIKAN, guliran tetap jalan (roda, touchpad, seret) — bilah putih bawaan Chromium
          // dinilai Owner "tidak nyaman" di kotak gelap ini. Dua aturan karena Chromium punya dua jalur gambar:
          // `scrollbar-width` (standar) dan `::-webkit-scrollbar` (lama).
          className="fixed z-[70] w-max min-w-[12rem] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-[#0b0806] border border-[#3a2113] rounded-lg px-5 py-5 shadow-2xl select-none"
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
