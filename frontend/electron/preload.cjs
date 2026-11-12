const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', { filePath, content }),
  deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
  listFiles: (dirPath) => ipcRenderer.invoke('fs:listFiles', dirPath),
  listFilesRecursive: (dirPath) => ipcRenderer.invoke('fs:listFilesRecursive', dirPath),
  getFileInfo: (filePath) => ipcRenderer.invoke('fs:getFileInfo', filePath),
  fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),


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


  folderKerja: {
    pilih: () => ipcRenderer.invoke('folder:pilih'),
    status: () => ipcRenderer.invoke('folder:status'),
    lepas: () => ipcRenderer.invoke('folder:lepas'),
    alat: (permintaan) => ipcRenderer.invoke('folder:alat', permintaan),
  },



  konektor: {
    status: () => ipcRenderer.invoke('konektor:status'),
    atur: (workspace, konektor, nyala) => ipcRenderer.invoke('konektor:atur', { workspace, konektor, nyala }),
    panggil: (workspace, konektor, alat, argumen) => ipcRenderer.invoke('konektor:panggil', { workspace, konektor, alat, argumen }),
    pasangStealth: () => ipcRenderer.invoke('konektor:pasang-stealth'),
    komponen: (konektor) => ipcRenderer.invoke('konektor:komponen', { konektor }),
    bukaFolder: (konektor, kunci) => ipcRenderer.invoke('konektor:buka-folder', { konektor, kunci }),
  },

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
    hubungkan: (id) => ipcRenderer.invoke('konektor-umum:hubungkan', { id }),
    putuskan: (id) => ipcRenderer.invoke('konektor-umum:putuskan', { id }),
    batalLogin: (id) => ipcRenderer.invoke('konektor-umum:batal-login', { id }),
  },

  engineer: {
    jalankan: (perintah, opsi) => ipcRenderer.invoke('engineer:jalankan', perintah, opsi),
    ujiKlaim: (permintaan) => ipcRenderer.invoke('engineer:uji-klaim', permintaan),
    akarRepo: () => ipcRenderer.invoke('engineer:akar-repo'),
    petaRepo: () => ipcRenderer.invoke('engineer:peta-repo'),
    kebijakanPerintah: () => ipcRenderer.invoke('engineer:kebijakan-perintah'),
    indeksKonstitusi: () => ipcRenderer.invoke('engineer:indeks-konstitusi'),
    perintahAman: (teks) => ipcRenderer.invoke('engineer:perintah-aman', teks),
    statusAkarRepo: () => ipcRenderer.invoke('engineer:status-akar-repo'),
    pilihAkarRepo: () => ipcRenderer.invoke('engineer:pilih-akar-repo'),
    lepasAkarRepo: () => ipcRenderer.invoke('engineer:lepas-akar-repo'),
  },


  gitCheckpoint: (taskId, files) => ipcRenderer.invoke('eng:git-checkpoint', { taskId, files }),
  gitRollback: (checkpointLabel) => ipcRenderer.invoke('eng:git-rollback', { checkpointLabel }),
  verifikasiPatch: (checkpointRef) => ipcRenderer.invoke('eng:verifikasi-patch', { checkpointRef }),



  runAirdropTask: (taskName, params) => ipcRenderer.invoke('run-airdrop-stealth', { taskName, params }),


  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  onUpdateStatus: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },

  fetchWeb: (url, options) => ipcRenderer.invoke('net:fetchWeb', { url, options }),


  getPathForFile: (file) => {
    try { return webUtils.getPathForFile(file) || null; } catch (_) { return null; }
  },
  wordToPdf: (filePath) => ipcRenderer.invoke('doc:word-to-pdf', { filePath }),
  openConvertedPdf: (filePath, mode = 'open') => ipcRenderer.invoke('doc:open-result', { filePath, mode }),
  conversionTempSave: (jobId, fileName, bytes) => ipcRenderer.invoke('doc:temp-save', { jobId, fileName, bytes }),
  conversionTempRead: (filePath) => ipcRenderer.invoke('doc:temp-read', { filePath }),
  conversionTempCleanup: (jobId) => ipcRenderer.invoke('doc:temp-cleanup', { jobId }),
});