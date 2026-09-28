// uji-chimera-verifier-nyata v1 — bukti untuk T13 (ROADMAP-TEMUAN-TERBUKA.md)
//
// Dua hal diperiksa pada `chimera_wasm_bundle.ts` yang ditawarkan masuk `agent-process`:
//   1. KEAMANAN — daftar bagian biner WASM. Impor adalah SATU-SATUNYA cara modul WASM
//      menyentuh dunia luar. Nol impor = tidak bisa jaringan, berkas, atau variabel lingkungan.
//   2. KEBENARAN — binernya (bukan sumber Rust-nya) dijalankan terhadap kasus berbentuk
//      dokumen Mamet NYATA, bukan benchmark buatannya sendiri.
//
// PRASYARAT: folder CHIMERA ada di laptop. Kode uji ikut repo, binernya tidak
// (aturan uji/README.md: "kode ikut repo, data tinggal di laptop").
// Kalau folder itu tidak ada, uji ini melapor DILEWATI dan keluar dengan kode 0.

import { readFileSync, existsSync } from 'node:fs';

console.log('uji-chimera-verifier-nyata v1');

const JALUR_BUNDEL = 'd:/SLAMET/other/hack/engine/chimera-verifier/bindings/chimera_wasm_bundle.ts';

if (!existsSync(JALUR_BUNDEL)) {
  console.log(`DILEWATI — bundel CHIMERA tidak ada di laptop ini (${JALUR_BUNDEL})`);
  process.exit(0);
}

// ── Ambil biner dari dalam berkas TypeScript ────────────────────────────────
const isi = readFileSync(JALUR_BUNDEL, 'utf8');
const PENANDA = "CHIMERA_WASM_BASE64 = '";
const mulai = isi.indexOf(PENANDA);
if (mulai < 0) throw new Error('penanda CHIMERA_WASM_BASE64 tidak ditemukan');
const awalB64 = mulai + PENANDA.length;
const b64 = isi.slice(awalB64, isi.indexOf("'", awalB64));
const biner = Buffer.from(b64, 'base64');

let gagal = 0;
const periksa = (nama, lulus, catatan) => {
  if (!lulus) gagal++;
  console.log(`${lulus ? 'OK   ' : 'GAGAL'} ${nama}${catatan ? ` — ${catatan}` : ''}`);
};

// ── BAGIAN 1: audit bagian (section) biner WASM ─────────────────────────────
console.log('\n── 1. Audit biner ──');
console.log(`ukuran biner : ${biner.length} bita`);
console.log(`magic        : ${biner.subarray(0, 4).toString('hex')}`);

const NAMA_BAGIAN = {
  0: 'custom', 1: 'type', 2: 'IMPORT', 3: 'function', 4: 'table', 5: 'memory',
  6: 'global', 7: 'export', 8: 'start', 9: 'element', 10: 'code', 11: 'data', 12: 'data-count'
};
let p = 8;
const bacaLeb = () => {
  let hasil = 0, geser = 0, b;
  do { b = biner[p++]; hasil |= (b & 0x7f) << geser; geser += 7; } while (b & 0x80);
  return hasil;
};
const bagian = [];
while (p < biner.length) {
  const id = biner[p++];
  const panjang = bacaLeb();
  bagian.push({ id, nama: NAMA_BAGIAN[id] ?? `?${id}`, panjang, awal: p });
  p += panjang;
}
console.log('bagian       : ' + bagian.map((b) => b.nama).join(', '));

periksa('biner adalah modul WASM sah', biner.subarray(0, 4).toString('hex') === '0061736d');
periksa(
  'NOL IMPOR — modul tidak bisa menyentuh jaringan/berkas/env',
  !bagian.some((b) => b.id === 2),
  'impor adalah satu-satunya jalan WASM keluar dari dirinya'
);

const bagianEkspor = bagian.find((b) => b.id === 7);
const ekspor = [];
if (bagianEkspor) {
  p = bagianEkspor.awal;
  const n = bacaLeb();
  for (let i = 0; i < n; i++) {
    const panjangNama = bacaLeb();
    const nama = biner.subarray(p, p + panjangNama).toString('utf8');
    p += panjangNama;
    p++;          // jenis
    bacaLeb();    // indeks
    ekspor.push(nama);
  }
}
console.log('ekspor       : ' + ekspor.join(', '));
periksa(
  'tidak ada jalan belajar (learn/update/train)',
  !ekspor.some((n) => /learn|train|update|feed/i.test(n)),
  'verifier = fungsi murni; data yang mengalir TIDAK mengubahnya'
);

// ── Pembungkus panggilan, meniru verifyWithChimera() dari bundel ────────────
const instance = new WebAssembly.Instance(new WebAssembly.Module(biner), {});
const { memory, alloc_bytes, dealloc_bytes, verify_rag_raw } = instance.exports;
const enc = new TextEncoder();
const dec = new TextDecoder();

function verify(jawaban, potongan, bolehParsial = true) {
  const a = enc.encode(jawaban || '');
  const pa = alloc_bytes(a.length);
  new Uint8Array(memory.buffer, pa, a.length).set(a);
  const c = enc.encode(JSON.stringify(potongan || []));
  const pc = alloc_bytes(c.length);
  new Uint8Array(memory.buffer, pc, c.length).set(c);
  try {
    const rapat = verify_rag_raw(pa, a.length, pc, c.length, bolehParsial ? 1 : 0);
    const rp = Number(rapat >> 32n);
    const rl = Number(rapat & 0xFFFFFFFFn);
    const keluar = dec.decode(new Uint8Array(memory.buffer, rp, rl));
    dealloc_bytes(rp, rl);
    return JSON.parse(keluar);
  } finally {
    dealloc_bytes(pa, a.length);
    dealloc_bytes(pc, c.length);
  }
}

// ── BAGIAN 2: kasus berbentuk dokumen Mamet nyata ───────────────────────────
// Tiap kasus menyebut apa yang dibuktikannya, supaya kegagalan bisa dibaca tanpa
// membuka dokumen roadmap.
const kasus = [
  {
    nama: 'A. Kutipan benar yang menyebut nomor & tahun regulasi',
    buktikan: 'tahun 2026 tidak ada di potongan → dianggap ekstrapolasi',
    harap: 'VERIFIED',
    jawaban: 'Berdasarkan Peraturan Bupati Nomor 19 Tahun 2026, tunjangan kinerja pegawai dibayarkan setiap bulan. [STATUS: VERIFIED]',
    potongan: ['PERATURAN BUPATI NOMOR 19 TAHUN 2026 TENTANG TUNJANGAN KINERJA\nPasal 4: Tunjangan kinerja pegawai dibayarkan setiap bulan oleh Bendahara Pengeluaran.']
  },
  {
    nama: 'B. Kutipan benar klausa HAK dari pasal yang juga memuat LARANGAN',
    buktikan: 'polaritas diperiksa se-POTONGAN, bukan se-kalimat — jawaban BENAR dicap KONTRADIKSI',
    harap: 'VERIFIED',
    jawaban: 'Pegawai berhak menerima tunjangan kinerja setiap bulan sesuai ketentuan yang berlaku. [STATUS: VERIFIED]',
    potongan: ['Pasal 5: Pegawai berhak menerima tunjangan kinerja setiap bulan.\nPasal 6: Pegawai dilarang menerima gratifikasi dalam bentuk apa pun.']
  },
  {
    nama: 'C. Pembalikan polaritas — kasus benchmark dokumen CHIMERA',
    buktikan: 'satu-satunya kasus yang memang tertangkap (kata persis ada di daftarnya)',
    harap: 'CONTRADICTED',
    jawaban: 'Pegawai diperbolehkan menerima gratifikasi dari pihak ketiga. [STATUS: VERIFIED]',
    potongan: ['Pasal 6: Pegawai dilarang menerima gratifikasi dalam bentuk apa pun.']
  },
  {
    nama: 'D. Pembalikan polaritas yang sama, kata lain ("terlarang")',
    buktikan: 'kebutaan negasi yang diklaim diperbaiki masih utuh di luar daftar 5 frasa',
    harap: 'CONTRADICTED',
    jawaban: 'Pegawai dapat menerima gratifikasi dari pihak ketiga. [STATUS: VERIFIED]',
    potongan: ['Pasal 6: Penerimaan gratifikasi oleh pegawai terlarang dalam bentuk apa pun.']
  },
  {
    nama: 'E. Jawaban benar yang menyebut nomor halaman rujukan',
    buktikan: 'angka [Halaman 3] dianggap angka klaim yang tak ada di dokumen',
    harap: 'VERIFIED',
    jawaban: 'Tunjangan kinerja dibayarkan setiap bulan. [Halaman 3] [STATUS: VERIFIED]',
    potongan: ['Pasal 4: Tunjangan kinerja dibayarkan setiap bulan oleh Bendahara Pengeluaran.']
  },
  {
    nama: 'F. Jawaban benar berbentuk parafrase ringkas',
    buktikan: 'ambang 55% tumpang-tindih token menurunkan parafrase yang sah',
    harap: 'VERIFIED',
    jawaban: 'Pembayaran tunjangan dilakukan bulanan. [STATUS: VERIFIED]',
    potongan: ['Pasal 4: Tunjangan kinerja pegawai dibayarkan setiap bulan oleh Bendahara Pengeluaran Daerah sesuai dengan ketentuan peraturan perundang-undangan yang berlaku.']
  }
];

console.log('\n── 2. Vonis atas kasus Mamet nyata ──');
let salah = 0;
for (const k of kasus) {
  const v = verify(k.jawaban, k.potongan, true);
  const cocok = v.status === k.harap;
  if (!cocok) salah++;
  console.log(`${cocok ? 'OK   ' : 'SALAH'} ${k.nama}`);
  console.log(`        harap=${k.harap} dapat=${v.status} (yakin ${v.confidence})`);
  console.log(`        dibuktikan: ${k.buktikan}`);
}

// Temuan T13 dicatat sebagai 5 dari 6 salah. Uji ini LULUS bila keadaan itu masih sama —
// kalau CHIMERA diperbaiki suatu hari, uji ini akan GAGAL dan itu berarti T13 perlu ditinjau ulang.
periksa(
  'keadaan T13 masih sama (5 dari 6 kasus salah)',
  salah === 5,
  `sekarang ${salah} salah — kalau berubah, tinjau ulang T13 di ROADMAP-TEMUAN-TERBUKA.md`
);

// ── Fungsi murni: panggilan berulang memberi vonis identik ──────────────────
const sekali = JSON.stringify(verify(kasus[1].jawaban, kasus[1].potongan, true));
const lagi = JSON.stringify(verify(kasus[1].jawaban, kasus[1].potongan, true));
periksa('vonis identik pada panggilan berulang', sekali === lagi, 'tak ada keadaan yang menumpuk');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
