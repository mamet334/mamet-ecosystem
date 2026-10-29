// UJI 2026-10-29 — T15 ditutup: server `agent-process` tidak lagi mengimpor kode klien dari `frontend/src`.
//
// T15 (18 Okt): 9 titik impor server menjangkau `frontend/src/core/runtime/services/` dan menarik 5 modul klien ke edge
// function — mengubah berkas klien diam-diam mengubah perilaku server, dan baru berlaku sesudah deploy ulang. Arah
// (ADR-0021 #6): modul yang dipakai dua sisi tinggal di folder netral `shared/`. 28 Okt modul pertama
// (`kueri_pencarian.js`) terbukti dimuat Deno, Vite, dan ikut ter-deploy. 29 Okt kelima modul T15 dipindah (`git mv`,
// isi tak berubah): folderKerjaAlat, konektorAlat, dataTabelAsnSaring, KnowledgeService, RetrievalStrategyService.
//
// Yang dijaga supaya pola lama tak kembali diam-diam:
//   1. tak satu pun berkas server mengimpor dari `frontend/` (impor statis maupun dinamis);
//   2. kelima modul hanya ada di `shared/` — tak ada salinan di `frontend/src`;
//   3. setiap impor ke `shared/` (server & klien) menunjuk berkas yang ada;
//   4. modul di `shared/` murni: tanpa impor (jadi tak bisa menarik kode klien/server lewat pintu belakang);
//   5. bundel esbuild agent-process benar-benar membawa modul dari `shared/` dan tak satu pun dari `frontend/`.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MODUL = ['folderKerjaAlat', 'konektorAlat', 'dataTabelAsnSaring', 'KnowledgeService', 'RetrievalStrategyService', 'kueri_pencarian'];

console.log('uji-shared-t15 v2');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 500)}` : ''}`);
  if (!ok) gagal++;
};
const daftarBerkas = (d, eks) => {
  const hasil = [];
  for (const n of readdirSync(d)) {
    if (n === 'node_modules') continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) hasil.push(...daftarBerkas(p, eks));
    else if (eks.test(n)) hasil.push(p);
  }
  return hasil;
};
const rel = (p) => relative(AKAR, p).replace(/\\/g, '/');
const IMPOR = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

// ── 1. Server tak mengimpor dari frontend/ ─────────────────────────────────────────────────────
console.log('\n-- server --');
const server = daftarBerkas(join(AKAR, 'supabase/functions'), /\.(ts|js|mjs)$/);
const keFrontend = [];
for (const b of server) for (const m of readFileSync(b, 'utf8').matchAll(IMPOR))
  if (/(^|\/)frontend\//.test(m[1])) keFrontend.push(`${rel(b)} → ${m[1]}`);
cek(server.length > 50 && keFrontend.length === 0, `tak satu pun dari ${server.length} berkas server mengimpor dari frontend/`, keFrontend);

// ── 2. Satu tempat ─────────────────────────────────────────────────────────────────────────────
console.log('\n-- satu tempat --');
for (const n of MODUL) {
  const salinan = daftarBerkas(join(AKAR, 'frontend/src'), new RegExp(`^${n}\\.(js|ts|mjs)$`));
  cek(existsSync(join(AKAR, 'shared', `${n}.js`)) && salinan.length === 0, `${n}.js hanya di shared/`, salinan.map(rel));
}

// ── 3. Setiap impor ke shared/ menunjuk berkas yang ada ────────────────────────────────────────
console.log('\n-- jalur impor --');
const pemakai = [...server, ...daftarBerkas(join(AKAR, 'frontend/src'), /\.(js|jsx|ts)$/)];
const keShared = [];
const putus = [];
for (const b of pemakai) for (const m of readFileSync(b, 'utf8').matchAll(IMPOR)) {
  if (!/(^|\/)shared\//.test(m[1])) continue;
  keShared.push(rel(b));
  if (!existsSync(resolve(dirname(b), m[1]))) putus.push(`${rel(b)} → ${m[1]}`);
}
cek(keShared.length >= 12 && putus.length === 0, `${keShared.length} impor ke shared/ — semuanya menunjuk berkas yang ada`, putus);
const pemakaiServer = new Set(keShared.filter((p) => p.startsWith('supabase/')));
const pemakaiKlien = new Set(keShared.filter((p) => p.startsWith('frontend/')));
cek(pemakaiServer.size >= 7 && pemakaiKlien.size >= 2, `dipakai dua sisi: ${pemakaiServer.size} berkas server, ${pemakaiKlien.size} berkas klien`, { server: [...pemakaiServer], klien: [...pemakaiKlien] });

// ── 4. Modul shared/ murni ─────────────────────────────────────────────────────────────────────
// Boleh mengimpor SESAMA shared/ (29 Okt: RetrievalStrategyService → kueri_pencarian, satu aturan kata waktu); tak boleh
// menjangkau ke luar — paket npm, frontend/, supabase/ — karena itu pintu belakang yang mengembalikan T15.
console.log('\n-- murni --');
const folderShared = join(AKAR, 'shared');
for (const b of daftarBerkas(folderShared, /\.(js|ts|mjs)$/)) {
  const isi = readFileSync(b, 'utf8');
  const impor = [...isi.matchAll(IMPOR)].map((m) => m[1]).concat([...isi.matchAll(/require\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
  const keLuar = impor.filter((s) => !s.startsWith('./') || !resolve(dirname(b), s).startsWith(folderShared) || !existsSync(resolve(dirname(b), s)));
  cek(keLuar.length === 0, `${rel(b)} tanpa impor ke luar shared/${impor.length ? ` (${impor.length} impor sesama shared/)` : ''}`, keLuar);
}

// ── 5. Bundel server membawa shared/, bukan frontend/ ─────────────────────────────────────────
console.log('\n-- bundel agent-process --');
const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const hasil = await esbuild.build({
  entryPoints: [join(AKAR, 'supabase/functions/agent-process/index.ts')],
  bundle: true, platform: 'neutral', format: 'esm', write: false, metafile: true, logLevel: 'silent',
  external: ['https://*', 'npm:*', 'jsr:*'],
});
const masukan = Object.keys(hasil.metafile.inputs).map((p) => p.replace(/\\/g, '/'));
const dariShared = masukan.filter((p) => /(^|\/)shared\//.test(p));
const dariFrontend = masukan.filter((p) => /(^|\/)frontend\//.test(p));
cek(dariFrontend.length === 0, 'bundel server tak membawa satu berkas pun dari frontend/', dariFrontend);
cek(dariShared.length === MODUL.length, `bundel server membawa ${dariShared.length} modul dari shared/ (${MODUL.length} diharapkan)`, dariShared);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
