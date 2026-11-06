export class AgentOrchestratorService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.isInitialized = false;
    this.agents = new Map();
  }

  async initialize() {
    console.log('[AgentOrchestratorService] initialize() called. isInitialized=', this.isInitialized);
    if (this.isInitialized) return;
    
    this.isInitialized = true;
    
    console.log('[AgentOrchestratorService] Initializing...');
    
    this.registerAgent({
      name: 'memory_manager',
      description: 'Mengelola User Memory - menyimpan, mencari, dan menghapus data memori pengguna',
      tools: ['memory_manager'],
      status: 'active',
      category: 'memory'
    });

    this.registerAgent({
      name: 'researcher',
      description: 'Mencari informasi dari web dan merangkum hasil pencarian',
      tools: ['web_search'],
      status: 'active',
      category: 'research'
    });


    this.registerAgent({
      name: 'deep_researcher',
      description: 'Riset mendalam multi-langkah dengan sintesis dan pelaporan',
      tools: ['web_search', 'memory_manager'],
      status: 'active',
      category: 'research'
    });

    this.eventBus.emit('Agent:Registered', { name: 'memory_manager' });
    this.eventBus.emit('Agent:Registered', { name: 'researcher' });
    this.eventBus.emit('Agent:Registered', { name: 'deep_researcher' });
    
    this.eventBus.emit('AgentOrchestrator:Ready', { status: 'READY', timestamp: Date.now() });
    console.log('[AgentOrchestratorService] Initialized and Ready');
    console.log('[AgentOrchestratorService] Total agents registered:', this.agents.size);
  }

  async executeAgent(agentName, task) {
    if (!this.isInitialized) throw new Error('AgentOrchestratorService not initialized');
    
    console.log(`[AgentOrchestratorService] Requesting execution for agent: ${agentName}`);
    this.eventBus.emit('Agent:ExecuteRequested', { agentName, task });
    
    const placeholderResponse = { success: true, output: `Task "${task}" executed by ${agentName}` };
    
    this.eventBus.emit('Agent:ExecutionComplete', { agentName, result: placeholderResponse });
    return placeholderResponse;
  }

  async registerAgent(agentConfig) {
    console.log(`[AgentOrchestratorService] registerAgent() called for:`, agentConfig?.name, 'isInitialized=', this.isInitialized);
    if (!this.isInitialized) {
      console.error(`[AgentOrchestratorService] Failed to register agent ${agentConfig?.name} because service is not initialized!`);
      throw new Error('AgentOrchestratorService not initialized');
    }
    
    const name = agentConfig.name || 'UnknownAgent';
    console.log(`[AgentOrchestratorService] Registering new agent: ${name}`);
    this.agents.set(name, agentConfig);
    console.log(`[AgentOrchestratorService] Current agents Map after register:`, this.agents);
    
    return true;
  }
}