/**
 * KONEKTOR MCP — klien di proses utama (Item 129 Tahap B, 2026-10-23).
 *
 * Mamet sebagai KLIEN MCP: menjalankan server MCP lokal (stdio), lalu initialize → tools/list → tools/call.
 * Rancangan & keputusan Owner: docs/roadmap/ROADMAP-KONEKTOR-MCP.md (K1–K15).
 *
 *   - PER WORKSPACE (K3): satu proses server per (workspace, konektor). Menyalakan konektor di Assistant tidak
 *     menghubungkan Engineer — kuncinya `${ws}::${id}`, dan setiap kunci punya proses sendiri.
 *   - LINGKUNGAN DAFTAR PUTIH: server hanya menerima variabel aman dari SDK (`getDefaultEnvironment`: PATH, TEMP,
 *     USERPROFILE, …) — kunci API di proses Electron TIDAK ikut. Lebih ketat dari `envBersih` (daftar hitam).
 *   - TANPA SHELL & ALAMAT ABSOLUT: program = `python.exe` di `.venv` konektor itu sendiri, dicek ada sebelum jalan;
 *     tidak dicari di PATH.
 *   - `panggil()` SENGAJA TIDAK diekspos ke layar di tahap ini. K2: setiap alat menunggu persetujuan Owner, dan
 *     gerbang itu harus di proses utama (layar tidak bisa dipercaya untuk bertanya sendiri). Gerbangnya dibangun di
 *     Tahap D; sampai saat itu belum ada jalur dari layar yang bisa memanggil alat konektor.
 *
 * Murni (tanpa `electron`) supaya bisa diuji dengan node biasa — lihat `uji/uji-konektor-mcp.mjs`.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport, getDefaultEnvironment } = require('@modelcontextprotocol/sdk/client/stdio.js');

const WORKSPACE = Object.freeze(['ws-assistant', 'ws-engineer']);

// Konektor yang dikenal. Menambah konektor lokal = menambah entri di sini (Tahap C: Settings menampilkannya).
const KONEKTOR = Object.freeze({
  'ecosystem-crawler': Object.freeze({
    nama: 'Ecosystem Crawler',
    jenis: 'lokal',
    folder: ['capability', 'ecosystem-crawler'],        // relatif ke akar repo (npm run desktop); pemasang: Tahap E
    python: ['.venv', 'Scripts', 'python.exe'],          // Python milik konektor itu, bukan Python di PATH
    modul: 'crawler.wajah.mcp_server',                   // dijalankan `python -m` — paket dimuat dari folder kerja
    berkasModul: ['crawler', 'wajah', 'mcp_server.py'],
  }),
});

const BATAS = Object.freeze({
  sambungMs: 30000,
  panggilBawaanMs: 60000,
  panggilMaksMs: 150000,      // jalankan_misi crawler menunggu ≤ 110 s di sisi server
  hasilHuruf: 60000,          // hasil alat yang lebih panjang dipotong — dibawa ke prompt, harus berbatas
  stderrHuruf: 4000,          // ekor log server untuk keterangan galat
});

const RAHASIA = /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|SUPABASE|OPENROUTER|AUTH/i;

/** Lingkungan untuk server: daftar putih SDK + pengaturan Python; nama yang berbau rahasia dibuang (berjaga). */
function lingkunganServer(dasar = getDefaultEnvironment()) {
  const hasil = {};
  for (const [k, v] of Object.entries(dasar)) if (!RAHASIA.test(k)) hasil[k] = v;
  return { ...hasil, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1' };
}

const tolak = (alasan) => ({ ok: false, alasan });

function sahWorkspace(ws) { return WORKSPACE.includes(ws); }
function sahKonektor(id) { return Object.prototype.hasOwnProperty.call(KONEKTOR, id); }

/** Cara menjalankan konektor `id` — atau alasan kenapa tidak bisa. Tidak menjalankan apa pun. */
function peluncuran(akarRepo, id) {
  if (!sahKonektor(id)) return tolak(`konektor tidak dikenal: ${id}`);
  const k = KONEKTOR[id];
  if (!akarRepo) return tolak('akar repo tidak diketahui');
  const folder = path.join(akarRepo, ...k.folder);
  const python = path.join(folder, ...k.python);
  if (!fs.existsSync(path.join(folder, ...k.berkasModul))) return tolak(`kode konektor tidak ada di ${folder}`);
  if (!fs.existsSync(python)) return tolak(`Python konektor tidak ada (${path.relative(akarRepo, python)})`);
  return { ok: true, command: python, args: ['-m', k.modul], cwd: folder, env: lingkunganServer() };
}

function matikanPohon(pid) {
  if (!pid) return;
  const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
  try { execFile(taskkill, ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {}); } catch { /* sudah mati */ }
}

function denganBatasWaktu(janji, ms, pesan) {
  let t;
  return Promise.race([janji, new Promise((_, gagal) => { t = setTimeout(() => gagal(new Error(pesan)), ms); })])
    .finally(() => clearTimeout(t));
}

/** Teks hasil tools/call: gabungan isi bertipe teks, dipotong ke batas. */
function teksHasil(hasil, batasHuruf = BATAS.hasilHuruf) {
  const bagian = (hasil?.content || []).map((c) => (c?.type === 'text' ? c.text : `[isi ${c?.type || 'tak dikenal'}]`));
  if (hasil?.structuredContent && !bagian.length) bagian.push(JSON.stringify(hasil.structuredContent));
  const teks = bagian.join('\n');
  return teks.length > batasHuruf
    ? { teks: teks.slice(0, batasHuruf), terpotong: true, huruf: teks.length }
    : { teks, terpotong: false, huruf: teks.length };
}

/**
 * Pengelola sesi konektor. `akarRepo` = folder repo Mamet (di `npm run desktop`: dua tingkat di atas berkas ini).
 * @param {{akarRepo: string, versi?: string, log?: (pesan: string) => void}} opsi
 */
function buatPengelolaKonektor({ akarRepo, versi = '0', log = () => {} }) {
  const sesi = new Map(); // `${ws}::${id}` → { client, transport, pid, alat, stderr, status, sejak }

  const kunci = (ws, id) => `${ws}::${id}`;

  function ringkas(ws, id) {
    const s = sesi.get(kunci(ws, id));
    return s
      ? { workspace: ws, konektor: id, status: s.status, pid: s.pid, alat: s.alat.map((a) => a.name), sejak: s.sejak }
      : { workspace: ws, konektor: id, status: 'mati', pid: null, alat: [], sejak: null };
  }

  function status() {
    const hasil = [];
    for (const id of Object.keys(KONEKTOR)) {
      const p = peluncuran(akarRepo, id);
      for (const ws of WORKSPACE) hasil.push({ ...ringkas(ws, id), nama: KONEKTOR[id].nama, tersedia: p.ok, alasan: p.ok ? null : p.alasan });
    }
    return hasil;
  }

  async function nyalakan(ws, id) {
    if (!sahWorkspace(ws)) return tolak(`workspace tidak dikenal: ${ws}`);
    const p = peluncuran(akarRepo, id);
    if (!p.ok) return p;
    const k = kunci(ws, id);
    if (sesi.get(k)?.status === 'nyala') return { ok: true, ...ringkas(ws, id) };

    const transport = new StdioClientTransport({ command: p.command, args: p.args, cwd: p.cwd, env: p.env, stderr: 'pipe' });
    const catatan = { stderr: '' };
    transport.stderr?.on('data', (b) => { catatan.stderr = (catatan.stderr + b.toString('utf8')).slice(-BATAS.stderrHuruf); });
    const client = new Client({ name: 'mamet-ecosystem', version: versi });
    try {
      await denganBatasWaktu(client.connect(transport), BATAS.sambungMs, `server tidak menjawab dalam ${BATAS.sambungMs / 1000} s`);
      const { tools } = await denganBatasWaktu(client.listTools(), BATAS.sambungMs, 'tools/list tidak dijawab');
      const s = { client, transport, pid: transport.pid, alat: tools || [], status: 'nyala', sejak: new Date().toISOString(), catatan };
      transport.onclose = () => { if (sesi.get(k) === s) { s.status = 'berhenti'; log(`[KONEKTOR] ${k} berhenti sendiri. ${catatan.stderr.slice(-300)}`); } };
      sesi.set(k, s);
      log(`[KONEKTOR] ${k} nyala (pid ${s.pid}, ${s.alat.length} alat)`);
      return { ok: true, ...ringkas(ws, id) };
    } catch (e) {
      const pid = transport.pid;
      try { await client.close(); } catch { /* */ }
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
    try { await s.client.close(); } catch { /* */ }
    matikanPohon(s.pid); // berjaga: proses anak (mis. browser stealth) ikut mati
    log(`[KONEKTOR] ${k} dimatikan`);
    return { ok: true, ...ringkas(ws, id) };
  }

  async function matikanSemua() {
    await Promise.all([...sesi.keys()].map((k) => { const [ws, id] = k.split('::'); return matikan(ws, id); }));
  }

  /**
   * Panggil satu alat. TIDAK diekspos ke layar (lihat kepala berkas) — gerbang persetujuan Owner (K2/K8) Tahap D
   * yang akan memanggilnya.
   */
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

  return { status, nyalakan, matikan, matikanSemua, panggil };
}

module.exports = { buatPengelolaKonektor, peluncuran, lingkunganServer, teksHasil, KONEKTOR, WORKSPACE, BATAS };
