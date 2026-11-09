
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

  console.log('\n-- pemeriksa keutuhan --');
  {
    const utuh = keutuhanTemuan(BENAR);
    cek(utuh.judul === 2 && utuh.terbaca === 2 && utuh.utuh === true, 'bentuk benar -> utuh', utuh);

    const rusak = keutuhanTemuan(MELENCENG);
    cek(rusak.judul === 2, 'bentuk melenceng: judulnya tetap TERHITUNG ada', rusak);
    cek(rusak.terbaca === 0, 'tetapi NOL yang terbaca — persis keadaan 5 Okt', rusak);
    cek(rusak.utuh === false, 'dan dinyatakan tidak utuh', rusak);

    cek(keutuhanTemuan('').utuh === true, 'berkas kosong -> utuh (bukan kelencengan)');
    cek(keutuhanTemuan(null).utuh === true, 'null -> utuh, bukan lempar');
    cek(keutuhanTemuan('# Temuan Engineer\n\ntanpa entri').utuh === true, 'berkas tanpa entri -> utuh');
  }

  console.log('\n-- penguraian --');
  {
    cek(bacaBerkasTemuan(BENAR).length === 2, 'bentuk benar -> 2 temuan terbaca');
    cek(bacaBerkasTemuan(MELENCENG).length === 0, 'bentuk melenceng -> 0 terbaca (cacat aslinya)');
  }

  console.log('\n-- "tidak terbaca" tidak disamakan dengan "tidak ada temuan" --');
  {
    const sepi = ringkasanUntukKonteks([], 20, keutuhanTemuan(''));
    cek(sepi === '', 'benar-benar tak ada temuan -> tetap string kosong, tanpa peringatan palsu', sepi);

    const buta = ringkasanUntukKonteks([], 20, keutuhanTemuan(MELENCENG));
    cek(buta !== '', 'berkas tak terbaca -> TIDAK lagi diam', buta.slice(0, 60));
    cek(/TIDAK TERBACA UTUH/.test(buta), 'dan menyebut sebabnya dengan terang', buta.slice(0, 80));
    cek(/0 dari 2/.test(buta), 'dengan ANGKA, bukan "ada masalah"', buta.slice(0, 80));
    cek(/JANGAN menyimpulkan sebuah temuan belum pernah dilaporkan/.test(buta),
      'dan melarang kesimpulan yang salah — inilah kerugian aslinya');

    cek(ringkasanUntukKonteks([], 20) === '', 'tanpa isyarat keutuhan -> perilaku lama utuh');
  }

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

  console.log('\n-- berkas nyata --');
  {
    const k = keutuhanTemuan(baca('docs/project-memory/temuan-engineer/TEMUAN-ENGINEER.md'));
    cek(k.utuh, `TEMUAN-ENGINEER.md terbaca utuh (${k.terbaca}/${k.judul})`, k);
    cek(k.judul > 0, 'dan memang berisi entri', k);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

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
