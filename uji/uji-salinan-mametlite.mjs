import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const butuh = createRequire(join(AKAR, 'frontend/package.json'));

const { hapusKomentar } = await import(pathToFileURL(join(AKAR, 'scripts/hapus-komentar.mjs')).href);

const PASANGAN = [
  ['documentTextExtractor.js', 'mametlite/src/lib', 'frontend/src/core/runtime/services'],
  ['pdfOcrService.js', 'mametlite/src/lib', 'frontend/src/core/runtime/services'],
  ['tabelCentang.js', 'mametlite/src/lib', 'frontend/src/core/runtime/services'],
];

console.log('uji-salinan-mametlite v2');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(
    `${ok ? 'LULUS' : 'GAGAL'}  ${pesan}` +
      (!ok && rinci !== undefined ? `\n       -> ${String(rinci).slice(0, 600)}` : ''),
  );
  if (!ok) gagal++;
};

function normalkan(teks, alamat) {
  const { teks: tanpaKomentar } = hapusKomentar(teks.replace(/\r/g, ''), alamat);
  return tanpaKomentar.replace(/\s+/g, ' ').trim();
}

function blokEkspor(teks, alamat) {
  const baris = teks.replace(/\r/g, '').split('\n');
  const mulai = [];
  baris.forEach((b, i) => {
    const m = b.match(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/);
    if (m) mulai.push({ nama: m[1], i });
  });
  const peta = new Map();
  mulai.forEach((s, k) => {
    const akhir = k + 1 < mulai.length ? mulai[k + 1].i : baris.length;
    const blok = baris.slice(s.i, akhir).join('\n');
    peta.set(s.nama, normalkan(blok, alamat));
  });
  return peta;
}

let totalBersama = 0;
let totalSepihak = 0;

for (const [nama, dirA, dirB] of PASANGAN) {
  console.log(`\n-- ${nama} --`);

  let a, b;
  try {
    a = readFileSync(`${AKAR}/${dirA}/${nama}`, 'utf8');
    b = readFileSync(`${AKAR}/${dirB}/${nama}`, 'utf8');
  } catch (e) {
    cek(false, `kedua berkas terbaca`, e.message);
    continue;
  }

  cek(/SALINAN/.test(a), `header "SALINAN" masih ada di ${dirA}`);

  const pa = blokEkspor(a, `${dirA}/${nama}`);
  const pb = blokEkspor(b, `${dirB}/${nama}`);
  cek(pa.size > 0 && pb.size > 0, `ada ekspor yang bisa dibandingkan (${pa.size} vs ${pb.size})`);

  const bersama = [...pa.keys()].filter((k) => pb.has(k));
  const hanyaA = [...pa.keys()].filter((k) => !pb.has(k));
  const hanyaB = [...pb.keys()].filter((k) => !pa.has(k));
  totalBersama += bersama.length;
  totalSepihak += hanyaA.length + hanyaB.length;

  const menyimpang = bersama.filter((k) => pa.get(k) !== pb.get(k));
  cek(
    menyimpang.length === 0,
    `${bersama.length} ekspor bersama isinya SAMA`,
    menyimpang.length
      ? `menyimpang: ${menyimpang.join(', ')}\n          ` +
        menyimpang
          .map((k) => `${k}:\n            mametlite: ${pa.get(k).slice(0, 160)}\n            frontend : ${pb.get(k).slice(0, 160)}`)
          .join('\n          ')
      : undefined,
  );

  if (hanyaA.length) console.log(`       catat: hanya di mametlite → ${hanyaA.join(', ')}`);
  if (hanyaB.length) console.log(`       catat: hanya di frontend  → ${hanyaB.join(', ')}`);
  if (!hanyaA.length && !hanyaB.length) console.log('       catat: tidak ada ekspor sepihak');
}

console.log(`\n-- ringkas --`);
console.log(`ekspor bersama diperiksa: ${totalBersama} · ekspor sepihak (sah, dicatat): ${totalSepihak}`);
cek(totalBersama >= 10, 'jumlah ekspor bersama masuk akal — uji ini tidak diam-diam jadi hampa', totalBersama);

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`}`);
process.exit(gagal === 0 ? 0 : 1);
