
import { supabase } from '../../../supabase.js';
import { ringkasKueri } from '../../../../../shared/kueri_pencarian.js';
import { entitas, tanpaTag, urlAsliBing } from '../../../../../shared/teks_rss.js';
import { uraiHasilDdg } from '../../../../../shared/webAlat.js';

export const WEB_SEARCH_TIMEOUT_MS = 8000;
export const WEB_SUFFICIENCY_SCORE = 0.7;

function tanggalTerbit(pubDate) {
  const t = Date.parse(pubDate || '');
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class WebComparisonService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = null;
    this.isInitialized = false;
    this.pendingConfirmations = new Map();
    this.customSearchHandler = null;
  }

  async initialize() {
    if (this.isInitialized) return;

    if (this.serviceManager && this.serviceManager.has('EventBus')) {
      this.eventBus = this.serviceManager.get('EventBus');
    }

    this.isInitialized = true;
    console.log('[WebComparisonService] Initialized & Ready (Tier 3 Active, Human-in-Command Enabled)');
  }

  setSearchHandler(handler) {
    this.customSearchHandler = handler;
  }


  async requestConfirmation({ query, traceId, reason }) {
    const requestId = `CONF-WEB-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const confirmationPayload = {
      requestId,
      query,
      traceId: traceId || null,
      reason: reason || 'Dokumen lokal & pengetahuan internal model belum mencukupi.',
      timeoutMs: WEB_SEARCH_TIMEOUT_MS,
      timestamp: new Date().toISOString()
    };

    console.log(`[WebComparisonService] 🛑 Human-in-Command: Menunggu konfirmasi Owner untuk web search: "${query}" [${requestId}]`);

    if (this.eventBus?.emit) {
      this.eventBus.emit('Retrieval:RequestWebConfirmation', confirmationPayload);
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingConfirmations.has(requestId)) {
          console.warn(`[WebComparisonService] ⏱️ Konfirmasi Owner timed out setelah 45s: ${requestId}`);
          this.pendingConfirmations.delete(requestId);
          if (this.eventBus?.emit) {
            this.eventBus.emit('Retrieval:WebConfirmationTimeout', { requestId });
          }
          resolve(false);
        }
      }, 45000);

      this.pendingConfirmations.set(requestId, {
        query,
        traceId,
        resolve: (val) => {
          clearTimeout(timeoutId);
          resolve(val);
        },
        timeoutId,
        createdAt: Date.now()
      });
    });
  }

  resolveConfirmation(requestId, isApproved) {
    const actualId = (typeof requestId === 'object' && requestId !== null)
      ? (requestId.requestId || requestId.id)
      : requestId;

    if (!actualId) {
      console.warn(`[WebComparisonService] Konfirmasi web search tidak ditemukan atau sudah selesai: ${actualId}`);
      return false;
    }

    const pending = this.pendingConfirmations.get(actualId);
    if (!pending) {
      console.warn(`[WebComparisonService] Konfirmasi web search tidak ditemukan atau sudah selesai: ${actualId}`);
      return false;
    }

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }
    this.pendingConfirmations.delete(actualId);

    if (!isApproved) {
      console.log(`[WebComparisonService] ❌ Owner MENOLAK pencarian web [${actualId}]. Eksekusi dibatalkan (0 web cost/latency).`);
      if (this.eventBus?.emit) {
        this.eventBus.emit('Retrieval:WebConfirmationRejected', { requestId: actualId });
      }
      pending.resolve(false);
      return true;
    }

    console.log(`[WebComparisonService] ✅ Owner MENYETUJUI pencarian web [${actualId}]. Melanjutkan eksekusi...`);
    if (this.eventBus?.emit) {
      this.eventBus.emit('Retrieval:WebConfirmationApproved', { requestId: actualId });
    }
    pending.resolve(true);
    return true;
  }


  async searchWeb(query, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const timestamp = new Date().toISOString();
    const traceId = options.traceId || null;
    const timeoutMs = options.timeoutMs || WEB_SEARCH_TIMEOUT_MS;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return {
        chunks: [],
        strategy: 'web_search_empty',
        sufficiency: 0.0,
        tier: 3,
        isFallback: true,
        status: 'FAILED',
        timeoutMs,
        error: 'Query pencarian kosong'
      };
    }

    if (!options.autoConfirm) {
      const isApproved = await this.requestConfirmation({
        query,
        traceId,
        reason: options.reason
      });

      if (!isApproved) {
        return {
          chunks: [],
          strategy: 'web_search_rejected',
          sufficiency: 0.0,
          tier: 3,
          isFallback: true,
          status: 'REJECTED',
          timeoutMs,
          error: 'Pencarian web tidak dikonfirmasi oleh pengguna (Ditolak)',
          fallbackDisclaimer: '⚠️ Pencarian web pembanding dibatalkan karena tidak mendapatkan izin dari pengguna. Jawaban disusun dari Tier 1 & Tier 2.'
        };
      }
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    const startTime = Date.now();

    const kueriRingkas = ringkasKueri(query);
    let kueriDicari = kueriRingkas.length >= 2 ? kueriRingkas : query.trim();

    try {
      console.log(`[WebComparisonService] 🌐 Menjalankan pencarian web (Timeout: ${timeoutMs}ms) untuk: "${kueriDicari.substring(0, 60)}"`);

      const isTemporal = Boolean(options.isTemporal);
      const sumberWeb = options.sumberWeb;
      let rawResults = await this._executeFetch(kueriDicari, abortController.signal, { isTemporal, sumberWeb });
      if ((!rawResults || rawResults.length === 0) && kueriDicari !== query.trim() && !abortController.signal.aborted) {
        kueriDicari = query.trim();
        rawResults = await this._executeFetch(kueriDicari, abortController.signal, { isTemporal, sumberWeb });
      }
      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;

      if (!rawResults || rawResults.length === 0) {
        console.warn(`[WebComparisonService] Pencarian web tidak menghasilkan dokumen relevan (${durationMs}ms)`);
        
        if (this.eventBus?.emit) {
          this.eventBus.emit('Retrieval:Tier3WebComparison', {
            traceId,
            query: query.substring(0, 100),
            status: 'EMPTY',
            durationMs,
            chunksCount: 0
          });
        }

        return {
          chunks: [],
          strategy: 'web_search_no_results',
          sufficiency: 0.0,
          tier: 3,
          isFallback: true,
          status: 'FAILED',
          timeoutMs,
          kueriDicari,
          error: 'Pencarian web tidak mengembalikan hasil yang relevan.',
          fallbackDisclaimer: '⚠️ Pencarian web tidak menemukan referensi tambahan yang cocok. Menggunakan pengetahuan internal model.'
        };
      }

      const chunks = rawResults.map((item) => ({
        content: item.snippet || item.title || '',
        title: item.title || 'Web Result',
        source_type: item.source_type || 'web',
        isStaticEncyclopedia: Boolean(item.isStaticEncyclopedia),
        source_url: item.link || item.url || 'https://web-search-engine.net',
        terbit: tanggalTerbit(item.tanggal),
        similarity: item.isStaticEncyclopedia ? 0.6 : 0.75,
        retrieved_at: timestamp
      }));

      if (this.eventBus?.emit) {
        this.eventBus.emit('Retrieval:Tier3WebComparison', {
          traceId,
          query: query.substring(0, 100),
          status: 'SUCCESS',
          durationMs,
          chunksCount: chunks.length
        });
      }

      console.log(`[WebComparisonService] ✅ Web search sukses (${chunks.length} hasil, ${durationMs}ms)`);

      return {
        chunks,
        strategy: 'web_search_comparison',
        sufficiency: WEB_SUFFICIENCY_SCORE,
        tier: 3,
        isFallback: false,
        status: 'SUCCESS',
        timeoutMs,
        durationMs,
        kueriDicari
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError' || abortController.signal.aborted;
      const status = isTimeout ? 'TIMEOUT' : 'FAILED';
      const durationMs = Date.now() - startTime;

      console.warn(`[WebComparisonService] ⚠️ Web search ${status} (${durationMs}ms): ${err.message}`);

      if (this.eventBus?.emit) {
        this.eventBus.emit('Retrieval:Tier3WebComparison', {
          traceId,
          query: query.substring(0, 100),
          status,
          durationMs,
          chunksCount: 0,
          error: err.message
        });
      }

      return {
        chunks: [],
        strategy: isTimeout ? 'web_search_timeout' : 'web_search_error',
        sufficiency: 0.0,
        tier: 3,
        isFallback: true,
        status,
        timeoutMs,
        kueriDicari,
        error: isTimeout ? `Waktu tunggu pencarian web habis (Timeout ${timeoutMs}ms)` : err.message,
        fallbackDisclaimer: isTimeout
          ? `⚠️ Waktu tunggu pencarian web habis (Timeout ${timeoutMs / 1000}s). Sistem tidak memaksakan data web yang belum selesai. Menjawab dari Tier 1 & Tier 2.`
          : `⚠️ Pencarian web gagal menghubungi server pencari (${err.message}). Menjawab dari Tier 1 & Tier 2.`
      };
    }
  }

  async _safeFetch(url, options = {}) {
    let gagalDesktop = null;
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.fetchWeb === 'function') {
      try {
        const res = await window.electronAPI.fetchWeb(url, options);
        if (res && res.ok) {
          return {
            ok: true,
            status: res.status,
            text: async () => res.data || '',
            json: async () => JSON.parse(res.data || '{}')
          };
        }
        gagalDesktop = { status: res?.status || 0, error: res?.error || '' };
        console.warn(`[WebComparisonService] IPC fetchWeb non-ok: ${res?.status} (${res?.error || ''}) for ${url}`);
      } catch (ipcErr) {
        gagalDesktop = { status: 0, error: ipcErr.message };
        console.warn('[WebComparisonService] IPC fetchWeb exception:', ipcErr.message);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        if (supabase?.functions) {
          console.log(`[WebComparisonService] Menggunakan Edge Function proxy_fetch untuk: ${url}`);
          const { data, error } = await supabase.functions.invoke('agent-process', {
            body: { action: 'proxy_fetch', url }
          });
          if (!error && data) {
            if (data.ok) {
              console.log(`[WebComparisonService] Proxy fetch sukses (${(data.data || '').length} chars)`);
              return {
                ok: true,
                status: data.status,
                text: async () => data.data || '',
                json: async () => JSON.parse(data.data || '{}')
              };
            }
            console.warn(`[WebComparisonService] Proxy fetch remote status ${data.status} for ${url}`);
            return {
              ok: false,
              status: data.status || 500,
              text: async () => data.data || '',
              json: async () => ({})
            };
          }
          if (error) {
            console.warn('[WebComparisonService] Edge Function proxy bridge error:', error);
          }
        }
      } catch (proxyErr) {
        console.warn('[WebComparisonService] Proxy bridge exception:', proxyErr.message);
      }

      if (!url.includes('origin=*')) {
        return { ok: false, status: gagalDesktop?.status || 403, text: async () => '', json: async () => ({}) };
      }
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, text/html, application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      ...(options.headers || {})
    };
    return await fetch(url, { ...options, headers });
  }

  async _executeFetch(query, signal, options = {}) {
    if (this.customSearchHandler) {
      return await this.customSearchHandler(query, signal, options);
    }

    const isTemporal = Boolean(options.isTemporal);
    if (options.sumberWeb === 'umum') return this._cariWebUmum(query, signal);

    try {
      const bingUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`;
      const response = await this._safeFetch(bingUrl, { signal });

      if (response && response.ok) {
        const xml = await response.text();
        const results = this._parseRssResults(xml);
        if (results && results.length > 0) {
          console.log(`[WebComparisonService] Bing News RSS returned ${results.length} results`);
          return results;
        }
      }
    } catch (bingErr) {
      console.warn('[WebComparisonService] Bing News RSS fetch warning:', bingErr.message);
    }

    try {
      const gnewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
      const response = await this._safeFetch(gnewsUrl, { signal });

      if (response && response.ok) {
        const xml = await response.text();
        const results = this._parseRssResults(xml);
        if (results && results.length > 0) {
          console.log(`[WebComparisonService] Google News RSS ID returned ${results.length} results`);
          return results;
        }
      }
    } catch (gnewsErr) {
      console.warn('[WebComparisonService] Google News RSS ID fetch warning:', gnewsErr.message);
    }

    try {
      const gnewsGlobalUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const responseGlobal = await this._safeFetch(gnewsGlobalUrl, { signal });
      if (responseGlobal && responseGlobal.ok) {
        const xml = await responseGlobal.text();
        const results = this._parseRssResults(xml);
        if (results && results.length > 0) {
          console.log(`[WebComparisonService] Google News Global returned ${results.length} results`);
          return results;
        }
      }
    } catch (globalErr) {
      console.warn('[WebComparisonService] Google News Global warning:', globalErr.message);
    }

    try {
      const antaraUrl = `https://www.antaranews.com/rss/tekno`;
      const responseAntara = await this._safeFetch(antaraUrl, { signal });
      if (responseAntara && responseAntara.ok) {
        const xml = await responseAntara.text();
        const rawResults = this._parseRssResults(xml);
        const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const matchingResults = rawResults.filter(item => {
          const text = (item.title + ' ' + item.snippet).toLowerCase();
          return queryTerms.some(term => text.includes(term));
        });

        if (matchingResults.length > 0) {
          console.log(`[WebComparisonService] Antara News Tekno returned ${matchingResults.length} matching results`);
          return matchingResults;
        }
      }
    } catch (antaraErr) {
      console.warn('[WebComparisonService] Antara News warning:', antaraErr.message);
    }


    if (isTemporal) {
      console.log('[WebComparisonService] 🛑 Query temporal/berita terdeteksi. Wikipedia DIBLOKIR sebagai fallback untuk menjaga keaslian berita terkini.');
      return [];
    }

    try {
      const wikiUrl = `https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      const response = await this._safeFetch(wikiUrl, {
        headers: { 'Accept': 'application/json' },
        signal
      });

      if (response && response.ok) {
        const data = await response.json();
        const searchHits = data?.query?.search || [];
        if (searchHits.length > 0) {
          const results = searchHits.slice(0, 5).map(h => ({
            title: `${h.title} (Wikipedia Ensiklopedia Statis)`,
            link: `https://id.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/\s+/g, '_'))}`,
            snippet: (h.snippet || '').replace(/<[^>]+>/g, '').trim(),
            source_type: 'encyclopedia',
            isStaticEncyclopedia: true
          }));
          console.log(`[WebComparisonService] Wikipedia API returned ${results.length} results (Faktual)`);
          return results;
        }
      }
    } catch (wikiErr) {
      console.warn('[WebComparisonService] Wikipedia search warning:', wikiErr.message);
    }

    try {
      const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await this._safeFetch(endpoint, {
        headers: { 'Accept': 'text/html' },
        signal
      });

      if (response && response.ok) {
        const html = await response.text();
        return this._parseHtmlResults(html);
      }
    } catch (ddgErr) {
      console.warn('[WebComparisonService] DuckDuckGo search fallback warning:', ddgErr.message);
    }

    return [];
  }

  async _cariWebUmum(query, signal) {
    const response = await this._safeFetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { Accept: 'text/html' }, signal });
    if (!response?.ok) throw new Error(`DuckDuckGo HTTP ${response?.status || 'tanpa status'}`);
    const hasil = this._parseHtmlResults(await response.text());
    console.log(`[WebComparisonService] DuckDuckGo (web umum, mode Engineer) returned ${hasil.length} results`);
    return hasil;
  }

  _parseRssResults(xml) {
    const results = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && results.length < 5) {
      const itemXml = match[1];
      const ambil = (re) => entitas(itemXml.match(re)?.[1] || '');
      const title = tanpaTag(ambil(/<title>([\s\S]*?)<\/title>/i));
      const link = urlAsliBing(ambil(/<link>([\s\S]*?)<\/link>/i).trim());
      const snippet = tanpaTag(ambil(/<description>([\s\S]*?)<\/description>/i));
      const tanggal = ambil(/<pubDate>([\s\S]*?)<\/pubDate>/i).trim();

      if (title && link) {
        results.push({
          title,
          link,
          snippet: snippet || title,
          tanggal
        });
      }
    }

    return results;
  }

  _parseHtmlResults(html) {
    return uraiHasilDdg(html, 5).map((h, i) => ({ title: h.judul || `Web Result #${i + 1}`, link: h.url, snippet: h.cuplikan || h.judul || '' }));
  }
}

export default WebComparisonService;
