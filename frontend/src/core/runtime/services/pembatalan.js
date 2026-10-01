/**
 * pembatalan.js — membedakan permintaan yang DIBATALKAN pemakai dari yang GAGAL (2026-10-01).
 *
 * `fetch` yang diputus AbortController melempar galat seperti kegagalan jaringan biasa. Tanpa
 * pembedaan ini, menekan tombol Berhenti akan memunculkan "Gagal menghubungi server" — menuduh
 * jaringan atas sesuatu yang justru diperintahkan pemakai, dan membuat tombolnya terasa rusak.
 *
 * Ditaruh di modul tersendiri, bukan di dalam `AssistantService.js`, supaya bisa DIIMPOR berkas uji:
 * AssistantService menarik modul-modul yang hanya hidup di peramban, jadi ia tidak bisa dimuat di
 * baris perintah. Pola yang sama dipakai `KonteksChat.js` dan `statusPembaruan.js`.
 */

/**
 * @param {unknown} err galat yang tertangkap
 * @param {{aborted?: boolean}|null} signal AbortSignal kiriman ini
 * @returns {boolean} true bila ini pembatalan oleh pemakai, bukan kegagalan
 */
export function dibatalkanPemakai(err, signal) {
  // Diperiksa LEBIH DULU: pemutusan tepat di sela baca aliran bisa melempar galat bernama lain
  // (TypeError, "network error"), dan menilai dari nama galat saja akan melaporkannya sebagai
  // kerusakan jaringan kepada Owner yang baru saja menekan Berhenti.
  if (signal?.aborted) return true;
  const n = err?.name;
  return n === 'AbortError' || n === 'TimeoutError';
}
