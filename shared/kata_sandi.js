
export const PANJANG_MINIMAL_SANDI = 8;

export const PESAN_TAUTAN_TERKIRIM =
  'Bila email itu terdaftar, tautan untuk membuat kata sandi baru sudah dikirim. Periksa kotak masuk (dan folder spam).';

export function jenisTautanAuth(hash = '', search = '') {
  const h = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const q = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const ambil = (k) => h.get(k) ?? q.get(k);
  const kodeGalat = ambil('error_code') || '';
  if (kodeGalat === 'otp_expired' || (ambil('error') && /expired|invalid/i.test(ambil('error_description') || ''))) {
    return 'kedaluwarsa';
  }
  if (ambil('type') === 'recovery' || ambil('type') === 'invite') return 'pemulihan';
  return null;
}

export function alamatKembaliPemulihan(lokasi, cadanganWeb) {
  return /^https?:$/.test(lokasi?.protocol || '') ? `${lokasi.origin}/` : cadanganWeb;
}

export function periksaSandiBaru(sandi, ulang) {
  if (!sandi || sandi.length < PANJANG_MINIMAL_SANDI) return `Kata sandi minimal ${PANJANG_MINIMAL_SANDI} karakter.`;
  if (sandi !== ulang) return 'Kedua isian kata sandi tidak sama.';
  return null;
}

const ada = (teks, ...kata) => kata.some((k) => teks.toLowerCase().includes(k));

export function pesanGalatSandi(galat) {
  const teknis = String(galat?.message ?? galat ?? '').trim() || 'tanpa keterangan';
  if (ada(teknis, 'for security purposes', 'rate limit', 'too many requests', '429')) {
    return { judul: 'Terlalu sering meminta.', saran: 'Tunggu sekitar satu menit, lalu coba lagi.', teknis };
  }
  if (ada(teknis, 'error sending', 'smtp')) {
    return { judul: 'Email gagal dikirim.', saran: 'Server email belum siap. Hubungi admin Mamet.', teknis };
  }
  if (ada(teknis, 'should be different', 'same_password')) {
    return { judul: 'Kata sandi baru sama dengan yang lama.', saran: 'Pilih kata sandi yang berbeda.', teknis };
  }
  if (ada(teknis, 'password should be', 'weak_password', 'weak password')) {
    return { judul: 'Kata sandi terlalu lemah.', saran: `Pakai minimal ${PANJANG_MINIMAL_SANDI} karakter, campur huruf dan angka.`, teknis };
  }
  if (ada(teknis, 'invalid login credentials', 'invalid credentials')) {
    return { judul: 'Kata sandi lama salah.', saran: 'Periksa lagi kata sandi yang sekarang Anda pakai.', teknis };
  }
  if (ada(teknis, 'session missing', 'session_not_found', 'jwt expired', 'not authenticated')) {
    return { judul: 'Tautan pemulihan sudah tidak berlaku.', saran: 'Minta tautan baru lewat "Lupa kata sandi?" di layar masuk.', teknis };
  }
  if (ada(teknis, 'failed to fetch', 'networkerror', 'load failed')) {
    return { judul: 'Tidak bisa menghubungi server.', saran: 'Periksa koneksi internet Anda, lalu coba lagi.', teknis };
  }
  return { judul: 'Belum berhasil.', saran: 'Coba lagi. Bila terus terjadi, sebutkan pesan teknis di bawah saat melapor.', teknis };
}
