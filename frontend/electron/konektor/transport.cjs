// TRANSPORT KONEKTOR UMUM (Item 129 Tahap G1, 2026-11-03) — satu tugas: entri server → cara tersambung ke server MCP.
//
// Dua jenis (K4):
//   - stdio: program .exe yang ditunjuk Owner, dijalankan TANPA shell, folder kerja = folder program, lingkungan =
//     lingkungan bersih dari pemanggil (`lingkunganServer` konektorMcp.cjs — nama berbau rahasia sudah dibuang) +
//     variabel biasa dari resep + kredensial dari brankas.
//   - http: Streamable HTTP; kredensial menjadi header (mis. `Authorization: Bearer …`). OAuth tetap Tahap F.
//
// Titik sambung S5: penyaring rahasia membuang semua variabel bernama TOKEN/KEY/…; kredensial dari brankas karena itu
// ditambahkan SESUDAH penyaringan, dan hanya untuk server pemiliknya. Kredensial yang diminta resep tetapi kosong →
// server tidak dinyalakan (pesan jelas), bukan dinyalakan lalu ditolak layanan dengan galat samar.
//
// `rencanaTransport` murni (diuji tanpa proses); `buatTransport` hanya membungkus SDK.

const path = require('path');

const tolak = (alasan) => ({ ok: false, alasan });

/**
 * @param {object} entri entri sah dari daftarServer.cjs
 * @param {Record<string, string>} kredensial id kredensial → nilai (brankas.ambil)
 * @param {{lingkungan?: Record<string, string>, ada?: (alamat: string) => boolean}} opsi
 */
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
    return { ok: true, jenis: 'http', url: entri.http.url, headers };
  }
  return tolak(`jenis server tidak dikenal: ${entri.jenis}`);
}

/** Rencana → transport SDK. Pustaka dimuat saat dipakai (uji `rencanaTransport` tidak butuh SDK). */
function buatTransport(rencana) {
  if (rencana.jenis === 'stdio') {
    const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
    return new StdioClientTransport({ command: rencana.command, args: rencana.args, cwd: rencana.cwd, env: rencana.env, stderr: 'pipe' });
  }
  const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
  return new StreamableHTTPClientTransport(new URL(rencana.url), { requestInit: { headers: rencana.headers } });
}

/** Ringkasan rencana untuk log/layar: tanpa nilai kredensial dan tanpa isi lingkungan. */
function ringkasRencana(rencana) {
  if (!rencana?.ok) return rencana;
  return rencana.jenis === 'stdio'
    ? { ok: true, jenis: 'stdio', command: rencana.command, args: rencana.args, cwd: rencana.cwd }
    : { ok: true, jenis: 'http', url: rencana.url, header: Object.keys(rencana.headers) };
}

module.exports = { rencanaTransport, buatTransport, ringkasRencana };
