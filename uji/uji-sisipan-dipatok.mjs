// UJI 2026-10-01 — sisipan konteks DIPATOK: tak boleh ikut terpotong.
//
// ── Kejadian live yang melahirkannya ────────────────────────────────────────────────────────
// Uji peta repo gagal. Diukur, bukan diduga:
//
//   peta repo di proses utama      15.493 huruf   (DevTools: petaRepo().length → 15493)
//   riwayat yang sampai ke model    4.042 huruf   ([PROMPT_KOMPOSISI], 1 Okt 15.00)
//
// Model bukan mengabaikan peta — ia tidak pernah melihatnya. Anggaran dicoret sebagai tersangka:
// bahkan pada anggaran terkecil yang mungkin (ANGGARAN_MIN 8.000 − 2.000 cadangan = 6.000 token),
// peta (±3.873 token) + seluruh riwayat (±1.010 token) masih muat.
//
// Dua cacat, satu akar — sisipan diperlakukan sebagai pesan paling tua:
//   1. `mulaiDari` menghitung panjang daftar TAMPILAN, tetapi dikenakan pada `sisipan + tampilan`.
//   2. Pemotong anggaran membuang dari yang paling tua, dan sisipan ada di posisi paling tua.
//
// Keduanya berakhir sama: konteks yang paling tidak boleh hilang justru yang pertama dikorbankan.

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const K = await import(pathToFileURL(`${AKAR}/frontend/src/core/runtime/services/KonteksChat.js`).href + '?v=' + Date.now());

console.log('uji-sisipan-dipatok v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const { pilihPesanKonteks, PATOK, tokenPesan } = K;
const patok = (teks) => ({ role: 'user', content: teks, [PATOK]: true });
const biasa = (teks, role = 'user') => ({ role, content: teks });
const isi = (n) => 'x'.repeat(n);

// ── 1. Cacat yang diperbaiki: "Bersihkan konteks" tak lagi memakan sisipan ───────────────────
console.log('\n-- mulaiDari hanya berlaku pada percakapan --');
{
  const peta = patok('PETA');
  const pesan = [peta, biasa('p1'), biasa('j1', 'model'), biasa('p2'), biasa('j2', 'model')];
  // Owner menekan "Bersihkan konteks" setelah 2 pesan tampil, lalu bertanya lagi dua kali.
  // Penanda = 2 — panjang daftar TAMPILAN pada saat itu, yang tidak menghitung sisipan.
  const h = pilihPesanKonteks(pesan, { anggaranToken: 60000, mulaiDari: 2 });
  const teks = h.dikirim.map((p) => p.content);

  cek(teks.includes('PETA'), 'sisipan SELAMAT dari "Bersihkan konteks"', teks);
  cek(!teks.includes('p1') && !teks.includes('j1'), 'percakapan lama tetap dipotong sebagaimana mestinya', teks);
  cek(teks[0] === 'PETA', 'sisipan tetap di depan', teks);
  // Sebelum perbaikan, slice(2) dikenakan pada [peta, p1, j1, p2, j2] → ['j1','p2','j2']: sisipan
  // hilang, dan sebagai gantinya j1 yang seharusnya sudah dibersihkan justru ikut terkirim. Indeks
  // yang bergeser merusak kedua arah sekaligus.
  cek(teks.includes('p2') && teks.includes('j2'), 'pesan sesudah batas tetap ikut', teks);
  cek(teks.length === 3, 'tepat 3: sisipan + dua pesan sesudah batas', teks);
}

// ── 2. Cacat kedua: tidak lagi jadi korban pertama saat anggaran menyempit ───────────────────
console.log('\n-- sisipan dihitung lebih dulu --');
{
  const peta = patok(isi(4000));          // 1.004 token (diukur, bukan ditaksir)
  const pesan = [peta, biasa(isi(4000)), biasa(isi(4000)), biasa('pertanyaan terbaru')];
  // Anggaran disetel supaya TEPAT satu pesan lama tak muat: 1.004 (sisipan) + 9 + 1.004 = 2.017
  // masuk, penambahan berikutnya jadi 3.021 dan terlempar. Angka yang terlalu longgar membuat uji
  // ini hijau tanpa pernah benar-benar memotong apa pun.
  const h = pilihPesanKonteks(pesan, { anggaranToken: 2500, sisakanUntukJawaban: 0 });

  cek(h.dikirim[0]?.content === peta.content,
    'saat anggaran sempit, sisipan tetap ikut — bukan yang pertama dibuang', h.dikirim.map((p) => p.content.slice(0, 12)));
  cek(h.dikirim.some((p) => p.content === 'pertanyaan terbaru'), 'pertanyaan terbaru tetap ikut');
  cek(h.patokDilepas === false, 'patokan tidak dilepas pada keadaan ini');
  cek(h.dilewati > 0, 'percakapan lama yang dikorbankan, bukan sisipannya', h.dilewati);
}

// ── 3. Batasnya: patokan DILEPAS bila mengusir pertanyaannya sendiri ─────────────────────────
// Konteks tambahan yang menyingkirkan pertanyaan yang sedang ditanyakan lebih buruk daripada tidak
// ada konteks sama sekali. Tanpa aturan ini, model berjendela sempit akan menerima peta tanpa
// pertanyaan — dan menjawab entah apa.
console.log('\n-- patokan melepaskan diri bila perlu --');
{
  const peta = patok(isi(40000));         // ±10.000 token, jauh di atas anggaran
  const pesan = [peta, biasa('pertanyaan terbaru')];
  const h = pilihPesanKonteks(pesan, { anggaranToken: 3000, sisakanUntukJawaban: 0 });

  cek(h.patokDilepas === true, 'dilaporkan apa adanya lewat patokDilepas — bukan hilang diam-diam');
  cek(h.dikirim.every((p) => p.content !== peta.content), 'sisipan yang tak muat tidak dipaksakan');
  cek(h.dikirim.some((p) => p.content === 'pertanyaan terbaru'),
    'pertanyaannya SELAMAT — itu yang tak boleh hilang', h.dikirim.map((p) => p.content.slice(0, 12)));
}

// ── 4. Penanda internal tidak bocor ke server ────────────────────────────────────────────────
console.log('\n-- penanda tidak ikut terkirim --');
{
  const h = pilihPesanKonteks([patok('PETA'), biasa('tanya')], { anggaranToken: 60000 });
  cek(h.dikirim.every((p) => !(PATOK in p)), 'objek yang dikirim bersih dari penanda internal', h.dikirim);
  cek(h.dikirim[0].role === 'user' && h.dikirim[0].content === 'PETA', 'isi & peran sisipan tetap utuh', h.dikirim[0]);
}

// ── 5. Tanpa sisipan, perilakunya tidak berubah ──────────────────────────────────────────────
// Percakapan Assistant biasa tidak punya sisipan sama sekali; perbaikan ini tidak boleh menggeser
// apa pun di sana.
console.log('\n-- tanpa sisipan, tak ada yang berubah --');
{
  const pesan = [biasa('p1'), biasa('j1', 'model'), biasa('p2')];
  const h = pilihPesanKonteks(pesan, { anggaranToken: 60000, mulaiDari: 1 });
  cek(h.dikirim.map((p) => p.content).join(',') === 'j1,p2', 'mulaiDari tetap bekerja seperti semula', h.dikirim);
  cek(h.patokDilepas === false, 'patokDilepas false bila memang tak ada sisipan');
  cek(h.dilewati === 1, 'hitungan dilewati tetap masuk akal', h.dilewati);
}

// ── 6. TERPASANG di jalur kirim ──────────────────────────────────────────────────────────────
// Fungsi benar tapi sisipannya tidak ditandai = tak ada yang berubah. Itu persis cara cacat ini
// bertahan: kodenya ada, jalurnya tidak.
console.log('\n-- terpasang --');
{
  const CE = readFileSync(`${AKAR}/frontend/src/components/workbench/ConversationEngine.jsx`, 'utf8').replace(/\r\n/g, '\n');
  const CE_KODE = CE.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

  cek(/MIN_PESAN_PADATKAN, PATOK \}/.test(CE_KODE), 'PATOK diimpor komponen', (CE_KODE.match(/.*KonteksChat\.js.*/g) || []));
  cek(/\{ role: 'user', content, \[PATOK\]: true \}/.test(CE_KODE),
    'sisipan ditandai saat dibuat', (CE_KODE.match(/const sisipan = [^\n]*/g) || []));
  // Ketiganya harus ikut tertandai: catatan akar repo, peta repo, dan ingatan temuan.
  cek(/const sisipan = \[catatanAkar, catatanPeta, ringkasanTemuan\]/.test(CE_KODE),
    'ketiga sisipan lewat jalur penandaan yang sama', (CE_KODE.match(/const sisipan = [^\n]*/g) || []));
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
