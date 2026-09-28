// uji-hakim-bayangan v1 — bagian murni hakim bayangan (T13, 2026-09-28)
//
// Yang diuji di sini TIDAK memanggil model sama sekali: penyusunan prompt, pembacaan balasan,
// ringkasan, label usulan, dan — yang terpenting — TIGA PAGAR yang membuat mode ini "bayangan".
// Mutu vonis hakimnya sendiri tidak bisa diuji di sini; itu yang dijawab data mode bayangan nanti.

import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const SRC = AKAR + '/supabase/functions/agent-process/lib/verification/hakim_bayangan.ts';
const { build } = await import(pathToFileURL(AKAR + '/frontend/node_modules/esbuild/lib/main.js').href);
const TMP_DIR = AKAR + '/frontend/node_modules/.uji-rag';
mkdirSync(TMP_DIR, { recursive: true });

// bundle: true — hakim_bayangan.ts mengimpor klaim_sumber.ts (pecahKlaim dipakai ulang).
// Adapter dan klien Supabase dibiarkan DI LUAR bundel: keduanya dipanggil lewat `await import(...)`
// yang hanya dijalankan saat ada kunci BYOK, dan itu tidak pernah terjadi di uji ini. Menariknya masuk
// hanya akan membawa impor `https:` gaya Deno yang tidak bisa dimuat Node.
const keluar = await build({
  entryPoints: [SRC], bundle: true, platform: 'neutral', write: false, format: 'esm',
  loader: { '.ts': 'ts' },
  external: ['jsr:*', 'https://*', '../adapters/adapter_registry.ts']
});
const TMP = TMP_DIR + '/_hakim_bayangan.mjs';
writeFileSync(TMP, keluar.outputFiles[0].text);
const H = await import(pathToFileURL(TMP).href + '?v=' + Date.now());

console.log('uji-hakim-bayangan v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 320)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. TIGA PAGAR ────────────────────────────────────────────────────────────────────────────
// Ketiganya yang membuat mode ini benar-benar "bayangan". Kalau satu pun jebol, ia bukan bayangan lagi.
console.log('\n-- tiga pagar --');

cek(H.HAKIM_AKTIF(undefined) === false, 'pagar 1: tanpa env sama sekali → MATI');
cek(H.HAKIM_AKTIF({}) === false, 'pagar 1: env kosong → MATI');
cek(H.HAKIM_AKTIF({ hakimBayangan: '' }) === false, 'pagar 1: bendera kosong → MATI');
cek(H.HAKIM_AKTIF({ hakimBayangan: '0' }) === false, 'pagar 1: bendera "0" → MATI');
cek(H.HAKIM_AKTIF({ hakimBayangan: 'true' }) === false, 'pagar 1: hanya "1" yang menyalakan, bukan "true"');
cek(H.HAKIM_AKTIF({ hakimBayangan: '1' }) === true, 'pagar 1: bendera "1" → hidup');

// Pagar 2 dijaga oleh tanda tangannya: mengembalikan Promise<void>. Kalau suatu hari seseorang
// membuatnya mengembalikan vonis, uji ini merah — dan itu sinyal bahwa ia bukan bayangan lagi.
const hasilMati = await H.jalankanHakimBayangan({ env: {} }, { jawaban: 'Apa pun.', isiDokumen: ['x'], labelSistem: '' });
cek(hasilMati === undefined, 'pagar 2: tidak mengembalikan apa pun — mustahil dipakai mengubah label', hasilMati);

// Pagar 3: masukan rusak tidak boleh melempar. Jalur bayangan tak boleh merembet ke jawaban Owner.
let melempar = false;
try {
  await H.jalankanHakimBayangan(null, null);
  await H.jalankanHakimBayangan({ env: { hakimBayangan: '1' } }, { jawaban: null, isiDokumen: null, labelSistem: '' });
  await H.jalankanHakimBayangan({ env: { hakimBayangan: '1' }, model: {}, keys: {} }, { jawaban: 'a', isiDokumen: ['b'], labelSistem: '' });
} catch { melempar = true; }
cek(!melempar, 'pagar 3: masukan rusak / tanpa kunci tidak pernah melempar');

// Pagar tambahan yang sama pentingnya: tanpa kunci pengguna, TIDAK ada panggilan model.
// Dibuktikan dengan rctx yang akan meledak kalau adapter sampai disentuh.
let menyentuhAdapter = false;
const rctxTanpaKunci = {
  env: { hakimBayangan: '1' },
  model: { provider: 'openrouter', model: 'x' },
  keys: {},
  get logger() { menyentuhAdapter = true; return {}; }
};
await H.jalankanHakimBayangan(rctxTanpaKunci, { jawaban: 'Satu kalimat yang cukup panjang untuk dinilai. Dua kalimat yang juga panjang.', isiDokumen: ['dokumen'], labelSistem: '' });
cek(!menyentuhAdapter, 'tanpa kunci BYOK: berhenti sebelum menyentuh model (tidak ada biaya)');

// ── 2. Kalimat yang dikirim ke hakim ─────────────────────────────────────────────────────────
console.log('\n-- pemilihan kalimat --');
const JAWABAN = [
  '# Ringkasan',
  'Tunjangan kinerja pegawai dibayarkan setiap bulan oleh Bendahara Pengeluaran.',
  '| Tahun | Nilai |',
  '| --- | --- |',
  'Ya.',
  'Semoga membantu, Pak Slamet.',
  'Sumber: "PERATURAN BUPATI NOMOR 19 TAHUN 2026"',
  '[STATUS: VERIFIED]'
].join('\n');
const kalimat = H.kalimatUntukHakim(JAWABAN);
cek(kalimat.length === 2, 'judul, tabel, Sumber, label dibuang; kalimat terlalu pendek dibuang', kalimat);
cek(kalimat.some((k) => k.includes('Semoga membantu')),
  'kalimat percakapan TETAP dikirim — justru itu yang ingin diuji apakah hakim mengenalinya', kalimat);
cek(H.kalimatUntukHakim(Array.from({ length: 80 }, (_, i) => `Ini kalimat nomor ${i} yang cukup panjang untuk dinilai.`).join('\n')).length === H.MAKS_KALIMAT,
  `jumlah kalimat dibatasi ${H.MAKS_KALIMAT} — biaya satu pesan bisa diduga`);

// ── 3. Prompt ────────────────────────────────────────────────────────────────────────────────
console.log('\n-- prompt --');
const prompt = H.susunPromptHakim(['Kalimat satu.', 'Kalimat dua.'], ['isi potongan A', 'isi potongan B']);
cek(prompt.includes('[POTONGAN 0]') && prompt.includes('[POTONGAN 1]'), 'potongan diberi nomor');
cek(prompt.includes('1. Kalimat satu.') && prompt.includes('2. Kalimat dua.'), 'kalimat diberi nomor 1-based');
const potonganPanjang = 'x'.repeat(5000);
cek(H.susunPromptHakim(['Satu.'], [potonganPanjang]).length < 3000, `potongan dipotong ${H.MAKS_HURUF_POTONGAN} huruf`);
cek(H.susunPromptHakim(['Satu.'], Array(20).fill('isi')).split('[POTONGAN').length - 1 === H.MAKS_POTONGAN,
  `potongan dibatasi ${H.MAKS_POTONGAN}`);

// Prompt sistem harus memuat aturan ragu — inilah yang membuat kesalahannya jatuh ke arah aman,
// meniru judge_endpoint.ts (Item 55).
cek(H.SISTEM_HAKIM.includes('Kalau ragu') && H.SISTEM_HAKIM.includes('"BERSANDAR"'),
  'prompt memuat aturan ragu → pilih BERSANDAR (salah menuduh lebih merugikan)');
cek(H.SISTEM_HAKIM.includes('TIDAK pernah menyatakan sebuah kalimat salah'),
  'hakim dilarang memvonis SALAH — hanya didukung / tidak / bukan pernyataan');

// ── 4. Membaca balasan model ─────────────────────────────────────────────────────────────────
console.log('\n-- membaca balasan --');
const baik = '[{"n":1,"v":"BERSANDAR","p":0},{"n":2,"v":"TIDAK","p":null},{"n":3,"v":"PERCAKAPAN","p":null}]';
cek(H.bacaPutusanHakim(baik, 3).length === 3, 'JSON bersih terbaca');
cek(H.bacaPutusanHakim('```json\n' + baik + '\n```', 3).length === 3, 'JSON berpagar markdown tetap terbaca');
cek(H.bacaPutusanHakim('Berikut hasilnya:\n' + baik + '\nSemoga membantu.', 3).length === 3, 'JSON dengan kalimat pengantar tetap terbaca');
cek(H.bacaPutusanHakim('bukan json sama sekali', 3).length === 0, 'balasan tak terbaca → daftar KOSONG, bukan lemparan');
cek(H.bacaPutusanHakim('', 3).length === 0, 'balasan kosong → daftar kosong');
cek(H.bacaPutusanHakim('[{"n":9,"v":"BERSANDAR","p":0}]', 3).length === 0, 'nomor kalimat di luar jangkauan dibuang');
cek(H.bacaPutusanHakim('[{"n":1,"v":"NGACO","p":0}]', 3).length === 0, 'vonis tak dikenal dibuang');
cek(H.bacaPutusanHakim('[{"n":1,"v":"BERSANDAR","p":0},{"n":1,"v":"TIDAK","p":null}]', 3).length === 1,
  'putusan ganda untuk kalimat yang sama: hanya yang pertama dipakai');
cek(H.bacaPutusanHakim('[{"n":1,"v":"PERCAKAPAN","p":3}]', 3)[0].p === null,
  'potongan penyandar hanya bermakna untuk BERSANDAR');

// ── 5. Ringkasan & label usulan ──────────────────────────────────────────────────────────────
console.log('\n-- ringkasan & label usulan --');
const r = H.ringkasPutusan(H.bacaPutusanHakim(baik, 3), 5);
cek(r.bersandar === 1 && r.tidak === 1 && r.percakapan === 1, 'hitungan per vonis benar', r);
cek(r.takTerbaca === 2, 'kalimat tanpa putusan dihitung takTerbaca, tidak hilang diam-diam', r);

const usul = (b, t, p) => H.labelUsulan({ bersandar: b, tidak: t, percakapan: p, takTerbaca: 0 });
cek(usul(3, 0, 2) === 'VERIFIED', 'semua yang diputus bersandar → usulan VERIFIED');
cek(usul(2, 1, 1) === 'PARTIAL', 'sebagian bersandar sebagian tidak → usulan PARTIAL');
cek(usul(0, 3, 1) === 'HYPOTHESIS', 'tak satu pun bersandar → usulan HYPOTHESIS');
cek(usul(0, 0, 4) === 'TAK_PASTI', 'hanya kalimat percakapan → TAK_PASTI, bukan VERIFIED');

// ── 6. Kalimat percakapan nyata: BAHAN uji, bukan harapan ────────────────────────────────────
// Inilah kalimat yang menjatuhkan pendekatan leksikal (11 dari 12 dituduh). Di sini ia hanya
// dipastikan IKUT TERKIRIM ke hakim — apakah hakim mengenalinya sebagai PERCAKAPAN adalah
// pertanyaan yang dijawab data mode bayangan, bukan uji ini.
console.log('\n-- kalimat yang menjatuhkan pendekatan leksikal --');
const PENUTUP_NYATA = 'Semoga membantu, Pak Slamet. Jika ada pertanyaan lain seputar dokumen HCDP OKU, silakan tanya lagi ya!';
const kirim = H.kalimatUntukHakim('Tunjangan dibayarkan setiap bulan oleh bendahara daerah.\n' + PENUTUP_NYATA);
cek(kirim.length >= 3, 'kalimat penutup nyata ikut dikirim untuk dinilai hakim', kirim);

// ── 7. Berkas tidak menyimpan isi dokumen ────────────────────────────────────────────────────
// Kuota basis data proyek ini pernah dimakan log (Item 93), dan potongan dokumen memuat isi nyata.
console.log('\n-- hemat & tidak mengarsip ulang isi chat --');
const sumber = readFileSync(SRC, 'utf8');
cek(!/isi_dokumen|isiDokumen:\s*isi|potongan:\s*isi/.test(sumber.split('async function simpanPutusan')[1] || ''),
  'baris tabel tidak menyimpan isi potongan dokumen, hanya jumlahnya');
cek(sumber.includes('slice(0, 160)'), 'kalimat dipotong 160 huruf sebelum disimpan');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
