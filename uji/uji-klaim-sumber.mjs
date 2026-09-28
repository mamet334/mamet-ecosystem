// uji-klaim-sumber v1 — penilaian per-klaim (T13, 2026-09-28)
//
// Yang dijaga uji ini, berurutan menurut bahayanya:
//   1. Lapisan ini TIDAK BOLEH menjatuhkan jawaban benar (kasus B & F yang menjatuhkan CHIMERA).
//   2. Ia HARUS menangkap kalimat yang tidak bersandar di tengah jawaban yang lolos semua
//      pemeriksaan lama — itulah celah yang jadi alasan lapisan ini dibuat.
//   3. UJI KENDALI: celah itu ditunjukkan MASIH ADA pada `periksaLabelSumber` lama, pada masukan
//      yang sama persis. Tanpa ini, uji di atas tidak membuktikan apa-apa.
//
// Modul yang diuji adalah berkas server yang ASLI (TypeScript → esbuild), bukan salinannya —
// aturan "jangan menguji cermin", uji/README.md butir 2.

import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const { build } = await import(new URL('frontend/node_modules/esbuild/lib/main.js', new URL('../', import.meta.url)).href);
const TMP_DIR = AKAR + '/frontend/node_modules/.uji-rag';
mkdirSync(TMP_DIR, { recursive: true });

const muat = async (namaTs, namaTmp) => {
  const keluar = await build({
    entryPoints: [`${AKAR}/supabase/functions/agent-process/lib/verification/${namaTs}`],
    // bundle: true wajib — label_sumber.ts kini mengimpor klaim_sumber.ts, dan impor itu harus ikut
    // masuk ke berkas sementara. Tanpa ini Node mencari `klaim_sumber.ts` di folder sementara.
    bundle: true, platform: 'neutral', write: false, format: 'esm', loader: { '.ts': 'ts' }
  });
  const tmp = `${TMP_DIR}/${namaTmp}`;
  writeFileSync(tmp, keluar.outputFiles[0].text);
  return import(pathToFileURL(tmp).href + '?v=' + Date.now());
};

const K = await muat('klaim_sumber.ts', '_klaim_sumber.mjs');
const L = await muat('label_sumber.ts', '_label_sumber_t13.mjs');

console.log('uji-klaim-sumber v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

// ── Dokumen uji: bentuk pasal nyata — hak dan larangan BERDAMPINGAN dalam satu potongan ──────
// Bentuk inilah yang menjatuhkan CHIMERA (kasus B): satu kata "dilarang" di potongan yang sama
// sudah cukup membuatnya mencap jawaban benar sebagai kontradiksi.
const ISI = [
  [
    'PERATURAN BUPATI NOMOR 19 TAHUN 2026 TENTANG TUNJANGAN KINERJA',
    'Pasal 4: Tunjangan kinerja pegawai dibayarkan setiap bulan oleh Bendahara Pengeluaran Daerah sesuai dengan ketentuan peraturan perundang-undangan yang berlaku.',
    'Pasal 5: Pegawai berhak menerima tunjangan kinerja setiap bulan.',
    'Pasal 6: Pegawai dilarang menerima gratifikasi dalam bentuk apa pun.'
  ].join('\n'),
  'Pasal 7: Besaran tunjangan ditetapkan berdasarkan kelas jabatan dan capaian kinerja bulanan.'
];
const JUDUL = ['PERATURAN BUPATI NOMOR 19 TAHUN 2026 TENTANG TUNJANGAN KINERJA'];
const akar = ISI.map(K.akarTeks);

// ── 1. Akar kata Indonesia ───────────────────────────────────────────────────────────────────
console.log('\n-- akar kata --');
const berbagiAkar = (a, b) => K.akarKata(a).some((x) => K.akarKata(b).includes(x));
cek(berbagiAkar('pembayaran', 'dibayarkan'), 'pembayaran ~ dibayarkan (bertemu di "bayar")', K.akarKata('pembayaran'));
cek(berbagiAkar('bulanan', 'bulan'), 'bulanan ~ bulan');
cek(berbagiAkar('menerima', 'terima'), 'menerima ~ terima (huruf t yang luruh dikembalikan)', K.akarKata('menerima'));
cek(berbagiAkar('ditetapkan', 'menetapkan'), 'ditetapkan ~ menetapkan');
cek(!berbagiAkar('tunjangan', 'jabatan'), 'kata berbeda TIDAK dipaksa cocok');
cek(!berbagiAkar('kinerja', 'kerja'), 'kata pendek tidak dipotong sampai bertemu kebetulan');

// ── 2. Kalimat mana yang dinilai ─────────────────────────────────────────────────────────────
console.log('\n-- pemecahan klaim --');
const jawabanCampur = [
  '# Ringkasan',
  '',
  '- Tunjangan kinerja pegawai dibayarkan setiap bulan oleh Bendahara Pengeluaran.',
  '- Besaran tunjangan ditetapkan berdasarkan kelas jabatan.',
  '',
  '| Tahun | Nilai |',
  '| --- | --- |',
  '| 1 | 12,0% |',
  '',
  '```',
  'SELECT * FROM pegawai;',
  '```',
  '',
  'Apakah ketentuan ini berlaku surut?',
  '',
  'Sumber: "PERATURAN BUPATI NOMOR 19 TAHUN 2026 TENTANG TUNJANGAN KINERJA"',
  '',
  '[STATUS: VERIFIED]'
].join('\n');
const klaimCampur = K.pecahKlaim(jawabanCampur);
cek(klaimCampur.length === 2, 'judul, tabel, blok kode, pertanyaan, Sumber, label — semuanya dilewatkan', klaimCampur);
cek(klaimCampur.every((k) => !k.includes('|') && !k.includes('SELECT')), 'tak ada baris tabel/kode yang lolos jadi klaim', klaimCampur);
cek(K.pecahKlaim('<think>ini nalar panjang sekali</think>\nTunjangan dibayarkan bulanan.').length === 1,
  'blok <think> tidak ikut dinilai (nalar sengaja tampil, tetapi label menilai jawaban akhir)');

// ── 3. PAGAR UTAMA: jawaban benar tidak boleh jatuh ──────────────────────────────────────────
console.log('\n-- jawaban benar harus selamat --');

// Kasus B CHIMERA: mengutip klausa HAK dari potongan yang juga memuat LARANGAN.
const kasusB = 'Pegawai berhak menerima tunjangan kinerja setiap bulan sesuai ketentuan yang berlaku. Tunjangan itu dibayarkan oleh Bendahara Pengeluaran Daerah.';
cek(K.putuskanKlaim(kasusB, ISI).putusan === 'diam',
  'kasus B (hak dikutip dari pasal yang juga memuat larangan) → DIAM, bukan kontradiksi', K.putuskanKlaim(kasusB, ISI));

// Kasus F CHIMERA: parafrase ringkas.
cek(K.sandaranKlaim('Pembayaran tunjangan dilakukan bulanan.', akar) !== null,
  'kasus F (parafrase ringkas) tetap dianggap bersandar', K.sandaranKlaim('Pembayaran tunjangan dilakukan bulanan.', akar));

// Kasus A & E CHIMERA: angka, tahun regulasi, dan nomor halaman tidak boleh jadi alasan.
const kasusAE = 'Berdasarkan Peraturan Bupati Nomor 19 Tahun 2026, tunjangan kinerja dibayarkan setiap bulan. [Halaman 3] Besaran tunjangan ditetapkan menurut kelas jabatan.';
cek(K.putuskanKlaim(kasusAE, ISI).putusan === 'diam',
  'kasus A & E (nomor regulasi + nomor halaman) → DIAM; angka bukan urusan lapisan ini', K.putuskanKlaim(kasusAE, ISI));

cek(K.putuskanKlaim('Ketiganya sama. Begitu pula sisanya.', ISI).putusan === 'diam',
  'kalimat terlalu pendek untuk dinilai tidak menghasilkan tuduhan');

cek(K.putuskanKlaim(kasusB, []).putusan === 'diam', 'tanpa potongan dokumen → DIAM (tidak menilai apa pun)');

// KELAS YANG HAMPIR DIRUSAK oleh rancangan ambang-tunggal. Kalimat simpulan sah miskin kata dokumen
// karena merujuk balik ke kalimat sebelumnya, bukan membawa fakta baru. Diukur: 0,25–0,57, beririsan
// dengan zona asing. Tiga dari lima ini akan dituduh keliru bila ambangnya tunggal 0,34.
const SIMPULAN = [
  'Dengan demikian, pegawai memperoleh haknya secara rutin tiap bulannya.',
  'Singkatnya, aturan itu mengikat bendahara maupun pegawai penerimanya.',
  'Kesimpulannya, kelas jabatan menentukan besarnya penerimaan tiap orang.',
  'Hal ini berarti capaian kinerja seseorang memengaruhi jumlah yang diterimanya.',
  'Perlu dicatat, gratifikasi tetap terlarang meski nilainya kecil.'
];
for (const s of SIMPULAN) {
  const n = K.nilaiKlaim(s, ISI);
  const aman = !n.takBersandar.length;
  cek(aman, `kalimat simpulan tidak dituduh: "${s.slice(0, 46)}…"`, { porsi: K.porsiTerbaik(s, akar)?.porsi });
}
const jawabanBersimpulan = [
  'Tunjangan kinerja pegawai dibayarkan setiap bulan oleh Bendahara Pengeluaran.',
  'Dengan demikian, pegawai memperoleh haknya secara rutin tiap bulannya.',
  'Hal ini berarti capaian kinerja seseorang memengaruhi jumlah yang diterimanya.'
].join(' ');
cek(K.putuskanKlaim(jawabanBersimpulan, ISI).putusan === 'diam',
  'jawaban benar berisi kutipan + dua simpulan → DIAM', K.putuskanKlaim(jawabanBersimpulan, ISI));

// Zona diam harus benar-benar ada, bukan sekadar niat di komentar.
const nSimpul = K.nilaiKlaim(SIMPULAN.join(' '), ISI);
cek(nSimpul.takDiputuskan.length >= 2, 'zona diam benar-benar dipakai (ada kalimat yang tak diputuskan)',
  { takDiputuskan: nSimpul.takDiputuskan.length, bersandar: nSimpul.bersandar.length });
cek(K.AMBANG_TUDUH < K.PORSI_SANDARAN, 'ambang tuduh berada di bawah ambang sandaran — zona diam tidak kosong');

// ── 4. Celah yang memang harus ditangkap ─────────────────────────────────────────────────────
console.log('\n-- ekstrapolasi harus tertangkap --');
const KALIMAT_ASING = 'Selain itu, kementerian pusat berencana meluncurkan platform digital terpadu bagi seluruh provinsi.';
const sebagianAsing = [
  'Tunjangan kinerja pegawai dibayarkan setiap bulan oleh Bendahara Pengeluaran.',
  'Besaran tunjangan ditetapkan berdasarkan kelas jabatan dan capaian kinerja.',
  KALIMAT_ASING
].join(' ');
const pAsing = K.putuskanKlaim(sebagianAsing, ISI);
cek(pAsing.putusan === 'parsial', 'satu kalimat ekstrapolasi di tengah jawaban → PARSIAL', pAsing);
cek(pAsing.putusan === 'parsial' && pAsing.takBersandar.length === 1 && pAsing.takBersandar[0] === KALIMAT_ASING,
  'kalimat yang ditunjuk persis kalimat yang menyimpang', pAsing.takBersandar);

const semuaAsing = 'Reformasi birokrasi nasional menargetkan penyederhanaan struktur organisasi. Kementerian mendorong transformasi digital pelayanan publik daerah.';
cek(K.putuskanKlaim(semuaAsing, ISI).putusan === 'hipotesis',
  'tidak satu pun kalimat bersandar → HIPOTESIS, bukan PARSIAL', K.putuskanKlaim(semuaAsing, ISI));

// ── 5. Atribusi: klaim mana bersandar pada potongan mana ─────────────────────────────────────
console.log('\n-- atribusi --');
const nilai = K.nilaiKlaim(sebagianAsing, ISI);
cek(nilai.bersandar.length === 2 && nilai.bersandar[0].sandaran.indeks === 0 && nilai.bersandar[1].sandaran.indeks === 1,
  'tiap klaim ditautkan ke potongan yang benar (Pasal 4 → #0, Pasal 7 → #1)',
  nilai.bersandar.map((b) => ({ k: b.klaim.slice(0, 40), i: b.sandaran.indeks })));
cek(nilai.atribusi.length === 2 && nilai.atribusi.every((a) => a.jumlah === 1), 'atribusi menghitung per potongan', nilai.atribusi);

// ── 6. UJI KENDALI — celahnya memang ada pada pemeriksa lama ─────────────────────────────────
// Tanpa bagian ini, bagian 4 hanya membuktikan kode baru berjalan, bukan bahwa ia perlu.
console.log('\n-- uji kendali: celah pada pemeriksa lama --');
const jawabanPenuh = [
  'Tunjangan kinerja pegawai dibayarkan setiap bulan oleh Bendahara Pengeluaran.',
  'Besaran tunjangan ditetapkan berdasarkan kelas jabatan dan capaian kinerja.',
  KALIMAT_ASING,
  '',
  'Sumber: "PERATURAN BUPATI NOMOR 19 TAHUN 2026 TENTANG TUNJANGAN KINERJA"',
  '',
  '[STATUS: VERIFIED]'
].join('\n');

// REVISI DIPAKU, BUKAN `HEAD`. Sesudah lapisan ini ikut di-commit, `HEAD` sudah memuatnya dan
// kendalinya mati diam-diam — itu tepat kegagalan yang sudah tercatat di uji/README.md butir 1,
// dan uji ini sempat mengalaminya sebelum baris ini ditulis. 8dd5e3b = commit T13 (dokumen saja),
// versi TERAKHIR sebelum penilaian per-klaim ada.
const REVISI_SEBELUM = '8dd5e3b';
const { execFileSync } = await import('node:child_process');
const sumberLama = execFileSync('git', ['show', `${REVISI_SEBELUM}:supabase/functions/agent-process/lib/verification/label_sumber.ts`],
  { cwd: AKAR, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const TS_LAMA = `${TMP_DIR}/_label_sumber_${REVISI_SEBELUM}.ts`;
writeFileSync(TS_LAMA, sumberLama);
const keluarLama = await build({ entryPoints: [TS_LAMA], bundle: true, platform: 'neutral', write: false, format: 'esm', loader: { '.ts': 'ts' } });
writeFileSync(`${TMP_DIR}/_label_sumber_lama.mjs`, keluarLama.outputFiles[0].text);
const LAMA = await import(pathToFileURL(`${TMP_DIR}/_label_sumber_lama.mjs`).href + '?v=' + Date.now());

cek(!sumberLama.includes('klaim_sumber'), `KENDALI sah: revisi ${REVISI_SEBELUM} memang belum punya lapisan per-klaim`);
const lama = LAMA.periksaLabelSumber(jawabanPenuh, JUDUL, ISI);
cek(lama.dikoreksi === false && lama.jawaban.includes(LAMA.LABEL_VERIFIED),
  `KENDALI: pemeriksa di ${REVISI_SEBELUM} meloloskan jawaban ini utuh sebagai VERIFIED — inilah celahnya`,
  { dikoreksi: lama.dikoreksi, alasan: lama.alasan });

const baru = K.putuskanKlaim(jawabanPenuh, ISI);
cek(baru.putusan === 'parsial', 'lapisan baru menangkapnya pada masukan yang sama persis', baru.putusan);

// ── 6b. TERPASANG: lewat periksaLabelSumber yang asli, bukan lewat modul klaim saja ──────────
// Tanpa bagian ini, bagian 6 hanya membuktikan modulnya benar — bukan bahwa ia tersambung.
// Dua uji minggu lalu lulus persis karena kekeliruan itu.
console.log('\n-- lapisan terpasang di periksaLabelSumber --');
const terpasang = L.periksaLabelSumber(jawabanPenuh, JUDUL, ISI);
cek(terpasang.dikoreksi === true, 'jawaban yang sama kini DIKOREKSI oleh pemeriksa asli', terpasang.alasan);
cek(terpasang.label === L.LABEL_PARSIAL, 'labelnya PARTIAL, bukan HYPOTHESIS', terpasang.label);
cek(terpasang.jawaban.includes(L.LABEL_PARSIAL) && !terpasang.jawaban.includes(L.LABEL_VERIFIED),
  'teks jawaban benar-benar ditukar labelnya');
cek(terpasang.catatan.includes('kementerian'), 'catatan menunjuk kalimat yang menyimpang', terpasang.catatan.slice(0, 160));

// Jawaban benar seutuhnya harus tetap lolos lewat jalur asli.
const jawabanBenarPenuh = [
  'Tunjangan kinerja pegawai dibayarkan setiap bulan oleh Bendahara Pengeluaran.',
  'Besaran tunjangan ditetapkan berdasarkan kelas jabatan dan capaian kinerja.',
  'Dengan demikian, pegawai memperoleh haknya secara rutin tiap bulannya.',
  '',
  'Sumber: "PERATURAN BUPATI NOMOR 19 TAHUN 2026 TENTANG TUNJANGAN KINERJA"',
  '',
  '[STATUS: VERIFIED]'
].join('\n');
const tetap = L.periksaLabelSumber(jawabanBenarPenuh, JUDUL, ISI);
cek(tetap.dikoreksi === false && tetap.jawaban.includes(L.LABEL_VERIFIED),
  'jawaban benar seutuhnya TETAP VERIFIED lewat jalur asli', { dikoreksi: tetap.dikoreksi, alasan: tetap.alasan });

// Penurunan LAMA tidak boleh berubah jadi lebih longgar: label wajib tetap HYPOTHESIS.
const sumberSalah = 'Tunjangan dibayarkan bulanan.\n\nSumber: "Dokumen Yang Tidak Pernah Dilampirkan Sama Sekali"\n\n[STATUS: VERIFIED]';
const lamaTetap = L.periksaLabelSumber(sumberSalah, JUDUL, ISI);
cek(lamaTetap.dikoreksi === true && lamaTetap.label === L.LABEL_HIPOTESIS,
  'penurunan lama (Sumber tidak cocok) tetap HYPOTHESIS, tidak dilonggarkan jadi PARTIAL',
  { label: lamaTetap.label, alasan: lamaTetap.alasan });

// ── 7. Hanya memperketat, tidak pernah melonggarkan ──────────────────────────────────────────
console.log('\n-- arah gagal --');
const putusanMungkin = new Set(['diam', 'parsial', 'hipotesis']);
const contoh = [kasusB, kasusAE, sebagianAsing, semuaAsing, jawabanPenuh, 'Ketiganya sama.'];
cek(contoh.every((t) => putusanMungkin.has(K.putuskanKlaim(t, ISI).putusan)),
  'putusan hanya diam / parsial / hipotesis — tidak ada vonis "bertentangan"');
cek(!JSON.stringify(K).includes('CONTRADICT'), 'modul tidak mengenal konsep kontradiksi sama sekali');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
