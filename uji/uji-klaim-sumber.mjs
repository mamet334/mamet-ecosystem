
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFileSync, mkdirSync } from 'node:fs';

const AKAR = AKAR_REPO;
const { build } = await import(new URL('frontend/node_modules/esbuild/lib/main.js', new URL('../', import.meta.url)).href);

const DIR_SEMENTARA = join(tmpdir(), 'uji-mamet');
mkdirSync(DIR_SEMENTARA, { recursive: true });

const TMP_DIR = DIR_SEMENTARA;
const muat = async (namaTs, namaTmp) => {
  const keluar = await build({
    entryPoints: [`${AKAR}/supabase/functions/agent-process/lib/verification/${namaTs}`],
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

console.log('\n-- akar kata --');
const berbagiAkar = (a, b) => K.akarKata(a).some((x) => K.akarKata(b).includes(x));
cek(berbagiAkar('pembayaran', 'dibayarkan'), 'pembayaran ~ dibayarkan (bertemu di "bayar")', K.akarKata('pembayaran'));
cek(berbagiAkar('bulanan', 'bulan'), 'bulanan ~ bulan');
cek(berbagiAkar('menerima', 'terima'), 'menerima ~ terima (huruf t yang luruh dikembalikan)', K.akarKata('menerima'));
cek(berbagiAkar('ditetapkan', 'menetapkan'), 'ditetapkan ~ menetapkan');
cek(!berbagiAkar('tunjangan', 'jabatan'), 'kata berbeda TIDAK dipaksa cocok');
cek(!berbagiAkar('kinerja', 'kerja'), 'kata pendek tidak dipotong sampai bertemu kebetulan');

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

console.log('\n-- jawaban benar harus selamat --');

const kasusB = 'Pegawai berhak menerima tunjangan kinerja setiap bulan sesuai ketentuan yang berlaku. Tunjangan itu dibayarkan oleh Bendahara Pengeluaran Daerah.';
cek(K.putuskanKlaim(kasusB, ISI).putusan === 'diam',
  'kasus B (hak dikutip dari pasal yang juga memuat larangan) → DIAM, bukan kontradiksi', K.putuskanKlaim(kasusB, ISI));

cek(K.sandaranKlaim('Pembayaran tunjangan dilakukan bulanan.', akar) !== null,
  'kasus F (parafrase ringkas) tetap dianggap bersandar', K.sandaranKlaim('Pembayaran tunjangan dilakukan bulanan.', akar));

const kasusAE = 'Berdasarkan Peraturan Bupati Nomor 19 Tahun 2026, tunjangan kinerja dibayarkan setiap bulan. [Halaman 3] Besaran tunjangan ditetapkan menurut kelas jabatan.';
cek(K.putuskanKlaim(kasusAE, ISI).putusan === 'diam',
  'kasus A & E (nomor regulasi + nomor halaman) → DIAM; angka bukan urusan lapisan ini', K.putuskanKlaim(kasusAE, ISI));

cek(K.putuskanKlaim('Ketiganya sama. Begitu pula sisanya.', ISI).putusan === 'diam',
  'kalimat terlalu pendek untuk dinilai tidak menghasilkan tuduhan');

cek(K.putuskanKlaim(kasusB, []).putusan === 'diam', 'tanpa potongan dokumen → DIAM (tidak menilai apa pun)');

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

const nSimpul = K.nilaiKlaim(SIMPULAN.join(' '), ISI);
cek(nSimpul.takDiputuskan.length >= 2, 'zona diam benar-benar dipakai (ada kalimat yang tak diputuskan)',
  { takDiputuskan: nSimpul.takDiputuskan.length, bersandar: nSimpul.bersandar.length });
cek(K.AMBANG_TUDUH < K.PORSI_SANDARAN, 'ambang tuduh berada di bawah ambang sandaran — zona diam tidak kosong');

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

console.log('\n-- atribusi --');
const nilai = K.nilaiKlaim(sebagianAsing, ISI);
cek(nilai.bersandar.length === 2 && nilai.bersandar[0].sandaran.indeks === 0 && nilai.bersandar[1].sandaran.indeks === 1,
  'tiap klaim ditautkan ke potongan yang benar (Pasal 4 → #0, Pasal 7 → #1)',
  nilai.bersandar.map((b) => ({ k: b.klaim.slice(0, 40), i: b.sandaran.indeks })));
cek(nilai.atribusi.length === 2 && nilai.atribusi.every((a) => a.jumlah === 1), 'atribusi menghitung per potongan', nilai.atribusi);

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

const REVISI_SEBELUM = '8dd5e3b';
const { readFileSync: bacaKendali } = await import('node:fs');
const sumberLama = bacaKendali(new URL(`./kendali-revisi/label_sumber-${REVISI_SEBELUM}.ts.txt`, import.meta.url), 'utf8');
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

console.log('\n-- lapisan DIMATIKAN di periksaLabelSumber --');
const terpasang = L.periksaLabelSumber(jawabanPenuh, JUDUL, ISI);
cek(terpasang.dikoreksi === false && terpasang.jawaban.includes(L.LABEL_VERIFIED),
  'lapisan mati: jawaban bercampur kembali lolos sebagai VERIFIED (seperti sebelum 28 Sep)',
  { dikoreksi: terpasang.dikoreksi, label: terpasang.label });
cek(K.putuskanKlaim(jawabanPenuh, ISI).putusan === 'parsial',
  'modulnya sendiri tetap hidup dan tetap benar — yang dimatikan hanya pemasangannya');

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

const sumberSalah = 'Tunjangan dibayarkan bulanan.\n\nSumber: "Dokumen Yang Tidak Pernah Dilampirkan Sama Sekali"\n\n[STATUS: VERIFIED]';
const lamaTetap = L.periksaLabelSumber(sumberSalah, JUDUL, ISI);
cek(lamaTetap.dikoreksi === true && lamaTetap.label === L.LABEL_HIPOTESIS,
  'penurunan lama (Sumber tidak cocok) tetap HYPOTHESIS, tidak dilonggarkan jadi PARTIAL',
  { label: lamaTetap.label, alasan: lamaTetap.alasan });

console.log('\n-- arah gagal --');
const putusanMungkin = new Set(['diam', 'parsial', 'hipotesis']);
const contoh = [kasusB, kasusAE, sebagianAsing, semuaAsing, jawabanPenuh, 'Ketiganya sama.'];
cek(contoh.every((t) => putusanMungkin.has(K.putuskanKlaim(t, ISI).putusan)),
  'putusan hanya diam / parsial / hipotesis — tidak ada vonis "bertentangan"');
cek(!JSON.stringify(K).includes('CONTRADICT'), 'modul tidak mengenal konsep kontradiksi sama sekali');

console.log('\n-- syarat menyalakan kembali (keduanya harus SUDAH) --');

const PENUTUP_NYATA = [
  'Jika ada yang ingin Anda tambahkan atau ubah, silakan beri tahu saya!',
  'Jika Anda ingin informasi lebih spesifik tentang salah satu dokumen atau topik tertentu, silakan beri tahu saya!',
  'Semoga membantu, Pak Slamet.',
  'Jika ada pertanyaan lain seputar dokumen HCDP OKU, silakan tanya lagi ya!',
  'Kalau ada langkah yang masih bingung, tanya saja ya.',
  'Nama panggilan Anda adalah Pak Slamet.'
];
const dituduh = PENUTUP_NYATA.filter((k) => K.nilaiKlaim(k, ISI).takBersandar.length);
console.log(`       (1) kalimat percakapan dituduh: ${dituduh.length} dari ${PENUTUP_NYATA.length} — ${dituduh.length === 0 ? 'SUDAH beres' : 'BELUM beres'}`);

const EKSTRAPOLASI_NYATA = '**Rekomendasi saya:** Untuk meningkatkan kompetensi ASN secara umum, instansi pemerintah sebaiknya tidak hanya mengandalkan pelatihan klasikal, tetapi juga memadukan pendekatan on-the-job learning seperti coaching, mentoring, rotasi jabatan, dan penugasan lintas unit yang relevan dengan kebutuhan jabatan.';
const KONTEKS_ASN = [
  'Keterangan: Kelompok jabatan ini diisi oleh para staf pelaksana administrasi, teknis operasional, dan pelayanan umum yang tersebar di seluruh dinas, badan, sekretariat, hingga kantor kecamatan di OKU. Kelompok rumpun pelaksana ini juga menjadi fokus utama pemetaan karena mencakup porsi terbesar dari 591 pegawai yang sedang diintervensi peningkatan kompetensinya.\n\n• Jabatan Struktural (Eselon II, III, dan IV): ~8,00% (387 pegawai)',
  'Berdasarkan hasil pelaksanaan pemetaan kompetensi (Asesmen) kepada seluruh pegawai di lingkungan Pemerintah Kabupaten Ogan Komering Ulu, dapat diketahui bahwa sebagian besar pegawai masih memiliki integritas di bawah standar kompetensi yang disyaratkan sesuai jenjang jabatan. Hal ini dapat dilihat bahwa dari hasil pemetaan kompetensi tersebut sebanyak 591 Pegawai masih berada di bawah standar.'
];
const tertangkap = K.nilaiKlaim(EKSTRAPOLASI_NYATA, KONTEKS_ASN).takBersandar.length > 0;
console.log(`       (2) ekstrapolasi sekosakata tertangkap: ${tertangkap ? 'SUDAH' : 'BELUM'} (porsi ${(K.porsiTerbaik(EKSTRAPOLASI_NYATA, KONTEKS_ASN.map(K.akarTeks))?.porsi ?? 0).toFixed(2)})`);

const masihBermasalah = dituduh.length > 0 || !tertangkap;
cek(!masihBermasalah || terpasang.dikoreksi === false,
  'selama kedua syarat belum terpenuhi, lapisan wajib tetap MATI di periksaLabelSumber');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
