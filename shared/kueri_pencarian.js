/**
 * MODUL BERSAMA — dipakai SERVER (agent-process, Deno) dan KLIEN (frontend, Vite). Murni: tanpa impor, tanpa I/O.
 *
 * Kenapa folder netral `shared/` (ADR-0021 keputusan #6, 2026-10-28): aturan yang sama dipakai dua sisi. Menyalinnya
 * berarti dua salinan yang suatu hari menyimpang diam-diam; menaruhnya di `frontend/src` lalu diimpor server adalah
 * pola T15 (mengubah berkas klien diam-diam mengubah perilaku server). Di sini pemiliknya jelas: bukan klien, bukan
 * server. Keduanya memuatnya lewat impor relatif biasa — Deno memuat berkas .js di luar folder fungsinya (dulu 9 titik
 * impor ke frontend/src; sejak 29 Okt kelima modul itu pindah ke shared/ juga — T15), Vite lewat `server.fs.allow`.
 * Uji: uji/uji-kueri-pencarian.mjs, uji/uji-shared-t15.mjs.
 */

/**
 * "soal" yang berarti "tentang" — yaitu TIDAK didahului kata yang menjadikannya benda (contoh/latihan/kunci … soal) dan
 * bukan bagian dari "soal-soal". Lookbehind panjang-berubah didukung V8 (Vite/Electron) dan Deno.
 */
const SOAL_SEBAGAI_TENTANG = /(?<!\b(?:contoh|latihan|kumpulan|bank|kunci|pembahasan|jawaban|lembar|paket|naskah|kisi-kisi|buat|buatkan|membuat|jawab|kerjakan|mengerjakan)\s+)(?<!-)\bsoal\b(?!-)/gi;

/**
 * Kalimat perintah → kata kunci untuk mesin berita (RSS). Dipindahkan APA ADANYA dari
 * `agent-process/lib/web/pencarian_berita.ts` (15 Sep 2026, sub-agent researcher/deep_research):
 * uji live — "Cari informasi dan susun laporan tentang 3 perusahaan AI terbesar pada tahun 2026" → Bing 0 hasil,
 * sedangkan "3 perusahaan AI terbesar 2026" → 5–8 hasil. Sejak 28 Okt juga dipakai web Tier 3 di klien, yang
 * sebelumnya mengirim pesan Owner mentah-mentah.
 *
 * 29 Okt 2026 — dua tambahan, keduanya diukur live di Bing: contoh ADR-0021 sendiri ("tolong carikan berita terbaru soal
 * OKU dong") menyisakan "terbaru soal OKU dong" → **0** hasil, sedangkan "terbaru OKU" → 8.
 *  - partikel `dong|deh|sih|nih` dibuang ("terbaru OKU dong" → 1 hasil: aktor Ma Dong Seok);
 *  - "soal" dibuang HANYA bila berarti "tentang" ("soal banjir Baturaja" 3 hasil melenceng vs "banjir Baturaja" 9).
 *    Didahului kata benda (`SOAL_SEBAGAI_BENDA`) ia isi kueri: "contoh soal CPNS" → tanpa "soal" jadi surat lamaran.
 * @param {string} q
 * @returns {string} paling banyak 8 kata; '' bila semua kata terbuang
 */
export function ringkasKueri(q) {
  return String(q || '')
    .replace(/[“”"'`?!.,:;()\[\]]/g, ' ')
    .replace(SOAL_SEBAGAI_TENTANG, ' ')
    .replace(/\b(tolong|mohon|lakukan|carikan|cari|temukan|riset|risetkan|telusuri|susun|susunkan|buat|buatkan|laporan|analisis|analisa|mendalam|lengkap|detail|informasi|info|data|berita|tentang|mengenai|terkait|seputar|apa|siapa|saja|dan|yang|pada|tahun|untuk|dengan|secara|di|ke|dari|dong|deh|sih|nih)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .join(' ');
}

/**
 * Pesan menuntut informasi TERKINI (berita, "terbaru", "hari ini", …)? Satu aturan untuk klien & server (29 Okt 2026).
 *
 * Dulu ada DUA salinan identik huruf demi huruf: `RetrievalOrchestrator.isTemporalQuery()` (klien — memicu web Tier 3 &
 * menyaring memori di AssistantService) dan `RetrievalStrategyService.isTemporalOrRecencyQuery()` (server —
 * context_builder). Pola di bawah disalin PERSIS dari keduanya: penyatuan ini tak mengubah perilaku, hanya menutup risiko
 * dua salinan menyimpang diam-diam. Kedua metode lama tetap ada dan kini memanggil fungsi ini.
 * @param {string} teks
 * @returns {boolean}
 */
export function adalahKueriWaktu(teks) {
  if (!teks || typeof teks !== 'string') return false;
  return /\b(terbaru|terkini|hari ini|minggu ini|bulan ini|tahun ini|sekarang|saat ini|berita|update|teranyar|latest|recent|currently|current|today|this week|this month|news)\b/i.test(teks);
}
