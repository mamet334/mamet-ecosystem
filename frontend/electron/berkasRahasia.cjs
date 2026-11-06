
const path = require('path');

const CONTOH_ENV = /^\.env\.(example|sample|template|dist|defaults?)$/i;
const ENV = /^\.env(\..+)?$/i;
const EKSTENSI_KUNCI = new Set(['.key', '.pem']);

function adalahBerkasRahasia(alamat) {
  const teks = String(alamat || '').trim();
  if (!teks) return false;
  const nama = teks.split(/[\\/]+/).filter(Boolean).pop() || '';
  if (!nama) return false;
  if (CONTOH_ENV.test(nama)) return false;
  if (ENV.test(nama)) return true;
  return EKSTENSI_KUNCI.has(path.extname(nama).toLowerCase());
}

function alasanRahasia(alamat) {
  const nama = String(alamat || '').split(/[\\/]+/).filter(Boolean).pop() || 'berkas ini';
  return `"${nama}" adalah berkas rahasia (.env / kunci) dan TIDAK dibaca: isinya akan ikut terkirim ke penyedia model, dan yang sudah terkirim tidak bisa ditarik kembali. Bila Anda butuh NAMA variabelnya, baca berkas contoh seperti .env.example, atau minta pengguna menyebutkannya sendiri.`;
}

module.exports = { adalahBerkasRahasia, alasanRahasia };
