const { app, BrowserWindow, ipcMain, dialog, net, protocol, session, shell, safeStorage } = require('electron');
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-sandbox');

const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const os = require('os');

process.on('uncaughtException', (err) => {
  try {
    fs.writeFileSync(path.join(os.tmpdir(), 'mamet-ai-crash-error.log'), `Uncaught Exception:\n${err.stack}\n`);
  } catch (e) {}
});

process.on('unhandledRejection', (reason, promise) => {
  try {
    fs.writeFileSync(path.join(os.tmpdir(), 'mamet-ai-crash-promise.log'), `Unhandled Rejection at: ${promise}\nReason: ${reason}\n`);
  } catch (e) {}
});

protocol.registerSchemesAsPrivileged([
  { scheme: 'mamet', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

const isDev = process.env.NODE_ENV === 'development';
let mainWindow;

function setupAutoUpdater() {
  if (isDev) return;

  try {
    const { autoUpdater } = require('electron-updater');

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      console.log('[Auto-Updater] Memeriksa pembaruan...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[Auto-Updater] Pembaruan tersedia:', info.version);
      if (mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          buttons: ['OK', 'Nanti Saja'],
          defaultId: 0,
          title: 'Update Tersedia',
          message: `Versi ${info.version} tersedia.\n\nMamet AI akan mengunduhnya di latar belakang.`
        }).catch(() => {});
        mainWindow.webContents.send('update-status', {
          status: 'available',
          version: info.version,
          message: `Versi baru ${info.version} tersedia. Mengunduh...`
        });
      }
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[Auto-Updater] Aplikasi sudah versi terbaru.');
      if (mainWindow) {
        mainWindow.webContents.send('update-status', {
          status: 'not-available',
          message: 'Aplikasi Anda sudah di versi terbaru.'
        });
      }
    });

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.round(progress.percent);
      console.log(`[Auto-Updater] Mengunduh: ${percent}%`);
      if (mainWindow) {
        mainWindow.webContents.send('update-status', {
          status: 'downloading',
          percent: percent,
          message: `Mengunduh pembaruan... ${percent}%`
        });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[Auto-Updater] Pembaruan selesai diunduh:', info.version);
      if (mainWindow) {
        mainWindow.webContents.send('update-status', {
          status: 'downloaded',
          version: info.version,
          message: `Versi ${info.version} siap dipasang. Mulai ulang aplikasi untuk menerapkannya.`
        });
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          buttons: ['Restart Sekarang', 'Nanti Saja'],
          defaultId: 0,
          title: 'Pembaruan Mamet AI',
          message: `Versi ${info.version} telah berhasil diunduh.\n\nAplikasi akan dimulai ulang untuk menerapkan pembaruan.`
        }).then((result) => {
          if (result.response === 0) {
            autoUpdater.quitAndInstall(false, true);
          }
        }).catch(() => {});
      }
    });

    autoUpdater.on('error', (err) => {
      console.error('[Auto-Updater] Error:', err.message);
      if (mainWindow) {
        mainWindow.webContents.send('update-status', {
          status: 'error',
          message: `Gagal memeriksa/mengunduh pembaruan: ${err.message}`
        });
      }
    });

    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error('[Auto-Updater] Gagal memeriksa pembaruan:', err.message);
      });
    }, 5000);

    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 4 * 60 * 60 * 1000);

  } catch (err) {
    console.error('[Auto-Updater] Modul tidak tersedia:', err.message);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Mamet AI - Desktop Edition',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: false,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  const catat = (baris) => {
    try {
      console.error(baris);
      fs.appendFileSync(path.join(os.tmpdir(), 'mamet-renderer.log'), baris.endsWith('\n') ? baris : `${baris}\n`);
    } catch (_) {  }
  };

  const ALAMAT_AWAL = isDev ? 'http://localhost:5173' : 'mamet://app/index.html';
  const BATAS_MUAT_ULANG = 3;
  let percobaanMuat = 0;
  let sedangPulih = false;

  const coba = (sebab) => {
    if (sedangPulih) return;
    if (percobaanMuat >= BATAS_MUAT_ULANG) {
      catat(`[FATAL] ${sebab} — sudah ${percobaanMuat}x dicoba, berhenti. Jendela akan tetap kosong; lihat baris di atas untuk sebabnya.`);
      return;
    }
    percobaanMuat += 1;
    sedangPulih = true;
    catat(`[PULIH] ${sebab} — memuat ulang (percobaan ${percobaanMuat}/${BATAS_MUAT_ULANG})`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(ALAMAT_AWAL).catch((err) => catat(`[FATAL] muat ulang gagal: ${err.message}`));
      }
    }, 400);
  };

  mainWindow.webContents.on('render-process-gone', (_e, rincian) => {
    const kode = rincian?.exitCode ?? 0;
    const hex = (kode >>> 0).toString(16).toUpperCase();
    catat(`[RENDERER MATI] alasan=${rincian?.reason} exitCode=${kode} (0x${hex})`);
    if (rincian?.reason !== 'clean-exit') coba(`renderer mati (${rincian?.reason})`);
  });

  mainWindow.webContents.on('did-finish-load', () => { sedangPulih = false; });

  mainWindow.webContents.on('did-fail-load', (_e, kode, uraian, alamat, bingkaiUtama) => {
    if (!bingkaiUtama) return;
    if (kode === -3) return;
    catat(`[MUAT GAGAL] ${kode} ${uraian} ${String(alamat).slice(0, 120)}`);
    coba(`muat gagal (${uraian})`);
  });

  mainWindow.loadURL(ALAMAT_AWAL).catch(err => {
    catat(`[FATAL] loadURL ${isDev ? 'dev' : 'mamet://'} gagal: ${err.message}`);
  });

  const asalSendiri = (u) => {
    try {
      const { protocol: p, host } = new URL(u);
      return p === 'mamet:' || (p === 'http:' && host === 'localhost:5173') || p === 'devtools:';
    } catch { return false; }
  };

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:$/.test((() => { try { return new URL(url).protocol; } catch { return ''; } })())) {
      shell.openExternal(url).catch(() => {  });
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (asalSendiri(url)) return;
    e.preventDefault();
    console.warn(`[Keamanan] navigasi ke luar dicegah: ${String(url).slice(0, 120)}`);
    if (/^https?:/.test(url)) shell.openExternal(url).catch(() => {});
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR'];
    const logLine = `[Renderer ${levels[level] || 'LOG'}]: ${message} (at ${sourceId}:${line})\n`;
    console.log(logLine);
    fs.appendFileSync(path.join(os.tmpdir(), 'mamet-renderer.log'), logLine);
  });
}

app.commandLine.appendSwitch('allow-file-access-from-files');

app.whenReady().then(() => {
  protocol.handle('mamet', async (request) => {
    try {
      const cleanUrl = request.url.split('?')[0].split('#')[0];
      const urlPath = cleanUrl.replace('mamet://app/', '');
      const relativePath = urlPath === '' || urlPath === 'index.html' ? 'index.html' : urlPath;
      const filePath = path.normalize(path.join(__dirname, '../dist', relativePath));

      if (!fs.existsSync(filePath)) {
        return new Response('File Not Found', { status: 404 });
      }

      const data = fs.readFileSync(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.json': 'application/json',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf'
      };
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = mimeTypes[ext] || 'application/octet-stream';

      return new Response(data, {
        headers: { 'Content-Type': mimeType }
      });
    } catch (err) {
      return new Response(`Protocol Error: ${err.message}`, { status: 500 });
    }
  });

  if (session && session.defaultSession) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = { ...details.responseHeaders };
      for (const key of Object.keys(responseHeaders)) {
        if (key.toLowerCase() === 'content-security-policy') {
          responseHeaders[key] = responseHeaders[key].map(header => {
            if (header.includes('connect-src')) {
              return header.replace(
                'connect-src',
                "connect-src https://news.google.com https://*.google.com https://id.wikipedia.org https://*.wikipedia.org https://html.duckduckgo.com https://lite.duckduckgo.com https://duckduckgo.com https://*.duckduckgo.com"
              );
            }
            return header;
          });
        }
      }
      callback({ responseHeaders });
    });
  }

  createWindow();
  setupAutoUpdater();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});


const { ambilWeb } = require('./ambilWeb.cjs');
ipcMain.handle('net:fetchWeb', (event, permintaan) => ambilWeb(net.fetch, permintaan));

let wordToPdfSedangBerjalan = false;

function pathTanpaBentrok(dir, namaDasar, ekstensi) {
  let kandidat = path.join(dir, `${namaDasar}${ekstensi}`);
  let n = 2;
  while (fs.existsSync(kandidat)) {
    kandidat = path.join(dir, `${namaDasar} (${n})${ekstensi}`);
    n++;
  }
  return kandidat;
}

ipcMain.handle('doc:word-to-pdf', async (event, { filePath }) => {
  if (process.platform !== 'win32') {
    return { ok: false, stage: 'platform', error: 'Konversi Word ke PDF hanya tersedia di Windows.' };
  }
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    return { ok: false, stage: 'input', error: 'Path berkas tidak valid.' };
  }
  const ext = path.extname(filePath).toLowerCase();
  if (!['.doc', '.docx'].includes(ext)) {
    return { ok: false, stage: 'input', error: `Hanya berkas .doc atau .docx yang bisa dikonversi, bukan "${ext || 'tanpa ekstensi'}".` };
  }
  if (!fs.existsSync(filePath)) {
    return { ok: false, stage: 'input', error: `Berkas tidak ditemukan: ${filePath}` };
  }
  if (wordToPdfSedangBerjalan) {
    return { ok: false, stage: 'sibuk', error: 'Masih ada konversi lain yang berjalan. Tunggu sampai selesai.' };
  }

  const outputPath = pathTanpaBentrok(path.dirname(filePath), path.basename(filePath, ext), '.pdf');

  const scriptPath = path.join(__dirname, 'scripts', 'word_to_pdf.ps1').replace('app.asar', 'app.asar.unpacked');
  const ps32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'SysWOW64', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const powershell = fs.existsSync(ps32) ? ps32 : 'powershell.exe';

  wordToPdfSedangBerjalan = true;
  const { spawn } = require('child_process');

  try {
    return await new Promise((resolve) => {
      const child = spawn(powershell, [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-InputPath', filePath,
        '-OutputPath', outputPath
      ], { windowsHide: true });

      let stdout = '';
      let stderr = '';
      let wordPid = null;

      child.stdout.on('data', (d) => {
        stdout += d.toString('utf8');
        const m = stdout.match(/PID:(\d+)/);
        if (m) wordPid = Number(m[1]);
      });
      child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

      const batas = setTimeout(() => {
        try { child.kill(); } catch (_) {}
        if (wordPid) { try { process.kill(wordPid); } catch (_) {} }
        resolve({ ok: false, stage: 'timeout', error: 'Konversi melebihi 11 menit dan dihentikan.', output: outputPath });
      }, 11 * 60 * 1000);

      child.on('close', (code) => {
        clearTimeout(batas);
        const barisJson = stdout.trim().split(/\r?\n/).reverse().find(l => l.trim().startsWith('{'));
        if (!barisJson) {
          resolve({ ok: false, stage: 'skrip', error: (stderr || stdout || `PowerShell keluar dengan kode ${code} tanpa hasil.`).trim().slice(0, 800) });
          return;
        }
        try {
          resolve(JSON.parse(barisJson));
        } catch (e) {
          resolve({ ok: false, stage: 'skrip', error: `Hasil skrip tidak terbaca: ${e.message}` });
        }
      });

      child.on('error', (err) => {
        clearTimeout(batas);
        resolve({ ok: false, stage: 'skrip', error: `Gagal menjalankan PowerShell: ${err.message}` });
      });
    });
  } finally {
    wordToPdfSedangBerjalan = false;
  }
});

const TEMP_KONVERSI = path.join(os.tmpdir(), 'mamet-konversi');
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function folderJob(jobId) {
  if (typeof jobId !== 'string' || !POLA_UUID.test(jobId)) throw new Error('jobId tidak valid.');
  return path.join(TEMP_KONVERSI, jobId);
}

function didalamTempKonversi(p) {
  const rel = path.relative(TEMP_KONVERSI, path.resolve(p));
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

ipcMain.handle('doc:temp-save', async (event, { jobId, fileName, bytes }) => {
  try {
    const dir = folderJob(jobId);
    const ext = path.extname(String(fileName || '')).toLowerCase();
    if (!['.doc', '.docx'].includes(ext)) return { ok: false, error: `Hanya .doc/.docx, bukan "${ext || 'tanpa ekstensi'}".` };
    const aman = path.basename(String(fileName)).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 150);
    fs.mkdirSync(dir, { recursive: true });
    const tujuan = path.join(dir, aman);
    fs.writeFileSync(tujuan, Buffer.from(bytes));
    return { ok: true, filePath: tujuan };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('doc:temp-read', async (event, { filePath }) => {
  try {
    if (typeof filePath !== 'string' || !didalamTempKonversi(filePath) || path.extname(filePath).toLowerCase() !== '.pdf') {
      return { ok: false, error: 'Hanya PDF hasil konversi di folder sementara yang boleh dibaca.' };
    }
    return { ok: true, bytes: fs.readFileSync(filePath) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('doc:temp-cleanup', async (event, { jobId }) => {
  try {
    fs.rmSync(folderJob(jobId), { recursive: true, force: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('doc:open-result', async (event, { filePath, mode }) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    return { ok: false, error: 'Path berkas tidak valid.' };
  }
  if (path.extname(filePath).toLowerCase() !== '.pdf') {
    return { ok: false, error: 'Hanya berkas PDF yang bisa dibuka dari sini.' };
  }
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `Berkas sudah tidak ada di lokasi itu (mungkin dipindah atau dihapus): ${filePath}` };
  }
  if (mode === 'folder') {
    shell.showItemInFolder(filePath);
    return { ok: true };
  }
  const galat = await shell.openPath(filePath);
  return galat ? { ok: false, error: galat } : { ok: true };
});

const { runAirdropTask } = require('./airdropEngine.cjs');

const { akarRepoSah, akarRepoAktif } = require('./akarRepo.cjs');
const AKAR_DEV = path.resolve(__dirname, '..', '..');
let repoPilihanOwner = null;

const infoAkarRepo = () => akarRepoAktif({ dev: isDev, akarDev: AKAR_DEV, tersimpan: repoPilihanOwner });
const akarRepo = () => infoAkarRepo().akar;

const berkasAkarRepo = () => path.join(app.getPath('userData'), 'repo-engineer.json');
const folderInstalasi = () => {
  try { return path.dirname(app.getPath('exe')); } catch { return ''; }
};
function simpanAkarRepo() {
  try { fs.writeFileSync(berkasAkarRepo(), JSON.stringify({ akar: repoPilihanOwner }), 'utf8'); }
  catch (e) { console.warn('[REPO] Gagal menyimpan akar repo:', e.message); }
}
function pulihkanAkarRepo() {
  try {
    const { akar } = JSON.parse(fs.readFileSync(berkasAkarRepo(), 'utf8'));
    if (!akar) return;
    const sah = akarRepoSah(akar, { folderInstalasi: folderInstalasi() });
    if (sah.ok) { repoPilihanOwner = sah.akar; console.log(`[REPO] Akar repo dipulihkan: "${sah.nama}"`); }
    else console.warn(`[REPO] Akar repo tersimpan tidak dipakai: ${sah.alasan}`);
  } catch {  }
}
app.whenReady().then(pulihkanAkarRepo);

function alamatRepoRelatif(relatif) {
  const akar = akarRepo();
  if (!akar) throw new Error(infoAkarRepo().alasan);
  return path.resolve(akar, relatif);
}

function butuhAkarRepo() {
  const info = infoAkarRepo();
  return info.akar ? null : { success: false, error: info.alasan, galat: info.alasan, akarBelumDipilih: true };
}

ipcMain.handle('run-airdrop-stealth', async (event, { taskName, params }) => {
  try {
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Batal', 'Jalankan Airdrop'],
      defaultId: 1,
      title: 'Konfirmasi Airdrop Farmer',
      message: `Mamet AI meminta izin untuk membuka Stealth Browser untuk task: ${taskName}\n\nLanjutkan?`
    });

    if (response.response === 1) {
      return await runAirdropTask(taskName, params);
    } else {
      return { success: false, message: 'Dibatalkan oleh pengguna.' };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
});


const { alamatDalamPagar: pagarRepo } = require('./pagarFolder.cjs');
const BATAS_CHECKPOINT = { berkas: 10, byte: 5 * 1024 * 1024 };
const folderCheckpoint = () => path.join(app.getPath('userData'), 'eng-checkpoint');
const labelAman = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);

ipcMain.handle('eng:git-checkpoint', async (_event, { taskId, files } = {}) => {
  const belum = butuhAkarRepo();
  if (belum) return belum;
  try {
    const label = labelAman(`ENG-CHECKPOINT-${taskId || Date.now()}`);
    const daftar = Array.isArray(files) ? files.filter((f) => typeof f === 'string' && f.trim()) : [];
    if (!daftar.length) return { success: false, error: 'tidak ada berkas untuk di-checkpoint' };
    if (daftar.length > BATAS_CHECKPOINT.berkas) return { success: false, error: `lebih dari ${BATAS_CHECKPOINT.berkas} berkas` };
    const berkas = [];
    for (const rel of daftar) {
      const p = pagarRepo(akarRepo(), rel);
      if (!p.ok) return { success: false, error: `"${rel}": ${p.alasan}` };
      let st = null;
      try { st = fs.statSync(p.alamat); } catch {  }
      if (st && !st.isFile()) return { success: false, error: `"${rel}" bukan berkas` };
      if (st && st.size > BATAS_CHECKPOINT.byte) return { success: false, error: `"${rel}" lebih dari 5 MB` };
      berkas.push({ alamat: p.relatif, ada: !!st, isi: st ? fs.readFileSync(p.alamat).toString('base64') : null });
    }
    fs.mkdirSync(folderCheckpoint(), { recursive: true });
    fs.writeFileSync(path.join(folderCheckpoint(), `${label}.json`), JSON.stringify({ label, dibuat: new Date().toISOString(), berkas }), 'utf8');
    console.log(`[ENG-CHECKPOINT] ✅ ${label}: ${berkas.map((b) => b.alamat).join(', ')}`);
    return { success: true, ref: label, files: berkas.map((b) => b.alamat) };
  } catch (err) {
    console.log(`[ENG-CHECKPOINT] ❌ ${err.message}`);
    return { success: false, error: err.message };
  }
});

function labelCheckpointTerbaru() {
  const semua = fs.existsSync(folderCheckpoint()) ? fs.readdirSync(folderCheckpoint()).filter((n) => n.endsWith('.json')) : [];
  semua.sort((a, b) => fs.statSync(path.join(folderCheckpoint(), b)).mtimeMs - fs.statSync(path.join(folderCheckpoint(), a)).mtimeMs);
  return semua.length ? semua[0].replace(/\.json$/, '') : '';
}

async function pulihkanDariCheckpoint(label) {
  const berkasCp = label ? path.join(folderCheckpoint(), `${label}.json`) : '';
  if (!berkasCp || !fs.existsSync(berkasCp)) return { success: false, error: 'Checkpoint tidak ditemukan. Rollback tidak bisa dilakukan.' };
  const cp = JSON.parse(fs.readFileSync(berkasCp, 'utf8'));
  const hasil = [];
  for (const b of cp.berkas || []) {
    const p = pagarRepo(akarRepo(), b.alamat);
    if (!p.ok) { hasil.push(`❌ ${b.alamat}: ${p.alasan}`); continue; }
    if (b.ada) {
      const sementara = `${p.alamat}.mamet-rollback-${process.pid}.tmp`;
      fs.writeFileSync(sementara, Buffer.from(b.isi, 'base64'));
      fs.renameSync(sementara, p.alamat);
      hasil.push(`✅ ${b.alamat} dikembalikan`);
    } else if (fs.existsSync(p.alamat)) {
      await shell.trashItem(p.alamat);
      hasil.push(`✅ ${b.alamat} (berkas baru) dipindah ke Recycle Bin`);
    } else {
      hasil.push(`• ${b.alamat} sudah tidak ada`);
    }
  }
  fs.unlinkSync(berkasCp);
  const gagal = hasil.some((h) => h.startsWith('❌'));
  console.log(`[ENG-ROLLBACK] ${gagal ? '⚠️' : '✅'} ${label}: ${hasil.join(' | ')}`);
  return { success: !gagal, output: hasil.join('\n'), error: gagal ? hasil.filter((h) => h.startsWith('❌')).join('\n') : undefined };
}

function isiCheckpoint(label) {
  const berkasCp = label ? path.join(folderCheckpoint(), `${label}.json`) : '';
  if (!berkasCp || !fs.existsSync(berkasCp)) return null;
  try { return JSON.parse(fs.readFileSync(berkasCp, 'utf8')); } catch { return null; }
}

ipcMain.handle('eng:git-rollback', async (_event, { checkpointLabel } = {}) => {
  const belum = butuhAkarRepo();
  if (belum) return belum;
  try {
    const label = labelAman(checkpointLabel) || labelCheckpointTerbaru();
    const cp = isiCheckpoint(label);
    if (!cp) return { success: false, error: 'Checkpoint tidak ditemukan. Rollback tidak bisa dilakukan.' };
    const daftar = (cp.berkas || []).map((b) => `• ${b.alamat}${b.ada ? '' : ' (berkas baru — dipindah ke Recycle Bin)'}`).join('\n');

    const confirm = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Batal', '↩️ Rollback Sekarang'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: 'Konfirmasi Rollback',
      message: 'Kembalikan berkas ke isi sebelum patch?',
      detail: `Checkpoint: ${label}\n\n${daftar}\n\nHanya berkas di atas yang dikembalikan; perubahan lain di repo tidak disentuh.`,
    });
    if (confirm.response !== 1) return { success: false, cancelled: true, message: 'Rollback dibatalkan.' };

    return await pulihkanDariCheckpoint(label);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

const { akarFolderSah } = require('./pagarFolder.cjs');
const { jalankanAlat } = require('./alatFolder.cjs');
let folderKerjaAkar = null;

const berkasFolderKerja = () => path.join(app.getPath('userData'), 'folder-kerja.json');
function simpanFolderKerja() {
  try { fs.writeFileSync(berkasFolderKerja(), JSON.stringify({ akar: folderKerjaAkar }), 'utf8'); }
  catch (e) { console.warn('[FOLDER] Gagal menyimpan pilihan folder:', e.message); }
}
function pulihkanFolderKerja() {
  try {
    const { akar } = JSON.parse(fs.readFileSync(berkasFolderKerja(), 'utf8'));
    if (!akar) return;
    const sah = akarFolderSah(akar);
    if (sah.ok) { folderKerjaAkar = sah.akar; console.log(`[FOLDER] Folder kerja dipulihkan: "${sah.nama}"`); }
    else console.warn(`[FOLDER] Folder kerja tersimpan tidak dipakai: ${sah.alasan}`);
  } catch {  }
}
app.whenReady().then(pulihkanFolderKerja);

const statusFolder = () => ({ aktif: !!folderKerjaAkar, nama: folderKerjaAkar ? path.basename(folderKerjaAkar) : null });

ipcMain.handle('folder:pilih', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return { ...statusFolder(), dibatalkan: true };
  const sah = akarFolderSah(result.filePaths[0]);
  if (!sah.ok) return { ...statusFolder(), ditolak: sah.alasan };
  folderKerjaAkar = sah.akar;
  simpanFolderKerja();
  return { aktif: true, nama: sah.nama };
});

ipcMain.handle('folder:status', () => statusFolder());

ipcMain.handle('folder:lepas', () => {
  folderKerjaAkar = null;
  simpanFolderKerja();
  return { aktif: false, nama: null };
});

const { jalankanAlatTulis, ALAT_TULIS } = require('./alatFolderTulis.cjs');
const { jalankanAlatJalan } = require('./alatFolderJalan.cjs');
const { indeksKonstitusi } = require('./indeksKonstitusi.cjs');
const depsTulis = {
  mintaIzin: async ({ judul, rincian, pratinjau, berbahaya }) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: berbahaya ? 'warning' : 'question',
      title: `Mamet — folder kerja "${folderKerjaAkar ? path.basename(folderKerjaAkar) : ''}"`,
      message: judul,
      detail: `${rincian}${pratinjau ? `\n\n${pratinjau}` : ''}`,
      buttons: ['Tolak', 'Izinkan'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return response === 1;
  },
  keTempatSampah: (alamat) => shell.trashItem(alamat),
};

ipcMain.handle('folder:alat', async (_event, permintaan) => {
  const p = permintaan && typeof permintaan === 'object' ? permintaan : {};
  let hasil;
  try {
    hasil = p.alat === 'folder_run'
      ? await jalankanAlatJalan(folderKerjaAkar, p, depsTulis)
      : ALAT_TULIS.includes(p.alat)
        ? await jalankanAlatTulis(folderKerjaAkar, p, depsTulis)
        : jalankanAlat(folderKerjaAkar, p);
  } catch (e) { hasil = { ok: false, alat: p.alat, alamat: p.alamat, alasan: `galat: ${e.code || e.message}` }; }
  const status = hasil.ok
    ? (p.alat === 'folder_run' ? `OK (kode keluar ${hasil.kodeKeluar}${hasil.habisWaktu ? ', HABIS WAKTU' : ''}, ${hasil.waktuMs} ms, ${hasil.byteKeluaran} B)` : 'OK')
    : hasil.ditolakOwner ? 'DITOLAK OWNER' : `DITOLAK: ${hasil.alasan}`;
  const sasaran = p.alat === 'folder_run' ? (hasil.perintah || p.program) : `${p.alamat ?? p.kueri ?? '.'}${p.ke ? ` → ${p.ke}` : ''}`;
  console.log(`[FOLDER] ${p.alat} "${sasaran}" → ${status}`);
  return hasil;
});

const { pecahPerintah, PROFIL, tanpaPersetujuan, kebijakanPerintah } = require('./alatFolderJalan.cjs');
ipcMain.handle('engineer:kebijakan-perintah', () => kebijakanPerintah(PROFIL.engineer));
const depsEngineer = {
  profil: PROFIL.engineer,
  mintaIzin: async ({ judul, rincian, pratinjau }) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Mamet Engineer — repo Mamet',
      message: judul,
      detail: `${rincian}${pratinjau ? `\n\n${pratinjau}` : ''}`,
      buttons: ['Tolak', 'Izinkan'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return response === 1;
  },
};
const { jalankanProses, cariExe, envBersih } = require('./alatFolderJalan.cjs');
ipcMain.handle('engineer:akar-repo', () => akarRepo());

const PETA_SASARAN = ['frontend/src', 'frontend/electron', 'supabase/functions', 'mametlite/src'];
let petaRepoCache = null;

ipcMain.handle('engineer:perintah-aman', async (_e, teks) => {
  try {
    const p = pecahPerintah(String(teks || ''));
    if (p.galat) return false;
    return tanpaPersetujuan({ program: p.program, argumen: p.argumen, profil: PROFIL.engineer });
  } catch { return false; }
});

ipcMain.handle('engineer:indeks-konstitusi', async () => {
  const belum = butuhAkarRepo();
  if (belum) return [];
  try {
    return indeksKonstitusi(akarRepo());
  } catch (e) {
    console.warn('[Engineer] indeks konstitusi gagal:', e?.message);
    return [];
  }
});

ipcMain.handle('engineer:peta-repo', async () => {
  const belum = butuhAkarRepo();
  if (belum) return '';
  if (petaRepoCache && petaRepoCache.akar === akarRepo()) return petaRepoCache.teks;

  const git = cariExe('git', akarRepo());
  if (!git) return '';
  try {
    const h = await jalankanProses(git, ['grep', '-c', '', '--', ...PETA_SASARAN], {
      cwd: akarRepo(), env: envBersih(process.env), waktuS: 30,
    });
    const keluaran = String(h.keluaran || '').trim();
    if (h.galat || !keluaran) return '';
    petaRepoCache = { akar: akarRepo(), teks: keluaran };
    console.log(`[PETA REPO] ${keluaran.split('\n').length} berkas, ${keluaran.length} huruf`);
    return keluaran;
  } catch (e) {
    console.log(`[PETA REPO] gagal: ${e.message}`);
    return '';
  }
});

const statusAkarRepo = () => {
  const info = infoAkarRepo();
  return {
    aktif: !!info.akar,
    akar: info.akar,
    nama: info.akar ? path.basename(info.akar) : null,
    sumber: info.sumber,
    alasan: info.alasan
  };
};

ipcMain.handle('engineer:status-akar-repo', () => statusAkarRepo());

ipcMain.handle('engineer:pilih-akar-repo', async () => {
  const hasil = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Pilih folder repo untuk Engineer',
    message: 'Pilih folder hasil "git clone" — bukan folder instalasi Mamet.'
  });
  if (hasil.canceled || !hasil.filePaths[0]) return { ...statusAkarRepo(), dibatalkan: true };
  const sah = akarRepoSah(hasil.filePaths[0], { folderInstalasi: folderInstalasi() });
  if (!sah.ok) return { ...statusAkarRepo(), ditolak: sah.alasan };
  repoPilihanOwner = sah.akar;
  simpanAkarRepo();
  console.log(`[REPO] Akar repo dipilih Owner: "${sah.nama}"`);
  return statusAkarRepo();
});

ipcMain.handle('engineer:lepas-akar-repo', () => {
  repoPilihanOwner = null;
  simpanAkarRepo();
  return statusAkarRepo();
});

ipcMain.handle('engineer:uji-klaim', async (_event, permintaan) => {
  const belum = butuhAkarRepo();
  if (belum) return belum;
  const { berkas, fungsi, kasus, skrip } = permintaan || {};
  if (typeof skrip !== 'string' || !skrip.trim()) return { galat: 'skrip uji kosong' };
  if (!/^[A-Za-z_$][\w$]*$/.test(String(fungsi || ''))) return { galat: 'nama fungsi tidak sah' };
  const p = pagarRepo(akarRepo(), String(berkas || ''));
  if (!p.ok) return { galat: `alamat di luar repo: ${p.alasan || berkas}` };
  if (!fs.existsSync(p.alamat)) return { galat: `berkas tidak ada: ${berkas}` };
  if (!Array.isArray(kasus) || !kasus.length) return { galat: 'tidak ada kasus uji' };

  const node = cariExe('node', akarRepo());
  if (!node) return { galat: 'node tidak terpasang (uji klaim butuh node)' };
  const alamatSkrip = path.join(app.getPath('temp'), `mamet-uji-klaim-${Date.now()}.mjs`);
  try {
    fs.writeFileSync(alamatSkrip, skrip, 'utf8');
    const h = await jalankanProses(node, [alamatSkrip], { cwd: akarRepo(), env: envBersih(process.env), waktuS: 20 });
    if (h.galat) return { galat: h.galat };
    if (h.habisWaktu) return { galat: 'uji klaim melewati batas waktu 20 detik' };
    const baris = String(h.keluaran || '').trim().split('\n').filter(Boolean).pop() || '';
    try { return JSON.parse(baris); }
    catch { return { galat: `keluaran uji tidak terbaca: ${baris.slice(0, 200)}` }; }
  } catch (e) {
    return { galat: `gagal menjalankan uji: ${e.code || e.message}` };
  } finally {
    try { fs.unlinkSync(alamatSkrip); } catch {  }
  }
});

const BATAS_UJI_S = { semua: 300, ulang: 120 };

async function jalankanBerkasUji(node, daftar, waktuS) {
  const runner = path.join(akarRepo(), 'uji', 'jalankan-semua.mjs');
  if (!fs.existsSync(runner)) return { galat: 'uji/jalankan-semua.mjs tidak ada di akar repo yang dipilih' };
  const alamatHasil = path.join(app.getPath('temp'), `mamet-uji-${Date.now()}.json`);
  try {
    const h = await jalankanProses(node, [runner, `--keluar=${alamatHasil}`, ...daftar], {
      cwd: akarRepo(), env: envBersih(process.env), waktuS,
    });
    if (h.galat) return { galat: h.galat };
    if (h.habisWaktu) return { galat: `uji melewati batas waktu ${waktuS} detik` };
    if (!fs.existsSync(alamatHasil)) return { galat: 'penjalan uji tidak menulis hasil' };
    try { return JSON.parse(fs.readFileSync(alamatHasil, 'utf8')); }
    catch (e) { return { galat: `hasil uji tidak terbaca: ${e.message}` }; }
  } finally {
    try { fs.unlinkSync(alamatHasil); } catch {  }
  }
}

ipcMain.handle('eng:verifikasi-patch', async (_event, { checkpointRef } = {}) => {
  const belum = butuhAkarRepo();
  if (belum) return { sesudahPatch: { galat: belum.error } };

  const node = cariExe('node', akarRepo());
  if (!node) return { sesudahPatch: { galat: 'node tidak terpasang (verifikasi patch butuh node)' } };

  const sesudahPatch = await jalankanBerkasUji(node, [], BATAS_UJI_S.semua);
  const gagal = ((sesudahPatch && sesudahPatch.gagal) || []).map((g) => g.nama);
  console.log(`[ENG-VERIFIKASI] ${sesudahPatch.galat ? `galat: ${sesudahPatch.galat}` : `${sesudahPatch.lulus}/${sesudahPatch.total} lulus, ${gagal.length} gagal`}`);
  if (sesudahPatch.galat || !gagal.length) return { sesudahPatch, dipulihkan: false };

  const label = labelAman(checkpointRef) || labelCheckpointTerbaru();
  let pulih = { success: false, error: 'checkpoint tidak ada — berkas tidak bisa dikembalikan' };
  try { pulih = await pulihkanDariCheckpoint(label); }
  catch (e) { pulih = { success: false, error: e.message }; }
  if (!pulih.success) return { sesudahPatch, dipulihkan: false, galatPulih: pulih.error };

  const sesudahPulih = await jalankanBerkasUji(node, gagal, BATAS_UJI_S.ulang);
  return { sesudahPatch, sesudahPulih, dipulihkan: true };
});

ipcMain.handle('engineer:jalankan', async (_event, perintah, opsi = {}) => {
  const belum = butuhAkarRepo();
  if (belum) return { ok: false, alat: 'folder_run', perintah: String(perintah || ''), alasan: belum.error };
  const teks = typeof perintah === 'string' ? perintah : '';
  const p = pecahPerintah(teks);
  let hasil;
  if (p.galat) {
    hasil = { ok: false, alat: 'folder_run', perintah: teks, alasan: p.galat };
  } else {
    try { hasil = await jalankanAlatJalan(akarRepo(), { alat: 'folder_run', program: p.program, argumen: p.argumen, keluaranMaksByte: opsi?.keluaranMaksByte }, depsEngineer); }
    catch (e) { hasil = { ok: false, alat: 'folder_run', perintah: teks, alasan: `galat: ${e.code || e.message}` }; }
  }
  const status = hasil.ok
    ? `OK (kode keluar ${hasil.kodeKeluar}${hasil.habisWaktu ? ', HABIS WAKTU' : ''}, ${hasil.waktuMs} ms, ${hasil.byteKeluaran} B)`
    : hasil.ditolakOwner ? 'DITOLAK OWNER' : `DITOLAK: ${hasil.alasan}`;
  console.log(`[ENGINEER] "${teks}" → ${status}`);
  return hasil;
});

const { buatPengelolaKonektor, buatGerbangKonektor } = require('./konektorMcp.cjs');
const { akarBrowser } = require('./komponenKonektor.cjs');
const FOLDER_DATA_CRAWLER = path.join(app.getPath('userData'), 'crawler');
const pengelolaKonektor = buatPengelolaKonektor({
  akarRepo: path.resolve(__dirname, '..', '..'),
  berkasSetelan: path.join(app.getPath('userData'), 'konektor.json'),
  runtimeTerbundel: app.isPackaged ? path.join(process.resourcesPath, 'crawler-runtime') : null,
  folderData: FOLDER_DATA_CRAWLER,
  versi: app.getVersion(),
  log: (pesan) => console.log(pesan),
});
ipcMain.handle('konektor:status', () => pengelolaKonektor.status());
ipcMain.handle('konektor:atur', (_event, { workspace, konektor, nyala } = {}) => pengelolaKonektor.atur(workspace, konektor, nyala));
const gerbangKonektor = buatGerbangKonektor({
  pengelola: pengelolaKonektor,
  log: (pesan) => console.log(pesan),
  mintaIzin: async ({ judul, rincian }) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Mamet — konektor',
      message: judul,
      detail: rincian,
      buttons: ['Tolak', 'Izinkan'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return response === 1;
  },
});
ipcMain.handle('konektor:panggil', (_event, { workspace, konektor, alat, argumen } = {}) =>
  gerbangKonektor.panggil(workspace, konektor, alat, argumen));
ipcMain.handle('konektor:pasang-stealth', async () => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Mamet — komponen stealth crawler',
    message: 'Unduh komponen tingkat stealth Ecosystem Crawler?',
    detail: [
      'Yang diunduh (ruang disk sesudah terpasang, ±830 MB; unduhannya lebih kecil karena terkompresi):',
      `• paket Patchright (±110 MB) dari PyPI → ${path.join(FOLDER_DATA_CRAWLER, 'stealth')}`,
      `• browser Chromium + headless shell + ffmpeg (±720 MB) dari server browser Playwright → ${akarBrowser() || '%LOCALAPPDATA%\\ms-playwright'} — dilewati bila sudah ada di laptop ini`,
      '',
      'Gunanya: halaman publik yang memblokir crawler dicoba lagi dengan browser yang menyamarkan sidik jarinya (bila sakelar CRAWLER_STEALTH nyala). Tanpa komponen ini, halaman seperti itu dilewati dan dicatat.',
      'Pemasangan bisa makan beberapa menit; konektor yang menyala akan dimulai ulang.',
    ].join('\n'),
    buttons: ['Batal', 'Unduh & pasang'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (response !== 1) return { ok: false, ditolakOwner: true, alasan: 'dibatalkan Owner' };
  return pengelolaKonektor.pasangStealth();
});
ipcMain.handle('konektor:komponen', (_event, { konektor } = {}) => pengelolaKonektor.komponen(konektor));
ipcMain.handle('konektor:buka-folder', async (_event, { konektor, kunci } = {}) => {
  const lokasi = pengelolaKonektor.lokasiFolder(konektor, kunci);
  if (!lokasi) return { ok: false, alasan: 'folder tidak dikenal atau belum ada' };
  const galat = await shell.openPath(lokasi);
  return galat ? { ok: false, alasan: galat } : { ok: true };
});
const { daftarkanKonektorUmum } = require('./konektor/ipcUmum.cjs');
const { lingkunganServer } = require('./konektorMcp.cjs');
const konektorUmum = daftarkanKonektorUmum({
  ipcMain, dialog, shell, safeStorage,
  folderData: app.getPath('userData'),
  jendela: () => mainWindow,
  lingkungan: () => lingkunganServer(),
  versi: app.getVersion(),
  log: (pesan) => console.log(pesan),
  ambil: net.fetch,
});
app.whenReady().then(() => pengelolaKonektor.pulihkan().then((h) => {
  if (h.length) console.log(`[KONEKTOR] dipulihkan: ${h.map((x) => `${x.workspace}::${x.konektor}=${x.ok ? 'nyala' : x.alasan}`).join(', ')}`);
}).then(() => konektorUmum.pulihkan()).then((h) => {
  if (h?.length) console.log(`[KONEKTOR-UMUM] dipulihkan: ${h.map((x) => `${x.workspace}::${x.konektor}=${x.ok ? 'nyala' : x.alasan}`).join(', ')}`);
}));
let konektorSudahDimatikan = false;
app.on('will-quit', (event) => {
  if (konektorSudahDimatikan) return;
  event.preventDefault();
  konektorSudahDimatikan = true;
  Promise.allSettled([pengelolaKonektor.matikanSemua(), konektorUmum.matikanSemua()]).finally(() => app.quit());
});

ipcMain.handle('check-for-updates', async () => {
  if (isDev) return { status: 'dev-mode', message: 'Auto-updater dinonaktifkan dalam mode development.' };
  try {
    const { autoUpdater } = require('electron-updater');
    const result = await autoUpdater.checkForUpdatesAndNotify();
    return { status: 'checked', version: result?.updateInfo?.version || 'unknown' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});



ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const isAbsolute = path.isAbsolute(filePath);
    const normalizedPath = isAbsolute 
      ? path.resolve(filePath) 
      : alamatRepoRelatif(filePath);
    
    console.log(`[FS] readFile: "${filePath}" → normalized: "${normalizedPath}"`);
    
    if (!fs.existsSync(normalizedPath)) {
      console.warn(`[FS] File tidak ditemukan: ${normalizedPath}`);
      return null;
    }
    return fs.readFileSync(normalizedPath, 'utf-8');
  } catch (error) {
    console.error('[FS] Gagal membaca file:', filePath, error);
    return null;
  }
});

ipcMain.handle('fs:writeFile', async (event, { filePath, content }) => {
  try {
    const isAbsolute = path.isAbsolute(filePath);
    const normalizedPath = isAbsolute 
      ? path.resolve(filePath) 
      : alamatRepoRelatif(filePath);
    
    console.log(`[FS] writeFile: "${filePath}" → normalized: "${normalizedPath}"`);
    
    const dir = path.dirname(normalizedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(normalizedPath, String(content), 'utf-8');
    return true;
  } catch (error) {
    console.error('[FS] Gagal menulis file:', filePath, error);
    return false;
  }
});

ipcMain.handle('fs:deleteFile', async (event, filePath) => {
  try {
    const isAbsolute = path.isAbsolute(filePath);
    const normalizedPath = isAbsolute 
      ? path.resolve(filePath) 
      : alamatRepoRelatif(filePath);
    
    if (!fs.existsSync(normalizedPath)) {
      return false;
    }
    fs.unlinkSync(normalizedPath);
    return true;
  } catch (error) {
    console.error('[FS] Gagal menghapus file:', filePath, error);
    return false;
  }
});

ipcMain.handle('fs:listFiles', async (event, dirPath) => {
  try {
    const isAbsolute = path.isAbsolute(dirPath);
    const normalizedPath = isAbsolute 
      ? path.resolve(dirPath) 
      : alamatRepoRelatif(dirPath);
    
    if (!fs.existsSync(normalizedPath) || !fs.statSync(normalizedPath).isDirectory()) {
      return [];
    }
    const entries = fs.readdirSync(normalizedPath, { withFileTypes: true });
    return entries.map(entry => {
      const fullPath = path.join(normalizedPath, entry.name);
      let size = 0;
      try {
        if (entry.isFile()) {
          size = fs.statSync(fullPath).size;
        }
      } catch (e) {  }
      return {
        name: entry.name,
        path: path.join(dirPath, entry.name).replace(/\\/g, '/'),
        type: entry.isDirectory() ? 'dir' : 'file',
        size
      };
    });
  } catch (error) {
    console.error('[FS] Gagal listing direktori:', dirPath, error);
    return [];
  }
});

ipcMain.handle('fs:getFileInfo', async (event, filePath) => {
  try {
    const isAbsolute = path.isAbsolute(filePath);
    const normalizedPath = isAbsolute 
      ? path.resolve(filePath) 
      : alamatRepoRelatif(filePath);
    
    if (!fs.existsSync(normalizedPath)) {
      return null;
    }
    const stat = fs.statSync(normalizedPath);
    const ext = path.extname(normalizedPath).toLowerCase();
    const mimeTypes = {
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.js': 'text/javascript',
      '.jsx': 'text/javascript',
      '.ts': 'text/typescript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.css': 'text/css',
    };
    return {
      path: filePath,
      size: stat.size,
      type: mimeTypes[ext] || 'application/octet-stream',
      createdAt: stat.birthtimeMs,
      modifiedAt: stat.mtimeMs,
      backend: 'file-system'
    };
  } catch (error) {
    console.error('[FS] Gagal mendapatkan info file:', filePath, error);
    return null;
  }
});

ipcMain.handle('fs:fileExists', async (event, filePath) => {
  try {
    const isAbsolute = path.isAbsolute(filePath);
    const normalizedPath = isAbsolute 
      ? path.resolve(filePath) 
      : alamatRepoRelatif(filePath);
    
    return fs.existsSync(normalizedPath);
  } catch (error) {
    return false;
  }
});


ipcMain.handle('fs:listFilesRecursive', async (event, dirPath) => {
  try {
    const isAbsolute = path.isAbsolute(dirPath);
    const normalizedPath = isAbsolute 
      ? path.resolve(dirPath) 
      : alamatRepoRelatif(dirPath);
    
    console.log(`[FS] listFilesRecursive: "${dirPath}" → normalized: "${normalizedPath}"`);
    
    if (!fs.existsSync(normalizedPath) || !fs.statSync(normalizedPath).isDirectory()) {
      console.warn(`[FS] Direktori tidak ditemukan atau bukan folder: ${normalizedPath}`);
      return [];
    }

    const results = [];

    function walkDir(currentPath, relativePath) {
      let entries;
      try {
        entries = fs.readdirSync(currentPath, { withFileTypes: true });
      } catch (e) {
        console.warn(`[FS] Gagal membaca direktori: ${currentPath}`, e.message);
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativeEntry = path.join(relativePath, entry.name).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          walkDir(fullPath, relativeEntry);
        } else if (entry.isFile()) {
          results.push(relativeEntry);
        }
      }
    }

    walkDir(normalizedPath, '');
    
    console.log(`[FS] listFilesRecursive selesai: ${results.length} files ditemukan`);
    return results;
  } catch (error) {
    console.error('[FS] Gagal listFilesRecursive:', dirPath, error);
    return [];
  }
});