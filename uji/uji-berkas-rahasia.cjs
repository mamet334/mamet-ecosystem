
const AKAR_REPO = require('node:path').resolve(__dirname, '..').replace(/\\/g, '/');
const fs = require('fs');
const os = require('os');
const path = require('path');

const AKAR = AKAR_REPO;
const R = require(path.join(AKAR, 'frontend/electron/berkasRahasia.cjs'));
const A = require(path.join(AKAR, 'frontend/electron/alatFolder.cjs'));

console.log('uji-berkas-rahasia v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

console.log('\n-- daftar berkas rahasia --');

for (const n of ['.env', '.env.local', '.env.production', 'server.key', 'cert.pem', 'sub/folder/.env', 'a\\b\\privat.key']) {
  cek(R.adalahBerkasRahasia(n) === true, `rahasia: ${n}`);
}
for (const n of ['.env.example', '.env.sample', '.env.template', '.env.dist', '.env.default', '.env.defaults']) {
  cek(R.adalahBerkasRahasia(n) === false, `BUKAN rahasia (berkas contoh): ${n}`);
}
for (const n of ['index.js', 'README.md', 'environment.ts', 'keyboard.jsx', 'package.json', '', null, undefined]) {
  cek(R.adalahBerkasRahasia(n) === false, `BUKAN rahasia: ${JSON.stringify(n)}`);
}
cek(R.adalahBerkasRahasia('monkey.js') === false, 'pagar tidak kebablasan — "monkey.js" bukan *.key');
cek(R.adalahBerkasRahasia('.environment') === false, 'pagar tidak kebablasan — ".environment" bukan .env');

const alasan = R.alasanRahasia('.env');
cek(/terkirim ke penyedia model/i.test(alasan), 'alasan menyebut SEBAB: isinya ikut terkirim', alasan);
cek(/tidak bisa ditarik kembali/i.test(alasan), 'alasan menyebut kenapa ini tak bisa dibatalkan');
cek(/\.env\.example/.test(alasan) && /menyebutkannya sendiri/.test(alasan),
  'alasan memberi GANTI cara, bukan sekadar melarang', alasan);

console.log('\n-- folder sungguhan --');

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-rahasia-'));
try {
  fs.writeFileSync(path.join(folder, '.env'), 'OPENROUTER_API_KEY=sk-rahasia-sekali\nSUPABASE_URL=https://contoh\n');
  fs.writeFileSync(path.join(folder, '.env.example'), 'OPENROUTER_API_KEY=\nSUPABASE_URL=\n');
  fs.writeFileSync(path.join(folder, 'server.key'), '-----BEGIN PRIVATE KEY-----\nrahasia\n-----END PRIVATE KEY-----\n');
  fs.writeFileSync(path.join(folder, 'app.js'), 'const kunci = process.env.OPENROUTER_API_KEY;\n');
  fs.writeFileSync(path.join(folder, '.env2'), 'OPENROUTER_API_KEY=sk-kendali-terbaca\n');

  let h = A.jalankanAlat(folder, { alat: 'folder_read', alamat: '.env' });
  cek(h.ok === false, 'folder_read .env DITOLAK', h);
  cek(!JSON.stringify(h).includes('sk-rahasia-sekali'), 'isi rahasianya TIDAK bocor lewat pesan penolakan', h);
  cek(/berkas rahasia/i.test(h.alasan || ''), 'penolakannya menyebut alasannya', h.alasan);

  h = A.jalankanAlat(folder, { alat: 'folder_read', alamat: 'server.key' });
  cek(h.ok === false && !JSON.stringify(h).includes('BEGIN PRIVATE KEY'), 'folder_read server.key DITOLAK', h);

  h = A.jalankanAlat(folder, { alat: 'folder_read', alamat: '.env.example' });
  cek(h.ok === true, '.env.example TETAP bisa dibaca', h);
  cek(String(h.isi || '').includes('OPENROUTER_API_KEY'), 'isinya nama variabel, tanpa nilai', h.isi);

  h = A.jalankanAlat(folder, { alat: 'folder_read', alamat: 'app.js' });
  cek(h.ok === true, 'berkas biasa tetap terbaca');

  h = A.jalankanAlat(folder, { alat: 'folder_search', kueri: 'OPENROUTER_API_KEY', alamat: '.' });
  cek(h.ok === true, 'folder_search tetap berjalan', h);
  cek(!JSON.stringify(h).includes('sk-rahasia-sekali'),
    'CACAT TERTUTUP: nilai rahasia TIDAK muncul sebagai "temuan" pencarian', h.temuan);
  cek((h.temuan || []).some((t) => t.alamat === '.env.example'), 'temuan dari .env.example tetap ada', h.temuan);
  cek((h.temuan || []).some((t) => t.alamat === 'app.js'), 'temuan dari berkas biasa tetap ada', h.temuan);
  cek(!(h.temuan || []).some((t) => t.alamat === '.env'), 'tidak ada satu pun temuan dari .env', h.temuan);
  cek(JSON.stringify(h).includes('sk-kendali-terbaca'),
    'KENDALI: berkas bertitik yang TIDAK dijaga memang terbaca pencarian — jadi absennya .env karena penjaganya, bukan aturan lain',
    h.temuan);
  cek(h.dilewatiRahasia >= 1,
    'jumlah berkas rahasia yang dilewati DILAPORKAN — pengecualian yang diam adalah cara uji merah lolos 4 hari', h);

  h = A.jalankanAlat(folder, { alat: 'folder_list', alamat: '.' });
  const nama = (h.entri || []).map((e) => e.alamat);
  cek(nama.includes('.env'), 'nama .env TETAP terlihat di daftar (yang dijaga isinya, bukan keberadaannya)', nama);
} finally {
  fs.rmSync(folder, { recursive: true, force: true });
}

console.log('\n-- terpasang --');
const SRC = fs.readFileSync(path.join(AKAR, 'frontend/electron/alatFolder.cjs'), 'utf8');
cek(/require\('\.\/berkasRahasia\.cjs'\)/.test(SRC), 'penjaga diimpor alat folder');
const iRead = SRC.indexOf('function folderRead');
const blokRead = SRC.slice(iRead, SRC.indexOf('fs.openSync', iRead));
cek(/adalahBerkasRahasia\(p\.relatif\)/.test(blokRead),
  'penolakan terjadi SEBELUM berkasnya dibuka (fs.openSync)', blokRead.slice(-200));

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
