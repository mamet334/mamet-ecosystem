
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baca = (p) => readFileSync(join(AKAR, p), 'utf8').replace(/\r\n/g, '\n');
const sidik = (teks) => createHash('sha256').update(teks).digest('hex');

console.log('uji-penjaga-lamplogin v3');

let gagal = 0;
const cek = (syarat, pesan, detail) => {
  if (syarat) console.log('  ✓ ' + pesan);
  else { gagal++; console.log('  ✗ ' + pesan + (detail !== undefined ? '\n      ' + JSON.stringify(detail) : '')); }
};

const SIDIK_JARI = '364588ac65515ac9adbf0a19c123e31dd32ab83527277a95b39d299fa7a509e2';

console.log('\n-- 1. sidik jari peka terhadap satu bait, tetapi tidak terhadap CRLF --');
const asli = baca('frontend/src/components/LampLogin.jsx');
cek(sidik(asli + ' ') !== sidik(asli), 'satu spasi tambahan mengubah sidik jari');
cek(sidik(asli.replace(/\n/g, '\r\n').replace(/\r\n/g, '\n')) === sidik(asli),
  'CRLF yang dinormalkan menghasilkan sidik jari yang sama');

console.log('\n-- 2. LampLogin.jsx sama persis dengan isi yang diizinkan Owner 29 Okt --');
cek(sidik(asli) === SIDIK_JARI, 'isi LampLogin.jsx sama persis dengan sidik jari 29 Okt (izin T19)',
  { sekarang: sidik(asli), seharusnya: SIDIK_JARI });
cek(sidik(asli.replace('Memproses...', 'Memproses…')) !== SIDIK_JARI, 'kendali: satu kata berubah → merah');

console.log('\n-- 3. LampLogin masih layar masuk yang tampil --');
const app = baca('frontend/src/App.jsx');
cek(/import\s+LampLogin\s+from\s+['"]\.\/components\/LampLogin['"]/.test(app), 'App.jsx mengimpor LampLogin');
cek(/<LampLogin\b/.test(app), 'App.jsx merender <LampLogin> untuk pengguna yang belum masuk');

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
