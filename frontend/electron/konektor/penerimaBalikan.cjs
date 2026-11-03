// PENERIMA BALIKAN OAUTH (Item 129 Tahap F1, 2026-11-03) — satu tugas: menerima kode otorisasi dari browser, sekali.
//
// Aplikasi desktop tidak punya alamat web. Cara baku (RFC 8252): server HTTP kecil di 127.0.0.1 dengan port acak;
// halaman login penyedia mengarahkan browser kembali ke `http://127.0.0.1:<port>/balikan?code=…&state=…`.
//
// Aturan:
//   - hanya mendengar di 127.0.0.1 (bukan 0.0.0.0) — perangkat lain di jaringan tidak bisa mengirim kode;
//   - satu jalur (`/balikan`); jalur lain 404, tidak menutup penerima;
//   - balikan PERTAMA yang membawa `code` atau `error` mengakhiri penerima; sesudahnya port ditutup;
//   - batas waktu (bawaan 5 menit) — Owner yang menutup tab login tidak meninggalkan port terbuka;
//   - halaman balasan teks biasa yang sudah di-escape — parameter dari URL tidak pernah dirender sebagai HTML.
//   - Pemeriksaan `state` dilakukan PEMANGGIL (alurOAuth.cjs), yang tahu state yang dibuat penyedia.

const http = require('http');

const BATAS_BAWAAN_MS = 5 * 60 * 1000;
const JALUR = '/balikan';
const escape = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function halaman(judul, isi) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Mamet</title></head>`
    + `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">`
    + `<h1 style="font-size:1.25rem">${escape(judul)}</h1><p>${escape(isi)}</p></body></html>`;
}

/**
 * Mulai penerima. `port` 0 = acak; port tertentu dipakai untuk mengulang alamat balikan yang sudah didaftarkan.
 * @returns {Promise<{url: string, port: number, tunggu: () => Promise<{code: string|null, state: string|null, galat: string|null}>, tutup: () => void}>}
 */
function mulaiPenerima({ port = 0, batasMs = BATAS_BAWAAN_MS } = {}) {
  return new Promise((selesaiMulai, gagalMulai) => {
    let selesai;
    let gagal;
    const hasil = new Promise((ok, no) => { selesai = ok; gagal = no; });
    hasil.catch(() => {}); // ditangani pemanggil lewat tunggu(); ini hanya mencegah "unhandled rejection" bila tak ditunggu
    let habis = null;

    const server = http.createServer((req, res) => {
      let url;
      try { url = new URL(req.url, 'http://127.0.0.1'); } catch { res.writeHead(400).end(); return; /* URL rusak — abaikan, tetap menunggu */ }
      if (req.method !== 'GET' || url.pathname !== JALUR) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('tidak ada'); return; }
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const galat = url.searchParams.get('error');
      if (!code && !galat) { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('balikan tanpa kode'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(galat
        ? halaman('Login dibatalkan', `Penyedia menjawab: ${galat}. Anda boleh menutup tab ini.`)
        : halaman('Login selesai', 'Kembali ke Mamet. Tab ini boleh ditutup.'));
      tutup();
      selesai({ code, state, galat });
    });

    function tutup() {
      if (habis) { clearTimeout(habis); habis = null; }
      server.close();
      server.closeAllConnections?.();
    }

    server.on('error', (e) => gagalMulai(e));
    server.listen(port, '127.0.0.1', () => {
      const p = server.address().port;
      habis = setTimeout(() => { tutup(); gagal(new Error('login tidak diselesaikan dalam batas waktu')); }, batasMs);
      selesaiMulai({ url: `http://127.0.0.1:${p}${JALUR}`, port: p, tunggu: () => hasil, tutup: () => { tutup(); gagal(new Error('dibatalkan')); } });
    });
  });
}

module.exports = { mulaiPenerima, JALUR };
