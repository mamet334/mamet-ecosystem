// UJI 2026-09-23 — pecahPerintah: penyambung shell diperiksa HANYA di luar tanda kutip.
// Bahan uji = perintah live yang ditolak 2026-09-23 (deepseek-v4-pro, TUGAS-04 lanjutan).
import { createRequire } from 'node:module';
const require = createRequire('D:/SLAMET/other/mamet os ecosystem/frontend/');
const { pecahPerintah } = require('D:/SLAMET/other/mamet os ecosystem/frontend/electron/alatFolderJalan.cjs');
console.log('uji-pecah-perintah-kutip v2');

let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ---------- yang DULU ditolak padahal sah ----------
const skrip = `node -e "const fs=require('fs');const p='frontend/src/core/runtime/services/engineer/IntentClassifier.js';const l=fs.readFileSync(p,'utf8').split('\\n');l.forEach((t,i)=>console.log(i+1,t))"`;
let r = pecahPerintah(skrip);
cek(!r.galat, 'skrip node -e dengan ";" DI DALAM kutip → diterima (live TUGAS-04 lanjutan)', r.galat);
cek(r.program === 'node' && r.argumen?.length === 2 && r.argumen[0] === '-e', 'terpecah jadi node + -e + SATU argumen skrip', { p: r.program, n: r.argumen?.length });
cek((r.argumen?.[1] || '').includes(';'), 'isi skrip tetap utuh dengan titik-komanya');

r = pecahPerintah('git log --pretty=format:"%h - %s | %an" -n 3');
cek(!r.galat, 'format git dengan "|" di dalam kutip → diterima', r.galat);
r = pecahPerintah(`python -c "print(1);print(2)"`);
cek(!r.galat, 'python -c dengan ";" di dalam kutip → diterima', r.galat);

// ---------- yang HARUS tetap ditolak ----------
for (const [p, alasan] of [
  ['git status && npm test', '&&'],
  ['git log | head -5', 'pipa'],
  ['node app.js ; rm -rf x', 'titik-koma di luar kutip'],
  ['git log > keluaran.txt', 'pengalihan keluaran'],
  ['git show HEAD:file < masukan', 'pengalihan masukan'],
  ['echo `whoami`', 'backtick'],
]) {
  const h = pecahPerintah(p);
  cek(!!h.galat && /di luar tanda kutip|baris baru/.test(h.galat), `tetap ditolak: ${alasan}`, h);
}
r = pecahPerintah('git status\nnpm test');
cek(!!r.galat && /baris baru/.test(r.galat), 'baris baru tetap ditolak di mana pun');
r = pecahPerintah('node -e "const a=1');
cek(!!r.galat && /kutip tidak ditutup/.test(r.galat), 'kutip tidak ditutup tetap ditolak');

// ---------- perintah biasa tidak berubah ----------
r = pecahPerintah('git grep -n logCommand -- frontend/src');
cek(!r.galat && r.program === 'git' && r.argumen.join(' ') === 'grep -n logCommand -- frontend/src',
  'perintah biasa tetap terpecah seperti sebelumnya', r);
r = pecahPerintah('git ls-files -- "*IntentClassifier*"');
cek(!r.galat && r.argumen.join(' ') === 'ls-files -- *IntentClassifier*',
  'pola berkas dalam kutip tetap utuh (tanda kutipnya dilepas, isinya satu argumen)', r.argumen);

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
