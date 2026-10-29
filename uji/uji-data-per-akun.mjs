// UJI 2026-10-29 — K4 (ADR-0022): riwayat chat & kunci API Mametlite di peramban TERPISAH per akun.
//
// Uji isolasi dua akun 29 Okt: database (RLS, fungsi SECURITY DEFINER) dan server (token diverifikasi) sudah terisolasi;
// yang bocor peramban Mametlite — `mametlite_conversations` & `x-byok-openrouter` satu kunci untuk semua akun, keluar akun
// hanya mengakhiri sesi. Di komputer bersama, orang kedua melihat riwayat orang pertama dan memakai kunci OpenRouter-nya.
// Data lama — pilihan (a) Owner: ke akun yang sedang masuk saat versi baru dibuka; tanpa sesi → dihapus.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const R = await import(pathToFileURL(join(AKAR, 'mametlite/src/lib/riwayatLokal.js')).href);
const D = await import(pathToFileURL(join(AKAR, 'mametlite/src/lib/dataPerAkun.js')).href);

console.log('uji-data-per-akun v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};
const simpanan = (awal = {}) => {
  const m = new Map(Object.entries(awal));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
};
const RIW_A = [{ id: 1, title: 'Rahasia A', messages: [{ role: 'user', content: 'data A' }] }];
const RIW_LAMA = [{ id: 7, title: 'Lama', messages: [{ role: 'user', content: 'lama' }] }];

// ── 1. Riwayat per akun ────────────────────────────────────────────────────────────────────────
let s = simpanan();
R.simpanRiwayat(RIW_A, s, 'akun-A');
cek(R.bacaRiwayat(s, 'akun-A').riwayat[0].title === 'Rahasia A', 'akun A membaca riwayatnya sendiri');
cek(R.bacaRiwayat(s, 'akun-B').riwayat[0].title === 'Percakapan Baru', 'akun B di peramban yang SAMA tidak melihat riwayat akun A');
cek(s.getItem('mametlite_conversations') === null && s.getItem('mametlite_conversations:akun-A') !== null, 'riwayat ditulis ke kunci per akun, bukan kunci bersama');

// ── 2. Kunci API per akun ──────────────────────────────────────────────────────────────────────
s = simpanan({ 'x-byok-openrouter:akun-A': ' sk-or-A ' });
cek(D.bacaKunciByok('openrouter', 'akun-A', s) === 'sk-or-A' && D.bacaKunciByok('openrouter', 'akun-B', s) === '',
  'kunci OpenRouter akun A tidak terbaca oleh akun B (tak ada biaya ke orang lain)');
cek(D.bacaKunciByok('openrouter', null, s) === '', 'tanpa akun → tidak ada kunci');

// ── 3. Data lama (pilihan a) ───────────────────────────────────────────────────────────────────
s = simpanan({ mametlite_conversations: JSON.stringify(RIW_LAMA), 'x-byok-openrouter': 'sk-or-lama' });
let h = D.pindahkanDataLama(s, 'akun-A');
cek(R.bacaRiwayat(s, 'akun-A').riwayat[0].title === 'Lama' && D.bacaKunciByok('openrouter', 'akun-A', s) === 'sk-or-lama'
  && h.dipindah.length === 2, 'ada sesi → riwayat & kunci lama pindah ke akun yang sedang masuk', h);
cek(s.getItem('mametlite_conversations') === null && s.getItem('x-byok-openrouter') === null, 'kunci lama bersama dihapus sesudah dipindah');
cek(D.pindahkanDataLama(s, 'akun-B').dipindah.length === 0 && R.bacaRiwayat(s, 'akun-B').riwayat[0].title === 'Percakapan Baru',
  'akun berikutnya tidak mewarisi apa pun (data lama sudah tak ada)');
s = simpanan({ mametlite_conversations: JSON.stringify(RIW_LAMA), 'x-byok-openrouter': 'sk-or-lama' });
h = D.pindahkanDataLama(s, null);
cek(h.dipindah.length === 0 && h.dihapus.length === 2 && s._m.size === 0, 'tanpa sesi → data lama dihapus (tak bisa diketahui milik siapa)', h);
s = simpanan({ mametlite_conversations: JSON.stringify(RIW_LAMA), 'mametlite_conversations:akun-A': JSON.stringify(RIW_A) });
D.pindahkanDataLama(s, 'akun-A');
cek(R.bacaRiwayat(s, 'akun-A').riwayat[0].title === 'Rahasia A' && s.getItem('mametlite_conversations') === null,
  'riwayat akun yang sudah ada TIDAK ditimpa data lama');
cek(D.pindahkanDataLama(null, 'akun-A').dipindah.length === 0, 'penyimpanan diblokir → tidak melempar');

// ── 4. Sambungan di App.jsx Mametlite ──────────────────────────────────────────────────────────
const APP = readFileSync(join(AKAR, 'mametlite/src/App.jsx'), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
cek(!/localStorage\.getItem\(\s*['"]x-byok/.test(APP) && !/'x-byok-openrouter'\)/.test(APP),
  'tak ada lagi pembacaan kunci API bersama (x-byok-*) di App.jsx');
// Berurutan LANGSUNG (mutasi 29 Okt: "setSession di mana saja sesudahnya" lolos karena ada setSession lain di bawah).
cek(/pindahkanDataLama\(undefined, session\?\.user\?\.id \?\? null\);\s*setSession\(session\);/.test(APP),
  'data lama dipindah SEBELUM sesi dipasang (pemuat riwayat membaca kunci per akun)');
cek(/const \{ riwayat, masalah \} = bacaRiwayat\(undefined, idAkun\);[\s\S]{0,80}pemilikRiwayatRef\.current = idAkun;/.test(APP) && /\}, \[idAkun\]\);/.test(APP),
  'riwayat dimuat ulang setiap akun berganti');
cek(/const pemilik = pemilikRiwayatRef\.current;\s*if \(!pemilik\) return;[\s\S]{0,120}simpanRiwayat\(conversations, undefined, pemilik\)/.test(APP)
  && /if \(pemilik\) simpanRiwayat\(conversations, undefined, pemilik\)/.test(APP),
  'penyimpanan (berkala & saat halaman ditutup) hanya ke kunci PEMILIK riwayat yang tampil');
cek(/localStorage\.setItem\(kunciByok\('openrouter', idAkun\), bersih\)/.test(APP), 'kunci OpenRouter disimpan ke kunci akun ini');

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
