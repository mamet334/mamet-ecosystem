// PESAN GALAT UNTUK ORANG AWAM (2026-10-08) — M4, `ROADMAP-SIAP-PENGGUNA.md`.
//
// Sampai 8 Okt 2026 yang dibaca pengguna Mametlite saat sesuatu gagal adalah teks server APA ADANYA:
//
//   App.jsx: updateMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}` }])
//   callAgentSimple.js:100: throw new Error(errorData.error || `Server error: ${response.status}`)
//
// Jadi yang muncul di gelembung chat: `❌ Error: ENGINEER_NO_API_KEY`, `❌ Error: Server error: 500`,
// `❌ Error: Failed to fetch`, dan satu string Inggris yang kita tulis sendiri — `Unexpected response
// format`. Penggunanya pegawai ASN yang membuka dari HP.
//
// Tiga aturan yang dipakai di sini:
//
//   1. **Sebutkan TINDAKAN, bukan hanya keadaan.** "Kuota habis" tidak membantu; "isi ulang saldo
//      OpenRouter Anda" membantu. Galat tanpa tindakan yang jelas mengatakan itu juga, apa adanya.
//   2. **Jangan menebak lebih dari yang diketahui.** Kalau tandanya tidak dikenali, pesannya umum —
//      BUKAN tebakan yang terdengar yakin. Pesan yakin yang salah lebih merugikan daripada pesan umum.
//   3. **Teks teknisnya tidak dibuang.** Ia disimpan di `teknis` dan ditampilkan kecil. Pengguna HP
//      tidak punya DevTools; kalau sebabnya disembunyikan, satu-satunya cara melapor adalah
//      "errornya merah". Aturan yang sama dengan `BatasGalat.jsx`.
//
// Diuji di `uji/uji-pesan-galat.mjs`.

export const VERSI_PESAN_GALAT = 'pesan-galat v1 (2026-10-08)';

/** Cocokkan tanpa peduli huruf besar/kecil; `teks` selalu string. */
const ada = (teks, ...pola) => pola.some((p) => teks.toLowerCase().includes(p.toLowerCase()));

/**
 * Galat jalur chat/unggah → kalimat yang bisa ditindaklanjuti.
 *
 * @returns {{judul: string, saran: string|null, teknis: string}}
 *   `saran` null berarti memang tidak ada tindakan yang jujur bisa disarankan — jangan karang satu.
 */
export function pesanUntukPengguna(galat) {
  const teknis = String(galat?.message ?? galat ?? '').trim() || 'tanpa keterangan';

  // Jaringan — paling sering, dan satu-satunya yang penggunanya benar-benar bisa perbaiki sendiri.
  if (ada(teknis, 'failed to fetch', 'networkerror', 'load failed', 'err_internet', 'err_network')) {
    return {
      judul: 'Tidak bisa menghubungi server.',
      saran: 'Periksa koneksi internet Anda, lalu kirim ulang pertanyaannya.',
      teknis,
    };
  }

  if (ada(teknis, 'aborted', 'abort')) {
    return { judul: 'Permintaan dihentikan sebelum selesai.', saran: 'Kirim ulang bila masih perlu.', teknis };
  }

  // Kunci BYOK — Mametlite memakai kunci OpenRouter pengguna, bukan kunci server.
  if (ada(teknis, 'NO_API_KEY', 'api key not found', 'missing api key')) {
    return {
      judul: 'Kunci OpenRouter Anda belum terpasang.',
      saran: 'Buka Pengaturan (ikon gerigi di kiri atas), tempel kunci OpenRouter Anda, lalu kirim lagi.',
      teknis,
    };
  }

  if (ada(teknis, '401', 'invalid api key', 'no auth credentials', 'user not found')) {
    return {
      judul: 'Kunci OpenRouter Anda ditolak.',
      saran: 'Kuncinya mungkin salah ketik atau sudah dicabut. Buka Pengaturan dan tempel ulang kunci yang masih berlaku.',
      teknis,
    };
  }

  // 402 — saldo. Catatan Owner: saldo minus TIDAK berarti layanan mati; sebagian permintaan kecil
  // masih dilayani, jadi pesannya tidak boleh bilang "tidak bisa dipakai sama sekali".
  if (ada(teknis, '402', 'can only afford', 'insufficient credits', 'quota', 'credits')) {
    return {
      judul: 'Saldo OpenRouter Anda tidak cukup untuk permintaan ini.',
      saran: 'Isi ulang saldo di openrouter.ai, atau coba pertanyaan yang lebih pendek — permintaan kecil kadang masih bisa dilayani.',
      teknis,
    };
  }

  if (ada(teknis, '429', 'rate limit', 'too many requests')) {
    return {
      judul: 'Terlalu banyak permintaan dalam waktu singkat.',
      saran: 'Tunggu sebentar, lalu kirim lagi.',
      teknis,
    };
  }

  if (ada(teknis, 'server error: 5', '500', '502', '503', '504', 'timeout', 'timed out')) {
    return {
      judul: 'Server sedang bermasalah.',
      saran: 'Ini bukan dari sisi Anda. Coba lagi beberapa saat lagi.',
      teknis,
    };
  }

  // String Inggris yang KITA tulis sendiri di App.jsx.
  if (ada(teknis, 'unexpected response format')) {
    return {
      judul: 'Jawaban dari server tidak dikenali bentuknya.',
      saran: 'Coba kirim ulang pertanyaannya. Bila terus terjadi, sebutkan pesan teknis di bawah saat melapor.',
      teknis,
    };
  }

  // Tidak dikenali → jangan menebak. Aturan 2.
  return {
    judul: 'Permintaan gagal diproses.',
    saran: 'Coba kirim ulang. Bila terus terjadi, sebutkan pesan teknis di bawah saat melapor.',
    teknis,
  };
}

/**
 * Galat masuk (Supabase Auth) → bahasa Indonesia.
 *
 * Dipisah dari `pesanUntukPengguna` karena tindakannya beda jenis: di sini pengguna mengisi formulir,
 * bukan menunggu jawaban model.
 */
export function pesanGalatMasuk(galat) {
  const teknis = String(galat?.message ?? galat ?? '').trim() || 'tanpa keterangan';

  if (ada(teknis, 'invalid login credentials', 'invalid credentials')) {
    return { judul: 'Email atau kata sandi salah.', saran: 'Periksa lagi, lalu coba masuk kembali.', teknis };
  }
  if (ada(teknis, 'email not confirmed')) {
    return {
      judul: 'Email Anda belum dikonfirmasi.',
      saran: 'Buka email dari Mamet Lite dan klik tautan konfirmasinya, lalu masuk lagi.',
      teknis,
    };
  }
  if (ada(teknis, 'rate limit', 'too many requests', '429')) {
    return { judul: 'Terlalu banyak percobaan masuk.', saran: 'Tunggu beberapa menit, lalu coba lagi.', teknis };
  }
  if (ada(teknis, 'failed to fetch', 'networkerror', 'load failed')) {
    return { judul: 'Tidak bisa menghubungi server.', saran: 'Periksa koneksi internet Anda, lalu coba lagi.', teknis };
  }

  return {
    judul: 'Tidak bisa masuk.',
    saran: 'Coba lagi. Bila terus terjadi, sebutkan pesan teknis di bawah saat melapor.',
    teknis,
  };
}

/** Satu baris untuk gelembung chat: judul + saran, tanpa teks teknis. */
export function satuBaris(pesan) {
  return pesan.saran ? `${pesan.judul} ${pesan.saran}` : pesan.judul;
}
