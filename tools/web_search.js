export default {
  name: 'web_search',
  description: 'Mencari informasi terkini dari web (Bing News, Google News, Wikipedia, DuckDuckGo) dengan gerbang konfirmasi Owner (Human-in-Command) dan timeout 8 detik.',
  category: 'research',

  async execute(params, context) {
    const webComparisonService = context?.serviceManager?.get?.('WebComparisonService');
    if (!webComparisonService || typeof webComparisonService.searchWeb !== 'function') {
      return {
        chunks: [],
        strategy: 'web_search_unavailable',
        sufficiency: 0.0,
        tier: 3,
        isFallback: true,
        status: 'FAILED',
        error: 'WebComparisonService tidak tersedia di serviceManager.'
      };
    }
    return await webComparisonService.searchWeb(params?.query, params || {});
  }
};
