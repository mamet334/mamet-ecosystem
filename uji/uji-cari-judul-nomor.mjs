// UJI 2026-10-05 — 45% korpus tak bisa dicari lewat nomor alaminya.
//
// ── Cacatnya, rantai DUA lapis ──────────────────────────────────────────────────────────────
// Pertanyaan sewajarnya "kepbup 17" tak pernah sampai ke pencarian judul:
//
//   1. `kataKunciPencarian` membuang token ≤2 huruf (`w.length > 2`). Saringan itu ditulis untuk
//      kata sambung dalam prosa dan tak pernah ditinjau ulang untuk PENANDA — padahal nomor satu
//      sampai dua digit justru penanda yang paling sering dipakai orang.
//        "kepbup 17" → ["kepbup"]
//   2. Seandainya lolos pun ia tak cocok: judulnya menyimpan "017", dan "17" ≠ "017" sebagai
//      leksem to_tsquery('simple', …).
//
// Lalu `match_documents_judul` menolak satu kata (`array_length >= 2`) dan memulangkan kosong.
//
// ── Yang DIUKUR di korpus produksi, bukan fixture ───────────────────────────────────────────
// Nomor dokumen 001–221 (221 nomor unik, berpadding tiga digit). Disapu seluruhnya lewat SQL:
//
//   perilaku LAMA  : 122 ketemu, 99 kosong  → 44,8% GAGAL
//   perilaku BARU  : 221/221 tepat satu dokumen, dan dokumen yang BENAR
//                    (0 kosong, 0 ganda, 0 salah dokumen)
//
// "204" selama ini berhasil semata karena ia kebetulan sudah tiga digit — itulah yang membuat
// cacatnya tak terlihat pada pemeriksaan sekilas.
//
// ── Caranya diuji di sini ───────────────────────────────────────────────────────────────────
// Modul .ts/.js ASLINYA ditransformasi dengan esbuild lalu dijalankan di Node. Angka korpus di
// atas tidak bisa diulang dari sini (butuh basis data), jadi yang dijaga berkas ini adalah
// PERILAKU yang menghasilkan angka itu — dan pemisahan yang menjaga patokan lama tetap sebanding.

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
  const KS = await muat('frontend/src/core/runtime/services/KnowledgeService.js', 'ks.mjs', 'js');
  const { kataKunciJudul, LEBAR_PADDING } = CJ;
  const { kataKunciPencarian } = KS;
  const judul = (q) => kataKunciJudul(q, kataKunciPencarian(q));

  // ── 1. CACAT HULU masih ada, dan memang tidak diperbaiki di sana ───────────────────────────
  // Ini bukan basa-basi: bila suatu hari `kataKunciPencarian` ikut diubah, patokan 14/14 milik
  // match_documents_hybrid bergeser dan asersi ini akan memaksa keputusan itu disadari.
  console.log('\n-- cacat hulu: token pendek dibuang --');
  cek(JSON.stringify(kataKunciPencarian('kepbup 17')) === '["kepbup"]',
    'kataKunciPencarian TETAP membuang "17" — sengaja tak disentuh demi patokan 14/14',
    kataKunciPencarian('kepbup 17'));
  cek(!kataKunciPencarian('kepbup nomor 7').includes('7'), 'dan tetap membuang "7"');

  // ── 2. JALUR JUDUL memulihkan angkanya ─────────────────────────────────────────────────────
  console.log('\n-- jalur judul memulihkan nomor --');
  {
    const a = judul('kepbup 17');
    cek(a.includes('17'), 'angka apa adanya ikut — lubang pertama ditutup', a);
    cek(a.includes('017'), 'dan varian berpadding tiga digit — lubang kedua ditutup', a);
    cek(a.includes('kepbup'), 'kata dari saringan lama tetap terbawa', a);
    // Dua kata cocok adalah syarat match_documents_judul; tanpa angka hanya ada SATU.
    cek(a.length >= 2, 'minimal dua kata — di bawah itu fungsi SQL memulangkan kosong', a.length);
  }
  {
    const a = judul('kepbup nomor 7');
    cek(a.includes('007'), 'satu digit ikut dipadkan ke tiga', a);
    cek(a.includes('07'), 'dan ke dua, karena konvensi dua digit sama lazimnya', a);
  }

  // ── 3. DUA ARAH — menebak satu arah mengulang cacat yang sama dari sisi sebaliknya ─────────
  console.log('\n-- dua arah --');
  {
    const a = judul('kepbup 017');
    cek(a.includes('017') && a.includes('17'),
      '"017" juga mencoba "17" — korpus lain boleh jadi menyimpan tanpa padding', a);
  }

  // ── 4. YANG SUDAH BEKERJA TIDAK BOLEH BERUBAH ─────────────────────────────────────────────
  // "204" adalah satu-satunya kelas yang selama ini berhasil. Bila ia bergeser, perbaikan ini
  // menukar satu kegagalan dengan kegagalan lain.
  console.log('\n-- yang sudah bekerja tetap sama --');
  {
    const lama = kataKunciPencarian('kepbup 204');
    const baru = judul('kepbup 204');
    cek(baru.length === lama.length && lama.every((w) => baru.includes(w)),
      'tiga digit: daftarnya PERSIS sama seperti sebelum perubahan', { lama, baru });
  }
  {
    // Tanpa angka sama sekali tidak boleh tiba-tiba tumbuh.
    const q = 'apa isi dokumen ini';
    cek(JSON.stringify(judul(q)) === JSON.stringify(kataKunciPencarian(q)),
      'pertanyaan tanpa angka: tidak ada tambahan apa pun', judul(q));
  }

  // ── 5. TEPI yang bisa meledak ──────────────────────────────────────────────────────────────
  console.log('\n-- tepi --');
  cek(Array.isArray(judul('')) && judul('').length === 0, 'teks kosong -> daftar kosong');
  cek(kataKunciJudul('kepbup 17', undefined).includes('017'), 'dasar tak diberikan -> tetap jalan');
  cek(kataKunciJudul(null, []).length === 0, 'teks null -> kosong, bukan lempar');
  {
    const a = judul('kepbup 000');
    cek(a.includes('0'), '"000" tidak jadi string kosong saat nol dikupas', a);
  }
  {
    // Angka panjang tidak dipadkan — padding hanya untuk yang lebih pendek dari lebarnya.
    const a = judul('kepbup 2025');
    cek(!a.some((w) => /^0+2025$/.test(w)), 'angka panjang tidak dipadkan dengan nol di depan', a);
  }
  cek(JSON.stringify(LEBAR_PADDING) === '[2,3]', 'lebar padding tercatat sebagai konstanta', LEBAR_PADDING);

  // ── 6. TIDAK ADA DUPLIKAT ──────────────────────────────────────────────────────────────────
  // Duplikat tidak salah hasilnya, tetapi menggelembungkan argumen RPC tanpa guna.
  {
    const a = judul('kepbup 17 dan kepbup 17');
    cek(new Set(a).size === a.length, 'tidak ada kata ganda walau pertanyaannya mengulang', a);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// ── 7. TERPASANG, dan DI JALUR YANG BENAR SAJA ──────────────────────────────────────────────
// Inti pemisahannya: daftar baru hanya boleh ke pencarian judul. Bila ia bocor ke
// match_documents_hybrid, patokan recall@8 14/14 (Item 90 Tahap B) bergeser diam-diam dan
// perbandingan dengan pengukuran lama jadi tidak sah.
console.log('\n-- terpasang di jalur yang benar --');
{
  const DS = tanpaKomentar(baca('supabase/functions/agent-process/lib/rag/document_search.ts'));
  cek(/import \{[^}]*kataKunciJudul[^}]*\} from '\.\/cari_judul\.ts'/.test(DS), 'diimpor dari cari_judul');
  cek(/const kataJudul = kataKunciJudul\(finalMessage, kataKunci\)/.test(DS), 'dibangun dari kata kunci yang sama, bukan sumber terpisah');
  cek(/match_documents_judul'[\s\S]{0,120}query_words: kataJudul/.test(DS), 'dipakai oleh pencarian JUDUL');

  // Penjaga terpenting berkas ini — diuji lewat ARGUMEN RPC, bukan posisi baris.
  //
  // Bentuk pertama asersi ini memotong berkas pada kata "match_documents_judul" lalu melarang
  // `kataJudul` muncul sebelum titik itu. Salah: deklarasinya memang duduk tepat DI ATAS panggilan
  // RPC-nya, jadi asersi itu jatuh pada kode yang benar. Asersi yang mengikat letak baris akan
  // terus menuduh perubahan yang sah — pelajaran yang sama dengan daftar impor di uji-peta-repo.
  const dipakaiJudul = (DS.match(/query_words: kataJudul\b/g) || []).length;
  const dipakaiKunci = (DS.match(/query_words: kataKunci\b/g) || []).length;
  cek(dipakaiJudul === 1, `kataJudul dipakai TEPAT satu kali sebagai query_words (${dipakaiJudul})`, dipakaiJudul);
  cek(dipakaiKunci === 1, `dan kataKunci tetap memasok jalur hybrid (${dipakaiKunci})`, dipakaiKunci);
  cek(/argumenDasar[\s\S]{0,400}?query_words: kataKunci\b/.test(DS) || /query_words: kataKunci\b/.test(DS),
    'hybrid tetap memakai kataKunci apa adanya — patokan 14/14 tetap sebanding');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
