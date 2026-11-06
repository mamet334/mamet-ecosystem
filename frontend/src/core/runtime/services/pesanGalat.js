
export const VERSI_PESAN_GALAT_ECOSYSTEM = 'pesan-galat-ecosystem v2 (2026-10-23)';

export const BATAS_TEKNIS = 400;

const ada = (teks, ...pola) => pola.some((p) => teks.toLowerCase().includes(p.toLowerCase()));

const KODE = {
  NO_API_KEY: {
    judul: 'API Key Anda belum terpasang.',
    saran: 'Buka Settings → AI Provider, masukkan API Key Anda, lalu kirim lagi.',
  },
  ENGINEER_NO_API_KEY: {
    judul: 'Mode Engineer memerlukan API Key Anda sendiri.',
    saran: 'Buka Settings → AI Provider, masukkan API Key Anda, lalu kirim lagi.',
  },
  'Invalid user ID': {
    judul: 'Sesi Anda tidak dikenali server.',
    saran: 'Masuk ulang, lalu kirim pertanyaannya lagi.',
  },
  'Invalid request': {
    judul: 'Bentuk permintaan tidak diterima server.',
    saran: 'Kirim ulang. Bila terus terjadi, sebutkan teks teknis di bawah saat melapor.',
  },

  JARINGAN: {
    judul: 'Tidak bisa menghubungi server.',
    saran: 'Periksa koneksi internet Anda, lalu kirim ulang pertanyaannya.',
  },
  JARINGAN_SKILL: {
    judul: 'Tidak bisa menghubungi server saat menjalankan skill.',
    saran: 'Periksa koneksi internet Anda, lalu jalankan skill itu lagi.',
  },
  PESAN_KOSONG: {
    judul: 'Pertanyaan tidak terkirim karena sesi tidak lengkap.',
    saran: 'Muat ulang aplikasi atau masuk ulang, lalu kirim lagi.',
  },
  ALIRAN_TERPUTUS: {
    judul: 'Jawaban terputus sebelum selesai.',
    saran: 'Kirim ulang pertanyaannya. Biaya permintaan yang terputus tetap tercatat di penyedia.',
  },
  ALIRAN_TAK_TERBACA: {
    judul: 'Aliran jawaban tidak bisa dibaca.',
    saran: 'Kirim ulang pertanyaannya. Bila terus terjadi, muat ulang aplikasi.',
  },
  SKILL_HTTP: {
    judul: 'Server menolak permintaan skill ini.',
    saran: 'Coba lagi beberapa saat lagi. Bila terus terjadi, sebutkan teks teknis di bawah saat melapor.',
  },
  UNDUH_PDF: {
    judul: 'PDF tidak bisa diunduh.',
    saran: 'Coba lagi dari tombol yang sama. Bila terus gagal, jalankan konversinya ulang.',
  },
  RIWAYAT_KONVERSI: {
    judul: 'Riwayat konversi tidak bisa dimuat.',
    saran: 'Tutup lalu buka lagi panelnya. Bila terus terjadi, periksa koneksi internet Anda.',
  },
  HAPUS_KONVERSI: {
    judul: 'Berkas tidak bisa dihapus dari riwayat.',
    saran: 'Coba lagi. Bila terus gagal, tutup lalu buka panelnya untuk melihat keadaan terbaru.',
  },
};

const UMUM = {
  judul: 'Permintaan gagal diproses.',
  saran: 'Coba kirim ulang. Bila terus terjadi, sebutkan teks teknis di bawah saat melapor.',
};

function dariTeks(teknis) {
  if (ada(teknis, 'failed to fetch', 'networkerror', 'network error', 'load failed', 'fetch failed',
    'err_internet', 'err_network', 'err_connection')) {
    return KODE.JARINGAN;
  }

  if (ada(teknis, 'aborted', 'abort')) {
    return { judul: 'Permintaan dihentikan sebelum selesai.', saran: 'Kirim ulang bila masih perlu.' };
  }

  if (ada(teknis, 'sesi tidak aktif', 'jwt expired', 'invalid jwt', 'not authenticated', 'no session')) {
    return { judul: 'Sesi Anda sudah tidak aktif.', saran: 'Masuk ulang, lalu kirim pertanyaannya lagi.' };
  }

  if (ada(teknis, 'NO_API_KEY', 'api key not found', 'missing api key', 'memerlukan api key')) {
    return KODE.NO_API_KEY;
  }

  if (ada(teknis, '401', 'invalid api key', 'no auth credentials', 'user not found')) {
    return {
      judul: 'API Key Anda ditolak penyedia.',
      saran: 'Kuncinya mungkin salah ketik atau sudah dicabut. Buka Settings → AI Provider dan tempel ulang kunci yang masih berlaku.',
    };
  }

  if (ada(teknis, '402', 'can only afford', 'insufficient credits', 'insufficient_quota', 'credits',
    'saldo openrouter', 'saldo tidak cukup', 'saldo penyedia')) {
    return {
      judul: 'Saldo penyedia tidak cukup untuk permintaan ini.',
      saran: 'Isi ulang saldo di penyedia Anda, atau coba pertanyaan yang lebih pendek — permintaan kecil kadang masih dilayani.',
    };
  }

  if (ada(teknis, '429', 'rate limit', 'too many requests')) {
    return { judul: 'Terlalu banyak permintaan dalam waktu singkat.', saran: 'Tunggu sebentar, lalu kirim lagi.' };
  }

  if (ada(teknis, 'daily_cap', 'daily cap', 'daily limit', 'batas harian', 'batas biaya harian', 'plafon harian')) {
    return {
      judul: 'Batas biaya harian Anda sudah tercapai.',
      saran: 'Naikkan batasnya di Settings, atau lanjutkan besok saat hitungannya dimulai ulang.',
    };
  }

  if (ada(teknis, '500', '502', '503', '504', 'server error', 'internal error', 'timeout', 'timed out',
    'gateway', 'unavailable')) {
    return { judul: 'Server sedang bermasalah.', saran: 'Ini bukan dari sisi Anda. Coba lagi beberapa saat lagi.' };
  }

  if (ada(teknis, '403', 'forbidden')) {
    return {
      judul: 'Permintaan ini tidak diizinkan.',
      saran: 'Periksa API Key dan izin di Settings. Bila menurut Anda seharusnya boleh, sebutkan teks teknis di bawah saat melapor.',
    };
  }

  return null;
}

export function pesanUntukPengguna(galat) {
  if (galat && typeof galat === 'object' && !(galat instanceof Error) &&
      ('kode' in galat || 'pesan' in galat || 'status' in galat || 'teknis' in galat)) {
    const { kode, pesan, status, teknis } = galat;
    const bagian = [kode, teknis, status ? `HTTP ${status}` : null, kode === pesan ? null : pesan]
      .filter((b) => b !== null && b !== undefined && String(b).trim() !== '');
    const teksTeknis = bagian.join(' · ') || 'tanpa keterangan';

    if (kode && KODE[kode]) return { ...KODE[kode], teknis: teksTeknis };

    if (pesan && String(pesan).trim() && String(pesan) !== String(kode)) {
      return { judul: String(pesan).trim(), saran: null, teknis: teksTeknis };
    }

    return { ...(dariTeks(teksTeknis) || UMUM), teknis: teksTeknis };
  }

  const teknis = String(galat?.message ?? galat ?? '').trim() || 'tanpa keterangan';
  return { ...(dariTeks(teknis) || UMUM), teknis };
}

export function blokGalat(galat) {
  const p = pesanUntukPengguna(galat);
  const kepala = p.saran ? `${p.judul} ${p.saran}` : p.judul;
  const teknis = p.teknis.length > BATAS_TEKNIS ? `${p.teknis.slice(0, BATAS_TEKNIS)}…` : p.teknis;
  return `⚠️ ${kepala}\n(teknis: ${teknis})`;
}

export function satuBaris(galat) {
  const p = pesanUntukPengguna(galat);
  return p.saran ? `${p.judul} ${p.saran}` : p.judul;
}
