
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const AKAR = AKAR_REPO;
const baca = (p) => readFileSync(`${AKAR}/${p}`, 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-engineer-tak-jatuh v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const AS = tanpaKomentar(baca('frontend/src/core/runtime/services/AssistantService.js'));
const CE = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));

console.log('\n-- penjaga di hulu (classifier) --');
{
  const K = await import(pathToFileURL(`${AKAR}/frontend/src/core/runtime/services/RequestClassifierService.js`).href + '?v=' + Date.now())
    .then((m) => m, () => null);
  const Svc = K && (K.RequestClassifierService || K.default);
  if (!Svc) {
    cek(false, 'RequestClassifierService bisa diimpor');
  } else {
    const c = new Svc({ get: (n) => (n === 'EventBus' ? { emit: () => {} } : null), has: () => false });
    for (const tanya of ['apa itu RLS?', 'berapa baris main.cjs?', 'siapa penulis berkas ini?']) {
      const hasil = c.classify(tanya, [], 'ENGINEER');
      cek(hasil?.type === 'ENGINEER', `"${tanya}" di mode ENGINEER → type ENGINEER, bukan LOOKUP`, hasil);
    }
    const assistant = c.classify('apa itu RLS?', [], 'ASSISTANT');
    cek(assistant?.type !== 'ENGINEER', 'mode ASSISTANT tidak ikut dipaksa ke ENGINEER', assistant);
  }
}

console.log('\n-- penjaga di dispatch --');

cek(/const jalurRinganTerlarang = resolvedMode === 'ENGINEER';/.test(AS),
  'penjaga dinyatakan sekali, dari resolvedMode');

for (const [jenis, pola] of [
  ['LOOKUP', /if \(requestType === 'LOOKUP' && !jalurRinganTerlarang\)/],
  ['MEMORY_STORE', /if \(requestType === 'MEMORY_STORE' && !jalurRinganTerlarang\)/],
  ['DOC_CONVERT', /if \(requestType === 'DOC_CONVERT' && !jalurRinganTerlarang\)/],
  ['SKILL', /if \(requestType === 'SKILL' && !jalurRinganTerlarang\)/],
]) {
  cek(pola.test(AS), `jalur ${jenis} dijaga`, (AS.match(new RegExp(`.*requestType === '${jenis}'.*`)) || []));
}

const cabang = AS.match(/if \(requestType === '[A-Z_]+'[^)]*\)/g) || [];
const tanpaPenjaga = cabang.filter((b) => !/jalurRinganTerlarang/.test(b));
cek(tanpaPenjaga.length === 0, 'TIDAK ADA cabang jalur ringan yang terlewat', tanpaPenjaga);

const iDispatch = AS.indexOf('const jalurRinganTerlarang');
const iConv = AS.indexOf('return this._handleConversation(handlerParams);');
cek(iConv > iDispatch, 'sesudah penjaga, alirannya tetap sampai ke _handleConversation', { iDispatch, iConv });

console.log('\n-- satu sumber kebenaran --');

cek(/workspaceId: isEngineerWorkspace \? 'ws-engineer' :/.test(CE),
  'kiriman memakai penanda yang SAMA dengan yang dipakai layar', (CE.match(/.*workspaceId: .*/g) || []));
cek(/const isEngineerWorkspace = osState\?\.workspaceId === 'ws-engineer';/.test(CE),
  'dan penanda layar itu sendiri tidak berubah');

cek(/workspaceId === 'ws-engineer' \|\| workspaceId === 'ENGINEER'/.test(AS),
  "resolveMode mengenali 'ws-engineer'", (AS.match(/.*ws-engineer.*/g) || []));

console.log('\n-- jalur ringan tetap hidup untuk yang lain --');

cek(/getActiveBrainContext\('KECIL'\)/.test(AS), '_handleLookup masih memakai tier ringan');
cek(/history: konteksLookup\.dikirim\.map\(pesanUntukServer\)/.test(AS) && /pilihPesanKonteks\(history, \{ anggaranToken: angLookup\.token \}\)/.test(AS), '_handleLookup memilih riwayat lewat anggaran Settings');
cek(/mode: 'LOOKUP',/.test(AS), "_handleLookup masih mengirim mode 'LOOKUP'");

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
