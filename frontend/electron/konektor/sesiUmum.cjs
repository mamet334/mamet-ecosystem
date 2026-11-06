
const fs = require('fs');
const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { rencanaTransport, buatTransport, ringkasRencana } = require('./transport.cjs');
const { buatPenyediaOAuth } = require('./oauthPenyedia.cjs');
const { bandingkan, pakuAlat, sidik } = require('./sidikAlat.cjs');
const { matikanPohon, denganBatasWaktu, teksHasil, BATAS, WORKSPACE } = require('../konektorMcp.cjs');

const tolak = (alasan) => ({ ok: false, alasan });
const BATAS_DESKRIPSI_TINJAU = 4000;

async function klienSdk(rencana, { versi, msSambung, authProvider = null, fetchJaringan = null }) {
  const transport = buatTransport(rencana, { authProvider, fetchJaringan });
  const catatan = { stderr: '' };
  transport.stderr?.on('data', (b) => { catatan.stderr = (catatan.stderr + b.toString('utf8')).slice(-BATAS.stderrHuruf); });
  const client = new Client({ name: 'mamet-ecosystem', version: versi });
  try {
    await denganBatasWaktu(client.connect(transport), msSambung, `server tidak menjawab dalam ${msSambung / 1000} s`);
  } catch (e) {
    const pid = transport.pid;
    try { await client.close(); } catch {  }
    matikanPohon(pid);
    throw new Error(`${e.message}${catatan.stderr ? ` — log server: ${catatan.stderr.slice(-500)}` : ''}`);
  }
  return {
    pid: transport.pid ?? null,
    alat: async () => (await denganBatasWaktu(client.listTools(), msSambung, 'tools/list tidak dijawab')).tools || [],
    panggil: (nama, argumen, ms) => client.callTool({ name: nama, arguments: argumen }, undefined, { timeout: ms }),
    tutup: async () => {
      const pid = transport.pid;
      try { await client.close(); } catch {  }
      matikanPohon(pid);
    },
    saatBerhenti: (f) => { transport.onclose = f; },
  };
}

function ringkasParameter(skema) {
  const props = skema && typeof skema === 'object' && skema.properties && typeof skema.properties === 'object' ? skema.properties : {};
  const wajib = new Set(Array.isArray(skema?.required) ? skema.required : []);
  return Object.entries(props).slice(0, 40).map(([nama, p]) => ({
    nama: String(nama).slice(0, 64),
    tipe: typeof p?.type === 'string' ? p.type : Array.isArray(p?.type) ? p.type.join('|') : 'tak disebut',
    wajib: wajib.has(nama),
  }));
}

function buatSesiUmum({ daftar, brankas, berkasSakelar, lingkungan, ada = fs.existsSync, versi = '0', log = () => {}, buatKlien = klienSdk, msSambung = BATAS.sambungMs, fetchJaringan = null }) {
  const sesi = new Map();
  const keadaan = new Map();
  const snapshot = new Map();
  const sedang = new Map();
  const kunci = (ws, id) => `${ws}::${id}`;

  function bacaSakelar() {
    try {
      const m = JSON.parse(fs.readFileSync(berkasSakelar, 'utf8'));
      const ids = new Set(daftar.semua().map((e) => e.id));
      const hasil = {};
      for (const ws of WORKSPACE) for (const id of Object.keys(m?.[ws] || {})) if (m[ws][id] === true && ids.has(id)) (hasil[ws] ||= {})[id] = true;
      return hasil;
    } catch {
      return {};
    }
  }
  function tulisSakelar(s) {
    fs.mkdirSync(path.dirname(berkasSakelar), { recursive: true });
    fs.writeFileSync(berkasSakelar, JSON.stringify(s, null, 2), 'utf8');
  }

  async function sambung(id) {
    const entri = daftar.ambil(id);
    if (!entri) return tolak(`server ${id} tidak terpasang`);
    const rencana = rencanaTransport(entri, brankas.ambil(id), { lingkungan: lingkungan(), ada });
    if (!rencana.ok) return rencana;
    let oauth = null;
    if (rencana.oauth) {
      oauth = buatPenyediaOAuth({ id, brankas, mode: 'diam', versi, klienId: entri.oauthKlienId || null });
      if (!oauth.terhubung()) return { ...tolak('akun belum dihubungkan — tekan "Hubungkan akun" di Settings'), kode: 'belum_terhubung' };
    }
    try {
      const klien = await buatKlien(rencana, { versi, msSambung, authProvider: oauth?.penyedia || null, fetchJaringan });
      return { ok: true, klien, entri, rencana: ringkasRencana(rencana) };
    } catch (e) {
      if (oauth?.perluHubungkanUlang()) return { ...tolak('akun perlu dihubungkan ulang (login kedaluwarsa)'), kode: 'perlu_hubungkan_ulang' };
      return tolak(e.message);
    }
  }

  async function nyalakanSekali(ws, id) {
    const k = kunci(ws, id);
    if (sesi.get(k)?.status === 'nyala') return { ok: true, ...ringkas(ws, id) };
    const s = await sambung(id);
    if (!s.ok) { keadaan.set(k, { status: s.kode || 'gagal', alasan: s.alasan }); return { ...s, ...ringkas(ws, id) }; }
    let alatServer;
    try { alatServer = await s.klien.alat(); }
    catch (e) { await s.klien.tutup(); keadaan.set(k, { status: 'gagal', alasan: e.message }); return { ...tolak(e.message), ...ringkas(ws, id) }; }
    const p = bandingkan(alatServer, s.entri.alatDisetujui);
    if (p.status !== 'sah') {
      await s.klien.tutup();
      keadaan.set(k, { status: p.status, alasan: p.status === 'perlu_tinjau' ? `alat berubah sejak disetujui: ${p.berubah.join(', ')}` : 'alat belum ditinjau', perbandingan: p });
      log(`[KONEKTOR-UMUM] ${k} tidak dinyalakan: ${p.status}`);
      return { ok: false, alasan: keadaan.get(k).alasan, ...ringkas(ws, id) };
    }
    const catatan = { klien: s.klien, status: 'nyala', alat: p.dipakai, perbandingan: p, sejak: new Date().toISOString() };
    s.klien.saatBerhenti?.(() => { if (sesi.get(k) === catatan) { catatan.status = 'berhenti'; log(`[KONEKTOR-UMUM] ${k} berhenti sendiri`); } });
    sesi.set(k, catatan);
    keadaan.delete(k);
    log(`[KONEKTOR-UMUM] ${k} nyala (pid ${s.klien.pid}, ${p.dipakai.length} alat dipakai, ${p.baru.length} diabaikan)`);
    return { ok: true, ...ringkas(ws, id) };
  }

  function nyalakan(ws, id) {
    if (!WORKSPACE.includes(ws)) return Promise.resolve(tolak(`workspace tidak dikenal: ${ws}`));
    const k = kunci(ws, id);
    if (sedang.has(k)) return sedang.get(k);
    const janji = nyalakanSekali(ws, id).finally(() => sedang.delete(k));
    sedang.set(k, janji);
    return janji;
  }

  async function matikan(ws, id) {
    const k = kunci(ws, id);
    const s = sesi.get(k);
    sesi.delete(k);
    keadaan.delete(k);
    if (s) { await s.klien.tutup(); log(`[KONEKTOR-UMUM] ${k} dimatikan`); }
    return { ok: true, ...ringkas(ws, id) };
  }

  async function matikanSemua() {
    await Promise.all([...sesi.keys()].map((k) => { const [ws, id] = k.split('::'); return matikan(ws, id); }));
  }

  async function mulaiUlang(id) {
    const s = bacaSakelar();
    const hasil = [];
    for (const ws of WORKSPACE) {
      if (!s[ws]?.[id]) continue;
      await matikan(ws, id);
      hasil.push({ workspace: ws, ...(await nyalakan(ws, id)) });
    }
    return hasil;
  }

  async function atur(ws, id, nyala) {
    if (!WORKSPACE.includes(ws)) return tolak(`workspace tidak dikenal: ${ws}`);
    if (!daftar.ambil(id)) return tolak(`server ${id} tidak terpasang`);
    if (typeof nyala !== 'boolean') return tolak('nyala harus true/false');
    const s = bacaSakelar();
    if (nyala) (s[ws] ||= {})[id] = true; else if (s[ws]) delete s[ws][id];
    try { tulisSakelar(s); } catch (e) { return tolak(`sakelar tidak tersimpan: ${e.message}`); }
    return nyala ? nyalakan(ws, id) : matikan(ws, id);
  }

  async function pulihkan() {
    const s = bacaSakelar();
    const hasil = [];
    for (const ws of WORKSPACE) for (const id of Object.keys(s[ws] || {})) hasil.push({ workspace: ws, konektor: id, ...(await nyalakan(ws, id)) });
    return hasil;
  }

  async function tinjau(id) {
    const s = await sambung(id);
    if (!s.ok) return s;
    let alatServer;
    try { alatServer = await s.klien.alat(); }
    catch (e) { return tolak(e.message);  }
    finally { await s.klien.tutup(); }
    snapshot.set(id, alatServer);
    const disetujui = s.entri.alatDisetujui || {};
    const keadaanAlat = (a) => (!Object.prototype.hasOwnProperty.call(disetujui, a.name) ? 'baru' : disetujui[a.name] === sidik(a) ? 'disetujui' : 'berubah');
    return {
      ok: true,
      alat: alatServer.slice(0, 200).map((a) => ({
        nama: String(a.name ?? ''),
        deskripsi: String(a.description ?? '').slice(0, BATAS_DESKRIPSI_TINJAU),
        deskripsiTerpotong: String(a.description ?? '').length > BATAS_DESKRIPSI_TINJAU,
        parameter: ringkasParameter(a.inputSchema),
        keadaan: keadaanAlat(a),
        bacaSaja: a.annotations?.readOnlyHint === true,
        merusak: a.annotations?.destructiveHint === true,
      })),
      hilang: bandingkan(alatServer, disetujui).hilang,
    };
  }

  async function setujui(id, namaAlat) {
    const alatServer = snapshot.get(id);
    if (!alatServer) return tolak('tinjau alat dulu sebelum menyetujui');
    if (!Array.isArray(namaAlat) || !namaAlat.every((n) => typeof n === 'string')) return tolak('daftar alat tidak sah');
    const peta = pakuAlat(alatServer, namaAlat);
    const h = daftar.setujuiAlat(id, peta);
    if (!h.ok) return h;
    snapshot.delete(id);
    log(`[KONEKTOR-UMUM] ${id}: ${Object.keys(peta).length} alat disetujui Owner`);
    return { ok: true, disetujui: Object.keys(peta), mulaiUlang: await mulaiUlang(id) };
  }

  async function hapus(id) {
    for (const ws of WORKSPACE) await matikan(ws, id);
    const s = bacaSakelar();
    for (const ws of WORKSPACE) if (s[ws]) delete s[ws][id];
    try { tulisSakelar(s); } catch (e) { log(`[KONEKTOR-UMUM] sakelar ${id} tidak terhapus: ${e.message}`); }
    brankas.hapusServer(id);
    snapshot.delete(id);
    return daftar.hapus(id);
  }

  function ringkas(ws, id) {
    const k = kunci(ws, id);
    const s = sesi.get(k);
    if (s) return { workspace: ws, konektor: id, status: s.status, pid: s.klien.pid, alat: s.alat.map((a) => a.name), sejak: s.sejak, diabaikan: s.perbandingan.baru };
    const kd = keadaan.get(k);
    return { workspace: ws, konektor: id, status: kd?.status || 'mati', alat: [], alasan: kd?.alasan || null, perbandingan: kd?.perbandingan || null };
  }

  function status() {
    const s = bacaSakelar();
    return daftar.semua().map((e) => ({
      id: e.id, nama: e.nama, jenis: e.jenis, dariResep: e.dariResep || null,
      lokasi: e.jenis === 'stdio' ? e.program : e.http.url,
      argumen: e.jenis === 'stdio' ? e.stdio.argumen : [],
      kredensial: (e.kredensial || []).map((kr) => ({ id: kr.id, label: kr.label, terisi: !!brankas.status(e.id)[kr.id] })),
      oauth: e.oauth === true,
      terhubung: e.oauth === true ? buatPenyediaOAuth({ id: e.id, brankas }).terhubung() : null,
      alatDisetujui: Object.keys(e.alatDisetujui || {}),
      ws: Object.fromEntries(WORKSPACE.map((ws) => [ws, { diaktifkan: s[ws]?.[e.id] === true, ...ringkas(ws, e.id) }])),
    }));
  }

  async function panggil(ws, id, nama, argumen = {}, { batasMs = BATAS.panggilBawaanMs } = {}) {
    const s = sesi.get(kunci(ws, id));
    if (!s || s.status !== 'nyala') return tolak(`konektor ${id} tidak nyala di ${ws}`);
    if (!s.alat.some((a) => a.name === nama)) return tolak(`alat ${nama} tidak disetujui untuk ${id}`);
    if (!argumen || typeof argumen !== 'object' || Array.isArray(argumen)) return tolak('argumen harus objek');
    const ms = Math.min(Math.max(Number(batasMs) || BATAS.panggilBawaanMs, 1000), BATAS.panggilMaksMs);
    try {
      const hasil = await s.klien.panggil(nama, argumen, ms);
      return { ok: true, galatAlat: !!hasil?.isError, ...teksHasil(hasil) };
    } catch (e) {
      return tolak(`${nama}: ${e.message}`);
    }
  }

  function aktif(ws) {
    const hasil = [];
    for (const e of daftar.semua()) {
      const s = sesi.get(kunci(ws, e.id));
      if (s?.status === 'nyala' && s.alat.length) {
        hasil.push({ id: e.id, nama: e.nama, alat: s.alat.map((a) => ({ name: a.name, description: a.description, inputSchema: a.inputSchema })) });
      }
    }
    return hasil;
  }

  const namaServer = (id) => daftar.ambil(id)?.nama || null;

  return { status, atur, nyalakan, matikan, matikanSemua, mulaiUlang, pulihkan, tinjau, setujui, hapus, panggil, aktif, namaServer };
}

module.exports = { buatSesiUmum, ringkasParameter, klienSdk };
