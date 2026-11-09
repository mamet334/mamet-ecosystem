
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(AKAR, 'frontend', 'package.json'));
const K = path.join(AKAR, 'frontend', 'electron', 'konektor');
const { daftarkanKonektorUmum } = require(path.join(K, 'ipcUmum.cjs'));
const { bacaFolderResep, FOLDER_BAWAAN } = require(path.join(K, 'resep.cjs'));
const { lingkunganServer } = require(path.join(AKAR, 'frontend', 'electron', 'konektorMcp.cjs'));
const { mulai } = require(path.join(AKAR, 'uji', 'lib', 'serverOAuthTiruan.cjs'));
const M = await import(pathToFileURL(path.join(AKAR, 'frontend', 'src', 'components', 'konektor', 'menuKonektor.js')).href);
const baca = (p) => readFileSync(path.join(AKAR, p), 'utf8');

console.log('uji-konektor-oauth-f2 v2');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 600)}` : ''}`);
  if (!ok) gagal++;
};

console.log('\n-- 1. resep --');
const bawaan = bacaFolderResep(FOLDER_BAWAAN);
const notion = bawaan.resep.find((r) => r.id === 'notion');
cek(bawaan.galat.length === 0 && notion?.oauth === true && notion.jenis === 'http' && notion.http.url === 'https://mcp.notion.com/mcp' && notion.kredensial.length === 0,
  'resep Notion bawaan: server resmi, OAuth, tanpa token ketik', notion);
cek(/alat baca/.test(notion?.petunjuk || '') && /Putuskan/.test(notion?.petunjuk || ''), 'petunjuk menyebut alat baca & cara mencabut');

console.log('\n-- 2. ipc --');
const srv = await mulai();
const folderData = mkdtempSync(path.join(os.tmpdir(), 'mamet-f2-'));
mkdirSync(path.join(folderData, 'konektor-resep'), { recursive: true });
writeFileSync(path.join(folderData, 'konektor-resep', 'notion-uji.json'),
  JSON.stringify({ id: 'notion-uji', nama: 'Notion uji', jenis: 'http', http: { url: srv.url }, oauth: true }));

const saluran = new Map();
let jawabDialog = 1;
const dialogDitanya = [];
const dibuka = [];
const ipcMain = { handle: (nama, f) => saluran.set(nama, f) };
const dialog = {
  showMessageBox: async (_w, o) => { dialogDitanya.push(o.message); return { response: jawabDialog }; },
  showOpenDialog: async () => { throw new Error('server http tidak boleh meminta program'); },
};
const shell = {
  openExternal: async (url) => {
    dibuka.push(url);
    const r = await fetch(url, { redirect: 'manual' });
    const tujuan = r.headers.get('location');
    if (tujuan) await fetch(tujuan);
  },
  openPath: async () => '',
};
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (t) => Buffer.from(`SANDI:${[...t].reverse().join('')}`),
  decryptString: (b) => [...b.toString().slice(6)].reverse().join(''),
};
const log = [];
const pintu = daftarkanKonektorUmum({ ipcMain, dialog, shell, safeStorage, folderData, jendela: () => null, lingkungan: () => lingkunganServer(), versi: 'uji', log: (m) => log.push(m) });
const panggil = (nama, arg) => saluran.get(nama)({}, arg);
const status = async () => (await panggil('konektor-umum:status')).find((s) => s.id === 'notion-uji');

try {
  cek(['konektor-umum:hubungkan', 'konektor-umum:putuskan'].every((n) => saluran.has(n)), 'saluran hubungkan & putuskan terdaftar');
  const resep = await panggil('konektor-umum:resep');
  cek(resep.resep.some((r) => r.id === 'notion') && resep.resep.some((r) => r.id === 'notion-uji' && r.asal === 'owner'), 'resep: Notion bawaan + resep Owner (tanpa kode)');
  let h = await panggil('konektor-umum:pasang', { resepId: 'notion-uji' });
  cek(h.ok, 'Pasang server OAuth: tanpa dialog program, tanpa token', h);
  let s = await status();
  cek(s.oauth === true && s.terhubung === false && s.kredensial.length === 0, 'status layar: OAuth, belum terhubung', s);
  h = await panggil('konektor-umum:kredensial', { id: 'notion-uji', kredensial: 'oauth-token', nilai: 'palsu' });
  cek(!h.ok, 'kolom kredensial TIDAK bisa menulis token OAuth', h);
  h = await panggil('konektor-umum:atur', { workspace: 'ws-assistant', id: 'notion-uji', nyala: true });
  cek(!h.ok && h.status === 'belum_terhubung', 'menyalakan sebelum terhubung → "belum terhubung"', h);

  h = await panggil('konektor-umum:hubungkan', { id: 'notion-uji' });
  s = await status();
  cek(h.ok && s.terhubung === true && dibuka.length === 1 && new URL(dibuka[0]).origin === srv.base, 'Hubungkan akun: browser sistem SEKALI ke halaman login server itu → terhubung', { h, dibuka });
  cek(!JSON.stringify(s).match(/at_[0-9a-f]{6}|rt_[0-9a-f]{6}/), 'status layar tidak memuat token');
  const t = await panggil('konektor-umum:tinjau', { id: 'notion-uji' });
  cek(t.ok && t.alat.length === 2, 'Tinjau alat lewat akun terhubung', t);
  const ta = Object.fromEntries(t.alat.map((a) => [a.nama, a]));
  cek(ta.cari_halaman.bacaSaja === true && ta.cari_halaman.merusak === false && ta.tulis_halaman.bacaSaja === false && ta.tulis_halaman.merusak === true,
    'tinjau membawa penanda server: baca / bisa menghapus (untuk tombol "Tandai alat baca")', t.alat);
  await panggil('konektor-umum:setujui', { id: 'notion-uji', alat: ['cari_halaman'] });
  s = await status();
  cek(s.ws['ws-assistant'].status === 'nyala' && s.ws['ws-assistant'].alat.join() === 'cari_halaman', 'sesudah disetujui, sakelar Assistant yang tadi dinyalakan langsung menyala', s.ws);
  const aktif = await panggil('konektor-umum:aktif', { workspace: 'ws-assistant' });
  cek(aktif.length === 1 && aktif[0].alat.map((a) => a.name).join() === 'cari_halaman', 'alat untuk chat = alat yang disetujui');
  jawabDialog = 1;
  h = await panggil('konektor-umum:panggil', { workspace: 'ws-assistant', id: 'notion-uji', alat: 'cari_halaman', argumen: { kueri: 'x' }, percakapan: 'chat-1' });
  cek(h.ok && /hasil cari_halaman/.test(h.teks) && /izinkan "cari_halaman"/.test(dialogDitanya.at(-1)), 'panggil lewat gerbang izin (dialog) dengan token OAuth', h);

  jawabDialog = 0;
  h = await panggil('konektor-umum:putuskan', { id: 'notion-uji' });
  s = await status();
  cek(!h.ok && h.dibatalkan && s.terhubung === true && srv.keadaan.dicabut.length === 0, 'Putuskan → Batal: tetap terhubung, tak ada yang dicabut');
  jawabDialog = 1;
  h = await panggil('konektor-umum:putuskan', { id: 'notion-uji' });
  s = await status();
  cek(h.ok && h.dicabut === true && s.terhubung === false && srv.keadaan.dicabut.length === 1 && s.ws['ws-assistant'].status !== 'nyala',
    'Putuskan → ya: dicabut di server, token hilang, server dimatikan', { h, s: s.ws });
  cek(s.alatDisetujui.join() === 'cari_halaman', 'persetujuan alat tetap tersimpan sesudah Putuskan (sesuai teks dialog)');

  h = await panggil('konektor-umum:hubungkan', { id: 'notion-uji' });
  s = await status();
  cek(h.ok && s.ws['ws-assistant'].status === 'nyala', 'hubungkan ulang → server yang sakelarnya menyala langsung menyala lagi (tanpa menekan sakelar)', s.ws);
  const dicabutSebelum = srv.keadaan.dicabut.length;
  jawabDialog = 1;
  h = await panggil('konektor-umum:hapus', { id: 'notion-uji' });
  cek(h.ok && srv.keadaan.dicabut.length === dicabutSebelum + 1 && !(await status()), 'Hapus konektor OAuth → izin DICABUT di server dulu, lalu dihapus', h);
  cek(!log.some((m) => /at_[0-9a-f]{6}|rt_[0-9a-f]{6}|kode_[0-9a-f]{6}/.test(m)), 'log tanpa token/kode');
} finally {
  await pintu.matikanSemua();
  await srv.tutup();
}

console.log('\n-- 3. menu --');
const dasar = { id: 'notion', nama: 'Notion', oauth: true, kredensial: [], alatDisetujui: ['cari'], ws: { 'ws-assistant': { diaktifkan: false, status: 'mati', alat: [] } } };
let d = M.susunMenuKonektor([], [{ ...dasar, terhubung: false }], 'ws-assistant')[0];
cek(!d.siap && /akun belum dihubungkan/.test(d.keterangan), 'menu: akun belum terhubung → belum siap', d);
d = M.susunMenuKonektor([], [{ ...dasar, terhubung: true }], 'ws-assistant')[0];
cek(d.siap && d.keterangan === 'mati', 'menu: terhubung & alat disetujui → siap', d);
d = M.susunMenuKonektor([], [{ ...dasar, terhubung: true, ws: { 'ws-assistant': { diaktifkan: true, status: 'perlu_hubungkan_ulang', alat: [] } } }], 'ws-assistant');
cek(/login kedaluwarsa/.test(d[0].keterangan) && M.penandaKonektor(d) === 'masalah', 'menu: login kedaluwarsa → keterangan + titik merah', d[0]);

console.log('\n-- 4. layar --');
const KS = baca('frontend/src/components/konektor/KartuServerUmum.jsx');
const PRE = baca('frontend/electron/preload.cjs');
cek(/hubungkan: \(id\) => ipcRenderer\.invoke\('konektor-umum:hubungkan'/.test(PRE) && /putuskan: \(id\) => ipcRenderer\.invoke\('konektor-umum:putuskan'/.test(PRE), 'preload: hubungkan & putuskan');
cek(/\{s\.oauth && \(\s*<BagianAkun/.test(KS) && /'Hubungkan akun'/.test(KS) && /Putuskan/.test(KS), 'kartu: bagian Akun untuk server OAuth');
cek(/const aksesSiap = s\.kredensial\.every\(\(k\) => k\.terisi\) && \(!s\.oauth \|\| s\.terhubung === true\);/.test(KS) && /disabled=\{sedangTinjau \|\| !aksesSiap\}/.test(KS),
  'Tinjau & sakelar menunggu akun terhubung');
cek(/'belum_terhubung'/.test(KS) && /'perlu_hubungkan_ulang'/.test(KS), 'teks status untuk belum terhubung & login kedaluwarsa');
cek(/shell\.openExternal\(url\)/.test(baca('frontend/electron/konektor/ipcUmum.cjs')), 'login dibuka di browser SISTEM, bukan jendela Mamet');
const TA = baca('frontend/src/components/konektor/TinjauAlat.jsx');
cek(/setPilih\(new Set\(alat\.map\(\(a\) => a\.nama\)\)\)/.test(TA) && /setPilih\(new Set\(\)\)/.test(TA) && /setPilih\(new Set\(alatBaca\.map\(\(a\) => a\.nama\)\)\)/.test(TA),
  'Tinjau alat: Tandai semua · Kosongkan · Tandai alat baca');
cek(/perkiraanBlokKonektor\(\{ id: 'perkiraan', alat: terpilih \}\)/.test(TA) && /token tambahan di SETIAP pesan/.test(TA) && /lewatBatas/.test(TA),
  'Tinjau alat: perkiraan beban prompt dari fungsi blok server + peringatan lewat batas');
cek(!/dangerouslySetInnerHTML\s*=/.test(TA) && /onSetujui\(\[\.\.\.pilih\]\)/.test(TA), 'tetap teks biasa; yang dikirim ke proses utama hanya NAMA alat');

const postcss = require('postcss'), tailwind = require('tailwindcss'), loadConfig = require('tailwindcss/loadConfig');
const escTW = require('tailwindcss/lib/util/escapeClassName').default;
const kelas = [...new Set([...KS.matchAll(/className=\{?[`"]([^`"]+)[`"]/g)].flatMap((m) => m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/))
  .filter((k) => /^[a-z!\-[\]0-9/:.%]+$/i.test(k)))];
const { css } = await postcss([tailwind({ ...loadConfig(path.join(AKAR, 'frontend', 'tailwind.config.js')),
  content: [{ raw: `<div className="${kelas.join(' ')}">`, extension: 'jsx' }] })]).process('@tailwind utilities;', { from: undefined });
const dibuat = (k) => ['.' + escTW(k) + ' ', '.' + escTW(k) + '{', '.' + escTW(k) + ':'].some((x) => css.includes(x));
const takDibuat = kelas.filter((k) => !dibuat(k));
cek(kelas.length >= 25 && takDibuat.length === 0, `${kelas.length} kelas kartu konektor benar-benar dibuat Tailwind`, takDibuat);

console.log(`\n${gagal ? `GAGAL ${gagal}` : 'SEMUA LULUS'}`);
process.exit(gagal ? 1 : 0);
