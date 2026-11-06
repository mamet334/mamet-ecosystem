
const SKEMA_BOLEH = new Set(['http:', 'https:']);

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

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
