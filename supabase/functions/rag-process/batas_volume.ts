
export const BATAS_POTONGAN_PER_AKUN = 25_000;
export const BATAS_POTONGAN_TOTAL = 45_000;

const angka = (n: number) => n.toLocaleString('id-ID');

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
