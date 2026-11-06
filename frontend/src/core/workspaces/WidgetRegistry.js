import { lazyLoadWithRetry } from './lazyLoadWithRetry';

class WidgetRegistry {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.widgets = new Map();
  }

  register(metadata) {
    if (!metadata.id) {
      throw new Error("Widget registration failed: 'id' is required.");
    }
    if (this.widgets.has(metadata.id)) {
      console.warn(`WidgetRegistry: Overwriting existing widget [${metadata.id}]`);
    }
    
    this.widgets.set(metadata.id, {
      ...metadata,
      registeredAt: Date.now()
    });

    console.debug(`[WidgetRegistry] Registered widget: ${metadata.id}`);
  }

  unregister(id) {
    this.widgets.delete(id);
  }

  getWidget(id) {
    return this.widgets.get(id) || null;
  }

  getWidgetsForWorkspace(workspaceType) {
    const allowed = [];
    for (const [id, widget] of this.widgets.entries()) {
      if (widget.allowed_workspaces.includes(workspaceType) || widget.allowed_workspaces.includes('*')) {
        allowed.push(widget);
      }
    }
    return allowed;
  }
}

console.log("[LIFECYCLE] Widget registry ready");
export { WidgetRegistry };
