
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const AKAR = AKAR_REPO;
const baca = (p) => readFileSync(`${AKAR}/${p}`, 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-hentikan-kiriman v2');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const CE = baca('frontend/src/components/workbench/ConversationEngine.jsx');
const AS = baca('frontend/src/core/runtime/services/AssistantService.js');
const CE_KODE = tanpaKomentar(CE);
const AS_KODE = tanpaKomentar(AS);

console.log('\n-- dibatalkan bukan gagal --');

const S = await import(pathToFileURL(`${AKAR}/frontend/src/core/runtime/services/pembatalan.js`).href + '?v=' + Date.now())
  .then((m) => m, () => null);

if (!S?.dibatalkanPemakai) {
  cek(false, 'dibatalkanPemakai bisa diimpor dari pembatalan.js');
} else {
  const f = S.dibatalkanPemakai;
  cek(f({ name: 'AbortError' }, null) === true, 'AbortError dikenali sebagai pembatalan');
  cek(f({ name: 'TypeError', message: 'Failed to fetch' }, null) === false,
    'kegagalan jaringan sungguhan TIDAK ditelan diam-diam — itu wajib tetap dilaporkan');
  cek(f({ name: 'TypeError' }, { aborted: true }) === true,
    'signal.aborted menang atas nama galat — pemutusan di sela aliran tak selalu bernama AbortError');
  cek(f(null, null) === false, 'tanpa galat & tanpa signal → bukan pembatalan');
}

cek(/import \{ dibatalkanPemakai \} from '\.\/pembatalan\.js';/.test(AS_KODE),
  'AssistantService benar-benar memakai modul itu', (AS_KODE.match(/.*pembatalan.*/g) || []));

console.log('\n-- signal sampai ke tiap fetch --');

const fetchSemua = AS_KODE.match(/await fetch\(AGENT_ENDPOINT[^\n]*/g) || [];
cek(fetchSemua.length >= 3, `ketiga jalur fetch terbaca (${fetchSemua.length})`, fetchSemua);
cek(fetchSemua.every((b) => /\bsignal\b/.test(b)),
  'TIDAK ADA fetch yang tertinggal tanpa signal', fetchSemua.filter((b) => !/\bsignal\b/.test(b)));

console.log('\n-- putaran alat ikut berhenti --');

const rekursi = [];
for (let i = AS_KODE.indexOf('this.processMessage({'); i >= 0; i = AS_KODE.indexOf('this.processMessage({', i + 1)) {
  const tutup = AS_KODE.indexOf('});', i);
  rekursi.push(AS_KODE.slice(i, tutup > 0 ? tutup : i + 800));
}
cek(rekursi.length >= 2, `panggilan processMessage berulang terbaca (${rekursi.length})`, rekursi.length);
cek(rekursi.length >= 2 && rekursi.every((b) => /\bsignal\b/.test(b)),
  'tiap putaran alat membawa signal yang sama', rekursi.filter((b) => !/\bsignal\b/.test(b)).map((b) => b.slice(0, 160)));

cek(/if \(signal\?\.aborted\) return;/.test(AS_KODE), 'ada penjaga di pintu masuk processMessage');
const iJaga = AS_KODE.indexOf('if (signal?.aborted) return;');
const iKirim = AS_KODE.indexOf("console.log('[LIFECYCLE] Chat request sent')");
cek(iJaga > 0 && iKirim > 0 && iJaga < iKirim,
  'penjaganya SEBELUM pekerjaan berbayar dimulai, bukan sesudah');

console.log('\n-- pembaca aliran --');

cek(/_bacaAliranHybrid\(response, \{ onNalar, onError, signal \}\)/.test(AS_KODE),
  'signal diteruskan ke pembaca aliran');
const iBaca = AS_KODE.indexOf('async _bacaAliranHybrid');
const blokBaca = AS_KODE.slice(iBaca, iBaca + 2000);
cek(/catch \(bacaErr\) \{\s*if \(dibatalkanPemakai\(bacaErr, signal\)\) return null;/.test(blokBaca),
  'pemutusan di tengah aliran ditangkap, bukan jadi "Aliran jawaban terputus"');
cek(/throw bacaErr;/.test(blokBaca),
  'galat aliran yang BUKAN pembatalan tetap dilempar — jangan ditelan');

console.log('\n-- layar --');

cek(/const kendaliKirimRef = (?:useRef\(null\)|useRefTersimpan\(kunciSesi, '[a-zA-Z]+', null\))/.test(CE_KODE),
  'kendali disimpan di ref, bukan state');
cek(!/\[\s*kendaliKirim\w*\s*,\s*set\w+\s*\]\s*=\s*(?:useState|useKeadaanTersimpan)\(/.test(CE_KODE),
  'kendali TIDAK pernah dijadikan keadaan yang memicu render');
cek(/signal: kendali\.signal,/.test(CE_KODE), 'signal ikut ke processMessage');
cek(/kendaliKirimRef\.current\?\.abort\(\);/.test(CE_KODE),
  'kiriman lama yang menggantung diputus sebelum kendalinya tertimpa');

cek(/isLoading \? \(/.test(CE_KODE), 'tombol kirim berganti jadi Berhenti selama menunggu');
cek(/onClick=\{hentikanKirim\}/.test(CE_KODE), 'tombolnya memanggil hentikanKirim');
cek(/type="button"/.test(CE_KODE), 'tombol Berhenti bukan submit — kalau submit ia malah mengirim ulang');

const subset = new Set(
  baca('frontend/src/assets/fonts/daftar-ikon.txt').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#')),
);
const iTombol = CE_KODE.indexOf('onClick={hentikanKirim}');
const ikon = (CE_KODE.slice(iTombol, iTombol + 400).match(/material-symbols-outlined[^>]*>\s*([a-z0-9_]+)\s*</) || [])[1];
cek(!!ikon && subset.has(ikon), `ikon tombol Berhenti ("${ikon}") ada di subset font`, [...subset].slice(0, 10));

const iHenti = CE_KODE.indexOf('const hentikanKirim');
const blokHenti = CE_KODE.slice(iHenti, iHenti + 900);
cek(/setIsLoading\(false\)/.test(blokHenti), 'kotak kirim dibuka kembali');
cek(/tetap terhitung biayanya|tetap diselesaikan/.test(blokHenti),
  'pesannya JUJUR: server tetap menyelesaikan & menagih, yang berhenti adalah menunggunya', blokHenti.slice(-260));

cek(/if \(kendali\.signal\.aborted\) \{/.test(CE_KODE),
  'catch handleSend membedakan dibatalkan dari galat');

cek(/if \(kendaliKirimRef\.current === kendali\) kendaliKirimRef\.current = null;/.test(CE_KODE),
  'kendali kiriman baru tidak ikut terlucuti saat kiriman lama selesai');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
