// Pengambil web Tier 3 untuk IPC `net:fetchWeb` (dipanggil WebComparisonService._safeFetch dari renderer).
//
// ── Kenapa jaringan CHROMIUM, bukan `fetch()` Node (2026-10-27, "Black October") ─────────────────────────────
// CVE-2026-111497 ("Node2Shell"): dekoder Brotli bisa menulis di luar buffer → eksekusi kode, cukup dengan
// respons ber-`Content-Encoding: br` yang dirancang. `fetch()` Node meminta & mengurai Brotli sendiri, dan Node
// bawaan Electron 42.3.3 adalah 24.15.0 — versi tertambal 24.22.1, dan per 27 Okt belum ada Electron stabil
// yang membawanya. Jalur ini mengambil situs & RSS PIHAK KETIGA di PROSES UTAMA (akses penuh ke komputer),
// jadi situs jahat atau yang diretas cukup untuk memicunya.
//
// `net.fetch` memakai tumpukan jaringan Chromium, yang membawa brotli sendiri. Chromium 148.0.7778.218 (bawaan
// Electron 42.3.3) memuat brotli `cfa184a` (2026-03-18), yang SUDAH berisi perbaikannya: `0ed4268` "Detect and
// report invalid stream earlier" (2026-02-27) — patch yang sama yang dirilis brotli v1.2.1 untuk CVE ini
// (`b418fa8`). Diperiksa lewat API compare GitHub, bukan dari klaim artikel.
//
// ── Yang berubah perilakunya, dan sengaja ─────────────────────────────────────────────────────────────────
// - Hanya http/https. `net.fetch` juga melayani `file:` dan protokol kustom (`mamet://`) — `fetch()` Node tidak.
//   Tanpa pembatasan ini, renderer bisa membaca berkas lokal lewat saluran yang dulu hanya untuk web.
// - `credentials: 'omit'`: `fetch()` Node tidak pernah mengirim cookie/autentikasi sesi; ini menjaganya tetap begitu.
//   Wajib, bukan hiasan: tanpa opsi ini `net.fetch` di Electron 42 MENGIRIM cookie sesi bawaan (terbukti di
//   uji/uji-ambil-web.mjs bagian 3, walau dokumentasi tipenya menyiratkan cookie tidak ikut).
// - Proksi sistem kini dihormati (Chromium membacanya; `fetch()` Node tidak).

const SKEMA_BOLEH = new Set(['http:', 'https:']);

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/**
 * @param {(url: string, init: object) => Promise<Response>} ambil  `net.fetch` di main.cjs; disuntikkan agar teruji
 * @param {{url: string, options?: {headers?: object, method?: string, timeoutMs?: number}}} permintaan
 * @returns {Promise<{ok: boolean, status: number, statusText?: string, data?: string, error?: string}>}
 */
async function ambilWeb(ambil, { url, options = {} } = {}) {
  let skema;
  try {
    skema = new URL(url).protocol;
  } catch {
    return { ok: false, status: 0, error: `URL tidak sah: ${String(url).slice(0, 200)}` };
  }
  if (!SKEMA_BOLEH.has(skema)) {
    return { ok: false, status: 0, error: `Skema ${skema} ditolak — pengambil web hanya untuk http/https` };
  }

  const headers = {
    'User-Agent': USER_AGENT,
    'Accept': 'application/rss+xml, application/xml, text/xml, text/html, application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    ...(options.headers || {})
  };

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await ambil(url, {
      method: options.method || 'GET',
      headers,
      credentials: 'omit',
      signal: controller.signal
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: text
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err.message
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { ambilWeb, SKEMA_BOLEH };
