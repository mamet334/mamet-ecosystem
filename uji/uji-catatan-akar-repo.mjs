
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
const P = await import(pathToFileURL(AKAR + '/frontend/src/core/runtime/services/engineer/ProsedurEngineer.js').href + '?v=' + Date.now());

console.log('uji-catatan-akar-repo v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

console.log('\n-- isi catatan --');
const REPO = 'D:\\SLAMET\\other\\mamet os ecosystem';
const c = P.catatanAkarRepo(REPO);

cek(c.includes(REPO), 'menyebut alamat akar repo apa adanya', c);
cek(/direktori kerja/i.test(c), 'menjelaskan bahwa itu direktori kerja perintah');
cek(/MAMET_CMD/.test(c), 'mengaitkannya dengan perintah [MAMET_CMD: …] yang memang dijalankan di sana');
cek(/RELATIF/i.test(c), 'menyuruh memakai alamat relatif');
cek(/JANGAN menelusuri filesystem/i.test(c),
  'melarang menelusuri filesystem — persis jalan memutar yang ditempuh model 28 Sep', c);
cek(/git ls-files/.test(c) && /git grep/.test(c),
  'memberi GANTI cara, bukan sekadar larangan (prosedur langkah 0.4)', c);

console.log('\n-- kapan diam --');
for (const kosong of ['', '   ', null, undefined, 0, false]) {
  cek(P.catatanAkarRepo(kosong) === '', `akar kosong (${JSON.stringify(kosong)}) → catatan kosong`);
}

console.log('\n-- terpasang di ConversationEngine --');
const CE = readFileSync(AKAR + '/frontend/src/components/workbench/ConversationEngine.jsx', 'utf8');

cek(/import \{[^}]*catatanAkarRepo[^}]*\} from '\.\.\/\.\.\/core\/runtime\/services\/engineer\/ProsedurEngineer\.js'/.test(CE),
  'catatanAkarRepo diimpor komponen');
cek(/const catatanAkar = catatanAkarRepo\(akarRepoSekarang\)/.test(CE), 'dipanggil di handleSend');
cek(/engineer\?\.akarRepo\?\.\(\)/.test(CE), 'akarnya dibaca dari proses utama, bukan ditebak layar');

const iSisipan = CE.indexOf('const sisipan = [catatanAkar,');
cek(iSisipan > 0, 'catatan akar repo digabung ke sisipan', (CE.match(/const sisipan = [^\n]*/g) || []));
cek(/const sisipan = \[catatanAkar,[^\]]*ringkasanTemuan\]/.test(CE), 'ringkasan temuan tetap ikut di sisipan yang sama');
const iHistory = CE.indexOf('const historyKirim = sisipan.length');
cek(iHistory > iSisipan, 'sisipan dipakai menyusun historyKirim');
cek(/history: historyKirim/.test(CE), 'historyKirim itu yang benar-benar dikirim ke server');

const iAkar = CE.indexOf('const akarRepoSekarang = isEngineerWorkspace');
cek(iAkar > 0, 'hanya disisipkan di workspace Engineer');

const blokKirim = CE.slice(CE.indexOf('const handleSend'), CE.indexOf('history: historyKirim'));
cek(blokKirim.includes('akarRepo?.()'), 'dibaca di dalam handleSend (tiap kiriman), bukan sekali saat komponen dimuat');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
