
import { KONEKTOR_DIKENAL } from '../../../../shared/konektorAlat.js';

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

export function penandaKonektor(daftar) {
  const d = Array.isArray(daftar) ? daftar : [];
  if (d.some((k) => k.diaktifkan && !k.menyala)) return 'masalah';
  if (d.some((k) => k.menyala)) return 'nyala';
  return null;
}
