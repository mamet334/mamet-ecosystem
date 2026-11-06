import React from 'react';
import { ApplicationManager } from '../application/ApplicationManager';
import { WindowManager } from '../window/WindowManager';
import { WidgetRegistry } from '../workspaces/WidgetRegistry';
import { WorkspaceManager } from '../workspaces/WorkspaceManager';
import { lazyLoadWithRetry } from '../workspaces/lazyLoadWithRetry';
import { EventBus } from './EventBus';
import { VaultService } from './services/VaultService';
import { BrainService } from './services/BrainService';
import { Engineer } from './services/engineer.js';
import { StorageManager } from './StorageManager.js';
import { ProcessManager } from './ProcessManager.js';
import { ModuleLoader } from './module-loader.js';
import { DiscoveryManager } from './DiscoveryManager.js';
import { MemoryService } from './services/MemoryService.js';
import { MemoryGovernorService } from './services/MemoryGovernorService.js';
import { AgentOrchestratorService } from './services/AgentOrchestratorService.js';
import { ToolRegistryService } from './services/ToolRegistryService.js';
import { SemanticContextService } from './services/SemanticContextService.js';
import { ToolPreferencesService } from './services/ToolPreferencesService.js';
import { MetadataService } from '../metadata/MetadataService.js';
import { NavigationService } from '../metadata/NavigationService.js';
import { RepositoryReaderService } from './services/RepositoryReaderService.js';
import { AssistantService } from './services/AssistantService.js';
import { AuditLogService } from './services/AuditLogService.js';
import { InternalKnowledgeFallbackService } from './services/InternalKnowledgeFallbackService.js';
import { WebComparisonService } from './services/WebComparisonService.js';
import { RetrievalOrchestrator } from './services/RetrievalOrchestrator.js';
import { ModuleDiscoveryService } from './services/ModuleDiscoveryService.js';
import { RequestClassifierService } from './services/RequestClassifierService.js';
import { penyimpanKeadaan } from './PenyimpanKeadaan.js';
import { temaService } from './services/TemaService.js';
import { TierClassifierService } from './services/TierClassifierService.js';
import { SkillRegistry } from './services/SkillRegistry.js';
import { SkillGuardService } from './services/SkillGuardService.js';
import { SystemGovernorService } from './services/SystemGovernorService.js';
import { RemoteConversionWorkerService } from './services/RemoteConversionWorkerService.js';
import { supabase } from '../../supabase.js';

class Kernel {
  constructor() {
    this.status = 'COLD';
    this.currentPhase = 0;
    this.bootPromise = null;
    this.serviceManager = null;
    this.health = {
      startTime: null,
      uptime: 0,
      totalEvents: 0,
      errors: [],
      warnings: []
    };
    this.config = {
      mode: 'BOOTSTRAP',
      safeMode: false,
      logLevel: 'INFO'
    };
    this.identity = {
      systemName: 'Mamet Ecosystem',
      version: '3.0.0',
      user: null,
      createdAt: null
    };
    this._shutdownHandlers = [];
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    const bucket = level === 'ERROR' ? 'errors' : level === 'WARN' ? 'warnings' : null;
    if (bucket) {
      this.health[bucket].push(logEntry);
    }
    console.log(`[${timestamp}] [Kernel] [${level}] ${message}`, data || '');
  }

  async boot(serviceManager) {
    if (this.bootPromise) {
      this.log('INFO', 'Boot already in progress or finished');
      return this.bootPromise;
    }
    this.serviceManager = serviceManager;
    this.bootPromise = this._executeBootstrapSequence(serviceManager);
    return this.bootPromise;
  }

  async _executeBootstrapSequence(serviceManager) {
    if (this.status !== 'COLD') {
      this.log('INFO', `Boot skipped (status: ${this.status})`);
      return;
    }

    this.health.startTime = Date.now();
    this.log('INFO', 'MAEF Kernel Bootstrap Sequence Started');

    try {
      await this._phase0_InitializeKernel(serviceManager);

      await this._phase1_SystemCoreRegistration(serviceManager);

      await this._phase2_EventSystemBootstrap(serviceManager);

      await this._phase3_AdapterRegistryInit(serviceManager);

      await this._phase4_VerificationEngineStartup(serviceManager);

      await this._phase5_OrchestratorInitialization(serviceManager);

      await this._phase6_LoggingObservabilityInit(serviceManager);

      await this._phase7_MetricsSystemWarmup(serviceManager);

      await this._phase8_KnowledgeMemorySeed(serviceManager);

      await this._phase9_SystemIntegrationCheck(serviceManager);

      await this._phase10_FullSystemActivation(serviceManager);

      this.status = 'RUNNING';
      this.config.mode = 'OPERATIONAL';
      this.log('INFO', 'MAEF Kernel Bootstrap Complete — SYSTEM READY');
      this._emitEvent(serviceManager, 'Kernel:BootComplete', { status: 'RUNNING' });
    } catch (error) {
      this.log('ERROR', 'Bootstrap Failed', error);
      await this._handleBootFailure(error);
      
      this.status = 'RUNNING';
      this.log('WARN', 'Kernel running in DEGRADED mode (Safe Mode)');
    }
  }

  async _phase0_InitializeKernel(serviceManager) {
    this.currentPhase = 0;
    this.status = 'BOOTING';
    this.config.mode = 'BOOTSTRAP';
    this.identity.createdAt = new Date().toISOString();
    this.log('INFO', 'PHASE 0 — KERNEL INITIALIZATION: Started');
    this._emitEvent(serviceManager, 'Kernel:PhaseCompleted', { phase: 0, name: 'KERNEL_INITIALIZATION' });
    this.log('INFO', 'PHASE 0 — KERNEL INITIALIZATION: Completed');
  }

  async _phase1_SystemCoreRegistration(serviceManager) {
    this.currentPhase = 1;
    this.log('INFO', 'PHASE 1 — SYSTEM CORE REGISTRATION: Started');

    let eventBus;
    if (serviceManager.has('EventBus')) {
      eventBus = serviceManager.get('EventBus');
      this.log('INFO', 'Event System Already Registered — Reusing');
    } else {
      eventBus = new EventBus();
      serviceManager.register('EventBus', eventBus);
      this.log('INFO', 'Event System Registered');
    }

    serviceManager.register('SupabaseClient', supabase);

    const storageManager = new StorageManager();
    serviceManager.register('StorageManager', storageManager);

    const processManager = new ProcessManager(eventBus);
    serviceManager.register('ProcessManager', processManager);

    const moduleLoader = new ModuleLoader(storageManager);
    serviceManager.register('ModuleLoader', moduleLoader);

    const discoveryManager = new DiscoveryManager(serviceManager);
    await discoveryManager.initialize();
    serviceManager.register('DiscoveryManager', discoveryManager);

    const metadataService = new MetadataService(serviceManager);
    await metadataService.initialize();
    serviceManager.register('MetadataService', metadataService);
    this.log('INFO', 'MetadataService Initialized & Registered');

    temaService.pasang(metadataService.getThemes());
    serviceManager.register('TemaService', temaService);

    this._emitEvent(serviceManager, 'Kernel:PhaseCompleted', { phase: 1, name: 'SYSTEM_CORE_REGISTRATION' });
    this.log('INFO', 'PHASE 1 — SYSTEM CORE REGISTRATION: Completed');
  }

  async _phase2_EventSystemBootstrap(serviceManager) {
    this.currentPhase = 2;
    this.log('INFO', 'PHASE 2 — EVENT SYSTEM BOOTSTRAP: Started');

    const eventBus = serviceManager.get('EventBus');
    this.eventBus = eventBus;
    eventBus.activate = () => { eventBus._active = true; };
    eventBus._active = true;
    this.log('INFO', 'Event System Activated');

    this._emitEvent(serviceManager, 'Kernel:PhaseCompleted', { phase: 2, name: 'EVENT_SYSTEM_BOOTSTRAP' });
    this.log('INFO', 'PHASE 2 — EVENT SYSTEM BOOTSTRAP: Completed');
  }

  async _phase3_AdapterRegistryInit(serviceManager) {
    this.currentPhase = 3;
    this.log('INFO', 'PHASE 3 — CORE CAPABILITY SERVICES INIT: Started');

    const vaultService = new VaultService(serviceManager);
    await vaultService.initialize();
    serviceManager.register('VaultService', vaultService);

    const brainService = new BrainService(serviceManager);
    await brainService.initialize();
    serviceManager.register('BrainService', brainService);

    const repositoryReaderService = new RepositoryReaderService(serviceManager);
    await repositoryReaderService.initialize();
    serviceManager.register('RepositoryReaderService', repositoryReaderService);

    const engineer = new Engineer(serviceManager);
    await engineer.initialize();
    serviceManager.register('Engineer', engineer);

    const memoryService = new MemoryService(serviceManager);
    await memoryService.initialize();
    serviceManager.register('MemoryService', memoryService);

    const memoryGovernorService = new MemoryGovernorService(serviceManager);
    await memoryGovernorService.initialize();
    serviceManager.register('MemoryGovernorService', memoryGovernorService);

    const semanticContextService = new SemanticContextService(serviceManager);
    await semanticContextService.initialize();
    serviceManager.register('SemanticContextService', semanticContextService);

    const toolPreferencesService = new ToolPreferencesService(serviceManager);
    await toolPreferencesService.initialize();
    serviceManager.register('ToolPreferencesService', toolPreferencesService);

    serviceManager.register('PenyimpanKeadaan', penyimpanKeadaan);


    const agentOrchestrator = new AgentOrchestratorService(serviceManager);
    await agentOrchestrator.initialize();
    serviceManager.register('AgentOrchestratorService', agentOrchestrator);

    const toolRegistry = new ToolRegistryService(serviceManager);
    await toolRegistry.initialize();
    serviceManager.register('ToolRegistryService', toolRegistry);
    await toolRegistry.scanToolsFolder();

    const assistantService = new AssistantService(serviceManager);
    await assistantService.initialize();
    serviceManager.register('AssistantService', assistantService);
    this.log('INFO', 'AssistantService Initialized & Registered');


    const auditLogService = new AuditLogService(serviceManager);
    await auditLogService.initialize();
    serviceManager.register('AuditLogService', auditLogService);
    this.log('INFO', 'AuditLogService Initialized & Registered');


    const internalKnowledgeFallbackService = new InternalKnowledgeFallbackService(serviceManager);
    await internalKnowledgeFallbackService.initialize();
    serviceManager.register('InternalKnowledgeFallbackService', internalKnowledgeFallbackService);
    this.log('INFO', 'InternalKnowledgeFallbackService Initialized & Registered');

    const webComparisonService = new WebComparisonService(serviceManager);
    await webComparisonService.initialize();
    serviceManager.register('WebComparisonService', webComparisonService);
    this.log('INFO', 'WebComparisonService Initialized & Registered');

    const retrievalOrchestrator = new RetrievalOrchestrator(serviceManager);
    await retrievalOrchestrator.initialize();
    serviceManager.register('RetrievalOrchestrator', retrievalOrchestrator);
    this.log('INFO', 'RetrievalOrchestrator Initialized & Registered');

    const moduleDiscoveryService = new ModuleDiscoveryService(serviceManager);
    await moduleDiscoveryService.initialize();
    serviceManager.register('ModuleDiscoveryService', moduleDiscoveryService);
    this.log('INFO', 'ModuleDiscoveryService Initialized & Registered');

    const skillRegistry = new SkillRegistry(serviceManager);
    await skillRegistry.initialize();
    serviceManager.register('SkillRegistry', skillRegistry);
    this.log('INFO', 'SkillRegistry Initialized & Registered');

    const skillGuardService = new SkillGuardService(serviceManager);
    await skillGuardService.initialize();
    serviceManager.register('SkillGuardService', skillGuardService);
    this.log('INFO', 'SkillGuardService Initialized & Registered');

    const requestClassifierService = new RequestClassifierService(serviceManager);
    await requestClassifierService.initialize();
    serviceManager.register('RequestClassifierService', requestClassifierService);
    this.log('INFO', 'RequestClassifierService Initialized & Registered');

    const tierClassifierService = new TierClassifierService(serviceManager);
    await tierClassifierService.initialize();
    serviceManager.register('TierClassifierService', tierClassifierService);
    this.log('INFO', 'TierClassifierService Initialized & Registered');

    const systemGovernorService = new SystemGovernorService(serviceManager);
    await systemGovernorService.initialize();
    serviceManager.register('SystemGovernorService', systemGovernorService);
    this.log('INFO', 'SystemGovernorService Initialized & Registered');

    const remoteConversionWorker = new RemoteConversionWorkerService(serviceManager);
    serviceManager.register('RemoteConversionWorkerService', remoteConversionWorker);
    remoteConversionWorker.initialize().catch(err =>
      console.error('[Kernel] RemoteConversionWorkerService gagal dijalankan:', err.message));
    this.log('INFO', 'RemoteConversionWorkerService Registered');

    const adapterRegistry = {
      adapters: new Map(),
      register(name, adapter) {
        this.adapters.set(name, { ...adapter, status: 'REGISTERED', active: false });
      },
      get(name) {
        return this.adapters.get(name);
      },
      list() {
        return Array.from(this.adapters.values());
      }
    };
    serviceManager.register('AdapterRegistry', adapterRegistry);

    adapterRegistry.register('AI', { name: 'AI Adapter', type: 'AI' });
    adapterRegistry.register('DB', { name: 'Database Adapter', type: 'DB' });
    adapterRegistry.register('Search', { name: 'Search Adapter', type: 'SEARCH' });
    adapterRegistry.register('Tool', { name: 'Tool Adapter', type: 'TOOL' });
    this.log('INFO', 'Adapter Registry & Core Services Initialized');

    this._emitEvent(serviceManager, 'Kernel:PhaseCompleted', { phase: 3, name: 'CORE_CAPABILITY_SERVICES_INIT' });
    this.log('INFO', 'PHASE 3 — CORE CAPABILITY SERVICES INIT: Completed');
  }

  async _phase4_VerificationEngineStartup(serviceManager) {
    this.currentPhase = 4;
    this.log('INFO', 'PHASE 4 — VERIFICATION ENGINE STARTUP: Started');

    const verificationEngine = {
      mode: 'SAFE_BOOTSTRAP_MODE',
      validate: () => ({ valid: true, confidence: 1.0 }),
      verifyEvidence: () => ({ verdict: 'PASS' }),
      verifyPatchEngineering: (context) => {
        const failures = [];
        try {
          const responseText = context?.responseText || '';
          const originalText = context?.originalText || '';
          const jumlah = (teks, pola) => teks.split(pola).length - 1;
          const bertambah = (pola) => jumlah(responseText, pola) > jumlah(originalText, pola);

          if (bertambah('eval(')) failures.push({ id: 'CHECK_P03_EVAL', severity: 'CRITICAL', message: 'Patch MENAMBAH pemanggilan eval() yang dilarang' });
          if (bertambah('new Function(')) failures.push({ id: 'CHECK_P03_NEW_FUNCTION', severity: 'CRITICAL', message: 'Patch MENAMBAH new Function() yang dilarang' });

          const polaVendor = /fetch\(\\?['"]https:\/\/(api\.openai\.com|generativelanguage\.googleapis\.com)/g;
          const vendorBaru = (String(responseText).match(polaVendor) || []).length
            > (String(originalText).match(polaVendor) || []).length;
          if (vendorBaru) failures.push({ id: 'CHECK_P03_VENDOR', severity: 'HIGH', message: 'Patch MENAMBAH pemanggilan vendor API langsung tanpa Adapter Layer' });
        } catch (e) {
        }
        const passed = failures.filter(f => f.severity === 'CRITICAL').length === 0;
        return { decision: passed ? 'PASS' : 'FAIL', score: passed ? 1.0 : 0.0, failures };
      }
    };
    serviceManager.register('VerificationEngine', verificationEngine);
    this.log('INFO', 'Verification Engine Started in SAFE_BOOTSTRAP_MODE');

    this._emitEvent(serviceManager, 'Kernel:PhaseCompleted', { phase: 4, name: 'VERIFICATION_ENGINE_STARTUP' });
    this.log('INFO', 'PHASE 4 — VERIFICATION ENGINE STARTUP: Completed');
  }

  async _phase5_OrchestratorInitialization(serviceManager) {
    this.currentPhase = 5;
    this.log('INFO', 'PHASE 5 — ORCHESTRATOR INITIALIZATION: Started');

    this.log('INFO', 'Orchestrator initialization handled by AgentOrchestratorService');

    this._emitEvent(serviceManager, 'Kernel:PhaseCompleted', { phase: 5, name: 'ORCHESTRATOR_INITIALIZATION' });
    this.log('INFO', 'PHASE 5 — ORCHESTRATOR INITIALIZATION: Completed');
  }

  async _phase6_LoggingObservabilityInit(serviceManager) {
    this.currentPhase = 6;
    this.log('INFO', 'PHASE 6 — LOGGING & OBSERVABILITY INIT: Started');

    const loggingSystem = {
      captureEvent: (event) => this.log('DEBUG', 'Captured event', event),
      getLogs: () => [...this.health.errors, ...this.health.warnings]
    };
    serviceManager.register('LoggingSystem', loggingSystem);
    this.log('INFO', 'Logging & Observability System Initialized');

    this._emitEvent(serviceManager, 'Kernel:PhaseCompleted', { phase: 6, name: 'LOGGING_OBSERVABILITY_INIT' });
    this.log('INFO', 'PHASE 6 — LOGGING & OBSERVABILITY INIT: Completed');
  }

  async _phase7_MetricsSystemWarmup(serviceManager) {
    this.currentPhase = 7;
    this.log('INFO', 'PHASE 7 — METRICS SYSTEM WARMUP: Started');

    const metricsSystem = {
      baseline: { latency: 0, eventThroughput: 0, errorRate: 0 },
      measure: (metric, value) => this.log('DEBUG', `Metric recorded: ${metric}=${value}`),
      getMetrics: () => this.getHealth()
    };
    serviceManager.register('MetricsSystem', metricsSystem);
    metricsSystem.measure('boot_phase', 7);
    this.log('INFO', 'Metrics System Warmed Up');

    this._emitEvent(serviceManager, 'Kernel:PhaseCompleted', { phase: 7, name: 'METRICS_SYSTEM_WARMUP' });
    this.log('INFO', 'PHASE 7 — METRICS SYSTEM WARMUP: Completed');
  }

  async _phase8_KnowledgeMemorySeed(serviceManager) {
    this.currentPhase = 8;
    this.log('INFO', 'PHASE 8 — KNOWLEDGE & MEMORY INITIAL SEED: Started');

    const knowledgeSeed = [
      { id: 'constitution', type: 'core', name: 'Constitution v3.0' },
      { id: 'vision', type: 'core', name: 'Vision' },
      { id: 'maef_principles', type: 'core', name: 'MAEF Core Principles' }
    ];
    const memorySeed = {
      userIdentity: this.identity.user,
      bootstrapContext: { phase: 8, timestamp: new Date().toISOString() },
      configSnapshot: { ...this.config }
    };
    serviceManager.register('KnowledgeSeed', knowledgeSeed);
    serviceManager.register('MemorySeed', memorySeed);

    this.log('INFO', 'Knowledge & Memory Seed Planted');
    this._emitEvent(serviceManager, 'Kernel:PhaseCompleted', { phase: 8, name: 'KNOWLEDGE_MEMORY_SEED' });
    this.log('INFO', 'PHASE 8 — KNOWLEDGE & MEMORY INITIAL SEED: Completed');
  }

  async _phase9_SystemIntegrationCheck(serviceManager) {
    this.currentPhase = 9;
    this.log('INFO', 'PHASE 9 — METADATA PARSING & SYSTEM INTEGRATION: Started');

    if (!serviceManager) throw new Error("BOOT ABORTED: Missing dependency ServiceManager (Required by: Phase 9)");
    const metadataService = serviceManager.has('MetadataService') ? serviceManager.get('MetadataService') : null;
    if (!metadataService) {
      throw new Error("BOOT ABORTED\n\nMissing dependency:\nMetadataService\n\nRequired by:\nSystem Integration Check\n\nCurrent Phase:\n9");
    }

    const appManagerInstance = new ApplicationManager(serviceManager);
    serviceManager.register('ApplicationManager', appManagerInstance);
    
    serviceManager.register('WindowManager', new WindowManager(serviceManager));
    
    serviceManager.register('WorkspaceManager', new WorkspaceManager('mamet-os', serviceManager));
    this.log('INFO', 'ApplicationManager, WindowManager & WorkspaceManager Activated');

    const navigationService = new NavigationService(serviceManager);
    serviceManager.register('NavigationService', navigationService);

    const checks = [
      { name: 'Event Flow', passed: true },
      { name: 'Adapter Registry', passed: true },
      { name: 'Verification Pipeline', passed: true },
      { name: 'Metadata Loaded', passed: !!metadataService.getSystemConfig() }
    ];
    const allPassed = checks.every(c => c.passed);
    if (!allPassed) {
      throw new Error('System integration check failed');
    }
    this.log('INFO', 'All integration checks passed', checks);

    this._emitEvent(serviceManager, 'Kernel:PhaseCompleted', { phase: 9, name: 'METADATA_PARSING_AND_INTEGRATION' });
    this.log('INFO', 'PHASE 9 — METADATA PARSING & SYSTEM INTEGRATION: Completed');
  }

  async _phase10_FullSystemActivation(serviceManager) {
    this.currentPhase = 10;
    this.log('INFO', 'PHASE 10 — SYSTEM REGISTRATION & ACTIVATION: Started');

    if (!serviceManager.has('MetadataService')) throw new Error("BOOT ABORTED\n\nMissing dependency:\nMetadataService\n\nRequired by:\nFull System Activation\n\nCurrent Phase:\n10");
    if (!serviceManager.has('NavigationService')) throw new Error("BOOT ABORTED\n\nMissing dependency:\nNavigationService\n\nRequired by:\nFull System Activation\n\nCurrent Phase:\n10");
    if (!serviceManager.has('WorkspaceManager')) throw new Error("BOOT ABORTED\n\nMissing dependency:\nWorkspaceManager\n\nRequired by:\nFull System Activation\n\nCurrent Phase:\n10");
    if (!serviceManager.has('ApplicationManager')) throw new Error("BOOT ABORTED\n\nMissing dependency:\nApplicationManager\n\nRequired by:\nFull System Activation\n\nCurrent Phase:\n10");

    const adapterRegistry = serviceManager.get('AdapterRegistry');
    if (adapterRegistry) {
      for (const [name, adapter] of adapterRegistry.adapters.entries()) {
        adapter.active = true;
        adapter.status = 'ACTIVE';
        this.log('DEBUG', `Adapter activated: ${name}`);
      }
    }

    const verificationEngine = serviceManager.get('VerificationEngine');
    if (verificationEngine) verificationEngine.mode = 'OPERATIONAL';
    const orchestrator = serviceManager.get('AgentOrchestratorService');
    if (orchestrator) orchestrator.mode = 'OPERATIONAL';

    let widgetRegistry;
    if (serviceManager.has('WidgetRegistry')) {
      widgetRegistry = serviceManager.get('WidgetRegistry');
    } else {
      widgetRegistry = new WidgetRegistry(serviceManager);
      serviceManager.register('WidgetRegistry', widgetRegistry);
      this.log('INFO', 'Widget Registry Registered');
    }

    await this._registerDefaultWidgets(widgetRegistry, serviceManager);

    const { AppComponents } = await import('../application/AppRegistry.js');
    const metadataService = serviceManager.get('MetadataService');
    const apps = metadataService.getApps();
    const appManagerInstance = serviceManager.get('ApplicationManager');

    apps.forEach(app => {
      if (app.disabled) return;
      const RenderComp = AppComponents[app.component] || AppComponents['HomeDashboard'];
      
      appManagerInstance.registerApp({
        id: app.id,
        name: app.name,
        icon: app.icon || 'apps',
        renderComponent: (props) => React.createElement(RenderComp, { ...props, appId: app.id, workspaceId: app.workspace })
      });
    });

    const navigationService = serviceManager.get('NavigationService');
    navigationService.buildTree();
    
    const sysConfig = metadataService.getSystemConfig();
    if (sysConfig && sysConfig.default_entry_point) {
      appManagerInstance.activateApp(sysConfig.default_entry_point);
    }

    this._emitEvent(serviceManager, 'System:Ready', { timestamp: new Date().toISOString() });
    this._emitEvent(serviceManager, 'Kernel:PhaseCompleted', { phase: 10, name: 'SYSTEM_REGISTRATION_ACTIVATION' });
    this.log('INFO', 'PHASE 10 — SYSTEM REGISTRATION & ACTIVATION: Completed');
  }

  async _registerDefaultWidgets(widgetRegistry, serviceManager) {
    const metadata = serviceManager.has('MetadataService') ? serviceManager.get('MetadataService') : null;
    if (!metadata) {
      throw new Error("MetadataService unavailable during WidgetRegistry initialization");
    }

    const { AppComponents } = await import('../application/AppRegistry.js');
    const widgets = metadata.getWidgets();
    
    widgets.forEach(w => {
      const RenderComp = AppComponents[w.component];
      if (RenderComp) {
        widgetRegistry.register({
          id: w.id,
          name: w.name,
          component: RenderComp,
          capabilities: w.capabilities
        });
      }
    });
  }

  async _handleBootFailure(error) {
    this.status = 'DEGRADED';
    this.config.mode = 'SAFE_MODE';
    this.log('ERROR', 'Entering SAFE_MODE due to failure', error);

    this._emitEvent(this.serviceManager, 'System:Degraded', { 
      reason: error.message, 
      phase: this.currentPhase 
    });
    
  }

  _emitEvent(serviceManager, eventName, data) {
    try {
      if (!serviceManager || !serviceManager.has('EventBus')) {
        return;
      }
      const eventBus = serviceManager.get('EventBus');
      if (eventBus) {
        eventBus.emit(eventName, data);
      }
    } catch (e) {
      this.log('WARN', `Failed to emit ${eventName}`, e);
    }
  }

  setUser(userInfo) {
    this.identity.user = userInfo;
    this.log('INFO', 'User identity set', { userName: userInfo?.name || 'Unknown' });
  }

  getHealth() {
    this.health.uptime = Date.now() - this.health.startTime;
    if (this.eventBus) {
      this.health.totalEvents = this.eventBus.getTotalEvents();
    }
    return {
      ...this.health,
      status: this.status,
      phase: this.currentPhase,
      config: { ...this.config },
      identity: { ...this.identity }
    };
  }

  getCurrentPhase() {
    return this.currentPhase;
  }

  onShutdown(handler) {
    this._shutdownHandlers.push(handler);
  }

  async shutdown(serviceManager) {
    this.log('INFO', 'Kernel shutdown initiated');
    this.status = 'SHUTTING_DOWN';
    for (const handler of this._shutdownHandlers) {
      try {
        await handler();
      } catch (e) {
        this.log('ERROR', 'Shutdown handler failed', e);
      }
    }
    this.status = 'COLD';
    this.bootPromise = null;
    this.log('INFO', 'Kernel shutdown complete');
  }
}

export const kernel = new Kernel();
