/**
 * KOMPONEN STEALTH CRAWLER (Item 129 Tahap E2, 2026-10-26) — dipasang atas izin Owner, bukan dibundel.
 *
 * K14 (keputusan Owner): pemasang TIDAK membawa komponen tingkat stealth. Tanpanya crawler tetap jalan; halaman yang
 * memblokir dilewati & dicatat (crawler/kanal/web.py `_stealth`). Modul ini memasangnya bila Owner menekan tombolnya:
 *
 *   1. `python -m pip install --target <stealth>\paket-<waktu> --no-deps <patchright==versi>` — hanya Patchright:
 *      Scrapling 0.5 (StealthyFetcher) memakai Patchright saja; Playwright tidak diimpor (diperiksa 26 Okt).
 *      `--no-deps`: greenlet & pyee sudah ada di runtime terbundel. Versi dikunci dari `.venv` pengembangan
 *      (`stealth.json`, ditulis scripts/siapkan-crawler.mjs).
 *   2. `python -m patchright install chromium` — browser ke %LOCALAPPDATA%\ms-playwright (lokasi bawaan; bila sudah
 *      ada di laptop itu, tidak diunduh ulang).
 *   3. UJI: `from scrapling.fetchers import StealthyFetcher` dengan paket baru di PYTHONPATH.
 *   Ketiganya berhasil → folder sementara diganti nama menjadi `paket` (kunci sesaat Windows diulang, lihat
 *   pindahkanFolder) dan penanda `terpasang.json` ditulis. Gagal di langkah mana pun, termasuk pemindahan itu →
 *   folder sementara dihapus, penanda tidak ditulis, alasan dikembalikan apa adanya.
 *
 * Murni (tanpa `electron`); penjalan proses bisa diganti tiruan — lihat `uji/uji-konektor-stealth.mjs`.
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

const BATAS_MS = Object.freeze({ pip: 10 * 60 * 1000, browser: 30 * 60 * 1000, uji: 2 * 60 * 1000 });

function lokasiStealth(folderData) {
  const akar = path.join(folderData, 'stealth');
  return { akar, paket: path.join(akar, 'paket'), penanda: path.join(akar, 'terpasang.json') };
}

/** Spesifikasi komponen dari runtime terbundel — `{ paket: 'patchright==1.64.1', browser: 'chromium' }`. */
function spesifikasiStealth(runtime) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(runtime, 'stealth.json'), 'utf8'));
    if (/^patchright==\d+\.\d+\.\d+$/.test(s?.paket) && s?.browser === 'chromium') return s;
  } catch {
    // Runtime lama (dibangun sebelum E2) atau berkas rusak → tidak ada versi terkunci; pemasangan ditolak di bawah.
  }
  return null;
}

/**
 * Keadaan komponen stealth: `pengembangan` (npm run desktop — sudah ada di .venv), `terpasang`, atau `belum`.
 * @param {{terbundel: boolean, folderData?: string|null}} p
 */
function statusStealth({ terbundel, folderData }) {
  if (!terbundel) return { keadaan: 'pengembangan' };
  if (!folderData) return { keadaan: 'belum' };
  const l = lokasiStealth(folderData);
  try {
    const p = JSON.parse(fs.readFileSync(l.penanda, 'utf8'));
    if (fs.existsSync(path.join(l.paket, 'patchright'))) return { keadaan: 'terpasang', paket: p.paket, waktu: p.waktu, folderPaket: l.paket };
  } catch {
    // Penanda belum ada (belum pernah dipasang) atau rusak → dianggap belum; tombol pasang tetap tersedia.
  }
  return { keadaan: 'belum' };
}

function matikanPohon(pid) {
  if (!pid) return;
  const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
  try { execFile(taskkill, ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {}); } catch { /* proses sudah selesai */ }
}

/** Jalankan tanpa shell; kumpulkan ekor keluaran; matikan pohon proses bila lewat batas waktu. */
function jalankanProses(program, argumen, { cwd, env, batasMs }) {
  return new Promise((selesai) => {
    let keluaran = '';
    let habis = false;
    const p = spawn(program, argumen, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const ekor = (b) => { keluaran = (keluaran + b.toString('utf8')).slice(-8000); };
    p.stdout.on('data', ekor);
    p.stderr.on('data', ekor);
    const t = setTimeout(() => { habis = true; matikanPohon(p.pid); }, batasMs);
    p.on('error', (e) => { clearTimeout(t); selesai({ kode: -1, keluaran: `${keluaran}\n${e.message}`, habis }); });
    p.on('close', (kode) => { clearTimeout(t); selesai({ kode, keluaran, habis }); });
  });
}

// Kunci SESAAT Windows: antivirus/pengindeks masih memegang berkas yang baru dibuat sesaat sesudah proses terakhir
// selesai, sehingga rename folder ditolak (terukur 28 Okt di uji bagian 5: EPERM 2 dari 6 jalan; beberapa detik
// kemudian rename yang sama berhasil). pip mengulang os.replace di Windows untuk sebab yang sama.
const KUNCI_SESAAT = new Set(['EPERM', 'EACCES', 'EBUSY']);

/** Ganti `tujuan` dengan `asal`; kunci sesaat diulang sampai `batasMs`. Mengembalikan kode galat, atau null bila berhasil. */
async function pindahkanFolder(asal, tujuan, { batasMs = 10000, jedaMs = 250 } = {}) {
  const mulai = Date.now();
  for (;;) {
    try {
      fs.rmSync(tujuan, { recursive: true, force: true });
      fs.renameSync(asal, tujuan);
      return null;
    } catch (e) {
      // Tidak ditelan: kodenya dikembalikan, dan pasangStealth melaporkannya sebagai alasan langkah "pindah".
      if (!KUNCI_SESAAT.has(e.code) || Date.now() - mulai >= batasMs) return e.code || e.message;
      await new Promise((r) => setTimeout(r, jedaMs));
    }
  }
}

/**
 * Pasang komponen stealth. Persetujuan Owner sudah diminta pemanggil (dialog di proses utama).
 * @param {{runtime: string, folderData: string, env: Record<string,string>, jalankan?: Function, log?: Function, sekarang?: () => number}} p
 */
async function pasangStealth({ runtime, folderData, env, jalankan = jalankanProses, log = () => {}, sekarang = Date.now }) {
  const spek = spesifikasiStealth(runtime);
  if (!spek) return { ok: false, langkah: 'persiapan', alasan: 'runtime terbundel tidak memuat stealth.json — bangun ulang pemasang (npm run crawler:siapkan)' };
  const python = path.join(runtime, 'python', 'python.exe');
  if (!fs.existsSync(python)) return { ok: false, langkah: 'persiapan', alasan: 'Python runtime terbundel tidak ada' };

  const l = lokasiStealth(folderData);
  const sementara = path.join(l.akar, `paket-${sekarang()}`);
  fs.mkdirSync(sementara, { recursive: true });
  const envPaket = { ...env, PYTHONPATH: sementara, PYTHONDONTWRITEBYTECODE: '1', PYTHONUTF8: '1' };
  const langkah = [
    ['pip', [python, ['-m', 'pip', 'install', '--target', sementara, '--no-deps', '--disable-pip-version-check',
      '--no-warn-script-location', '--no-input', spek.paket], { cwd: runtime, env: envPaket, batasMs: BATAS_MS.pip }]],
    ['browser', [python, ['-m', 'patchright', 'install', spek.browser], { cwd: runtime, env: envPaket, batasMs: BATAS_MS.browser }]],
    ['uji', [python, ['-c', 'from scrapling.fetchers import StealthyFetcher; print("STEALTH-SIAP")'], { cwd: runtime, env: envPaket, batasMs: BATAS_MS.uji }]],
  ];
  for (const [nama, [program, argumen, opsi]] of langkah) {
    log(`[STEALTH] langkah ${nama}…`);
    const h = await jalankan(program, argumen, opsi);
    const lulus = h.kode === 0 && !h.habis && (nama !== 'uji' || /STEALTH-SIAP/.test(h.keluaran || ''));
    if (!lulus) {
      fs.rmSync(sementara, { recursive: true, force: true });
      const alasan = h.habis ? `melewati batas waktu ${Math.round(opsi.batasMs / 60000)} menit` : `kode keluar ${h.kode}`;
      log(`[STEALTH] GAGAL di langkah ${nama}: ${alasan}`);
      return { ok: false, langkah: nama, alasan, keluaran: String(h.keluaran || '').slice(-1500) };
    }
  }
  const galatPindah = await pindahkanFolder(sementara, l.paket);
  if (galatPindah) {
    fs.rmSync(sementara, { recursive: true, force: true, maxRetries: 3 });
    log(`[STEALTH] GAGAL memindah folder paket: ${galatPindah}`);
    return { ok: false, langkah: 'pindah', alasan: `folder paket tidak bisa dipindah (${galatPindah})` };
  }
  const penanda = { paket: spek.paket, browser: spek.browser, waktu: new Date(sekarang()).toISOString() };
  fs.writeFileSync(l.penanda, JSON.stringify(penanda, null, 2), 'utf8');
  log(`[STEALTH] terpasang: ${spek.paket} + ${spek.browser}`);
  return { ok: true, ...penanda };
}

module.exports = { pasangStealth, statusStealth, spesifikasiStealth, lokasiStealth, jalankanProses, pindahkanFolder, BATAS_MS };
