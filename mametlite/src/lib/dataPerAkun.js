// DATA PERAMBAN PER AKUN (K4 ADR-0022, 29 Okt 2026) — riwayat chat & kunci API Mametlite disimpan TERPISAH per akun.
//
// Cacat yang ditutup: dulu `mametlite_conversations` dan `x-byok-openrouter` satu kunci untuk SEMUA akun, dan keluar akun
// hanya mengakhiri sesi. Di komputer yang dipakai bergantian (kantor), orang kedua yang masuk melihat seluruh riwayat
// chat orang pertama DAN memakai kunci OpenRouter-nya (biaya dibebankan ke orang pertama). Database & server sudah
// terisolasi (diuji 29 Okt); yang bocor hanya peramban.
//
// Data lama (kunci bersama) — keputusan Owner 29 Okt, pilihan (a): diberikan ke akun yang SEDANG MASUK saat versi ini
// pertama dibuka (sesinya tersimpan di peramban yang sama — kemungkinan besar dialah pemiliknya); tanpa sesi → dihapus,
// karena tak bisa diketahui milik siapa. Uji: uji/uji-data-per-akun.mjs.

import { KUNCI_RIWAYAT } from './riwayatLokal.js';

export const PENYEDIA_BYOK = ['openrouter', 'gemini', 'groq', 'openai'];
const kunciByokLama = (penyedia) => `x-byok-${penyedia}`;

/** Kunci `localStorage` kunci API milik SATU akun. */
export const kunciByok = (penyedia, pengguna) => `x-byok-${penyedia}:${pengguna}`;

function ambil(simpanan) {
  if (simpanan !== undefined) return simpanan;
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Kunci API milik akun ini ('' bila tak ada, tak bisa dibaca, atau belum ada akun). Tidak pernah melempar. */
export function bacaKunciByok(penyedia, pengguna, simpanan) {
  const s = ambil(simpanan);
  if (!s || !pengguna) return '';
  try { return (s.getItem(kunciByok(penyedia, pengguna)) || '').trim(); } catch { return ''; }
}

/**
 * Pindahkan data kunci-bersama lama ke akun yang sedang masuk, lalu hapus kunci lama (pilihan a).
 * Data milik akun itu yang SUDAH ada tidak ditimpa. Tanpa akun → kunci lama dihapus saja.
 * @returns {{ dipindah: string[], dihapus: string[] }} nama kunci lama yang dipindah / dihapus
 */
export function pindahkanDataLama(simpanan, pengguna) {
  const s = ambil(simpanan);
  const hasil = { dipindah: [], dihapus: [] };
  if (!s) return hasil;
  const pasangan = [
    [KUNCI_RIWAYAT, pengguna ? `${KUNCI_RIWAYAT}:${pengguna}` : null],
    ...PENYEDIA_BYOK.map((p) => [kunciByokLama(p), pengguna ? kunciByok(p, pengguna) : null]),
  ];
  for (const [lama, baru] of pasangan) {
    try {
      const nilai = s.getItem(lama);
      if (nilai === null || nilai === undefined) continue;
      if (baru && (s.getItem(baru) === null || s.getItem(baru) === undefined) && nilai !== '') {
        s.setItem(baru, nilai);
        hasil.dipindah.push(lama);
      } else {
        hasil.dihapus.push(lama);
      }
      s.removeItem(lama);
    } catch { /* penyimpanan diblokir — tak ada yang bisa dipindah; riwayatLokal sudah memberi tahu pengguna */ }
  }
  return hasil;
}
