/**
 * MODUL BERSAMA — dipakai SERVER (agent-process, Deno) dan KLIEN (frontend, Vite). Murni: tanpa impor, tanpa I/O.
 *
 * Kenapa folder netral `shared/` (ADR-0021 keputusan #6, 2026-10-28): aturan yang sama dipakai dua sisi. Menyalinnya
 * berarti dua salinan yang suatu hari menyimpang diam-diam; menaruhnya di `frontend/src` lalu diimpor server adalah
 * pola T15 (mengubah berkas klien diam-diam mengubah perilaku server). Di sini pemiliknya jelas: bukan klien, bukan
 * server. Keduanya memuatnya lewat impor relatif biasa — Deno sudah memuat berkas .js di luar folder fungsinya (9 titik
 * impor ke frontend/src), Vite lewat `server.fs.allow`. Uji: uji/uji-kueri-pencarian.mjs.
 */

/**
 * Kalimat perintah → kata kunci untuk mesin berita (RSS). Dipindahkan APA ADANYA dari
 * `agent-process/lib/web/pencarian_berita.ts` (15 Sep 2026, sub-agent researcher/deep_research):
 * uji live — "Cari informasi dan susun laporan tentang 3 perusahaan AI terbesar pada tahun 2026" → Bing 0 hasil,
 * sedangkan "3 perusahaan AI terbesar 2026" → 5–8 hasil. Sejak 28 Okt juga dipakai web Tier 3 di klien, yang
 * sebelumnya mengirim pesan Owner mentah-mentah.
 * @param {string} q
 * @returns {string} paling banyak 8 kata; '' bila semua kata terbuang
 */
export function ringkasKueri(q) {
  return String(q || '')
    .replace(/[“”"'`?!.,:;()\[\]]/g, ' ')
    .replace(/\b(tolong|mohon|lakukan|carikan|cari|temukan|riset|risetkan|telusuri|susun|susunkan|buat|buatkan|laporan|analisis|analisa|mendalam|lengkap|detail|informasi|info|data|berita|tentang|mengenai|terkait|seputar|apa|siapa|saja|dan|yang|pada|tahun|untuk|dengan|secara|di|ke|dari)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .join(' ');
}
