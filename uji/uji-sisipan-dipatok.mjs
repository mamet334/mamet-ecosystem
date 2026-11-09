
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const AKAR = AKAR_REPO;
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

console.log('\n-- mulaiDari hanya berlaku pada percakapan --');
{
  const peta = patok('PETA');
  const pesan = [peta, biasa('p1'), biasa('j1', 'model'), biasa('p2'), biasa('j2', 'model')];
  const h = pilihPesanKonteks(pesan, { anggaranToken: 60000, mulaiDari: 2 });
  const teks = h.dikirim.map((p) => p.content);

  cek(teks.includes('PETA'), 'sisipan SELAMAT dari "Bersihkan konteks"', teks);
  cek(!teks.includes('p1') && !teks.includes('j1'), 'percakapan lama tetap dipotong sebagaimana mestinya', teks);
  cek(teks[0] === 'PETA', 'sisipan tetap di depan', teks);
  cek(teks.includes('p2') && teks.includes('j2'), 'pesan sesudah batas tetap ikut', teks);
  cek(teks.length === 3, 'tepat 3: sisipan + dua pesan sesudah batas', teks);
}

console.log('\n-- sisipan dihitung lebih dulu --');
{
  const peta = patok(isi(4000));
  const pesan = [peta, biasa(isi(4000)), biasa(isi(4000)), biasa('pertanyaan terbaru')];
  const h = pilihPesanKonteks(pesan, { anggaranToken: 2500, sisakanUntukJawaban: 0 });

  cek(h.dikirim[0]?.content === peta.content,
    'saat anggaran sempit, sisipan tetap ikut — bukan yang pertama dibuang', h.dikirim.map((p) => p.content.slice(0, 12)));
  cek(h.dikirim.some((p) => p.content === 'pertanyaan terbaru'), 'pertanyaan terbaru tetap ikut');
  cek(h.patokDilepas === false, 'patokan tidak dilepas pada keadaan ini');
  cek(h.dilewati > 0, 'percakapan lama yang dikorbankan, bukan sisipannya', h.dilewati);
}

console.log('\n-- patokan melepaskan diri bila perlu --');
{
  const peta = patok(isi(40000));
  const pesan = [peta, biasa('pertanyaan terbaru')];
  const h = pilihPesanKonteks(pesan, { anggaranToken: 3000, sisakanUntukJawaban: 0 });

  cek(h.patokDilepas === true, 'dilaporkan apa adanya lewat patokDilepas — bukan hilang diam-diam');
  cek(h.dikirim.every((p) => p.content !== peta.content), 'sisipan yang tak muat tidak dipaksakan');
  cek(h.dikirim.some((p) => p.content === 'pertanyaan terbaru'),
    'pertanyaannya SELAMAT — itu yang tak boleh hilang', h.dikirim.map((p) => p.content.slice(0, 12)));
}

console.log('\n-- penanda ikut terkirim --');
{
  const h = pilihPesanKonteks([patok('PETA'), biasa('tanya')], { anggaranToken: 60000 });
  cek(h.dikirim[0][PATOK] === true, 'sisipan MEMBAWA penandanya — server membutuhkannya', h.dikirim[0]);
  cek(h.dikirim[1][PATOK] === undefined, 'pesan percakapan biasa tetap tak bertanda', h.dikirim[1]);
  cek(h.dikirim[0].role === 'user' && h.dikirim[0].content === 'PETA', 'isi & peran sisipan tetap utuh', h.dikirim[0]);
}

console.log('\n-- tanpa sisipan, tak ada yang berubah --');
{
  const pesan = [biasa('p1'), biasa('j1', 'model'), biasa('p2')];
  const h = pilihPesanKonteks(pesan, { anggaranToken: 60000, mulaiDari: 1 });
  cek(h.dikirim.map((p) => p.content).join(',') === 'j1,p2', 'mulaiDari tetap bekerja seperti semula', h.dikirim);
  cek(h.patokDilepas === false, 'patokDilepas false bila memang tak ada sisipan');
  cek(h.dilewati === 1, 'hitungan dilewati tetap masuk akal', h.dilewati);
}

console.log('\n-- terpasang --');
{
  const CE = readFileSync(`${AKAR}/frontend/src/components/workbench/ConversationEngine.jsx`, 'utf8').replace(/\r\n/g, '\n');
  const CE_KODE = CE.split('\n').filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b)).join('\n');

  cek(/MIN_PESAN_PADATKAN, PATOK \}/.test(CE_KODE), 'PATOK diimpor komponen', (CE_KODE.match(/.*KonteksChat\.js.*/g) || []));
  cek(/\{ role: 'user', content, \[PATOK\]: true \}/.test(CE_KODE),
    'sisipan ditandai saat dibuat', (CE_KODE.match(/const sisipan = [^\n]*/g) || []));
  const larik = (CE_KODE.match(/const sisipan = \[([^\]]*)\]/) || [])[1] || '';
  const unsur = larik.split(',').map((s) => s.trim()).filter(Boolean);
  cek(unsur.length >= 3, `larik sisipan terbaca (${unsur.length} unsur)`, unsur);
  cek(unsur.includes('catatanAkar') && unsur.includes('catatanPeta') && unsur.includes('ringkasanTemuan'),
    'akar repo, peta repo, dan ingatan temuan semuanya di dalamnya', unsur);
  cek((CE_KODE.match(/\[PATOK\]: true/g) || []).length === 1,
    'dan hanya ADA SATU tempat penandaan — jadi seluruh isi larik lewat jalur yang sama',
    (CE_KODE.match(/\[PATOK\]: true/g) || []).length);
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
