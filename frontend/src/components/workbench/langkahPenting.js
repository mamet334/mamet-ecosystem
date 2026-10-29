/**
 * Baris langkah proses yang tampil LANGSUNG di gelembung jawaban (ADR-0021 §2.3 "selalu terlihat — satu baris";
 * Varian B pilihan Owner, 29 Okt 2026: baris tipis tanpa lipat, di atas blok Berpikir).
 *
 * Hanya hasil olahan LLM / mesin pencari: kueri yang BENAR-BENAR dicari (klien "🔍 Dicari (web)", researcher
 * "🔍 Dicari (berita, …)") dan rencana Coordinator ("📋 Rencana: …"). Langkah teknis lain ("Menganalisis permintaan…",
 * "Membangun graph…") tetap di panel Monitor — supaya gelembung tidak penuh.
 *
 * @param {unknown} steps `m.steps` pesan (tersimpan utuh di tabel chats, jadi chat lama ikut tampil)
 * @returns {string[]}
 */
export function langkahPenting(steps) {
  return Array.isArray(steps) ? steps.filter((l) => typeof l === 'string' && /^(🔍 Dicari|📋 Rencana)/.test(l)) : [];
}
