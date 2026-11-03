const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // =============================================
  // STORAGE MANAGER — FILE SYSTEM BACKEND
  // =============================================

  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', { filePath, content }),
  deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
  listFiles: (dirPath) => ipcRenderer.invoke('fs:listFiles', dirPath),
  listFilesRecursive: (dirPath) => ipcRenderer.invoke('fs:listFilesRecursive', dirPath),
  getFileInfo: (filePath) => ipcRenderer.invoke('fs:getFileInfo', filePath),
  fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),

  // =============================================
  // FOLDER & FILE DIALOGS
  // =============================================

  openFolderDialog: async () => {
    try {
      const result = await ipcRenderer.invoke('select-folder');
      if (result === null || result === undefined) {
        return { canceled: true, filePaths: [] };
      }
      return { canceled: false, filePaths: [result] };
    } catch (err) {
      console.error('[Preload] openFolderDialog error:', err);
      return { canceled: true, filePaths: [] };
    }
  },

  // =============================================
  // FOLDER KERJA ASSISTANT (Item 85) — hanya nama folder yang sampai ke layar; alamat lengkap tetap di proses utama
  // =============================================

  folderKerja: {
    pilih: () => ipcRenderer.invoke('folder:pilih'),
    status: () => ipcRenderer.invoke('folder:status'),
    lepas: () => ipcRenderer.invoke('folder:lepas'),
    // Tahap 1: alat baca — { alat: 'folder_list'|'folder_read'|'folder_search', alamat, kueri, dari, sampai }
    alat: (permintaan) => ipcRenderer.invoke('folder:alat', permintaan),
  },

  // =============================================
  // ENGINEER — tombol [MAMET_CMD] (T8): satu kalimat perintah → dipecah tanpa shell di proses utama, dialog izin.
  // Menggantikan runTerminalCommand (shell bebas) yang dihapus 2026-09-22.
  // =============================================

  // =============================================
  // KONEKTOR MCP (Item 129 Tahap B–D) — status & sakelar Settings per workspace (K3), disimpan di perangkat (K7).
  // `panggil` melewati GERBANG di proses utama (Tahap D): dialog persetujuan Owner, sekali per misi (K2/K8).
  // =============================================

  konektor: {
    status: () => ipcRenderer.invoke('konektor:status'),
    atur: (workspace, konektor, nyala) => ipcRenderer.invoke('konektor:atur', { workspace, konektor, nyala }),
    panggil: (workspace, konektor, alat, argumen) => ipcRenderer.invoke('konektor:panggil', { workspace, konektor, alat, argumen }),
    // Tahap E2: unduhan komponen stealth — proses utama meminta persetujuan Owner lebih dulu.
    pasangStealth: () => ipcRenderer.invoke('konektor:pasang-stealth'),
    // Tahap E3: daftar yang terpasang + buka foldernya (kunci, bukan alamat).
    komponen: (konektor) => ipcRenderer.invoke('konektor:komponen', { konektor }),
    bukaFolder: (konektor, kunci) => ipcRenderer.invoke('konektor:buka-folder', { konektor, kunci }),
  },

  // KONEKTOR UMUM (Item 129 Tahap G2) — server MCP dari resep. Program dipilih di dialog proses utama; kredensial
  // hanya DIKIRIM (tak ada saluran yang mengembalikan nilainya). G3: `panggil` melewati GERBANG izin di proses utama
  // (dialog per alat / selama percakapan, K17); `aktif` = alat yang disetujui Owner di server yang menyala.
  konektorUmum: {
    aktif: (workspace) => ipcRenderer.invoke('konektor-umum:aktif', { workspace }),
    panggil: (workspace, id, alat, argumen, percakapan) => ipcRenderer.invoke('konektor-umum:panggil', { workspace, id, alat, argumen, percakapan }),
    resep: () => ipcRenderer.invoke('konektor-umum:resep'),
    status: () => ipcRenderer.invoke('konektor-umum:status'),
    pasang: (resepId) => ipcRenderer.invoke('konektor-umum:pasang', { resepId }),
    kredensial: (id, kredensial, nilai) => ipcRenderer.invoke('konektor-umum:kredensial', { id, kredensial, nilai }),
    tinjau: (id) => ipcRenderer.invoke('konektor-umum:tinjau', { id }),
    setujui: (id, alat) => ipcRenderer.invoke('konektor-umum:setujui', { id, alat }),
    atur: (workspace, id, nyala) => ipcRenderer.invoke('konektor-umum:atur', { workspace, id, nyala }),
    hapus: (id) => ipcRenderer.invoke('konektor-umum:hapus', { id }),
    bukaFolderResep: () => ipcRenderer.invoke('konektor-umum:buka-folder-resep'),
    // Tahap F2 (OAuth): login di browser sistem; Putuskan ditanyakan di dialog proses utama.
    hubungkan: (id) => ipcRenderer.invoke('konektor-umum:hubungkan', { id }),
    putuskan: (id) => ipcRenderer.invoke('konektor-umum:putuskan', { id }),
  },

  engineer: {
    jalankan: (perintah) => ipcRenderer.invoke('engineer:jalankan', perintah),
    ujiKlaim: (permintaan) => ipcRenderer.invoke('engineer:uji-klaim', permintaan),
    akarRepo: () => ipcRenderer.invoke('engineer:akar-repo'),
    // Peta repo: daftar berkas kode + jumlah barisnya, supaya Engineer TAHU apa yang ada
    // alih-alih menebak letak berkas lalu mencarinya sepotong-sepotong.
    petaRepo: () => ipcRenderer.invoke('engineer:peta-repo'),
    indeksKonstitusi: () => ipcRenderer.invoke('engineer:indeks-konstitusi'),
    perintahAman: (teks) => ipcRenderer.invoke('engineer:perintah-aman', teks),
    // Tahap 5 — akar repo dipilih Owner sekali; di aplikasi terpasang tanpa ini alat repo mati.
    statusAkarRepo: () => ipcRenderer.invoke('engineer:status-akar-repo'),
    pilihAkarRepo: () => ipcRenderer.invoke('engineer:pilih-akar-repo'),
    lepasAkarRepo: () => ipcRenderer.invoke('engineer:lepas-akar-repo'),
  },

  // =============================================
  // ENGINEER ROLLBACK SYSTEM
  // =============================================

  // Buat checkpoint git sebelum apply patch (dipanggil otomatis oleh Engineer)
  gitCheckpoint: (taskId, files) => ipcRenderer.invoke('eng:git-checkpoint', { taskId, files }),
  // Rollback ke checkpoint terakhir (dipanggil user via tombol Undo)
  gitRollback: (checkpointLabel) => ipcRenderer.invoke('eng:git-rollback', { checkpointLabel }),
  // Tahap 6 — jalankan seluruh berkas uji sesudah patch ditulis; bila ada yang gagal, berkas DIKEMBALIKAN
  // sendiri lalu yang gagal dijalankan ulang untuk tahu apakah patch ini memang penyebabnya.
  verifikasiPatch: (checkpointRef) => ipcRenderer.invoke('eng:verifikasi-patch', { checkpointRef }),


  // =============================================
  // AIRDROP STEALTH ENGINE
  // =============================================

  runAirdropTask: (taskName, params) => ipcRenderer.invoke('run-airdrop-stealth', { taskName, params }),

  // =============================================
  // AUTO-UPDATER
  // =============================================

  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  onUpdateStatus: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },

  // =============================================
  // TIER 3 WEB RETRIEVAL FETCHER (jaringan Chromium di proses utama — electron/ambilWeb.cjs)
  // =============================================
  fetchWeb: (url, options) => ipcRenderer.invoke('net:fetchWeb', { url, options }),

  // =============================================
  // DOKUMEN — konversi Word -> PDF (tool word_to_pdf)
  // =============================================

  // Path asli berkas yang dilampirkan di chat. Sejak Electron 32, `File.path` sudah dihapus;
  // satu-satunya jalan resmi adalah webUtils.getPathForFile(), dan itu hanya ada di preload.
  getPathForFile: (file) => {
    try { return webUtils.getPathForFile(file) || null; } catch (_) { return null; }
  },
  wordToPdf: (filePath) => ipcRenderer.invoke('doc:word-to-pdf', { filePath }),
  // mode: 'open' (buka dengan penampil PDF bawaan) | 'folder' (Explorer, berkas terpilih)
  openConvertedPdf: (filePath, mode = 'open') => ipcRenderer.invoke('doc:open-result', { filePath, mode }),
  // Konversi dari HP (Item 57): berkas sementara di %TEMP%\mamet-konversi\<jobId>\
  conversionTempSave: (jobId, fileName, bytes) => ipcRenderer.invoke('doc:temp-save', { jobId, fileName, bytes }),
  conversionTempRead: (filePath) => ipcRenderer.invoke('doc:temp-read', { filePath }),
  conversionTempCleanup: (jobId) => ipcRenderer.invoke('doc:temp-cleanup', { jobId }),
});