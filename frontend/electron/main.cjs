const { app, BrowserWindow, ipcMain, dialog, protocol, session, shell } = require('electron');
// MATIKAN AKSELERASI GPU SEAWAL MUNGKIN UNTUK MENCEGAH CRASH GPU
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');
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

// Daftarkan skema protokol kusto
protocol.registerSchemesAsPrivileged([
  { scheme: 'mamet', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

const isDev = process.env.NODE_ENV === 'development';
let mainWindow;

// ===== AUTO-UPDATER (Delta OTA Patching) =====
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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadURL('mamet://app/index.html').catch(err => {
      const logMsg = `[FATAL] loadURL mamet:// gagal: ${err.message}\n`;
      console.error(logMsg);
      fs.appendFileSync(path.join(os.tmpdir(), 'mamet-renderer.log'), logMsg);
    });
  }

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

  // Konfigurasi CSP Header: izinkan domain Tier 3 Web Retrieval (Google News RSS, Wikipedia, DuckDuckGo)
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

// ========== IPC HANDLERS ==========

// 0a. Tier 3 Web Retrieval Fetcher (Node.js Network Layer — Bebas CORS & Header Restrictions)
ipcMain.handle('net:fetchWeb', async (event, { url, options = {} }) => {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, text/html, application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    ...(options.headers || {})
  };

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: text
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      status: 0,
      error: err.message
    };
  }
});

// 0b. Konversi Word -> PDF (tool `word_to_pdf`)
//
// Mesinnya adalah Word itu sendiri, mencetak ke printer virtual "Microsoft Print to PDF"
// (lihat header electron/scripts/word_to_pdf.ps1 untuk alasannya dan jebakan 0 KB).
//
// Sengaja memakai PowerShell 32-BIT (SysWOW64): mesin Owner punya Word 2007 berlisensi DAN
// Word 365 tanpa lisensi. COM "Word.Application" dari proses 64-bit membuka Word 365, yang
// memunculkan dialog tersembunyi "Save to OneDrive to enable editing" dan menahan Word
// selamanya. Dari proses 32-bit, COM membuka Word 2007. Keduanya dibuktikan 2026-09-10.
//
// Tidak memakai `run-terminal-command`: perintahnya tetap (bukan teks bebas dari AI), dan
// argumen dikirim lewat spawn tanpa shell sehingga nama berkas tidak bisa disisipi perintah.
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
  // Satu per satu: skrip mengenali job cetaknya lewat nama dokumen di antrian printer.
  if (wordToPdfSedangBerjalan) {
    return { ok: false, stage: 'sibuk', error: 'Masih ada konversi lain yang berjalan. Tunggu sampai selesai.' };
  }

  // PDF ditaruh di sebelah dokumen aslinya. Berkas yang sudah ada TIDAK ditimpa.
  const outputPath = pathTanpaBentrok(path.dirname(filePath), path.basename(filePath, ext), '.pdf');

  // Di build terpaket, electron/ ada di dalam app.asar yang tidak bisa dibaca PowerShell.
  // package.json → build.asarUnpack mengeluarkan folder scripts/ ke app.asar.unpacked.
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

      // Batas keras di atas batas tunggu skrip (600 dtk). Kalau terlewati, hentikan juga Word
      // milik skrip — tanpa ini, WINWORD.EXE tersembunyi akan tertinggal di latar belakang.
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

// 0b-2. Berkas sementara untuk konversi dari HP (Item 57).
//
// Pekerja di renderer mengunduh .docx dari Supabase Storage, tapi Word hanya bisa membuka
// berkas di disk. Tiga IPC ini menjembatani, dan SEMUANYA dikurung di satu folder:
// %TEMP%\mamet-konversi\<jobId>\. jobId divalidasi sebagai UUID dan nama berkas dibersihkan,
// jadi renderer tidak bisa menulis atau membaca di luar folder itu ("..\..\" dsb).
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
    // Nama asli dipertahankan (PDF hasilnya ikut bernama sama), karakter terlarang Windows dibuang.
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

// 0c. Buka hasil konversi — tombol "Buka PDF" / "Tampilkan di folder" di chat.
//
// HANYA berkas .pdf yang benar-benar ada. shell.openPath() membuka berkas dengan program
// bawaannya — untuk .exe atau .bat itu berarti MENJALANKANNYA. Tanpa batas ekstensi, jalur
// ini bisa dipakai renderer untuk mengeksekusi apa saja di disk.
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
  const galat = await shell.openPath(filePath); // '' berarti berhasil
  return galat ? { ok: false, error: galat } : { ok: true };
});

const { runAirdropTask } = require('./airdropEngine.cjs');

// ✅ Tentukan root proyek secara absolut (folder induk dari 'frontend/electron/')
// Karena main.cjs berada di frontend/electron/, maka __dirname = .../frontend/electron
// PROJECT_ROOT = .../mamet os ecosystem/
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// 0. Airdrop Stealth Engine
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

// 1–2. `edit-file-surgical` (tulis ke alamat absolut mana pun) dan `run-terminal-command` (kalimat shell bebas +
// blocklist) DIHAPUS 2026-09-22 (T8): satu-satunya pemakainya CommandRegistry yang merakit PowerShell dari alamat
// mentah — dan jalur itu rusak (tombol [MAMET_CMD] selalu "tidak terdaftar"). Perintah Engineer kini lewat
// `engineer:jalankan` (tanpa shell, daftar izin, dialog) — lihat di bawah blok folder kerja.

// =============================================
// ENGINEER ROLLBACK SYSTEM — salinan berkas, BUKAN git stash (T10 uji Engineer, 2026-09-22)
//
// Dulu: checkpoint = `git stash push` SELURUH working tree. Live TUGAS-01: 5 berkas pekerjaan Owner yang belum
// di-commit (tak berhubungan dengan patch) lenyap dari disk ke stash, Vite memuat ulang aplikasi, patch terputus.
// Repo bersih → tak ada checkpoint (Undo mustahil); Undo = `git stash pop` stash TERATAS (bisa stash yang salah);
// label dirakit jadi kalimat shell (`exec`). Kini: proses utama membaca sendiri isi asli HANYA berkas yang akan
// di-patch (byte persis) ke userData/eng-checkpoint/<label>.json; Undo menulis kembali tepat berkas-berkas itu.
// Git tidak disentuh; alamat lewat pagar repo (alamatDalamPagar).
// =============================================
const { alamatDalamPagar: pagarRepo } = require('./pagarFolder.cjs');
const BATAS_CHECKPOINT = { berkas: 10, byte: 5 * 1024 * 1024 };
const folderCheckpoint = () => path.join(app.getPath('userData'), 'eng-checkpoint');
const labelAman = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);

// 2a. Checkpoint — dipanggil SEBELUM patch apply (tanpa dialog). files = alamat relatif repo.
ipcMain.handle('eng:git-checkpoint', async (_event, { taskId, files } = {}) => {
  try {
    const label = labelAman(`ENG-CHECKPOINT-${taskId || Date.now()}`);
    const daftar = Array.isArray(files) ? files.filter((f) => typeof f === 'string' && f.trim()) : [];
    if (!daftar.length) return { success: false, error: 'tidak ada berkas untuk di-checkpoint' };
    if (daftar.length > BATAS_CHECKPOINT.berkas) return { success: false, error: `lebih dari ${BATAS_CHECKPOINT.berkas} berkas` };
    const berkas = [];
    for (const rel of daftar) {
      const p = pagarRepo(PROJECT_ROOT, rel);
      if (!p.ok) return { success: false, error: `"${rel}": ${p.alasan}` };
      let st = null;
      try { st = fs.statSync(p.alamat); } catch { /* belum ada */ }
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

// 2b. Rollback — Owner mengembalikan patch: menulis ulang isi asli tepat berkas yang di-checkpoint.
ipcMain.handle('eng:git-rollback', async (_event, { checkpointLabel } = {}) => {
  try {
    let label = labelAman(checkpointLabel);
    if (!label) {
      // Tanpa label: checkpoint terbaru.
      const semua = fs.existsSync(folderCheckpoint()) ? fs.readdirSync(folderCheckpoint()).filter((n) => n.endsWith('.json')) : [];
      semua.sort((a, b) => fs.statSync(path.join(folderCheckpoint(), b)).mtimeMs - fs.statSync(path.join(folderCheckpoint(), a)).mtimeMs);
      label = semua.length ? semua[0].replace(/\.json$/, '') : '';
    }
    const berkasCp = label ? path.join(folderCheckpoint(), `${label}.json`) : '';
    if (!berkasCp || !fs.existsSync(berkasCp)) return { success: false, error: 'Checkpoint tidak ditemukan. Rollback tidak bisa dilakukan.' };
    const cp = JSON.parse(fs.readFileSync(berkasCp, 'utf8'));
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

    const hasil = [];
    for (const b of cp.berkas || []) {
      const p = pagarRepo(PROJECT_ROOT, b.alamat);
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
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 3. Folder Selection
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// 3b. FOLDER KERJA ASSISTANT (Item 85 Tahap 0, 2026-09-21). Akar dicatat DI SINI saat dipilih lewat dialog —
// tidak pernah diterima dari layar — dan layar hanya menerima namanya. Alat folder (Tahap 1+) wajib memakai
// alamatDalamPagar(folderKerjaAkar, relatif); jalur `fs:*` & `edit-file-surgical` tidak berpagar dan bukan untuk ini.
const { akarFolderSah } = require('./pagarFolder.cjs');
const { jalankanAlat } = require('./alatFolder.cjs');
let folderKerjaAkar = null;

// Tahap 1: pilihan folder diingat di berkas pengaturan proses utama (bukan StorageManager — kunci bertitik dua) dan
// DISAHKAN ULANG lewat akarFolderSah saat aplikasi dibuka: folder yang sudah dihapus/dipindah tidak dipakai diam-diam.
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
  } catch { /* belum pernah dipilih */ }
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

// Alat BACA (folder_list / folder_read / folder_search). Akar diambil dari variabel proses utama — permintaan dari
// layar hanya membawa alamat relatif. Setiap panggilan dicatat (bukti penolakan di luar pagar).
// Tahap 2: alat TULIS lewat modul terpisah; izin = dialog ASLI proses utama (tak bisa dipalsukan/dilewati layar
// maupun model), hapus = Recycle Bin (shell.trashItem).
const { jalankanAlatTulis, ALAT_TULIS } = require('./alatFolderTulis.cjs');
// Tahap 3: folder_run — program dari daftar izin, tanpa shell, folder asal = folder kerja, dialog izin yang sama.
const { jalankanAlatJalan } = require('./alatFolderJalan.cjs');
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

// ENGINEER — tombol [MAMET_CMD: …] (T8, keputusan Owner B1 2026-09-22). Menggantikan CommandRegistry (PowerShell
// dirakit dari alamat mentah) & run-terminal-command (shell bebas + blocklist). Kalimat perintah dipecah TANPA shell
// (pecahPerintah) lalu dijalankan pelaksana yang sama dengan folder_run: daftar izin program, .exe dicari di luar
// repo, lingkungan tanpa rahasia, batas waktu, dialog izin. Folder asal = repo Mamet (Engineer bekerja di repo).
// Kuasa Engineer ditentukan PROFIL (alatFolderJalan.cjs): git baca saja, tanpa pemasang paket, batas 180 s.
const { pecahPerintah, PROFIL } = require('./alatFolderJalan.cjs');
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
ipcMain.handle('engineer:jalankan', async (_event, perintah) => {
  const teks = typeof perintah === 'string' ? perintah : '';
  const p = pecahPerintah(teks);
  let hasil;
  if (p.galat) {
    hasil = { ok: false, alat: 'folder_run', perintah: teks, alasan: p.galat };
  } else {
    // Batas waktu dari profil Engineer (180 s — build/test butuh lebih dari bawaan Assistant 60 s).
    try { hasil = await jalankanAlatJalan(PROJECT_ROOT, { alat: 'folder_run', program: p.program, argumen: p.argumen }, depsEngineer); }
    catch (e) { hasil = { ok: false, alat: 'folder_run', perintah: teks, alasan: `galat: ${e.code || e.message}` }; }
  }
  const status = hasil.ok
    ? `OK (kode keluar ${hasil.kodeKeluar}${hasil.habisWaktu ? ', HABIS WAKTU' : ''}, ${hasil.waktuMs} ms, ${hasil.byteKeluaran} B)`
    : hasil.ditolakOwner ? 'DITOLAK OWNER' : `DITOLAK: ${hasil.alasan}`;
  console.log(`[ENGINEER] "${teks}" → ${status}`);
  return hasil;
});

// 4. Check for updates manually
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

// 5. Dapatkan versi aplikasi saat ini
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// 6–7. IPC Docker sandbox (check-docker-status, run-docker-sandbox) dihapus 2026-09-15 (Item 85):
// pemakainya hanya interceptor OS lama yang ikut dihapus.

// =============================================
// 8. FILE SYSTEM HANDLERS (StorageManager Backend)
// =============================================
// ✅ Semua handler menggunakan PROJECT_ROOT untuk resolusi path relatif

ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const isAbsolute = path.isAbsolute(filePath);
    const normalizedPath = isAbsolute 
      ? path.resolve(filePath) 
      : path.resolve(PROJECT_ROOT, filePath);
    
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
      : path.resolve(PROJECT_ROOT, filePath);
    
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
      : path.resolve(PROJECT_ROOT, filePath);
    
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
      : path.resolve(PROJECT_ROOT, dirPath);
    
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
      } catch (e) { /* abaikan */ }
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
      : path.resolve(PROJECT_ROOT, filePath);
    
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
      : path.resolve(PROJECT_ROOT, filePath);
    
    return fs.existsSync(normalizedPath);
  } catch (error) {
    return false;
  }
});

// =============================================
// 9. RECURSIVE FILE LISTING (untuk FileIndexService)
// =============================================

ipcMain.handle('fs:listFilesRecursive', async (event, dirPath) => {
  try {
    const isAbsolute = path.isAbsolute(dirPath);
    const normalizedPath = isAbsolute 
      ? path.resolve(dirPath) 
      : path.resolve(PROJECT_ROOT, dirPath);
    
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