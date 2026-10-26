/**
 * YANG TERPASANG DI PERANGKAT INI (Item 129 Tahap E3, 2026-10-26) — Settings › Konektor ⑦, susunan disetujui Owner.
 *
 * Keputusan Owner: crawler tetap SATU BUNDEL di pemasang (bukan diunduh dari repo ecosystem-crawler), stealth tetap
 * dipasang saat dibutuhkan (K14), dan semua yang terpasang harus TRANSPARAN. Modul ini menyusun daftarnya:
 *
 *   bawaan   runtime terbundel — isi dari `komponen.json` yang DITULIS OTOMATIS saat build (scripts/siapkan-crawler.mjs,
 *            dari isi bundel itu sendiri: Python, crawler, setiap paket + versi + lisensi); ukuran diukur di sini.
 *   data     %APPDATA%\Mamet AI\crawler — hasil, .env, inbox (tanpa subfolder stealth: dihitung di baris stealth).
 *   stealth  paket Patchright (penanda `terpasang.json`) + browser yang dipasang `patchright install chromium`; revisi
 *            dibaca dari `browsers.json` milik Patchright itu, bukan ditebak. Ukuran = folder yang benar-benar ada.
 *
 * `lokasiFolder` hanya mengembalikan folder dari daftar ini yang ada — tombol "Buka folder" tidak bisa membuka alamat
 * lain (layar mengirim KUNCI, bukan alamat).
 */

const fs = require('fs');
const path = require('path');
const stealth = require('./stealthKonektor.cjs');

// Ruang disk komponen stealth, diukur di laptop Owner 26 Okt: Patchright 109 MB + Chromium 437 + headless shell 278
// + ffmpeg 4 + winldd 0,3. Hanya untuk keadaan "belum" — sesudah terpasang yang tampil ukuran sebenarnya.
const PERKIRAAN_STEALTH_MB = 830;
// Yang dipasang `patchright install chromium` di Windows (nama di browsers.json → folder `<nama_>-<revisi>`).
const BROWSER_STEALTH = Object.freeze(['chromium', 'chromium-headless-shell', 'ffmpeg', 'winldd']);
const KUNCI_FOLDER = Object.freeze(['bawaan', 'data', 'stealth', 'browser']);

async function ukuranMB(dir, { kecuali = [] } = {}) {
  let isi;
  try {
    isi = await fs.promises.readdir(dir, { withFileTypes: true, recursive: true });
  } catch {
    return null; // folder belum ada — layar menampilkan tanpa ukuran, bukan 0 MB yang menyesatkan
  }
  let n = 0;
  for (const e of isi) {
    if (!e.isFile()) continue;
    const p = path.join(e.parentPath ?? e.path, e.name);
    if (kecuali.some((k) => p === k || p.startsWith(k + path.sep))) continue;
    try { n += (await fs.promises.stat(p)).size; } catch { /* berkas hilang di tengah hitungan — dilewati */ }
  }
  return Math.round(n / 1024 / 1024);
}

/** Folder induk browser Playwright/Patchright — sama dengan yang dipakai `patchright install`. */
function akarBrowser(env = process.env) {
  if (env.PLAYWRIGHT_BROWSERS_PATH) return env.PLAYWRIGHT_BROWSERS_PATH;
  return env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'ms-playwright') : null;
}

/** Browser milik Patchright yang terpasang: [{ nama, revisi, versi, folder, ada }] dari browsers.json paketnya. */
function browserStealth(folderPaket, env = process.env) {
  const akar = akarBrowser(env);
  let daftar;
  try {
    daftar = JSON.parse(fs.readFileSync(path.join(folderPaket, 'patchright', 'driver', 'package', 'browsers.json'), 'utf8')).browsers;
  } catch {
    return []; // paket tanpa browsers.json (bukan Patchright yang dikenal) — tidak menebak folder browser
  }
  return BROWSER_STEALTH.map((nama) => daftar.find((b) => b.name === nama)).filter(Boolean).map((b) => {
    const folder = akar ? path.join(akar, `${b.name.replace(/-/g, '_')}-${b.revision}`) : null;
    return { nama: b.name, revisi: b.revision, versi: b.browserVersion || null, folder, ada: !!folder && fs.existsSync(folder) };
  });
}

function bacaManifest(runtime) {
  try {
    return JSON.parse(fs.readFileSync(path.join(runtime, 'komponen.json'), 'utf8'));
  } catch {
    return null; // runtime dibangun sebelum E3 — layar menyebut daftar tidak tersedia, bukan mengarang isinya
  }
}

/**
 * Daftar yang terpasang. Aplikasi terpasang → bawaan/data/stealth; `npm run desktop` → mode pengembangan.
 * @param {{runtimeTerbundel?: string|null, folderData?: string|null, folderRepo?: string|null, env?: object}} p
 */
async function bacaKomponen({ runtimeTerbundel = null, folderData = null, folderRepo = null, env = process.env }) {
  if (!runtimeTerbundel) {
    return { mode: 'pengembangan', bawaan: { lokasi: folderRepo ? path.join(folderRepo, '.venv') : null }, data: { lokasi: folderRepo, mb: null }, stealth: null };
  }
  const manifest = bacaManifest(runtimeTerbundel);
  const st = stealth.statusStealth({ terbundel: true, folderData });
  const l = folderData ? stealth.lokasiStealth(folderData) : null;
  const browser = st.keadaan === 'terpasang' ? browserStealth(st.folderPaket, env) : [];
  const [mbBawaan, mbData, mbPaket, ...mbBrowser] = await Promise.all([
    ukuranMB(runtimeTerbundel),
    folderData ? ukuranMB(folderData, { kecuali: [l.akar] }) : null,
    st.keadaan === 'terpasang' ? ukuranMB(st.folderPaket) : null,
    ...browser.map((b) => (b.ada ? ukuranMB(b.folder) : null)),
  ]);
  return {
    mode: 'terbundel',
    bawaan: {
      lokasi: runtimeTerbundel, mb: mbBawaan,
      python: manifest?.python || null, crawler: manifest?.crawler || null, paket: manifest?.paket || null,
    },
    data: { lokasi: folderData, mb: mbData },
    stealth: st.keadaan === 'terpasang'
      ? {
        keadaan: 'terpasang', paket: st.paket, waktu: st.waktu, lokasiPaket: l.akar, akarBrowser: akarBrowser(env),
        browser: browser.map((b, i) => ({ nama: b.nama, revisi: b.revisi, versi: b.versi, ada: b.ada, mb: mbBrowser[i] })),
        mb: [mbPaket, ...mbBrowser].reduce((a, b) => a + (b || 0), 0),
      }
      : { keadaan: st.keadaan, perkiraanMB: PERKIRAAN_STEALTH_MB, lokasiPaket: l?.akar || null, akarBrowser: akarBrowser(env) },
  };
}

/** Alamat folder untuk tombol "Buka folder" — hanya kunci yang dikenal, hanya folder yang ada. */
function lokasiFolder(kunci, { runtimeTerbundel = null, folderData = null, folderRepo = null, env = process.env }) {
  if (!KUNCI_FOLDER.includes(kunci)) return null;
  const alamat = {
    bawaan: runtimeTerbundel || (folderRepo ? path.join(folderRepo, '.venv') : null),
    data: runtimeTerbundel ? folderData : folderRepo,
    stealth: runtimeTerbundel && folderData ? stealth.lokasiStealth(folderData).akar : null,
    browser: runtimeTerbundel ? akarBrowser(env) : null,
  }[kunci];
  return alamat && fs.existsSync(alamat) ? alamat : null;
}

module.exports = { bacaKomponen, lokasiFolder, browserStealth, akarBrowser, ukuranMB, PERKIRAAN_STEALTH_MB, BROWSER_STEALTH, KUNCI_FOLDER };
