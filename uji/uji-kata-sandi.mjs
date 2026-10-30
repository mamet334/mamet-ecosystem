// UJI 2026-10-29 — T19 lupa & ganti kata sandi di Mamet Ecosystem DAN Mametlite (ADR-0022 K4).
//
// Yang dijaga:
//   1. aturan bersama shared/kata_sandi.js (jenis tautan, alamat kembali, pemeriksa sandi baru, terjemahan galat);
//   2. tautan pemulihan dibaca SEBELUM klien Supabase dibuat (klien membersihkan `#…type=recovery` dari alamat);
//   3. sesi dari tautan pemulihan TIDAK langsung membuka aplikasi — layar "kata sandi baru" dulu (kedua aplikasi);
//   4. pesan sesudah meminta tautan SAMA untuk email terdaftar maupun tidak (tak bisa dipakai mengecek akun);
//   5. ganti kata sandi memeriksa kata sandi LAMA dulu;
//   6. kelas tampilan Ecosystem yang baru benar-benar dibuat Tailwind.
// Tampilan keempat keadaan (masuk, lupa, kata sandi baru, tautan basi) dilihat di peramban sungguhan — changelog 29 Okt.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8');
const K = await import(pathToFileURL(join(AKAR, 'shared/kata_sandi.js')).href);

console.log('uji-kata-sandi v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. Aturan bersama ──────────────────────────────────────────────────────────────────────────
cek(K.jenisTautanAuth('#access_token=abc&expires_in=3600&refresh_token=x&token_type=bearer&type=recovery') === 'pemulihan',
  'tautan pemulihan Supabase (#…&type=recovery) → pemulihan');
cek(K.jenisTautanAuth('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired') === 'kedaluwarsa',
  'tautan basi (otp_expired) → kedaluwarsa');
cek(K.jenisTautanAuth('#access_token=abc&type=signup') === null && K.jenisTautanAuth('') === null && K.jenisTautanAuth(undefined) === null,
  'tautan lain (daftar) / tanpa hash → bukan pemulihan');
cek(K.jenisTautanAuth('', '?type=recovery') === 'pemulihan', 'type=recovery di query juga dikenali');
// 31 Okt 2026: undangan dashboard Supabase — tanpa ini yang diundang masuk tanpa pernah membuat kata sandi.
cek(K.jenisTautanAuth('#access_token=abc&expires_in=3600&refresh_token=x&token_type=bearer&type=invite') === 'pemulihan',
  'tautan undangan Supabase (#…&type=invite) → layar buat kata sandi');
cek(K.jenisTautanAuth('#access_token=abc&type=magiclink') === null, 'tautan masuk sekali klik (magiclink) → bukan layar kata sandi');
cek(K.alamatKembaliPemulihan({ protocol: 'https:', origin: 'https://mametlite.vercel.app' }, 'X') === 'https://mametlite.vercel.app/'
  && K.alamatKembaliPemulihan({ protocol: 'mamet:', origin: 'null' }, 'https://mamet-ecosystem.vercel.app/') === 'https://mamet-ecosystem.vercel.app/',
  'tautan email membuka halaman web: asal halaman bila web, versi web bila desktop (mamet://)');
cek(K.periksaSandiBaru('1234567', '1234567') !== null && K.periksaSandiBaru('12345678', '12345679') !== null
  && K.periksaSandiBaru('12345678', '12345678') === null && K.PANJANG_MINIMAL_SANDI === 8,
  'sandi baru: minimal 8 karakter dan kedua isian harus sama');
const T = (m) => K.pesanGalatSandi({ message: m }).judul;
cek(T('For security purposes, you can only request this after 52 seconds.') === 'Terlalu sering meminta.'
  && T('Error sending recovery email') === 'Email gagal dikirim.'
  && T('New password should be different from the old password.') === 'Kata sandi baru sama dengan yang lama.'
  && T('Invalid login credentials') === 'Kata sandi lama salah.'
  && T('Auth session missing!') === 'Tautan pemulihan sudah tidak berlaku.'
  && K.pesanGalatSandi({ message: 'Failed to fetch' }).teknis === 'Failed to fetch',
  'galat Supabase → kalimat Indonesia, pesan teknis tetap dibawa');
cek(/Bila email itu terdaftar/.test(K.PESAN_TAUTAN_TERKIRIM), 'pesan "tautan terkirim" netral — tak mengaku email terdaftar');

// ── 2–5. Sambungan di kedua aplikasi ───────────────────────────────────────────────────────────
const tanpaKomentar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
for (const [nama, berkas] of [['Ecosystem', 'frontend/src/supabase.js'], ['Mametlite', 'mametlite/src/lib/supabase.js']]) {
  const s = baca(berkas);
  const iTautan = s.indexOf('export const jenisTautanAwal');
  cek(iTautan > 0 && iTautan < s.indexOf('createClient(supabaseUrl'), `${nama}: jenis tautan dibaca SEBELUM klien Supabase dibuat (${berkas})`);
}
const APP = tanpaKomentar(baca('frontend/src/App.jsx'));
cek(/useState\(jenisTautanAwal === 'pemulihan'\)/.test(APP) && /event === 'PASSWORD_RECOVERY'\) setPemulihan\(true\)/.test(APP)
  && /if \(!session \|\| pemulihan\)/.test(APP), 'Ecosystem: sesi pemulihan TIDAK membuka desktop — layar kata sandi baru dulu');
const LAMP = tanpaKomentar(baca('frontend/src/components/LampLogin.jsx'));
cek(/resetPasswordForEmail\(email\.trim\(\), \{\s*redirectTo: alamatKembaliPemulihan\(window\.location, WEB_ECOSYSTEM\)/.test(LAMP)
  && /setInfo\(PESAN_TAUTAN_TERKIRIM\)/.test(LAMP), 'Ecosystem: lupa sandi mengirim tautan ke versi web + pesan netral');
cek(!/href="#">Lupa kata sandi\?/.test(LAMP) && /onClick=\{\(\) => keMode\('lupa'\)\}[^>]*>Lupa kata sandi\?/.test(LAMP), 'Ecosystem: "Lupa kata sandi?" bukan tautan kosong lagi');
cek(/updateUser\(\{ password \}\)/.test(LAMP) && /periksaSandiBaru\(password, ulangPassword\)/.test(LAMP), 'Ecosystem: kata sandi baru diperiksa dulu lalu disimpan');
const GANTI = tanpaKomentar(baca('frontend/src/components/GantiKataSandi.jsx'));
const iLama = GANTI.indexOf('signInWithPassword({ email: user.email, password: lama })');
cek(iLama > 0 && GANTI.indexOf('updateUser({ password: baru })') > iLama, 'Ecosystem: ganti sandi memeriksa kata sandi LAMA sebelum menyimpan yang baru');
cek(/<GantiKataSandi \/>/.test(baca('frontend/src/components/Settings.jsx')), 'Ecosystem: ganti sandi ada di Settings › Identitas');

const LITE = tanpaKomentar(baca('mametlite/src/App.jsx'));
cek(/useState\(jenisTautanAwal === 'pemulihan'\)/.test(LITE) && /event === 'PASSWORD_RECOVERY'\) setPemulihan\(true\)/.test(LITE)
  && /if \(!session \|\| pemulihan\)/.test(LITE), 'Mametlite: sesi pemulihan TIDAK membuka aplikasi — layar kata sandi baru dulu');
cek(/<FormGantiSandi email=\{session\.user\.email\} \/>/.test(LITE) && /setModeMasuk\('lupa'\)/.test(LITE), 'Mametlite: "Lupa kata sandi?" di layar masuk + ganti sandi di panel Pengaturan');
const KS = tanpaKomentar(baca('mametlite/src/lib/KataSandi.jsx'));
cek(/redirectTo: alamatKembaliPemulihan\(window\.location, 'https:\/\/mametlite\.vercel\.app\/'\)/.test(KS) && /\{PESAN_TAUTAN_TERKIRIM\}/.test(KS),
  'Mametlite: tautan kembali ke Mametlite + pesan netral');
const iLamaLite = KS.indexOf('signInWithPassword({ email, password: lama })');
cek(iLamaLite > 0 && KS.indexOf('updateUser({ password: baru })', iLamaLite) > iLamaLite, 'Mametlite: ganti sandi memeriksa kata sandi LAMA dulu');
cek(/fs: \{ allow: \['\.', '\.\.\/shared'\] \}/.test(baca('mametlite/vite.config.js')), "Mametlite: server dev mengizinkan '../shared'");

// ── 6. Kelas tampilan Ecosystem dikompilasi Tailwind sungguhan ──────────────────────────────────
const reqFE = createRequire(join(AKAR, 'frontend', 'package.json'));
const postcss = reqFE('postcss'), tailwind = reqFE('tailwindcss'), loadConfig = reqFE('tailwindcss/loadConfig');
const escTW = reqFE('tailwindcss/lib/util/escapeClassName').default;
const kelasBaru = [...new Set([
  ...(LAMP.match(/role="status" className="([^"]+)"/)?.[1] || '').split(/\s+/),
  ...(GANTI.match(/className="([^"]+)"/g) || []).flatMap((m) => m.slice(11, -1).split(/\s+/)),
  ...(GANTI.match(/const isian = '([^']+)'/)?.[1] || '').split(/\s+/),
].filter(Boolean))];
const { css } = await postcss([tailwind({ ...loadConfig(join(AKAR, 'frontend', 'tailwind.config.js')),
  content: [{ raw: `<div className="${kelasBaru.join(' ')}">`, extension: 'jsx' }] })]).process('@tailwind utilities;', { from: undefined });
const cssGlobal = baca('frontend/src/index.css').replace(/\/\*[\s\S]*?\*\//g, '');
const takDibuat = kelasBaru.filter((k) => !css.includes('.' + escTW(k) + ' ') && !css.includes('.' + escTW(k) + '{') && !css.includes('.' + escTW(k) + ':')
  && !new RegExp(`(^|\\n)\\.${k.replace(/[-]/g, '\\-')}\\s*\\{`).test(cssGlobal));
cek(kelasBaru.length >= 15 && takDibuat.length === 0, `${kelasBaru.length} kelas tampilan baru (LampLogin, GantiKataSandi) benar-benar dibuat`, takDibuat);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
