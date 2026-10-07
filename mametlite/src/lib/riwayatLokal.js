// RIWAYAT CHAT MAMETLITE DI PERAMBAN (2026-10-08) — satu pintu, dan tidak pernah melempar.
//
// Cacat yang melahirkan berkas ini (M2, `ROADMAP-SIAP-PENGGUNA.md`):
//
//   const [conversations, setConversations] = useState(() => {
//     const saved = localStorage.getItem('mametlite_conversations');
//     if (saved) return JSON.parse(saved);          // ← tanpa try, DI DALAM inisialisator useState
//
// Satu nilai `localStorage` yang rusak → `JSON.parse` melempar saat render → **layar putih**. Dan
// karena nilai buruknya masih di sana, layar putih itu KEMBALI setiap muat ulang: pengguna awam tidak
// punya jalan keluar, dan Mametlite tidak punya satu pun error boundary.
//
// `localStorage.setItem` juga tanpa `try` — `QuotaExceededError` melempar di dalam `useEffect`.
//
// Yang dikerjakan di sini, bukan menambal satu `try`:
//
//   1. SATU PINTU. Semua pembacaan/penulisan riwayat lewat berkas ini. Tidak ada `JSON.parse` liar
//      di jalur render lagi.
//   2. BENTUKNYA DIPERIKSA, bukan hanya JSON-nya. `'{}'` adalah JSON yang sah tetapi akan membuat
//      `conversations.find(...)` jatuh beberapa baris kemudian. Menangkap `JSON.parse` saja hanya
//      memindahkan kejatuhannya.
//   3. TIDAK PERNAH MELEMPAR, dan TIDAK PERNAH DIAM. Hasilnya selalu sah, dan kalau ada yang salah
//      ia memulangkan `masalah` berisi kalimat untuk pengguna. Diam di sini berarti pengguna
//      menyangka riwayatnya memang kosong — padahal ia ada dan gagal dibaca.
//      (Aturan yang sama dengan TMN-0006: "tidak bisa dibaca" ≠ "tidak ada".)
//
// `simpanan` bisa disuntik supaya berkas ini bisa diuji tanpa peramban — lihat `uji/uji-riwayat-lokal.mjs`.

export const VERSI_RIWAYAT = 'riwayat-lokal v1 (2026-10-08)';

export const KUNCI_RIWAYAT = 'mametlite_conversations';

const SAPAAN =
  'Halo! Saya **Mamet Lite**. Anda bisa mencari data di database internal (RAG), atau mengaktifkan fitur pencarian Web di bawah.';

/** Riwayat awal — dipakai saat belum ada simpanan, dan saat simpanannya tak bisa dipakai. */
export function riwayatBaru() {
  return [{ id: 1, title: 'Percakapan Baru', messages: [{ role: 'assistant', content: SAPAAN }] }];
}

/** `localStorage` bisa melempar sekadar DIAKSES (mode privat, site data diblokir), jadi dibungkus. */
function ambilSimpanan(simpanan) {
  if (simpanan !== undefined) return simpanan;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Bentuk riwayat yang bisa dipakai aplikasi.
 *
 * Diperiksa sampai ke bentuk `messages`, bukan hanya "array berisi objek": `conversations.find(...)`
 * lalu `currentConversation.messages.map(...)` keduanya ada di jalur render, jadi bentuk yang setengah
 * benar tetap berakhir layar putih — hanya beberapa baris lebih jauh.
 */
export function sahkanRiwayat(nilai) {
  if (!Array.isArray(nilai) || nilai.length === 0) return false;
  return nilai.every(
    (p) =>
      p &&
      typeof p === 'object' &&
      (typeof p.id === 'number' || typeof p.id === 'string') &&
      Array.isArray(p.messages) &&
      p.messages.every((m) => m && typeof m === 'object' && typeof m.role === 'string'),
  );
}

/**
 * Riwayat dari peramban. SELALU memulangkan riwayat yang sah.
 *
 * @returns {{riwayat: Array, masalah: string|null}} `masalah` = kalimat untuk pengguna bila
 *   simpanannya ada tetapi tidak bisa dipakai. `null` berarti wajar (kosong, atau terbaca utuh) —
 *   dan "kosong" tidak pernah dilaporkan sebagai masalah.
 */
export function bacaRiwayat(simpanan) {
  const s = ambilSimpanan(simpanan);
  if (!s) {
    return {
      riwayat: riwayatBaru(),
      masalah:
        'Peramban ini tidak mengizinkan penyimpanan lokal, jadi riwayat percakapan tidak akan tersimpan. Mode privat biasanya begitu.',
    };
  }

  let mentah;
  try {
    mentah = s.getItem(KUNCI_RIWAYAT);
  } catch {
    return {
      riwayat: riwayatBaru(),
      masalah:
        'Riwayat percakapan tidak bisa dibaca dari peramban ini, jadi dimulai dari percakapan baru.',
    };
  }

  if (mentah === null || mentah === undefined || mentah === '') {
    return { riwayat: riwayatBaru(), masalah: null }; // wajar: belum pernah ada
  }

  let diurai;
  try {
    diurai = JSON.parse(mentah);
  } catch {
    return {
      riwayat: riwayatBaru(),
      masalah:
        'Riwayat percakapan yang tersimpan rusak dan tidak bisa dibuka, jadi dimulai dari percakapan baru. Riwayat lama tidak bisa dipulihkan.',
    };
  }

  if (!sahkanRiwayat(diurai)) {
    return {
      riwayat: riwayatBaru(),
      masalah:
        'Riwayat percakapan yang tersimpan tidak dikenali bentuknya, jadi dimulai dari percakapan baru.',
    };
  }

  return { riwayat: diurai, masalah: null };
}

/**
 * Simpan riwayat. TIDAK PERNAH melempar.
 *
 * @returns {{ok: boolean, masalah: string|null}} Kuota penuh dibedakan dari kegagalan lain, karena
 *   hanya kuota yang punya tindakan jelas bagi pengguna: hapus percakapan lama.
 */
export function simpanRiwayat(riwayat, simpanan) {
  const s = ambilSimpanan(simpanan);
  if (!s) return { ok: false, masalah: null }; // sudah diberitahukan saat membaca; jangan ulangi tiap simpan

  try {
    s.setItem(KUNCI_RIWAYAT, JSON.stringify(riwayat));
    return { ok: true, masalah: null };
  } catch (e) {
    const penuh =
      e?.name === 'QuotaExceededError' ||
      e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e?.code === 22;
    return {
      ok: false,
      masalah: penuh
        ? 'Penyimpanan riwayat di peramban sudah penuh. Hapus beberapa percakapan lama supaya percakapan baru bisa tersimpan.'
        : 'Riwayat percakapan gagal disimpan di peramban ini. Percakapan tetap bisa dipakai, tetapi mungkin hilang setelah halaman ditutup.',
    };
  }
}

/** Hapus HANYA kunci riwayat — bukan kunci lain (mis. kunci OpenRouter pengguna). */
export function hapusRiwayat(simpanan) {
  const s = ambilSimpanan(simpanan);
  if (!s) return false;
  try {
    s.removeItem(KUNCI_RIWAYAT);
    return true;
  } catch {
    return false;
  }
}
