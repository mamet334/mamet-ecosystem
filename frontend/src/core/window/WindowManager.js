export class WindowManager {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.state = {
      floatingWindows: new Map(),
      splitPanes: new Map(),
      activeFocus: null
    };
  }


  spawnFloatingWindow(config) {
    const windowId = `win_${Date.now()}`;
    const windowDef = {
      id: windowId,
      title: config.title || 'Window',
      component: config.component,
      position: config.position || { x: 100, y: 100 },
      size: config.size || { width: 400, height: 300 },
      isMinimized: false,
      isMaximized: false,
      zIndex: this.state.floatingWindows.size + 100
    };

    this.state.floatingWindows.set(windowId, windowDef);
    this._notify();
    console.log(`[WindowManager] Spawned floating window: ${windowId}`);
    return windowId;
  }

  closeFloatingWindow(windowId) {
    if (this.state.floatingWindows.has(windowId)) {
      this.state.floatingWindows.delete(windowId);
      this._notify();
    }
  }

  createSplitPane(direction, children) {
    const paneId = `split_${Date.now()}`;
    this.state.splitPanes.set(paneId, { direction, children });
    return paneId;
  }

  subscribe(listener) {
    return this.eventBus.on('Window:StateChanged', listener);
  }

  _notify() {
    this.eventBus.emit('Window:StateChanged', {
      floatingWindows: Array.from(this.state.floatingWindows.values()),
      splitPanes: Array.from(this.state.splitPanes.values())
    });
  }
}
