
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const { createRequire } = require('module');

const req = createRequire(path.join(__dirname, '..', '..', 'frontend', 'package.json'));
const { Server } = req('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = req('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = req('@modelcontextprotocol/sdk/types.js');

const acak = (n = 16) => crypto.randomBytes(n).toString('hex');
const sha256url = (t) => crypto.createHash('sha256').update(t).digest('base64url');

function bacaBadan(r) {
  return new Promise((ok) => { let s = ''; r.on('data', (d) => { s += d; }); r.on('end', () => ok(s)); });
}

const KLIEN_TERDAFTAR = 'klien_terdaftar';
const cocokBalikan = (terdaftar, diminta) => {
  try {
    const a = new URL(terdaftar); const b = new URL(diminta);
    return a.protocol === b.protocol && a.hostname === b.hostname && a.pathname === b.pathname && ['127.0.0.1', 'localhost'].includes(a.hostname);
  } catch { return false;  }
};

function mulai(opsi = {}) {
  const sakelar = { tolakLogin: false, pembaruanGagal: false, tanpaS256: false, asalLoginLain: false, gayaGithub: false,
    webButuhRahasia: false, pembaruanButuhRahasia: false, lambatSekali: false, ...opsi };
  const keadaan = { klien: new Map(), kode: new Map(), akses: new Set(), pembaru: new Map(), dicabut: [], otorisasi: [], panggilanMcp: 0, pendaftaran: 0,
    perangkat: new Map(), pollPerangkat: 0 };
  if (sakelar.gayaGithub) keadaan.klien.set(KLIEN_TERDAFTAR, { redirect_uris: ['http://127.0.0.1/balikan'], terdaftar: true });

  const server = http.createServer(async (rq, rs) => {
    const base = `http://127.0.0.1:${server.address().port}`;
    const u = new URL(rq.url, base);
    const json = (kode, isi, kepala = {}) => { rs.writeHead(kode, { 'Content-Type': 'application/json', ...kepala }); rs.end(JSON.stringify(isi)); };

    if (rq.method === 'GET' && u.pathname.startsWith('/.well-known/oauth-protected-resource')) {
      return json(200, { resource: `${base}/mcp`, authorization_servers: [base], scopes_supported: ['default'], bearer_methods_supported: ['header'] });
    }
    if (rq.method === 'GET' && (u.pathname === '/.well-known/oauth-authorization-server' || u.pathname === '/.well-known/openid-configuration')) {
      return json(200, {
        issuer: base,
        authorization_endpoint: sakelar.asalLoginLain ? 'https://login-palsu.contoh.invalid/authorize' : `${base}/authorize`,
        token_endpoint: `${base}/token`,
        ...(sakelar.gayaGithub ? { device_authorization_endpoint: `${base}/device/code` } : { registration_endpoint: `${base}/register`, revocation_endpoint: `${base}/revoke` }),
        response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: sakelar.tanpaS256 ? ['plain'] : ['S256'],
      });
    }
    if (rq.method === 'POST' && u.pathname === '/register') {
      if (sakelar.gayaGithub) { rs.writeHead(404).end(); return undefined; }
      keadaan.pendaftaran++;
      const b = JSON.parse(await bacaBadan(rq) || '{}');
      const id = `klien_${acak(6)}`;
      keadaan.klien.set(id, b);
      return json(201, { ...b, client_id: id, client_id_issued_at: Math.floor(Date.now() / 1000) });
    }
    if (rq.method === 'GET' && u.pathname === '/authorize') {
      const p = Object.fromEntries(u.searchParams);
      keadaan.otorisasi.push(p);
      const k = keadaan.klien.get(p.client_id);
      const balikanSah = k && (k.terdaftar ? k.redirect_uris.some((r) => cocokBalikan(r, p.redirect_uri)) : (k.redirect_uris || []).includes(p.redirect_uri));
      if (!balikanSah || p.code_challenge_method !== 'S256' || !p.code_challenge) {
        return json(400, { error: 'invalid_request' });
      }
      const tujuan = new URL(p.redirect_uri);
      if (sakelar.tolakLogin) tujuan.searchParams.set('error', 'access_denied');
      else {
        const kode = `kode_${acak()}`;
        keadaan.kode.set(kode, { client_id: p.client_id, redirect_uri: p.redirect_uri, tantangan: p.code_challenge });
        tujuan.searchParams.set('code', kode);
      }
      if (p.state) tujuan.searchParams.set('state', p.state);
      rs.writeHead(302, { Location: tujuan.toString() });
      return rs.end();
    }
    if (rq.method === 'POST' && u.pathname === '/device/code') {
      const b = Object.fromEntries(new URLSearchParams(await bacaBadan(rq)));
      if (!keadaan.klien.has(b.client_id)) return json(200, { error: 'unauthorized_client' });
      const device = `dev_${acak()}`;
      const kodePengguna = `${acak(2).toUpperCase()}-${acak(2).toUpperCase()}`;
      keadaan.perangkat.set(device, { status: 'menunggu', client_id: b.client_id, kodePengguna });
      const alamat = sakelar.perangkatAsalLain ? 'https://login-palsu.contoh.invalid/device' : `${base}/login/device`;
      return json(200, { device_code: device, user_code: kodePengguna, verification_uri: alamat, expires_in: 900, interval: 1 });
    }
    if (rq.method === 'POST' && u.pathname === '/token') {
      const b = Object.fromEntries(new URLSearchParams(await bacaBadan(rq)));
      const galat = (kode, desk) => json(sakelar.gayaGithub ? 200 : 400, { error: kode, ...(desk ? { error_description: desk } : {}) });
      if (b.grant_type === 'urn:ietf:params:oauth:grant-type:device_code') {
        keadaan.pollPerangkat++;
        const d = keadaan.perangkat.get(b.device_code);
        if (!d || d.client_id !== b.client_id) return galat('bad_verification_code');
        if (sakelar.lambatSekali && keadaan.pollPerangkat === 1) return galat('slow_down');
        if (d.status === 'menunggu') return galat('authorization_pending');
        if (d.status === 'ditolak') return galat('access_denied');
        keadaan.perangkat.delete(b.device_code);
        const akses = `at_${acak()}`; const pembaru = `rt_${acak()}`;
        keadaan.akses.add(akses); keadaan.pembaru.set(pembaru, b.client_id);
        return json(200, { access_token: akses, token_type: 'bearer', expires_in: 28800, refresh_token: pembaru, scope: '' });
      }
      if (b.grant_type === 'authorization_code' && sakelar.webButuhRahasia && !b.client_secret) {
        return galat('incorrect_client_credentials', 'The client_id and/or client_secret passed are incorrect.');
      }
      if (b.grant_type === 'refresh_token' && sakelar.pembaruanButuhRahasia && !b.client_secret) {
        return galat('incorrect_client_credentials', 'The client_id and/or client_secret passed are incorrect.');
      }
      const beri = (client_id) => {
        const akses = `at_${acak()}`;
        const pembaru = `rt_${acak()}`;
        keadaan.akses.add(akses);
        keadaan.pembaru.set(pembaru, client_id);
        return json(200, { access_token: akses, token_type: 'Bearer', expires_in: 3600, refresh_token: pembaru });
      };
      if (b.grant_type === 'authorization_code') {
        const k = keadaan.kode.get(b.code);
        keadaan.kode.delete(b.code);
        if (!k || k.client_id !== b.client_id || k.redirect_uri !== b.redirect_uri || sha256url(b.code_verifier || '') !== k.tantangan) {
          return json(400, { error: 'invalid_grant' });
        }
        return beri(b.client_id);
      }
      if (b.grant_type === 'refresh_token') {
        const pemilik = keadaan.pembaru.get(b.refresh_token);
        if (sakelar.pembaruanGagal || !pemilik) return json(400, { error: 'invalid_grant' });
        keadaan.pembaru.delete(b.refresh_token);
        return beri(pemilik);
      }
      return json(400, { error: 'unsupported_grant_type' });
    }
    if (rq.method === 'POST' && u.pathname === '/revoke') {
      const b = Object.fromEntries(new URLSearchParams(await bacaBadan(rq)));
      keadaan.dicabut.push(b);
      keadaan.pembaru.delete(b.token);
      keadaan.akses.delete(b.token);
      rs.writeHead(200).end();
      return undefined;
    }
    if (u.pathname === '/mcp') {
      const token = (rq.headers.authorization || '').replace(/^Bearer /, '');
      if (!keadaan.akses.has(token)) {
        rs.writeHead(401, { 'WWW-Authenticate': `Bearer realm="OAuth", resource_metadata="${base}/.well-known/oauth-protected-resource/mcp", scope="default"` });
        return rs.end();
      }
      keadaan.panggilanMcp++;
      const mcp = new Server({ name: 'notion-tiruan', version: '1.0.0' }, { capabilities: { tools: {} } });
      mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
          { name: 'cari_halaman', description: 'Mencari halaman yang dibagikan pengguna', inputSchema: { type: 'object', properties: { kueri: { type: 'string' } }, required: ['kueri'] },
            annotations: { readOnlyHint: true } },
          { name: 'tulis_halaman', description: 'Membuat halaman baru', inputSchema: { type: 'object', properties: { judul: { type: 'string' } } },
            annotations: { readOnlyHint: false, destructiveHint: true } },
        ],
      }));
      mcp.setRequestHandler(CallToolRequestSchema, async (r) => ({ content: [{ type: 'text', text: `hasil ${r.params.name}: ${JSON.stringify(r.params.arguments)}` }] }));
      const t = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      rs.on('close', () => { t.close(); mcp.close(); });
      await mcp.connect(t);
      return t.handleRequest(rq, rs);
    }
    rs.writeHead(404).end();
    return undefined;
  });

  return new Promise((ok) => server.listen(0, '127.0.0.1', () => {
    const base = `http://127.0.0.1:${server.address().port}`;
    ok({
      url: `${base}/mcp`, base, keadaan, sakelar,
      kedaluwarsakanAkses: () => keadaan.akses.clear(),
      jawabPerangkat: (kodePengguna, setuju = true) => {
        for (const d of keadaan.perangkat.values()) if (d.kodePengguna === kodePengguna) { d.status = setuju ? 'disetujui' : 'ditolak'; return true; }
        return false;
      },
      tutup: () => new Promise((t) => { server.closeAllConnections?.(); server.close(() => t()); }),
    });
  }));
}

module.exports = { mulai };
