import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { kernel } from '../core/runtime/Kernel';
import { User, Mail, Shield, LogOut, Palette, Activity, Monitor, Bell, Cpu, Clock, Brain, Key } from 'lucide-react';

// Workspace yang bisa punya override preferensi tool sendiri (lihat WorkspaceManager.js)
const TOGGLEABLE_WORKSPACES = [
  { id: 'ws-assistant', label: 'Assistant' },
  { id: 'ws-lite', label: 'Lite' },
  { id: 'ws-engineer', label: 'Engineer' }
];

const TOOL_LABELS = {
  rag: 'RAG',
  web_search: 'Web Search'
};

export default function Settings() {
  const [user, setUser] = useState(null);
  const [health, setHealth] = useState(null);

  // AI Config State
  const [aiProvider, setAiProvider] = useState('openrouter');
  const [aiModel, setAiModel] = useState('anthropic/claude-3.5-sonnet');
  const [aiKey, setAiKey] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  // Tool Preferences State
  const [toolPrefsVersion, setToolPrefsVersion] = useState(0);
  const toolPreferencesService = kernel.serviceManager?.get('ToolPreferencesService');
  const toolNames = toolPreferencesService ? toolPreferencesService.listToolNames() : ['rag', 'web_search'];

  const handleToggleGlobal = (toolName) => {
    if (!toolPreferencesService) return;
    const current = toolPreferencesService.getGlobalDefault(toolName);
    toolPreferencesService.setGlobalDefault(toolName, !current);
    setToolPrefsVersion(v => v + 1);
  };

  const handleSetWorkspaceOverride = (workspaceId, toolName, value) => {
    if (!toolPreferencesService) return;
    // value: 'default' | 'on' | 'off'
    const enabled = value === 'default' ? null : value === 'on';
    toolPreferencesService.setWorkspaceOverride(workspaceId, toolName, enabled);
    setToolPrefsVersion(v => v + 1);
  };

  // Tool Registry State (folder tools/ — lihat ToolRegistryService.scanToolsFolder())
  const [scanStatus, setScanStatus] = useState(''); // '', 'scanning', 'done'
  const [registryVersion, setRegistryVersion] = useState(0);
  const toolRegistryService = kernel.serviceManager?.get('ToolRegistryService');
  const registeredTools = toolRegistryService ? toolRegistryService.listTools() : [];
  const lastScan = toolRegistryService?.lastScan;

  const handleScanTools = async () => {
    if (!toolRegistryService) return;
    setScanStatus('scanning');
    await toolRegistryService.scanToolsFolder();
    setScanStatus('done');
    setRegistryVersion(v => v + 1);
    setTimeout(() => setScanStatus(''), 2500);
  };

  // Adaptive Model Tiering — 3 slot kurasi Owner (lihat ROADMAP-ADAPTIVE-MODEL-TIERING.md).
  // Sumber kebenaran tetap BrainService; state di sini cuma pemicu re-render setelah setTier().
  const [tiersVersion, setTiersVersion] = useState(0);
  const brainServiceRef = kernel.serviceManager?.get('BrainService');
  const modelTiers = brainServiceRef?.getTiers?.() || {};

  const handleTierChange = (tierName, field, value) => {
    if (!brainServiceRef?.setTier) return;
    brainServiceRef.setTier(tierName, { [field]: value });
    setTiersVersion(v => v + 1);
  };

  // Batas biaya harian pribadi — disimpan di user_metadata, dibaca quota_middleware di edge
  // function. Nilai efektifnya = min(batas ini, plafon sistem) sehingga hanya bisa memperketat.
  const [dailyCap, setDailyCap] = useState('');
  const [systemCap, setSystemCap] = useState(null);
  const [capStatus, setCapStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: config } = await supabase
          .from('system_config')
          .select('daily_budget_cap_usd')
          .single();
        if (cancelled) return;
        const saved = user?.user_metadata?.daily_budget_cap_usd;
        if (saved !== undefined && saved !== null) setDailyCap(String(saved));
        if (config?.daily_budget_cap_usd != null) setSystemCap(Number(config.daily_budget_cap_usd));
      } catch (e) {
        console.warn('[Settings] Gagal memuat batas harian:', e.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSaveDailyCap = async () => {
    setCapStatus('saving');
    try {
      const parsed = dailyCap === '' ? null : Number(dailyCap);
      if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
        setCapStatus('error:Nilai harus angka lebih besar dari 0, atau kosongkan untuk mengikuti plafon sistem.');
        return;
      }
      await supabase.auth.updateUser({ data: { daily_budget_cap_usd: parsed } });
      setCapStatus('done');
      setTimeout(() => setCapStatus(''), 2500);
    } catch (e) {
      setCapStatus(`error:${e.message}`);
    }
  };

  useEffect(() => {
    // Get user from Kernel identity
    setUser(kernel.identity.user);
    setHealth(kernel.getHealth());

    // Fetch initial state from services
    const brainService = kernel.serviceManager?.get('BrainService');
    const vaultService = kernel.serviceManager?.get('VaultService');

    if (brainService) {
      const config = brainService.getBrainConfig();
      setAiProvider(config.provider);
      setAiModel(config.model);
    }
    if (vaultService && brainService) {
      const key = vaultService.getKey(brainService.getBrainConfig().provider) || '';
      setAiKey(key);
    }
    
    // Periodically update health
    const interval = setInterval(() => {
      setHealth(kernel.getHealth());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleSaveAiConfig = () => {
    const brainService = kernel.serviceManager?.get('BrainService');
    const vaultService = kernel.serviceManager?.get('VaultService');

    if (brainService) {
      brainService.setBrain(aiProvider, aiModel); // sekarang menyimpan model juga
    }
    if (vaultService) {
      vaultService.setKey(aiProvider, aiKey);
    }

    setSaveStatus('Saved!');
    setTimeout(() => setSaveStatus(''), 2000);
  };

  const [testStatus, setTestStatus] = useState('');
  const handleTestConnection = async () => {
    setTestStatus('testing');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        alert('Silakan login terlebih dahulu untuk tes koneksi.');
        setTestStatus('');
        return;
      }

      // FIX: API key harus dikirim di header `x-byok-{provider}`,
      // bukan di body sebagai `apiKey`. request_pipeline.ts membaca dari header.
      const byokHeaderKey = `x-byok-${aiProvider}`;
      const endpoint = 'https://uuyzdjifhdfyyvpxsofu.supabase.co/functions/v1/agent-process';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          [byokHeaderKey]: aiKey,  // ← key dikirim di header yang benar
        },
        body: JSON.stringify({
          message: 'Halo, tes koneksi. Balas dengan "OK".',
          provider: aiProvider,
          model: aiModel,
          history: []
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || `HTTP ${response.status}`);
      setTestStatus('success');
      setTimeout(() => setTestStatus(''), 4000);
    } catch (err) {
      console.error('[Settings] Test connection failed:', err);
      setTestStatus(`error:${err.message}`);
      setTimeout(() => setTestStatus(''), 6000);
    }
  };


  const handleProviderChange = (newProvider) => {
    setAiProvider(newProvider);
    const vaultService = kernel.serviceManager?.get('VaultService');
    if (vaultService) {
      setAiKey(vaultService.getKey(newProvider) || '');
    }
  };

  const formatUptime = (ms) => {
    if (!ms) return '0s';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    
    return parts.join(' ');
  };

  return (
    <div className="flex-1 overflow-auto bg-background p-4 md:p-6 lg:p-8 custom-scrollbar font-body-base text-on-surface">
      <div className="max-w-screen-container-max mx-auto space-y-6 md:space-y-8">
        
        {/* Header */}
        <div className="mb-6 md:mb-12">
          <h1 className="font-display-lg text-display-lg text-on-surface mb-2">Settings</h1>
          <p className="text-on-surface-variant text-body-base">Configure your deep-dark AI workspace and management parameters.</p>
        </div>

        <div className="grid grid-cols-12 gap-4 md:gap-gutter">
          
          {/* AI Model Management — full width di mobile, 8/12 di desktop */}
          <section className="col-span-12 lg:col-span-8 glass-panel rim-light p-4 md:p-gutter rounded-xl border border-outline-variant relative overflow-hidden">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">psychology</span>
              </div>
              <div>
                <h2 className="font-headline-md text-headline-md">AI Model Management</h2>
                <p className="text-body-sm text-on-surface-variant">Model utama — dipakai Engineer &amp; sebagai dasar slot tier di bawah</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-label-mono text-on-surface-variant uppercase tracking-widest pl-1">Provider</label>
                <input
                  type="text"
                  list="provider-suggestions"
                  value={aiProvider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  placeholder="e.g. openrouter, openai, custom-provider"
                  className="w-full bg-surface-container-lowest border border-outline-variant px-5 py-4 rounded-lg text-on-surface font-body-base focus:border-primary focus:ring-0 pulse-focus transition-all"
                />
                <datalist id="provider-suggestions">
                  <option value="openrouter" />
                  <option value="openai" />
                  <option value="anthropic" />
                  <option value="groq" />
                  <option value="gemini" />
                  <option value="local" />
                </datalist>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-label-mono text-on-surface-variant uppercase tracking-widest pl-1">Model ID</label>
                <input 
                  type="text"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="e.g. anthropic/claude-3.5-sonnet"
                  className="w-full bg-surface-container-lowest border border-outline-variant px-5 py-4 rounded-lg text-on-surface font-body-base focus:border-primary focus:ring-0 pulse-focus transition-all"
                />
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-surface-container-low border border-outline-variant/50 p-4 rounded-lg flex flex-col items-center gap-2 text-center group/card hover:border-primary/50 transition-colors">
                  <span className="material-symbols-outlined text-primary-fixed-dim" style={{fontVariationSettings: "'FILL' 1"}}>speed</span>
                  <span className="text-label-mono text-[10px] uppercase">Status</span>
                  <span className="text-on-surface font-semibold">{health?.status || 'UNKNOWN'}</span>
                </div>
                <div className="bg-surface-container-low border border-outline-variant/50 p-4 rounded-lg flex flex-col items-center gap-2 text-center group/card hover:border-primary/50 transition-colors">
                  <span className="material-symbols-outlined text-primary-fixed-dim" style={{fontVariationSettings: "'FILL' 1"}}>memory</span>
                  <span className="text-label-mono text-[10px] uppercase">Uptime</span>
                  <span className="text-on-surface font-semibold">{formatUptime(health?.uptime)}</span>
                </div>
                <div className="bg-surface-container-low border border-outline-variant/50 p-4 rounded-lg flex flex-col items-center gap-2 text-center group/card hover:border-primary/50 transition-colors">
                  <span className="material-symbols-outlined text-primary-fixed-dim" style={{fontVariationSettings: "'FILL' 1"}}>token</span>
                  <span className="text-label-mono text-[10px] uppercase">Events</span>
                  <span className="text-on-surface font-semibold">{health?.totalEvents || 0}</span>
                </div>
              </div>
            </div>
          </section>

          {/* API Key Management */}
          <section className="col-span-12 lg:col-span-4 glass-panel rim-light p-gutter rounded-xl border border-outline-variant flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-secondary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-on-secondary-container">key</span>
              </div>
              <div>
                <h2 className="font-headline-md text-headline-md">API Key</h2>
                <p className="text-body-sm text-on-surface-variant">Multi-key AI Access</p>
              </div>
            </div>
            
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input 
                    type="password" 
                    value={aiKey}
                    onChange={(e) => setAiKey(e.target.value)}
                    placeholder="Enter API Key" 
                    className="w-full bg-surface-container-lowest border border-outline-variant px-4 py-3 rounded-lg text-on-surface font-label-mono focus:border-primary focus:ring-0 pulse-focus transition-all"
                  />
                </div>
                <button 
                  onClick={handleSaveAiConfig}
                  title="Save configuration"
                  className="w-12 h-12 flex items-center justify-center bg-surface-container-highest border border-outline-variant hover:border-primary text-primary rounded-lg transition-all active:scale-90"
                >
                  <span className="material-symbols-outlined">{saveStatus ? 'check' : 'save'}</span>
                </button>
              </div>

              {/* Test Connection Button */}
              <button
                onClick={handleTestConnection}
                disabled={testStatus === 'testing' || !aiKey}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm
                  border-primary/40 text-primary hover:bg-primary/10"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {testStatus === 'testing' ? 'hourglass_top' : testStatus === 'success' ? 'check_circle' : testStatus.startsWith('error') ? 'error' : 'wifi_tethering'}
                </span>
                {testStatus === 'testing' ? 'Menghubungkan...' 
                  : testStatus === 'success' ? '✓ Koneksi Berhasil!' 
                  : testStatus.startsWith('error') ? 'Koneksi Gagal' 
                  : 'Test Connection'}
              </button>

              {/* Error detail */}
              {testStatus.startsWith('error:') && (
                <div className="p-3 rounded-lg bg-error/10 border border-error/30">
                  <p className="text-[11px] text-error leading-relaxed break-words">{testStatus.replace('error:', '')}</p>
                </div>
              )}
            </div>
            
            <div className="mt-6 p-4 rounded-lg bg-primary-container/5 border border-primary/20">
              <p className="text-body-sm text-primary/80 leading-relaxed italic">"Masukkan API Key yang sesuai dengan provider pilihan Anda. Jika menggunakan OpenRouter, gunakan OpenRouter API Key. Klik <strong>Save</strong>, kemudian <strong>Test Connection</strong> untuk memastikan koneksi AI berhasil."</p>
            </div>
          </section>


          {/* Adaptive Model Tiering — 3 slot kurasi Owner, khusus jalur Assistant.
              Sistem hanya memutuskan TINGKAT mana yang dipakai per pesan (TierClassifierService,
              deterministik tanpa LLM); model apa yang mengisi tiap tingkat sepenuhnya pilihan Owner. */}
          <section className="col-span-12 glass-panel rim-light p-4 md:p-gutter rounded-xl border border-outline-variant">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">layers</span>
              </div>
              <div>
                <h2 className="font-headline-md text-headline-md">Adaptive Model Tiering</h2>
                <p className="text-body-sm text-on-surface-variant">Model per tingkat percakapan — khusus Assistant</p>
              </div>
            </div>

            <p className="text-[11px] text-on-surface-variant leading-relaxed mb-5">
              Sistem memilih <strong>tingkat</strong> otomatis tiap pesan (tanpa biaya token — murni kata kunci &amp; panjang pesan).
              Anda yang menentukan <strong>model</strong> di tiap tingkat. Engineer tidak memakai slot ini — Engineer tetap pakai
              Provider/Model utama di atas. Kalau slot dibiarkan sama semua, tidak ada perubahan perilaku.
            </p>

            <div className="space-y-4">
              {[
                { id: 'KECIL', label: 'Kecil', hint: 'Sapaan, afirmasi, pesan pendek — juga dipakai semua request LOOKUP' },
                { id: 'SEDANG', label: 'Sedang', hint: 'Default kalau pesan tidak tergolong ringan maupun berat' },
                { id: 'THINKING', label: 'Thinking', hint: 'Analisis, perbandingan, perancangan, pesan panjang' }
              ].map(tier => {
                const slot = modelTiers[tier.id] || {};
                return (
                  <div key={tier.id} className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/50">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-label-mono text-primary uppercase tracking-widest text-xs font-bold">{tier.label}</span>
                      <span className="text-[10px] text-on-surface-variant">{tier.hint}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        list="provider-suggestions"
                        value={slot.provider || ''}
                        onChange={(e) => handleTierChange(tier.id, 'provider', e.target.value)}
                        placeholder="Provider"
                        className="w-full bg-surface-container-lowest border border-outline-variant px-4 py-3 rounded-lg text-on-surface text-sm focus:border-primary focus:ring-0 transition-all"
                      />
                      <input
                        type="text"
                        value={slot.model || ''}
                        onChange={(e) => handleTierChange(tier.id, 'model', e.target.value)}
                        placeholder="Model ID"
                        className="w-full bg-surface-container-lowest border border-outline-variant px-4 py-3 rounded-lg text-on-surface text-sm font-mono focus:border-primary focus:ring-0 transition-all"
                      />
                    </div>
                    {/* Toggle reasoning. Sengaja hanya bisa MENYALAKAN: kalau mati, tidak ada
                        parameter apa pun yang dikirim ke provider (bukan dikirim sebagai "off").
                        Alasannya ada di komentar ai_adapter.ts — OpenRouter menolak dengan 400
                        kalau parameter reasoning dikirim ke model yang tidak mendukungnya. */}
                    <label className="mt-3 flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={slot.thinking === true}
                        onChange={(e) => handleTierChange(tier.id, 'thinking', e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-[11px] leading-relaxed">
                        <span className="text-on-surface font-medium group-hover:text-primary transition-colors">Nyalakan reasoning mendalam</span>
                        <span className="block text-on-surface-variant mt-0.5">
                          Hanya untuk model yang memang mendukungnya. Kalau dinyalakan di model biasa,
                          provider bisa menolak permintaan dengan error 400. Dibiarkan mati = model
                          memakai perilaku bawaannya.
                        </span>
                      </span>
                    </label>

                    <input
                      type="text"
                      value={slot.note || ''}
                      onChange={(e) => handleTierChange(tier.id, 'note', e.target.value)}
                      placeholder="Catatan opsional — kenapa model ini dipilih (untuk pengingat nanti)"
                      className="mt-3 w-full bg-transparent border-b border-outline-variant/60 px-1 py-2 text-on-surface-variant text-xs focus:border-primary focus:ring-0 transition-all"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-5 p-3 rounded-lg bg-primary-container/5 border border-primary/20">
              <p className="text-[11px] text-primary/80 leading-relaxed">
                Perubahan tersimpan otomatis dan disinkronkan ke akun Anda, jadi ikut terbawa ke device lain.
                API Key diambil dari provider yang sama seperti yang sudah Anda simpan di bagian API Key di atas.
              </p>
            </div>
          </section>


          {/* Batas Biaya Harian — circuit breaker per akun.
              Nilai efektif = min(batas pribadi ini, plafon sistem). Plafon hanya bisa diubah
              lewat service role, supaya tidak ada pengguna yang bisa menaikkan jatah belanjanya
              sendiri di atas API key sistem. */}
          <section className="col-span-12 glass-panel rim-light p-4 md:p-gutter rounded-xl border border-outline-variant">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">savings</span>
              </div>
              <div>
                <h2 className="font-headline-md text-headline-md">Batas Biaya Harian</h2>
                <p className="text-body-sm text-on-surface-variant">Circuit breaker otomatis saat pemakaian AI melewati batas</p>
              </div>
            </div>

            <p className="text-[11px] text-on-surface-variant leading-relaxed mb-4">
              Batas pribadi Anda hanya bisa <strong>memperketat</strong>, tidak bisa melewati plafon sistem
              {systemCap !== null ? <> (saat ini <strong>${systemCap.toFixed(2)}</strong>)</> : null}.
              Kosongkan untuk mengikuti plafon sistem apa adanya.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-on-surface-variant text-sm">$</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={dailyCap}
                  onChange={(e) => setDailyCap(e.target.value)}
                  placeholder={systemCap !== null ? systemCap.toFixed(2) : '1.00'}
                  className="w-full bg-surface-container-lowest border border-outline-variant px-4 py-3 rounded-lg text-on-surface font-mono text-sm focus:border-primary focus:ring-0 transition-all"
                />
                <span className="text-on-surface-variant text-xs whitespace-nowrap">per hari</span>
              </div>
              <button
                onClick={handleSaveDailyCap}
                disabled={capStatus === 'saving'}
                className="px-5 py-3 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                {capStatus === 'saving' ? 'Menyimpan...' : capStatus === 'done' ? 'Tersimpan' : 'Simpan Batas'}
              </button>
            </div>

            {capStatus.startsWith('error:') && (
              <div className="mt-3 p-3 rounded-lg bg-error/10 border border-error/30">
                <p className="text-[11px] text-error leading-relaxed break-words">{capStatus.replace('error:', '')}</p>
              </div>
            )}
          </section>


          {/* Tools & Capabilities */}
          <section className="col-span-12 glass-panel rim-light p-4 md:p-gutter rounded-xl border border-outline-variant">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">tune</span>
              </div>
              <div>
                <h2 className="font-headline-md text-headline-md">Tools & Capabilities</h2>
                <p className="text-body-sm text-on-surface-variant">Atur tool mana yang boleh dipakai AI, secara global atau per workspace.</p>
              </div>
            </div>

            {/* Default Global */}
            <div className="mb-6">
              <label className="text-label-mono text-on-surface-variant uppercase tracking-widest pl-1 mb-2 block">Default (Semua Workspace)</label>
              <div className="flex flex-wrap gap-3">
                {toolNames.map(toolName => {
                  const enabled = toolPreferencesService ? toolPreferencesService.getGlobalDefault(toolName) : true;
                  return (
                    <button
                      key={toolName}
                      onClick={() => handleToggleGlobal(toolName)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all active:scale-95 font-semibold text-sm
                        ${enabled ? 'border-primary/50 bg-primary/10 text-primary' : 'border-outline-variant bg-surface-container-low text-on-surface-variant'}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {enabled ? 'toggle_on' : 'toggle_off'}
                      </span>
                      {TOOL_LABELS[toolName] || toolName}
                    </button>
                  );
                })}
              </div>
              {!toolPreferencesService?.getGlobalDefault('web_search') ? null : (
                <p className="text-body-sm text-on-surface-variant italic mt-2">
                  Web Search nyala = dicari otomatis saat dibutuhkan, tanpa dialog konfirmasi tiap kali.
                </p>
              )}
            </div>

            {/* Per-workspace override */}
            <div>
              <label className="text-label-mono text-on-surface-variant uppercase tracking-widest pl-1 mb-2 block">Override per Workspace</label>
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="text-on-surface-variant text-left">
                      <th className="py-2 pr-4 font-semibold">Workspace</th>
                      {toolNames.map(toolName => (
                        <th key={toolName} className="py-2 pr-4 font-semibold">{TOOL_LABELS[toolName] || toolName}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TOGGLEABLE_WORKSPACES.map(ws => (
                      <tr key={ws.id} className="border-t border-outline-variant/50">
                        <td className="py-3 pr-4 text-on-surface font-medium">{ws.label}</td>
                        {toolNames.map(toolName => {
                          const override = toolPreferencesService ? toolPreferencesService.getWorkspaceOverride(ws.id, toolName) : null;
                          const value = override === null ? 'default' : (override ? 'on' : 'off');
                          return (
                            <td key={toolName} className="py-3 pr-4">
                              <select
                                value={value}
                                onChange={(e) => handleSetWorkspaceOverride(ws.id, toolName, e.target.value)}
                                className="bg-surface-container-lowest border border-outline-variant px-3 py-2 rounded-lg text-on-surface text-body-sm focus:border-primary focus:ring-0"
                              >
                                <option value="default">Ikuti Default</option>
                                <option value="on">Nyalakan</option>
                                <option value="off">Matikan</option>
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Tool Registry — folder tools/ di root repo, discan otomatis saat boot,
              atau manual lewat tombol ini tanpa perlu restart app. */}
          <section className="col-span-12 glass-panel rim-light p-4 md:p-gutter rounded-xl border border-outline-variant">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary-container/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-secondary-container">extension</span>
                </div>
                <div>
                  <h2 className="font-headline-md text-headline-md">Tool Registry</h2>
                  <p className="text-body-sm text-on-surface-variant">Tool yang di-scan dari folder <code>tools/</code> di root repo — taruh file baru di sana lalu scan ulang, tanpa perlu restart app.</p>
                </div>
              </div>
              <button
                onClick={handleScanTools}
                disabled={scanStatus === 'scanning'}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {scanStatus === 'scanning' ? 'hourglass_top' : scanStatus === 'done' ? 'check_circle' : 'refresh'}
                </span>
                {scanStatus === 'scanning' ? 'Memindai...' : scanStatus === 'done' ? 'Selesai' : 'Scan Ulang Tools'}
              </button>
            </div>

            {lastScan?.at && (
              <p className="text-body-sm text-on-surface-variant mb-3">
                Scan terakhir: {new Date(lastScan.at).toLocaleTimeString('id-ID')} — {lastScan.found} file ditemukan di <code>tools/</code>
                {lastScan.errors?.length > 0 && <span className="text-error"> ({lastScan.errors.length} gagal dimuat)</span>}
              </p>
            )}

            {lastScan?.errors?.length > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-error/10 border border-error/30 space-y-1">
                {lastScan.errors.map((err, i) => (
                  <p key={i} className="text-[11px] text-error"><code>{err.file}</code>: {err.message}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {registeredTools.map(tool => (
                <div key={tool.name} className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">bolt</span>
                    <span className="font-mono text-sm font-semibold text-on-surface">{tool.name}</span>
                    {tool.category && <span className="text-[10px] uppercase tracking-wide text-on-surface-variant bg-surface-container-highest px-1.5 py-0.5 rounded">{tool.category}</span>}
                  </div>
                  <p className="text-body-sm text-on-surface-variant">{tool.description || '(tidak ada deskripsi)'}</p>
                </div>
              ))}
              {registeredTools.length === 0 && (
                <p className="text-body-sm text-on-surface-variant italic">Belum ada tool terdaftar.</p>
              )}
            </div>
          </section>

          {/* Identity & Danger Zone */}
          <section className="col-span-12 glass-panel rim-light p-gutter rounded-xl border border-outline-variant">
             <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-headline-md text-headline-md mb-2">User Identity</h3>
                  <div className="text-body-base text-on-surface-variant">
                    Name: {user?.name || 'Loading...'} <br/>
                    Email: {user?.email || 'Loading...'}
                  </div>
                </div>
                <div className="flex-1 flex justify-end">
                  <button
                    onClick={async () => await supabase.auth.signOut()}
                    className="px-6 py-3 bg-error-container/20 text-error rounded-lg font-semibold flex items-center gap-2 hover:bg-error-container/40 transition-all active:scale-95 border border-error/30"
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    <span>Sign Out of Ecosystem</span>
                  </button>
                </div>
             </div>
          </section>

        </div>
      </div>
    </div>
  );
}
