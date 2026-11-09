import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';
const C = await import(pathToFileURL(AKAR_REPO + '/frontend/src/core/runtime/services/engineer/CatatanPatch.js').href + '?v=' + Date.now());
console.log('uji-catatan-patch v1');
let gagal = 0; const cek = (ok, pesan, rinci) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      → ${JSON.stringify(rinci).slice(0, 300)}` : ''}`); if (!ok) gagal++; };
const ls = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

let s = ls();
C.simpanCatatanPatch({ patchId: 'P1', checkpointRef: 'CP1', files: [{ path: 'a.js', newContent: 'x\ny\n' }] }, s);
let lap = await C.laporanSetelahMuatUlang(async () => 'x\r\ny\r\n', s);
cek(lap && /Patch diterapkan/.test(lap.pesan) && /✅ `a.js`/.test(lap.pesan) && lap.checkpointRef === 'CP1', 'isi disk sesuai → "Patch diterapkan" + checkpoint untuk Undo', lap);
cek(s.getItem('mamet:patchBerjalan') === null, 'catatan dihapus setelah dilaporkan (tak muncul dua kali)');

s = ls();
C.simpanCatatanPatch({ patchId: 'P2', checkpointRef: 'CP2', files: [{ path: 'a.js', newContent: 'BARU' }, { path: 'b.js', newContent: 'B' }] }, s);
lap = await C.laporanSetelahMuatUlang(async (p) => (p === 'a.js' ? 'LAMA' : 'B'), s);
cek(/belum pasti/.test(lap.pesan) && /⚠️ `a.js`/.test(lap.pesan) && /✅ `b.js`/.test(lap.pesan), 'isi disk tak sesuai → "belum pasti", per berkas apa adanya', lap.pesan);

cek(await C.laporanSetelahMuatUlang(async () => '', ls()) === null, 'tanpa catatan → tidak ada laporan');
s = ls();
C.simpanCatatanPatch({ patchId: 'P3', files: [{ path: 'a.js', newContent: 'x' }] }, s);
cek(await C.laporanSetelahMuatUlang(async () => 'x', s, Date.now() + 16 * 60 * 1000) === null, 'catatan lebih dari 15 menit → diabaikan');
s = ls();
C.simpanCatatanPatch({ patchId: 'P4', files: [{ path: 'a.js', newContent: 'x' }] }, s);
C.hapusCatatanPatch(s);
cek(await C.laporanSetelahMuatUlang(async () => 'x', s) === null, 'selesai tanpa muat ulang → catatan dihapus, tak ada laporan ganda');

s = ls();
C.simpanCatatanPatch({ patchId: 'P5', files: [{ path: 'besar.js', newContent: 'x'.repeat(300 * 1024) }] }, s);
lap = await C.laporanSetelahMuatUlang(async () => 'apa pun', s);
cek(/belum pasti/.test(lap.pesan) && /❔/.test(lap.pesan), 'berkas >200 KB → "tak bisa dipastikan", bukan klaim berhasil', lap.pesan);

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
