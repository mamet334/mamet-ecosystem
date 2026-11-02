// UJI 2026-11-02 — Item 130 Tahap D (graf Home): lapisan Kemampuan lewat tombol — alat chat, alat folder, MCP berekor,
// sub-agent dari DAFTAR RESMI `shared/daftarSubagen.js` yang juga dibaca server (izin T1). Menjaga: daftar = registry
// server, server tak lagi menulis daftarnya sendiri, tanpa ID/token di berkas publik, graf hanya membaca status konektor,
// tombol tertutup di awal, label tak menumpuk saat lapisan menyala, kelas tombol benar-benar dibuat Tailwind.

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const AKAR = fileURLToPath(new URL('..', import.meta.url));
const imp = (p) => import(pathToFileURL(join(AKAR, p)).href);
const G = await imp('frontend/src/core/runtime/hooks/grafHome.js');
const D = await imp('shared/daftarSubagen.js');
const { ALAT_SEMUA } = await imp('shared/folderKerjaAlat.js');
const { KONEKTOR_DIKENAL } = await imp('shared/konektorAlat.js');
const { simulasikan, barisTiruan } = await imp('uji/lib/simulasiGrafHome.mjs');
console.warn = () => {};

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
const baca = (p) => readFileSync(join(AKAR, p), 'utf8');
const kode = (p) => baca(p).split(/\r?\n/).filter((b) => !/^\s*(\/\/|\*)/.test(b)).join('\n');
console.log('uji-graf-home-tahap-d v1');

// ── 1. Daftar resmi = registry server ───────────────────────────────────────────────────────────
const REG = 'supabase/functions/agent-process/plugins/registry.ts';
const reg = kode(REG);
const impor = Object.fromEntries([...reg.matchAll(/^import (\w+) from '\.\/(\w+)\.ts';/gm)].map((m) => [m[1], m[2]]));
const terdaftar = (reg.match(/export const plugins = \[([\s\S]*?)\];/)?.[1] || '').split(',').map((s) => s.trim()).filter(Boolean);
const namaPlugin = terdaftar.map((v) => baca(`supabase/functions/agent-process/plugins/${impor[v]}.ts`).match(/^\s*name:\s*['"]([^'"]+)['"]/m)?.[1]);
const resmi = D.SUBAGEN.map((s) => s.nama);
cek(namaPlugin.length === 11 && JSON.stringify([...namaPlugin].sort()) === JSON.stringify([...resmi].sort()),
  `daftar resmi = ${resmi.length} plugin di registry.ts (nama \`name\` tiap plugin)`, { registry: namaPlugin, resmi });
cek(JSON.stringify(D.SUBAGEN_MAMETLITE) === '["researcher","deep_research"]' && JSON.stringify(D.SUBAGEN_KHUSUS_PEMILIK) === '["youtube_analyst"]'
  && JSON.stringify(D.ALIAS_TOOLS) === '{"web_search":"researcher","code_executor":"coder","web_scraper":"scraper"}',
  'sifat sama dengan aturan T1 sebelumnya (Mametlite: researcher & deep_research; pemilik: youtube_analyst; alias)');

// ── 2. Server membaca daftar yang sama ──────────────────────────────────────────────────────────
const IZIN = kode('supabase/functions/agent-process/lib/orchestration/izin_subagent.ts');
// `new Set(['…` maupun bentuk TypeScript `new Set<string>(['…` — daftar yang ditulis tangan di server.
cek(/from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\/daftarSubagen\.js'/.test(IZIN) && !/new Set(<[^>]*>)?\(\s*\[\s*['"]/.test(IZIN) && !/web_search:\s*'researcher'/.test(IZIN),
  'izin_subagent.ts mengambil daftar & sifat dari shared/ (tak lagi menulis daftarnya sendiri)');

// ── 3. Berkas publik tanpa rahasia ──────────────────────────────────────────────────────────────
const DS = kode('shared/daftarSubagen.js');
cek(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(DS) && !/apify_api|sk-or-|https?:\/\/|Deno\.env|process\.env/.test(DS),
  'shared/daftarSubagen.js tanpa UUID pemilik, token, alamat, atau env (ikut bundel klien & repo publik)');

// ── 4. Susunan lapisan ──────────────────────────────────────────────────────────────────────────
const alatChat = [{ name: 'web_search', aktif: true }, { name: 'data_tabel', aktif: true }, { name: 'memory_manager', aktif: false }, { name: 'word_to_pdf', aktif: true }, { name: 'deep_research', aktif: true }];
const sumber = { alatChat, alatFolder: ALAT_SEMUA, konektorDikenal: KONEKTOR_DIKENAL, subagen: D.SUBAGEN };
const L = G.susunLapisanKemampuan({ ...sumber, konektor: [] });
const by = Object.fromEntries(L.nodes.map((n) => [n.id, n]));
const ada = (s, t) => L.links.some((l) => l.source === s && l.target === t);
cek(L.nodes.filter((n) => n.id.startsWith('alat-chat-')).length === 5 && L.nodes.filter((n) => n.id.startsWith('alat-folder-')).length === ALAT_SEMUA.length
  && L.nodes.filter((n) => n.id.startsWith('alat-sub-')).length === 11, `isi lapisan dari daftar resmi: 5 alat chat, ${ALAT_SEMUA.length} alat folder, 11 sub-agent`);
cek(ada('lap-alat-chat', 'kem-chat') && ada('alat-chat-data_tabel', 'kem-tabel') && ada('alat-chat-memory_manager', 'kem-memori')
  && ada('lap-alat-folder', 'kem-chat') && ada('lap-alat-folder', 'kem-engineer') && ada('lap-subagen', 'mamet-server')
  && ada('lap-mcp', 'kem-chat') && ada('lap-mcp', 'kem-engineer') && ada('lap-mcp', 'fon-electron'),
  'garis = relasi nyata: alat chat → Chat (data_tabel → Data Tabel, memory_manager → Memori), alat folder → Chat & Engineer, MCP → Electron, sub-agent → Server');
cek(/nonaktif/.test(by['alat-chat-memory_manager'].name) && by['alat-chat-memory_manager'].color === G.WARNA_ALAT.mati
  && /terkunci/.test(by['alat-sub-youtube_analyst'].name) && by['alat-sub-youtube_analyst'].color === G.WARNA_ALAT.mati && by['alat-sub-researcher'].color === G.WARNA_ALAT.aktif,
  'warna & nama: alat nonaktif & sub-agent khusus pemilik abu-abu bertanda');
const kMati = by['lap-konektor-ecosystem-crawler'];
cek(kMati && /mati/.test(kMati.name) && L.nodes.filter((n) => n.id.startsWith('alat-mcp-ecosystem-crawler-')).length === 5,
  'MCP berekor: konektor mati → alat dari daftar yang dikenal (shared/konektorAlat.js)');
const nyala = G.susunLapisanKemampuan({ ...sumber, konektor: G.konektorUntukGraf([{ konektor: 'ecosystem-crawler', nama: 'Ecosystem Crawler', workspace: 'ws-assistant', diaktifkan: true, status: 'nyala', alat: ['jalankan_misi', 'katalog'] }]) });
cek(nyala.nodes.some((n) => n.id === 'alat-mcp-ecosystem-crawler-katalog') && !/mati/.test(nyala.nodes.find((n) => n.id === 'lap-konektor-ecosystem-crawler').name),
  'konektor menyala → alat dari server MCP yang berjalan');
const web = G.susunLapisanKemampuan({ ...sumber, konektor: null });
cek(/hanya desktop/.test(web.nodes.find((n) => n.id === 'lap-mcp').name) && !web.nodes.some((n) => n.id.startsWith('lap-konektor-')), 'versi web: MCP ditandai "hanya desktop", tanpa konektor');
const tiruanKonektor = G.konektorUntukGraf([{ konektor: 'x', nama: 'X', workspace: 'ws-engineer', diaktifkan: true, status: 'nyala', pid: 123, alat: ['a'], ringkasan: { akses: 'rahasia' }, stealth: { folderPaket: 'C:/' } }]);
cek(JSON.stringify(Object.keys(tiruanKonektor[0]).sort()) === '["alat","diaktifkan","id","menyala","nama","workspace"]' && tiruanKonektor[0].menyala === true,
  'konektorUntukGraf membuang pid, ringkasan, stealth (tak dibawa ke graf)', tiruanKonektor[0]);

// ── 5. Gabung ke graf dasar ─────────────────────────────────────────────────────────────────────
const dasar = G.susunGrafHome({ ...barisTiruan(), vitals: {} });
const jumlahDasar = dasar.nodes.length;
const gab = G.gabungGraf(dasar, L);
const idGab = new Set(gab.nodes.map((n) => n.id));
const iKer = gab.nodes.findIndex((n) => n.isCategory);
cek(dasar.nodes.length === jumlahDasar && gab.nodes.length === jumlahDasar + L.nodes.length && L.links.every((l) => idGab.has(l.source) && idGab.has(l.target))
  && gab.nodes.slice(iKer).every((n) => n.isCategory), 'gabungGraf: graf dasar tak diubah, setiap garis lapisan bertemu simpulnya, kerangka tetap dilukis terakhir');
cek(G.simpulDirektori(gab.nodes).length === G.simpulDirektori(dasar.nodes).length, 'Knowledge Directory tak kemasukan alat');

// ── 6. Tata letak saat lapisan menyala ──────────────────────────────────────────────────────────
// Urutan alat di registry tak bisa dikendalikan (penemuan modul) dan menggeser keseimbangan — diukur 3 urutan.
// Batas jujur (diukur 2 Nov: jari fondasi 480/lapisan 400 terbaik dari 540/600/380/420; garis alat→kemampuan 180):
// layar Owner & 1920 → 0 tumpang mentah di semua urutan; 768 → ≤ 2; data 2× DENGAN lapisan → ≤ 3 (graf dasar tetap 0).
const nama = alatChat.map((a) => a.name);
const urutan = [nama, [...nama].reverse(), ['word_to_pdf', 'web_search', 'deep_research', 'memory_manager', 'data_tabel']];
const lapisanUrut = urutan.map((u) => G.susunLapisanKemampuan({ ...sumber, konektor: [], alatChat: u.map((n) => alatChat.find((a) => a.name === n)) }));
for (const [nama2, opsi, batas] of [['layar Owner', {}, 0], ['1920×1080', { layar: { lebar: 1600, tinggi: 980 } }, 0],
  ['768×900', { layar: { lebar: 768, tinggi: 600 } }, 2], ['data 2×', { sebaran: { assistant: 260, engineer: 170, lite: 10, dokumen: 460, memori: 20 } }, 3]]) {
  // Sejak Tahap E: tumpang MENTAH = mutu tata letak (dijaga batas); label yang tetap menindih disembunyikan penghindar
  // tabrakan — label INTI (pusat, kemampuan, fondasi) tak pernah boleh termasuk yang disembunyikan.
  const hasil = lapisanUrut.map((lp) => simulasikan({ ...opsi, pasangGaya: G.pasangGayaGraf, lapisan: lp }));
  const tumpang = hasil.map((h) => h.tumpang.length);
  const intiHilang = hasil.flatMap((h) => h.tersembunyi.filter((l) => ['pusat', 'kemampuan', 'fondasi'].includes(l.group)).map((l) => l.teks));
  cek(tumpang.every((t) => t <= batas) && intiHilang.length === 0 && hasil.every((h) => h.label.length === 15 && h.atasSimpul >= G.RUANG_ATAS - 0.5),
    `${nama2}, lapisan menyala, 3 urutan alat: tumpang mentah ${tumpang.join('/')} (batas ${batas}), 0 label inti tersembunyi, pita legenda bersih`, { tumpang: hasil.map((h) => h.tumpang), intiHilang });
}

// ── 7. Terpasang, tertutup di awal, hanya membaca konektor ──────────────────────────────────────
const HD = kode('frontend/src/components/dashboard/HomeDashboard.jsx');
const AG = kode('frontend/src/components/dashboard/ActivityGraph.jsx');
cek(/\[kemampuanTampil, setKemampuanTampil\] = useState\(false\)/.test(HD) && /graphData=\{grafTampil\}/.test(HD) && /grafTampil\.links\)/.test(HD),
  'lapisan tertutup di awal; graf & tata letak memakai graf gabungan');
cek(/konektor\?\.status/.test(HD) && !/konektor\??\.(panggil|atur|pasangStealth|bukaFolder)/.test(HD + AG + kode('frontend/src/core/runtime/hooks/grafHome.js')),
  'graf hanya memanggil konektor.status (baca-saja) — tak pernah panggil/atur');
cek(/onClick=\{onToggleKemampuan\}/.test(AG) && /aria-pressed=\{kemampuanTampil\}/.test(AG), 'tombol Kemampuan ada di kotak Knowledge Directory');

const reqFE = createRequire(join(AKAR, 'frontend', 'package.json'));
const postcss = reqFE('postcss'), tailwind = reqFE('tailwindcss'), loadConfig = reqFE('tailwindcss/loadConfig');
const escTW = reqFE('tailwindcss/lib/util/escapeClassName').default;
const blok = AG.match(/onClick=\{onToggleKemampuan\}[\s\S]*?<\/div>/)?.[0] || '';
const kelas = [...blok.matchAll(/className="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
const { css } = await postcss([tailwind({ ...loadConfig(join(AKAR, 'frontend', 'tailwind.config.js')),
  content: [{ raw: `<div className="${kelas.join(' ')}">`, extension: 'jsx' }] })]).process('@tailwind utilities;', { from: undefined });
// Kelas dianggap dibuat bila selektornya muncul diikuti spasi, `{`, atau `:` (varian hover:/focus:).
const dibuat = (k) => ['.' + escTW(k) + ' ', '.' + escTW(k) + '{', '.' + escTW(k) + ':'].some((s) => css.includes(s));
const takDibuat = kelas.filter((k) => !dibuat(k));
cek(kelas.length >= 10 && takDibuat.length === 0, `${kelas.length} kelas tombol Kemampuan benar-benar dibuat Tailwind`, takDibuat);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
