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
    // Dibaca MAMET SENDIRI saat konektor menyala (Tahap C, rancangan §6 D): isinya setelan crawler — sumber & sakelar
    // akses — bukan data luar, jadi tidak lewat persetujuan Owner dan tidak membuka jalur tools/call dari layar.
    bacaSaatNyala: 'katalog',
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

/** Setelan tersimpan → bentuk sah: hanya workspace & konektor yang dikenal, nilai `true` saja yang berarti nyala. */
function normalisasiSetelan(mentah) {
  const hasil = {};
  for (const ws of WORKSPACE) {
    for (const id of Object.keys(KONEKTOR)) {
      if (mentah?.[ws]?.[id] === true) (hasil[ws] ||= {})[id] = true;
    }
  }
  return hasil;
}

/** Ringkasan `katalog` crawler untuk Settings: sakelar akses + jumlah sumber yang aktif & siap. */
function ringkasKatalog(teks) {
  try {
    const k = JSON.parse(teks);
    const sumber = Array.isArray(k.sumber) ? k.sumber : [];
    return {
      akses: k.akses || null,
      sumber: sumber.length,
      siap: sumber.filter((s) => s.aktif && s.kesehatan === 'siap').length,
      versi: k.versi || null,
    };
  } catch {
    // Katalog bukan JSON (server lain / versi crawler lain): Settings menampilkan "tampil setelah menyala" alih-alih
    // angka yang salah. Konektornya tetap nyala — ringkasan hanya pelengkap tampilan.
    return null;
  }
}

/**
 * Pengelola sesi konektor. `akarRepo` = folder repo Mamet (di `npm run desktop`: dua tingkat di atas berkas ini).
 * `berkasSetelan` = JSON di perangkat (K7: setelan konektor tidak ikut akun) — mis. %APPDATA%\Mamet AI\konektor.json.
 * @param {{akarRepo: string, berkasSetelan?: string, versi?: string, log?: (pesan: string) => void}} opsi
 */
function buatPengelolaKonektor({ akarRepo, berkasSetelan = null, versi = '0', log = () => {} }) {
  const sesi = new Map(); // `${ws}::${id}` → { client, transport, pid, alat, stderr, status, sejak, ringkasan }

  const kunci = (ws, id) => `${ws}::${id}`;

  function bacaSetelan() {
    if (!berkasSetelan) return {};
    try {
      return normalisasiSetelan(JSON.parse(fs.readFileSync(berkasSetelan, 'utf8')));
    } catch {
      // Belum pernah disimpan (berkas tidak ada) atau rusak → semua konektor mati. Aman ke arah mati: tidak ada proses
      // yang dinyalakan tanpa sakelar Owner yang terbaca jelas. Owner melihat sakelarnya mati di Settings.
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
      const p = peluncuran(akarRepo, id);
      for (const ws of WORKSPACE) {
        hasil.push({
          ...ringkas(ws, id), nama: KONEKTOR[id].nama, jenis: KONEKTOR[id].jenis,
          diaktifkan: setelan[ws]?.[id] === true, tersedia: p.ok, alasan: p.ok ? null : p.alasan,
        });
      }
    }
    return hasil;
  }

  const sedangMenyala = new Map(); // `${ws}::${id}` → janji — sakelar ditekan dua kali tidak melahirkan dua proses

  async function nyalakan(ws, id) {
    if (!sahWorkspace(ws)) return tolak(`workspace tidak dikenal: ${ws}`);
    const k = kunci(ws, id);
    if (sedangMenyala.has(k)) return sedangMenyala.get(k);
    const janji = nyalakanSekali(ws, id).finally(() => sedangMenyala.delete(k));
    sedangMenyala.set(k, janji);
    return janji;
  }

  async function nyalakanSekali(ws, id) {
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
      try { await client.close(); } catch { /* sambungan memang gagal — penutupannya boleh gagal juga; pohon proses dimatikan di bawah */ }
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
    try { await s.client.close(); } catch { /* server sudah berhenti sendiri — matikanPohon di bawah tetap memastikan */ }
    matikanPohon(s.pid); // berjaga: proses anak (mis. browser stealth) ikut mati
    log(`[KONEKTOR] ${k} dimatikan`);
    return { ok: true, ...ringkas(ws, id) };
  }

  async function matikanSemua() {
    await Promise.all([...sesi.keys()].map((k) => { const [ws, id] = k.split('::'); return matikan(ws, id); }));
  }

  /** Sakelar Owner di Settings: disimpan di perangkat (K7), lalu konektor dinyalakan/dimatikan di workspace itu. */
  async function atur(ws, id, nyala) {
    if (!sahWorkspace(ws) || !sahKonektor(id)) return tolak('workspace/konektor tidak dikenal');
    if (typeof nyala !== 'boolean') return tolak('nyala harus true/false');
    const setelan = bacaSetelan();
    if (nyala) (setelan[ws] ||= {})[id] = true;
    else if (setelan[ws]) delete setelan[ws][id];
    try { simpanSetelan(setelan); } catch (e) { return tolak(`setelan tidak tersimpan: ${e.message}`); }
    return nyala ? nyalakan(ws, id) : matikan(ws, id);
  }

  /** Saat aplikasi dibuka: konektor yang dinyalakan Owner dinyalakan lagi. Gagal → tampil di status, tidak diulang. */
  async function pulihkan() {
    const setelan = bacaSetelan();
    const hasil = [];
    for (const ws of WORKSPACE) {
      for (const id of Object.keys(setelan[ws] || {})) hasil.push({ workspace: ws, konektor: id, ...(await nyalakan(ws, id)) });
    }
    return hasil;
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

  return { status, nyalakan, matikan, matikanSemua, panggil, atur, pulihkan, bacaSetelan };
}

module.exports = {
  buatPengelolaKonektor, peluncuran, lingkunganServer, teksHasil, normalisasiSetelan, ringkasKatalog, KONEKTOR, WORKSPACE, BATAS,
};
