/**
 * BrainService
 * Manages the AI Brain configuration (Provider & Model).
 * Interfaces with VaultService for credentials.
 * 
 * FIX: Model sekarang disimpan bersamaan dengan provider agar pilihan dari
 * Settings UI tidak hilang saat pesan dikirim ke backend.
 * 
 * UPGRADE: executeLLM() ditambahkan agar Engineer.js dapat memanggil LLM
 * langsung tanpa harus melewati ConversationEngine.
 *
 * SECURITY FIX (2026-07-30): executeLLM() sekarang WAJIB memiliki API key eksplisit
 * dari user (via VaultService/Settings). Jika tidak ada, request DITOLAK dengan error
 * informatif. Ini mencegah fallback ke Supabase yang akan memakai API key sistem
 * dan menghabiskan saldo tanpa izin user.
 *
 * DEFAULT PROVIDER diubah dari 'openrouter' (berbayar, model mahal) ke 'gemini'
 * untuk mencegah saldo habis saat settings belum dikonfigurasi.
 *
 * ADAPTIVE MODEL TIERING (2026-09-09, ROADMAP-ADAPTIVE-MODEL-TIERING.md):
 * `state.provider`/`state.model` TETAP ADA dan tetap jadi model utama untuk jalur non-tier
 * (Engineer lewat executeLLM(), dan pemanggil getActiveBrainContext() tanpa argumen) — sesuai
 * roadmap §3 yang menegaskan Engineer di luar sistem tiering. Yang baru adalah `state.tiers`:
 * 3 slot kurasi Owner (KECIL/SEDANG/THINKING) yang hanya dipakai jalur Assistant.
 */
import { supabase } from '../../../supabase';

const TIER_NAMES = ['KECIL', 'SEDANG', 'THINKING'];
const TIERS_STORAGE_KEY = 'maef_model_tiers';
const TIERS_METADATA_KEY = 'model_tiers';

class BrainService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.state = {
      provider: 'gemini',         // [SECURITY FIX] Default ke Gemini (free tier tersedia), bukan OpenRouter yang berbayar
      model: 'gemini-2.0-flash',  // [SECURITY FIX] Model ringan sebagai default aman
      tiers: null                 // Diisi saat initialize(): { KECIL: {...}, SEDANG: {...}, THINKING: {...} }
    };
  }

  async initialize() {
    const savedProvider = localStorage.getItem('maef_ai_provider');
    const savedModel = localStorage.getItem('maef_ai_model');
    if (savedProvider) this.state.provider = savedProvider;
    if (savedModel) this.state.model = savedModel;

    this.state.tiers = this._loadTiersFromLocalStorage() || this._seedTiersFromMainModel();
    console.log(`[BrainService] Initialized with provider: ${this.state.provider}, model: ${this.state.model}`);

    // Sinkron lintas device: user_metadata menang atas localStorage kalau ada (Owner bisa
    // mengubah config dari device lain). Sengaja tidak di-await di jalur boot supaya kegagalan
    // jaringan tidak pernah memblokir Kernel — hasilnya diumumkan lewat event kalau berubah.
    this._hydrateTiersFromSupabase();
  }

  /**
   * Slot tier awal = salinan model utama untuk ketiganya. Konsekuensinya perilaku Assistant
   * TIDAK berubah sama sekali sampai Owner benar-benar mengisi slot berbeda di Settings —
   * tiering yang aktif tapi belum dikurasi tidak boleh diam-diam mengganti model Owner.
   */
  _seedTiersFromMainModel() {
    const seed = {};
    for (const tier of TIER_NAMES) {
      seed[tier] = { provider: this.state.provider, model: this.state.model, thinking: false, note: '' };
    }
    return seed;
  }

  _loadTiersFromLocalStorage() {
    try {
      const raw = localStorage.getItem(TIERS_STORAGE_KEY);
      if (!raw) return null;
      return this._normalizeTiers(JSON.parse(raw));
    } catch (e) {
      console.warn('[BrainService] Gagal membaca model tiers dari localStorage:', e.message);
      return null;
    }
  }

  /** Pastikan ketiga slot selalu ada & terisi, apa pun bentuk data yang tersimpan sebelumnya. */
  _normalizeTiers(rawTiers) {
    const normalized = {};
    for (const tier of TIER_NAMES) {
      const slot = rawTiers?.[tier] || {};
      normalized[tier] = {
        provider: slot.provider || this.state.provider,
        model: slot.model || this.state.model,
        thinking: slot.thinking === true,
        note: slot.note || ''
      };
    }
    return normalized;
  }

  async _hydrateTiersFromSupabase() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const remoteTiers = user?.user_metadata?.[TIERS_METADATA_KEY];
      if (!remoteTiers) return;

      this.state.tiers = this._normalizeTiers(remoteTiers);
      localStorage.setItem(TIERS_STORAGE_KEY, JSON.stringify(this.state.tiers));
      console.log('[BrainService] Model tiers disinkron dari user_metadata (lintas device)');
      this.eventBus?.emit('Brain:TiersUpdated', { tiers: { ...this.state.tiers }, source: 'supabase' });
    } catch (e) {
      console.warn('[BrainService] Gagal sinkron model tiers dari Supabase (pakai lokal):', e.message);
    }
  }

  /**
   * Versi debounced — Settings UI memanggil setTier() tiap ketikan, tanpa ini setiap karakter
   * jadi satu request updateUser ke Supabase (pola masalah yang sama sudah pernah ditangani
   * WorkspaceManager._debouncedSyncLayoutToSupabase saat resize/drag).
   */
  _debouncedSyncTiersToSupabase() {
    clearTimeout(this._tierSyncTimeout);
    this._tierSyncTimeout = setTimeout(() => this._syncTiersToSupabase(), 1500);
  }

  /** Pola identik dengan WorkspaceManager._syncLayoutToSupabase() yang sudah terbukti jalan. */
  async _syncTiersToSupabase() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.auth.updateUser({ data: { [TIERS_METADATA_KEY]: this.state.tiers } });
      console.log('[BrainService] Model tiers tersinkron ke Supabase user_metadata');
    } catch (e) {
      console.error('[BrainService] Gagal sinkron model tiers ke Supabase:', e.message);
    }
  }

  getTiers() {
    return { ...(this.state.tiers || this._seedTiersFromMainModel()) };
  }

  /**
   * Simpan satu slot tier (dipakai Settings UI). Menulis ke localStorage untuk device ini,
   * lalu menyinkronkan ke user_metadata supaya device lain ikut terbarui.
   */
  setTier(tierName, { provider, model, thinking, note } = {}) {
    if (!TIER_NAMES.includes(tierName)) {
      console.warn(`[BrainService] Tier tidak dikenal: ${tierName}`);
      return;
    }
    if (!this.state.tiers) this.state.tiers = this._seedTiersFromMainModel();

    const current = this.state.tiers[tierName];
    this.state.tiers[tierName] = {
      provider: provider ?? current.provider,
      model: model ?? current.model,
      thinking: thinking ?? current.thinking,
      note: note ?? current.note
    };

    localStorage.setItem(TIERS_STORAGE_KEY, JSON.stringify(this.state.tiers));
    this.eventBus?.emit('Brain:TiersUpdated', { tiers: { ...this.state.tiers }, source: 'local' });
    this._debouncedSyncTiersToSupabase();
  }

  setBrain(provider, model) {
    this.state.provider = provider;
    if (model) this.state.model = model;
    localStorage.setItem('maef_ai_provider', provider);
    if (model) localStorage.setItem('maef_ai_model', model);
    
    if (this.eventBus) {
      this.eventBus.emit('Brain:ConfigUpdated', { ...this.state });
    }
  }

  getBrainConfig() {
    return { ...this.state };
  }

  /**
   * Retrieves the active brain context (provider, model, apiKey) for an API call.
   * API key diambil dari VaultService yang terisi saat user Save di Settings.
   *
   * @param {'KECIL'|'SEDANG'|'THINKING'} [tierName] - Kalau diisi, ambil dari slot tier hasil
   *   kurasi Owner (jalur Assistant). Kalau kosong, pakai model utama seperti sebelumnya —
   *   inilah yang dipakai Engineer (executeLLM) supaya jalurnya tidak tersentuh tiering.
   */
  async getActiveBrainContext(tierName) {
    const vault = this.serviceManager.get('VaultService');
    const slot = (tierName && this.state.tiers?.[tierName]) || null;

    const provider = slot?.provider || this.state.provider;
    const model = slot?.model || this.state.model;
    const key = vault ? vault.getKey(provider) : null;

    return {
      provider,
      model,
      key,
      tier: slot ? tierName : null,
      // Tersambung penuh ke LLM sejak Item 35 (2026-09-09): AssistantService mengirimnya di
      // payload sebagai `thinking`, request_parser meneruskannya ke RuntimeContext.model.thinking,
      // dan ai_adapter.ts menerjemahkannya ke parameter reasoning masing-masing provider.
      // Catatan penting: true = nyalakan reasoning; false = TIDAK mengirim apa pun (bukan
      // "matikan reasoning"). Lihat komentar di ai_adapter.ts untuk alasannya.
      thinking: slot?.thinking === true
    };
  }

  /**
   * Memanggil LLM via backend lokal (localhost:3000/api/chat).
   * Digunakan oleh Engineer untuk membuat patch.
   * 
   * PENTING: Menggunakan backend lokal karena Supabase edge function memiliki
   * verification layer yang menolak prompt berisi kode sumber / instruksi modifikasi file.
   * Backend lokal menerima: { message, provider, model, apiKey }
   * Backend lokal mengembalikan: { reply: "..." }
   * 
   * Jika backend lokal tidak tersedia, fallback ke Supabase (dengan risiko verification).
   * 
   * @param {string} prompt - Prompt lengkap untuk dikirim ke LLM
   * @param {object} options - Opsi override (model, dll)
   * @returns {Promise<string>} - Raw text response dari LLM
   */
  async executeLLM(prompt, options = {}) {
    const context = await this.getActiveBrainContext();
    const model = options.model || context.model || this.state.model;
    const provider = context.provider || this.state.provider;
    const apiKey = context.key || '';

    // === [SECURITY FIX] GUARD: WAJIB ADA API KEY EKSPLISIT DARI USER ===
    // Jika tidak ada apiKey dari VaultService/Settings, TOLAK langsung.
    // Ini mencegah fallback ke Supabase yang memakai API key sistem (saldo habis).
    if (!apiKey) {
      const errorMsg = [
        `[BrainService:executeLLM] 🚫 DITOLAK: Tidak ada API Key untuk provider "${provider}".`,
        `Silakan masuk ke Settings → AI Provider dan masukkan API Key Anda.`,
        `Engineer tidak dapat membuat patch tanpa API Key eksplisit dari user.`
      ].join('\n');
      console.error(errorMsg);
      throw new Error(
        `Tidak ada API Key untuk provider "${provider}". ` +
        `Buka Settings → AI Provider dan masukkan API Key Anda terlebih dahulu.`
      );
    }

    console.log(`[BrainService:executeLLM] 🧠 Memanggil LLM: provider=${provider}, model=${model}`);

    // === COBA BACKEND LOKAL DULU (localhost:3000/api/chat) ===
    // Backend lokal tidak memiliki verification layer seperti Supabase
    const localEndpoint = 'http://localhost:3000/api/chat';
    const localPayload = {
      message: prompt,
      provider: provider,
      model: model,
      history: [],
      userName: 'Engineer',
      max_tokens: 16000,    // Pastikan output tidak terpotong untuk patch file besar
    };
    if (apiKey) localPayload.apiKey = apiKey;

    try {
      console.log(`[BrainService:executeLLM] 📡 Mencoba local backend: ${localEndpoint}`);
      const response = await fetch(localEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localPayload)
      });

      if (response.ok) {
        const result = await response.json();
        // Local backend mengembalikan field 'reply'
        const rawText = result?.reply || result?.message || result?.content || result?.text || JSON.stringify(result);
        console.log(`[BrainService:executeLLM] ✅ Local backend response: ${rawText.length} chars`);
        console.log(`[BrainService:executeLLM] 🔍 First 200 chars: ${rawText.substring(0, 200)}`);
        return rawText;
      } else {
        const errText = await response.text();
        console.warn(`[BrainService:executeLLM] ⚠️ Local backend error ${response.status}: ${errText}. Fallback ke Supabase...`);
      }
    } catch (localErr) {
      console.warn(`[BrainService:executeLLM] ⚠️ Local backend tidak tersedia: ${localErr.message}. Fallback ke Supabase...`);
    }

    // === FALLBACK KE SUPABASE (jika local backend tidak jalan) ===
    let token = '';
    try {
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('auth-token')) {
            try {
              const parsed = JSON.parse(localStorage.getItem(key));
              if (parsed?.access_token) { token = parsed.access_token; break; }
            } catch (_) {}
          }
        }
      }
    } catch (e) {}

    const authToken = token || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_ANON_KEY : '') || '';
    const supabaseEndpoint = 'https://uuyzdjifhdfyyvpxsofu.supabase.co/functions/v1/agent-process';
    const supabasePayload = {
      message: prompt,
      mode: 'ENGINEER',
      appSource: 'engineer',
      history: [],
      globalMemory: '',
      stream: false,
      ragEnabled: false,
      model: model || undefined
    };
    if (!supabasePayload.model) delete supabasePayload.model;

    const supabaseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken.replace(/[^\x00-\x7F]/g, '')}`
    };
    if (apiKey) {
      const cleanKey = apiKey.replace(/[^\x00-\x7F]/g, '');
      if (provider === 'openrouter') supabaseHeaders['x-byok-openrouter'] = cleanKey;
      else if (provider === 'openai') supabaseHeaders['x-byok-openai'] = cleanKey;
      else if (provider === 'groq') supabaseHeaders['x-byok-groq'] = cleanKey;
      else if (provider === 'gemini') supabaseHeaders['x-byok-gemini'] = cleanKey;
      else if (provider === 'anthropic') supabaseHeaders['x-byok-anthropic'] = cleanKey;
    }

    try {
      console.log(`[BrainService:executeLLM] 📡 Mencoba Supabase fallback...`);
      const response = await fetch(supabaseEndpoint, {
        method: 'POST',
        headers: supabaseHeaders,
        body: JSON.stringify(supabasePayload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Supabase error ${response.status}: ${errText}`);
      }

      const result = await response.json();
      const rawText = result?.message || result?.reply || result?.content || result?.text || JSON.stringify(result);

      // Deteksi "Verification Failed" atau respons singkat yang mengindikasikan penolakan
      if (rawText.length < 50 && (rawText.includes('Failed') || rawText.includes('Verification') || rawText.includes('Error'))) {
        throw new Error(`Supabase menolak prompt (verification): "${rawText}". Pastikan backend lokal berjalan.`);
      }

      console.log(`[BrainService:executeLLM] ✅ Supabase response: ${rawText.length} chars`);
      console.log(`[BrainService:executeLLM] 🔍 First 200 chars: ${rawText.substring(0, 200)}`);
      return rawText;
    } catch (e) {
      console.error('[BrainService:executeLLM] ❌ Semua endpoint gagal:', e.message);
      throw e;
    }
  }
}

export { BrainService };