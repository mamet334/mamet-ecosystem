import { ukurRiwayat, pesanDipendekkan, POLA_HASIL_ALAT } from '../../../../shared/ukurRiwayat.js';

export { ukurRiwayat, POLA_HASIL_ALAT };

export const VERSI_JEJAK = 1;
const POLA_THINK = /<think>[\s\S]*?<\/think>\s*/gi;
const MAKS_PANGGILAN = 12;

export interface UkuranRiwayat {
  pesan: number;
  huruf: number;
  hasilAlatPesan: number;
  hasilAlatHuruf: number;
  patok: number;
}

export interface LapisRiwayat {
  nama: string;
  sebelum: UkuranRiwayat;
  sesudah: UkuranRiwayat;
  melindungi: boolean;
  pesanDipotong: number;
  pesanDisisipkan: number;
  hurufThinkDibuang?: number;
  duplikatPesanSaatIni?: boolean;
}

export interface PanggilanModel {
  utama: boolean;
  sistemHuruf: number;
  pesanHuruf: number;
  riwayat: UkuranRiwayat;
  segmen: Record<string, number>;
}

export interface JejakRag {
  diminta: boolean;
  batasWaktuMs: number | null;
  habisWaktu: boolean;
  msSelesai: number | null;
  ditemukan: number | null;
  datangTerlambat: { potongan: number; ms: number } | null;
  galat: string | null;
  turunKeKata: boolean;
  dikirim: number;
  dikirimWeb: number;
  dataTabelMenggantikan: boolean;
}

export interface JejakPrompt {
  versi: number;
  traceId: string | null;
  appSource: string;
  mode: string;
  riwayatDiterima: UkuranRiwayat;
  lapisRiwayat: LapisRiwayat[];
  kebijakan: { keputusan: string; skorRisiko: number; alatDimatikan: boolean; webDimatikan: boolean; ragTopK: number } | null;
  rag: JejakRag;
  penolakan: { lapis: string; sebab: string }[];
  panggilanModel: PanggilanModel[];
  panggilanTakTercatat: number;
}

export function hurufThink(riwayat: any): number {
  let n = 0;
  for (const m of Array.isArray(riwayat) ? riwayat : []) {
    if (typeof m?.content !== 'string') continue;
    for (const cocok of m.content.matchAll(POLA_THINK)) n += cocok[0].length;
  }
  return n;
}

export function buatJejak(awal: { traceId?: string | null; appSource?: string; mode?: string; riwayatDiterima: UkuranRiwayat }): JejakPrompt {
  return {
    versi: VERSI_JEJAK,
    traceId: awal.traceId ?? null,
    appSource: awal.appSource || 'assistant',
    mode: awal.mode || 'ASSISTANT',
    riwayatDiterima: awal.riwayatDiterima,
    lapisRiwayat: [],
    kebijakan: null,
    rag: { diminta: false, batasWaktuMs: null, habisWaktu: false, msSelesai: null, ditemukan: null, datangTerlambat: null, galat: null, turunKeKata: false, dikirim: 0, dikirimWeb: 0, dataTabelMenggantikan: false },
    penolakan: [],
    panggilanModel: [],
    panggilanTakTercatat: 0,
  };
}

export function catatLapis(jejak: JejakPrompt | null | undefined, nama: string, sebelum: any[], sesudah: any[], opsi: { melindungi?: boolean; pesanDisisipkan?: number; hurufThinkDibuang?: number; duplikatPesanSaatIni?: boolean } = {}) {
  if (!jejak) return;
  const a = Array.isArray(sebelum) ? sebelum : [];
  const b = Array.isArray(sesudah) ? sesudah : [];
  const lapis: LapisRiwayat = {
    nama,
    sebelum: ukurRiwayat(a),
    sesudah: ukurRiwayat(b),
    melindungi: opsi.melindungi === true,
    pesanDipotong: pesanDipendekkan(a, b),
    pesanDisisipkan: opsi.pesanDisisipkan ?? 0,
  };
  if (opsi.hurufThinkDibuang !== undefined) lapis.hurufThinkDibuang = opsi.hurufThinkDibuang;
  if (opsi.duplikatPesanSaatIni !== undefined) lapis.duplikatPesanSaatIni = opsi.duplikatPesanSaatIni;
  jejak.lapisRiwayat.push(lapis);
}

export function catatPanggilanModel(jejak: JejakPrompt | null | undefined, data: { utama: boolean; sistemHuruf: number; pesanHuruf: number; riwayat: any[]; segmen: Record<string, number> }) {
  if (!jejak) return;
  if (jejak.panggilanModel.length >= MAKS_PANGGILAN) { jejak.panggilanTakTercatat++; return; }
  jejak.panggilanModel.push({ utama: data.utama, sistemHuruf: data.sistemHuruf, pesanHuruf: data.pesanHuruf, riwayat: ukurRiwayat(data.riwayat), segmen: { ...data.segmen } });
}

export function catatPenolakan(jejak: JejakPrompt | null | undefined, lapis: string, sebab: string) {
  if (!jejak) return;
  jejak.penolakan.push({ lapis, sebab: String(sebab || '').slice(0, 120) });
}

export const POLA_HABIS_WAKTU_RAG = /^Tier 1 RAG timeout/;

export function catatRagGagal(jejakRag: JejakRag | null | undefined, galat: any, batasWaktuMs: number, janjiBerjalan: Promise<any> | null, mulai: number, sekarang: () => number = Date.now) {
  if (!jejakRag) return;
  const pesan = String(galat?.message || galat || '');
  jejakRag.batasWaktuMs = batasWaktuMs;
  jejakRag.habisWaktu = POLA_HABIS_WAKTU_RAG.test(pesan);
  if (!jejakRag.habisWaktu) jejakRag.galat = pesan.slice(0, 120);
  janjiBerjalan?.then(
    (r: any) => { jejakRag.datangTerlambat = { potongan: Array.isArray(r?.chunks) ? r.chunks.length : 0, ms: sekarang() - mulai }; },
    () => {},
  );
}

export function salinJejak(jejak: JejakPrompt | null | undefined): JejakPrompt | null {
  return jejak ? JSON.parse(JSON.stringify(jejak)) : null;
}

export function barisLogJejak(jejak: JejakPrompt | null | undefined): string {
  return `[JEJAK_PROMPT] ${JSON.stringify(salinJejak(jejak))}`;
}
