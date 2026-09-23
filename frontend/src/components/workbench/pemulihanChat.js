/**
 * pemulihanChat.js — dua keputusan kecil seputar riwayat chat yang dulu salah (perbaikan 2026-09-23).
 *
 * Dipisah dari ConversationEngine.jsx supaya bisa diuji tanpa merender React: keputusannya yang diuji,
 * bukan klaim di komentar.
 *
 * Latar: setelah muat ulang Vite, penunjuk chat (`mamet_v4_<ws>_current_chat_id`) dihapus sebelum sempat
 * dibaca, dan `loadChat` mengembalikan null untuk SEMUA kegagalan sehingga chat yang masih ada di database
 * dianggap hilang. Akibatnya layar Engineer kosong dan pesan sistem melahirkan chat-chat siluman.
 */

/**
 * Apa yang harus dilakukan terhadap hasil pembacaan chat tersimpan.
 * @param {{ messages: object[]|null, hilang: boolean }} hasil - hasil AssistantService.loadChat
 * @returns {'pakai'|'lepas'|'pertahankan'}
 *   pakai       = isi chat berhasil dibaca, tampilkan
 *   lepas       = baris chatnya memang tidak ada lagi, penunjuk boleh dihapus
 *   pertahankan = gagal membaca (gangguan sesaat) — penunjuk JANGAN dihapus, chat lama jangan ditimpa
 */
export function putusanPemulihan(hasil) {
  if (hasil && Array.isArray(hasil.messages)) return 'pakai';
  if (hasil && hasil.hilang === true) return 'lepas';
  return 'pertahankan';
}

/**
 * Bolehkah kumpulan pesan ini disimpan ke database?
 *
 * Chat BARU hanya boleh lahir dari pesan pengguna. Pesan yang dibuat sistem sendiri — laporan penalaran
 * Engineer, dialog konfirmasi, laporan patch setelah muat ulang — tidak boleh membuat baris chat baru
 * (live 2026-09-23: satu tugas Engineer terpecah jadi empat baris di tabel `chats`, dua di antaranya
 * berjudul isi laporan). Bila chatnya sudah ada, pesan sistem tetap ikut tersimpan.
 *
 * @param {{ currentChatId: string|null, messages: object[] }} keadaan
 */
/**
 * Sidik jari kumpulan pesan untuk menandai "sudah tersimpan". Dipakai autosave dan — sesudah pemulihan —
 * untuk menandai isi yang baru dibaca dari database sebagai sudah tersimpan, sehingga muat ulang tidak
 * menulis ulang baris yang isinya sama persis (setiap Ctrl+R dulu menaikkan updated_at tanpa perubahan).
 */
export function kunciSimpan({ chatId, messages }) {
  const daftar = Array.isArray(messages) ? messages : [];
  const terakhir = daftar[daftar.length - 1];
  return `${chatId || 'new'}_${daftar.length}_${(terakhir?.content || '').length}_${terakhir?.role || ''}`;
}

export function bolehSimpanChat({ currentChatId, messages }) {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  if (currentChatId) return true;
  return messages.some((m) => m && m.role === 'user');
}
