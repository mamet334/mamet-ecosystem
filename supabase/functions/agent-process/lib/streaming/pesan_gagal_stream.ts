
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
