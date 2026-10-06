// UJI 2026-10-06 — TMN-0006: ingatan temuan berhenti DIAM saat berkasnya tak terbaca.
//
// ── Cacatnya ────────────────────────────────────────────────────────────────────────────────
//
// `bacaBerkasTemuan` menuntut judul berbentuk PERSIS `## TMN-0001 — DITUTUP`. Pada 5 Okt 2026
// berkasnya sudah berisi `## TMN-0001 — ✅ DITUTUP 2026-10-04 (…)` hasil suntingan tangan, dan
// dijalankan terhadap berkas sungguhan: **4 judul ada, NOL terbaca**.
//
// Yang berbahaya bukan kelencengannya — melainkan KEBISUANNYA. Daftar kosong mengalir ke
// `ringkasanUntukKonteks`, yang memulangkan string kosong, sehingga Engineer tidak menerima blok
// temuan sama sekali dan membacanya sebagai "tidak ada temuan terbuka".
//
//   "tidak bisa dibaca"  ≠  "tidak ada temuan"
//
// Menyamakan keduanya membuat janji "temuan yang sudah dilaporkan tidak diangkat ulang" berlaku
// hampa, DAN membuat temuan yang benar-benar terbuka tak pernah sampai ke model.
//
// ── Yang dijaga berkas ini ──────────────────────────────────────────────────────────────────
//
// Bukan "berkasnya berbentuk benar" — itu sudah dijaga `uji-komentar-tak-berbohong.mjs`. Di sini
// yang diuji: KETIKA bentuknya rusak, apakah sistemnya BERSUARA, dan apakah suaranya sampai ke
// tempat yang menentukan (konteks model), bukan cuma ke konsol.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-ingatan-temuan-bersuara v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const dir = mkdtempSync(join(tmpdir(), 'uji-ingatan-'));

// Bentuk BENAR dan bentuk MELENCENG — yang melenceng ditulis persis seperti yang ditemukan 5 Okt.
const BENAR = [
  '# Temuan Engineer', '', '**1 terbuka · 1 ditutup**', '',
  '## TMN-0001 — DITUTUP',
  '- **Berkas:** `a.js`',
  '- **Tingkat:** rendah',
  '- **Ringkasan:** sudah beres',
  '',
  '## TMN-0002 — TERBUKA',
  '- **Berkas:** `b.js`',
  '- **Tingkat:** tinggi',
  '- **Ringkasan:** masih terbuka',
  '',
].join('\n');

const MELENCENG = BENAR
  .replace('## TMN-0001 — DITUTUP', '## TMN-0001 — ✅ DITUTUP 2026-10-04 (sudah benar sejak lahir)')
  .replace('## TMN-0002 — TERBUKA', '## TMN-0002 — ⚠️ TERBUKA (tingkat tinggi)');

try {
  const { code } = await esbuild.transform(baca('frontend/src/core/runtime/services/engineer/IngatanTemuan.js'), { loader: 'js', format: 'esm' });
  writeFileSync(join(dir, 'it.mjs'), code);
  const M = await import(pathToFileURL(join(dir, 'it.mjs')).href);
  const { keutuhanTemuan, bacaBerkasTemuan, ringkasanUntukKonteks } = M;

  // ── 1. Pemeriksa keutuhan ────────────────────────────────────────────────────────────────
  console.log('\n-- pemeriksa keutuhan --');
  {
    const utuh = keutuhanTemuan(BENAR);
    cek(utuh.judul === 2 && utuh.terbaca === 2 && utuh.utuh === true, 'bentuk benar -> utuh', utuh);

    const rusak = keutuhanTemuan(MELENCENG);
    cek(rusak.judul === 2, 'bentuk melenceng: judulnya tetap TERHITUNG ada', rusak);
    cek(rusak.terbaca === 0, 'tetapi NOL yang terbaca — persis keadaan 5 Okt', rusak);
    cek(rusak.utuh === false, 'dan dinyatakan tidak utuh', rusak);

    // Berkas kosong/tak ada BUKAN kelencengan — kalau ikut dianggap rusak, peringatannya akan
    // muncul terus-menerus pada pemasangan baru dan lama-lama diabaikan.
    cek(keutuhanTemuan('').utuh === true, 'berkas kosong -> utuh (bukan kelencengan)');
    cek(keutuhanTemuan(null).utuh === true, 'null -> utuh, bukan lempar');
    cek(keutuhanTemuan('# Temuan Engineer\n\ntanpa entri').utuh === true, 'berkas tanpa entri -> utuh');
  }

  // ── 2. Penguraian pada kedua bentuk ──────────────────────────────────────────────────────
  console.log('\n-- penguraian --');
  {
    cek(bacaBerkasTemuan(BENAR).length === 2, 'bentuk benar -> 2 temuan terbaca');
    cek(bacaBerkasTemuan(MELENCENG).length === 0, 'bentuk melenceng -> 0 terbaca (cacat aslinya)');
  }

  // ── 3. INTINYA: daftar kosong punya DUA sebab, dan keduanya tak boleh disamakan ──────────
  console.log('\n-- "tidak terbaca" tidak disamakan dengan "tidak ada temuan" --');
  {
    // (a) memang tidak ada temuan -> tetap kosong, tidak ada peringatan palsu
    const sepi = ringkasanUntukKonteks([], 20, keutuhanTemuan(''));
    cek(sepi === '', 'benar-benar tak ada temuan -> tetap string kosong, tanpa peringatan palsu', sepi);

    // (b) berkas tak terbaca -> HARUS bersuara meski daftarnya kosong
    const buta = ringkasanUntukKonteks([], 20, keutuhanTemuan(MELENCENG));
    cek(buta !== '', 'berkas tak terbaca -> TIDAK lagi diam', buta.slice(0, 60));
    cek(/TIDAK TERBACA UTUH/.test(buta), 'dan menyebut sebabnya dengan terang', buta.slice(0, 80));
    cek(/0 dari 2/.test(buta), 'dengan ANGKA, bukan "ada masalah"', buta.slice(0, 80));
    cek(/JANGAN menyimpulkan sebuah temuan belum pernah dilaporkan/.test(buta),
      'dan melarang kesimpulan yang salah — inilah kerugian aslinya');

    // (c) tanpa isyarat keutuhan, perilaku lama tidak berubah (pemanggil lain tidak ikut rusak)
    cek(ringkasanUntukKonteks([], 20) === '', 'tanpa isyarat keutuhan -> perilaku lama utuh');
  }

  // ── 4. Peringatan ikut muncul saat ADA temuan terbaca sebagian ──────────────────────────
  // Kasus yang paling mudah menipu: sebagian terbaca, jadi daftarnya TIDAK kosong dan semuanya
  // tampak normal — padahal separuhnya hilang.
  console.log('\n-- sebagian terbaca: paling mudah menipu --');
  {
    const separuh = BENAR.replace('## TMN-0001 — DITUTUP', '## TMN-0001 — ✅ DITUTUP 2026-10-04');
    const k = keutuhanTemuan(separuh);
    cek(k.judul === 2 && k.terbaca === 1 && !k.utuh, 'satu terbaca, satu tidak', k);

    const teks = ringkasanUntukKonteks(bacaBerkasTemuan(separuh), 20, k);
    cek(/TIDAK TERBACA UTUH/.test(teks), 'peringatan tetap muncul meski daftarnya TIDAK kosong');
    cek(/TEMUAN ENGINEER YANG MASIH TERBUKA/.test(teks), 'dan daftar yang terbaca tetap ikut dikirim');
    cek(teks.indexOf('TIDAK TERBACA UTUH') < teks.indexOf('MASIH TERBUKA'),
      'peringatan di DEPAN daftar — kalau di belakang, ia terpotong lebih dulu saat konteks dipangkas');
  }

  // ── 5. Berkas SUNGGUHAN di repo ini harus utuh ──────────────────────────────────────────
  console.log('\n-- berkas nyata --');
  {
    const k = keutuhanTemuan(baca('docs/project-memory/temuan-engineer/TEMUAN-ENGINEER.md'));
    cek(k.utuh, `TEMUAN-ENGINEER.md terbaca utuh (${k.terbaca}/${k.judul})`, k);
    cek(k.judul > 0, 'dan memang berisi entri', k);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// ── 6. TERPASANG di jalur kirim ─────────────────────────────────────────────────────────────
// Pemeriksa yang benar tetapi tak pernah dipanggil adalah persis cacat `logCommand` yang yatim.
console.log('\n-- terpasang --');
{
  const C = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));
  cek(/import \{[^}]*\bkeutuhanTemuan\b[^}]*\} from '[^']*IngatanTemuan\.js'/.test(C), 'keutuhanTemuan diimpor');
  cek(/setKeutuhanTemuan\(isi \? keutuhanTemuan\(isi\) : null\)/.test(C),
    'dinilai saat berkas dibaca, dan HANYA bila berkasnya ada');
  cek(/ringkasanUntukKonteks\(\[\.\.\.temuanTersimpan, \.\.\.temuanBelumSimpan\], 20, keutuhanTemuanRef\)/.test(C),
    'dan diteruskan ke ringkasan yang masuk konteks model');

  const I = tanpaKomentar(baca('frontend/src/core/runtime/services/engineer/IngatanTemuan.js'));
  cek(/console\.error\(/.test(I), 'kelencengan juga dicatat ke konsol untuk Owner');
  cek(/BENTUK BERKAS MELENCENG/.test(I), 'dengan kalimat yang bisa dicari');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
