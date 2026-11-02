/**
 * pesanRamping.js — langkah proses tersimpan SEKALI, bukan dua kali (Parkir ADR-0022, 2 Nov 2026).
 *
 * Diukur 2 Nov di tabel `chats` (219 baris, 1.183 pesan, 22 MB teks): setiap jawaban menyimpan langkah proses
 * server DUA KALI — di `steps` (gabungan klien + server, `AssistantService` onDone) dan di `metadata.processingSteps`
 * (`metadata` = seluruh respons server). Isinya sama persis (418/418 pesan: `metadata.processingSteps` = ekor
 * `steps`), dan langkah `[SYSTEM CONTEXT FINAL]` di dalamnya rata-rata 22.927 huruf (terbesar 153.467) — 9,4 MB.
 * Salinan kedua itu juga ikut terkirim ke server di `history` setiap kiriman, padahal server tak membacanya
 * (model hanya menerima `role`/`content`; server membaca `metadata.terpotong`/`bahanLanjutan`).
 *
 * Yang DIPERTAHANKAN: `steps` utuh, termasuk `[SYSTEM CONTEXT FINAL]` — itulah prompt yang benar-benar terkirim ke
 * model, dipakai memverifikasi jawaban RAG & menyusun set uji mutu. Memangkasnya = kehilangan bukti, bukan merampingkan.
 */

export const VERSI_PESAN_RAMPING = 'pesan-ramping v1 (2026-11-02)';

/** `metadata.processingSteps` hanya dibuang bila ia BENAR-BENAR salinan ekor `steps` — selain itu tak disentuh. */
function salinanEkor(steps, langkahMeta) {
  if (!Array.isArray(steps) || !Array.isArray(langkahMeta) || langkahMeta.length > steps.length) return false;
  const awal = steps.length - langkahMeta.length;
  return langkahMeta.every((l, i) => l === steps[awal + i]);
}

/** Pesan untuk DISIMPAN (tabel `chats`): salinan langkah di `metadata` dibuang, `steps` utuh. */
export function rampingkanPesan(pesan) {
  const meta = pesan?.metadata;
  if (!meta || typeof meta !== 'object' || !salinanEkor(pesan.steps, meta.processingSteps)) return pesan;
  const { processingSteps: _salinan, ...sisa } = meta;
  return { ...pesan, metadata: sisa };
}

/**
 * Pesan untuk DIKIRIM sebagai `history`: tanpa langkah proses sama sekali (server tak memakainya). Kunci lain —
 * termasuk penanda patok dan `metadata.terpotong`/`bahanLanjutan` untuk "lanjutkan" — tetap ikut.
 */
export function pesanUntukServer(pesan) {
  if (!pesan || typeof pesan !== 'object') return pesan;
  const { steps: _langkah, ...sisa } = pesan;
  if (sisa.metadata && typeof sisa.metadata === 'object' && 'processingSteps' in sisa.metadata) {
    const { processingSteps: _p, ...meta } = sisa.metadata;
    sisa.metadata = meta;
  }
  return sisa;
}
