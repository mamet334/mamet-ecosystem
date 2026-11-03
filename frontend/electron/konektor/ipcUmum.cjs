// IPC KONEKTOR UMUM (Item 129 Tahap G2, 2026-11-03) — satu tugas: pintu dari Settings ke konektor umum.
//
// Disusun di berkas sendiri supaya `main.cjs` (sudah 1.400+ baris, kohesi terendah di graf) hanya bertambah satu
// pemanggilan. Aturan pintu:
//   - Alamat program DIPILIH di dialog proses utama, tidak dikirim layar.
//   - Kredensial: layar mengirim nilai sekali (S10); tak ada saluran yang mengembalikan nilainya.
//   - Menghapus server ditanyakan di dialog proses utama.
//   - Memanggil alat HANYA lewat gerbang izin K17 (`gerbangUmum.cjs`, G3) — tak ada jalan ke `sesi.panggil` langsung.

const fs = require('fs');
const path = require('path');
const { buatDaftarServer, entriDariResep } = require('./daftarServer.cjs');
const { buatBrankas } = require('./brankas.cjs');
const { semuaResep, FOLDER_BAWAAN } = require('./resep.cjs');
const { buatSesiUmum } = require('./sesiUmum.cjs');
const { buatGerbangUmum } = require('./gerbangUmum.cjs');

/**
 * @param {{ipcMain: object, dialog: object, shell: object, safeStorage: object, folderData: string,
 *   jendela: () => object, lingkungan: () => Record<string,string>, versi: string, log?: Function}} opsi
 */
function daftarkanKonektorUmum({ ipcMain, dialog, shell, safeStorage, folderData, jendela, lingkungan, versi, log = () => {} }) {
  const folderResepOwner = path.join(folderData, 'konektor-resep');
  const daftar = buatDaftarServer({ berkas: path.join(folderData, 'konektor-server.json') });
  const brankas = buatBrankas({
    berkas: path.join(folderData, 'konektor-brankas.json'),
    enkripsi: {
      tersedia: () => safeStorage.isEncryptionAvailable(),
      sandikan: (teks) => safeStorage.encryptString(teks),
      buka: (buf) => safeStorage.decryptString(buf),
    },
  });
  const sesi = buatSesiUmum({ daftar, brankas, berkasSakelar: path.join(folderData, 'konektor-umum-sakelar.json'), lingkungan, versi, log });
  const resep = () => semuaResep({ folderBawaan: FOLDER_BAWAAN, folderOwner: folderResepOwner });

  ipcMain.handle('konektor-umum:resep', () => resep());
  ipcMain.handle('konektor-umum:status', () => sesi.status());

  ipcMain.handle('konektor-umum:pasang', async (_e, { resepId } = {}) => {
    const r = resep().resep.find((x) => x.id === resepId);
    if (!r) return { ok: false, alasan: `resep ${resepId} tidak ada` };
    let program;
    if (r.jenis === 'stdio') {
      const h = await dialog.showOpenDialog(jendela(), {
        title: `Mamet — tunjuk program ${r.nama} (${r.stdio.namaProgram})`,
        properties: ['openFile'],
        filters: [{ name: r.stdio.namaProgram, extensions: ['exe'] }],
      });
      if (h.canceled || !h.filePaths?.[0]) return { ok: false, dibatalkan: true, alasan: 'dibatalkan' };
      program = h.filePaths[0];
      if (path.win32.basename(program).toLowerCase() !== r.stdio.namaProgram.toLowerCase()) {
        return { ok: false, alasan: `berkas yang dipilih bukan ${r.stdio.namaProgram}` };
      }
    }
    const v = entriDariResep(r, { program });
    if (!v.ok) return v;
    const t = daftar.tambah(v.entri);
    if (t.ok) log(`[KONEKTOR-UMUM] ${r.id} dipasang dari resep (${r.jenis})`);
    return t.ok ? { ok: true, id: t.entri.id } : t;
  });

  ipcMain.handle('konektor-umum:kredensial', async (_e, { id, kredensial, nilai } = {}) => {
    const entri = daftar.ambil(id);
    if (!entri) return { ok: false, alasan: `server ${id} tidak terpasang` };
    if (!(entri.kredensial || []).some((k) => k.id === kredensial)) return { ok: false, alasan: 'kredensial tidak diminta server ini' };
    const h = brankas.simpan(id, kredensial, nilai);
    if (!h.ok) return h;
    log(`[KONEKTOR-UMUM] ${id}: kredensial ${kredensial} ${h.terisi ? 'disimpan' : 'dihapus'}`); // tanpa nilai
    await sesi.mulaiUlang(id);
    return { ok: true, terisi: h.terisi };
  });

  // G3 — chat: alat aktif per workspace & pemanggilan LEWAT GERBANG izin K17 (dialog per alat / selama percakapan).
  const gerbang = buatGerbangUmum({
    sesi,
    namaServer: (id) => sesi.namaServer(id),
    log,
    mintaIzin: async ({ judul, rincian, tombol }) => {
      const { response } = await dialog.showMessageBox(jendela(), {
        type: 'question', title: 'Mamet — konektor', message: judul, detail: rincian,
        buttons: tombol, defaultId: 0, cancelId: 0, noLink: true,
      });
      return response;
    },
  });
  ipcMain.handle('konektor-umum:aktif', (_e, { workspace } = {}) => sesi.aktif(workspace));
  ipcMain.handle('konektor-umum:panggil', (_e, { workspace, id, alat, argumen, percakapan } = {}) =>
    gerbang.panggil(workspace, id, alat, argumen, percakapan));

  ipcMain.handle('konektor-umum:tinjau', (_e, { id } = {}) => sesi.tinjau(id));
  ipcMain.handle('konektor-umum:setujui', (_e, { id, alat } = {}) => sesi.setujui(id, alat));
  ipcMain.handle('konektor-umum:atur', (_e, { workspace, id, nyala } = {}) => sesi.atur(workspace, id, nyala));

  ipcMain.handle('konektor-umum:hapus', async (_e, { id } = {}) => {
    const entri = daftar.ambil(id);
    if (!entri) return { ok: false, alasan: `server ${id} tidak terpasang` };
    const { response } = await dialog.showMessageBox(jendela(), {
      type: 'question', title: 'Mamet — hapus konektor', message: `Hapus konektor ${entri.nama}?`,
      detail: 'Server dimatikan di semua workspace, kredensialnya dihapus dari perangkat ini, dan persetujuan alatnya hilang. Program yang Anda unduh tidak dihapus.',
      buttons: ['Batal', 'Hapus'], defaultId: 0, cancelId: 0, noLink: true,
    });
    if (response !== 1) return { ok: false, dibatalkan: true, alasan: 'dibatalkan' };
    return sesi.hapus(id);
  });

  // "Tanpa kode": Owner menaruh berkas resep sendiri di folder ini (dibuat bila belum ada).
  ipcMain.handle('konektor-umum:buka-folder-resep', async () => {
    try { fs.mkdirSync(folderResepOwner, { recursive: true }); } catch (e) { return { ok: false, alasan: e.message }; }
    const galat = await shell.openPath(folderResepOwner);
    return galat ? { ok: false, alasan: galat } : { ok: true, folder: folderResepOwner };
  });

  return { sesi, daftar, brankas, matikanSemua: () => sesi.matikanSemua(), pulihkan: () => sesi.pulihkan() };
}

module.exports = { daftarkanKonektorUmum };
