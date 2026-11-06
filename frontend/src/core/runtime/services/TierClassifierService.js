
export const TIERS = { KECIL: 'KECIL', SEDANG: 'SEDANG', THINKING: 'THINKING' };

const KECIL_KEYWORDS = [
  'halo', 'hai', 'oke', 'ok', 'makasih', 'terima kasih', 'gimana', 'siap', 'lanjut',
  'boleh', 'iya', 'ya', 'sip', 'mantap',
  'hi', 'hey', 'hello', 'thanks', 'thank you', 'okay', 'sure', 'got it', 'alright', 'cool', 'nice'
];

const THINKING_KEYWORDS = [
  'analisis', 'analisa', 'bandingkan', 'rencanakan', 'rancang', 'kenapa', 'jelaskan detail',
  'strategi', 'evaluasi', 'optimalkan', 'pertimbangkan', 'trade-off', 'dampak', 'konsekuensi',
  'analyze', 'compare', 'strategy', 'explain in detail', 'evaluate', 'optimize', 'design',
  'architecture', 'pros and cons', 'implications', 'deep dive'
];

const SHORT_MESSAGE_CHARS = 40;
const LONG_MESSAGE_CHARS = 400;

const HISTORY_LOOKBACK = 2;

const containsAny = (text, keywords) => keywords.some(kw => text.includes(kw));

export class TierClassifierService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    console.log('[TierClassifierService] Initialized (deterministik, zero-cost)');
  }

  classifyText(text) {
    const normalized = (text || '').toLowerCase().trim();
    if (!normalized) return TIERS.SEDANG;

    if (containsAny(normalized, THINKING_KEYWORDS)) return TIERS.THINKING;
    if (normalized.length >= LONG_MESSAGE_CHARS) return TIERS.THINKING;

    if (normalized.length <= SHORT_MESSAGE_CHARS && containsAny(normalized, KECIL_KEYWORDS)) {
      return TIERS.KECIL;
    }

    return TIERS.SEDANG;
  }

  classify(message, history = []) {
    const baseTier = this.classifyText(message);

    if (baseTier !== TIERS.KECIL) {
      return { tier: baseTier, reason: `pesan dinilai ${baseTier}` };
    }

    const recentUserTexts = (history || [])
      .filter(item => (typeof item === 'string') || item?.role === 'user')
      .slice(-HISTORY_LOOKBACK)
      .map(item => (typeof item === 'string' ? item : item.content));

    const heavierHistoryTier = recentUserTexts
      .map(text => this.classifyText(text))
      .find(tier => tier !== TIERS.KECIL);

    if (heavierHistoryTier) {
      return {
        tier: heavierHistoryTier,
        reason: `pesan pendek, tapi ${HISTORY_LOOKBACK} pesan terakhir bertingkat ${heavierHistoryTier} (smoothing)`
      };
    }

    return { tier: TIERS.KECIL, reason: 'pesan pendek & cocok kata kunci ringan' };
  }
}

export default TierClassifierService;
