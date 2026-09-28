/**
 * IDENTITAS KIRIMAN — jawaban milik percakapan yang BERTANYA, bukan yang sedang dilihat
 *
 * ── Bug yang ditutup (dilaporkan Owner 2026-09-28) ──────────────────────────────────────────
 * Owner bertanya di percakapan baru, lalu mengklik riwayat lain sambil menunggu. Jawabannya masuk
 * ke percakapan yang sedang dibuka — tanpa pertanyaannya — dan percakapan barunya hilang seluruhnya.
 *
 * Mekanismenya deterministik, bukan sesekali:
 *
 *   1. Pertanyaan masuk ke `messages`, BELUM tersimpan — efek penyimpanan dilewati selama `isLoading`.
 *   2. Owner membuka riwayat lain → `handleLoadChat` MENGGANTI `messages` dan `currentChatId`.
 *      Pertanyaan tadi lenyap dari memori dan memang tak pernah sempat ditulis ke basis data.
 *   3. Jawaban tiba → seluruh callback memanggil `setMessages(prev => …)`, dan `prev` kini milik
 *      percakapan lain.
 *   4. `isLoading` jadi false → efek penyimpanan menulis gabungan itu ke `currentChatId` yang baru.
 *
 * Akar masalahnya satu kalimat: **callback jawaban menulis ke percakapan yang sedang terbuka, bukan
 * ke percakapan yang mengirim pertanyaan.** Tidak ada satu pun pemeriksaan identitas di antaranya.
 *
 * ── Kenapa `chatId` saja tidak cukup ────────────────────────────────────────────────────────
 * Percakapan BARU belum punya id (`currentChatId === null`) sampai penyimpanan pertama. Membandingkan
 * id akan menganggap "chat baru A" dan "chat baru B" sebagai percakapan yang sama, dan justru chat
 * baru itulah kasus yang dilaporkan Owner. Karena itu dipakai NOMOR URUT yang naik setiap kali
 * percakapan berpindah (`handleNewChat` / `handleLoadChat`) — dua chat baru berturut-turut pun
 * bernomor berbeda.
 */

/**
 * Dipanggil sekali saat mengirim. `pesan` disalin (bukan dirujuk) karena `messages` di komponen akan
 * diganti isinya begitu Owner berpindah percakapan.
 */
export function buatPenandaKiriman({ seq, chatId, pesan }) {
  return {
    seq,
    chatId: chatId ?? null,
    pesan: Array.isArray(pesan) ? [...pesan] : []
  };
}

/** true = Owner masih di percakapan yang mengirim pertanyaan ini. */
export function masihPercakapanSama(penanda, seqSekarang) {
  return !!penanda && penanda.seq === seqSekarang;
}

/**
 * Ke mana hasil kiriman ini harus ditulis.
 *   'layar'    → Owner masih di sana; perbarui `messages` seperti biasa.
 *   'terlantar'→ Owner sudah pindah; JANGAN sentuh `messages`, simpan ke percakapan asalnya.
 */
export function tujuanTulis(penanda, seqSekarang) {
  return masihPercakapanSama(penanda, seqSekarang) ? 'layar' : 'terlantar';
}

/**
 * Pesan lengkap untuk disimpan ke percakapan asal: pertanyaan Owner apa adanya + satu pesan jawaban.
 * Dipakai hanya pada jalur 'terlantar', dan sengaja dibangun dari salinan saat kirim — bukan dari
 * `messages` yang sekarang, yang sudah milik percakapan lain.
 */
export function pesanTerlantar(penanda, jawaban) {
  const isi = typeof jawaban === 'string' ? jawaban : String(jawaban?.content ?? '');
  const tambahan = typeof jawaban === 'string' ? { role: 'model', content: isi } : { ...jawaban, role: 'model', content: isi };
  return [...(penanda?.pesan || []), tambahan];
}

/**
 * Apakah kiriman terlantar ini layak disimpan. Jawaban kosong tidak disimpan — menyimpan pertanyaan
 * tanpa jawaban hanya melahirkan percakapan setengah jadi yang membingungkan.
 */
export function layakSimpanTerlantar(penanda, jawaban) {
  const isi = typeof jawaban === 'string' ? jawaban : String(jawaban?.content ?? '');
  return !!penanda && (penanda.pesan || []).length > 0 && isi.trim().length > 0;
}
