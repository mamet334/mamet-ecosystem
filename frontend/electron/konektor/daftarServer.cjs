// DAFTAR SERVER KONEKTOR UMUM (Item 129 Tahap G1, 2026-11-03) — satu tugas: server MCP yang DIPASANG Owner.
//
// Satu entri = satu server: dari resep (`resep.cjs`) atau diisi sendiri di Settings. Entri menyimpan alamat program
// (stdio) atau URL (http), argumen, kredensial yang DIMINTA (namanya, bukan nilainya — nilai di `brankas.cjs`), dan
// sidik alat yang disetujui Owner (`sidikAlat.cjs`, K16). Disimpan di perangkat (K7), tidak ikut akun.
//
// Sakelar nyala/mati per workspace TIDAK di sini — tetap di `konektor.json` milik pengelola sesi (K3), sama seperti
// crawler. Berkas rusak → daftar kosong (aman ke arah mati: tak ada server yang dijalankan tanpa entri yang jelas).

const fs = require('fs');
const path = require('path');
const { validasiResep, POLA_ID } = require('./resep.cjs');

const MAKS_SERVER = 20;
const POLA_SIDIK = /^[0-9a-f]{64}$/;
const tolak = (alasan) => ({ ok: false, alasan });

/** Alamat program: absolut, berkas .exe (tanpa shell — .cmd/.bat ditolak). Keberadaannya diperiksa saat menyala. */
function programSah(p) {
  return typeof p === 'string' && p.length <= 400 && path.win32.isAbsolute(p) && /\.exe$/i.test(p) && !/[\r\n\0"]/.test(p);
}

function alatDisetujuiSah(obj) {
  if (obj === undefined) return { ok: true, alat: {} };
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return tolak('"alatDisetujui" harus objek');
  const isi = Object.entries(obj);
  if (isi.length > 200) return tolak('alat disetujui terlalu banyak');
  for (const [nama, s] of isi) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(nama) || !POLA_SIDIK.test(String(s))) return tolak(`sidik alat ${nama} tidak sah`);
  }
  return { ok: true, alat: { ...obj } };
}

/**
 * Entri mentah → bentuk sah. Bentuk dasarnya resep (divalidasi `validasiResep`), ditambah `program` (stdio),
 * `dariResep`, dan `alatDisetujui`.
 */
function validasiEntri(mentah) {
  if (!mentah || typeof mentah !== 'object') return tolak('entri server harus objek');
  // Resep stdio butuh `namaProgram`; entri memakai nama berkas dari `program` yang ditunjuk Owner.
  const sebagaiResep = mentah.jenis === 'stdio'
    ? { ...mentah, stdio: { ...(mentah.stdio || {}), namaProgram: path.win32.basename(String(mentah.program || 'x.exe')) } }
    : mentah;
  const v = validasiResep(sebagaiResep);
  if (!v.ok) return v;
  const entri = { ...v.resep };
  if (entri.jenis === 'stdio') {
    if (!programSah(mentah.program)) return tolak(`server ${entri.id}: "program" harus alamat lengkap ke berkas .exe`);
    entri.program = mentah.program;
    entri.stdio = { argumen: v.resep.stdio.argumen, lingkungan: v.resep.stdio.lingkungan };
  }
  if (mentah.dariResep !== undefined) {
    if (!POLA_ID.test(String(mentah.dariResep))) return tolak('"dariResep" tidak sah');
    entri.dariResep = mentah.dariResep;
  }
  const a = alatDisetujuiSah(mentah.alatDisetujui);
  if (!a.ok) return tolak(`server ${entri.id}: ${a.alasan}`);
  entri.alatDisetujui = a.alat;
  return { ok: true, entri };
}

/** Entri baru dari resep + isian Owner (alamat program). Alat belum disetujui sampai ditinjau. */
function entriDariResep(resep, { program } = {}) {
  const dasar = { ...resep, dariResep: resep.id, alatDisetujui: {} };
  delete dasar.asal;
  if (resep.jenis === 'stdio') {
    dasar.program = program;
    dasar.stdio = { argumen: resep.stdio.argumen, lingkungan: resep.stdio.lingkungan };
  }
  return validasiEntri(dasar);
}

/** @param {{berkas: string}} opsi */
function buatDaftarServer({ berkas }) {
  if (!berkas) throw new Error('daftar server butuh alamat berkas');

  function baca() {
    let mentah;
    try { mentah = JSON.parse(fs.readFileSync(berkas, 'utf8')); }
    catch { return []; /* belum pernah disimpan atau rusak → tak ada server (lihat kepala berkas) */ }
    const hasil = [];
    const sudah = new Set();
    for (const m of Array.isArray(mentah?.server) ? mentah.server : []) {
      const v = validasiEntri(m);
      if (v.ok && !sudah.has(v.entri.id)) { sudah.add(v.entri.id); hasil.push(v.entri); }
    }
    return hasil;
  }

  function tulis(daftar) {
    fs.mkdirSync(path.dirname(berkas), { recursive: true });
    const sementara = `${berkas}.${process.pid}.baru`;
    fs.writeFileSync(sementara, JSON.stringify({ versi: 1, server: daftar }, null, 2), 'utf8');
    fs.renameSync(sementara, berkas);
  }

  const semua = () => baca();
  const ambil = (id) => baca().find((e) => e.id === id) || null;

  function tambah(mentah) {
    const v = validasiEntri(mentah);
    if (!v.ok) return v;
    const daftar = baca();
    if (daftar.some((e) => e.id === v.entri.id)) return tolak(`server ${v.entri.id} sudah terpasang`);
    if (daftar.length >= MAKS_SERVER) return tolak(`paling banyak ${MAKS_SERVER} server`);
    daftar.push(v.entri);
    tulis(daftar);
    return { ok: true, entri: v.entri };
  }

  /** Ubah entri. Mengubah cara menjalankan (program/argumen/URL/lingkungan) MENGHAPUS persetujuan alat. */
  function ubah(id, perubahan) {
    const daftar = baca();
    const i = daftar.findIndex((e) => e.id === id);
    if (i < 0) return tolak(`server ${id} tidak terpasang`);
    const lama = daftar[i];
    const baru = { ...lama, ...perubahan, id }; // id tidak bisa diganti lewat ubah
    const caraJalan = (e) => JSON.stringify([e.program, e.stdio, e.http]);
    if (caraJalan(baru) !== caraJalan(lama) && perubahan.alatDisetujui === undefined) baru.alatDisetujui = {};
    const v = validasiEntri(baru);
    if (!v.ok) return v;
    daftar[i] = v.entri;
    tulis(daftar);
    return { ok: true, entri: v.entri };
  }

  /** Simpan hasil tinjauan Owner (peta nama alat → sidik dari `pakuAlat`). */
  const setujuiAlat = (id, petaSidik) => ubah(id, { alatDisetujui: petaSidik });

  function hapus(id) {
    const daftar = baca();
    const sisa = daftar.filter((e) => e.id !== id);
    if (sisa.length === daftar.length) return tolak(`server ${id} tidak terpasang`);
    tulis(sisa);
    return { ok: true };
  }

  return { semua, ambil, tambah, ubah, setujuiAlat, hapus };
}

module.exports = { buatDaftarServer, validasiEntri, entriDariResep, programSah, MAKS_SERVER };
