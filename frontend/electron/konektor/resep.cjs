
const fs = require('fs');
const path = require('path');

const POLA_ID = /^[a-z][a-z0-9-]{1,39}$/;
const POLA_ENV = /^[A-Z][A-Z0-9_]{1,63}$/;
const POLA_HEADER = /^[A-Za-z][A-Za-z0-9-]{1,63}$/;
const BERBAU_RAHASIA = /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH/i;
const ID_BAWAAN_TERPAKAI = Object.freeze(['ecosystem-crawler']);

const BATAS = Object.freeze({ nama: 60, petunjuk: 1200, argumen: 30, argumenHuruf: 500, kredensial: 8, lingkungan: 20 });

const tolak = (alasan) => ({ ok: false, alasan });
const teks = (v, maks) => typeof v === 'string' && v.trim().length > 0 && v.length <= maks;
const tanpaBarisBaru = (v) => !/[\r\n\0]/.test(v);

function urlSah(u) {
  let url;
  try { url = new URL(String(u)); } catch { return false;  }
  if (url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

function validasiKredensial(daftar, jenis) {
  if (daftar === undefined) return { ok: true, kredensial: [] };
  if (!Array.isArray(daftar) || daftar.length > BATAS.kredensial) return tolak(`kredensial harus daftar (≤ ${BATAS.kredensial})`);
  const hasil = [];
  const sudah = new Set();
  for (const k of daftar) {
    if (!k || typeof k !== 'object') return tolak('kredensial harus objek');
    if (!POLA_ID.test(String(k.id || '')) || sudah.has(k.id)) return tolak(`id kredensial tidak sah/ganda: ${k.id}`);
    if (String(k.id).startsWith('oauth-')) return tolak(`id kredensial ${k.id} dicadangkan untuk OAuth`);
    if (!teks(k.label, BATAS.nama * 2)) return tolak(`label kredensial ${k.id} kosong/terlalu panjang`);
    sudah.add(k.id);
    if (jenis === 'stdio') {
      if (!POLA_ENV.test(String(k.env || ''))) return tolak(`kredensial ${k.id}: "env" harus nama variabel lingkungan`);
      hasil.push({ id: k.id, label: k.label.trim(), env: k.env });
    } else {
      if (!POLA_HEADER.test(String(k.header || ''))) return tolak(`kredensial ${k.id}: "header" harus nama header HTTP`);
      const awalan = k.awalan === undefined ? '' : k.awalan;
      if (typeof awalan !== 'string' || awalan.length > 20 || !tanpaBarisBaru(awalan)) return tolak(`kredensial ${k.id}: "awalan" tidak sah`);
      hasil.push({ id: k.id, label: k.label.trim(), header: k.header, awalan });
    }
  }
  return { ok: true, kredensial: hasil };
}

function validasiLingkungan(obj) {
  if (obj === undefined) return { ok: true, lingkungan: {} };
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return tolak('"lingkungan" harus objek');
  const isi = Object.entries(obj);
  if (isi.length > BATAS.lingkungan) return tolak(`"lingkungan" lebih dari ${BATAS.lingkungan} variabel`);
  const hasil = {};
  for (const [k, v] of isi) {
    if (!POLA_ENV.test(k)) return tolak(`nama variabel tidak sah: ${k}`);
    if (BERBAU_RAHASIA.test(k)) return tolak(`variabel ${k} berbau rahasia — masukkan lewat "kredensial", bukan nilai di resep`);
    if (typeof v !== 'string' || v.length > BATAS.argumenHuruf || !tanpaBarisBaru(v)) return tolak(`nilai variabel ${k} tidak sah`);
    hasil[k] = v;
  }
  return { ok: true, lingkungan: hasil };
}

function validasiResep(mentah) {
  if (!mentah || typeof mentah !== 'object' || Array.isArray(mentah)) return tolak('resep harus objek JSON');
  const { id, nama, jenis } = mentah;
  if (!POLA_ID.test(String(id || ''))) return tolak(`id resep tidak sah: ${id}`);
  if (ID_BAWAAN_TERPAKAI.includes(id)) return tolak(`id ${id} dipakai konektor bawaan`);
  if (!teks(nama, BATAS.nama)) return tolak(`nama resep ${id} kosong/terlalu panjang`);
  if (jenis !== 'stdio' && jenis !== 'http') return tolak(`jenis resep ${id} harus "stdio" atau "http"`);

  const resep = { id, nama: nama.trim(), jenis };
  if (jenis === 'stdio') {
    const s = mentah.stdio;
    if (!s || typeof s !== 'object') return tolak(`resep ${id}: bagian "stdio" tidak ada`);
    if (!/^[A-Za-z0-9._-]{1,80}\.exe$/i.test(String(s.namaProgram || ''))) return tolak(`resep ${id}: "namaProgram" harus nama berkas .exe`);
    const argumen = s.argumen === undefined ? [] : s.argumen;
    if (!Array.isArray(argumen) || argumen.length > BATAS.argumen
      || !argumen.every((a) => typeof a === 'string' && a.length <= BATAS.argumenHuruf && tanpaBarisBaru(a))) {
      return tolak(`resep ${id}: "argumen" harus daftar teks (≤ ${BATAS.argumen})`);
    }
    const lk = validasiLingkungan(s.lingkungan);
    if (!lk.ok) return tolak(`resep ${id}: ${lk.alasan}`);
    resep.stdio = { namaProgram: s.namaProgram, argumen: [...argumen], lingkungan: lk.lingkungan };
  } else {
    if (!urlSah(mentah.http?.url)) return tolak(`resep ${id}: "http.url" harus https (http hanya ke localhost), tanpa kredensial di URL`);
    resep.http = { url: String(mentah.http.url) };
  }
  const kr = validasiKredensial(mentah.kredensial, jenis);
  if (!kr.ok) return tolak(`resep ${id}: ${kr.alasan}`);
  resep.kredensial = kr.kredensial;
  if (mentah.oauth !== undefined) {
    if (mentah.oauth !== true || jenis !== 'http') return tolak(`resep ${id}: "oauth": true hanya untuk jenis http`);
    resep.oauth = true;
  }
  if (mentah.oauthKlienId !== undefined) {
    if (resep.oauth !== true || !/^[A-Za-z0-9._-]{4,100}$/.test(String(mentah.oauthKlienId))) {
      return tolak(`resep ${id}: "oauthKlienId" hanya untuk resep OAuth, berupa id klien tanpa spasi`);
    }
    resep.oauthKlienId = String(mentah.oauthKlienId);
  }
  if (mentah.oauthAlur !== undefined) {
    if (!['browser', 'perangkat'].includes(mentah.oauthAlur) || resep.oauth !== true) return tolak(`resep ${id}: "oauthAlur" harus "browser" atau "perangkat" (resep OAuth)`);
    if (mentah.oauthAlur === 'perangkat' && !resep.oauthKlienId) return tolak(`resep ${id}: login perangkat butuh "oauthKlienId"`);
    resep.oauthAlur = mentah.oauthAlur;
  }
  if (mentah.petunjuk !== undefined) {
    if (!teks(mentah.petunjuk, BATAS.petunjuk)) return tolak(`resep ${id}: "petunjuk" terlalu panjang`);
    resep.petunjuk = mentah.petunjuk.trim();
  }
  if (mentah.sumber !== undefined) {
    if (!urlSah(mentah.sumber) || !String(mentah.sumber).startsWith('https://')) return tolak(`resep ${id}: "sumber" harus URL https`);
    resep.sumber = String(mentah.sumber);
  }
  if (mentah.versiDiuji !== undefined) {
    if (!/^[0-9A-Za-z.+-]{1,30}$/.test(String(mentah.versiDiuji))) return tolak(`resep ${id}: "versiDiuji" tidak sah`);
    resep.versiDiuji = String(mentah.versiDiuji);
  }
  return { ok: true, resep };
}

function bacaFolderResep(folder) {
  const resep = [];
  const galat = [];
  let berkas = [];
  try { berkas = fs.readdirSync(folder).filter((b) => b.toLowerCase().endsWith('.json')).sort(); }
  catch { return { resep, galat };  }
  for (const b of berkas) {
    let mentah;
    try { mentah = JSON.parse(fs.readFileSync(path.join(folder, b), 'utf8')); }
    catch (e) { galat.push(`${b}: bukan JSON (${e.message})`); continue; }
    const v = validasiResep(mentah);
    if (!v.ok) { galat.push(`${b}: ${v.alasan}`); continue; }
    if (`${v.resep.id}.json` !== b) { galat.push(`${b}: nama berkas harus ${v.resep.id}.json`); continue; }
    resep.push(v.resep);
  }
  return { resep, galat };
}

function semuaResep({ folderBawaan, folderOwner = null }) {
  const bawaan = bacaFolderResep(folderBawaan);
  const owner = folderOwner ? bacaFolderResep(folderOwner) : { resep: [], galat: [] };
  const idBawaan = new Set(bawaan.resep.map((r) => r.id));
  const galat = [...bawaan.galat.map((g) => `bawaan ${g}`), ...owner.galat.map((g) => `buatan Anda ${g}`)];
  const daftar = bawaan.resep.map((r) => ({ ...r, asal: 'bawaan' }));
  for (const r of owner.resep) {
    if (idBawaan.has(r.id)) { galat.push(`buatan Anda ${r.id}.json: id sama dengan resep bawaan — diabaikan`); continue; }
    daftar.push({ ...r, asal: 'owner' });
  }
  return { resep: daftar, galat };
}

const FOLDER_BAWAAN = path.join(__dirname, 'resep');

module.exports = { validasiResep, bacaFolderResep, semuaResep, urlSah, POLA_ID, POLA_ENV, BERBAU_RAHASIA, ID_BAWAAN_TERPAKAI, FOLDER_BAWAAN };
