
import { supabase } from '../../supabase';
import { EventBus } from '../runtime/EventBus';

const widgetDataStore = {};

export class WorkspaceManager {
  constructor(appId = 'global', serviceManager) {
    this.appId = appId;
    this.serviceManager = serviceManager;
    this.eventBus = new EventBus();
    this.activeWorkspaceId = null;
    this.activeSessionId = null;

    this.state = {
      layout: {},
      widgets: {},
      capabilities: [],
      memoryContext: null,
      knowledgeContext: null,
      status: 'IDLE'
    };

    this.syncTimeout = null;

    this.openWidgetInWorkbench = this.openWidgetInWorkbench.bind(this);
    this._updateState = this._updateState.bind(this);
    this._notify = this._notify.bind(this);

    this._setupShutdownHook();
  }

  _setupShutdownHook() {
    window.addEventListener('beforeunload', () => {
      if (this.activeWorkspaceId) {
        localStorage.setItem(`mamet_v3_${this.appId}_layout_${this.activeWorkspaceId}`, JSON.stringify(this.state.layout));
        localStorage.setItem(`mamet_v3_${this.appId}_widgets_${this.activeWorkspaceId}`, JSON.stringify(this.state.widgets));
      }
    });
  }

  subscribe(listener) {
    return this.eventBus.on('Workspace:StateChanged', listener);
  }

  _notify() {
    this.eventBus.emit('Workspace:StateChanged', {
      ...this.state,
      workspaceId: this.activeWorkspaceId,
      sessionId: this.activeSessionId
    });
  }

  _updateState(updates) {
    this.state = { ...this.state, ...updates };
    this._notify();
  }

  async _loadManifest(workspaceId) {
    const metadataService = this.serviceManager.get('MetadataService');
    if (!metadataService) {
      console.warn('[WorkspaceManager] MetadataService not available. Falling back to default.');
      return this._getDefaultManifest(workspaceId);
    }

    const config = metadataService.getWorkspaceConfig(workspaceId);
    if (!config) {
      console.warn(`[WorkspaceManager] Workspace ${workspaceId} not found in metadata. Falling back.`);
      return this._getDefaultManifest(workspaceId);
    }

    return {
      id: config.id,
      type: config.id.split('-')[1]?.toUpperCase() || 'GLOBAL',
      name: config.name,
      context: { memory_source: 'USER_MEMORY', knowledge_source: 'PERSONAL_KNOWLEDGE' },
      capabilities: config.capabilities || [],
      default_layout: config.default_layout || { left_workbench: [], right_workbench: [], bottom_workbench: [] },
      permissions: config.permissions || { allow_global_memory: true }
    };
  }

  _getDefaultManifest(workspaceId) {
    return {
      id: workspaceId || 'ws-assistant',
      type: 'ASSISTANT',
      name: 'Mamet OS',
      context: { memory_source: 'USER_MEMORY', knowledge_source: 'PERSONAL_KNOWLEDGE' },
      capabilities: ['cap:web-search', 'cap:automation'],
      default_layout: { left_workbench: [], right_workbench: [], bottom_workbench: [] },
      permissions: { allow_global_memory: true }
    };
  }

  async switchWorkspace(workspaceId) {
    console.log(`[WorkspaceManager] Switching to workspace: ${workspaceId}`);

    if (this.activeWorkspaceId && this.activeSessionId) {
      await this.suspendCurrentSession();
    }

    this._updateState({ status: 'INITIALIZE' });

    const manifest = await this._loadManifest(workspaceId);
    this.activeWorkspaceId = manifest.id;

    this._updateState({
      memoryContext: manifest.context.memory_source,
      knowledgeContext: manifest.context.knowledge_source,
      capabilities: manifest.capabilities,
      status: 'LOADING_MANIFEST'
    });

    this.activeSessionId = `session-${manifest.id}-${Date.now()}`;

    const { data: { user } } = await supabase.auth.getUser();
    let userLayouts = {};
    if (user && user.user_metadata && user.user_metadata.workspace_layouts) {
      userLayouts = user.user_metadata.workspace_layouts;
    }

    const storedLayoutStr = localStorage.getItem(`mamet_v4_${this.appId}_layout_${manifest.id}`);
    const storedWidgetsStr = localStorage.getItem(`mamet_v4_${this.appId}_widgets_${manifest.id}`);

    let rawLayout = userLayouts[`v4_${this.appId}_layout_${manifest.id}`];
    let rawWidgets = userLayouts[`v4_${this.appId}_widgets_${manifest.id}`];

    if (!rawLayout) {
      if (storedLayoutStr) {
        try { rawLayout = JSON.parse(storedLayoutStr); } catch (e) { }
      }
      if (storedWidgetsStr) {
        try { rawWidgets = JSON.parse(storedWidgetsStr); } catch (e) { }
      }
    }

    const layout = this._validateAndSanitizeLayout(rawLayout, manifest.default_layout);
    const widgets = rawWidgets && typeof rawWidgets === 'object' ? rawWidgets : {};

    this._updateState({
      layout,
      widgets,
      status: 'RESTORING_LAYOUT'
    });


    this._updateState({ status: 'READY' });
    console.log(`[WorkspaceManager] Workspace ${manifest.name} is READY.`);
  }

  _validateAndSanitizeLayout(rawLayout, defaultLayout) {
    if (!rawLayout || typeof rawLayout !== 'object') {
      return defaultLayout;
    }

    const sanitized = { ...rawLayout };

    ['left_workbench', 'right_workbench', 'bottom_workbench', 'floating_windows'].forEach(key => {
      if (sanitized[key] && !Array.isArray(sanitized[key])) {
        console.warn(`[WorkspaceManager] Corrupted layout state detected for ${key}. Falling back to default.`);
        sanitized[key] = defaultLayout[key] || [];
      }
    });

    return sanitized;
  }

  async _syncLayoutToSupabase(workspaceId, layout, widgets) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentLayouts = user.user_metadata?.workspace_layouts || {};
      const newLayouts = {
        ...currentLayouts,
        [`v4_${this.appId}_layout_${workspaceId}`]: layout,
        [`v4_${this.appId}_widgets_${workspaceId}`]: widgets
      };

      await supabase.auth.updateUser({
        data: { workspace_layouts: newLayouts }
      });
      console.log(`[WorkspaceManager] Synced layout to Supabase for ${workspaceId}`);
    } catch (e) {
      console.error(`[WorkspaceManager] Failed to sync layout to Supabase`, e);
    }
  }

  _debouncedSyncLayoutToSupabase(workspaceId, layout, widgets) {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => {
      this._syncLayoutToSupabase(workspaceId, layout, widgets);
    }, 2000);
  }

  async suspendCurrentSession() {
    if (!this.activeWorkspaceId) return;
    this._updateState({ status: 'SUSPENDING' });

    localStorage.setItem(`mamet_v4_${this.appId}_layout_${this.activeWorkspaceId}`, JSON.stringify(this.state.layout));
    localStorage.setItem(`mamet_v4_${this.appId}_widgets_${this.activeWorkspaceId}`, JSON.stringify(this.state.widgets));

    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    await this._syncLayoutToSupabase(this.activeWorkspaceId, this.state.layout, this.state.widgets);

    console.log(`[WorkspaceManager] Suspended workspace: ${this.activeWorkspaceId}`);
  }

  updateLayout(workbench, newSize) {
    const newLayout = { ...this.state.layout, [`${workbench}_size`]: newSize };
    this._updateState({ layout: newLayout });
    localStorage.setItem(`mamet_v4_${this.appId}_layout_${this.activeWorkspaceId}`, JSON.stringify(newLayout));

    this._debouncedSyncLayoutToSupabase(this.activeWorkspaceId, newLayout, this.state.widgets);
  }

  moveWidget(widgetId, fromWorkbench, toWorkbench, newIndex) {
    const layout = { ...this.state.layout };

    const fromList = [...(layout[`${fromWorkbench}_workbench`] || [])];
    const toList = fromWorkbench === toWorkbench ? fromList : [...(layout[`${toWorkbench}_workbench`] || [])];

    const currentIndex = fromList.indexOf(widgetId);
    if (currentIndex === -1) return;

    fromList.splice(currentIndex, 1);

    if (newIndex === undefined || newIndex === -1) {
      toList.push(widgetId);
    } else {
      toList.splice(newIndex, 0, widgetId);
    }

    layout[`${fromWorkbench}_workbench`] = fromList;
    if (fromWorkbench !== toWorkbench) {
      layout[`${toWorkbench}_workbench`] = toList;
    }

    this._updateState({ layout });
    localStorage.setItem(`mamet_v4_${this.appId}_layout_${this.activeWorkspaceId}`, JSON.stringify(layout));
    this._debouncedSyncLayoutToSupabase(this.activeWorkspaceId, layout, this.state.widgets);
  }

  closeWidget(widgetId) {
    const layout = { ...this.state.layout };
    let changed = false;

    ['left_workbench', 'right_workbench', 'bottom_workbench'].forEach(key => {
      if (layout[key] && layout[key].includes(widgetId)) {
        layout[key] = layout[key].filter(id => id !== widgetId);
        changed = true;
      }
    });

    if (changed) {
      this._updateState({ layout });
      localStorage.setItem(`mamet_v4_${this.appId}_layout_${this.activeWorkspaceId}`, JSON.stringify(layout));
      this._debouncedSyncLayoutToSupabase(this.activeWorkspaceId, layout, this.state.widgets);
    }
  }

  openWidgetInWorkbench(workbenchPosition, widgetId, widgetData) {
    console.log(`[WorkspaceManager] Opening ${widgetId} in ${workbenchPosition} workbench`);

    const currentLayout = this.state.layout;
    const workbenchKey = `${workbenchPosition}_workbench`;
    const currentWidgets = currentLayout[workbenchKey] || [];

    if (!currentWidgets.includes(widgetId)) {
      const newLayout = {
        ...currentLayout,
        [workbenchKey]: [...currentWidgets, widgetId]
      };
      if (typeof this._updateState === 'function') {
        this._updateState({ layout: newLayout });
      } else if (this.state) {
        this.state.layout = newLayout;
        if (typeof this._notify === 'function') this._notify();
      }
      localStorage.setItem(`mamet_v4_${this.appId}_layout_${this.activeWorkspaceId}`, JSON.stringify(newLayout));
      if (typeof this._debouncedSyncLayoutToSupabase === 'function') {
        this._debouncedSyncLayoutToSupabase(this.activeWorkspaceId, newLayout, this.state?.widgets);
      }
    }

    if (widgetData) {
      this.injectWidgetData(widgetId, widgetData);
    }
  }

  injectWidgetData(widgetId, widgetData) {
    if (!widgetData) return;

    widgetDataStore[widgetId] = widgetData;

    if (this.serviceManager && this.serviceManager.has('EventBus')) {
      const eventBus = this.serviceManager.get('EventBus');
      setTimeout(() => {
        eventBus.emit('Widget:DataInjected', {
          source: 'WorkspaceManager',
          widgetId,
          data: widgetData
        });
      }, 100);
    }
  }

  getWidgetData(widgetId) {
    return widgetDataStore[widgetId] || null;
  }
}
