
const path = require('path');

const tolak = (alasan) => ({ ok: false, alasan });

function rencanaTransport(entri, kredensial = {}, { lingkungan = {}, ada = () => true } = {}) {
  if (!entri || typeof entri !== 'object') return tolak('entri server tidak ada');
  const kosong = (entri.kredensial || []).filter((k) => typeof kredensial[k.id] !== 'string' || !kredensial[k.id]);
  if (kosong.length) return tolak(`kredensial belum diisi: ${kosong.map((k) => k.label).join(', ')}`);

  if (entri.jenis === 'stdio') {
    if (!entri.program || !ada(entri.program)) return tolak(`program tidak ditemukan: ${entri.program}`);
    const env = { ...lingkungan, ...(entri.stdio?.lingkungan || {}) };
    for (const k of entri.kredensial || []) env[k.env] = kredensial[k.id];
    return {
      ok: true, jenis: 'stdio', command: entri.program, args: [...(entri.stdio?.argumen || [])],
      cwd: path.win32.dirname(entri.program), env,
    };
  }
  if (entri.jenis === 'http') {
    const headers = {};
    for (const k of entri.kredensial || []) {
      const nilai = `${k.awalan || ''}${kredensial[k.id]}`;
      if (/[\r\n\0]/.test(nilai)) return tolak(`kredensial ${k.label} memuat baris baru`);
      headers[k.header] = nilai;
    }
    return { ok: true, jenis: 'http', url: entri.http.url, headers, oauth: entri.oauth === true };
  }
  return tolak(`jenis server tidak dikenal: ${entri.jenis}`);
}

function buatTransport(rencana, { authProvider = null, fetchJaringan = null } = {}) {
  if (rencana.jenis === 'stdio') {
    const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
    return new StdioClientTransport({ command: rencana.command, args: rencana.args, cwd: rencana.cwd, env: rencana.env, stderr: 'pipe' });
  }
  const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
  if (rencana.oauth && !authProvider) throw new Error('server OAuth tanpa penyedia login');
  const ambil = fetchJaringan && rencana.oauth ? require('./fetchOAuthJujur.cjs').buatFetchOAuthJujur(fetchJaringan) : fetchJaringan;
  return new StreamableHTTPClientTransport(new URL(rencana.url), {
    requestInit: { headers: rencana.headers },
    ...(rencana.oauth ? { authProvider } : {}),
    ...(ambil ? { fetch: ambil } : {}),
  });
}

function ringkasRencana(rencana) {
  if (!rencana?.ok) return rencana;
  return rencana.jenis === 'stdio'
    ? { ok: true, jenis: 'stdio', command: rencana.command, args: rencana.args, cwd: rencana.cwd }
    : { ok: true, jenis: 'http', url: rencana.url, header: Object.keys(rencana.headers) };
}

module.exports = { rencanaTransport, buatTransport, ringkasRencana };
