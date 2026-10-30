/**
 * PESAN SAAT SEMUA PENYEDIA GAGAL DI JALUR STREAM — K4 (ADR-0022, 30 Okt 2026).
 *
 * Stream sudah dimulai (HTTP 200) sebelum penyedia gagal, jadi kegagalan tidak bisa lagi dikirim sebagai galat — ia
 * ditulis ke ISI jawaban. Dulu teksnya teknis: "*(Fallback Note: OpenRouterAdapter failed, cascading...)*" lalu
 * "**Semua AI Provider sedang limit atau gangguan.** Detail error: [OpenRouterAdapter]: Saldo … plafon ulangnya 26 token".
 * Terlihat live di Mametlite (uji Owner 30 Okt): penerjemah pesan M4 di klien tak menyentuhnya karena ia bukan galat.
 *
 * Kini bentuknya sama dengan pesan galat M4 di kedua klien: judul + TINDAKAN, lalu teks teknis kecil (pengguna HP tak
 * punya DevTools). Penanda saldo mengikuti `frontend/src/core/runtime/services/pesanGalat.js` v2 — kalimat server
 * (`pesanSaldoTakCukup`, reasoning_openrouter.ts) tidak memuat "402" maupun "can only afford".
 */

const PENANDA_SALDO = /saldo openrouter|saldo tidak cukup|saldo penyedia|\b402\b|can only afford|insufficient credits|insufficient_quota/i;

export function pesanSemuaPenyediaGagal(detail: unknown): string {
  const teknis = String(detail ?? '').replace(/\s+/g, ' ').trim().slice(0, 400) || 'tanpa keterangan';
  const saldo = PENANDA_SALDO.test(teknis);
  const judul = saldo
    ? 'Saldo OpenRouter Anda tidak cukup untuk menjawab pertanyaan ini.'
    : 'Layanan AI sedang gangguan, jadi pertanyaan ini belum terjawab.';
  const saran = saldo
    ? 'Isi ulang saldo di openrouter.ai, atau coba pertanyaan yang lebih pendek — permintaan kecil kadang masih dilayani.'
    : 'Coba kirim lagi beberapa saat lagi.';
  return `⚠️ **${judul}** ${saran}\n\n*Pesan teknis: ${teknis}*`;
}
