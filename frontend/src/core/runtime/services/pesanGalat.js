// PESAN GALAT UNTUK LAYAR ws-assistant (2026-10-08) — pengerasan ws-assistant, arahan Owner
// *"Pengerasan ws-assistant. kerjakan"*. Sepupu dari `mametlite/src/lib/pesanGalat.js`, **BUKAN
// salinannya** — lihat "Kenapa bukan satu berkas" di bawah sebelum menyatukannya.
//
// ── Keadaan sebelum ────────────────────────────────────────────────────────────────────────────
//
// Galat yang sampai ke gelembung chat Ecosystem disusun di SEBELAS tempat, masing-masing mengarang
// teks tampilannya sendiri:
//
//   AssistantService:381   onError?.('Pesan atau token tidak tersedia.')
//   AssistantService:871   onError?.(`Gagal menghubungi server: ${fetchErr.message}`)
//   AssistantService:880   onError?.(`⚠️ Error: ${errorText}`)
//   AssistantService:1021  onError?.(`⚠️ Skill error HTTP ${response.status}`)
//   AssistantService:1410  onError?.('⚠️ Error: Aliran jawaban terputus sebelum selesai.')
//   ConversationEngine:1424  `⚠️ Error: ${err.message}`
//   … dan seterusnya.
//
// Akarnya BUKAN "bahasanya kurang ramah". Akarnya: **tak ada satu tempat pun yang bertanggung jawab
// atas teks yang dibaca manusia**, jadi setiap penambahan jalur galat mengarang lagi dari nol. Itu
// sebabnya di sini yang dipindah adalah tanggung jawabnya, bukan kata-katanya:
//
//   LAYANAN melaporkan APA yang gagal (kode + teks teknis).  →  LAYAR memutuskan APA yang dibaca.
//
// ── Temuan yang mengubah bentuk pekerjaan ──────────────────────────────────────────────────────
//
// `request_pipeline.ts:140-158` SUDAH mengirim kalimat Indonesia yang menyebut tindakan:
//
//   { error: 'NO_API_KEY', message: 'Aplikasi ini memerlukan API Key Anda sendiri. Buka Settings →
//     AI Provider dan masukkan API Key Anda terlebih dahulu. …' }
//
// Dan `AssistantService:878` menulis `errorText = errorData.error || errorText` — mengambil **kode
// mesinnya**, membuang **kalimat manusianya**. Jadi yang terbaca: `⚠️ Error: NO_API_KEY`.
//
// Maka aturan ke-4 di bawah ada bukan demi kerapian: ia memulihkan keterangan yang memang sudah
// dikirim dan selama ini dibuang. Kode yang TIDAK dikenali modul ini pun kini berguna, selama
// servernya menyertakan `message`.
//
// ── Empat aturan ───────────────────────────────────────────────────────────────────────────────
//
//   1. SEBUTKAN TINDAKAN, bukan hanya keadaan. "Kuota habis" tidak membantu; "isi ulang saldo"
//      membantu. Bila memang tak ada tindakan yang jujur, `saran` = null — jangan karang satu.
//   2. JANGAN MENEBAK. Tanda tak dikenali → pesan UMUM, bukan tebakan yang terdengar yakin. Pesan
//      yakin yang salah lebih merugikan daripada pesan umum.
//   3. TEKS TEKNIS TIDAK DIBUANG. Ia tetap di `teknis` dan ikut ditampilkan, kecil. Tanpa itu,
//      satu-satunya cara melapor adalah "errornya merah".
//   4. KALIMAT MANUSIA DARI SERVER DIPAKAI, bukan kode mesinnya. Lihat temuan di atas.
//
// ── Kenapa bukan satu berkas dengan Mametlite ──────────────────────────────────────────────────
//
// Keempat aturannya memang sama, dan godaan menjadikannya SALINAN besar. Tidak dilakukan, karena
// **kosakata tandanya berbeda secara sah** — bukan sekadar beda gaya:
//
//   hanya Ecosystem : sesi Supabase, mode Engineer, aliran hybrid (nalar + jawaban), eksekusi skill,
//                     plafon biaya harian, IPC Electron, pekerjaan konversi Word→PDF
//   hanya Mametlite : formulir masuk (`pesanGalatMasuk`), yang di sini ditangani LampLogin
//
// Menjadikannya salinan berarti dua berkas yang HARUS menyimpang, dijaga uji yang menuntut sama —
// pola yang `uji-catch-diam.mjs:16-21` catat sebagai aturan yang dicabut orang dalam sepekan.
// Penyatuannya (paket bersama) adalah keputusan arsitektur, sama dengan usul ADR M9 untuk tiga
// berkas PDF yang sudah bersaudara. Sampai Owner memutuskan: dua berkas, sedarah, tidak sedaging.
//
// Diuji di `uji/uji-pesan-galat-ecosystem.mjs`.

export const VERSI_PESAN_GALAT_ECOSYSTEM = 'pesan-galat-ecosystem v1 (2026-10-08)';

/** Panjang teks teknis yang ikut ke gelembung. Badan galat server bisa berupa halaman HTML utuh. */
export const BATAS_TEKNIS = 400;

/** Cocokkan tanpa peduli huruf besar/kecil; `teks` selalu string. */
const ada = (teks, ...pola) => pola.some((p) => teks.toLowerCase().includes(p.toLowerCase()));

/**
 * Kode yang DIKENALI — baik kode dari server maupun kode internal yang dipancarkan
 * `AssistantService`. Keduanya satu tabel dengan sengaja: bagi pembaca layar, "fetch gagal" dan
 * "server menolak" adalah kejadian sejenis, dan memisahkannya hanya memaksa pemanggil tahu
 * perbedaan yang tak ia miliki.
 *
 * `saran: null` berarti memang tidak ada tindakan yang jujur bisa disarankan (aturan 1).
 */
const KODE = {
  // ── dari server (`request_pipeline.ts`, `judge_endpoint.ts`, `padatkan_endpoint.ts`) ──
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

  // ── internal, dipancarkan `AssistantService` ──
  JARINGAN: {
    judul: 'Tidak bisa menghubungi server.',
    saran: 'Periksa koneksi internet Anda, lalu kirim ulang pertanyaannya.',
  },
  JARINGAN_SKILL: {
    judul: 'Tidak bisa menghubungi server saat menjalankan skill.',
    saran: 'Periksa koneksi internet Anda, lalu jalankan skill itu lagi.',
  },
  PESAN_KOSONG: {
    // Bukan kesalahan pengguna dan bukan sesuatu yang bisa ia perbaiki dengan menekan apa pun:
    // yang hilang adalah sesi. Karena itu tindakannya "masuk ulang", bukan "coba lagi".
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

/** Aturan 2: tak dikenali → umum, dan teks teknisnya yang bekerja. */
const UMUM = {
  judul: 'Permintaan gagal diproses.',
  saran: 'Coba kirim ulang. Bila terus terjadi, sebutkan teks teknis di bawah saat melapor.',
};

/** Tanda di dalam teks — dipakai bila tak ada kode, atau kodenya tak dikenali & tanpa `message`. */
function dariTeks(teknis) {
  if (ada(teknis, 'failed to fetch', 'networkerror', 'network error', 'load failed', 'fetch failed',
    'err_internet', 'err_network', 'err_connection')) {
    return KODE.JARINGAN;
  }

  if (ada(teknis, 'aborted', 'abort')) {
    return { judul: 'Permintaan dihentikan sebelum selesai.', saran: 'Kirim ulang bila masih perlu.' };
  }

  // Sesi — `AssistantService:1654` memancarkan kalimatnya sendiri; dikenali supaya tetap bertindak.
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

  // 402 — catatan Owner: saldo minus BUKAN berarti layanan mati; permintaan kecil kadang masih
  // dilayani. Jadi pesannya tidak boleh menyatakan tidak bisa dipakai sama sekali.
  if (ada(teknis, '402', 'can only afford', 'insufficient credits', 'insufficient_quota', 'credits')) {
    return {
      judul: 'Saldo penyedia tidak cukup untuk permintaan ini.',
      saran: 'Isi ulang saldo di penyedia Anda, atau coba pertanyaan yang lebih pendek — permintaan kecil kadang masih dilayani.',
    };
  }

  if (ada(teknis, '429', 'rate limit', 'too many requests')) {
    return { judul: 'Terlalu banyak permintaan dalam waktu singkat.', saran: 'Tunggu sebentar, lalu kirim lagi.' };
  }

  // Plafon biaya harian: dipasang Item 34 dan dijaga di server, jadi kalimatnya bisa sampai ke sini.
  if (ada(teknis, 'plafon', 'batas harian', 'daily cap', 'daily limit')) {
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

/**
 * Tanda galat → kalimat yang bisa ditindaklanjuti.
 *
 * @param galat  `Error`, string, atau objek `{ kode, pesan, status, teknis }`:
 *   - `kode`    kode mesin (`'NO_API_KEY'`) dari server atau dari `AssistantService`
 *   - `pesan`   kalimat manusia dari server (`message`) — dipakai bila `kode` tak dikenali (aturan 4)
 *   - `status`  status HTTP, ikut ke teks teknis
 *   - `teknis`  teks teknis mentah bila bukan dari `kode`/`status`
 * @returns {{judul: string, saran: string|null, teknis: string}}
 */
export function pesanUntukPengguna(galat) {
  if (galat && typeof galat === 'object' && !(galat instanceof Error) &&
      ('kode' in galat || 'pesan' in galat || 'status' in galat || 'teknis' in galat)) {
    const { kode, pesan, status, teknis } = galat;
    const bagian = [kode, teknis, status ? `HTTP ${status}` : null, kode === pesan ? null : pesan]
      .filter((b) => b !== null && b !== undefined && String(b).trim() !== '');
    const teksTeknis = bagian.join(' · ') || 'tanpa keterangan';

    if (kode && KODE[kode]) return { ...KODE[kode], teknis: teksTeknis };

    // Aturan 4: kode tak dikenali, tetapi servernya menyertakan kalimat manusia — pakai kalimat itu
    // apa adanya. Ia ditulis di repo ini juga, dan membuangnya adalah cacat yang baru saja ditutup.
    if (pesan && String(pesan).trim() && String(pesan) !== String(kode)) {
      return { judul: String(pesan).trim(), saran: null, teknis: teksTeknis };
    }

    return { ...(dariTeks(teksTeknis) || UMUM), teknis: teksTeknis };
  }

  const teknis = String(galat?.message ?? galat ?? '').trim() || 'tanpa keterangan';
  return { ...(dariTeks(teknis) || UMUM), teknis };
}

/**
 * Satu blok teks biasa untuk gelembung chat.
 *
 * Teks BIASA, bukan Markdown: `ConversationEngine` merender isi pesan lewat
 * `<span className="whitespace-pre-wrap">` (:2080), jadi `**tebal**` akan tampil apa adanya.
 */
export function blokGalat(galat) {
  const p = pesanUntukPengguna(galat);
  const kepala = p.saran ? `${p.judul} ${p.saran}` : p.judul;
  const teknis = p.teknis.length > BATAS_TEKNIS ? `${p.teknis.slice(0, BATAS_TEKNIS)}…` : p.teknis;
  return `⚠️ ${kepala}\n(teknis: ${teknis})`;
}

/** Satu baris untuk tempat sempit (status, panel) — tanpa teks teknis. */
export function satuBaris(galat) {
  const p = pesanUntukPengguna(galat);
  return p.saran ? `${p.judul} ${p.saran}` : p.judul;
}
