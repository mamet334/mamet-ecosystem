import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const imp = (p) => import(pathToFileURL(path.join(AKAR, p)).href);
const baca = (p) => readFileSync(path.join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');

console.log('uji-nalar-engineer v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

const esb = await import(pathToFileURL(path.join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const bundel = async (masuk, nama) => {
  const keluar = path.join(os.tmpdir(), `uji-nalar-${nama}-${Date.now()}.mjs`);
  await esb.build({
    entryPoints: [path.join(AKAR, masuk)], bundle: true, format: 'esm', platform: 'neutral', outfile: keluar, logLevel: 'error',
    plugins: [{ name: 'tiruan-supabase', setup(b) {
      b.onResolve({ filter: /(^|\/)supabase(\.js)?$/ }, () => ({ path: 'supabase', namespace: 'tiruan' }));
      b.onLoad({ filter: /.*/, namespace: 'tiruan' }, () => ({ contents: 'export const supabase = globalThis.__supabaseTiruan;', loader: 'js' }));
    } }],
  });
  return import(pathToFileURL(keluar).href);
};

const simpanan = new Map();
globalThis.localStorage = {
  getItem: (k) => (simpanan.has(k) ? simpanan.get(k) : null),
  setItem: (k, v) => simpanan.set(k, String(v)),
  removeItem: (k) => simpanan.delete(k),
  key: (i) => [...simpanan.keys()][i] ?? null,
  get length() { return simpanan.size; },
};
globalThis.__supabaseTiruan = {
  auth: { getUser: async () => ({ data: { user: { user_metadata: {} } } }), getSession: async () => ({ data: { session: null } }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }), gte: async () => ({ data: [] }) }) }),
};

const { BrainService } = await bundel('frontend/src/core/runtime/services/BrainService.js', 'brain');
const peristiwa = [];
const smBrain = { get: (n) => (n === 'EventBus' ? { emit: (nama, isi) => peristiwa.push({ nama, isi }) } : null) };
const brainBaru = async () => { const b = new BrainService(smBrain); await b.initialize(); return b; };

console.log('\n-- sakelar nalar model utama --');
{
  simpanan.clear();
  const b = await brainBaru();
  cek((await b.getActiveBrainContext()).thinking === true, 'bawaan (belum pernah diatur): model utama BERNALAR');
  cek(b.getBrainConfig().thinking === true, 'Settings membaca bawaan menyala');
  b.setTier('SEDANG', { thinking: false });
  cek((await b.getActiveBrainContext('SEDANG')).thinking === false && (await b.getActiveBrainContext()).thinking === true, 'slot tier tetap memakai sakelarnya sendiri; tanpa tier = sakelar model utama');
  b.setTier('THINKING', { thinking: true });
  b.setThinkingUtama(false);
  cek((await b.getActiveBrainContext()).thinking === false && simpanan.get('maef_ai_thinking') === '0', 'dimatikan: konteks tanpa tier tidak bernalar & tersimpan "0"');
  cek((await b.getActiveBrainContext('THINKING')).thinking === true, 'mematikan nalar utama tidak menyentuh slot tier');
  cek(peristiwa.some((p) => p.nama === 'Brain:ConfigUpdated' && p.isi.thinking === false), 'perubahan diumumkan (Brain:ConfigUpdated)');
  const b2 = await brainBaru();
  cek((await b2.getActiveBrainContext()).thinking === false, 'pilihan "mati" bertahan sesudah aplikasi dimuat ulang');
  b2.setThinkingUtama(true);
  const b3 = await brainBaru();
  cek((await b3.getActiveBrainContext()).thinking === true && simpanan.get('maef_ai_thinking') === '1', 'dinyalakan lagi: bertahan');
}

console.log('\n-- permintaan Engineer ke server membawa thinking & aliran nalar --');
{
  const { AssistantService } = await bundel('frontend/src/core/runtime/services/AssistantService.js', 'as');
  globalThis.window = {};
  const kiriman = [];
  globalThis.fetch = async (url, init) => {
    kiriman.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ message: '<think>\nrencana: ```bash\ngit push\n```\n</think>\n\nSelesai.\n```bash\ngit status\n```', processingSteps: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  simpanan.clear();
  const brain = await brainBaru();
  const layanan = { BrainService: brain, ToolPreferencesService: { getEffective: () => false } };
  const sm = { has: (n) => n in layanan, get: (n) => layanan[n] };
  const as = new AssistantService(sm);
  Object.assign(as, {
    resolveMode: () => ({ resolvedMode: 'ENGINEER', resolvedAppSource: 'engineer' }),
    _statusKonektor: async () => null, _statusFolderKerja: async () => null,
    bahanAnggaranKonteks: async () => ({ jendela: 128000, plafon: 8000 }),
    buildContextInjection: async () => ({ localContext: '', semanticContext: '' }),
    finalizeAssistantSession: async () => {},
  });
  const kirim = () => new Promise((res) => as.processMessage({ userMsg: 'cek repo', history: [], workspaceId: 'ws-engineer', token: 't', onChunk: () => {}, onDone: (t) => res(t), onError: (e) => res({ galat: e }) }));
  const akhir = await kirim();
  cek(kiriman[0]?.thinking === true && kiriman[0]?.streamNalar === true, 'Engineer bawaan: thinking=true & streamNalar=true dikirim ke server', { thinking: kiriman[0]?.thinking, streamNalar: kiriman[0]?.streamNalar });
  cek(typeof akhir === 'string' && akhir.startsWith('<think>') && akhir.includes('rencana: ```bash\ngit push\n```'), 'nalar dipertahankan apa adanya di jawaban (blok kode di nalar TIDAK diubah jadi perintah)', akhir);
  cek(/Selesai\.\n\[MAMET_CMD: git status\]/.test(akhir) && !/MAMET_CMD: git push/.test(akhir), 'blok perintah di JAWABAN tetap jadi [MAMET_CMD], yang di nalar tidak', akhir);
  brain.setThinkingUtama(false);
  kiriman.length = 0;
  await kirim();
  cek(kiriman[0]?.thinking === false && !kiriman[0]?.streamNalar, 'sakelar dimatikan: Engineer mengirim thinking=false tanpa aliran nalar', { thinking: kiriman[0]?.thinking, streamNalar: kiriman[0]?.streamNalar });
}

console.log('\n-- isi nalar tidak pernah dijalankan / disimpan sebagai perintah, patch, temuan, pengetahuan --');
{
  const F = await imp('shared/folderKerjaAlat.js');
  const t = '<think>\ncoba [MAMET_CMD: git push] dulu? tidak.\n</think>\n\nJalankan [MAMET_CMD: git status] lalu [MAMET_CMD: git log -1]';
  cek(JSON.stringify(F.perintahDariJawaban(t)) === '["git status","git log -1"]', 'perintah otomatis hanya dari jawaban, bukan dari nalar', F.perintahDariJawaban(t));
  cek(F.perintahDariJawaban('<think>\nsedang berpikir [MAMET_CMD: git push]').length === 0, 'nalar yang belum ditutup (masih mengalir) juga tidak menghasilkan perintah');
  cek(JSON.stringify(F.perintahDariJawaban('[MAMET_CMD: git diff]')) === '["git diff"]', 'tanpa nalar: perilaku lama tetap');
  cek(F.blokKodeKeMametCmd('```bash\ngit status\n```') === '[MAMET_CMD: git status]', 'blok perintah tanpa nalar tetap diubah');
  cek(F.blokKodeKeMametCmd('<think>\n```bash\nrm -rf x\n```\n</think>\n\n```bash\ngit status\n```\n<think>lagi ```bash\ngit push\n```</think>') === '<think>\n```bash\nrm -rf x\n```\n</think>\n\n[MAMET_CMD: git status]\n<think>lagi ```bash\ngit push\n```</think>', 'beberapa blok nalar: semuanya dibiarkan, hanya jawaban yang diubah');

  const U = await imp('frontend/src/core/runtime/services/engineer/UsulanPatch.js');
  const usul = U.tugasDariUsulan({ pesanAsli: 'ubah a', jawaban: '<think>\ndraf: ```json\n{"rahasia/salah.js": 1}\n```\n</think>\n\nUsulan:\n```json\n{"frontend/src/a.js": "x"}\n```' });
  cek(JSON.stringify(usul.files) === '["frontend/src/a.js"]', 'berkas sasaran patch hanya dari jawaban, bukan dari draf di nalar', usul.files);
  cek(!usul.description.includes('rahasia/salah.js') && !usul.llmProposedContent.includes('<think>'), 'usulan yang dikirim ke pembuat patch tanpa isi nalar');

  const T = await imp('frontend/src/core/runtime/services/engineer/IngatanTemuan.js');
  const tm = T.ambilBlokTemuan('<think>\n<temuan berkas="draf.js" tingkat="tinggi">\nRINGKASAN: mungkin\nBUKTI: belum\n</temuan>\n</think>\n\n<temuan berkas="a.js" tingkat="sedang">\nRINGKASAN: nyata\nBUKTI: baris 3\n</temuan>');
  cek(tm.temuan.length === 1 && tm.temuan[0].berkas === 'a.js', 'temuan yang disimpan hanya dari jawaban', tm.temuan);

  const P = await imp('frontend/src/core/runtime/services/engineer/PengetahuanBrain1.js');
  const pg = P.ambilBlokPengetahuan('<think><pengetahuan jenis="Lesson" judul="draf">x</pengetahuan></think>\n<pengetahuan jenis="Lesson" judul="asli">isi asli</pengetahuan>');
  cek(pg.pengetahuan.length === 1 && pg.pengetahuan[0].judul === 'asli', 'pengetahuan yang disimpan hanya dari jawaban', pg);
}

console.log('\n-- sambungan tampilan --');
{
  const CE = baca('frontend/src/components/workbench/ConversationEngine.jsx');
  cek((CE.match(/perintahDariJawaban\(pesanAkhir\.content\)/g) || []).length === 2 && !/content\.matchAll\(\/\\\[MAMET_CMD/.test(CE), 'pemicu perintah otomatis memakai perintahDariJawaban di kedua tempat');
  const S = baca('frontend/src/components/Settings.jsx');
  cek(/checked=\{nalarUtama\}/.test(S) && /onChange=\{\(e\) => handleNalarUtama\(e\.target\.checked\)\}/.test(S) && /brainServiceRef\?\.setThinkingUtama\?\.\(nyala\)/.test(S) && /setNalarUtama\(config\.thinking !== false\)/.test(S), 'Settings → Model AI: sakelar terhubung ke BrainService & membaca nilai tersimpan');
  const kelas = [...S.matchAll(/type="checkbox"[\s\S]*?className="([^"]+)"/g)].map((m) => m[1]);
  cek(kelas.length >= 2 && new Set(kelas).size === 1, 'kotak centang memakai kelas yang sama persis dengan sakelar tier (tak ada kelas Tailwind baru)', kelas);
}

console.log(`\n${gagal ? `GAGAL ${gagal}` : 'SEMUA LULUS'}`);
process.exit(gagal ? 1 : 0);
