
function buatFetchOAuthJujur(dasar) {
  return async function fetchOAuthJujur(masukan, init) {
    const r = await dasar(masukan, init);
    if (r.status !== 200 || !/json/i.test(r.headers.get('content-type') || '')) return r;
    let teks;
    try { teks = await r.clone().text(); } catch { return r;  }
    let isi;
    try { isi = JSON.parse(teks); } catch { return r;  }
    if (!isi || typeof isi.error !== 'string' || isi.access_token || isi.jsonrpc) return r;
    return new Response(teks, { status: 400, statusText: 'galat OAuth (dikirim penyedia dengan status 200)', headers: r.headers });
  };
}

module.exports = { buatFetchOAuthJujur };
