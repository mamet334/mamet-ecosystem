/**
 * IZIN SUB-AGENT DI SERVER — T1 (K5, ADR-0022, 30 Okt 2026).
 *
 * Dulu daftar `tools` dari klien hanya menyaring daftar sub-agent yang DITAWARKAN ke Coordinator
 * (`getPluginPromptList`); nama apa pun yang dikembalikan model tetap dijalankan `tool_subscriber` lewat
 * `getPluginByName`. Batas alat Mametlite pun hanya di klien (`callAgentSimple.js`). Pendaftaran akun Supabase
 * terbuka, jadi siapa pun bisa menjalankan sub-agent apa saja (model ancaman TM-002).
 *
 * Aturan (diperiksa sebelum `Tool.Requested` dipancarkan — satu-satunya jalan ke `plugin.execute`):
 *   1. Sub-agent harus DIMINTA di `tools` (sesudah alias). Model tak bisa lagi menambah sub-agent sendiri.
 *   2. `appSource: 'mametlite'` hanya boleh sub-agent riset — sama dengan daftar di `callAgentSimple.js`.
 *      `appSource` dikirim klien, jadi aturan ini menjaga klien Mametlite yang sah, BUKAN batas keamanan.
 *   3. Sub-agent yang memakai sumber daya berbayar milik Owner (token Apify server) hanya untuk akun pemilik:
 *      rahasia `MAMET_PEMILIK_IDS` (UUID dipisah koma). Tak diisi → tak ada yang boleh (gagal tertutup).
 *
 * Keputusan Owner 30 Okt: SEMUA sub-agent tetap tersedia — pagar, bukan pemangkasan. Klien sah hanya pernah meminta
 * `researcher` (lewat `web_search`) dan `deep_research`; sub-agent lain hanya tercapai lewat permintaan rakitan.
 */

/** Nama di `tools` klien → nama sub-agent (sama dengan `getPluginPromptList`). */
export const ALIAS_TOOLS: Record<string, string> = {
  web_search: 'researcher',
  code_executor: 'coder',
  web_scraper: 'scraper',
};

export const SUBAGENT_MAMETLITE = new Set(['researcher', 'deep_research']);

/** Memakai token Apify server (biaya Owner) — model ancaman TM-003. */
export const SUBAGENT_KHUSUS_PEMILIK = new Set(['youtube_analyst']);

export function subagentDiminta(tools: unknown): Set<string> {
  if (!Array.isArray(tools)) return new Set();
  return new Set(tools.filter((t) => typeof t === 'string').map((t) => ALIAS_TOOLS[t] || t));
}

export function adalahPemilik(userId: unknown, daftar: string | undefined): boolean {
  if (typeof userId !== 'string' || !userId) return false;
  return String(daftar || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    .includes(userId.toLowerCase());
}

/** `null` = boleh dijalankan; selain itu alasan penolakan (ditampilkan di langkah proses). */
export function alasanTolakSubagent(
  subagent: unknown,
  { tools, appSource, pemilik }: { tools: unknown; appSource?: string; pemilik: boolean },
): string | null {
  const nama = typeof subagent === 'string' ? subagent : '';
  if (!nama) return 'nama sub-agent kosong';
  if (!subagentDiminta(tools).has(nama)) return 'tidak diminta aplikasi (tools)';
  if (appSource === 'mametlite' && !SUBAGENT_MAMETLITE.has(nama)) return 'tidak tersedia di Mametlite';
  if (SUBAGENT_KHUSUS_PEMILIK.has(nama) && !pemilik) return 'hanya untuk akun pemilik (memakai layanan berbayar Owner)';
  return null;
}
