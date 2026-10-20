import React, { useEffect, useState } from 'react';
import { useService } from '../../core/runtime/hooks/useService';
import Ikon from '../Ikon';

/**
 * OS Sidebar — laci navigasi SELULER.
 *
 * Laci overlay dari kiri, disembunyikan saat tertutup; dikontrol via props isOpen & onClose dari OSDesktopShell.
 * Desktop memakai menu teks (MenuTeks.jsx, Item 127 K2). Cabang desktop berkas ini — bilah ikon w-16 — tidak
 * terpakai sejak itu dan dihapus atas keputusan Owner 20 Okt.
 */
export default function Sidebar({ isOpen = false, onClose }) {
  const applicationManager = useService('ApplicationManager');
  const navigationService = useService('NavigationService');

  const [appState, setAppState] = useState({ apps: [], activeAppId: null });
  const [navTree, setNavTree] = useState([]);

  // Sync state saat service tersedia
  useEffect(() => {
    if (applicationManager) {
      setAppState(applicationManager.getState());
    }
  }, [applicationManager]);

  useEffect(() => {
    if (navigationService) {
      setNavTree(navigationService.getTree() || []);
    }
  }, [navigationService]);

  useEffect(() => {
    if (!applicationManager) return;
    const unsub = applicationManager.subscribe((payload) => {
      setAppState(payload?.data || payload);
      if (navigationService) setNavTree(navigationService.getTree());
    });
    return () => unsub();
  }, [applicationManager, navigationService]);

  const activate = (id) => {
    if (appState.apps.find(a => a.id === id)) {
      applicationManager.activateApp(id);
    }
    // Tutup laci setelah navigasi
    if (onClose) onClose();
  };

  const isActive = (id) => appState.activeAppId === id;

  const renderNavNode = (node, idx) => {
    if (node.type === 'separator') return null;
    if (node.type === 'spacer') return <div key={`spacer-${idx}`} className="mt-auto" />;

    if (node.type === 'item' || node.appId) {
      const app = node.app;
      if (!app || app.id === 'app:settings') return null;
      const active = isActive(app.id);

      return (
        <a
          key={app.id}
          href="#"
          onClick={(e) => { e.preventDefault(); activate(app.id); }}
          title={app.name}
          className={`flex items-center gap-3 rounded-xl transition-all duration-200 relative group px-4 py-3 mx-2 ${active
            ? 'bg-secondary-container text-on-secondary-container'
            : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
          }`}
        >
          <span
            className={`material-symbols-outlined shrink-0 ${active ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'}`}
            style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0", fontSize: '22px' }}
          >
            {app.icon || 'apps'}
          </span>
          <span className={`text-sm font-medium ${active ? 'text-on-secondary-container' : 'text-on-surface-variant group-hover:text-on-surface'}`}>
            {app.name}
          </span>
        </a>
      );
    }

    if (node.type === 'group') {
      return (
        <div key={`group-${node.name}`} className="mb-2">
          {node.name && (
            <p className="px-6 py-1 text-[12px] font-semibold text-on-surface-variant/60 uppercase tracking-widest">
              {node.name}
            </p>
          )}
          {node.items.map((subItem, sIdx) => renderNavNode(subItem, `${idx}-${sIdx}`))}
        </div>
      );
    }
    return null;
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen w-72 flex flex-col bg-surface-container-low border-r border-outline-variant z-40 transition-transform duration-300 ease-in-out shadow-2xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* Header laci */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-outline-variant/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">Mamet OS</p>
            <p className="text-[12px] text-on-surface-variant">MAEF Engine</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors"
          title="Tutup"
        >
          <Ikon nama="close" ukuran={18} />
        </button>
      </div>

      {/* Daftar navigasi */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 custom-scrollbar">
        {navTree.map((node, idx) => renderNavNode(node, idx))}
        {/* Settings di dalam laci */}
        <div className="mx-2 mt-2">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); activate('app:settings'); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group
              ${isActive('app:settings')
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
              }`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ fontVariationSettings: isActive('app:settings') ? "'FILL' 1" : "'FILL' 0" }}
            >
              settings
            </span>
            <span className="text-sm font-medium">Settings</span>
          </a>
        </div>
      </nav>
    </aside>
  );
}
