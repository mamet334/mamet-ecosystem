// SIDIK ALAT (Item 129 Tahap G1, 2026-11-03) — satu tugas: memaku definisi alat server MCP yang disetujui Owner (K16).
//
// Deskripsi alat server umum adalah teks pihak lain yang masuk prompt. Owner meninjau dan menyetujuinya SEKALI; yang
// disimpan adalah sidik SHA-256 definisinya (nama + deskripsi + skema argumen). Setiap kali server menyala, sidik
// dihitung ulang dari `tools/list`:
//   - sama          → alat dipakai;
//   - berubah       → server mengganti alat yang sudah disetujui ("rug pull") → konektor TIDAK dipakai sampai Owner
//                     meninjau ulang (lebih aman mematikan seluruh server daripada memakai sisanya: server yang
//                     mengubah satu alat diam-diam tidak lagi bisa dipercaya untuk alat lain);
//   - baru          → alat yang belum pernah disetujui → diabaikan (tidak ada di prompt, tidak bisa dipanggil);
//   - hilang        → alat yang disetujui tetapi tak ada lagi → dicatat saja.

const crypto = require('crypto');

/** JSON dengan kunci terurut — urutan kunci dari server tidak boleh mengubah sidik. */
function kanonik(nilai) {
  if (Array.isArray(nilai)) return `[${nilai.map(kanonik).join(',')}]`;
  if (nilai && typeof nilai === 'object') {
    return `{${Object.keys(nilai).sort().map((k) => `${JSON.stringify(k)}:${kanonik(nilai[k])}`).join(',')}}`;
  }
  return JSON.stringify(nilai === undefined ? null : nilai);
}

/** Sidik satu definisi alat dari `tools/list`. Bidang lain (anotasi, judul tampilan) tidak ikut dipaku. */
function sidik(alat) {
  const inti = { name: String(alat?.name ?? ''), description: String(alat?.description ?? ''), inputSchema: alat?.inputSchema ?? null };
  return crypto.createHash('sha256').update(kanonik(inti), 'utf8').digest('hex');
}

/**
 * Bandingkan alat dari server dengan yang disetujui Owner.
 * @param {{name: string}[]} alatServer hasil `tools/list`
 * @param {Record<string, string>} disetujui nama alat → sidik yang disetujui
 */
function bandingkan(alatServer, disetujui = {}) {
  const dipakai = [];
  const berubah = [];
  const baru = [];
  const ada = new Set();
  for (const a of Array.isArray(alatServer) ? alatServer : []) {
    const nama = String(a?.name ?? '');
    if (!nama || ada.has(nama)) continue; // nama ganda: hanya yang pertama yang dinilai
    ada.add(nama);
    if (!Object.prototype.hasOwnProperty.call(disetujui, nama)) baru.push(nama);
    else if (disetujui[nama] === sidik(a)) dipakai.push(a);
    else berubah.push(nama);
  }
  const hilang = Object.keys(disetujui).filter((n) => !ada.has(n));
  const status = berubah.length ? 'perlu_tinjau' : Object.keys(disetujui).length === 0 ? 'belum_ditinjau' : 'sah';
  return { status, dipakai: status === 'sah' ? dipakai : [], berubah, baru, hilang };
}

/** Peta sidik untuk alat yang dicentang Owner saat meninjau. Nama yang tak ada di server diabaikan. */
function pakuAlat(alatServer, namaDipilih) {
  const pilih = new Set(namaDipilih || []);
  const hasil = {};
  for (const a of Array.isArray(alatServer) ? alatServer : []) {
    if (pilih.has(a?.name) && !hasil[a.name]) hasil[a.name] = sidik(a);
  }
  return hasil;
}

module.exports = { sidik, bandingkan, pakuAlat, kanonik };
