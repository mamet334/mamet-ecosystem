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
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFileSync, mkdirSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const { build } = await import(new URL('frontend/node_modules/esbuild/lib/main.js', new URL('../', import.meta.url)).href);

// Keluaran sementara ditaruh di folder sementara SISTEM, bukan di dalam `node_modules` (8 Okt 2026).
//
// Dulu: `frontend/node_modules/.uji-rag/`. Itu folder yang suite ini JUSTRU dipindahkan dari sana —
// `npm ci` menghapus `node_modules`, dan itulah yang dulu melenyapkan 48 berkas uji sekaligus
// (lihat `uji/README.md`). Berkas ujinya ikut pindah ke repo; alamat keluaran sementaranya tidak,
// jadi separuh masalahnya tertinggal. Dibuktikan 8 Okt: folder itu disembunyikan sesaat, dan empat
// berkas uji langsung jatuh dengan ENOENT — kegagalan yang tidak terlihat seperti "kode rusak".
//
// Alasan asli memilih `node_modules` (Vite tidak memantaunya, jadi menulis di sana tidak memicu
// aplikasi memuat ulang saat Owner sedang memakainya) justru LEBIH terpenuhi di sini: Vite tidak
// memantau folder sementara sistem sama sekali.
const DIR_SEMENTARA = join(tmpdir(), 'uji-mamet');
mkdirSync(DIR_SEMENTARA, { recursive: true });

const TMP_DIR = DIR_SEMENTARA;
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
// LAPISAN INI DIMATIKAN (keputusan Owner, 28 Sep 2026, sesudah uji live). Uji di bawah menjaga
// bahwa ia benar-benar mati — bukan setengah mati — sehingga perilaku label kembali persis seperti
// sebelum hari ini. Alasannya ada di komentar `LAPISAN_KLAIM_AKTIF` di label_sumber.ts.
console.log('\n-- lapisan DIMATIKAN di periksaLabelSumber --');
const terpasang = L.periksaLabelSumber(jawabanPenuh, JUDUL, ISI);
cek(terpasang.dikoreksi === false && terpasang.jawaban.includes(L.LABEL_VERIFIED),
  'lapisan mati: jawaban bercampur kembali lolos sebagai VERIFIED (seperti sebelum 28 Sep)',
  { dikoreksi: terpasang.dikoreksi, label: terpasang.label });
cek(K.putuskanKlaim(jawabanPenuh, ISI).putusan === 'parsial',
  'modulnya sendiri tetap hidup dan tetap benar — yang dimatikan hanya pemasangannya');

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

// ── 8. SYARAT MENYALAKAN KEMBALI ─────────────────────────────────────────────────────────────
// Dua kegagalan yang TERUKUR PADA DATA NYATA 28 Sep 2026, ditulis sebagai uji supaya tidak bisa
// dilupakan. Selama keduanya masih berbunyi "BELUM", `LAPISAN_KLAIM_AKTIF` harus tetap false.
// Kalau suatu hari keduanya berubah jadi "SUDAH", lapisan itu boleh dinyalakan lagi.
console.log('\n-- syarat menyalakan kembali (keduanya harus SUDAH) --');

// (1) Kalimat percakapan tidak boleh dituduh. Ini kalimat penutup NYATA dari jawaban VERIFIED Owner,
//     disalin dari chats.messages. Saat diukur: 11 dari 12 dituduh, dan 20 dari 83 jawaban VERIFIED
//     (24,1%) memuat kalimat semacam ini — kira-kira satu dari empat jawaban benar akan turun.
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

// (2) Ekstrapolasi SEKOSAKATA harus tertangkap. Paragraf ini disalin dari jawaban live 28 Sep 02:58;
//     ia bicara ASN, kompetensi, pelatihan — kata-kata yang sama dengan dokumennya — lalu mendarat
//     di zona diam (0,17–0,21) dan lolos. Ekstrapolasi karangan di bagian 4 terlalu mudah karena
//     asing secara KOSAKATA; yang nyata asing secara ASAL-USUL saja.
// Potongan di bawah disalin dari document_chunks NYATA (DOKUMEN HCDP 2025-2026.docx), bukan diringkas.
// Ini penting: percobaan pertama uji ini memakai satu potongan pendek buatan sendiri dan melaporkan
// porsi 0,12 — "SUDAH beres" — padahal pada konteks live yang sesungguhnya angkanya 0,18 dan kalimat
// itu LOLOS. Konteks yang lebih miskin membuat porsi lebih rendah, jadi ujinya berbohong ke arah yang
// menyenangkan. Kesalahan yang sama persis dengan yang sedang dicatat uji ini.
const EKSTRAPOLASI_NYATA = '**Rekomendasi saya:** Untuk meningkatkan kompetensi ASN secara umum, instansi pemerintah sebaiknya tidak hanya mengandalkan pelatihan klasikal, tetapi juga memadukan pendekatan on-the-job learning seperti coaching, mentoring, rotasi jabatan, dan penugasan lintas unit yang relevan dengan kebutuhan jabatan.';
const KONTEKS_ASN = [
  'Keterangan: Kelompok jabatan ini diisi oleh para staf pelaksana administrasi, teknis operasional, dan pelayanan umum yang tersebar di seluruh dinas, badan, sekretariat, hingga kantor kecamatan di OKU. Kelompok rumpun pelaksana ini juga menjadi fokus utama pemetaan karena mencakup porsi terbesar dari 591 pegawai yang sedang diintervensi peningkatan kompetensinya.\n\n• Jabatan Struktural (Eselon II, III, dan IV): ~8,00% (387 pegawai)',
  'Berdasarkan hasil pelaksanaan pemetaan kompetensi (Asesmen) kepada seluruh pegawai di lingkungan Pemerintah Kabupaten Ogan Komering Ulu, dapat diketahui bahwa sebagian besar pegawai masih memiliki integritas di bawah standar kompetensi yang disyaratkan sesuai jenjang jabatan. Hal ini dapat dilihat bahwa dari hasil pemetaan kompetensi tersebut sebanyak 591 Pegawai masih berada di bawah standar.'
];
const tertangkap = K.nilaiKlaim(EKSTRAPOLASI_NYATA, KONTEKS_ASN).takBersandar.length > 0;
console.log(`       (2) ekstrapolasi sekosakata tertangkap: ${tertangkap ? 'SUDAH' : 'BELUM'} (porsi ${(K.porsiTerbaik(EKSTRAPOLASI_NYATA, KONTEKS_ASN.map(K.akarTeks))?.porsi ?? 0).toFixed(2)})`);

// Uji ini TIDAK gagal karena kedua syarat belum terpenuhi — itu keadaan yang sudah diketahui dan
// sengaja dipilih. Yang dijaga: selama syaratnya belum beres, lapisannya wajib tetap mati.
const masihBermasalah = dituduh.length > 0 || !tertangkap;
cek(!masihBermasalah || terpasang.dikoreksi === false,
  'selama kedua syarat belum terpenuhi, lapisan wajib tetap MATI di periksaLabelSumber');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
