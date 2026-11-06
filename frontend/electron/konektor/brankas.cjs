
const fs = require('fs');
const path = require('path');

const POLA_ID = /^[a-z][a-z0-9-]{1,39}$/;
const BATAS_NILAI = 4096;
const tolak = (alasan) => ({ ok: false, alasan });

function buatBrankas({ berkas, enkripsi }) {
  if (!berkas) throw new Error('brankas butuh alamat berkas');
  if (!enkripsi || typeof enkripsi.sandikan !== 'function' || typeof enkripsi.buka !== 'function') {
    throw new Error('brankas butuh enkripsi (safeStorage)');
  }

  function baca() {
    try {
      const isi = JSON.parse(fs.readFileSync(berkas, 'utf8'));
      return isi && typeof isi === 'object' && !Array.isArray(isi) ? isi : {};
    } catch {
      return {};
    }
  }

  function tulis(isi) {
    fs.mkdirSync(path.dirname(berkas), { recursive: true });
    const sementara = `${berkas}.${process.pid}.baru`;
    fs.writeFileSync(sementara, JSON.stringify(isi, null, 2), 'utf8');
    fs.renameSync(sementara, berkas);
  }

  const tersedia = () => {
    try { return enkripsi.tersedia() === true; }
    catch { return false;  }
  };

  function simpan(serverId, kredId, nilai, { maks = BATAS_NILAI } = {}) {
    if (!POLA_ID.test(String(serverId || '')) || !POLA_ID.test(String(kredId || ''))) return tolak('id server/kredensial tidak sah');
    if (typeof nilai !== 'string') return tolak('nilai kredensial harus teks');
    const bersih = nilai.trim();
    if (bersih.length > maks) return tolak(`nilai kredensial lebih dari ${maks} huruf`);
    if (/[\r\n\0]/.test(bersih)) return tolak('nilai kredensial tidak boleh memuat baris baru');
    const isi = baca();
    if (!bersih) {
      if (isi[serverId]) { delete isi[serverId][kredId]; if (!Object.keys(isi[serverId]).length) delete isi[serverId]; tulis(isi); }
      return { ok: true, terisi: false };
    }
    if (!tersedia()) return tolak('enkripsi Windows tidak tersedia — kredensial tidak disimpan');
    let sandi;
    try { sandi = enkripsi.sandikan(bersih); } catch (e) { return tolak(`enkripsi gagal: ${e.message}`); }
    (isi[serverId] ||= {})[kredId] = Buffer.from(sandi).toString('base64');
    tulis(isi);
    return { ok: true, terisi: true };
  }

  function status(serverId) {
    const s = baca()[serverId] || {};
    return Object.fromEntries(Object.keys(s).map((k) => [k, true]));
  }

  function ambil(serverId) {
    const s = baca()[serverId] || {};
    const hasil = {};
    if (!tersedia()) return hasil;
    for (const [k, v] of Object.entries(s)) {
      try { hasil[k] = enkripsi.buka(Buffer.from(String(v), 'base64')); }
      catch {  }
    }
    return hasil;
  }

  function hapusServer(serverId) {
    const isi = baca();
    if (!isi[serverId]) return { ok: true };
    delete isi[serverId];
    tulis(isi);
    return { ok: true };
  }

  return { simpan, status, ambil, hapusServer, tersedia };
}

module.exports = { buatBrankas, BATAS_NILAI };
