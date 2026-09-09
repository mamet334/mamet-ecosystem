/**
 * TierClassifierService — Penentu tingkat model (KECIL / SEDANG / THINKING) per pesan.
 *
 * Deterministik dan 100% lokal: tidak pernah memanggil LLM untuk menebak tingkat, mengikuti
 * pola RequestClassifierService (PR#8). Memanggil LLM di sini justru menambah biaya persis
 * saat sedang berusaha menghemat biaya.
 *
 * Pembagian tanggung jawab (lihat docs/roadmap/ROADMAP-ADAPTIVE-MODEL-TIERING.md §3):
 * service ini hanya memutuskan TINGKAT MANA yang dipakai. Model apa yang mengisi tiap tingkat
 * sepenuhnya kurasi Owner lewat Settings — sistem tidak pernah memilih model sendiri.
 */

export const TIERS = { KECIL: 'KECIL', SEDANG: 'SEDANG', THINKING: 'THINKING' };

// Daftar dwibahasa digabung dalam satu pencarian — Owner menulis campuran ID/EN, jadi tidak
// ada deteksi bahasa terpisah (draf disetujui Owner 2026-09-08, roadmap §4.2).
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

// Pesan sangat pendek cenderung sapaan/afirmasi; pesan sangat panjang hampir selalu menuntut
// penalaran lebih berat walau tidak memuat kata kunci apa pun.
const SHORT_MESSAGE_CHARS = 40;
const LONG_MESSAGE_CHARS = 400;

// Berapa pesan terakhir yang ikut dilihat untuk smoothing (roadmap §3: context-aware).
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

  /**
   * Menilai satu teks tanpa konteks riwayat.
   * @param {string} text
   * @returns {'KECIL'|'SEDANG'|'THINKING'}
   */
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

  /**
   * Penilaian utama: pesan terbaru + beberapa pesan terakhir di thread.
   *
   * Smoothing (roadmap §4.2): pesan pendek seperti "oke lanjut" di tengah diskusi berat tidak
   * boleh otomatis turun ke KECIL — kalau riwayat terdekat bertingkat SEDANG/THINKING, tingkat
   * dinaikkan mengikuti riwayat.
   *
   * @param {string} message - pesan terbaru dari Owner
   * @param {Array<{role?: string, content?: string}|string>} history - riwayat percakapan
   * @returns {{tier: 'KECIL'|'SEDANG'|'THINKING', reason: string}}
   */
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
