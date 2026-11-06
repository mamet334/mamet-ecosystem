import React, { useEffect, useState } from 'react';
import { useService } from '../../core/runtime/hooks/useService';

export default function ApplicationContainer({ isMobile }) {
  const applicationManager = useService('ApplicationManager');
  const [appState, setAppState] = useState({ apps: [], activeAppId: null });

  useEffect(() => {
    if (applicationManager) setAppState(applicationManager.getState());
  }, [applicationManager]);

  useEffect(() => {
    if (!applicationManager) return;
    return applicationManager.subscribe((payload) => setAppState(payload?.data || payload));
  }, [applicationManager]);

  return (
    <main className="flex-1 h-full overflow-hidden relative custom-scrollbar">
      {appState.apps.map(app => {
        const isActive = appState.activeAppId === app.id;
        const Component = app.renderComponent;
        
        return (
          <div 
            key={app.id} 
            className={`absolute inset-0 ${isActive ? 'flex' : 'hidden'} flex-col h-full w-full ${isMobile ? 'pb-20' : ''}`}
          >
            <React.Suspense fallback={<div className="flex h-full w-full items-center justify-center text-primary text-[12px] font-label-mono uppercase tracking-widest">Loading OS Module...</div>}>
              <Component />
            </React.Suspense>
          </div>
        );
      })}
    </main>
  );
}