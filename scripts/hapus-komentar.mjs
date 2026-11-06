import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const butuh = createRequire(join(AKAR, 'frontend/package.json'));
const ts = butuh('typescript');
const esbuild = await import(pathToFileURL(butuh.resolve('esbuild')).href);

export const POLA_DIREKTIF = /@vite-ignore|eslint-(disable|enable)|@ts-(ignore|expect-error|nocheck|check)|deno-lint-ignore|deno-fmt-ignore|@license|@preserve|^\/\*!|^#!|@jsx|webpackChunkName|istanbul ignore|prettier-ignore|c8 ignore/;

const LOADER = { '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.jsx': 'jsx', '.ts': 'ts', '.tsx': 'tsx' };

function jenisSkrip(alamat) {
  const e = extname(alamat);
  if (e === '.tsx') return ts.ScriptKind.TSX;
  if (e === '.jsx') return ts.ScriptKind.JSX;
  if (e === '.ts') return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

export function rentangKomentar(teks, alamat) {
  const sumber = ts.createSourceFile(alamat, teks, ts.ScriptTarget.Latest, true, jenisSkrip(alamat));
  const terlihat = new Map();
  const ambil = (daftar) => {
    for (const r of daftar || []) {
      if (!terlihat.has(r.pos)) terlihat.set(r.pos, { awal: r.pos, akhir: r.end, teks: teks.slice(r.pos, r.end) });
    }
  };
  const jelajah = (simpul) => {
    if (simpul.kind !== ts.SyntaxKind.JsxText) {
      ambil(ts.getLeadingCommentRanges(teks, simpul.getFullStart()));
      ambil(ts.getTrailingCommentRanges(teks, simpul.getEnd()));
    }
    for (const anak of simpul.getChildren(sumber)) jelajah(anak);
  };
  jelajah(sumber);
  return [...terlihat.values()].sort((a, b) => a.awal - b.awal);
}

export function hapusKomentar(teks, alamat) {
  const semua = rentangKomentar(teks, alamat);
  const buang = semua.filter((r) => !POLA_DIREKTIF.test(r.teks.trim()));

  const jsxRentang = new Set();
  if (/\.jsx$|\.tsx$/.test(alamat)) {
    const sumber = ts.createSourceFile(alamat, teks, ts.ScriptTarget.Latest, true, jenisSkrip(alamat));
    const tandaiJsx = (simpul) => {
      if (simpul.kind === ts.SyntaxKind.JsxExpression) {
        const anak = simpul.getChildren(sumber).filter(
          (c) => c.kind !== ts.SyntaxKind.OpenBraceToken && c.kind !== ts.SyntaxKind.CloseBraceToken,
        );
        if (anak.length === 0) jsxRentang.add(simpul.pos + ',' + simpul.end);
      }
      for (const c of simpul.getChildren(sumber)) tandaiJsx(c);
    };
    tandaiJsx(sumber);
  }

  let hasil = '';
  let posisi = 0;
  for (const r of buang) {
    if (r.awal < posisi) continue;
    const awalBaris = teks.lastIndexOf('\n', r.awal - 1) + 1;
    let akhirBaris = teks.indexOf('\n', r.akhir);
    if (akhirBaris < 0) akhirBaris = teks.length;
    const sebelum = teks.slice(awalBaris, r.awal);
    const sesudah = teks.slice(r.akhir, akhirBaris);

    const kurungBuka = sebelum.trimEnd().endsWith('{');
    const kurungTutup = sesudah.trimStart().startsWith('}');
    let adalahJsxExpr = false;
    if (kurungBuka && kurungTutup) {
      const posBuka = awalBaris + sebelum.lastIndexOf('{');
      const posTutup = r.akhir + sesudah.indexOf('}') + 1;
      for (const k of jsxRentang) {
        const [a, b] = k.split(',').map(Number);
        if (posBuka >= a - 1 && posTutup <= b + 1) { adalahJsxExpr = true; break; }
      }
    }

    if (adalahJsxExpr) {
      const posBuka = awalBaris + sebelum.lastIndexOf('{');
      const posTutup = r.akhir + sesudah.indexOf('}') + 1;
      const sebelumBuka = teks.slice(awalBaris, posBuka);
      const sesudahTutup = teks.slice(posTutup, akhirBaris);
      const barisSendiri = sebelumBuka.trim() === '' && sesudahTutup.trim() === '';
      if (barisSendiri && awalBaris >= posisi) {
        hasil += teks.slice(posisi, awalBaris);
        posisi = akhirBaris < teks.length ? akhirBaris + 1 : akhirBaris;
      } else {
        let awal = posBuka;
        if (sesudahTutup.trim() === '') while (awal > posisi && (teks[awal - 1] === ' ' || teks[awal - 1] === '\t')) awal--;
        hasil += teks.slice(posisi, awal);
        posisi = posTutup;
      }
    } else {
      const barisSendiri = sebelum.trim() === '' && sesudah.trim() === '';
      if (barisSendiri && awalBaris >= posisi) {
        hasil += teks.slice(posisi, awalBaris);
        posisi = akhirBaris < teks.length ? akhirBaris + 1 : akhirBaris;
      } else {
        let awal = r.awal;
        if (sesudah.trim() === '') while (awal > posisi && (teks[awal - 1] === ' ' || teks[awal - 1] === '\t')) awal--;
        hasil += teks.slice(posisi, awal);
        posisi = r.akhir;
      }
    }
  }
  hasil += teks.slice(posisi);
  return { teks: hasil, dibuang: buang.length, dipertahankan: semua.length - buang.length };
}

async function keluaranBuild(teks, alamat) {
  const r = await esbuild.transform(teks, { loader: LOADER[extname(alamat)] || 'js', minifySyntax: true, minifyWhitespace: true, legalComments: 'none' });
  return r.code;
}

export async function samaSesudahBuild(lama, baru, alamat) {
  return (await keluaranBuild(lama, alamat)) === (await keluaranBuild(baru, alamat));
}

async function utama(argumen) {
  const tulis = argumen.includes('--tulis');
  const berkas = argumen.filter((a) => !a.startsWith('--'));
  let gagal = 0;
  for (const b of berkas) {
    const alamat = resolve(AKAR, b);
    const lama = readFileSync(alamat, 'utf8');
    const { teks: baru, dibuang, dipertahankan } = hapusKomentar(lama, alamat);
    const sama = await samaSesudahBuild(lama, baru, alamat);
    const sisa = rentangKomentar(baru, alamat).filter((r) => !POLA_DIREKTIF.test(r.teks.trim())).length;
    const status = sama && sisa === 0 ? 'SAMA' : 'BEDA';
    if (status === 'BEDA') gagal++;
    console.log(`${status}  ${b}  komentar dibuang ${dibuang}, direktif dipertahankan ${dipertahankan}, sisa ${sisa}, ${lama.length} → ${baru.length} huruf`);
    if (tulis && status === 'SAMA') writeFileSync(alamat, baru);
  }
  if (gagal) { console.log(`${gagal} berkas DITOLAK (keluaran build berbeda atau komentar tersisa) — tidak ditulis`); process.exitCode = 1; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await utama(process.argv.slice(2));
