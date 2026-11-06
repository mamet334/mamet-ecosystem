import { useState, useEffect } from 'react';
import { kernel } from '../Kernel';
import { serviceManager } from '../ServiceManager';

export function useService(name) {
  const [service, setService] = useState(() => {
    if (kernel.status === 'RUNNING' && serviceManager.has(name)) {
      return serviceManager.get(name);
    }
    return null;
  });

  useEffect(() => {
    if (service) return;

    if (kernel.status === 'RUNNING' && serviceManager.has(name)) {
      setService(serviceManager.get(name));
      return;
    }

    let unsubscribe = null;
    const tryGet = () => {
      if (serviceManager.has(name)) {
        setService(serviceManager.get(name));
      }
    };

    const listenOnEventBus = () => {
      try {
        if (serviceManager.has('EventBus')) {
          const eventBus = serviceManager.get('EventBus');
          unsubscribe = eventBus.on('Kernel:BootComplete', tryGet);
          tryGet();
        }
      } catch (e) {
        setTimeout(tryGet, 500);
      }
    };

    listenOnEventBus();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [name, service]);

  return service;
}
