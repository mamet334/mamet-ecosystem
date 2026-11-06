export class DiscoveryManager {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.platform = 'unknown';
    this.device = 'unknown';
    this.capabilities = [];
    this.network = { online: false, type: 'unknown' };
    this.screen = { width: 0, height: 0, pixelRatio: 1, orientation: 'unknown' };
    this.storage = { quota: 0, usage: 0, percentage: 0 };
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    console.log('[DiscoveryManager] Initializing...');
    
    this.platform = this.detectPlatform();
    this.device = this.detectDevice();
    this.capabilities = this.detectCapabilities();
    this.network = this.getNetworkStatus();
    this.screen = this.getScreenInfo();
    
    this._initializeStorageAsync();

    console.log('[DiscoveryManager] Platform:', this.platform);
    console.log('[DiscoveryManager] Device:', this.device);
    console.log('[DiscoveryManager] Capabilities:', this.capabilities);

    this.isInitialized = true;
    this.eventBus.emit('Discovery:Ready', { 
      platform: this.platform, 
      device: this.device, 
      capabilities: this.capabilities,
      timestamp: Date.now() 
    });
  }

  async _initializeStorageAsync() {
    this.storage = await this.getStorageEstimate();
    if (this.eventBus) {
      this.eventBus.emit('Discovery:StorageReady', { storage: this.storage });
    }
  }

  detectPlatform() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return 'desktop';
    }
    
    if (typeof process !== 'undefined' && process.versions?.electron) {
      return 'desktop';
    }
    
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
      return 'mobile';
    }
    return 'web';
  }

  detectDevice() {
    const userAgent = navigator.userAgent;
    
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    }
    
    if (/mobile|android|iphone|ipod/i.test(userAgent)) {
      return 'phone';
    }
    
    if (/windows|macintosh|linux/i.test(userAgent)) {
      return 'desktop';
    }
    
    return 'unknown';
  }

  detectCapabilities() {
    const capabilities = [];
    
    if ('showOpenFilePicker' in window || 'webkitdirectory' in document.createElement('input')) {
      capabilities.push('file-system');
    }
    
    if (navigator.clipboard && navigator.clipboard.readText) {
      capabilities.push('clipboard');
    }
    
    if ('Notification' in window) {
      capabilities.push('notification');
    }
    
    if ('geolocation' in navigator) {
      capabilities.push('geolocation');
    }
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      capabilities.push('camera');
      capabilities.push('microphone');
    }
    
    if ('bluetooth' in navigator) {
      capabilities.push('bluetooth');
    }
    
    if ('usb' in navigator) {
      capabilities.push('usb');
    }
    
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      capabilities.push('local-storage');
    } catch (e) {}
    
    if ('indexedDB' in window) {
      capabilities.push('indexeddb');
    }
    
    if ('serviceWorker' in navigator) {
      capabilities.push('service-worker');
    }
    
    if ('Worker' in window) {
      capabilities.push('web-worker');
    }
    
    if ('WebSocket' in window) {
      capabilities.push('websocket');
    }
    
    return capabilities;
  }

  getNetworkStatus() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    return {
      online: navigator.onLine,
      type: connection ? (connection.effectiveType || 'unknown') : 'unknown',
      downlink: connection ? connection.downlink : null,
      rtt: connection ? connection.rtt : null
    };
  }

  getScreenInfo() {
    return {
      width: window.screen.width,
      height: window.screen.height,
      pixelRatio: window.devicePixelRatio || 1,
      orientation: screen.orientation ? screen.orientation.type : 'unknown',
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight
    };
  }

  async getStorageEstimate() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          quota: estimate.quota || 0,
          usage: estimate.usage || 0,
          percentage: estimate.quota ? ((estimate.usage / estimate.quota) * 100).toFixed(2) : 0
        };
      } catch (e) {
        console.warn('[DiscoveryManager] Failed to get storage estimate:', e);
      }
    }
    
    return { quota: 0, usage: 0, percentage: 0 };
  }

  isFeatureAvailable(featureName) {
    return this.capabilities.includes(featureName);
  }

  getDiscoveryInfo() {
    return {
      platform: this.platform,
      device: this.device,
      capabilities: this.capabilities,
      network: this.network,
      screen: this.screen,
      storage: this.storage,
      initialized: this.isInitialized
    };
  }
}
