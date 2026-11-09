import { ukurRiwayat } from '../../../../../shared/ukurRiwayat.js';

export const VERSI_JEJAK_KLIEN = 1;

export function susunJejakKlien({ jalur, traceId = null, putaranAlat = false, riwayatTersedia = [], dikirim = [], konteksRag = null, semantik = null, cmg = null, anggaran = null }) {
  return {
    versi: VERSI_JEJAK_KLIEN,
    jalur,
    traceId,
    putaranAlat: putaranAlat === true,
    riwayatTersedia: ukurRiwayat(riwayatTersedia),
    dikirim: ukurRiwayat(dikirim),
    konteksRag: konteksRag ? { sebelum: konteksRag.sebelum, sesudah: konteksRag.sesudah } : null,
    semantik: semantik ? { sebelum: semantik.sebelum, sesudah: semantik.sesudah } : null,
    cmg,
    anggaran: anggaran ? { token: anggaran.token, terpakai: anggaran.terpakai, dilewati: anggaran.dilewati } : null,
  };
}
