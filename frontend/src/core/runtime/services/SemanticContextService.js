
import { IntentParser } from './IntentParser.js';
import { EntityExtractor } from './EntityExtractor.js';

export class SemanticContextService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.intentParser = new IntentParser();
    this.entityExtractor = new EntityExtractor();
    this.semanticGraph = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    this.semanticGraph.clear();

    this.isInitialized = true;
    this.eventBus.emit('SemanticContext:Ready', { status: 'READY', timestamp: Date.now() });
    console.log('[SemanticContextService] Initialized');
  }

  parseIntent(userMessage) {
    const intentResult = this.intentParser.parse(userMessage);
    const entities = this.entityExtractor.extract(userMessage);
    
    return {
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      entities
    };
  }

  extractEntities(userMessage, intent) {
    return this.entityExtractor.extract(userMessage);
  }

  updateGraph(userId, entities) {
    if (!this.semanticGraph.has(userId)) {
      this.semanticGraph.set(userId, { entities: [], relations: [] });
    }

    const userGraph = this.semanticGraph.get(userId);

    for (const entity of entities) {
      const existingIndex = userGraph.entities.findIndex(e => e.type === entity.type && e.value === entity.value);
      if (existingIndex === -1) {
        userGraph.entities.push(entity);
      } else {
        userGraph.entities[existingIndex].confidence = Math.max(userGraph.entities[existingIndex].confidence, entity.confidence);
      }
    }

    this._buildRelations(userGraph);

    this.semanticGraph.set(userId, userGraph);
    this.eventBus.emit('SemanticContext:GraphUpdated', { userId, graph: userGraph });
    console.log('[SemanticContextService] Graph updated for user:', userId);
  }

  _buildRelations(userGraph) {
    userGraph.relations = [];
    
    for (let i = 0; i < userGraph.entities.length; i++) {
      for (let j = i + 1; j < userGraph.entities.length; j++) {
        const entityA = userGraph.entities[i];
        const entityB = userGraph.entities[j];
        
        if (entityA.type === entityB.type) {
          userGraph.relations.push({
            from: entityA.value,
            to: entityB.value,
            type: 'SAME_TYPE',
            confidence: 0.5
          });
        }
      }
    }
  }

  getContext(userId, query) {
    if (!this.semanticGraph.has(userId)) {
      return { entities: [], relations: [], context: '' };
    }

    const userGraph = this.semanticGraph.get(userId);
    const queryLower = query.toLowerCase();

    const relevantEntities = userGraph.entities.filter(entity => 
      entity.value.toLowerCase().includes(queryLower) || 
      queryLower.includes(entity.value.toLowerCase())
    );

    const relevantRelations = userGraph.relations.filter(relation => 
      relevantEntities.some(e => e.value === relation.from || e.value === relation.to)
    );

    const contextParts = [];
    if (relevantEntities.length > 0) {
      contextParts.push('Entity yang relevan:');
      relevantEntities.forEach(entity => {
        contextParts.push(`- ${entity.type}: ${entity.value} (confidence: ${entity.confidence})`);
      });
    }

    if (relevantRelations.length > 0) {
      contextParts.push('\nRelasi yang relevan:');
      relevantRelations.forEach(relation => {
        contextParts.push(`- ${relation.from} -> ${relation.to} (${relation.type})`);
      });
    }

    return {
      entities: relevantEntities,
      relations: relevantRelations,
      context: contextParts.join('\n')
    };
  }

  getGraph(userId) {
    return this.semanticGraph.get(userId) || { entities: [], relations: [] };
  }

  clearGraph(userId) {
    this.semanticGraph.delete(userId);
    this.eventBus.emit('SemanticContext:GraphCleared', { userId });
    console.log('[SemanticContextService] Graph cleared for user:', userId);
  }
}
