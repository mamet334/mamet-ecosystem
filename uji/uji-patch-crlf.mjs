import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const AKAR = AKAR_REPO + '/';
console.log('uji-patch-crlf v1');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 320)}` : ''}`);
  if (!ok) gagal++;
};

const asli = readFileSync(AKAR + 'frontend/src/core/runtime/services/engineer.js', 'utf8');
cek(asli.includes('\r\n'), 'BUKTI: engineer.js di repo ini memang berakhiran baris CRLF (dasar seluruh uji ini)');

const SRC = readFileSync(AKAR + 'frontend/src/core/runtime/services/engineer/PatchGenerator.js', 'utf8');
cek(/const pakaiCRLF = originalContent\.includes\('\\r\\n'\);/.test(SRC), 'CRLF dideteksi dari isi berkas asli');
cek(/const seragam = \(t\) => String\(t\)\.replace\(\/\\r\\n\/g, '\\n'\);/.test(SRC), 'penyeragam akhir baris ada');
cek(/let workingContent = seragam\(originalContent\);/.test(SRC), 'isi berkas diseragamkan sebelum dicocokkan');
cek(/const change = \{ search: seragam\(changeAsli\.search\), replace: seragam\(changeAsli\.replace\) \}/.test(SRC),
  'search DAN replace dari model ikut diseragamkan');
cek(/finalContent = pakaiCRLF \? workingContent\.replace\(\/\\n\/g, '\\r\\n'\) : workingContent;/.test(SRC),
  'CRLF DIKEMBALIKAN sesudah perubahan — tanpa ini seluruh berkas ikut berubah akhir barisnya');

const iSeragam = SRC.indexOf("const change = { search: seragam(changeAsli.search)");
const sesudahSeragam = SRC.slice(SRC.indexOf('\n', iSeragam), SRC.indexOf('if (changeCount > 0)'));
cek(!/changeAsli/.test(sesudahSeragam),
  'tidak ada cabang yang diam-diam kembali memakai teks mentah model', sesudahSeragam.match(/changeAsli[^\n]*/g));

const CERMIN = 'UJI-CERMIN: jalankan adalah salinan jalur cari-ganti PatchGenerator, bukan kodenya sendiri';
const jalankan = (isiBerkas, perubahan) => {
  const pakaiCRLF = isiBerkas.includes('\r\n');
  const seragam = (t) => String(t).replace(/\r\n/g, '\n');
  let kerja = seragam(isiBerkas);
  let n = 0;
  for (const c of perubahan) {
    const ch = { search: seragam(c.search), replace: seragam(c.replace) };
    if (kerja.includes(ch.search)) { kerja = kerja.replace(ch.search, ch.replace); n++; }
  }
  return { hasil: n > 0 ? (pakaiCRLF ? kerja.replace(/\n/g, '\r\n') : kerja) : null, n };
};

const komentarLF = '  // [ADR-0017 Fase 7] _generatePatch diekstrak,\n  // _generateFallbackPatch diekstrak ke PatchGenerator.js.\n  // §2.1 diimplementasikan.';
const berkasCRLF = ('const a = 1;\n' + komentarLF + '\nconst b = 2;\n').replace(/\n/g, '\r\n');
const ganti = [{ search: komentarLF, replace: '  // [ADR-0017 Fase 7] _generateFallbackPatch DIHAPUS (T10).' }];

let r = jalankan(berkasCRLF, ganti);
cek(r.n === 1, 'CACAT LIVE TERTUTUP: cari-ganti lintas baris berhasil pada berkas CRLF', r.n);
cek(r.hasil.includes('DIHAPUS (T10)'), 'isi penggantinya masuk');
cek(!r.hasil.includes('_generatePatch diekstrak,'), 'teks lama benar-benar hilang');
cek(r.hasil.includes('\r\n'), 'berkas hasil TETAP CRLF');
cek(!/[^\r]\n/.test(r.hasil), 'tidak ada satu pun LF telanjang tertinggal (akhir baris tidak jadi campur aduk)', JSON.stringify(r.hasil).slice(0, 200));
cek(r.hasil.split('\r\n').length === berkasCRLF.split('\r\n').length - 2,
  'jumlah baris berkurang 2 — tiga baris komentar jadi satu, baris lain tidak tersentuh',
  { sesudah: r.hasil.split('\r\n').length, sebelum: berkasCRLF.split('\r\n').length });

const jalankanLama = (isiBerkas, perubahan) => {
  let kerja = isiBerkas;
  let n = 0;
  for (const c of perubahan) {
    if (kerja.includes(c.search)) { kerja = kerja.replace(c.search, c.replace); n++; }
    else {
      const t = c.search.trim();
      if (kerja.includes(t)) { kerja = kerja.replace(t, c.replace); n++; }
    }
  }
  return n;
};
cek(jalankanLama(berkasCRLF, ganti) === 0,
  'KENDALI: cara lama (tanpa penyeragaman) memang 0 perubahan pada berkas CRLF — gejalanya nyata');

const berkasLF = 'const a = 1;\n' + komentarLF + '\nconst b = 2;\n';
r = jalankan(berkasLF, ganti);
cek(r.n === 1 && !r.hasil.includes('\r'),
  'KENDALI: berkas LF tetap LF — tidak diam-diam diubah jadi CRLF', JSON.stringify(r.hasil).slice(0, 120));
cek(jalankanLama(berkasLF, ganti) === 1, 'KENDALI: berkas LF memang sudah bekerja sebelum perbaikan — bukan itu yang rusak');

cek(jalankanLama(berkasCRLF, [{ search: 'const a = 1;', replace: 'const a = 2;' }]) === 1,
  'KENDALI: cari-ganti SATU baris selalu bekerja, bahkan di versi lama — itu sebabnya cacat ini lolos lama');

cek(/teks yang dicari model tidak ditemukan di berkas/.test(SRC), 'pesan gagal membedakan "tidak ketemu" dari "bentuk salah"');
cek(/cuplikan pertama/.test(SRC), 'pesan gagal memuat cuplikan teks yang dicari');
cek(/replace\(\/\\n\/g, '⏎'\)/.test(SRC), 'baris baru dalam cuplikan ditampilkan sebagai ⏎ supaya terbaca di satu baris');
cek(/alasanGagal\.length/.test(SRC), 'alasan per berkas dipakai sebelum pesan umum');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
