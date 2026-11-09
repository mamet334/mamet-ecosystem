import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const AKAR = AKAR_REPO + '/';
const P = await import(pathToFileURL(AKAR + 'frontend/src/core/runtime/services/engineer/PatchGenerator.js').href + '?v=' + Date.now());
console.log('uji-bentuk-patch v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 320)}` : ''}`);
  if (!ok) gagal++;
};

const ALAMAT = 'frontend/src/core/runtime/services/engineer.js';

const bentukLive = {
  files: [{
    path: ALAMAT,
    changes: [{
      search: '  // [ADR-0017 Fase 7] _generatePatch diekstrak ke ./engineer/PatchGenerator.js.',
      replace: '  // [ADR-0017 Fase 7] _generateFallbackPatch DIHAPUS (T10, 2026-09-22).',
    }],
  }],
};

let r = P.bakukanBentukPatch(bentukLive);
cek(Object.keys(r).length === 1 && Object.keys(r)[0] === ALAMAT, 'bentuk "files[]" jadi berkunci alamat', Object.keys(r));
cek(r[ALAMAT].__mode === 'search_replace', '__mode dipasang supaya jalur cari-ganti mengenalinya');
cek(r[ALAMAT].changes.length === 1 && r[ALAMAT].changes[0].search.includes('ADR-0017'), 'isi perubahan dibawa apa adanya', r[ALAMAT].changes);
cek(!('files' in r), 'kunci pembungkus "files" tidak ikut terbawa jadi "berkas" palsu');

r = P.bakukanBentukPatch({ files: [
  { path: ALAMAT, changes: [{ search: 'a', replace: 'A' }] },
  { path: ALAMAT, changes: [{ search: 'b', replace: 'B' }] },
] });
cek(r[ALAMAT].changes.length === 2, 'alamat kembar: perubahan digabung, tidak ada yang hilang', r[ALAMAT].changes);

r = P.bakukanBentukPatch({ files: [{ path: ALAMAT, changes: [{ search: 'a', replace: 'A' }] }], 'lain.js': 'isi utuh' });
cek(r['lain.js'] === 'isi utuh', 'bentuk campuran: kunci beralamat lain tidak dibuang');

const sudahBenar = { [ALAMAT]: { __mode: 'search_replace', changes: [{ search: 'x', replace: 'y' }] } };
cek(P.bakukanBentukPatch(sudahBenar) === sudahBenar, 'KENDALI: bentuk yang sudah benar dikembalikan apa adanya (tanpa disalin ulang)');
const stringBiasa = { [ALAMAT]: 'isi berkas lengkap' };
cek(P.bakukanBentukPatch(stringBiasa) === stringBiasa, 'KENDALI: bentuk string biasa tidak disentuh');

const asing = { files: [{ berkas: 'salah', ubah: [] }] };
cek(P.bakukanBentukPatch(asing) === asing, 'KENDALI: "files[]" tanpa path/changes tidak diterka — dikembalikan apa adanya supaya gagal terang', P.bakukanBentukPatch(asing));
cek(P.bakukanBentukPatch({ files: [] }).files.length === 0, 'KENDALI: daftar kosong tidak jadi objek kosong yang menyesatkan');
cek(P.bakukanBentukPatch(null) === null && P.bakukanBentukPatch(undefined) === undefined, 'KENDALI: masukan kosong tidak meledak');
cek(P.bakukanBentukPatch('bukan objek') === 'bukan objek', 'KENDALI: bukan objek tidak disentuh');

const SRC = readFileSync(AKAR + 'frontend/src/core/runtime/services/engineer/PatchGenerator.js', 'utf8');
cek(/generatedCode = bakukanBentukPatch\(generatedCode\);/.test(SRC), 'pembakuan dipanggil SEBELUM perakitan berkas patch');
const iBaku = SRC.indexOf('generatedCode = bakukanBentukPatch');
const iLoop = SRC.indexOf('for (const [filePath, newContent] of Object.entries(generatedCode', iBaku - 400);
cek(iBaku > 0 && iBaku < iLoop, 'urutannya benar: dibakukan dulu, baru dirakit', { iBaku, iLoop });
cek(/patchFiles\.length === 0 && rawLLMResponse/.test(SRC), 'kegagalan tanpa galat model dikenali sebagai keadaan tersendiri');
cek(/Kunci JSON yang diterima/.test(SRC), 'pesan gagal menyebut kunci JSON yang benar-benar diterima');
cek(/Yang diminta/.test(SRC), 'pesan gagal menyebut bentuk yang seharusnya');

const ENG = readFileSync(AKAR + 'frontend/src/core/runtime/services/engineer.js', 'utf8');
const iPesan = ENG.indexOf('patch.llmError');
const baris = ENG.slice(iPesan - 120, iPesan + 220);
cek(/patch\.llmError \|\| patch\.error \|\| patch\.description/.test(baris),
  'urutan pesan: galat model → galat bentuk → baru deskripsi tugas', baris);

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
