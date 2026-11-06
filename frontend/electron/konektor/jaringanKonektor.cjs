
const SKEMA_BOLEH = new Set(['http:', 'https:']);

function buatJaringanKonektor(dasar) {
  if (typeof dasar !== 'function') throw new Error('jaringan konektor butuh fungsi pengambil (net.fetch)');
  return async function jaringanKonektor(masukan, init = {}) {
    const alamat = typeof masukan === 'string' ? masukan : masukan instanceof URL ? masukan.href : masukan?.url;
    let skema;
    try { skema = new URL(String(alamat)).protocol; } catch { throw new Error('alamat konektor tidak sah');  }
    if (!SKEMA_BOLEH.has(skema)) throw new Error(`skema ${skema} ditolak — konektor hanya http/https`);
    return dasar(masukan, { ...init, credentials: 'omit' });
  };
}

module.exports = { buatJaringanKonektor };
