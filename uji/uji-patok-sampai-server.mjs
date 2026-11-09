
import { fileURLToPath as alamatBerkasUji__ } from 'node:url';
const AKAR_REPO = alamatBerkasUji__(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import { pathToFileURL } from 'node:url';

const AKAR = AKAR_REPO;
const imp = (p) => import(pathToFileURL(`${AKAR}/${p}`).href + '?v=' + Date.now());

const K = await imp('frontend/src/core/runtime/services/KonteksChat.js');
const H = await imp('supabase/functions/agent-process/lib/request/history_compressor.ts');
const { pilihPesanKonteks, PATOK } = K;
const { rapikanRiwayat } = H;

console.log("uji-patok-sampai-server v2");
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

const patok = (teks) => ({ role: 'user', content: teks, [PATOK]: true });
const biasa = (teks, role = 'user') => ({ role, content: teks });
const isi = (n) => 'x'.repeat(n);

console.log('\n-- penanda ikut ke payload --');
{
  const h = pilihPesanKonteks([patok('PETA'), biasa('tanya')], { anggaranToken: 60000 });
  cek(h.dikirim[0][PATOK] === true, 'sisipan membawa penandanya saat dikirim', h.dikirim[0]);
  cek(h.dikirim[1][PATOK] === undefined, 'pesan biasa TIDAK ikut tertandai', h.dikirim[1]);
  cek(h.dikirim[0].content === 'PETA' && h.dikirim[0].role === 'user', 'isi & peran tetap utuh');
}

console.log('\n-- server tidak memangkas sisipan --');
{
  const peta = patok(isi(16059));
  const riwayat = [patok(isi(428)), peta, patok(isi(512)), biasa(isi(47)), biasa(isi(265), 'model')];
  const h = rapikanRiwayat(riwayat, 'pertanyaan yang sedang ditanyakan');

  cek(h[1].content.length === 16059, 'peta 16.059 huruf TIDAK dipangkas', h[1].content.length);
  cek(!/\[dipangkas\]/.test(h[1].content), 'dan tidak diberi penanda terpangkas');
  cek(h[0].content.length === 428 && h[2].content.length === 512, 'sisipan lain tetap utuh');
  const total = h.reduce((n, m) => n + m.content.length, 0);
  cek(total === 17311, `total tetap 17.311 huruf (sebelum perbaikan: 2.065)`, total);
}

console.log('\n-- pesan biasa tidak dipangkas server (anggaran klien satu-satunya penentu) --');
{
  const riwayat = [biasa(isi(5000)), biasa(isi(5000), 'model'), biasa(isi(900)), biasa(isi(900), 'model')];
  const h = rapikanRiwayat(riwayat, 'pertanyaan lain');
  cek(h.length === 4 && h.every((m, i) => m.content.length === riwayat[i].content.length), 'pesan lama yang panjang sampai utuh', h.map((m) => m.content.length));
  cek(!h.some((m) => /\[dipangkas\]/.test(m.content)), 'tak ada penanda terpangkas');
}

console.log('\n-- dua terakhir tetap pesan percakapan --');
{
  const riwayat = [patok(isi(9000)), biasa(isi(3000)), biasa(isi(3000), 'model')];
  const h = rapikanRiwayat(riwayat, 'x');
  cek(h[0].content.length === 9000, 'sisipan utuh');
  cek(h[1].content.length === 3000 && h[2].content.length === 3000, 'dua pesan percakapan terakhir juga utuh', [h[1].content.length, h[2].content.length]);
}

console.log('\n-- duplikat pesan saat ini --');
{
  const h = rapikanRiwayat([patok('PETA'), biasa('halo'), biasa('pertanyaan')], 'pertanyaan');
  cek(h.length === 2, 'pesan terakhir yang sama dengan pesan saat ini dibuang', h.map((m) => m.content));
  cek(h[0].content === 'PETA', 'sisipan tetap di depan sesudah pembuangan itu');
}

console.log('\n-- <think> tetap dibuang --');
{
  const h = rapikanRiwayat([biasa('<think>nalar lama</think>jawaban', 'model')], 'x');
  cek(h[0].content === 'jawaban', 'blok <think> jawaban lama tidak dikirim ulang', h[0].content);
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
