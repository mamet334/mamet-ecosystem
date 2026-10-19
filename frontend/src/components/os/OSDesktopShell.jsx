import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import MenuTeks from './MenuTeks';
import LatarRuangan from './LatarRuangan';
import ApplicationContainer from './ApplicationContainer';
import MobileBottomNav from './MobileBottomNav';
import SystemNotificationCenter from './SystemNotificationCenter'; // ✅ 1. Tambahkan Import Ini!

export default function OSDesktopShell() {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background text-on-surface font-body-base selection:bg-primary/30">
      {/* Latar terdalam = dinding ruangan LampLogin (Item 127 Tahap 3). Dilukis lebih dulu; isi di bawah ini `relative`
          tanpa z-index, jadi ia tergambar di atas dinding TANPA membuat konteks tumpukan baru — laci chat (z-[60])
          tetap bisa menutupi tombol MENU (z-50) seperti sebelumnya. */}
      <LatarRuangan />
      
      {/* ✅ 2. Tempatkan Komponen <SystemNotificationCenter /> DI SINI (Paling atas sebelum Sidebar) */}
      <SystemNotificationCenter />

      {/* Desktop: menu teks bergaya menu game (Item 127 K2 — percobaan). Seluler tetap laci Sidebar. */}
      {isMobile
        ? <Sidebar isMobile={isMobile} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        : <MenuTeks />}

      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ✅ UBAH: Kirim prop isMobile ke ApplicationContainer */}
      {/* `ml-16` dulu memberi ruang bilah ikon yang `fixed`; MenuTeks ada di dalam alur, jadi tak perlu. */}
      <div className={`relative flex flex-col flex-1 min-w-0 overflow-hidden ${isMobile ? 'pb-16' : ''}`}>
        <ApplicationContainer isMobile={isMobile} />
      </div>

      {isMobile && (
        <MobileBottomNav onMenuOpen={() => setSidebarOpen(true)} />
      )}
    </div>
  );
}