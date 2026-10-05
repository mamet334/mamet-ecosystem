// UJI 2026-10-05 — konstitusi berhenti dibaca-lalu-dibuang; indeksnya benar-benar sampai.
//
// ── Dua cacat yang SALING MENYEMBUNYIKAN ────────────────────────────────────────────────────
//
// 1. PEMBOROSAN. `_loadStaticKnowledge()` membaca 33 berkas konstitusi tiap boot
//    (168.299 huruf ≈ 43.942 token) ke `brain.static.raw`. Diperiksa di seluruh repo:
//    `raw` punya NOL pemakai. Yang mengalir hanya `loadedFiles.length`, dan angka itu pun
//    berhenti di `brain.dynamic` yang cuma ditugaskan dan tak pernah dibaca.
//
//    Akibatnya Engineer melaporkan "Coverage BRAIN 1 ✓" tanpa pernah membaca satu pun aturan
//    yang Owner tulis — dan "BRAIN 1" yang dilaporkannya itu sebenarnya 7 baris dari
//    `project_memory_entries`, bukan konstitusi.
//
// 2. DAFTAR YANG MELENCENG. 32 jalurnya dipaku, dan sudah tidak cocok dengan foldernya:
//    `constitution/28_PROSEDUR_KERJA_ENGINEER.md` ADA di disk tetapi TIDAK di daftar — justru
//    berkas yang mengatur cara Engineer bekerja. Tak ada yang menyadarinya berbulan-bulan
//    karena isinya toh dibuang: cacat kedua bersembunyi di balik yang pertama.
//
// ── ARAH BIAYANYA BERLAWANAN dengan item 120, dan itu disengaja ─────────────────────────────
//
// Peta repo bisa DIPANGKAS karena ia sudah dikirim. Konstitusi TIDAK dikirim sama sekali, jadi
// indeks ini MENAMBAH ±384 token per pesan. Owner memutuskannya dengan sadar sesudah angka itu
// disodorkan dua kali. Berkas uji ini menjaga agar biayanya tetap terukur, bukan merayap.

import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const tanpaKomentar = (s) => s.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

console.log('uji-indeks-konstitusi v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const esbuild = await import(pathToFileURL(join(AKAR, 'frontend/node_modules/esbuild/lib/main.js')).href);
const dir = mkdtempSync(join(tmpdir(), 'uji-kons-'));

try {
  const { code } = await esbuild.transform(baca('frontend/src/core/runtime/services/engineer/ProsedurEngineer.js'), { loader: 'js', format: 'esm' });
  writeFileSync(join(dir, 'pe.mjs'), code);
  const P = await import(pathToFileURL(join(dir, 'pe.mjs')).href);
  const { catatanKonstitusi } = P;

  // ── 1. BENTUK DASAR ───────────────────────────────────────────────────────────────────────
  console.log('\n-- bentuk dasar --');
  cek(catatanKonstitusi([]) === '', 'daftar kosong -> catatan kosong, bukan kerangka tanpa isi');
  cek(catatanKonstitusi(null) === '', 'null -> kosong, bukan lempar');
  cek(catatanKonstitusi([{ judul: 'tanpa alamat' }]) === '', 'butir tanpa alamat dibuang; kalau semua dibuang -> kosong');

  const contoh = [
    { alamat: 'AGENTS.md', judul: '' },
    { alamat: 'constitution/24_ANTI_HALLUCINATION_PROTOCOL.md', judul: 'ANTI-HALU PROTOCOL' },
    { alamat: 'constitution/28_PROSEDUR_KERJA_ENGINEER.md', judul: '' },
  ];
  const teks = catatanKonstitusi(contoh);

  cek(teks.includes('AGENTS.md'), 'alamat ikut');
  cek(teks.includes('ANTI-HALU PROTOCOL'), 'judul ikut bila ada');
  cek(/\b3 berkas\b/.test(teks), 'jumlahnya disebut, jadi model tahu daftarnya utuh atau tidak', teks.slice(0, 120));

  // ── 2. INDEKS, BUKAN ISI — dan itu harus DIKATAKAN ───────────────────────────────────────
  // Tanpa kalimat ini, model bisa mengira daftar inilah seluruh konstitusinya.
  console.log('\n-- indeks, bukan isi --');
  cek(/DAFTAR, bukan isinya/.test(teks), 'dikatakan terang bahwa ini daftar, bukan isi');
  cek(/git show HEAD:/.test(teks), 'dan diberi CARA membacanya, bukan sekadar diberi tahu ada');
  cek(/MAMET_CMD/.test(teks), 'dalam bentuk penanda yang memang bisa dijalankan Engineer');

  // ── 3. TIGA BAHAYA YANG DIBAWA INDEKS ────────────────────────────────────────────────────
  // Sama seperti peta repo jadi indeks (item 120): memangkas membuka kelas kesalahan baru,
  // dan larangannya ditulis DI DALAM indeksnya sendiri, bukan diserahkan pada ingatan model.
  console.log('\n-- bahaya yang dibawa indeks --');
  cek(/JANGAN mengaku sudah membaca/.test(teks),
    'dilarang mengaku sudah membaca yang belum dibuka — inilah cacat aslinya ("Coverage BRAIN 1 ✓")');
  cek(/JANGAN menyimpulkan sebuah aturan TIDAK ADA/.test(teks),
    'dilarang menyimpulkan aturan tak ada dari judul — sebagian judul cuma nama berkas');
  cek(/BACA berkasnya lebih\s+dulu/.test(teks),
    'dan diwajibkan membaca lebih dulu untuk pertanyaan aturan, bukan menjawab dari ingatan');
  cek(/AGENTS\.md menempatkan Konstitusi DI ATAS kode sumber/.test(teks),
    'alasannya disebut: AGENTS.md menempatkan konstitusi di atas kode sumber');

  // ── 4. BIAYANYA TERUKUR, bukan merayap ───────────────────────────────────────────────────
  // Indeks ini MENAMBAH token. Kalau suatu hari ia membengkak diam-diam, uji ini yang bersuara.
  console.log('\n-- biaya terukur --');
  {
    const kons = join(AKAR, 'constitution');
    const nyata = [
      { alamat: 'INIT.md', judul: '' },
      { alamat: 'AGENTS.md', judul: '' },
      ...(existsSync(kons) ? readdirSync(kons).filter((f) => f.toLowerCase().endsWith('.md')).sort()
        .map((f) => ({ alamat: `constitution/${f}`, judul: '' })) : []),
    ];
    const t = catatanKonstitusi(nyata);
    const token = Math.round(t.length / 3.83);
    console.log(`       (${nyata.length} berkas -> ${t.length} huruf ≈ ${token} token)`);
    cek(nyata.length >= 30, 'folder konstitusi nyata terbaca untuk pengukuran', nyata.length);
    cek(token < 700, `biaya di bawah 700 token (${token}) — di atas itu, timbang ulang`, token);
    cek(t.length < 4000, 'dan jauh di bawah isi penuhnya (168.299 huruf)', t.length);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// ── 4b. PEMINDAI SUNGGUHAN DIJALANKAN pada folder NYATA ─────────────────────────────────────
//
// Ini bagian terpenting berkas ini. Cacat yang ditutup adalah daftar yang MELENCENG diam-diam;
// menggantinya dengan pemindai yang hanya diperiksa lewat TEKS berarti ia bisa melenceng lagi
// dengan cara yang sama tanpa ada yang tahu. Jadi fungsinya dijalankan, bukan dibaca.
console.log('\n-- pemindai dijalankan pada folder nyata --');
{
  const { indeksKonstitusi, HURUF_KEPALA } = await import(pathToFileURL(join(AKAR, 'frontend/electron/indeksKonstitusi.cjs')).href)
    .then((m) => m.default || m);

  const hasil = indeksKonstitusi(AKAR);
  const alamat = hasil.map((d) => d.alamat);

  cek(hasil.length >= 30, `memindai folder nyata: ${hasil.length} berkas`, hasil.length);
  cek(alamat.includes('INIT.md') && alamat.includes('AGENTS.md'), 'berkas akar ikut');

  // INILAH cacat yang luput berbulan-bulan. Bila asersi ini jatuh, pemindainya melenceng lagi.
  cek(alamat.includes('constitution/28_PROSEDUR_KERJA_ENGINEER.md'),
    'berkas 28_PROSEDUR_KERJA_ENGINEER.md IKUT — inilah yang hilang dari daftar paku', alamat.slice(-3));

  // Tak ada yang tertinggal: hasil pindai harus memuat SEMUA .md di folder itu.
  const kons = join(AKAR, 'constitution');
  const disk = existsSync(kons) ? readdirSync(kons).filter((f) => f.toLowerCase().endsWith('.md')).map((f) => `constitution/${f}`) : [];
  const luput = disk.filter((f) => !alamat.includes(f));
  cek(luput.length === 0, 'tidak satu pun .md di folder yang luput', luput);

  cek(hasil.every((d) => typeof d.judul === 'string'), 'tiap butir punya judul bertipe string (boleh kosong)');
  const berjudul = hasil.filter((d) => d.judul);
  cek(berjudul.length > 0 && berjudul.length < hasil.length,
    `judul hanya untuk yang menambah informasi (${berjudul.length}/${hasil.length})`, berjudul.length);
  cek(!hasil.some((d) => d.judul && d.judul.toLowerCase().replace(/[^a-z0-9]/g, '')
      === d.alamat.split('/').pop().replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '')),
    'dan tak ada judul yang cuma mengulang nama berkasnya');

  cek(HURUF_KEPALA <= 4000, `hanya kepala berkas yang dibaca (${HURUF_KEPALA} huruf)`, HURUF_KEPALA);

  // Akar yang tidak sah tidak boleh melempar — Engineer tanpa akar repo harus tetap hidup.
  cek(indeksKonstitusi('').length === 0, 'akar kosong -> daftar kosong, bukan lempar');
  cek(indeksKonstitusi(null).length === 0, 'akar null -> kosong');
  cek(indeksKonstitusi(join(AKAR, 'folder-yang-tidak-ada')).length === 0, 'akar tak ada -> kosong');
}

// ── 5. PEMBOROSANNYA BENAR-BENAR DICABUT ────────────────────────────────────────────────────
console.log('\n-- isi tidak lagi dibaca lalu dibuang --');
{
  const E = tanpaKomentar(baca('frontend/src/core/runtime/services/engineer.js'));
  cek(!/raw: staticData/.test(E), 'brain.static.raw TIDAK diisi lagi — ini pemborosan aslinya');
  cek(!/const staticData = \{\}/.test(E), 'dan penampungnya ikut hilang, bukan sekadar tak dipakai');
  cek(!/await this\.storageManager\.read\(path\)/.test(E),
    'tidak ada lagi 33 pembacaan berkas per boot lewat storageManager');
  cek(/indeksKonstitusi\?\.\(\)/.test(E), 'diganti pemindaian di proses utama');
  cek(/terpindai/.test(E), 'dan hasilnya ditandai: dipindai, atau daftar cadangan');

  // Cadangan WAJIB tetap ada. Tanpa ini, Electron lama tanpa kanal baru akan membuat Engineer
  // kehilangan seluruh konstitusinya — perbaikan yang menukar satu kerugian dengan kerugian lain.
  cek(/constitutionPaths\.map\(/.test(E),
    'daftar lama DIPERTAHANKAN sebagai cadangan bila pemindaian gagal');
}

// ── 6. TERPASANG DI JALUR KIRIM, dan ikut DIPATOK ───────────────────────────────────────────
// Sisipan yang tidak dipatok akan jadi korban pertama pemotongan anggaran — itu persis
// kegagalan peta repo 1 Okt (15.493 huruf disusun, 4.042 sampai).
console.log('\n-- terpasang & dipatok --');
{
  const C = tanpaKomentar(baca('frontend/src/components/workbench/ConversationEngine.jsx'));
  cek(/import \{[^}]*\bcatatanKonstitusi\b[^}]*\} from '[^']*ProsedurEngineer\.js'/.test(C), 'diimpor dari ProsedurEngineer');
  cek(/indeksKonstitusi\?\.\(\)/.test(C), 'daftarnya diambil dari proses utama');
  cek(/const catatanKons = catatanKonstitusi\(daftarKonstitusi\)/.test(C), 'catatannya disusun');
  cek(/sisipan = \[catatanAkar, catatanKons, catatanPeta, ringkasanTemuan\]/.test(C),
    'dan MASUK sisipan bersama akar repo & peta — yang dipatok, jadi tak jadi korban pemotongan');

  const PR = tanpaKomentar(baca('frontend/electron/preload.cjs'));
  cek(/indeksKonstitusi: \(\) => ipcRenderer\.invoke\('engineer:indeks-konstitusi'\)/.test(PR), 'kanal IPC terbuka di preload');

  const M = tanpaKomentar(baca('frontend/electron/main.cjs'));
  cek(/ipcMain\.handle\('engineer:indeks-konstitusi'/.test(M), 'dan ditangani di proses utama');
  // Logikanya TIDAK boleh tinggal di main.cjs: berkas itu menyalakan Electron saat diimpor,
  // jadi apa pun di dalamnya hanya bisa diuji lewat teks. Untuk perbaikan yang menutup
  // kelencengan diam-diam, itu tidak cukup — lihat bagian 4b yang MENJALANKANNYA.
  cek(/require\('\.\/indeksKonstitusi\.cjs'\)/.test(M), 'pemindainya diimpor dari modul yang bisa diuji');
  cek(/return indeksKonstitusi\(akarRepo\(\)\)/.test(M), 'dan main.cjs hanya meneruskan akar repo ke sana');
  cek(!/readdirSync|slice\(0, 2000\)/.test(M.slice(M.indexOf("'engineer:indeks-konstitusi'"), M.indexOf("'engineer:peta-repo'"))),
    'tak ada lagi logika pemindaian yang terkubur di main.cjs');
  cek(!/raw|staticData/.test(M.slice(M.indexOf("'engineer:indeks-konstitusi'"), M.indexOf("'engineer:peta-repo'"))),
    'dan isinya tidak ikut menyeberangi IPC');
}

// ── 7. CACAT KEDUA: berkas yang hilang dari daftar paku ─────────────────────────────────────
// Dijaga sebagai fakta, bukan cerita: bila 28 suatu hari masuk daftar paku, asersi ini jatuh
// dan catatan di atas harus ditinjau ulang.
console.log('\n-- daftar paku memang sudah melenceng --');
{
  const E = baca('frontend/src/core/runtime/services/engineer.js');
  const blok = E.slice(E.indexOf('constitutionPaths'), E.indexOf('DIUBAH 5 Oktober 2026'));
  const dipaku = [...blok.matchAll(/'([^']+\.md)'/g)].map((m) => m[1]);
  const kons = join(AKAR, 'constitution');
  const disk = existsSync(kons) ? readdirSync(kons).filter((f) => f.toLowerCase().endsWith('.md')).map((f) => `constitution/${f}`) : [];
  const hilang = disk.filter((f) => !dipaku.includes(f));
  cek(dipaku.length > 20, 'daftar paku masih ada sebagai cadangan', dipaku.length);
  cek(hilang.includes('constitution/28_PROSEDUR_KERJA_ENGINEER.md'),
    'dan TERBUKTI melenceng: 28_PROSEDUR_KERJA_ENGINEER.md ada di disk, tidak di daftar', hilang);
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
