// SERVER MCP TIRUAN untuk uji konektor umum (Item 129 Tahap G2). Dijalankan sebagai: node serverMcpTiruan.cjs <berkasDeskripsi>
//
// Tiga alat:
//   baca_data  — deskripsinya dibaca dari <berkasDeskripsi> saat server mulai (uji mengubahnya untuk meniru "rug pull");
//   cek_token  — mengembalikan SHA-256 TIRUAN_TOKEN (bukan nilainya) + apakah rahasia proses utama ikut terkirim;
//   tulis_data — sengaja tidak disetujui uji: memanggilnya harus ditolak Mamet sebelum sampai ke sini.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createRequire } = require('module');

const req = createRequire(path.join(__dirname, '..', '..', 'frontend', 'package.json'));
const { Server } = req('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = req('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = req('@modelcontextprotocol/sdk/types.js');

const berkasDeskripsi = process.argv[2];
const deskripsi = berkasDeskripsi && fs.existsSync(berkasDeskripsi) ? fs.readFileSync(berkasDeskripsi, 'utf8') : 'Membaca data contoh';

const server = new Server({ name: 'tiruan', version: '1.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'baca_data', description: deskripsi, inputSchema: { type: 'object', properties: { kunci: { type: 'string' } }, required: ['kunci'] } },
    { name: 'cek_token', description: 'Sidik token yang diterima server', inputSchema: { type: 'object', properties: {} } },
    { name: 'tulis_data', description: 'Menulis data', inputSchema: { type: 'object', properties: { isi: { type: 'string' } } } },
  ],
}));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: arg } = req.params;
  if (name === 'baca_data') return { content: [{ type: 'text', text: `data untuk ${arg?.kunci}` }] };
  if (name === 'cek_token') {
    const token = process.env.TIRUAN_TOKEN || '';
    const bocor = ['OPENROUTER_API_KEY', 'MAMET_RAHASIA_UJI'].filter((k) => process.env[k]);
    return { content: [{ type: 'text', text: JSON.stringify({ sidik: crypto.createHash('sha256').update(token).digest('hex'), bocor }) }] };
  }
  if (name === 'tulis_data') return { content: [{ type: 'text', text: 'TERTULIS' }] };
  return { content: [{ type: 'text', text: 'alat tak dikenal' }], isError: true };
});
server.connect(new StdioServerTransport());
