// UJI 2026-11-02 — J3 (Item 125 Fase C, K7): suite uji adalah GERBANG rilis, dan suite bisa berjalan di mesin mana pun.
//
// Dulu: tak satu uji pun dijalankan di GitHub — rilis bisa terbit dengan uji merah. Dan suite hanya bisa berjalan di
// laptop Owner: 68 berkas memaku 'D:/SLAMET/other/mamet os ecosystem', 3 membaca commit yang tak pernah sampai ke
// GitHub (`git show <hash>`). Uji ini menjaga ketiganya agar tak kembali diam-diam.

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const AKAR = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(AKAR, 'frontend/'));
const YAML = require('js-yaml');
const baca = (p) => readFileSync(join(AKAR, p), 'utf8');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};
console.log('uji-gerbang-uji v1');

// ── 1. Gerbang di GitHub ────────────────────────────────────────────────────────────────────────
const U = YAML.load(baca('.github/workflows/uji.yml'));
const B = YAML.load(baca('.github/workflows/build.yml'));
const pemicu = U.on || U[true] || {};
cek(pemicu.push?.branches?.includes('main') && pemicu.pull_request?.branches?.includes('main') && 'workflow_call' in pemicu,
  'uji.yml berjalan pada push & PR ke main, dan bisa dipanggil build.yml', Object.keys(pemicu));
const langkah = (U.jobs?.suite?.steps || []).map((s) => s.run || '').join('\n');
cek(/node uji\/jalankan-semua\.mjs/.test(langkah) && /exit \$kode/.test(langkah),
  'uji.yml menjalankan jalankan-semua dan meneruskan kode keluarnya (uji merah → job merah)');
cek(/jalankan-semua\.mjs[^\n]*\|\| kode=\$\?/.test(langkah),
  'kode keluar ditangkap dengan `|| kode=$?` — `bash -e` GitHub tak memotong ringkasan sebelum dicetak');
const butuh = [].concat(B.jobs?.build?.needs || []);
cek(butuh.includes('uji') && B.jobs?.uji?.uses === './.github/workflows/uji.yml',
  'build.yml: job build (menerbitkan rilis) BUTUH job uji lulus', butuh);

// ── 2. Suite tak bergantung pada laptop Owner ───────────────────────────────────────────────────
const berkasUji = readdirSync(join(AKAR, 'uji')).filter((n) => /^uji-.+\.(mjs|cjs)$/.test(n));
const barisKode = (teks) => teks.split(/\r?\n/).filter((b) => !/^\s*(\/\/|\*)/.test(b));
const memaku = berkasUji.filter((n) => barisKode(readFileSync(join(AKAR, 'uji', n), 'utf8'))
  .some((b) => /'D:\/SLAMET\/other\/mamet os ecosystem/.test(b)));
cek(memaku.length === 0, `tak ada berkas uji yang memaku alamat laptop Owner (${berkasUji.length} berkas diperiksa)`, memaku);
const revisiLepas = berkasUji.filter((n) => barisKode(readFileSync(join(AKAR, 'uji', n), 'utf8'))
  .some((b) => /git show \$?\{?[A-Z_]*\}?[0-9a-f]{0,40}:/.test(b) && !/git show HEAD:/.test(b) && !/MAMET_CMD/.test(b)));
cek(revisiLepas.length === 0, 'tak ada uji yang membaca revisi lama lewat `git show <hash>` (pakai uji/kendali-revisi/)', revisiLepas);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
