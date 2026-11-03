// DAFTAR KONEKTOR UNTUK MENU + (Item 129 Tahap G5, 2026-11-03) — satu tugas: dua sumber status (crawler bawaan &
// server MCP umum) → satu daftar seragam untuk workspace yang sedang dibuka. Murni (diuji tanpa layar).
//
// Kenapa ada: konektor yang menyala tidak terlihat dari chat — padahal daftar alatnya ikut terkirim di SETIAP pesan
// (± 2–3 ribu token untuk GitHub 27 alat). Menu + menampilkannya dan memberi sakelar per workspace (K3).

import { KONEKTOR_DIKENAL } from '../../../../shared/konektorAlat.js';

/**
 * @param {Array} statusBawaan hasil `electronAPI.konektor.status()` (baris per workspace×konektor)
 * @param {Array} statusUmum hasil `electronAPI.konektorUmum.status()`
 * @param {string} ws workspace yang sedang dibuka
 * @returns {{id: string, nama: string, asal: 'bawaan'|'umum', diaktifkan: boolean, menyala: boolean, jumlahAlat: number, siap: boolean, keterangan: string}[]}
 */
export function susunMenuKonektor(statusBawaan, statusUmum, ws) {
  const hasil = [];
  for (const b of Array.isArray(statusBawaan) ? statusBawaan : []) {
    if (b?.workspace !== ws || !KONEKTOR_DIKENAL[b.konektor]) continue;
    const menyala = b.status === 'nyala';
    hasil.push({
      id: b.konektor, nama: String(b.nama || KONEKTOR_DIKENAL[b.konektor].nama), asal: 'bawaan',
      diaktifkan: b.diaktifkan === true, menyala,
      jumlahAlat: menyala && Array.isArray(b.alat) && b.alat.length ? b.alat.length : KONEKTOR_DIKENAL[b.konektor].alat.length,
      siap: b.tersedia !== false,
      keterangan: b.tersedia === false ? (b.alasan || 'tidak tersedia')
        : menyala ? 'menyala' : b.diaktifkan ? 'berhenti — matikan lalu nyalakan lagi' : 'mati',
    });
  }
  for (const u of Array.isArray(statusUmum) ? statusUmum : []) {
    if (!u || typeof u.id !== 'string' || KONEKTOR_DIKENAL[u.id]) continue;
    const w = u.ws?.[ws] || {};
    const menyala = w.status === 'nyala';
    const disetujui = Array.isArray(u.alatDisetujui) ? u.alatDisetujui.length : 0;
    // Tahap F2: server OAuth butuh akun terhubung — sama pentingnya dengan kredensial ketik.
    const akunTerhubung = u.oauth !== true || u.terhubung === true;
    const kredensialLengkap = (u.kredensial || []).every((k) => k?.terisi) && akunTerhubung;
    const siap = kredensialLengkap && disetujui > 0;
    let keterangan = 'mati';
    if (menyala) keterangan = 'menyala';
    else if (!akunTerhubung) keterangan = 'akun belum dihubungkan — atur di Settings';
    else if (w.status === 'perlu_hubungkan_ulang') keterangan = 'login kedaluwarsa — hubungkan ulang di Settings';
    else if (!kredensialLengkap) keterangan = 'kredensial belum diisi — atur di Settings';
    else if (!disetujui) keterangan = 'alat belum ditinjau — atur di Settings';
    else if (w.status === 'perlu_tinjau') keterangan = 'alat berubah sejak disetujui — tinjau di Settings';
    else if (w.status === 'gagal') keterangan = `gagal: ${w.alasan || 'tanpa keterangan'}`;
    else if (w.status === 'berhenti') keterangan = 'berhenti — matikan lalu nyalakan lagi';
    hasil.push({
      id: u.id, nama: String(u.nama || u.id), asal: 'umum',
      diaktifkan: w.diaktifkan === true, menyala,
      jumlahAlat: menyala && Array.isArray(w.alat) ? w.alat.length : disetujui,
      siap, keterangan,
    });
  }
  return hasil;
}

/**
 * Penanda di tombol +: 'nyala' bila ada konektor menyala; 'masalah' bila ada yang dinyalakan Owner tetapi tidak
 * menyala (gagal, berhenti, alat berubah); null bila tak ada. Masalah didahulukan — itu yang perlu dilihat.
 */
export function penandaKonektor(daftar) {
  const d = Array.isArray(daftar) ? daftar : [];
  if (d.some((k) => k.diaktifkan && !k.menyala)) return 'masalah';
  if (d.some((k) => k.menyala)) return 'nyala';
  return null;
}
