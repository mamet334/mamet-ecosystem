/**
 * METADATA LOG TANPA RAHASIA (2026-09-17)
 *
 * Temuan: `audit_subscriber.ts` & `lifecycle_subscriber.ts` menyalin seluruh `event.payload` ke
 * `agent_logs.metadata`. Payload `Capability.Executed` membawa `rctx` dan `Tool.Requested` membawa `env` +
 * `rctx` — keduanya memuat kunci API server & pengguna. 698 baris sejak 30 Juni 2026 berisi kunci dalam
 * teks biasa; tabel itu dibaca dasbor di browser dan ikut `backup-export`.
 *
 * Semua metadata log disaring di sini sebelum disimpan: objek runtime (`rctx`, `env`) dibuang, kunci
 * bernama rahasia dibuang, dan teks yang berbentuk kunci API disamarkan. Murni — diuji di Node.
 */

/** Nama properti yang tidak pernah boleh masuk log (objek runtime & kredensial). */
const NAMA_DIBUANG = /^(rctx|env|ctx|runtimeContext|headers|supabaseServiceKey|serviceKey)$/i;
const NAMA_RAHASIA = /(api[_-]?key|apikey|secret|password|passwd|token|authorization|bearer|service[_-]?key|private[_-]?key|kunci)/i;

/** Bentuk kunci yang dikenal (OpenRouter, Apify, Google, Groq, OpenAI/Anthropic, Supabase JWT, Bearer). */
const POLA_KUNCI = [
  /sk-or-v1-[A-Za-z0-9]{16,}/g,
  /apify_api_[A-Za-z0-9]{16,}/g,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /gsk_[A-Za-z0-9]{20,}/g,
  /sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /Bearer\s+[A-Za-z0-9._-]{20,}/gi
];

export const DISAMARKAN = '[disamarkan]';
const KEDALAMAN_MAKS = 6;

export function samarkanTeks(teks: string): string {
  let hasil = teks;
  for (const pola of POLA_KUNCI) hasil = hasil.replace(pola, DISAMARKAN);
  return hasil;
}

/** Salinan `nilai` yang aman disimpan di log. Objek asli tidak diubah. */
export function saringMetadata(nilai: unknown, kedalaman = 0, dilihat: WeakSet<object> = new WeakSet()): unknown {
  if (typeof nilai === 'string') return samarkanTeks(nilai);
  if (nilai === null || typeof nilai !== 'object') return typeof nilai === 'function' ? undefined : nilai;
  if (dilihat.has(nilai as object)) return '[berulang]';
  if (kedalaman >= KEDALAMAN_MAKS) return '[terlalu dalam]';
  dilihat.add(nilai as object);
  if (Array.isArray(nilai)) return nilai.map((v) => saringMetadata(v, kedalaman + 1, dilihat));
  const hasil: Record<string, unknown> = {};
  for (const [nama, isi] of Object.entries(nilai as Record<string, unknown>)) {
    if (NAMA_DIBUANG.test(nama)) continue;
    if (NAMA_RAHASIA.test(nama)) { hasil[nama] = DISAMARKAN; continue; }
    const bersih = saringMetadata(isi, kedalaman + 1, dilihat);
    if (bersih !== undefined) hasil[nama] = bersih;
  }
  return hasil;
}
