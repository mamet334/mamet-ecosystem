// JARINGAN KONEKTOR (Item 129 GH3, 2026-11-05) — satu tugas: SATU jalan keluar HTTP untuk konektor umum di proses
// utama — server MCP jarak jauh (Streamable HTTP), metadata & token OAuth, login perangkat.
//
// Kenapa: aturan "Black October" (electron/ambilWeb.cjs, uji-ambil-web): lalu lintas web pihak ketiga di PROSES UTAMA
// lewat tumpukan jaringan Chromium (`net.fetch`), bukan `fetch()` Node — satu dekoder (Brotli CVE-2026-111497), proksi
// sistem dihormati. Sejak G1/F1 transport HTTP & OAuth memakai `fetch` bawaan SDK MCP (= `fetch()` Node) tanpa
// tertangkap penjaga, karena SDK ada di node_modules (temuan 5 Nov). main.cjs kini menyuntikkan `net.fetch` ke sini.
//
// Aturan yang sama dengan ambilWeb:
//   - hanya http/https (`net.fetch` juga melayani `file:` & protokol kustom);
//   - `credentials: 'omit'` WAJIB — tanpa itu `net.fetch` mengirim cookie sesi aplikasi (terbukti di uji-ambil-web).
// Di uji Node (tanpa Electron) `dasar` = fetch global; produksi selalu `net.fetch` (dijaga uji-konektor-oauth-gh3).

const SKEMA_BOLEH = new Set(['http:', 'https:']);

/** @param {(input: any, init?: object) => Promise<Response>} dasar `net.fetch` di proses utama Electron */
function buatJaringanKonektor(dasar) {
  if (typeof dasar !== 'function') throw new Error('jaringan konektor butuh fungsi pengambil (net.fetch)');
  return async function jaringanKonektor(masukan, init = {}) {
    const alamat = typeof masukan === 'string' ? masukan : masukan instanceof URL ? masukan.href : masukan?.url;
    let skema;
    try { skema = new URL(String(alamat)).protocol; } catch { throw new Error('alamat konektor tidak sah'); /* bukan URL — ditolak, tidak dikirim */ }
    if (!SKEMA_BOLEH.has(skema)) throw new Error(`skema ${skema} ditolak — konektor hanya http/https`);
    return dasar(masukan, { ...init, credentials: 'omit' });
  };
}

module.exports = { buatJaringanKonektor };
