/**
 * chimera-adapter.js
 * 
 * MAEF Capability Adapter for CHIMERA Engine
 * Conforms to:
 * - constitution/03_CAPABILITY_PORT.md (Knowledge Port, Memory Port, Verification Port)
 * - constitution/12_CAPABILITY_ADAPTER_SPEC.md
 * - constitution/13_VERIFICATION_ENGINE_SPEC.md
 */

const axios = require('axios');

class ChimeraAdapter {
  constructor(config = {}) {
    this.name = 'ChimeraAdapter';
    this.capabilityType = 'KnowledgePort';
    this.version = '0.1.0';
    this.baseUrl = config.baseUrl || process.env.CHIMERA_URL || 'http://127.0.0.1:7777';
    this.timeout = config.timeout || 10000;
  }

  /**
   * 1. Initialize
   */
  async Initialize(config = {}) {
    if (config.baseUrl) this.baseUrl = config.baseUrl;
    const health = await this.HealthCheck();
    if (!health.healthy) {
      console.warn(`[${this.name}] Warning: CHIMERA daemon at ${this.baseUrl} is not currently responding.`);
    } else {
      console.log(`[${this.name}] Connected to CHIMERA Engine (v${health.details?.version || '0.1.0'}, ${health.details?.module_count || 7} modules)`);
    }
  }

  /**
   * 2. HealthCheck
   */
  async HealthCheck() {
    const start = Date.now();
    try {
      const res = await axios.get(`${this.baseUrl}/api/v1/health`, { timeout: 3000 });
      return {
        healthy: res.data?.status === 'healthy',
        status: res.data?.status || 'UNKNOWN',
        latencyMs: Date.now() - start,
        details: res.data
      };
    } catch (err) {
      return {
        healthy: false,
        status: 'UNAVAILABLE',
        latencyMs: Date.now() - start,
        error: err.message
      };
    }
  }

  /**
   * 3. Knowledge Ingestion (Knowledge Port)
   * Sends new facts/rules/observations to CHIMERA for metabolism.
   */
  async IngestKnowledge({ content, domain = 'general', contentType = 'fact', source = 'mamet-os', traceId = null }) {
    try {
      const res = await axios.post(`${this.baseUrl}/api/v1/knowledge/ingest`, {
        content,
        domain,
        content_type: contentType,
        source,
        trace_id: traceId
      }, { timeout: this.timeout });

      return {
        success: true,
        data: res.data
      };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data || err.message
      };
    }
  }

  /**
   * 4. Knowledge Query (Knowledge Port & Memory Port)
   * Retrieves verified knowledge with effective confidence decay.
   */
  async QueryKnowledge({ query = null, domain = null, minConfidence = 0.5, limit = 10 }) {
    try {
      const res = await axios.post(`${this.baseUrl}/api/v1/knowledge/query`, {
        query,
        domain,
        min_confidence: minConfidence,
        limit
      }, { timeout: this.timeout });

      return {
        success: true,
        items: res.data?.items || [],
        total: res.data?.total || 0
      };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data || err.message,
        items: [],
        total: 0
      };
    }
  }

  /**
   * 5. Verification (Verification Port - Anti-Hallucination)
   * Cross-checks claims against CHIMERA's verified knowledge and immune system.
   */
  async VerifyClaim({ claim, domain = null, traceId = null }) {
    try {
      const res = await axios.post(`${this.baseUrl}/api/v1/verify`, {
        claim,
        domain,
        trace_id: traceId
      }, { timeout: this.timeout });

      return {
        status: res.data?.status || 'PARTIAL', // "PASS", "FAIL", "PARTIAL"
        confidence: res.data?.confidence || 0.5,
        evidenceStrength: res.data?.evidence_strength || 'UNVERIFIED',
        reasoningSummary: res.data?.reasoning_summary || '',
        contradictions: res.data?.contradictions || [],
        traceId: res.data?.trace_id || traceId
      };
    } catch (err) {
      return {
        status: 'PARTIAL',
        confidence: 0.5,
        evidenceStrength: 'UNVERIFIED',
        reasoningSummary: `Verification engine unreachable: ${err.message}`,
        contradictions: [],
        traceId
      };
    }
  }

  /**
   * 6. Cognitive & Consciousness Telemetry (Genesis & Emergence)
   */
  async GetCognitiveStatus() {
    try {
      const res = await axios.get(`${this.baseUrl}/api/v1/cognitive/status`, { timeout: this.timeout });
      return {
        success: true,
        state: res.data
      };
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * 7. Trigger Dream Cycle (Cognitive Consolidation)
   */
  async TriggerDream() {
    try {
      const res = await axios.post(`${this.baseUrl}/api/v1/cognitive/dream`, {}, { timeout: 30000 });
      return {
        success: true,
        data: res.data
      };
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Normalize standard MAEF output
   */
  Normalize(rawOutput, traceId) {
    return {
      result: rawOutput,
      confidence: rawOutput?.confidence || 1.0,
      source: 'chimera-engine',
      trace_id: traceId
    };
  }

  /**
   * Shutdown
   */
  async Shutdown() {
    // No-op for HTTP client
  }
}

module.exports = new ChimeraAdapter();
module.exports.ChimeraAdapter = ChimeraAdapter;
