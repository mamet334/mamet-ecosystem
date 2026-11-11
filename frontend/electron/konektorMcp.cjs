
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport, getDefaultEnvironment } = require('@modelcontextprotocol/sdk/client/stdio.js');
const stealth = require('./stealthKonektor.cjs');
const komponenKonektor = require('./komponenKonektor.cjs');

const WORKSPACE = Object.freeze(['ws-assistant', 'ws-engineer']);

const KONEKTOR = Object.freeze({
  'ecosystem-crawler': Object.freeze({
    nama: 'Ecosystem Crawler',
    jenis: 'lokal',
    folder: ['capability', 'ecosystem-crawler'],
    python: ['.venv', 'Scripts', 'python.exe'],
    terbundel: Object.freeze({ python: ['python', 'python.exe'] }),
    folderDataWajib: Object.freeze(['inbox']),
    stealth: true,
    modul: 'crawler.wajah.mcp_server',
    berkasModul: ['crawler', 'wajah', 'mcp_server.py'],
    bacaSaatNyala: 'katalog',
    kebijakan: Object.freeze({ bebas: ['katalog'], misiBaru: 'jalankan_misi', ikutMisi: ['status_misi', 'baca_tangkapan'] }),
  }),
});

const BATAS = Object.freeze({
  sambungMs: 90000,
  panggilBawaanMs: 60000,
  panggilMaksMs: 150000,
  hasilHuruf: 60000,
  stderrHuruf: 4000,
});

const RAHASIA = /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|SUPABASE|OPENROUTER|AUTH/i;

function lingkunganServer(dasar = getDefaultEnvironment()) {
  const hasil = {};
  for (const [k, v] of Object.entries(dasar)) if (!RAHASIA.test(k)) hasil[k] = v;
  return { ...hasil, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1' };
}

const tolak = (alasan) => ({ ok: false, alasan });

function sahWorkspace(ws) { return WORKSPACE.includes(ws); }
function sahKonektor(id) { return Object.prototype.hasOwnProperty.call(KONEKTOR, id); }

function peluncuran(akarRepo, id, { runtimeTerbundel = null, folderData = null, folderDataPengembangan = null } = {}) {
  if (!sahKonektor(id)) return tolak(`konektor tidak dikenal: ${id}`);
  const k = KONEKTOR[id];
  if (runtimeTerbundel) {
    const python = path.join(runtimeTerbundel, ...k.terbundel.python);
    if (!fs.existsSync(path.join(runtimeTerbundel, ...k.berkasModul))) return tolak(`runtime konektor tidak lengkap di ${runtimeTerbundel}`);
    if (!fs.existsSync(python)) return tolak('Python konektor tidak ada di runtime terbundel');
    if (!folderData) return tolak('folder data konektor tidak diketahui');
    const st = k.stealth ? stealth.statusStealth({ terbundel: true, folderData }) : { keadaan: 'belum' };
    return {
      ok: true, command: python, args: ['-m', k.modul], cwd: runtimeTerbundel,
      env: { ...lingkunganServer(), CRAWLER_ROOT: folderData, ...(st.keadaan === 'terpasang' ? { PYTHONPATH: st.folderPaket } : {}) },
      folderData, terbundel: true,
    };
  }
  if (!akarRepo) return tolak('akar repo tidak diketahui');
  const folder = path.join(akarRepo, ...k.folder);
  const python = path.join(folder, ...k.python);
  if (!fs.existsSync(path.join(folder, ...k.berkasModul))) return tolak(`kode konektor tidak ada di ${folder}`);
  if (!fs.existsSync(python)) return tolak(`Python konektor tidak ada (${path.relative(akarRepo, python)})`);
  if (folderDataPengembangan) {
    return {
      ok: true, command: python, args: ['-m', k.modul], cwd: folder,
      env: { ...lingkunganServer(), CRAWLER_ROOT: folderDataPengembangan }, folderData: folderDataPengembangan, terbundel: false,
    };
  }
  return { ok: true, command: python, args: ['-m', k.modul], cwd: folder, env: lingkunganServer(), terbundel: false };
}

function matikanPohon(pid) {
  if (!pid) return;
  const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
  try { execFile(taskkill, ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {}); } catch {  }
}

function denganBatasWaktu(janji, ms, pesan) {
  let t;
  return Promise.race([janji, new Promise((_, gagal) => { t = setTimeout(() => gagal(new Error(pesan)), ms); })])
    .finally(() => clearTimeout(t));
}

const POLA_MIME_TEKS = /^text\/|^application\/(json|xml|yaml|x-yaml|toml|javascript|typescript|x-sh|x-httpd-php|sql|graphql|ld\+json|xhtml\+xml|x-ndjson)\b|\+(json|xml|yaml)\b/i;

function isiResource(r) {
  const alamat = String(r?.uri || 'tanpa alamat').slice(0, 300);
  const mime = String(r?.mimeType || '').slice(0, 80);
  const kepala = `[resource ${alamat}${mime ? ` · ${mime}` : ''}]`;
  if (typeof r?.text === 'string') return `${kepala}\n${r.text}`;
  if (typeof r?.blob === 'string') {
    const byte = Buffer.from(r.blob, 'base64');
    const teks = byte.toString('utf8');
    const tampakTeks = (POLA_MIME_TEKS.test(mime) || !mime) && !teks.includes(String.fromCharCode(0)) && !teks.includes(String.fromCharCode(0xFFFD));
    return tampakTeks
      ? `${kepala}\n${teks}`
      : `[resource biner ${alamat}${mime ? ` · ${mime}` : ''} · ${byte.length} byte — isinya bukan teks, tidak diteruskan]`;
  }
  return `${kepala}\n(resource tanpa isi)`;
}

function bagianHasil(c) {
  if (c?.type === 'text') return String(c.text ?? '');
  if (c?.type === 'resource') return isiResource(c.resource);
  if (c?.type === 'resource_link') {
    const nama = [c.name, c.description].filter((x) => typeof x === 'string' && x.trim()).join(' — ').slice(0, 300);
    return `[tautan resource ${String(c.uri || 'tanpa alamat').slice(0, 300)}${nama ? ` · ${nama}` : ''} — isinya belum dibaca; minta alat baca bila perlu]`;
  }
  if (c?.type === 'image' || c?.type === 'audio') return `[isi ${c.type}${c.mimeType ? ` · ${String(c.mimeType).slice(0, 80)}` : ''} — bukan teks, tidak diteruskan]`;
  return `[isi ${c?.type || 'tak dikenal'} — jenis ini tidak dikenali, tidak diteruskan]`;
}

function teksHasil(hasil, batasHuruf = BATAS.hasilHuruf) {
  const bagian = (hasil?.content || []).map(bagianHasil);
  if (hasil?.structuredContent && !bagian.length) bagian.push(JSON.stringify(hasil.structuredContent));
  const teks = bagian.join('\n');
  return teks.length > batasHuruf
    ? { teks: teks.slice(0, batasHuruf), terpotong: true, huruf: teks.length }
    : { teks, terpotong: false, huruf: teks.length };
}

function normalisasiSetelan(mentah) {
  const hasil = {};
  for (const ws of WORKSPACE) {
    for (const id of Object.keys(KONEKTOR)) {
      if (mentah?.[ws]?.[id] === true) (hasil[ws] ||= {})[id] = true;
    }
  }
  return hasil;
}

function ringkasKatalog(teks) {
  try {
    const k = JSON.parse(teks);
    const sumber = Array.isArray(k.sumber) ? k.sumber : [];
    const siap = sumber.filter((s) => s.aktif && s.kesehatan === 'siap');
    return {
      akses: k.akses || null,
      sumber: sumber.length,
      siap: siap.length,
      sumberSiap: siap.map((s) => ({ id: s.id, cocok: Array.isArray(s.cocok_untuk) ? s.cocok_untuk : [] })),
      versi: k.versi || null,
    };
  } catch {
    return null;
  }
}

function buatPengelolaKonektor({ akarRepo, berkasSetelan = null, runtimeTerbundel = null, folderData = null, folderDataPengembangan = null, versi = '0', log = () => {} }) {
  const sesi = new Map();
  let sedangPasangStealth = null;

  const kunci = (ws, id) => `${ws}::${id}`;
  const luncurkan = (id) => peluncuran(akarRepo, id, { runtimeTerbundel, folderData, folderDataPengembangan });

  function bacaSetelan() {
    if (!berkasSetelan) return {};
    try {
      return normalisasiSetelan(JSON.parse(fs.readFileSync(berkasSetelan, 'utf8')));
    } catch {
      return {};
    }
  }

  function simpanSetelan(setelan) {
    if (!berkasSetelan) return;
    fs.mkdirSync(path.dirname(berkasSetelan), { recursive: true });
    fs.writeFileSync(berkasSetelan, JSON.stringify(normalisasiSetelan(setelan), null, 2), 'utf8');
  }

  function ringkas(ws, id) {
    const s = sesi.get(kunci(ws, id));
    return s
      ? { workspace: ws, konektor: id, status: s.status, pid: s.pid, alat: s.alat.map((a) => a.name), sejak: s.sejak, ringkasan: s.ringkasan }
      : { workspace: ws, konektor: id, status: 'mati', pid: null, alat: [], sejak: null, ringkasan: null };
  }

  function status() {
    const setelan = bacaSetelan();
    const hasil = [];
    for (const id of Object.keys(KONEKTOR)) {
      const p = luncurkan(id);
      for (const ws of WORKSPACE) {
        hasil.push({
          ...ringkas(ws, id), nama: KONEKTOR[id].nama, jenis: KONEKTOR[id].jenis,
          diaktifkan: setelan[ws]?.[id] === true, tersedia: p.ok, alasan: p.ok ? null : p.alasan,
          stealth: KONEKTOR[id].stealth && p.ok
            ? { ...stealth.statusStealth({ terbundel: p.terbundel, folderData }), sedangDipasang: sedangPasangStealth !== null, folderPaket: undefined }
            : null,
        });
      }
    }
    return hasil;
  }

  const sedangMenyala = new Map();

  async function nyalakan(ws, id) {
    if (!sahWorkspace(ws)) return tolak(`workspace tidak dikenal: ${ws}`);
    const k = kunci(ws, id);
    if (sedangMenyala.has(k)) return sedangMenyala.get(k);
    const janji = nyalakanSekali(ws, id).finally(() => sedangMenyala.delete(k));
    sedangMenyala.set(k, janji);
    return janji;
  }

  async function nyalakanSekali(ws, id) {
    const p = luncurkan(id);
    if (!p.ok) return p;
    const k = kunci(ws, id);
    if (sesi.get(k)?.status === 'nyala') return { ok: true, ...ringkas(ws, id) };
    if (p.folderData) {
      try { for (const f of KONEKTOR[id].folderDataWajib || []) fs.mkdirSync(path.join(p.folderData, f), { recursive: true }); }
      catch (e) { log(`[KONEKTOR] folder data ${p.folderData} tidak bisa disiapkan: ${e.message}`); }
    }

    const transport = new StdioClientTransport({ command: p.command, args: p.args, cwd: p.cwd, env: p.env, stderr: 'pipe' });
    const catatan = { stderr: '' };
    transport.stderr?.on('data', (b) => { catatan.stderr = (catatan.stderr + b.toString('utf8')).slice(-BATAS.stderrHuruf); });
    const client = new Client({ name: 'mamet-ecosystem', version: versi });
    try {
      await denganBatasWaktu(client.connect(transport), BATAS.sambungMs, `server tidak menjawab dalam ${BATAS.sambungMs / 1000} s`);
      const { tools } = await denganBatasWaktu(client.listTools(), BATAS.sambungMs, 'tools/list tidak dijawab');
      const s = { client, transport, pid: transport.pid, alat: tools || [], status: 'nyala', sejak: new Date().toISOString(), catatan, ringkasan: null };
      const baca = KONEKTOR[id].bacaSaatNyala;
      if (baca && s.alat.some((a) => a.name === baca)) {
        try {
          const h = await client.callTool({ name: baca, arguments: {} }, undefined, { timeout: BATAS.sambungMs });
          s.ringkasan = ringkasKatalog(teksHasil(h).teks);
        } catch (e) { log(`[KONEKTOR] ${k}: ${baca} gagal dibaca — ${e.message}`); }
      }
      transport.onclose = () => { if (sesi.get(k) === s) { s.status = 'berhenti'; log(`[KONEKTOR] ${k} berhenti sendiri. ${catatan.stderr.slice(-300)}`); } };
      sesi.set(k, s);
      log(`[KONEKTOR] ${k} nyala (pid ${s.pid}, ${s.alat.length} alat)`);
      return { ok: true, ...ringkas(ws, id) };
    } catch (e) {
      const pid = transport.pid;
      try { await client.close(); } catch {  }
      matikanPohon(pid);
      return tolak(`${e.message}${catatan.stderr ? ` — log server: ${catatan.stderr.slice(-500)}` : ''}`);
    }
  }

  async function matikan(ws, id) {
    if (!sahWorkspace(ws) || !sahKonektor(id)) return tolak('workspace/konektor tidak dikenal');
    const k = kunci(ws, id);
    const s = sesi.get(k);
    if (!s) return { ok: true, ...ringkas(ws, id) };
    sesi.delete(k);
    try { await s.client.close(); } catch {  }
    matikanPohon(s.pid);
    log(`[KONEKTOR] ${k} dimatikan`);
    return { ok: true, ...ringkas(ws, id) };
  }

  async function matikanSemua() {
    await Promise.all([...sesi.keys()].map((k) => { const [ws, id] = k.split('::'); return matikan(ws, id); }));
  }

  async function atur(ws, id, nyala) {
    if (!sahWorkspace(ws) || !sahKonektor(id)) return tolak('workspace/konektor tidak dikenal');
    if (typeof nyala !== 'boolean') return tolak('nyala harus true/false');
    const setelan = bacaSetelan();
    if (nyala) (setelan[ws] ||= {})[id] = true;
    else if (setelan[ws]) delete setelan[ws][id];
    try { simpanSetelan(setelan); } catch (e) { return tolak(`setelan tidak tersimpan: ${e.message}`); }
    return nyala ? nyalakan(ws, id) : matikan(ws, id);
  }

  function pasangStealth({ jalankan } = {}) {
    if (sedangPasangStealth) return sedangPasangStealth;
    sedangPasangStealth = (async () => {
      if (!runtimeTerbundel) return tolak('komponen stealth hanya dipasang di aplikasi terpasang — di npm run desktop sudah ada di .venv');
      const salinanProxy = Object.fromEntries(['HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'no_proxy']
        .filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
      const h = await stealth.pasangStealth({
        runtime: runtimeTerbundel, folderData, env: { ...lingkunganServer(), ...salinanProxy }, log, ...(jalankan ? { jalankan } : {}),
      });
      if (h.ok) {
        for (const k of [...sesi.keys()]) {
          const [ws, id] = k.split('::');
          if (sesi.get(k)?.status === 'nyala' && KONEKTOR[id]?.stealth) { await matikan(ws, id); await nyalakan(ws, id); }
        }
      }
      return h;
    })().finally(() => { sedangPasangStealth = null; });
    return sedangPasangStealth;
  }

  const opsiKomponen = (id) => ({ runtimeTerbundel, folderData, folderRepo: akarRepo ? path.join(akarRepo, ...KONEKTOR[id].folder) : null });

  async function komponen(id) {
    if (!sahKonektor(id)) return tolak(`konektor tidak dikenal: ${id}`);
    return { ok: true, ...(await komponenKonektor.bacaKomponen(opsiKomponen(id))) };
  }

  function lokasiFolder(id, kunci) {
    return sahKonektor(id) ? komponenKonektor.lokasiFolder(kunci, opsiKomponen(id)) : null;
  }

  async function pulihkan() {
    const setelan = bacaSetelan();
    const hasil = [];
    for (const ws of WORKSPACE) {
      for (const id of Object.keys(setelan[ws] || {})) hasil.push({ workspace: ws, konektor: id, ...(await nyalakan(ws, id)) });
    }
    return hasil;
  }

  async function panggil(ws, id, nama, argumen = {}, { batasMs = BATAS.panggilBawaanMs } = {}) {
    const s = sesi.get(kunci(ws, id));
    if (!s || s.status !== 'nyala') return tolak(`konektor ${id} tidak nyala di ${ws}`);
    if (!s.alat.some((a) => a.name === nama)) return tolak(`alat tidak dikenal: ${nama}`);
    if (!argumen || typeof argumen !== 'object' || Array.isArray(argumen)) return tolak('argumen harus objek');
    const ms = Math.min(Math.max(Number(batasMs) || BATAS.panggilBawaanMs, 1000), BATAS.panggilMaksMs);
    try {
      const hasil = await s.client.callTool({ name: nama, arguments: argumen }, undefined, { timeout: ms });
      return { ok: true, galatAlat: !!hasil?.isError, ...teksHasil(hasil) };
    } catch (e) {
      return tolak(`${nama}: ${e.message}`);
    }
  }

  function rencanaPeluncuran(id) {
    const p = luncurkan(id);
    return p.ok
      ? { ok: true, command: p.command, cwd: p.cwd, terbundel: p.terbundel, akarData: p.env?.CRAWLER_ROOT || null }
      : p;
  }

  return { status, nyalakan, matikan, matikanSemua, panggil, atur, pulihkan, bacaSetelan, pasangStealth, komponen, lokasiFolder, rencanaPeluncuran };
}

function misiIdDari(teks) {
  try { const id = JSON.parse(teks)?.misi_id; return typeof id === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(id) ? id : null; }
  catch {
    return null;
  }
}

const LABEL_WS = { 'ws-assistant': 'Assistant', 'ws-engineer': 'Engineer' };

function susunDialog(ws, id, alat, argumen, ringkasan) {
  const nama = KONEKTOR[id].nama;
  const daftar = (v) => (Array.isArray(v) ? v.join(', ') : v ? String(v) : '—');
  if (alat === KONEKTOR[id].kebijakan?.misiBaru) {
    const a = argumen;
    const baris = [
      `Sumber: ${daftar(a.sumber)}`,
      a.kata_kunci?.length ? `Kata kunci: ${daftar(a.kata_kunci)}` : null,
      a.url_awal?.length ? `Link: ${daftar(a.url_awal)}` : null,
      a.kata_kunci_kecuali?.length ? `Kecuali: ${daftar(a.kata_kunci_kecuali)}` : null,
      `Rentang: ${a.sejak || 'tanpa batas awal'}${a.sampai ? ` s.d. ${a.sampai}` : ''}`,
      `Batas: ${a.batas_per_sumber ?? 50} per sumber, ${a.batas_total ?? 300} total${a.ambil_komentar ? ', termasuk komentar' : ''}`,
      a.owner_intent ? `Perintah Anda: "${String(a.owner_intent).slice(0, 200)}"` : null,
      '',
      ringkasan?.akses?.keterangan ? `Cara akses: ${ringkasan.akses.keterangan}` : null,
      'Hasil tangkapan (penulis berpseudonim) akan dibaca model dan ikut terkirim ke penyedia model.',
      'Persetujuan ini berlaku untuk misi ini saja: cek status & baca hasilnya tidak ditanyakan lagi.',
    ].filter((b) => b !== null);
    return { judul: `${nama} — jalankan misi baru? (${LABEL_WS[ws]})`, rincian: baris.join('\n') };
  }
  return {
    judul: `${nama} — izinkan "${alat}"? (${LABEL_WS[ws]})`,
    rincian: `Argumen: ${JSON.stringify(argumen).slice(0, 600)}${alat === 'ekspor_misi' ? '\n\nMenulis berkas hasil ke folder hasil/ crawler di laptop ini.' : ''}`,
  };
}

function buatGerbangKonektor({ pengelola, mintaIzin, log = () => {} }) {
  const izinMisi = new Map();

  async function panggil(ws, id, alat, argumen = {}) {
    if (!sahWorkspace(ws) || !sahKonektor(id)) return { ...tolak('workspace/konektor tidak dikenal'), alat };
    if (!argumen || typeof argumen !== 'object' || Array.isArray(argumen)) return { ...tolak('argumen harus objek'), alat };
    const kb = KONEKTOR[id].kebijakan || {};
    const k = `${ws}::${id}`;
    const disetujui = izinMisi.get(k) || new Set();
    const bebas = (kb.bebas || []).includes(alat)
      || ((kb.ikutMisi || []).includes(alat) && disetujui.has(String(argumen.misi_id || '')));
    if (!bebas) {
      const ringkasan = pengelola.status().find((s) => s.workspace === ws && s.konektor === id)?.ringkasan;
      let setuju = false;
      try { setuju = await mintaIzin(susunDialog(ws, id, alat, argumen, ringkasan)); }
      catch (e) { log(`[KONEKTOR] dialog persetujuan gagal: ${e.message}`); }
      if (!setuju) {
        log(`[KONEKTOR] ${k} ${alat} DITOLAK OWNER`);
        return { ok: false, ditolakOwner: true, alat, alasan: 'ditolak Owner di dialog persetujuan' };
      }
    }
    const h = await pengelola.panggil(ws, id, alat, argumen, alat === kb.misiBaru ? { batasMs: 130000 } : undefined);
    if (h.ok && alat === kb.misiBaru) {
      const misiId = misiIdDari(h.teks);
      if (misiId) { disetujui.add(misiId); izinMisi.set(k, disetujui); h.misiId = misiId; }
    }
    log(`[KONEKTOR] ${k} ${alat} → ${h.ok ? `OK${bebas ? ' (tanpa dialog)' : ''}` : h.alasan}`);
    return { ...h, alat };
  }

  return { panggil, izinMisi: (ws, id) => [...(izinMisi.get(`${ws}::${id}`) || [])] };
}

module.exports = {
  buatPengelolaKonektor, buatGerbangKonektor, susunDialog, misiIdDari,
  peluncuran, lingkunganServer, teksHasil, normalisasiSetelan, ringkasKatalog, KONEKTOR, WORKSPACE, BATAS,
  matikanPohon, denganBatasWaktu,
};
