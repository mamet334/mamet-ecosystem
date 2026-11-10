import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const { bacaGalatRespons } = await import(pathToFileURL(join(AKAR, 'frontend/src/core/runtime/services/galatRespons.js')).href);

console.log('uji-galat-respons v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

console.log('\n-- badan jawaban gagal dibaca sekali, sebab aslinya tidak hilang --');
{
  const html = await bacaGalatRespons(new Response('<html><body>502 Bad Gateway</body></html>', { status: 502 }));
  cek(html.status === 502 && /^HTTP 502: <html><body>502 Bad Gateway/.test(html.teknis) && html.kode === null, 'jawaban HTML: sebab asli ikut dilaporkan (dulu tertutup "body stream already read")', html);
  const kosong = await bacaGalatRespons(new Response('', { status: 413 }));
  cek(kosong.teknis === 'HTTP 413 tanpa isi', 'jawaban kosong: status tetap dilaporkan', kosong);
  const json = await bacaGalatRespons(new Response(JSON.stringify({ error: 'NO_API_KEY', message: 'pakai kunci sendiri' }), { status: 403 }));
  cek(json.kode === 'NO_API_KEY' && json.pesan === 'pakai kunci sendiri' && json.status === 403 && json.teknis === null, 'jawaban JSON: kode & pesan terbaca', json);
  const panjang = await bacaGalatRespons(new Response('x'.repeat(5000), { status: 500 }));
  cek(panjang.teknis.length <= 'HTTP 500: '.length + 300, 'teks teknis dibatasi agar layar tidak banjir', panjang.teknis.length);
  let dibaca = 0;
  const palsu = { status: 500, text: async () => { dibaca++; if (dibaca > 1) throw new TypeError('body stream already read'); return 'bukan json'; }, json: async () => { dibaca++; throw new SyntaxError('x'); } };
  const r = await bacaGalatRespons(palsu);
  cek(dibaca === 1 && r.teknis === 'HTTP 500: bukan json', `badan jawaban dibaca tepat sekali (${dibaca}×)`, r);
  const rusak = await bacaGalatRespons({ status: 504, text: async () => { throw new Error('putus'); } });
  cek(rusak.teknis === 'HTTP 504 tanpa isi', 'gagal membaca badan pun tetap menghasilkan laporan status', rusak);
}

console.log('\n-- blokir Cloudflare dikenali, bukan dituduh API Key --');
{
  const { pesanUntukPengguna } = await import(pathToFileURL(join(AKAR, 'frontend/src/core/runtime/services/pesanGalat.js')).href);
  const halaman = '<!DOCTYPE html> <!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]--> <title>Attention Required! | Cloudflare</title>';
  const cf = await bacaGalatRespons(new Response(halaman, { status: 403 }));
  cek(cf.kode === 'DIBLOKIR_CLOUDFLARE' && /tidak sampai ke server Mamet/.test(cf.teknis), 'halaman blokir Cloudflare dikenali', cf);
  const p = pesanUntukPengguna(cf);
  cek(/Cloudflare/.test(p.judul) && /bukan oleh API Key/.test(p.judul) && /percakapan baru/.test(p.saran), 'pengguna diberi tahu sebab & jalan keluarnya (bukan "periksa API Key")', p);
  const lain = await bacaGalatRespons(new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 }));
  cek(lain.kode === 'FORBIDDEN', '403 dari server Mamet sendiri tidak dikira Cloudflare', lain);
  const bukan403 = await bacaGalatRespons(new Response(halaman, { status: 502 }));
  cek(bukan403.kode === null && /^HTTP 502/.test(bukan403.teknis), 'halaman Cloudflare dengan status lain tidak dikira blokir isi', bukan403);
}

console.log('\n-- dipakai di kedua jalur kirim --');
{
  const AS = readFileSync(join(AKAR, 'frontend/src/core/runtime/services/AssistantService.js'), 'utf8');
  cek(!/await response\.json\(\); kode/.test(AS) && !/teknis = \(await response\.text\(\)\)/.test(AS), 'pola baca-ganda lama tidak ada lagi');
  cek((AS.match(/const galat = await bacaGalatRespons\(response\);\r?\n[^\n]*\r?\n\s*onError\?\.\(galat\);/g) || []).length === 2, 'jalur LOOKUP & percakapan melaporkan galat lewat bacaGalatRespons');
}

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
