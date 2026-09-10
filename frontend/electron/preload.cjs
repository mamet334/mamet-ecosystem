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
  // TERMINAL COMMAND
  // =============================================

  runTerminalCommand: (command) => ipcRenderer.invoke('run-terminal-command', { command }),

  // =============================================
  // ENGINEER ROLLBACK SYSTEM
  // =============================================

  // Buat checkpoint git sebelum apply patch (dipanggil otomatis oleh Engineer)
  gitCheckpoint: (taskId, files) => ipcRenderer.invoke('eng:git-checkpoint', { taskId, files }),
  // Rollback ke checkpoint terakhir (dipanggil user via tombol Undo)
  gitRollback: (checkpointLabel) => ipcRenderer.invoke('eng:git-rollback', { checkpointLabel }),


  // =============================================
  // SURGICAL FILE EDITING
  // =============================================

  editFileSurgical: (filePath, content) => ipcRenderer.invoke('edit-file-surgical', { filePath, content }),

  // =============================================
  // DOCKER SANDBOX
  // =============================================

  checkDockerStatus: () => ipcRenderer.invoke('check-docker-status'),
  runDockerSandbox: (code, language) => ipcRenderer.invoke('run-docker-sandbox', { code, language }),

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
  // TIER 3 WEB RETRIEVAL FETCHER (Node.js Network Bridge)
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
});