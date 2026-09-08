import React, { useState, useEffect, useMemo } from 'react';
import { kernel } from '../../core/runtime/Kernel';
import { ScrollText, RefreshCw, AlertTriangle, XCircle, Cpu, Clock, Radio, Layers } from 'lucide-react';

const FILTERS = [
  { id: 'ALL', label: 'Semua' },
  { id: 'ERROR', label: 'Error' },
  { id: 'WARN', label: 'Peringatan' }
];

function formatUptime(ms) {
  if (!ms || ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}j ${minutes}m ${seconds}d`;
  if (minutes > 0) return `${minutes}m ${seconds}d`;
  return `${seconds}d`;
}

function StatCard({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-300 border-slate-800',
    emerald: 'text-emerald-400 border-emerald-500/30',
    amber: 'text-amber-400 border-amber-500/30',
    red: 'text-red-400 border-red-500/30'
  };
  return (
    <div className={`flex items-center gap-3 bg-slate-900/50 border rounded-lg px-4 py-3 ${tones[tone] || tones.slate}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-sm font-mono font-bold truncate">{value}</p>
      </div>
    </div>
  );
}

export default function SystemLogsApp() {
  const [health, setHealth] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [expanded, setExpanded] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    setHealth(kernel.getHealth());
    if (!autoRefresh) return;
    const interval = setInterval(() => setHealth(kernel.getHealth()), 2000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const entries = useMemo(() => {
    if (!health) return [];
    const errors = health.errors || [];
    const warnings = health.warnings || [];
    const merged = filter === 'ERROR' ? errors : filter === 'WARN' ? warnings : [...errors, ...warnings];
    return [...merged].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [health, filter]);

  const errorCount = health?.errors?.length || 0;
  const warningCount = health?.warnings?.length || 0;
  const isDegraded = health?.status === 'DEGRADED' || health?.config?.mode === 'SAFE_MODE';

  return (
    <div className="h-full bg-slate-950 text-white p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
            <ScrollText className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              System Logs
            </h1>
            <p className="text-xs text-slate-400">Event Viewer Kernel — error dan peringatan runtime</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {autoRefresh ? 'Auto-refresh aktif' : 'Auto-refresh mati'}
          </button>
          <button
            onClick={() => setHealth(kernel.getHealth())}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
            title="Muat ulang"
          >
            <RefreshCw className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      {isDegraded && (
        <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/40 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-300">Kernel berjalan dalam mode terbatas</p>
            <p className="text-xs text-red-200/70 mt-1">
              Status <span className="font-mono">{health?.status}</span> · mode{' '}
              <span className="font-mono">{health?.config?.mode}</span>. Periksa entri error di bawah.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard icon={Cpu} label="Status" value={health?.status || '—'} tone={isDegraded ? 'red' : 'emerald'} />
        <StatCard icon={Layers} label="Fase" value={health?.phase ?? '—'} />
        <StatCard icon={Clock} label="Uptime" value={formatUptime(health?.uptime)} />
        <StatCard icon={Radio} label="Total Event" value={health?.totalEvents ?? 0} />
        <StatCard icon={XCircle} label="Error" value={errorCount} tone={errorCount > 0 ? 'red' : 'slate'} />
        <StatCard icon={AlertTriangle} label="Peringatan" value={warningCount} tone={warningCount > 0 ? 'amber' : 'slate'} />
      </div>

      <div className="flex items-center gap-2 mb-4">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filter === f.id
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            {f.label}
            {f.id === 'ERROR' && errorCount > 0 && <span className="ml-1.5 text-red-400">{errorCount}</span>}
            {f.id === 'WARN' && warningCount > 0 && <span className="ml-1.5 text-amber-400">{warningCount}</span>}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600">
          <ScrollText className="w-16 h-16 mb-4 opacity-40" />
          <p className="text-sm">Tidak ada error atau peringatan tercatat</p>
          <p className="text-xs mt-1">Kernel berjalan bersih sejak boot terakhir</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => {
            const isError = entry.level === 'ERROR';
            const key = `${entry.timestamp}-${idx}`;
            const isOpen = expanded === key;
            return (
              <div
                key={key}
                className={`bg-slate-900/50 border rounded-lg overflow-hidden transition-all ${
                  isError ? 'border-red-500/30' : 'border-amber-500/30'
                }`}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-800/40 transition-colors"
                >
                  {isError ? (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${isError ? 'text-red-200' : 'text-amber-200'}`}>
                      {entry.message}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 mt-1">
                      {entry.timestamp} · {entry.level}
                    </p>
                  </div>
                  {entry.data && (
                    <span className="text-[10px] text-slate-500 shrink-0 mt-1">{isOpen ? 'Tutup' : 'Detail'}</span>
                  )}
                </button>
                {isOpen && entry.data && (
                  <pre className="px-4 pb-4 text-[11px] font-mono text-slate-400 whitespace-pre-wrap break-all">
                    {(() => {
                      try {
                        return JSON.stringify(entry.data, null, 2);
                      } catch {
                        return String(entry.data);
                      }
                    })()}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
