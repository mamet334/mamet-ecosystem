import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const AKAR = AKAR_REPO + '/';
const T = await import(pathToFileURL(AKAR + 'frontend/src/core/runtime/services/engineer/IngatanTemuan.js').href + '?v=' + Date.now());
console.log('uji-petunjuk-tombol-temuan v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 320)}` : ''}`);
  if (!ok) gagal++;
};

const baru = T.gabungTemuan([], [{ berkas: 'a.js', tingkat: 'rendah', ringkasan: 'satu', bukti: 'b' }]).baru;
const lap = T.laporanTemuan({ baru, kembar: [], pernahDitutup: [], galat: [] });

cek(/bilah atas/.test(lap), 'laporan menyebut TEMPAT tombolnya (bilah atas)', lap);
cek(/meteran konteks/.test(lap), 'disebut patokan yang mudah dikenali di sebelahnya', lap);
cek(/Simpan 1 temuan/.test(lap), 'nama tombol di laporan SAMA PERSIS dengan tulisan di tombolnya', lap);
cek(/belum tersimpan/.test(lap), 'tetap jelas bahwa temuannya belum ditulis ke disk');

const CE = readFileSync(AKAR + 'frontend/src/components/workbench/ConversationEngine.jsx', 'utf8');
cek(/Simpan \{temuanBelumSimpan\.length\} temuan/.test(CE),
  'tombol di layar memang bertuliskan "Simpan <n> temuan"', CE.match(/Simpan \{[^}]*\} temuan/)?.[0]);

const tiga = T.gabungTemuan([], [
  { berkas: 'a.js', tingkat: 'rendah', ringkasan: 'satu', bukti: 'b' },
  { berkas: 'b.js', tingkat: 'rendah', ringkasan: 'dua', bukti: 'b' },
  { berkas: 'c.js', tingkat: 'rendah', ringkasan: 'tiga', bukti: 'b' },
]).baru;
cek(/Simpan 3 temuan/.test(T.laporanTemuan({ baru: tiga, kembar: [], pernahDitutup: [], galat: [] })),
  'jumlah di petunjuk mengikuti jumlah temuan, bukan angka tetap');

const lapKembar = T.laporanTemuan({ baru: [], kembar: baru, pernahDitutup: [], galat: [] });
cek(!/bilah atas/.test(lapKembar) && !/Simpan/.test(lapKembar),
  'KENDALI: tanpa temuan baru, Owner tidak disuruh mencari tombol yang memang tidak ada', lapKembar);

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
