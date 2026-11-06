
const crypto = require('crypto');

function kanonik(nilai) {
  if (Array.isArray(nilai)) return `[${nilai.map(kanonik).join(',')}]`;
  if (nilai && typeof nilai === 'object') {
    return `{${Object.keys(nilai).sort().map((k) => `${JSON.stringify(k)}:${kanonik(nilai[k])}`).join(',')}}`;
  }
  return JSON.stringify(nilai === undefined ? null : nilai);
}

function sidik(alat) {
  const inti = { name: String(alat?.name ?? ''), description: String(alat?.description ?? ''), inputSchema: alat?.inputSchema ?? null };
  return crypto.createHash('sha256').update(kanonik(inti), 'utf8').digest('hex');
}

function bandingkan(alatServer, disetujui = {}) {
  const dipakai = [];
  const berubah = [];
  const baru = [];
  const ada = new Set();
  for (const a of Array.isArray(alatServer) ? alatServer : []) {
    const nama = String(a?.name ?? '');
    if (!nama || ada.has(nama)) continue;
    ada.add(nama);
    if (!Object.prototype.hasOwnProperty.call(disetujui, nama)) baru.push(nama);
    else if (disetujui[nama] === sidik(a)) dipakai.push(a);
    else berubah.push(nama);
  }
  const hilang = Object.keys(disetujui).filter((n) => !ada.has(n));
  const status = berubah.length ? 'perlu_tinjau' : Object.keys(disetujui).length === 0 ? 'belum_ditinjau' : 'sah';
  return { status, dipakai: status === 'sah' ? dipakai : [], berubah, baru, hilang };
}

function pakuAlat(alatServer, namaDipilih) {
  const pilih = new Set(namaDipilih || []);
  const hasil = {};
  for (const a of Array.isArray(alatServer) ? alatServer : []) {
    if (pilih.has(a?.name) && !hasil[a.name]) hasil[a.name] = sidik(a);
  }
  return hasil;
}

module.exports = { sidik, bandingkan, pakuAlat, kanonik };
