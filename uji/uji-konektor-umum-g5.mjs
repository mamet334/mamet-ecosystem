// UJI 2026-11-03 — menu tombol + di chat (Item 129 Tahap G5, keputusan Owner 3 Nov): components/konektor/{menuKonektor.js,
// arahSettings.js, MenuTambah.jsx} dan sambungannya di ConversationEngine & Settings.
//
// Yang dijaga:
//   - "Percakapan baru" tetap ada (baris pertama menu + tombol di laci riwayat);
//   - konektor workspace ini tampil dengan keadaan yang benar; sakelar hanya untuk yang siap (yang menyala selalu
//     bisa dimatikan); penanda di tombol + (masalah didahulukan);
//   - menu hanya MENYALAKAN/MEMATIKAN — tak memasang, tak menyimpan kredensial, tak meninjau, tak memanggil alat;
//   - "Atur di Settings ›" membuka tab Konektor (Settings terpasang atau belum);
//   - kelas Tailwind benar-benar dibuat.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(AKAR, 'frontend', 'package.json'));
const imp = (p) => import(pathToFileURL(path.join(AKAR, p)).href);
const baca = (p) => readFileSync(path.join(AKAR, p), 'utf8');

console.log('uji-konektor-umum-g5 v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 600)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. Daftar konektor untuk menu ────────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. daftar --');
const M = await imp('frontend/src/components/konektor/menuKonektor.js');
const bawaan = [
  { workspace: 'ws-assistant', konektor: 'ecosystem-crawler', nama: 'Ecosystem Crawler', status: 'mati', diaktifkan: false, tersedia: true, alat: [] },
  { workspace: 'ws-engineer', konektor: 'ecosystem-crawler', nama: 'Ecosystem Crawler', status: 'nyala', diaktifkan: true, tersedia: true, alat: ['a', 'b'] },
];
const umum = [
  { id: 'github', nama: 'GitHub', kredensial: [{ id: 'token', terisi: true }], alatDisetujui: Array.from({ length: 27 }, (_, i) => `a${i}`),
    ws: { 'ws-assistant': { diaktifkan: true, status: 'nyala', alat: Array.from({ length: 27 }, (_, i) => `a${i}`) }, 'ws-engineer': { diaktifkan: false, status: 'mati', alat: [] } } },
  { id: 'notion', nama: 'Notion', kredensial: [{ id: 'kunci', terisi: false }], alatDisetujui: [], ws: { 'ws-assistant': { diaktifkan: false, status: 'mati', alat: [] } } },
  { id: 'jira', nama: 'Jira', kredensial: [], alatDisetujui: [], ws: {} },
  { id: 'lama', nama: 'Lama', kredensial: [], alatDisetujui: ['x'], ws: { 'ws-assistant': { diaktifkan: true, status: 'perlu_tinjau', alat: [] } } },
  { id: 'ecosystem-crawler', nama: 'Palsu', kredensial: [], alatDisetujui: ['x'], ws: {} },
];
const dA = M.susunMenuKonektor(bawaan, umum, 'ws-assistant');
const per = Object.fromEntries(dA.map((k) => [k.id, k]));
cek(dA.map((k) => k.id).join() === 'ecosystem-crawler,github,notion,jira,lama' && per['ecosystem-crawler'].nama === 'Ecosystem Crawler',
  'K3: hanya baris workspace ini; crawler bawaan + server umum; server umum ber-id bawaan dibuang', dA.map((k) => [k.id, k.nama]));
cek(per.github.menyala && per.github.diaktifkan && per.github.jumlahAlat === 27 && per.github.siap && per.github.keterangan === 'menyala', 'GitHub menyala · 27 alat', per.github);
cek(!per.notion.siap && /kredensial belum diisi/.test(per.notion.keterangan), 'kredensial kosong → belum siap, arahkan ke Settings', per.notion);
cek(!per.jira.siap && /belum ditinjau/.test(per.jira.keterangan), 'alat belum ditinjau → belum siap', per.jira);
const tokenDihapus = M.susunMenuKonektor([], [{ id: 'gh2', nama: 'GH2', kredensial: [{ id: 'token', terisi: false }], alatDisetujui: ['a'], ws: {} }], 'ws-assistant')[0];
cek(!tokenDihapus.siap && /kredensial belum diisi/.test(tokenDihapus.keterangan), 'alat sudah disetujui tetapi token dihapus → tetap belum siap', tokenDihapus);
cek(per.lama.diaktifkan && !per.lama.menyala && /alat berubah/.test(per.lama.keterangan), 'alat berubah sejak disetujui → keterangan tinjau ulang', per.lama);
cek(per['ecosystem-crawler'].jumlahAlat === 5 && per['ecosystem-crawler'].keterangan === 'mati', 'crawler mati: jumlah alat dari protokol', per['ecosystem-crawler']);
const dE = M.susunMenuKonektor(bawaan, umum, 'ws-engineer');
cek(dE.find((k) => k.id === 'ecosystem-crawler').jumlahAlat === 2 && !dE.find((k) => k.id === 'github').diaktifkan, 'Engineer melihat sakelarnya sendiri', dE);
cek(M.penandaKonektor(dA) === 'masalah' && M.penandaKonektor([per.github]) === 'nyala' && M.penandaKonektor([per.notion]) === null && M.penandaKonektor(null) === null,
  'penanda tombol +: masalah didahulukan, lalu nyala, lalu tidak ada');
cek(M.susunMenuKonektor(null, undefined, 'ws-assistant').length === 0, 'status tak terbaca → daftar kosong, tidak galat');

// ── 2. Arah ke Settings ──────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. arah settings --');
const S = await imp('frontend/src/components/konektor/arahSettings.js');
globalThis.window = new EventTarget();
let diterima = null;
window.addEventListener(S.PERISTIWA_BAGIAN_SETTINGS, (e) => { diterima = e.detail?.bagian; });
S.mintaBagianSettings('konektor');
cek(diterima === 'konektor', 'Settings yang sudah terpasang menerima peristiwa ganti tab');
cek(S.ambilBagianSettings() === 'konektor' && S.ambilBagianSettings() === null, 'Settings yang baru terpasang membaca permintaan SEKALI (tak menyangkut di kunjungan berikutnya)');
delete globalThis.window;

// ── 3. Sambungan (statis) ────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 3. sambungan --');
const CE = baca('frontend/src/components/workbench/ConversationEngine.jsx');
const MT = baca('frontend/src/components/konektor/MenuTambah.jsx');
const ST = baca('frontend/src/components/Settings.jsx');
const CH = baca('frontend/src/components/workbench/ChatHistory.jsx');
cek(/<MenuTambah onNewChat=\{handleNewChat\} workspaceId=\{osState\?\.workspaceId\} \/>/.test(CE) && !/onClick=\{handleNewChat\}/.test(CE),
  'tombol + di bilah chat = MenuTambah (tombol lama diganti, bukan ditambah)');
cek(/onNewChat=\{handleNewChat\}/.test(CE) && /Percakapan Baru/.test(CH), 'laci riwayat tetap punya "Percakapan Baru" (jalan 1 klik tetap ada)');
const urutan = MT.indexOf('Percakapan baru') < MT.indexOf('Konektor\n') || MT.indexOf('onNewChat();') < MT.indexOf('daftar.map(');
cek(urutan && /onClick=\{\(\) => \{ setBuka\(false\); onNewChat\(\); \}\}/.test(MT), '"Percakapan baru" baris PERTAMA menu');
cek(/api\.konektor\.atur\(workspaceId, k\.id, !k\.diaktifkan\)/.test(MT) && /api\.konektorUmum\.atur\(workspaceId, k\.id, !k\.diaktifkan\)/.test(MT),
  'sakelar memakai jalur `atur` yang sama dengan Settings, per workspace');
cek(!/\.(panggil|setujui|tinjau|kredensial|pasang|hapus|pasangStealth)\(/.test(MT), 'menu tidak memasang, menyimpan kredensial, meninjau, menghapus, atau memanggil alat');
cek(/const bisa = k\.siap \|\| k\.diaktifkan/.test(MT) && /disabled=\{!bisa \|\| sedang === k\.id\}/.test(MT), 'yang belum siap tidak bisa dinyalakan; yang menyala selalu bisa dimatikan');
cek(/mintaBagianSettings\('konektor'\)/.test(MT) && /activateApp\?\.\('app:settings'\)/.test(MT), '"Atur di Settings ›" meminta tab Konektor lalu membuka Settings');
cek(/useState\(\(\) => ambilBagianSettings\(\) \|\| 'model'\)/.test(ST) && /addEventListener\(PERISTIWA_BAGIAN_SETTINGS/.test(ST) && /\{ id: 'konektor',/.test(ST),
  'Settings membuka tab yang diminta (saat terpasang & lewat peristiwa); tab konektor ada');
cek(!/dangerouslySetInnerHTML\s*=|\.innerHTML\s*=/.test(MT), 'nama & keterangan konektor tampil sebagai teks');

// ── 4. Tailwind sungguhan ────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 4. tailwind --');
const postcss = require('postcss'), tailwind = require('tailwindcss'), loadConfig = require('tailwindcss/loadConfig');
const escTW = require('tailwindcss/lib/util/escapeClassName').default;
const kelas = [...new Set([...MT.matchAll(/className=\{?[`"]([^`"]+)[`"]/g)].flatMap((m) => m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/))
  .concat(['bg-error', 'bg-primary', 'text-primary', 'text-on-surface-variant', 'text-error'])
  .filter((k) => /^[a-z!\-[\]0-9/:.%]+$/i.test(k)))];
const { css } = await postcss([tailwind({ ...loadConfig(path.join(AKAR, 'frontend', 'tailwind.config.js')),
  content: [{ raw: `<div className="${kelas.join(' ')}">`, extension: 'jsx' }] })]).process('@tailwind utilities;', { from: undefined });
const dibuat = (k) => ['.' + escTW(k) + ' ', '.' + escTW(k) + '{', '.' + escTW(k) + ':'].some((s) => css.includes(s));
const takDibuat = kelas.filter((k) => !dibuat(k));
cek(kelas.length >= 25 && takDibuat.length === 0, `${kelas.length} kelas menu + benar-benar dibuat Tailwind`, takDibuat);

console.log(`\n${gagal ? `GAGAL ${gagal}` : 'SEMUA LULUS'}`);
process.exit(gagal ? 1 : 0);
