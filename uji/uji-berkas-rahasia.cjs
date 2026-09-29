// UJI 2026-09-29 — T12: berkas rahasia tidak ikut terkirim ke penyedia model.
//
// T12 bukan bug melainkan sifat sistem: apa pun yang dibaca alat folder/repo berakhir di dalam prompt,
// dan prompt dikirim ke OpenRouter lalu dirutekan ke penyedia hulu yang berganti-ganti. Sifat itu
// ditutup Owner sebagai batas yang diketahui. Yang ditutup KODE adalah bagian termahal bila lolos:
// sekali kunci API masuk prompt, ia sudah keluar — tidak ada cara menariknya kembali.
//
// Dijalankan terhadap FOLDER SUNGGUHAN berisi .env dan .env.example, lewat jalankanAlat() yang sama
// dipakai proses utama — bukan tiruan logikanya.

const fs = require('fs');
const os = require('os');
const path = require('path');

const AKAR = 'D:/SLAMET/other/mamet os ecosystem';
const R = require(path.join(AKAR, 'frontend/electron/berkasRahasia.cjs'));
const A = require(path.join(AKAR, 'frontend/electron/alatFolder.cjs'));

console.log('uji-berkas-rahasia v1');
let gagal = 0;
const cek = (ok, pesan, rinci) => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n       -> ${JSON.stringify(rinci).slice(0, 300)}` : ''}`);
  if (!ok) gagal++;
};

// ── 1. Yang dianggap rahasia ─────────────────────────────────────────────────────────────────
console.log('\n-- daftar berkas rahasia --');

for (const n of ['.env', '.env.local', '.env.production', 'server.key', 'cert.pem', 'sub/folder/.env', 'a\\b\\privat.key']) {
  cek(R.adalahBerkasRahasia(n) === true, `rahasia: ${n}`);
}
// Berkas contoh memang DIBUAT untuk dibaca — isinya nama variabel tanpa nilainya.
for (const n of ['.env.example', '.env.sample', '.env.template', '.env.dist', '.env.default', '.env.defaults']) {
  cek(R.adalahBerkasRahasia(n) === false, `BUKAN rahasia (berkas contoh): ${n}`);
}
for (const n of ['index.js', 'README.md', 'environment.ts', 'keyboard.jsx', 'package.json', '', null, undefined]) {
  cek(R.adalahBerkasRahasia(n) === false, `BUKAN rahasia: ${JSON.stringify(n)}`);
}
// Pagar tidak boleh kebablasan: nama yang sekadar MENGANDUNG kata kunci tetap boleh dibaca.
cek(R.adalahBerkasRahasia('monkey.js') === false, 'pagar tidak kebablasan — "monkey.js" bukan *.key');
cek(R.adalahBerkasRahasia('.environment') === false, 'pagar tidak kebablasan — ".environment" bukan .env');

// Alasannya harus menyebut sebab DAN jalan lain (prosedur langkah 0.4).
const alasan = R.alasanRahasia('.env');
cek(/terkirim ke penyedia model/i.test(alasan), 'alasan menyebut SEBAB: isinya ikut terkirim', alasan);
cek(/tidak bisa ditarik kembali/i.test(alasan), 'alasan menyebut kenapa ini tak bisa dibatalkan');
cek(/\.env\.example/.test(alasan) && /menyebutkannya sendiri/.test(alasan),
  'alasan memberi GANTI cara, bukan sekadar melarang', alasan);

// ── 2. Terpasang di alat yang sungguhan ──────────────────────────────────────────────────────
console.log('\n-- folder sungguhan --');

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-rahasia-'));
try {
  fs.writeFileSync(path.join(folder, '.env'), 'OPENROUTER_API_KEY=sk-rahasia-sekali\nSUPABASE_URL=https://contoh\n');
  fs.writeFileSync(path.join(folder, '.env.example'), 'OPENROUTER_API_KEY=\nSUPABASE_URL=\n');
  fs.writeFileSync(path.join(folder, 'server.key'), '-----BEGIN PRIVATE KEY-----\nrahasia\n-----END PRIVATE KEY-----\n');
  fs.writeFileSync(path.join(folder, 'app.js'), 'const kunci = process.env.OPENROUTER_API_KEY;\n');
  // UJI KENDALI (langkah 8). `.env2` sengaja TIDAK masuk daftar rahasia, isinya bentuknya sama persis
  // dengan `.env`. Kalau ia ikut ketemu pencarian, terbukti pencarian memang membaca berkas bertitik
  // semacam ini — sehingga tidak adanya `.env` di hasil benar-benar karena PENJAGANYA, bukan karena
  // aturan lain (ekstensi/biner) yang kebetulan sudah mengecualikannya. Tanpa kendali ini, uji di
  // bawah bisa hijau karena alasan yang salah.
  fs.writeFileSync(path.join(folder, '.env2'), 'OPENROUTER_API_KEY=sk-kendali-terbaca\n');

  // folder_read: ditolak, dan isinya TIDAK ikut di pesan penolakan.
  let h = A.jalankanAlat(folder, { alat: 'folder_read', alamat: '.env' });
  cek(h.ok === false, 'folder_read .env DITOLAK', h);
  cek(!JSON.stringify(h).includes('sk-rahasia-sekali'), 'isi rahasianya TIDAK bocor lewat pesan penolakan', h);
  cek(/berkas rahasia/i.test(h.alasan || ''), 'penolakannya menyebut alasannya', h.alasan);

  h = A.jalankanAlat(folder, { alat: 'folder_read', alamat: 'server.key' });
  cek(h.ok === false && !JSON.stringify(h).includes('BEGIN PRIVATE KEY'), 'folder_read server.key DITOLAK', h);

  // Berkas contoh tetap bisa dibaca — ia yang justru dibutuhkan model.
  h = A.jalankanAlat(folder, { alat: 'folder_read', alamat: '.env.example' });
  cek(h.ok === true, '.env.example TETAP bisa dibaca', h);
  cek(String(h.isi || '').includes('OPENROUTER_API_KEY'), 'isinya nama variabel, tanpa nilai', h.isi);

  // Berkas biasa tidak terganggu.
  h = A.jalankanAlat(folder, { alat: 'folder_read', alamat: 'app.js' });
  cek(h.ok === true, 'berkas biasa tetap terbaca');

  // folder_search: inilah jalur yang paling mudah terlewat — ia membaca SELURUH berkas di folder.
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

  // Nama berkasnya BOLEH terlihat: yang dijaga isinya, bukan keberadaannya. Menyembunyikan berkas
  // membuat model menyimpulkan ".env tidak ada" lalu menyuruh Owner membuatnya — lebih buruk.
  h = A.jalankanAlat(folder, { alat: 'folder_list', alamat: '.' });
  const nama = (h.entri || []).map((e) => e.alamat);
  cek(nama.includes('.env'), 'nama .env TETAP terlihat di daftar (yang dijaga isinya, bukan keberadaannya)', nama);
} finally {
  fs.rmSync(folder, { recursive: true, force: true });
}

// ── 3. Terpasang di kode, bukan hanya ada ────────────────────────────────────────────────────
console.log('\n-- terpasang --');
const SRC = fs.readFileSync(path.join(AKAR, 'frontend/electron/alatFolder.cjs'), 'utf8');
cek(/require\('\.\/berkasRahasia\.cjs'\)/.test(SRC), 'penjaga diimpor alat folder');
const iRead = SRC.indexOf('function folderRead');
const blokRead = SRC.slice(iRead, SRC.indexOf('fs.openSync', iRead));
cek(/adalahBerkasRahasia\(p\.relatif\)/.test(blokRead),
  'penolakan terjadi SEBELUM berkasnya dibuka (fs.openSync)', blokRead.slice(-200));

console.log('\n' + (gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`));
process.exit(gagal === 0 ? 0 : 1);
