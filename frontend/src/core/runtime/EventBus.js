export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.active = true;
    this.totalEvents = 0;
    this.rateLimits = new Map();
    setInterval(() => {
      this.rateLimits.clear();
    }, 1000);
  }

  activate() {
    this.active = true;
  }

  getTotalEvents() {
    return this.totalEvents;
  }


  on(event, callback) {
    if (typeof event !== 'string') throw new Error('Event name must be a string');
    if (event === '*') {
      console.warn('[EventBus] Security Warning: Wildcard listeners are disabled.');
      return () => {};
    }
    if (!event.includes(':')) {
      throw new Error('Event name must include a namespace separated by a colon (e.g. "Category:EventName")');
    }
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, payload) {
    if (typeof event !== 'string') throw new Error('Event name must be a string');
    if (!event.includes(':')) {
      throw new Error('Event name must include a namespace separated by a colon (e.g. "Category:EventName")');
    }

    const namespace = event.split(':')[0];
    
    const currentCount = this.rateLimits.get(namespace) || 0;
    if (currentCount >= 100) {
      console.warn(`[EventBus] Rate limit exceeded for namespace: ${namespace}`);
      return false;
    }
    this.rateLimits.set(namespace, currentCount + 1);

    this.totalEvents++;

    let sourceFile = 'Unknown';
    try {
      const stack = new Error().stack;
      if (stack) {
        const callerLine = stack.split('\n')[2] || '';
        const match = callerLine.match(/([^/]+)\.jsx?/);
        if (match) sourceFile = match[0];
      }
    } catch (e) {}

    const wrappedPayload = {
      source: sourceFile,
      timestamp: Date.now(),
      data: payload
    };


    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(wrappedPayload);
        } catch (e) {
          console.error(`[EventBus] Error in listener for event ${event}:`, e);
        }
      }
    }
    return true;
  }
}
