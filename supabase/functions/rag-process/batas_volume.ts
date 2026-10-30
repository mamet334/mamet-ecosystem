/**
 * BATAS VOLUME RAG — K5 (ADR-0022, model ancaman TM-004, 30 Okt 2026).
 *
 * Pendaftaran akun Supabase terbuka (keputusan Owner), jadi siapa pun bisa membuat akun lalu mengunggah teks sebanyak
 * yang ia mau — embedding dibayar kuncinya sendiri, tetapi PENYIMPANANNYA memakai kuota database Owner (500 MB).
 * Bila kuota terlewati Supabase membuat database hanya-baca: chat, riwayat, dan Mametlite ikut berhenti.
 *
 * Ukuran 30 Okt: 1 potongan ±6,5 KB (teks + vektor 768-D + indeks); DB 60 MB; akun terbesar 3.480 potongan;
 * dokumen terbesar 87 potongan.
 *   - Per akun 10.000 potongan (±65 MB) — ruang ±3× akun terbesar hari ini.
 *   - Total 45.000 potongan (±290 MB) — banyak akun bersama-sama pun berhenti jauh sebelum 500 MB; yang tertolak
 *     hanya unggahan baru, bukan seluruh aplikasi.
 * Diperiksa SEBELUM dokumen dibuat dan sebelum embedding — penolakan tidak memakan biaya pengguna.
 */

export const BATAS_POTONGAN_PER_AKUN = 10_000;
export const BATAS_POTONGAN_TOTAL = 45_000;

const angka = (n: number) => n.toLocaleString('id-ID');

/** `null` = boleh; selain itu penolakan siap dikirim (status 413). */
export function tolakKarenaVolume(
  { baru, milikAkun, total }: { baru: number; milikAkun: number; total: number },
): { code: string; error: string } | null {
  if (milikAkun + baru > BATAS_POTONGAN_PER_AKUN) {
    return {
      code: 'KUOTA_AKUN_PENUH',
      error: `Ruang dokumen akun Anda penuh: ${angka(milikAkun)} dari ${angka(BATAS_POTONGAN_PER_AKUN)} potongan terpakai, `
        + `dokumen ini butuh ${angka(baru)}. Hapus dokumen yang tidak dipakai lagi, lalu unggah ulang.`,
    };
  }
  if (total + baru > BATAS_POTONGAN_TOTAL) {
    return {
      code: 'KUOTA_SISTEM_PENUH',
      error: 'Penyimpanan dokumen Mamet sedang penuh, jadi unggahan baru ditolak sementara. Hubungi pengelola Mamet.',
    };
  }
  return null;
}
