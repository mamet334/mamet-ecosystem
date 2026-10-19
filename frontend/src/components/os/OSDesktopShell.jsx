import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import MenuTeks from './MenuTeks';
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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-surface font-body-base selection:bg-primary/30">
      
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
      <div className={`flex flex-col flex-1 min-w-0 overflow-hidden ${isMobile ? 'pb-16' : ''}`}>
        <ApplicationContainer isMobile={isMobile} />
      </div>

      {isMobile && (
        <MobileBottomNav onMenuOpen={() => setSidebarOpen(true)} />
      )}
    </div>
  );
}