
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-cari-judul-nomor v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const dir = mkdtempSync(join(tmpdir(), 'uji-judul-'));
const muat = async (sumber, nama, loader) => {
  const { code } = await esbuild.transform(baca(sumber), { loader, format: 'esm' });
  writeFileSync(join(dir, nama), code);
  return import(pathToFileURL(join(dir, nama)).href);
};

try {
  const CJ = await muat('supabase/functions/agent-process/lib/rag/cari_judul.ts', 'cj.mjs', 'ts');
  const KS = await muat('shared/KnowledgeService.js', 'ks.mjs', 'js');
  const { kataKunciJudul, LEBAR_PADDING } = CJ;
  const { kataKunciPencarian } = KS;
  const judul = (q) => kataKunciJudul(q, kataKunciPencarian(q));

  console.log('\n-- cacat hulu: token pendek dibuang --');
  cek(JSON.stringify(kataKunciPencarian('kepbup 17')) === '["kepbup"]',
    'kataKunciPencarian TETAP membuang "17" — sengaja tak disentuh demi patokan 14/14',
    kataKunciPencarian('kepbup 17'));
  cek(!kataKunciPencarian('kepbup nomor 7').includes('7'), 'dan tetap membuang "7"');

  console.log('\n-- jalur judul memulihkan nomor --');
  {
    const a = judul('kepbup 17');
    cek(a.includes('17'), 'angka apa adanya ikut — lubang pertama ditutup', a);
    cek(a.includes('017'), 'dan varian berpadding tiga digit — lubang kedua ditutup', a);
    cek(a.includes('kepbup'), 'kata dari saringan lama tetap terbawa', a);
    cek(a.length >= 2, 'minimal dua kata — di bawah itu fungsi SQL memulangkan kosong', a.length);
  }
  {
    const a = judul('kepbup nomor 7');
    cek(a.includes('007'), 'satu digit ikut dipadkan ke tiga', a);
    cek(a.includes('07'), 'dan ke dua, karena konvensi dua digit sama lazimnya', a);
  }

  console.log('\n-- dua arah --');
  {
    const a = judul('kepbup 017');
    cek(a.includes('017') && a.includes('17'),
      '"017" juga mencoba "17" — korpus lain boleh jadi menyimpan tanpa padding', a);
  }

  console.log('\n-- yang sudah bekerja tetap sama --');
  {
    const lama = kataKunciPencarian('kepbup 204');
    const baru = judul('kepbup 204');
    cek(baru.length === lama.length && lama.every((w) => baru.includes(w)),
      'tiga digit: daftarnya PERSIS sama seperti sebelum perubahan', { lama, baru });
  }
  {
    const q = 'apa isi dokumen ini';
    cek(JSON.stringify(judul(q)) === JSON.stringify(kataKunciPencarian(q)),
      'pertanyaan tanpa angka: tidak ada tambahan apa pun', judul(q));
  }

  console.log('\n-- tepi --');
  cek(Array.isArray(judul('')) && judul('').length === 0, 'teks kosong -> daftar kosong');
  cek(kataKunciJudul('kepbup 17', undefined).includes('017'), 'dasar tak diberikan -> tetap jalan');
  cek(kataKunciJudul(null, []).length === 0, 'teks null -> kosong, bukan lempar');
  {
    const a = judul('kepbup 000');
    cek(a.includes('0'), '"000" tidak jadi string kosong saat nol dikupas', a);
  }
  {
    const a = judul('kepbup 2025');
    cek(!a.some((w) => /^0+2025$/.test(w)), 'angka panjang tidak dipadkan dengan nol di depan', a);
  }
  cek(JSON.stringify(LEBAR_PADDING) === '[2,3]', 'lebar padding tercatat sebagai konstanta', LEBAR_PADDING);

  {
    const a = judul('kepbup 17 dan kepbup 17');
    cek(new Set(a).size === a.length, 'tidak ada kata ganda walau pertanyaannya mengulang', a);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('\n-- terpasang di jalur yang benar --');
{
  const DS = tanpaKomentar(baca('supabase/functions/agent-process/lib/rag/document_search.ts'));
  cek(/import \{[^}]*kataKunciJudul[^}]*\} from '\.\/cari_judul\.ts'/.test(DS), 'diimpor dari cari_judul');
  cek(/const kataJudul = kataKunciJudul\(finalMessage, kataKunci\)/.test(DS), 'dibangun dari kata kunci yang sama, bukan sumber terpisah');
  cek(/match_documents_judul'[\s\S]{0,120}query_words: kataJudul/.test(DS), 'dipakai oleh pencarian JUDUL');

  const dipakaiJudul = (DS.match(/query_words: kataJudul\b/g) || []).length;
  const dipakaiKunci = (DS.match(/query_words: kataKunci\b/g) || []).length;
  cek(dipakaiJudul === 1, `kataJudul dipakai TEPAT satu kali sebagai query_words (${dipakaiJudul})`, dipakaiJudul);
  cek(dipakaiKunci === 1, `dan kataKunci tetap memasok jalur hybrid (${dipakaiKunci})`, dipakaiKunci);
  cek(/argumenDasar[\s\S]{0,400}?query_words: kataKunci\b/.test(DS) || /query_words: kataKunci\b/.test(DS),
    'hybrid tetap memakai kataKunci apa adanya — patokan 14/14 tetap sebanding');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
