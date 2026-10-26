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
 *   - `panggil()` pengelola TIDAK pernah diekspos ke layar. Jalan satu-satunya dari layar ke tools/call adalah
 *     `buatGerbangKonektor` (Tahap D): K2 — setiap alat menunggu persetujuan Owner; K8 — sekali per misi. Gerbang
 *     ada di proses utama karena layar tidak bisa dipercaya untuk bertanya sendiri.
 *
 * Murni (tanpa `electron`) supaya bisa diuji dengan node biasa — lihat `uji/uji-konektor-mcp.mjs`.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport, getDefaultEnvironment } = require('@modelcontextprotocol/sdk/client/stdio.js');
const stealth = require('./stealthKonektor.cjs');

const WORKSPACE = Object.freeze(['ws-assistant', 'ws-engineer']);

// Konektor yang dikenal. Menambah konektor lokal = menambah entri di sini (Tahap C: Settings menampilkannya).
const KONEKTOR = Object.freeze({
  'ecosystem-crawler': Object.freeze({
    nama: 'Ecosystem Crawler',
    jenis: 'lokal',
    folder: ['capability', 'ecosystem-crawler'],        // relatif ke akar repo (npm run desktop)
    python: ['.venv', 'Scripts', 'python.exe'],          // Python milik konektor itu, bukan Python di PATH
    terbundel: Object.freeze({ python: ['python', 'python.exe'] }), // relatif ke resources/crawler-runtime (Tahap E)
    // Folder yang crawler anggap wajib ada di CRAWLER_ROOT — di folder data baru belum ada (sumber inbox "belum siap").
    folderDataWajib: Object.freeze(['inbox']),
    // Komponen tingkat stealth tidak dibundel (K14) — dipasang atas izin Owner (Tahap E2, stealthKonektor.cjs).
    stealth: true,
    modul: 'crawler.wajah.mcp_server',                   // dijalankan `python -m` — paket dimuat dari folder kerja
    berkasModul: ['crawler', 'wajah', 'mcp_server.py'],
    // Dibaca MAMET SENDIRI saat konektor menyala (Tahap C, rancangan §6 D): isinya setelan crawler — sumber & sakelar
    // akses — bukan data luar, jadi tidak lewat persetujuan Owner dan tidak membuka jalur tools/call dari layar.
    bacaSaatNyala: 'katalog',
    // Gerbang (Tahap D, K2/K8): misi baru → dialog; status & baca untuk misi yang SUDAH disetujui di workspace itu →
    // tanpa dialog; alat lain → dialog setiap kali. `bebas` = setelan capability (bukan data luar).
    kebijakan: Object.freeze({ bebas: ['katalog'], misiBaru: 'jalankan_misi', ikutMisi: ['status_misi', 'baca_tangkapan'] }),
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
/**
 * Dua cara menjalankan konektor (Tahap E, K10):
 *   - `npm run desktop`: dari repo — `capability/ecosystem-crawler/.venv`; data crawler di folder itu sendiri.
 *   - aplikasi terpasang: dari runtime yang DIBUNDEL pemasang (`resources/crawler-runtime/{python, crawler}`, disiapkan
 *     `scripts/siapkan-crawler.mjs`); folder program tidak bisa ditulis, jadi data, `.env`, dan hasil crawler ada di
 *     `folderData` (%APPDATA%\Mamet AI\crawler) lewat CRAWLER_ROOT.
 * `runtimeTerbundel` diisi proses utama hanya bila `app.isPackaged`.
 */
function peluncuran(akarRepo, id, { runtimeTerbundel = null, folderData = null } = {}) {
  if (!sahKonektor(id)) return tolak(`konektor tidak dikenal: ${id}`);
  const k = KONEKTOR[id];
  if (runtimeTerbundel) {
    const python = path.join(runtimeTerbundel, ...k.terbundel.python);
    if (!fs.existsSync(path.join(runtimeTerbundel, ...k.berkasModul))) return tolak(`runtime konektor tidak lengkap di ${runtimeTerbundel}`);
    if (!fs.existsSync(python)) return tolak('Python konektor tidak ada di runtime terbundel');
    if (!folderData) return tolak('folder data konektor tidak diketahui');
    // E2: komponen stealth yang SUDAH terpasang (penanda ada) dimuat lewat PYTHONPATH; belum → tanpa (crawler melewati
    // halaman yang memblokir dan mencatatnya).
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
  return { ok: true, command: python, args: ['-m', k.modul], cwd: folder, env: lingkunganServer(), terbundel: false };
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
    const siap = sumber.filter((s) => s.aktif && s.kesehatan === 'siap');
    return {
      akses: k.akses || null,
      sumber: sumber.length,
      siap: siap.length,
      // Tahap D: daftar sumber siap untuk blok prompt (disaring lagi oleh konektorAlat.infoKonektorAman).
      sumberSiap: siap.map((s) => ({ id: s.id, cocok: Array.isArray(s.cocok_untuk) ? s.cocok_untuk : [] })),
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
 * `runtimeTerbundel` & `folderData` (Tahap E): aplikasi terpasang — lihat `peluncuran`.
 * @param {{akarRepo: string, berkasSetelan?: string, runtimeTerbundel?: string|null, folderData?: string|null, versi?: string, log?: (pesan: string) => void}} opsi
 */
function buatPengelolaKonektor({ akarRepo, berkasSetelan = null, runtimeTerbundel = null, folderData = null, versi = '0', log = () => {} }) {
  const sesi = new Map(); // `${ws}::${id}` → { client, transport, pid, alat, stderr, status, sejak, ringkasan }
  let sedangPasangStealth = null; // janji pemasangan stealth yang berjalan — tombol ditekan dua kali tidak memasang dua kali

  const kunci = (ws, id) => `${ws}::${id}`;
  const luncurkan = (id) => peluncuran(akarRepo, id, { runtimeTerbundel, folderData });

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
    const p = luncurkan(id);
    if (!p.ok) return p;
    const k = kunci(ws, id);
    if (sesi.get(k)?.status === 'nyala') return { ok: true, ...ringkas(ws, id) };
    if (p.folderData) {
      // Aplikasi terpasang: folder data baru di %APPDATA% belum berisi folder yang crawler anggap wajib (mis. inbox —
      // tanpa itu sumber inbox "belum siap"). Dibuat sekali; isinya tetap milik Owner.
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

  /**
   * Pasang komponen stealth (Tahap E2). Persetujuan Owner diminta PEMANGGIL (dialog proses utama) sebelum ini.
   * Sesudah berhasil, konektor yang sedang menyala dimulai ulang supaya langsung memuat paketnya.
   * @param {{jalankan?: Function}} [opsi] penjalan proses tiruan untuk uji
   */
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

  return { status, nyalakan, matikan, matikanSemua, panggil, atur, pulihkan, bacaSetelan, pasangStealth };
}

/** `misi_id` dari hasil jalankan_misi (selesai maupun masih berjalan, keduanya memuatnya). */
function misiIdDari(teks) {
  try { const id = JSON.parse(teks)?.misi_id; return typeof id === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(id) ? id : null; }
  catch {
    // Hasil bukan JSON → tidak ada misi yang bisa diizinkan otomatis; status/baca tetap lewat dialog (aman ke arah tanya).
    return null;
  }
}

const LABEL_WS = { 'ws-assistant': 'Assistant', 'ws-engineer': 'Engineer' };

/** Isi dialog persetujuan: apa persisnya yang akan dijalankan, dengan kata-kata Owner, bukan JSON mentah saja. */
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

/**
 * GERBANG PERSETUJUAN (Item 129 Tahap D) — satu-satunya jalan dari layar ke tools/call.
 * K2: setiap alat menunggu persetujuan Owner. K8: SEKALI per misi — `jalankan_misi` memunculkan dialog; sesudah
 * disetujui, `status_misi` & `baca_tangkapan` untuk misi_id itu di workspace itu lewat tanpa dialog. Izin misi hidup
 * selama aplikasi terbuka; workspace lain (K3) dan misi lain tetap ditanyakan.
 * @param {{pengelola: ReturnType<typeof buatPengelolaKonektor>, mintaIzin: (d: {judul: string, rincian: string}) => Promise<boolean>, log?: Function}} opsi
 */
function buatGerbangKonektor({ pengelola, mintaIzin, log = () => {} }) {
  const izinMisi = new Map(); // `${ws}::${id}` → Set<misi_id>

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
    // jalankan_misi menunggu ≤ 110 s di sisi crawler; batas panggilan diberi kelonggaran di atasnya.
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
};
