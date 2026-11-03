// SESI KONEKTOR UMUM (Item 129 Tahap G2, 2026-11-03) — satu tugas: menyalakan, meninjau, dan mematikan server MCP
// yang dipasang Owner, per workspace (K3).
//
// Alur Owner di Settings:
//   1. pasang server dari resep (daftarServer) → isi kredensial (brankas);
//   2. TINJAU: Mamet tersambung sebentar, membaca `tools/list`, menampilkan alat + deskripsinya; snapshot disimpan di
//      memori proses ini;
//   3. SETUJUI: Owner mencentang alat → sidik dihitung dari SNAPSHOT yang Owner lihat (bukan dari data layar — layar
//      hanya mengirim NAMA alat), disimpan sebagai `alatDisetujui` (K16);
//   4. sakelar per workspace → server menyala; alat yang dipakai = hasil `bandingkan` sidik. Server yang mengubah alat
//      yang disetujui → status "perlu_tinjau", prosesnya DIMATIKAN, tak ada alat dipakai.
//
// Sakelar disimpan di berkasnya sendiri (`konektor-umum-sakelar.json`), bukan `konektor.json` crawler: normalisasi
// setelan crawler membuang id yang tak dikenalnya, jadi sakelar server umum akan hilang diam-diam di sana.
// `panggil` belum punya jalur dari layar — gerbang izin K17 menyusul di G3.

const fs = require('fs');
const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { rencanaTransport, buatTransport, ringkasRencana } = require('./transport.cjs');
const { buatPenyediaOAuth } = require('./oauthPenyedia.cjs');
const { bandingkan, pakuAlat, sidik } = require('./sidikAlat.cjs');
const { matikanPohon, denganBatasWaktu, teksHasil, BATAS, WORKSPACE } = require('../konektorMcp.cjs');

const tolak = (alasan) => ({ ok: false, alasan });
const BATAS_DESKRIPSI_TINJAU = 4000; // deskripsi yang DITAMPILKAN untuk ditinjau (sidik tetap dari teks utuh)

/** Klien MCP sungguhan dari rencana transport. Bisa diganti di uji. `authProvider` untuk server OAuth (Tahap F1). */
async function klienSdk(rencana, { versi, msSambung, authProvider = null }) {
  const transport = buatTransport(rencana, { authProvider });
  const catatan = { stderr: '' };
  transport.stderr?.on('data', (b) => { catatan.stderr = (catatan.stderr + b.toString('utf8')).slice(-BATAS.stderrHuruf); });
  const client = new Client({ name: 'mamet-ecosystem', version: versi });
  try {
    await denganBatasWaktu(client.connect(transport), msSambung, `server tidak menjawab dalam ${msSambung / 1000} s`);
  } catch (e) {
    const pid = transport.pid;
    try { await client.close(); } catch { /* sambungan memang gagal — pohon proses dimatikan di bawah */ }
    matikanPohon(pid);
    throw new Error(`${e.message}${catatan.stderr ? ` — log server: ${catatan.stderr.slice(-500)}` : ''}`);
  }
  return {
    pid: transport.pid ?? null,
    alat: async () => (await denganBatasWaktu(client.listTools(), msSambung, 'tools/list tidak dijawab')).tools || [],
    panggil: (nama, argumen, ms) => client.callTool({ name: nama, arguments: argumen }, undefined, { timeout: ms }),
    tutup: async () => {
      const pid = transport.pid;
      try { await client.close(); } catch { /* server sudah berhenti sendiri — matikanPohon tetap memastikan */ }
      matikanPohon(pid);
    },
    saatBerhenti: (f) => { transport.onclose = f; },
  };
}

/** Ringkasan skema argumen untuk tinjauan: nama, tipe, wajib — tanpa menafsirkan teks bebasnya. */
function ringkasParameter(skema) {
  const props = skema && typeof skema === 'object' && skema.properties && typeof skema.properties === 'object' ? skema.properties : {};
  const wajib = new Set(Array.isArray(skema?.required) ? skema.required : []);
  return Object.entries(props).slice(0, 40).map(([nama, p]) => ({
    nama: String(nama).slice(0, 64),
    tipe: typeof p?.type === 'string' ? p.type : Array.isArray(p?.type) ? p.type.join('|') : 'tak disebut',
    wajib: wajib.has(nama),
  }));
}

/**
 * @param {{daftar: object, brankas: object, berkasSakelar: string, lingkungan: () => Record<string,string>,
 *   ada?: (p: string) => boolean, versi?: string, log?: Function, buatKlien?: Function, msSambung?: number}} opsi
 */
function buatSesiUmum({ daftar, brankas, berkasSakelar, lingkungan, ada = fs.existsSync, versi = '0', log = () => {}, buatKlien = klienSdk, msSambung = BATAS.sambungMs }) {
  const sesi = new Map();       // `${ws}::${id}` → { klien, status, alat (dipakai), perbandingan, sejak }
  const keadaan = new Map();    // `${ws}::${id}` → { status, alasan, perbandingan } untuk yang TIDAK menyala
  const snapshot = new Map();   // id → alat dari tinjauan terakhir (yang dilihat Owner)
  const sedang = new Map();     // `${ws}::${id}` → janji nyala (sakelar ditekan dua kali = satu proses)
  const kunci = (ws, id) => `${ws}::${id}`;

  function bacaSakelar() {
    try {
      const m = JSON.parse(fs.readFileSync(berkasSakelar, 'utf8'));
      const ids = new Set(daftar.semua().map((e) => e.id));
      const hasil = {};
      for (const ws of WORKSPACE) for (const id of Object.keys(m?.[ws] || {})) if (m[ws][id] === true && ids.has(id)) (hasil[ws] ||= {})[id] = true;
      return hasil;
    } catch {
      return {}; // belum pernah disimpan / rusak → semua mati (aman ke arah mati, terlihat di Settings)
    }
  }
  function tulisSakelar(s) {
    fs.mkdirSync(path.dirname(berkasSakelar), { recursive: true });
    fs.writeFileSync(berkasSakelar, JSON.stringify(s, null, 2), 'utf8');
  }

  /** Sambung ke server `id` (rencana dari entri + brankas). */
  async function sambung(id) {
    const entri = daftar.ambil(id);
    if (!entri) return tolak(`server ${id} tidak terpasang`);
    const rencana = rencanaTransport(entri, brankas.ambil(id), { lingkungan: lingkungan(), ada });
    if (!rencana.ok) return rencana;
    // Tahap F1: server OAuth → penyedia mode DIAM (tak pernah membuka browser; login ulang = status, K23).
    let oauth = null;
    if (rencana.oauth) {
      oauth = buatPenyediaOAuth({ id, brankas, mode: 'diam', versi, klienId: entri.oauthKlienId || null });
      if (!oauth.terhubung()) return { ...tolak('akun belum dihubungkan — tekan "Hubungkan akun" di Settings'), kode: 'belum_terhubung' };
    }
    try {
      const klien = await buatKlien(rencana, { versi, msSambung, authProvider: oauth?.penyedia || null });
      return { ok: true, klien, entri, rencana: ringkasRencana(rencana) };
    } catch (e) {
      // dinaikkan ke pemanggil: tampil sebagai status "gagal" + alasannya di Settings
      if (oauth?.perluHubungkanUlang()) return { ...tolak('akun perlu dihubungkan ulang (login kedaluwarsa)'), kode: 'perlu_hubungkan_ulang' };
      return tolak(e.message);
    }
  }

  async function nyalakanSekali(ws, id) {
    const k = kunci(ws, id);
    if (sesi.get(k)?.status === 'nyala') return { ok: true, ...ringkas(ws, id) };
    const s = await sambung(id);
    // `kode` (Tahap F1): 'belum_terhubung' / 'perlu_hubungkan_ulang' tampil sebagai status sendiri, bukan "gagal".
    if (!s.ok) { keadaan.set(k, { status: s.kode || 'gagal', alasan: s.alasan }); return { ...s, ...ringkas(ws, id) }; }
    let alatServer;
    try { alatServer = await s.klien.alat(); }
    catch (e) { await s.klien.tutup(); keadaan.set(k, { status: 'gagal', alasan: e.message }); return { ...tolak(e.message), ...ringkas(ws, id) }; }
    const p = bandingkan(alatServer, s.entri.alatDisetujui);
    if (p.status !== 'sah') {
      // Belum ditinjau / alat berubah: tak ada yang boleh dipakai, jadi proses tak perlu hidup (K16).
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

  /** Server yang sedang dinyalakan Owner dinyalakan ulang (sesudah kredensial/persetujuan berubah). */
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

  /**
   * TINJAU: sambung sebentar, baca alat, simpan snapshot. Yang dikembalikan untuk ditampilkan sebagai TEKS — layar
   * tidak boleh merender deskripsi sebagai HTML (desktop tanpa CSP).
   */
  async function tinjau(id) {
    const s = await sambung(id);
    if (!s.ok) return s;
    let alatServer;
    try { alatServer = await s.klien.alat(); }
    catch (e) { return tolak(e.message); /* dinaikkan ke layar tinjau sebagai alasan */ }
    finally { await s.klien.tutup(); }
    snapshot.set(id, alatServer);
    const disetujui = s.entri.alatDisetujui || {};
    // Per alat: belum pernah disetujui → baru; disetujui & sidik sama → disetujui; disetujui & sidik beda → berubah.
    const keadaanAlat = (a) => (!Object.prototype.hasOwnProperty.call(disetujui, a.name) ? 'baru' : disetujui[a.name] === sidik(a) ? 'disetujui' : 'berubah');
    return {
      ok: true,
      alat: alatServer.slice(0, 200).map((a) => ({
        nama: String(a.name ?? ''),
        deskripsi: String(a.description ?? '').slice(0, BATAS_DESKRIPSI_TINJAU),
        deskripsiTerpotong: String(a.description ?? '').length > BATAS_DESKRIPSI_TINJAU,
        parameter: ringkasParameter(a.inputSchema),
        keadaan: keadaanAlat(a),
        // Penanda dari PEMBUAT SERVER (anotasi MCP) — hanya bantuan memilih di layar, bukan jaminan; tidak ikut sidik.
        bacaSaja: a.annotations?.readOnlyHint === true,
        merusak: a.annotations?.destructiveHint === true,
      })),
      hilang: bandingkan(alatServer, disetujui).hilang,
    };
  }

  /** SETUJUI: dari snapshot tinjauan terakhir (bukan dari data layar). Tanpa tinjauan → ditolak. */
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

  /** Server dihapus: proses dimatikan, sakelar & kredensial & entri dihapus. */
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

  /** Untuk layar: entri + kredensial terisi/kosong (tanpa nilai) + status per workspace. */
  function status() {
    const s = bacaSakelar();
    return daftar.semua().map((e) => ({
      id: e.id, nama: e.nama, jenis: e.jenis, dariResep: e.dariResep || null,
      lokasi: e.jenis === 'stdio' ? e.program : e.http.url,
      argumen: e.jenis === 'stdio' ? e.stdio.argumen : [],
      kredensial: (e.kredensial || []).map((kr) => ({ id: kr.id, label: kr.label, terisi: !!brankas.status(e.id)[kr.id] })),
      // Tahap F2: server OAuth — layar menampilkan "Hubungkan akun" / "Putuskan" (tanpa token apa pun).
      oauth: e.oauth === true,
      terhubung: e.oauth === true ? buatPenyediaOAuth({ id: e.id, brankas }).terhubung() : null,
      alatDisetujui: Object.keys(e.alatDisetujui || {}),
      ws: Object.fromEntries(WORKSPACE.map((ws) => [ws, { diaktifkan: s[ws]?.[e.id] === true, ...ringkas(ws, e.id) }])),
    }));
  }

  /**
   * Panggil alat yang DIPAKAI (sidik cocok) di workspace itu. Belum ada jalur dari layar: gerbang K17 (G3) yang akan
   * memanggilnya.
   */
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

  /**
   * Untuk chat (G3): server yang MENYALA di workspace ini + alat yang DIPAKAI (sidik cocok dengan persetujuan Owner).
   * Definisi alat apa adanya dari server — disaring & dinetralkan `shared/konektorUmum.js` sebelum ke prompt.
   */
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
