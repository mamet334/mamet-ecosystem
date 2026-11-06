import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabase';
import { fetchExecutionTrace } from '../services/ExecutionTraceService';
import { susunGrafHome, nilaiLampu, statusRealtime, KOLOM_LOG_AGEN, bentukLogAgen, PUSAT, bacaHitunganGraf } from './grafHome.js';

const EXEC_TRACE_MAX = 40;

export default function useDashboardData() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [stats, setStats] = useState({ memories: 0, documents: 0, chats: 0, orphans: 0, connected: 0, memoryConflicts: 0 });
  const [vitals, setVitals] = useState({
    supabase: 'UNKNOWN',
    auth: 'UNKNOWN',
    realtime: 'UNKNOWN',
    storage: 'UNKNOWN',
    edge: 'UNKNOWN',
    memory: 'UNKNOWN',
    rag: 'UNKNOWN',
    embedding: 'UNKNOWN',
    verification: 'UNKNOWN',
    provider: 'UNKNOWN',
    agentProcess: 'UNKNOWN',
    electron: 'UNKNOWN'
  });
  const vitalsRef = useRef(vitals);
  const [keteranganLampu, setKeteranganLampu] = useState({});
  const laporRealtime = useCallback((s) => {
    vitalsRef.current = { ...vitalsRef.current, realtime: statusRealtime(s) };
    setVitals(vitalsRef.current);
  }, []);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activePath, setActivePath] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState('...');
  const [executionTrace, setExecutionTrace] = useState({
    traceId: null,
    timeline: [],
    pipeline: null,
    loading: false,
    error: null,
    unknown: false
  });
  const [observability, setObservability] = useState({
    memoryReads: 0,
    memoryWrites: 0,
    llmCalls: 0,
    avgLatencyMs: 0,
    errorCount: 0,
    costAlertCount: 0,
    pipelineIncidentsDown: 0,
    pipelineIncidentsTotal: 0,
    verificationFail: 0,
    verificationWarn: 0,
    latencyP50Ms: null,
    latencyP95Ms: null,
    latencyP99Ms: null,
    topSlowComponents: [],
    recentFailures: []
  });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    async function fetchData() {
      try {
        const authRes = await supabase.auth.getSession();
        const currentUserId = authRes?.data?.session?.user?.id;

        let memQuery = supabase.from('user_memories').select('id, summary, created_at, memory_hits, metadata, status').limit(500);
        let docQuery = supabase.from('documents').select('id, title, created_at').limit(500);
        let chatQuery = supabase.from('chats').select('id, title, workspace_type, created_at').limit(500);
        let chunkQuery = currentUserId
          ? supabase.from('document_chunks').select('document_id, documents!inner(user_id)').eq('documents.user_id', currentUserId).limit(5000)
          : supabase.from('document_chunks').select('document_id').limit(5000);

        if (currentUserId) {
          memQuery = memQuery.eq('user_id', currentUserId);
          docQuery = docQuery.eq('user_id', currentUserId);
          chatQuery = chatQuery.eq('user_id', currentUserId);
        }

        const [memRes, docRes, chatRes, hitunganRes] = await Promise.all([
          memQuery,
          docQuery,
          chatQuery,
          supabase.rpc('hitungan_graf_home')
        ]);

        const memories = memRes.data || [];
        const documents = docRes.data || [];
        const chats = chatRes.data || [];

        const hitungan = bacaHitunganGraf(hitunganRes.data);
        let docChunkCounts = hitungan.docChunkCounts;
        let chunkRes = { error: null };
        if (hitunganRes.error) {
          chunkRes = await chunkQuery;
          docChunkCounts = {};
          (chunkRes.data || []).forEach(c => {
            if (c.document_id) docChunkCounts[c.document_id] = (docChunkCounts[c.document_id] || 0) + 1;
          });
        }

        const [logsRes, checksRes, incidentsRes, verRes, agentLogsRes, apiUsageRes] = await Promise.all([
          supabase.from('ai_system_logs').select('created_at, llm_call_count, model_used, latency_ms, memory_fetch_count, memory_write_count, error_flag, cost_alert_flag').order('created_at', { ascending: false }).limit(100),
          supabase.from('checks').select('status_code,response_time_ms,checked_at').order('checked_at', { ascending: false }).limit(100),
          supabase.from('incidents').select('status,started_at,resolved_at').order('started_at', { ascending: false }).limit(100),
          supabase.from('verification_audit_logs').select('decision,status,failures,execution_time_ms,timestamp').order('timestamp', { ascending: false }).limit(100),
          supabase.from('agent_logs').select(KOLOM_LOG_AGEN).order('created_at', { ascending: false }).limit(100),
          supabase.from('api_usage').select('created_at').order('created_at', { ascending: false }).limit(100)
        ]);

        const logs = logsRes.data || [];
        const agentLogs = bentukLogAgen(agentLogsRes.data);
        const apiUsages = apiUsageRes.data || [];
        const checks = checksRes.data || [];
        const verificationItems = verRes.data || [];

        const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
        const nowTs = Date.now();
        const isRecent = (ts) => {
          if (!ts) return false;
          return (nowTs - new Date(ts).getTime()) <= FIFTEEN_MINUTES_MS;
        };

        const errors = logs.filter(l => l.error_flag);
        const costAlerts = logs.filter(l => l.cost_alert_flag);
        const avgLatency = logs.length > 0 ? Math.round(logs.reduce((acc, l) => acc + (l.latency_ms || 0), 0) / logs.length) : 0;

        const pipelineIncidentsTotal = (incidentsRes.data || []).length;
        const pipelineIncidentsDown = (incidentsRes.data || []).filter(i => (i.status || '').toUpperCase() === 'DOWN').length;

        const verificationFail = verificationItems.filter(v => (v.decision || '').toUpperCase() === 'FAIL' || (v.status || '').toUpperCase() === 'FAIL').length;
        const verificationWarn = verificationItems.filter(v => (v.decision || '').toUpperCase() === 'WARNING' || (v.decision || '').toUpperCase() === 'WARN' || (v.status || '').toUpperCase() === 'WARN' || (v.status || '').toUpperCase() === 'WARNING').length;

        const recentVerificationFail = verificationItems.filter(v => {
          const isFail = (v.decision || '').toUpperCase() === 'FAIL' || (v.status || '').toUpperCase() === 'FAIL';
          return isFail && isRecent(v.created_at);
        }).length;

        const recentVerificationWarn = verificationItems.filter(v => {
          const isWarn = (v.decision || '').toUpperCase() === 'WARNING' || (v.decision || '').toUpperCase() === 'WARN' || (v.status || '').toUpperCase() === 'WARN';
          return isWarn && isRecent(v.created_at);
        }).length;

        const percentile = (arr, p) => {
          if (!arr || arr.length === 0) return null;
          const idx = Math.ceil((p / 100) * arr.length) - 1;
          const safeIdx = Math.max(0, Math.min(arr.length - 1, idx));
          return arr[safeIdx];
        };

        const latencySamples = [
          ...logs.map(l => Number(l.latency_ms)),
          ...checks.map(c => Number(c.response_time_ms)),
          ...verificationItems.map(v => Number(v.execution_time_ms)),
          ...agentLogs.map(l => Number(l.metadata?.latency_ms || l.metadata?.execution_time_ms || l.metadata?.duration_ms))
        ]
          .filter(v => Number.isFinite(v) && v > 0)
          .sort((a, b) => a - b);

        const latencyP50Ms = percentile(latencySamples, 50);
        const latencyP95Ms = percentile(latencySamples, 95);
        const latencyP99Ms = percentile(latencySamples, 99);

        const componentLatencyMap = {};
        logs.forEach(l => {
          const key = l.component || l.module || l.event_type || l.provider || 'AI Service';
          const lat = Number(l.latency_ms);
          if (!Number.isFinite(lat) || lat <= 0) return;
          if (!componentLatencyMap[key]) componentLatencyMap[key] = [];
          componentLatencyMap[key].push(lat);
        });

        checks.forEach(c => {
          const lat = Number(c.response_time_ms);
          if (!Number.isFinite(lat) || lat <= 0) return;
          const key = 'System Monitor Check';
          if (!componentLatencyMap[key]) componentLatencyMap[key] = [];
          componentLatencyMap[key].push(lat);
        });

        verificationItems.forEach(v => {
          const lat = Number(v.execution_time_ms);
          if (!Number.isFinite(lat) || lat <= 0) return;
          const key = 'Verification Engine';
          if (!componentLatencyMap[key]) componentLatencyMap[key] = [];
          componentLatencyMap[key].push(lat);
        });

        const topSlowComponents = Object.entries(componentLatencyMap)
          .map(([component, arr]) => {
            const sorted = arr.slice().sort((a, b) => a - b);
            return {
              component,
              p95: percentile(sorted, 95),
              p99: percentile(sorted, 99),
              avg: Math.round(sorted.reduce((acc, v) => acc + v, 0) / sorted.length),
              sampleCount: sorted.length
            };
          })
          .sort((a, b) => (b.p95 || 0) - (a.p95 || 0))
          .slice(0, 5);

        const sanitizeFailureMessage = (raw) => {
          if (!raw) return 'Unknown failure';
          if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              if (typeof parsed === 'object' && parsed !== null) {
                return sanitizeFailureMessage(parsed);
              }
            } catch (_) {}
            return raw;
          }
          if (Array.isArray(raw)) {
            const joined = raw.map(sanitizeFailureMessage).filter(Boolean).join('; ');
            return joined || 'Empty failure array';
          }
          if (typeof raw === 'object') {
            return raw.reason || raw.message || raw.rule || raw.error || raw.violation || JSON.stringify(raw);
          }
          return String(raw);
        };

        const toolFailures = logs
          .filter(l => l.error_flag || String(l.status || '').toLowerCase().includes('fail') || String(l.status || '').toLowerCase().includes('timeout'))
          .map(l => ({
            type: String(l.error_type || l.event_type || l.component || 'unknown').toLowerCase().includes('tool') ? 'tool-timeout-or-failure' : 'provider-or-runtime-error',
            message: sanitizeFailureMessage(l.error_message || l.message || 'Unknown failure'),
            at: l.created_at || null
          }));

        const verificationFailures = verificationItems
          .filter(v => {
            const s = String(v.status || v.decision || '').toLowerCase();
            return s.includes('fail') || s.includes('error') || s.includes('warn');
          })
          .map(v => ({
            type: (v.decision || v.status || 'verification-fail').toUpperCase(),
            message: sanitizeFailureMessage(v.failures || v.decision || v.status || 'Verification failure'),
            at: v.created_at || null
          }));

        const ragUnavailableFailures = (docRes.error || chunkRes.error) ? [{
          type: 'rag-unavailable',
          message: sanitizeFailureMessage(docRes.error?.message || chunkRes.error?.message || 'RAG unavailable'),
          at: new Date().toISOString()
        }] : [];

        const supabaseDisconnectedFailures = (memRes.error || docRes.error) ? [{
          type: 'supabase-disconnected',
          message: sanitizeFailureMessage(memRes.error?.message || docRes.error?.message || 'Supabase disconnected'),
          at: new Date().toISOString()
        }] : [];

        const recentFailures = [
          ...toolFailures,
          ...verificationFailures,
          ...ragUnavailableFailures,
          ...supabaseDisconnectedFailures
        ]
          .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
          .slice(0, 10);

        const totalMemoryReads = logs.reduce((acc, l) => acc + (l.memory_fetch_count || 0), 0) +
          agentLogs.filter(l => (l.event_type || '').toLowerCase().includes('memory.read') || (l.event_type || '').toLowerCase().includes('retrieval')).length;

        const totalMemoryWrites = logs.reduce((acc, l) => acc + (l.memory_write_count || 0), 0) +
          agentLogs.filter(l => (l.event_type || '').toLowerCase().includes('memory.write') || (l.event_type || '').toLowerCase().includes('memory_save')).length;

        const totalLlmCalls = Math.max(
          logs.reduce((acc, l) => acc + (l.llm_call_count || 0), 0),
          hitungan.pemakaianModel ?? apiUsages.length,
          agentLogs.filter(l => (l.event_type || '').toLowerCase().includes('provider') || (l.event_type || '').toLowerCase().includes('response')).length
        );

        const computedAvgLatency = avgLatency || (latencySamples.length > 0 ? Math.round(latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length) : 0);

        setObservability({
          memoryReads: totalMemoryReads,
          memoryWrites: totalMemoryWrites,
          llmCalls: totalLlmCalls,
          avgLatencyMs: computedAvgLatency,
          errorCount: errors.length,
          costAlertCount: costAlerts.length,
          pipelineIncidentsDown,
          pipelineIncidentsTotal,
          verificationFail,
          verificationWarn,
          latencyP50Ms,
          latencyP95Ms,
          latencyP99Ms,
          topSlowComponents,
          recentFailures
        });

        const storageRes = await supabase.storage.listBuckets();

        const { data: heartbeatData } = await supabase
          .from('service_heartbeat')
          .select('status, last_heartbeat_at')
          .eq('service_name', 'agent-process')
          .maybeSingle();

        const lampu = nilaiLampu({
          heartbeat: heartbeatData,
          suksesTerakhir: apiUsages[0]?.created_at,
          galatPenyediaTerakhir: agentLogs.find(l => l.event_type === 'PROVIDER_ERROR')?.created_at,
          desktop: typeof window !== 'undefined' && !!window.electronAPI,
        });

        const normalizeHealthStatus = (raw) => {
          if (!raw) return 'UNKNOWN';
          const s = String(raw).toLowerCase();
          if (s.includes('🟢') || s.includes('healthy') || s.includes('up') || s.includes('ok') || s.includes('success')) return 'HEALTHY';
          if (s.includes('🔴') || s.includes('down') || s.includes('fail') || s.includes('error')) return 'DOWN';
          if (s.includes('🟡') || s.includes('degraded') || s.includes('warn')) return 'DEGRADED';
          if (s.includes('⚪') || s.includes('unknown')) return 'UNKNOWN';
          return 'UNKNOWN';
        };

        const verificationHealthRaw = recentVerificationFail > 0
          ? 'DEGRADED'
          : recentVerificationWarn > 0
            ? 'DEGRADED'
            : verificationItems.length > 0
              ? 'HEALTHY'
              : 'UNKNOWN';

        const vitalsBaru = {
          ...vitalsRef.current,
          supabase: normalizeHealthStatus((memRes.error || docRes.error) ? 'DOWN' : 'HEALTHY'),
          auth: normalizeHealthStatus(authRes.error ? 'DOWN' : 'HEALTHY'),
          storage: normalizeHealthStatus(storageRes.error ? 'DOWN' : 'HEALTHY'),
          memory: normalizeHealthStatus(memRes.error ? 'DOWN' : 'HEALTHY'),
          rag: normalizeHealthStatus(docRes.error ? 'DOWN' : 'HEALTHY'),
          verification: normalizeHealthStatus(verificationHealthRaw),
          ...lampu.status,
        };
        vitalsRef.current = vitalsBaru;
        setVitals(vitalsBaru);
        setKeteranganLampu(lampu.keterangan);

        setLastCheckTime(new Date().toLocaleTimeString('id-ID', { hour12: false }));

        const { nodes, links, stats: statistik } = susunGrafHome({ memories, documents, chats, docChunkCounts, vitals: vitalsBaru, pesanPerChat: hitungan.pesanPerChat });
        setStats(statistik);

        let activeTraceId = selectedNode?.data?.trace_id || selectedNode?.data?.metadata?.trace_id;
        if (!activeTraceId) {
          const latestAgentWithTrace = agentLogs.find(l => l.metadata?.trace_id || l.metadata?.traceId);
          activeTraceId = latestAgentWithTrace?.metadata?.trace_id ||
                          latestAgentWithTrace?.metadata?.traceId ||
                          null;
        }
        if (activeTraceId) {
          setExecutionTrace({ traceId: activeTraceId, timeline: [], pipeline: null, loading: true, error: null, unknown: false });
          try {
            const res = await fetchExecutionTrace({ traceId: activeTraceId, limit: EXEC_TRACE_MAX });
            const timeline = res.timeline || [];

            if (timeline.length === 0) {
              setExecutionTrace({
                traceId: res.traceId,
                timeline: [],
                pipeline: res.pipeline || null,
                loading: false,
                error: null,
                unknown: true
              });
            } else {
              setExecutionTrace({
                traceId: res.traceId,
                timeline,
                pipeline: res.pipeline || null,
                loading: false,
                error: null,
                unknown: false
              });

              const hasTimeout = timeline.some(e => (e.status || '').toLowerCase() === 'timeout');
              const hasFailed = timeline.some(e => (e.status || '').toLowerCase() === 'failed');

              if (hasTimeout || hasFailed) {
                const nodesToActivate = new Set([PUSAT.desktop, PUSAT.server]);
                const linksToActivate = new Set([`${PUSAT.desktop}->${PUSAT.server}`]);
                setActivePath({ nodes: nodesToActivate, links: linksToActivate });
              }
            }
          } catch (e) {
            setExecutionTrace({
              traceId: activeTraceId,
              timeline: [],
              pipeline: null,
              loading: false,
              error: e?.message || 'Failed to load execution trace',
              unknown: true
            });
          }
        }

        setGraphData({ nodes, links });
      } catch (err) {
        console.error("Failed to load Knowledge Graph:", err);
      }
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    graphData,
    stats,
    vitals,
    keteranganLampu,
    laporRealtime,
    selectedNode,
    setSelectedNode,
    activePath,
    setActivePath,
    isDragging,
    setIsDragging,
    lastCheckTime,
    executionTrace,
    observability,
    dimensions,
    setDimensions
  };
}

