// UJI 2026-10-27 — kata kunci misi crawler: arahan analisis untuk model SELARAS dengan cara crawler mencocokkan.
//
// Latar: misi "Ogan Komering Ulu" — model (sesuai arahan "sinonim") menambah "OKU"; crawler mencocokkannya sebagai
// potongan teks sehingga 14/14 tangkapan rss_media lolos lewat "F-oku-s". Perbaikan dua sisi (keputusan Owner):
//   - crawler (capability/ecosystem-crawler/crawler/inti/teks.py): kata ≤ 4 huruf & akronim = kata utuh;
//     diuji pytest tests/test_kata_kunci.py;
//   - arahan model (konektorAlat.js aturan 1): kenali entitas yang dicari, dampingi akronim dengan nama lengkap &
//     penanda khas, pakai kata_kunci_kecuali.
// Uji ini menjaga keduanya tidak bercerai: angka & aturan yang dikatakan ke model = yang dijalankan crawler.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = await import(pathToFileURL(path.join(AKAR, 'shared/konektorAlat.js')).href);

console.log('uji-konektor-kata-kunci v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 400)}` : ''}`);
  if (!ok) gagal++;
};

const blok = P.blokPromptKonektor({ id: 'ecosystem-crawler', putaran: 0, sumberSiap: [{ id: 'rss_media', cocok: ['berita_terbaru'] }], akses: { patuhi_robots: false, stealth: true } });
const aturan1 = (blok.match(/^1\. [^\n]*/m) || [''])[0];
cek(/kenali dulu APA yang dicari pengguna/.test(aturan1), 'aturan 1: model menganalisis entitas yang dicari sebelum menyusun kata kunci');
cek(/dampingi akronim dengan nama lengkap dan penanda khasnya/.test(aturan1) && /kata_kunci_kecuali/.test(aturan1), 'aturan 1: akronim didampingi nama lengkap & penanda khas, makna lain lewat kata_kunci_kecuali');
cek(/secara harfiah, bukan makna/.test(aturan1), 'model diberi tahu crawler mencocokkan harfiah, bukan makna');
cek(!/^1b\.|^2\. Jalankan/m.test(blok) && /^2\. Sumber kaskus/m.test(blok), 'penomoran aturan lain tidak bergeser');

// Angka di arahan = angka di crawler (sumber kebenaran: teks.py).
const teksPy = readFileSync(path.join(AKAR, 'capability/ecosystem-crawler/crawler/inti/teks.py'), 'utf8');
const batasPy = Number((teksPy.match(/" " not in k and len\(k\) <= (\d+)/) || [])[1]);
const batasPrompt = Number((aturan1.match(/kata ≤ (\d+) huruf dan akronim/) || [])[1]);
const panjangPrompt = Number((aturan1.match(/kata ≥ (\d+) huruf dicari sebagai potongan teks/) || [])[1]);
cek(Number.isFinite(batasPy) && batasPy === batasPrompt && panjangPrompt === batasPy + 1, `batas kata pendek sama di crawler & arahan (py ≤ ${batasPy}, prompt ≤ ${batasPrompt}, ≥ ${panjangPrompt})`);
cek(/k\.isupper\(\)/.test(teksPy) && /akronim/.test(aturan1), 'akronim (huruf besar semua) = kata utuh di keduanya');
const mcp = readFileSync(path.join(AKAR, 'capability/ecosystem-crawler/crawler/wajah/mcp_server.py'), 'utf8');
cek(new RegExp(`Kata ≤ ${batasPy} huruf & akronim`).test(mcp), 'docstring alat jalankan_misi di crawler menyebut aturan yang sama');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`}`);
process.exitCode = gagal === 0 ? 0 : 1;
